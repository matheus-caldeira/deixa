use std::collections::HashSet;
use std::io::{Read, Write};
use std::net::{Ipv4Addr, SocketAddr, TcpStream};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use hmac::{Hmac, Mac};
use qrcode::render::svg;
use qrcode::QrCode;
use sha2::Sha256;
use tauri::menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, Url, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_opener::OpenerExt;

const DEFAULT_PORT: u16 = 1300;
const PORT_VARIABLE: &str = "DEIXA_PORT";
const MAIN_WINDOW: &str = "main";
const QR_WINDOW: &str = "qr";
const STATUS_INTERVAL: Duration = Duration::from_secs(5);
const PROBE_TIMEOUT: Duration = Duration::from_millis(600);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(4);
const LOOPBACK: Ipv4Addr = Ipv4Addr::LOCALHOST;
const IDENTITY_PATH: &str = "/manifest.webmanifest";
const IDENTITY_MARK: &str = "Deixa";
const MAX_IDENTITY_BYTES: u64 = 16 * 1024;
const DATA_HOME_VARIABLE: &str = "DEIXA_APP_DIR";
const SETUP_CODE_FILE: &str = "setup-code.txt";
const DESKTOP_TOKEN_FILE: &str = "desktop-token.txt";
const DESKTOP_SIGNATURE_HEADER: &str = "x-deixa-desktop-signature";
const LISTENER_TOOLS: [&str; 2] = ["/usr/sbin/lsof", "/usr/bin/lsof"];
const DESKTOP_TOKEN_BYTES: usize = 32;
const STATUS_PATH: &str = "/api/desktop/status";
const HELLO_PATH: &str = "/api/desktop/hello";
const TICKET_PATH: &str = "/api/desktop/ticket";
const NONCE_BYTES: usize = 16;
const PROOF_PREFIX: &str = "hello:";
const MAX_STATUS_BYTES: u64 = 64 * 1024;
const NAVIGATION: [(&str, &str, &str, &str); 7] = [
    ("go-home", "Início", "/", "CmdOrCtrl+1"),
    ("go-catalog", "Explorar", "/catalog", "CmdOrCtrl+2"),
    ("go-review", "Revisar", "/review", "CmdOrCtrl+3"),
    ("go-tutor", "Conversar", "/tutor", "CmdOrCtrl+4"),
    ("go-progress", "Progresso", "/progress", "CmdOrCtrl+5"),
    ("go-transfer", "Importar e exportar", "/transfer", "CmdOrCtrl+6"),
    ("go-settings", "Configurações", "/settings", "CmdOrCtrl+7"),
];
const TRANSFER_IMPORT_PATH: &str = "/transfer#importar";
const TRANSFER_EXPORT_PATH: &str = "/transfer#exportar";
const AUTHOR_NAME: &str = "Matheus Caldeira";
const AUTHOR_EMAIL: &str = "matheuscardozo4@gmail.com";
const AUTHOR_PHONE: &str = "+55 41 99524-5271";
const ABOUT_COMMENTS: &str = "Inglês a partir das séries e filmes que você já assiste.";
const RESUME_EMPTY: &str = "Nada em andamento";
const INBOX_EMPTY: &str = "Sem notificações novas";
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

fn http_get(path: &str, header: Option<(&str, &str)>, limit: u64) -> Option<String> {
    http_request("GET", path, header, limit)
}

fn http_request(method: &str, path: &str, header: Option<(&str, &str)>, limit: u64) -> Option<String> {
    let address = SocketAddr::from((LOOPBACK, server_port()));
    let mut stream = TcpStream::connect_timeout(&address, PROBE_TIMEOUT).ok()?;
    stream.set_read_timeout(Some(REQUEST_TIMEOUT)).ok()?;
    stream.set_write_timeout(Some(PROBE_TIMEOUT)).ok()?;
    let extra = header
        .map(|(name, value)| format!("{}: {}\r\n", name, value))
        .unwrap_or_default();
    let request = format!(
        "{} {} HTTP/1.0\r\nHost: {}:{}\r\nAccept: application/json\r\nContent-Length: 0\r\n{}Connection: close\r\n\r\n",
        method,
        path,
        LOOPBACK,
        server_port(),
        extra
    );
    stream.write_all(request.as_bytes()).ok()?;
    let mut response = String::new();
    stream.take(limit).read_to_string(&mut response).ok()?;
    Some(response)
}

fn read_identity() -> Option<String> {
    http_get(IDENTITY_PATH, None, MAX_IDENTITY_BYTES)
}

fn is_ok(response: &str) -> bool {
    response
        .split_whitespace()
        .nth(1)
        .map(|status| status == "200")
        .unwrap_or(false)
}

fn server_is_up() -> bool {
    read_identity()
        .map(|response| is_ok(&response) && response.contains(IDENTITY_MARK))
        .unwrap_or(false)
}

struct ServerProcess(Mutex<Option<Child>>);
struct DesktopToken(Mutex<Option<String>>);
struct VerifiedPeer(Mutex<Option<u32>>);

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{:02x}", byte)).collect()
}

fn json_field(response: &str, field: &str) -> Option<String> {
    if !is_ok(response) {
        return None;
    }
    let body = response.split_once("\r\n\r\n")?.1;
    let parsed: serde_json::Value = serde_json::from_str(body).ok()?;
    parsed.get(field)?.as_str().map(str::to_string)
}

fn peer_proves_token(token: &str) -> bool {
    let mut bytes = [0u8; NONCE_BYTES];
    if getrandom::fill(&mut bytes).is_err() {
        return false;
    }
    let nonce = hex(&bytes);
    let Some(response) = http_get(&format!("{}?nonce={}", HELLO_PATH, nonce), None, MAX_STATUS_BYTES)
    else {
        return false;
    };
    let Some(proof) = json_field(&response, "proof") else {
        return false;
    };
    let Ok(mut expected) = Hmac::<Sha256>::new_from_slice(token.as_bytes()) else {
        return false;
    };
    expected.update(format!("{}{}", PROOF_PREFIX, nonce).as_bytes());
    let Ok(given) = (0..proof.len())
        .step_by(2)
        .map(|index| u8::from_str_radix(proof.get(index..index + 2).unwrap_or("zz"), 16))
        .collect::<Result<Vec<u8>, _>>()
    else {
        return false;
    };
    expected.verify_slice(&given).is_ok()
}

fn sign_request(token: &str, method: &str, path: &str) -> Option<String> {
    let stamp = SystemTime::now().duration_since(UNIX_EPOCH).ok()?.as_secs();
    let mut mac = Hmac::<Sha256>::new_from_slice(token.as_bytes()).ok()?;
    mac.update(format!("{}\n{}\n{}", method, path, stamp).as_bytes());
    Some(format!("{}.{}", stamp, hex(&mac.finalize().into_bytes())))
}

fn signed_request(token: &str, method: &str, path: &str) -> Option<String> {
    let signature = sign_request(token, method, path)?;
    http_request(
        method,
        path,
        Some((DESKTOP_SIGNATURE_HEADER, &signature)),
        MAX_STATUS_BYTES,
    )
}

#[cfg(unix)]
fn listener_ids() -> Option<Vec<u32>> {
    let tool = LISTENER_TOOLS.iter().find(|path| std::path::Path::new(path).exists())?;
    let output = Command::new(tool)
        .args(["-nP", &format!("-iTCP:{}", server_port()), "-sTCP:LISTEN", "-t"])
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output()
        .ok()?;
    let ids: Vec<u32> = String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter_map(|line| line.trim().parse().ok())
        .collect();
    Some(ids)
}

#[cfg(windows)]
fn listener_ids() -> Option<Vec<u32>> {
    let output = Command::new("netstat")
        .args(["-ano", "-p", "TCP"])
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output()
        .ok()?;
    let suffix = format!(":{}", server_port());
    let ids: Vec<u32> = String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter_map(|line| {
            let fields: Vec<&str> = line.split_whitespace().collect();
            let listening = fields.len() >= 5 && fields[3] == "LISTENING" && fields[1].ends_with(&suffix);
            listening.then(|| fields[4].parse().ok()).flatten()
        })
        .collect();
    Some(ids)
}

fn only_child_listens(child: u32) -> bool {
    match listener_ids() {
        Some(ids) => !ids.is_empty() && ids.iter().all(|id| *id == child),
        None => false,
    }
}

fn running_child_id(app: &AppHandle) -> Option<u32> {
    let process = app.state::<ServerProcess>();
    let mut slot = process.0.lock().ok()?;
    let child = slot.as_mut()?;
    matches!(child.try_wait(), Ok(None)).then(|| child.id())
}

struct OwnerStatus {
    resume: Option<String>,
    notifications: Vec<(String, String, String)>,
}

fn issue_desktop_token(home: &PathBuf) -> Option<String> {
    let mut bytes = [0u8; DESKTOP_TOKEN_BYTES];
    getrandom::fill(&mut bytes).ok()?;
    let token = hex(&bytes);
    let path = home.join(DESKTOP_TOKEN_FILE);
    let _ = std::fs::remove_file(&path);
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(&path).ok()?;
    file.write_all(token.as_bytes()).ok()?;
    Some(token)
}

fn current_token(app: &AppHandle) -> Option<String> {
    let child = running_child_id(app)?;
    if !only_child_listens(child) {
        return None;
    }
    let token = app.state::<DesktopToken>().0.lock().ok()?.clone()?;
    let peer = app.state::<VerifiedPeer>();
    let mut verified = peer.0.lock().ok()?;
    if *verified != Some(child) {
        if !peer_proves_token(&token) {
            return None;
        }
        *verified = Some(child);
    }
    Some(token)
}

fn request_entry_ticket(app: &AppHandle) -> Option<String> {
    let token = current_token(app)?;
    let response = signed_request(&token, "POST", TICKET_PATH)?;
    json_field(&response, "ticket").filter(|ticket| ticket.chars().all(|c| c.is_ascii_hexdigit()))
}

fn read_owner_status(app: &AppHandle) -> Option<OwnerStatus> {
    let token = current_token(app)?;
    let response = signed_request(&token, "GET", STATUS_PATH)?;
    if !is_ok(&response) {
        return None;
    }
    let body = response.split_once("\r\n\r\n")?.1;
    let status: serde_json::Value = serde_json::from_str(body).ok()?;
    let text = |value: &serde_json::Value, key: &str| value.get(key)?.as_str().map(str::to_string);
    let resume = status.get("current").filter(|current| !current.is_null()).and_then(|current| {
        let percent = current.get("progressPercent")?.as_u64()?;
        Some(format!(
            "Continuar: {} · {} ({}%)",
            text(current, "title")?,
            text(current, "label")?,
            percent
        ))
    });
    let notifications = status
        .get("notifications")
        .and_then(|list| list.as_array())
        .map(|list| {
            list.iter()
                .filter_map(|item| Some((text(item, "id")?, text(item, "title")?, text(item, "body")?)))
                .collect()
        })
        .unwrap_or_default();
    Some(OwnerStatus { resume, notifications })
}

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
    let token = issue_desktop_token(&home);
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
            if let Ok(mut slot) = app.state::<DesktopToken>().0.lock() {
                *slot = token;
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

fn report_entry(kind: &str) {
    if cfg!(debug_assertions) {
        eprintln!("entrada da janela: {}", kind);
    }
}

fn entry_url(app: &AppHandle) -> String {
    if current_token(app).is_none() {
        report_entry("sem servidor próprio conferido");
        return local_url();
    }
    let code = data_home(app)
        .and_then(|home| std::fs::read_to_string(home.join(SETUP_CODE_FILE)).ok())
        .map(|code| code.trim().to_string())
        .filter(|code| !code.is_empty() && code.chars().all(|c| c.is_ascii_alphanumeric() || c == '-'));
    if let Some(code) = code {
        report_entry("configuração destravada");
        return format!("{}/setup/unlock?code={}", local_url(), code);
    }
    match request_entry_ticket(app) {
        Some(ticket) => {
            report_entry("bilhete do dono");
            format!("{}/desktop/enter?ticket={}", local_url(), ticket)
        }
        None => {
            report_entry("sem bilhete");
            local_url()
        }
    }
}

fn is_app_page(url: &Url) -> bool {
    let from_server = url.scheme() == "http"
        && url.host_str() == Some(LOOPBACK.to_string().as_str())
        && url.port() == Some(server_port());
    let from_shell = url.scheme() == "tauri" || url.host_str() == Some("tauri.localhost");
    from_server || from_shell
}

fn show_in_dock(app: &AppHandle, visible: bool) {
    #[cfg(target_os = "macos")]
    {
        let policy = if visible {
            tauri::ActivationPolicy::Regular
        } else {
            tauri::ActivationPolicy::Accessory
        };
        let _ = app.set_activation_policy(policy);
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, visible);
    }
}

fn go_to(app: &AppHandle, path: &str) {
    show_main_window(app);
    let Some(window) = app.get_webview_window(MAIN_WINDOW) else {
        return;
    };
    if let Ok(url) = format!("{}{}", local_url(), path).parse() {
        let _ = window.navigate(url);
    }
}


fn about_metadata(app: &AppHandle) -> AboutMetadata<'static> {
    AboutMetadata {
        name: Some("Deixa".into()),
        version: Some(app.package_info().version.to_string()),
        authors: Some(vec![AUTHOR_NAME.into()]),
        comments: Some(ABOUT_COMMENTS.into()),
        copyright: Some(format!("© 2026 {}", AUTHOR_NAME)),
        credits: Some(format!("{}\n{}\n{}\n{}", ABOUT_COMMENTS, AUTHOR_NAME, AUTHOR_EMAIL, AUTHOR_PHONE)),
        ..Default::default()
    }
}

fn build_app_menu(app: &AppHandle) -> tauri::Result<()> {
    let settings = MenuItem::with_id(app, "settings", "Configurações…", true, Some("CmdOrCtrl+,"))?;
    let quit = MenuItem::with_id(app, "app-quit", "Sair do Deixa", true, Some("CmdOrCtrl+Q"))?;
    let application = Submenu::with_items(
        app,
        "Deixa",
        true,
        &[
            &PredefinedMenuItem::about(app, Some("Sobre o Deixa"), Some(about_metadata(app)))?,
            &PredefinedMenuItem::separator(app)?,
            &settings,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, Some("Ocultar o Deixa"))?,
            &PredefinedMenuItem::hide_others(app, Some("Ocultar outros"))?,
            &PredefinedMenuItem::show_all(app, Some("Mostrar todos"))?,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;
    let browser = MenuItem::with_id(app, "app-browser", "Abrir no navegador", true, Some("CmdOrCtrl+B"))?;
    let qr = MenuItem::with_id(app, "app-qr", "Abrir no celular (QR code)", true, None::<&str>)?;
    let import = MenuItem::with_id(app, "transfer-import", "Importar…", true, Some("CmdOrCtrl+I"))?;
    let export = MenuItem::with_id(app, "transfer-export", "Exportar…", true, Some("CmdOrCtrl+E"))?;
    let file = Submenu::with_items(
        app,
        "Arquivo",
        true,
        &[
            &import,
            &export,
            &PredefinedMenuItem::separator(app)?,
            &browser,
            &qr,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, Some("Fechar janela"))?,
        ],
    )?;
    let edit = Submenu::with_items(
        app,
        "Editar",
        true,
        &[
            &PredefinedMenuItem::undo(app, Some("Desfazer"))?,
            &PredefinedMenuItem::redo(app, Some("Refazer"))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, Some("Recortar"))?,
            &PredefinedMenuItem::copy(app, Some("Copiar"))?,
            &PredefinedMenuItem::paste(app, Some("Colar"))?,
            &PredefinedMenuItem::select_all(app, Some("Selecionar tudo"))?,
        ],
    )?;
    let go = Submenu::new(app, "Ir", true)?;
    for (id, label, _path, shortcut) in NAVIGATION {
        go.append(&MenuItem::with_id(app, id, label, true, Some(shortcut))?)?;
    }
    go.append(&PredefinedMenuItem::separator(app)?)?;
    go.append(&MenuItem::with_id(app, "reload", "Recarregar", true, Some("CmdOrCtrl+R"))?)?;
    let window = Submenu::with_items(
        app,
        "Janela",
        true,
        &[
            &PredefinedMenuItem::minimize(app, Some("Minimizar"))?,
            &PredefinedMenuItem::maximize(app, Some("Zoom"))?,
            &PredefinedMenuItem::fullscreen(app, Some("Tela cheia"))?,
        ],
    )?;
    app.set_menu(Menu::with_items(app, &[&application, &file, &edit, &go, &window])?)?;
    app.on_menu_event(|app, event| {
        let id = event.id.as_ref();
        if let Some((_, _, path, _)) = NAVIGATION.iter().find(|entry| entry.0 == id) {
            go_to(app, path);
            return;
        }
        match id {
            "settings" => go_to(app, "/settings"),
            "transfer-import" => go_to(app, TRANSFER_IMPORT_PATH),
            "transfer-export" => go_to(app, TRANSFER_EXPORT_PATH),
            "app-browser" => {
                let _ = app.opener().open_url(local_url(), None::<&str>);
            }
            "app-qr" => show_qr_window(app),
            "reload" => {
                if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
                    let _ = window.eval("window.location.reload()");
                }
            }
            "app-quit" => app.exit(0),
            _ => {}
        }
    });
    Ok(())
}

fn show_main_window(app: &AppHandle) {
    show_in_dock(app, true);
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
    let resume = MenuItem::with_id(app, "resume", RESUME_EMPTY, false, None::<&str>)?;
    let inbox = MenuItem::with_id(app, "inbox", INBOX_EMPTY, false, None::<&str>)?;
    let open = MenuItem::with_id(app, "open", "Abrir o Deixa", true, None::<&str>)?;
    let browser = MenuItem::with_id(app, "browser", "Abrir no navegador", true, None::<&str>)?;
    let qr = MenuItem::with_id(app, "qr", "Abrir no celular (QR code)", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &status,
            &resume,
            &inbox,
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
            "open" | "resume" | "inbox" => show_main_window(app),
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
        let mut announced: Option<HashSet<String>> = None;
        loop {
            let text = if server_is_up() { STATUS_UP } else { trouble.unwrap_or(STATUS_DOWN) };
            let _ = status.set_text(text);
            let owner = read_owner_status(&handle);
            let resume_text = owner.as_ref().and_then(|current| current.resume.clone());
            let _ = resume.set_enabled(resume_text.is_some());
            let _ = resume.set_text(resume_text.unwrap_or_else(|| RESUME_EMPTY.to_string()));
            let pending = owner.as_ref().map(|current| current.notifications.len()).unwrap_or(0);
            let _ = inbox.set_enabled(pending > 0);
            let _ = inbox.set_text(match pending {
                0 => INBOX_EMPTY.to_string(),
                1 => "1 notificação nova".to_string(),
                count => format!("{} notificações novas", count),
            });
            if let Some(current) = owner {
                let ids: HashSet<String> = current.notifications.iter().map(|item| item.0.clone()).collect();
                if let Some(known) = &announced {
                    for (id, title, body) in &current.notifications {
                        if !known.contains(id) {
                            let shown = handle.notification().builder().title(title).body(body).show();
                            if cfg!(debug_assertions) {
                                eprintln!("aviso nativo: {:?}", shown.map(|_| "enviado ao sistema"));
                            }
                        }
                    }
                }
                announced = Some(ids);
            }
            std::thread::sleep(STATUS_INTERVAL);
        }
    });
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .manage(ServerProcess(Mutex::new(None)))
        .manage(DesktopToken(Mutex::new(None)))
        .manage(VerifiedPeer(Mutex::new(None)))
        .plugin(tauri_plugin_single_instance::init(|app, _arguments, _directory| {
            show_main_window(app)
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            build_app_menu(app.handle())?;
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
                    show_in_dock(window.app_handle(), false);
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
