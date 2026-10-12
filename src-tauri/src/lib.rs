use std::io::{Read, Write};
use std::net::{Ipv4Addr, SocketAddr, TcpStream};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

use qrcode::render::svg;
use qrcode::QrCode;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, Url, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_opener::OpenerExt;

const DEFAULT_PORT: u16 = 1300;
const PORT_VARIABLE: &str = "DEIXA_PORT";
const MAIN_WINDOW: &str = "main";
const QR_WINDOW: &str = "qr";
const STATUS_INTERVAL: Duration = Duration::from_secs(5);
const PROBE_TIMEOUT: Duration = Duration::from_millis(600);
const LOOPBACK: Ipv4Addr = Ipv4Addr::LOCALHOST;
const IDENTITY_PATH: &str = "/manifest.webmanifest";
const IDENTITY_MARK: &str = "Deixa";
const MAX_IDENTITY_BYTES: u64 = 16 * 1024;
const DATA_HOME_VARIABLE: &str = "DEIXA_APP_DIR";
const SETUP_CODE_FILE: &str = "setup-code.txt";
const SERVER_FOLDER: &str = "server";
const SERVER_ENTRY: &str = "server.js";
const NODE_BINARY: &str = if cfg!(windows) { "node.exe" } else { "node" };
const INHERITED_VARIABLES: [&str; 9] = [
    "HOME",
    "USERPROFILE",
    "APPDATA",
    "LOCALAPPDATA",
    "SystemRoot",
    "TMPDIR",
    "TEMP",
    "LANG",
    "TZ",
];
const START_ATTEMPTS: u32 = 150;
const START_INTERVAL: Duration = Duration::from_millis(300);
const STATUS_STARTING: &str = "Servidor: iniciando";
const STATUS_BUSY: &str = "Servidor: a porta está ocupada por outro programa";
const STATUS_MISSING: &str = "Servidor: arquivos do servidor não encontrados";
const STATUS_UP: &str = "Servidor: no ar";
const STATUS_DOWN: &str = "Servidor: fora do ar";

fn server_port() -> u16 {
    std::env::var(PORT_VARIABLE)
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(DEFAULT_PORT)
}

fn local_url() -> String {
    format!("http://{}:{}", LOOPBACK, server_port())
}

fn network_url() -> String {
    match local_ip_address::local_ip() {
        Ok(address) => format!("http://{}:{}", address, server_port()),
        Err(_) => local_url(),
    }
}

fn read_identity() -> Option<String> {
    let address = SocketAddr::from((LOOPBACK, server_port()));
    let mut stream = TcpStream::connect_timeout(&address, PROBE_TIMEOUT).ok()?;
    stream.set_read_timeout(Some(PROBE_TIMEOUT)).ok()?;
    stream.set_write_timeout(Some(PROBE_TIMEOUT)).ok()?;
    let request = format!(
        "GET {} HTTP/1.1\r\nHost: {}:{}\r\nAccept: application/json\r\nConnection: close\r\n\r\n",
        IDENTITY_PATH,
        LOOPBACK,
        server_port()
    );
    stream.write_all(request.as_bytes()).ok()?;
    let mut response = String::new();
    stream.take(MAX_IDENTITY_BYTES).read_to_string(&mut response).ok()?;
    Some(response)
}

fn server_is_up() -> bool {
    read_identity()
        .map(|response| response.starts_with("HTTP/1.1 200") && response.contains(IDENTITY_MARK))
        .unwrap_or(false)
}

struct ServerProcess(Mutex<Option<Child>>);

enum Startup {
    AlreadyRunning,
    Started,
    PortBusy,
    Missing,
}

fn port_is_taken() -> bool {
    let address = SocketAddr::from((LOOPBACK, server_port()));
    TcpStream::connect_timeout(&address, PROBE_TIMEOUT).is_ok()
}

fn data_home(app: &AppHandle) -> Option<PathBuf> {
    match std::env::var(DATA_HOME_VARIABLE) {
        Ok(custom) if !custom.trim().is_empty() => Some(PathBuf::from(custom)),
        _ => app.path().app_data_dir().ok(),
    }
}

fn development_node() -> Option<PathBuf> {
    let folder = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("binaries");
    std::fs::read_dir(folder).ok().and_then(|entries| {
        entries
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .find(|path| {
                path.file_name()
                    .and_then(|name| name.to_str())
                    .map(|name| name.starts_with("node-"))
                    .unwrap_or(false)
            })
    })
}

fn node_binary() -> Option<PathBuf> {
    if cfg!(debug_assertions) {
        return development_node();
    }
    std::env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(|folder| folder.join(NODE_BINARY)))
        .filter(|path| path.exists())
}

fn server_folder(app: &AppHandle) -> Option<PathBuf> {
    let folder = if cfg!(debug_assertions) {
        Some(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(SERVER_FOLDER))
    } else {
        app.path()
            .resource_dir()
            .ok()
            .map(|resources| resources.join(SERVER_FOLDER))
    };
    folder.filter(|path| path.join(SERVER_ENTRY).exists())
}

fn start_server(app: &AppHandle) -> Startup {
    if server_is_up() {
        return Startup::AlreadyRunning;
    }
    if port_is_taken() {
        return Startup::PortBusy;
    }
    let (Some(node), Some(folder), Some(home)) = (node_binary(), server_folder(app), data_home(app))
    else {
        return Startup::Missing;
    };
    if std::fs::create_dir_all(&home).is_err() {
        return Startup::Missing;
    }
    let mut command = Command::new(node);
    command.arg(SERVER_ENTRY).current_dir(folder).env_clear();
    for name in INHERITED_VARIABLES {
        if let Ok(value) = std::env::var(name) {
            command.env(name, value);
        }
    }
    let spawned = command
        .env("NODE_ENV", "production")
        .env("PORT", server_port().to_string())
        .env("HOSTNAME", "0.0.0.0")
        .env("DEIXA_CONFIG_DIR", &home)
        .env("DATA_DIR", home.join("data"))
        .env("SESSION_COOKIE_SECURE", "false")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn();
    match spawned {
        Ok(child) => {
            if let Ok(mut slot) = app.state::<ServerProcess>().0.lock() {
                *slot = Some(child);
            }
            Startup::Started
        }
        Err(_) => Startup::Missing,
    }
}

fn stop_server(app: &AppHandle) {
    if let Ok(mut slot) = app.state::<ServerProcess>().0.lock() {
        if let Some(mut child) = slot.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

fn wait_until_up() -> bool {
    for _ in 0..START_ATTEMPTS {
        if server_is_up() {
            return true;
        }
        std::thread::sleep(START_INTERVAL);
    }
    false
}

fn owns_running_server(app: &AppHandle) -> bool {
    match app.state::<ServerProcess>().0.lock() {
        Ok(mut slot) => match slot.as_mut() {
            Some(child) => matches!(child.try_wait(), Ok(None)),
            None => false,
        },
        Err(_) => false,
    }
}

fn entry_url(app: &AppHandle) -> String {
    if !owns_running_server(app) {
        return local_url();
    }
    let code = data_home(app)
        .and_then(|home| std::fs::read_to_string(home.join(SETUP_CODE_FILE)).ok())
        .map(|code| code.trim().to_string())
        .filter(|code| !code.is_empty() && code.chars().all(|c| c.is_ascii_alphanumeric() || c == '-'));
    match code {
        Some(code) => format!("{}/setup/unlock?code={}", local_url(), code),
        None => local_url(),
    }
}

fn is_app_page(url: &Url) -> bool {
    let from_server = url.scheme() == "http"
        && url.host_str() == Some(LOOPBACK.to_string().as_str())
        && url.port() == Some(server_port());
    let from_shell = url.scheme() == "tauri" || url.host_str() == Some("tauri.localhost");
    from_server || from_shell
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
        return;
    }
    let target = if server_is_up() {
        entry_url(app)
            .parse()
            .map(WebviewUrl::External)
            .unwrap_or_else(|_| WebviewUrl::App("index.html".into()))
    } else {
        WebviewUrl::App("index.html".into())
    };
    let opener = app.clone();
    let _ = WebviewWindowBuilder::new(app, MAIN_WINDOW, target)
        .on_navigation(move |url| {
            if is_app_page(url) {
                return true;
            }
            if url.scheme() == "https" || url.scheme() == "http" {
                let _ = opener.opener().open_url(url.as_str(), None::<&str>);
            }
            false
        })
        .title("Deixa")
        .inner_size(430.0, 880.0)
        .min_inner_size(360.0, 600.0)
        .build();
}

fn show_qr_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(QR_WINDOW) {
        let _ = window.close();
    }
    let url = network_url();
    let image = QrCode::new(url.as_bytes())
        .map(|code| code.render::<svg::Color>().min_dimensions(240, 240).build())
        .unwrap_or_default();
    let payload = serde_json::json!({ "svg": image, "url": url });
    let _ = WebviewWindowBuilder::new(app, QR_WINDOW, WebviewUrl::App("qr.html".into()))
        .title("Abrir no celular")
        .inner_size(340.0, 460.0)
        .resizable(false)
        .initialization_script(format!("window.__DEIXA_QR__ = {};", payload))
        .build();
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let status = MenuItem::with_id(app, "status", STATUS_DOWN, false, None::<&str>)?;
    let open = MenuItem::with_id(app, "open", "Abrir o Deixa", true, None::<&str>)?;
    let browser = MenuItem::with_id(app, "browser", "Abrir no navegador", true, None::<&str>)?;
    let qr = MenuItem::with_id(app, "qr", "Abrir no celular (QR code)", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &status,
            &PredefinedMenuItem::separator(app)?,
            &open,
            &browser,
            &qr,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;
    let mut tray = TrayIconBuilder::with_id("deixa")
        .tooltip("Deixa")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main_window(app),
            "browser" => {
                let _ = app.opener().open_url(local_url(), None::<&str>);
            }
            "qr" => show_qr_window(app),
            "quit" => app.exit(0),
            _ => {}
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;

    let handle = app.clone();
    std::thread::spawn(move || {
        let _ = status.set_text(STATUS_STARTING);
        let startup = start_server(&handle);
        let trouble = match startup {
            Startup::PortBusy => Some(STATUS_BUSY),
            Startup::Missing => Some(STATUS_MISSING),
            Startup::AlreadyRunning | Startup::Started => None,
        };
        if trouble.is_none() {
            wait_until_up();
        }
        let opener = handle.clone();
        let _ = handle.run_on_main_thread(move || show_main_window(&opener));
        loop {
            let text = if server_is_up() { STATUS_UP } else { trouble.unwrap_or(STATUS_DOWN) };
            let _ = status.set_text(text);
            std::thread::sleep(STATUS_INTERVAL);
        }
    });
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .manage(ServerProcess(Mutex::new(None)))
        .plugin(tauri_plugin_single_instance::init(|app, _arguments, _directory| {
            show_main_window(app)
        }))
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            build_tray(app.handle())?;
            let handle = app.handle().clone();
            let _ = ctrlc::set_handler(move || {
                stop_server(&handle);
                handle.exit(0);
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == MAIN_WINDOW {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("falha ao iniciar a casca do Deixa")
        .run(|app, event| match event {
            tauri::RunEvent::ExitRequested { api, code, .. } => {
                if code.is_none() {
                    api.prevent_exit();
                }
            }
            tauri::RunEvent::Exit => stop_server(app),
            _ => {}
        });
}
