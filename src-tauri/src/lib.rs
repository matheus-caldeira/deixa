use std::net::{SocketAddr, TcpStream};
use std::time::Duration;

use qrcode::render::svg;
use qrcode::QrCode;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_opener::OpenerExt;

const DEFAULT_PORT: u16 = 1300;
const PORT_VARIABLE: &str = "DEIXA_PORT";
const MAIN_WINDOW: &str = "main";
const QR_WINDOW: &str = "qr";
const STATUS_INTERVAL: Duration = Duration::from_secs(5);
const PROBE_TIMEOUT: Duration = Duration::from_millis(600);
const STATUS_UP: &str = "Servidor: no ar";
const STATUS_DOWN: &str = "Servidor: fora do ar";

fn server_port() -> u16 {
    std::env::var(PORT_VARIABLE)
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(DEFAULT_PORT)
}

fn local_url() -> String {
    format!("http://localhost:{}", server_port())
}

fn network_url() -> String {
    match local_ip_address::local_ip() {
        Ok(address) => format!("http://{}:{}", address, server_port()),
        Err(_) => local_url(),
    }
}

fn server_is_up() -> bool {
    let address = SocketAddr::from(([127, 0, 0, 1], server_port()));
    TcpStream::connect_timeout(&address, PROBE_TIMEOUT).is_ok()
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
        return;
    }
    let target = if server_is_up() {
        local_url()
            .parse()
            .map(WebviewUrl::External)
            .unwrap_or_else(|_| WebviewUrl::App("index.html".into()))
    } else {
        WebviewUrl::App("index.html".into())
    };
    let _ = WebviewWindowBuilder::new(app, MAIN_WINDOW, target)
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

    std::thread::spawn(move || loop {
        let _ = status.set_text(if server_is_up() { STATUS_UP } else { STATUS_DOWN });
        std::thread::sleep(STATUS_INTERVAL);
    });
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _arguments, _directory| {
            show_main_window(app)
        }))
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            build_tray(app.handle())?;
            show_main_window(app.handle());
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
        .run(|_app, event| {
            if let tauri::RunEvent::ExitRequested { api, code, .. } = event {
                if code.is_none() {
                    api.prevent_exit();
                }
            }
        });
}
