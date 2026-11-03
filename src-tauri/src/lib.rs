mod labels;
mod shell;

use std::collections::HashSet;
use std::io::{Read, Write};
use std::net::{Ipv4Addr, SocketAddr, TcpStream};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicI32, AtomicU16, Ordering};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use hmac::{Hmac, Mac};
use qrcode::render::svg;
use qrcode::QrCode;
use sha2::Sha256;
use tauri::menu::{AboutMetadata, CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, Url, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_opener::OpenerExt;

use labels::{Labels, DEFAULT_LOCALE};

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
const PORT_SPAN: u16 = 10;
const SERVER_RECORD_FILE: &str = "desktop-server.pid";
const AUTO_ENTER_FILE: &str = "desktop-auto-enter.txt";
const AUTO_ENTER_DEFAULT: bool = true;
const LOGIN_PATH: &str = "/login";
const HOME_PATH: &str = "/";
const TAP_ACTION: &str = "tap";
const ORPHAN_STOP_ATTEMPTS: u32 = 20;
const ORPHAN_STOP_INTERVAL: Duration = Duration::from_millis(250);
static ACTIVE_PORT: AtomicU16 = AtomicU16::new(0);
static NEXT_NOTIFICATION_ID: AtomicI32 = AtomicI32::new(1);

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

fn hidden_command(program: impl AsRef<std::ffi::OsStr>) -> Command {
    without_console_window(Command::new(program))
}

#[cfg(windows)]
fn without_console_window(mut command: Command) -> Command {
    command.creation_flags(CREATE_NO_WINDOW);
    command
}

#[cfg(not(windows))]
fn without_console_window(command: Command) -> Command {
    command
}

const EMBEDDED_POSTGRES_DIRECTORY: &str = "postgres";
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
    ("go-home", "goHome", "/", "CmdOrCtrl+1"),
    ("go-catalog", "goCatalog", "/catalog", "CmdOrCtrl+2"),
    ("go-review", "goReview", "/review", "CmdOrCtrl+3"),
    ("go-tutor", "goTutor", "/tutor", "CmdOrCtrl+4"),
    ("go-progress", "goProgress", "/progress", "CmdOrCtrl+5"),
    ("go-transfer", "goTransfer", "/transfer", "CmdOrCtrl+6"),
    ("go-settings", "goSettings", "/settings", "CmdOrCtrl+7"),
];
const TRANSFER_IMPORT_PATH: &str = "/transfer#importar";
const TRANSFER_EXPORT_PATH: &str = "/transfer#exportar";
const AUTHOR_NAME: &str = "Matheus Caldeira";
const AUTHOR_EMAIL: &str = "matheuscardozo4@gmail.com";
const AUTHOR_PHONE: &str = "+55 41 99524-5271";
const LOCALE_FILE: &str = "desktop-locale.txt";
const MAX_LOCALE_CHARS: usize = 16;
const SERVER_FOLDER: &str = "server";
const SERVER_ENTRY: &str = "server.js";
const NODE_BINARY: &str = if cfg!(windows) { "node.exe" } else { "node" };
const INHERITED_VARIABLES: [&str; 10] = [
    "PATH",
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

fn configured_port() -> u16 {
    std::env::var(PORT_VARIABLE)
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(DEFAULT_PORT)
}

fn server_port() -> u16 {
    match ACTIVE_PORT.load(Ordering::Relaxed) {
        0 => configured_port(),
        port => port,
    }
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
    http_request_on(server_port(), method, path, header, limit)
}

fn http_request_on(
    port: u16,
    method: &str,
    path: &str,
    header: Option<(&str, &str)>,
    limit: u64,
) -> Option<String> {
    let address = SocketAddr::from((LOOPBACK, port));
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
        port,
        extra
    );
    stream.write_all(request.as_bytes()).ok()?;
    let mut response = String::new();
    stream.take(limit).read_to_string(&mut response).ok()?;
    Some(response)
}

fn read_identity_on(port: u16) -> Option<String> {
    http_request_on(port, "GET", IDENTITY_PATH, None, MAX_IDENTITY_BYTES)
}

fn is_ok(response: &str) -> bool {
    response
        .split_whitespace()
        .nth(1)
        .map(|status| status == "200")
        .unwrap_or(false)
}

fn deixa_answers_on(port: u16) -> bool {
    read_identity_on(port)
        .map(|response| is_ok(&response) && response.contains(IDENTITY_MARK))
        .unwrap_or(false)
}

fn server_is_up() -> bool {
    deixa_answers_on(server_port())
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
fn listener_ids(port: u16) -> Option<Vec<u32>> {
    let tool = LISTENER_TOOLS.iter().find(|path| std::path::Path::new(path).exists())?;
    let output = hidden_command(tool)
        .args(["-nP", &format!("-iTCP:{}", port), "-sTCP:LISTEN", "-t"])
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
fn listener_ids(port: u16) -> Option<Vec<u32>> {
    let output = hidden_command("netstat")
        .args(["-ano", "-p", "TCP"])
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output()
        .ok()?;
    let suffix = format!(":{}", port);
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

#[cfg(unix)]
fn process_command(pid: u32) -> Option<String> {
    let output = hidden_command("/bin/ps")
        .args(["-p", &pid.to_string(), "-o", "command="])
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output()
        .ok()?;
    Some(String::from_utf8_lossy(&output.stdout).trim().to_string()).filter(|text| !text.is_empty())
}

#[cfg(windows)]
fn process_command(pid: u32) -> Option<String> {
    let output = hidden_command("tasklist")
        .args(["/FI", &format!("PID eq {}", pid), "/FO", "CSV", "/NH"])
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output()
        .ok()?;
    let line = String::from_utf8_lossy(&output.stdout).lines().next()?.to_string();
    let image = line.split(',').next()?.trim_matches('"').to_string();
    Some(format!("{} {}", image, SERVER_ENTRY)).filter(|_| !image.is_empty())
}

#[cfg(unix)]
fn terminate(pid: u32, force: bool) {
    let signal = if force { "-KILL" } else { "-TERM" };
    let _ = hidden_command("kill").args([signal, &pid.to_string()]).output();
}

#[cfg(windows)]
fn terminate(pid: u32, _force: bool) {
    let _ = hidden_command("taskkill").args(["/PID", &pid.to_string(), "/T", "/F"]).output();
}

fn listens_on(pid: u32, port: u16) -> bool {
    listener_ids(port).map(|ids| ids.contains(&pid)).unwrap_or(false)
}

fn is_orphan_server(record: shell::ServerRecord) -> bool {
    listens_on(record.pid, record.port)
        && process_command(record.pid)
            .map(|command| shell::looks_like_server_command(&command, SERVER_ENTRY))
            .unwrap_or(false)
        && deixa_answers_on(record.port)
}

fn wait_until_released(record: shell::ServerRecord) -> bool {
    for _ in 0..ORPHAN_STOP_ATTEMPTS {
        if !listens_on(record.pid, record.port) {
            return true;
        }
        std::thread::sleep(ORPHAN_STOP_INTERVAL);
    }
    false
}

fn stop_orphan_server(app: &AppHandle) {
    let Some(path) = data_home(app).map(|home| home.join(SERVER_RECORD_FILE)) else {
        return;
    };
    let record = std::fs::read_to_string(&path).ok().and_then(|text| shell::parse_server_record(&text));
    if let Some(record) = record.filter(|record| is_orphan_server(*record)) {
        report_entry("servidor órfão encerrado");
        terminate(record.pid, false);
        if !wait_until_released(record) {
            terminate(record.pid, true);
            wait_until_released(record);
        }
        stop_embedded_postgres(app);
        wait_for_postgres_exit(app);
    }
    let _ = std::fs::remove_file(path);
}

fn save_server_record(app: &AppHandle, record: shell::ServerRecord) {
    if let Some(home) = data_home(app) {
        let _ = std::fs::write(home.join(SERVER_RECORD_FILE), shell::format_server_record(record));
    }
}

fn forget_server_record(app: &AppHandle) {
    if let Some(home) = data_home(app) {
        let _ = std::fs::remove_file(home.join(SERVER_RECORD_FILE));
    }
}

fn only_child_listens(child: u32) -> bool {
    match listener_ids(server_port()) {
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
    locale: Option<String>,
    resume: Option<(String, String, u64, String)>,
    notifications: Vec<(String, String, String, String)>,
}

struct AutoEnter(AtomicBool);
struct SignedOut(AtomicBool);
struct NotificationTargets(Mutex<HashMap<i32, String>>);
struct LatestTarget(Mutex<Option<String>>);
struct ResumeTarget(Mutex<Option<String>>);

fn saved_auto_enter(app: &AppHandle) -> bool {
    let text = data_home(app).and_then(|home| std::fs::read_to_string(home.join(AUTO_ENTER_FILE)).ok());
    shell::parse_toggle(text.as_deref(), AUTO_ENTER_DEFAULT)
}

fn save_auto_enter(app: &AppHandle, enabled: bool) {
    app.state::<AutoEnter>().0.store(enabled, Ordering::Relaxed);
    if let Some(home) = data_home(app) {
        let _ = std::fs::create_dir_all(&home);
        let _ = std::fs::write(home.join(AUTO_ENTER_FILE), shell::format_toggle(enabled));
    }
}

fn may_enter_alone(app: &AppHandle) -> bool {
    app.state::<AutoEnter>().0.load(Ordering::Relaxed) && !app.state::<SignedOut>().0.load(Ordering::Relaxed)
}

fn notice_location(app: &AppHandle, url: &Url) {
    if is_app_page(url) && shell::path_signs_out(url.path()) {
        app.state::<SignedOut>().0.store(true, Ordering::Relaxed);
    }
}

fn set_target(slot: &Mutex<Option<String>>, value: Option<String>) {
    if let Ok(mut current) = slot.lock() {
        *current = value;
    }
}

fn read_target(slot: &Mutex<Option<String>>) -> Option<String> {
    slot.lock().ok().and_then(|current| current.clone())
}

fn remember_notification(app: &AppHandle, href: &str) -> i32 {
    let id = NEXT_NOTIFICATION_ID.fetch_add(1, Ordering::Relaxed);
    if let Ok(mut targets) = app.state::<NotificationTargets>().0.lock() {
        targets.insert(id, href.to_string());
    }
    id
}

fn open_notification(app: &AppHandle, id: Option<i32>) {
    let remembered = id.and_then(|id| {
        app.state::<NotificationTargets>().0.lock().ok().and_then(|targets| targets.get(&id).cloned())
    });
    let target = remembered
        .or_else(|| read_target(&app.state::<LatestTarget>().0))
        .unwrap_or_else(|| HOME_PATH.to_string());
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || go_to(&handle, &target));
}

fn listen_notification_clicks(app: &AppHandle) {
    let handle = app.clone();
    let _ = app.notification().on_action(move |action| {
        if action.action_id() == TAP_ACTION {
            open_notification(&handle, action.notification().map(|item| item.id()));
        }
    });
}

struct MenuLabels(Mutex<Labels>);

fn current_labels(app: &AppHandle) -> Labels {
    app.state::<MenuLabels>()
        .0
        .lock()
        .map(|labels| labels.clone())
        .unwrap_or_else(|_| Labels::for_locale(DEFAULT_LOCALE))
}

fn saved_locale(app: &AppHandle) -> String {
    data_home(app)
        .and_then(|home| std::fs::read_to_string(home.join(LOCALE_FILE)).ok())
        .map(|text| text.trim().chars().take(MAX_LOCALE_CHARS).collect())
        .unwrap_or_else(|| DEFAULT_LOCALE.to_string())
}

fn save_locale(app: &AppHandle, locale: &str) {
    if let Some(home) = data_home(app) {
        let _ = std::fs::write(home.join(LOCALE_FILE), locale);
    }
}

fn switch_labels(app: &AppHandle, locale: &str) -> Option<Labels> {
    let state = app.state::<MenuLabels>();
    let mut current = state.0.lock().ok()?;
    if current.locale() == locale {
        return None;
    }
    let next = Labels::for_locale(locale);
    if current.locale() == next.locale() {
        return None;
    }
    *current = next.clone();
    Some(next)
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
    let destination = |value: &serde_json::Value| {
        text(value, "href").and_then(|href| shell::internal_path(&href)).unwrap_or_else(|| HOME_PATH.to_string())
    };
    let resume = status.get("current").filter(|current| !current.is_null()).and_then(|current| {
        let percent = current.get("progressPercent")?.as_u64()?;
        Some((text(current, "title")?, text(current, "label")?, percent, destination(current)))
    });
    let locale = text(&status, "locale");
    let notifications = status
        .get("notifications")
        .and_then(|list| list.as_array())
        .map(|list| {
            list.iter()
                .filter_map(|item| {
                    Some((text(item, "id")?, text(item, "title")?, text(item, "body")?, destination(item)))
                })
                .collect()
        })
        .unwrap_or_default();
    Some(OwnerStatus { locale, resume, notifications })
}

enum Startup {
    AlreadyRunning,
    Started,
    PortBusy,
    Missing,
}

fn port_is_taken(port: u16) -> bool {
    let address = SocketAddr::from((LOOPBACK, port));
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
    stop_orphan_server(app);
    if server_is_up() {
        return Startup::AlreadyRunning;
    }
    let Some(port) = shell::pick_port(configured_port(), PORT_SPAN, |port| !port_is_taken(port)) else {
        return Startup::PortBusy;
    };
    ACTIVE_PORT.store(port, Ordering::Relaxed);
    let (Some(node), Some(folder), Some(home)) = (node_binary(), server_folder(app), data_home(app))
    else {
        return Startup::Missing;
    };
    if std::fs::create_dir_all(&home).is_err() {
        return Startup::Missing;
    }
    let token = issue_desktop_token(&home);
    let mut command = hidden_command(node);
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
            save_server_record(app, shell::ServerRecord { pid: child.id(), port });
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
            stop_embedded_postgres(app);
            forget_server_record(app);
        }
    }
}

fn postmaster_pid_file(app: &AppHandle) -> Option<PathBuf> {
    data_home(app).map(|home| home.join(EMBEDDED_POSTGRES_DIRECTORY).join("data").join("postmaster.pid"))
}

fn wait_for_postgres_exit(app: &AppHandle) {
    let Some(pid_file) = postmaster_pid_file(app) else {
        return;
    };
    for _ in 0..ORPHAN_STOP_ATTEMPTS {
        if !pid_file.exists() {
            return;
        }
        std::thread::sleep(ORPHAN_STOP_INTERVAL);
    }
}

fn stop_embedded_postgres(app: &AppHandle) {
    let Some(pid_file) = postmaster_pid_file(app) else {
        return;
    };
    let Ok(contents) = std::fs::read_to_string(&pid_file) else {
        return;
    };
    let Some(pid) = contents.lines().next().map(str::trim).filter(|line| !line.is_empty()) else {
        return;
    };
    if pid.chars().any(|character| !character.is_ascii_digit()) {
        return;
    }
    #[cfg(windows)]
    let _ = hidden_command("taskkill").args(["/PID", pid, "/T", "/F"]).output();
    #[cfg(not(windows))]
    let _ = hidden_command("kill").args(["-TERM", pid]).output();
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

fn entry_url(app: &AppHandle, next: Option<&str>) -> String {
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
    if !may_enter_alone(app) {
        report_entry("entrada manual");
        return format!("{}{}", local_url(), LOGIN_PATH);
    }
    match request_entry_ticket(app) {
        Some(ticket) => {
            report_entry("bilhete do dono");
            format!("{}{}", local_url(), shell::entry_location(&ticket, next))
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
    let Some(path) = shell::internal_path(path) else {
        show_main_window(app);
        return;
    };
    let Some(window) = app.get_webview_window(MAIN_WINDOW) else {
        open_main_window(app, Some(&path));
        return;
    };
    show_main_window(app);
    if let Ok(url) = format!("{}{}", local_url(), path).parse::<Url>() {
        if is_app_page(&url) {
            let _ = window.navigate(url);
        }
    }
}


fn about_metadata(app: &AppHandle, labels: &Labels) -> AboutMetadata<'static> {
    let comments = labels.get("aboutComments");
    AboutMetadata {
        name: Some("Deixa".into()),
        version: Some(app.package_info().version.to_string()),
        authors: Some(vec![AUTHOR_NAME.into()]),
        comments: Some(comments.clone()),
        copyright: Some(format!("© 2026 {}", AUTHOR_NAME)),
        credits: Some(format!("{}\n{}\n{}\n{}", comments, AUTHOR_NAME, AUTHOR_EMAIL, AUTHOR_PHONE)),
        ..Default::default()
    }
}

fn build_app_menu(app: &AppHandle, labels: &Labels) -> tauri::Result<()> {
    let l = |key: &str| labels.get(key);
    let settings = MenuItem::with_id(app, "settings", l("settings"), true, Some("CmdOrCtrl+,"))?;
    let quit = MenuItem::with_id(app, "app-quit", l("quit"), true, Some("CmdOrCtrl+Q"))?;
    let application = Submenu::with_items(
        app,
        "Deixa",
        true,
        &[
            &PredefinedMenuItem::about(app, Some(&l("about")), Some(about_metadata(app, labels)))?,
            &PredefinedMenuItem::separator(app)?,
            &settings,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, Some(&l("hide")))?,
            &PredefinedMenuItem::hide_others(app, Some(&l("hideOthers")))?,
            &PredefinedMenuItem::show_all(app, Some(&l("showAll")))?,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;
    let browser = MenuItem::with_id(app, "app-browser", l("openBrowser"), true, Some("CmdOrCtrl+B"))?;
    let qr = MenuItem::with_id(app, "app-qr", l("openPhone"), true, None::<&str>)?;
    let import = MenuItem::with_id(app, "transfer-import", l("import"), true, Some("CmdOrCtrl+I"))?;
    let export = MenuItem::with_id(app, "transfer-export", l("export"), true, Some("CmdOrCtrl+E"))?;
    let file = Submenu::with_items(
        app,
        l("file"),
        true,
        &[
            &import,
            &export,
            &PredefinedMenuItem::separator(app)?,
            &browser,
            &qr,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, Some(&l("closeWindow")))?,
        ],
    )?;
    let edit = Submenu::with_items(
        app,
        l("edit"),
        true,
        &[
            &PredefinedMenuItem::undo(app, Some(&l("undo")))?,
            &PredefinedMenuItem::redo(app, Some(&l("redo")))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, Some(&l("cut")))?,
            &PredefinedMenuItem::copy(app, Some(&l("copy")))?,
            &PredefinedMenuItem::paste(app, Some(&l("paste")))?,
            &PredefinedMenuItem::select_all(app, Some(&l("selectAll")))?,
        ],
    )?;
    let go = Submenu::new(app, l("go"), true)?;
    for (id, key, _, shortcut) in NAVIGATION {
        go.append(&MenuItem::with_id(app, id, l(key), true, Some(shortcut))?)?;
    }
    go.append(&PredefinedMenuItem::separator(app)?)?;
    go.append(&MenuItem::with_id(app, "reload", l("reload"), true, Some("CmdOrCtrl+R"))?)?;
    let window = Submenu::with_items(
        app,
        l("window"),
        true,
        &[
            &PredefinedMenuItem::minimize(app, Some(&l("minimize")))?,
            &PredefinedMenuItem::maximize(app, Some(&l("zoom")))?,
            &PredefinedMenuItem::fullscreen(app, Some(&l("fullscreen")))?,
        ],
    )?;
    app.set_menu(Menu::with_items(app, &[&application, &file, &edit, &go, &window])?)?;
    Ok(())
}

fn listen_app_menu(app: &AppHandle) {
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
}

fn show_main_window(app: &AppHandle) {
    open_main_window(app, None);
}

fn open_main_window(app: &AppHandle, next: Option<&str>) {
    show_in_dock(app, true);
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
        return;
    }
    let target = if server_is_up() {
        entry_url(app, next)
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
                notice_location(&opener, url);
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
        .title(current_labels(app).get("phoneWindow"))
        .inner_size(340.0, 460.0)
        .resizable(false)
        .initialization_script(format!("window.__DEIXA_QR__ = {};", payload))
        .build();
}

fn toggle_autostart(app: &AppHandle, item: &CheckMenuItem<tauri::Wry>) {
    let launcher = app.autolaunch();
    let enabled = launcher.is_enabled().unwrap_or(false);
    let _ = if enabled { launcher.disable() } else { launcher.enable() };
    let _ = item.set_checked(launcher.is_enabled().unwrap_or(false));
}

fn toggle_auto_enter(app: &AppHandle, item: &CheckMenuItem<tauri::Wry>) {
    let enabled = !app.state::<AutoEnter>().0.load(Ordering::Relaxed);
    save_auto_enter(app, enabled);
    let _ = item.set_checked(enabled);
}

fn watch_sign_out(app: &AppHandle) {
    if let Some(url) = app.get_webview_window(MAIN_WINDOW).and_then(|window| window.url().ok()) {
        notice_location(app, &url);
    }
}

fn announce(app: &AppHandle, title: &str, body: &str, href: &str) {
    let id = remember_notification(app, href);
    let shown = app.notification().builder().id(id).title(title).body(body).show();
    if cfg!(debug_assertions) {
        eprintln!("aviso nativo: {:?}", shown.map(|_| "enviado ao sistema"));
    }
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let labels = current_labels(app);
    let status = MenuItem::with_id(app, "status", labels.get("statusDown"), false, None::<&str>)?;
    let resume = MenuItem::with_id(app, "resume", labels.get("resumeEmpty"), false, None::<&str>)?;
    let inbox = MenuItem::with_id(app, "inbox", labels.get("inboxEmpty"), false, None::<&str>)?;
    let open = MenuItem::with_id(app, "open", labels.get("trayOpen"), true, None::<&str>)?;
    let browser = MenuItem::with_id(app, "browser", labels.get("openBrowser"), true, None::<&str>)?;
    let qr = MenuItem::with_id(app, "qr", labels.get("openPhone"), true, None::<&str>)?;
    let auto_enter = CheckMenuItem::with_id(
        app,
        "auto-enter",
        labels.get("trayAutoEnter"),
        true,
        app.state::<AutoEnter>().0.load(Ordering::Relaxed),
        None::<&str>,
    )?;
    let autostart = CheckMenuItem::with_id(
        app,
        "autostart",
        labels.get("trayAutostart"),
        true,
        app.autolaunch().is_enabled().unwrap_or(false),
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(app, "quit", labels.get("trayQuit"), true, None::<&str>)?;
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
            &auto_enter,
            &autostart,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;
    let auto_enter_item = auto_enter.clone();
    let autostart_item = autostart.clone();
    let mut tray = TrayIconBuilder::with_id("deixa")
        .tooltip("Deixa")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "open" => show_main_window(app),
            "resume" => {
                let target = read_target(&app.state::<ResumeTarget>().0).unwrap_or_else(|| HOME_PATH.to_string());
                go_to(app, &target);
            }
            "inbox" => open_notification(app, None),
            "browser" => {
                let _ = app.opener().open_url(local_url(), None::<&str>);
            }
            "qr" => show_qr_window(app),
            "auto-enter" => toggle_auto_enter(app, &auto_enter_item),
            "autostart" => toggle_autostart(app, &autostart_item),
            "quit" => app.exit(0),
            _ => {}
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;

    let handle = app.clone();
    let hidden = shell::launched_hidden(std::env::args());
    std::thread::spawn(move || {
        let _ = status.set_text(current_labels(&handle).get("statusStarting"));
        let startup = start_server(&handle);
        let trouble = match startup {
            Startup::PortBusy => Some("statusBusy"),
            Startup::Missing => Some("statusMissing"),
            Startup::AlreadyRunning | Startup::Started => None,
        };
        if trouble.is_none() {
            wait_until_up();
        }
        if !hidden {
            let opener = handle.clone();
            let _ = handle.run_on_main_thread(move || show_main_window(&opener));
        }
        let mut announced: Option<HashSet<String>> = None;
        loop {
            watch_sign_out(&handle);
            let owner = read_owner_status(&handle);
            let wanted = owner.as_ref().and_then(|current| current.locale.as_deref());
            if let Some(next) = wanted.and_then(|locale| switch_labels(&handle, locale)) {
                save_locale(&handle, next.locale());
                let _ = open.set_text(next.get("trayOpen"));
                let _ = browser.set_text(next.get("openBrowser"));
                let _ = qr.set_text(next.get("openPhone"));
                let _ = auto_enter.set_text(next.get("trayAutoEnter"));
                let _ = autostart.set_text(next.get("trayAutostart"));
                let _ = quit.set_text(next.get("trayQuit"));
                let menu_owner = handle.clone();
                let _ = handle.run_on_main_thread(move || {
                    let _ = build_app_menu(&menu_owner, &next);
                });
            }
            let labels = current_labels(&handle);
            let key = if server_is_up() { "statusUp" } else { trouble.unwrap_or("statusDown") };
            let _ = status.set_text(labels.get(key));
            let current_resume = owner.as_ref().and_then(|current| current.resume.as_ref());
            set_target(&handle.state::<ResumeTarget>().0, current_resume.map(|resume| resume.3.clone()));
            let resume_text = current_resume.map(|(title, label, percent, _)| {
                labels.fill("resume", &[("title", title), ("label", label), ("percent", &percent.to_string())])
            });
            let _ = resume.set_enabled(resume_text.is_some());
            let _ = resume.set_text(resume_text.unwrap_or_else(|| labels.get("resumeEmpty")));
            let pending = owner.as_ref().map(|current| current.notifications.len()).unwrap_or(0);
            let _ = inbox.set_enabled(pending > 0);
            let _ = inbox.set_text(match pending {
                0 => labels.get("inboxEmpty"),
                1 => labels.get("inboxOne"),
                count => labels.fill("inboxMany", &[("count", &count.to_string())]),
            });
            if let Some(current) = owner {
                set_target(
                    &handle.state::<LatestTarget>().0,
                    current.notifications.first().map(|item| item.3.clone()),
                );
                let ids: HashSet<String> = current.notifications.iter().map(|item| item.0.clone()).collect();
                if let Some(known) = &announced {
                    for (id, title, body, href) in &current.notifications {
                        if !known.contains(id) {
                            announce(&handle, title, body, href);
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
        .manage(MenuLabels(Mutex::new(Labels::for_locale(DEFAULT_LOCALE))))
        .manage(AutoEnter(AtomicBool::new(AUTO_ENTER_DEFAULT)))
        .manage(SignedOut(AtomicBool::new(false)))
        .manage(NotificationTargets(Mutex::new(HashMap::new())))
        .manage(LatestTarget(Mutex::new(None)))
        .manage(ResumeTarget(Mutex::new(None)))
        .plugin(tauri_plugin_single_instance::init(|app, _arguments, _directory| {
            show_main_window(app)
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![shell::HIDDEN_FLAG]),
        ))
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            let saved = Labels::for_locale(&saved_locale(app.handle()));
            if let Ok(mut labels) = app.state::<MenuLabels>().0.lock() {
                *labels = saved.clone();
            }
            app.state::<AutoEnter>().0.store(saved_auto_enter(app.handle()), Ordering::Relaxed);
            listen_notification_clicks(app.handle());
            build_app_menu(app.handle(), &saved)?;
            listen_app_menu(app.handle());
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
