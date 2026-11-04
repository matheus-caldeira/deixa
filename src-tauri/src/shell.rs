pub const HIDDEN_FLAG: &str = "--hidden";
const SIGNED_OUT_PATHS: [&str; 2] = ["/login", "/signup"];
const MAX_PATH_CHARS: usize = 2048;
const TOGGLE_ON: &str = "on";
const TOGGLE_OFF: &str = "off";

pub fn internal_path(candidate: &str) -> Option<String> {
    let valid = candidate.starts_with('/')
        && !candidate.starts_with("//")
        && candidate.len() <= MAX_PATH_CHARS
        && !candidate.chars().any(|c| c == '\\' || c.is_whitespace() || c.is_control());
    valid.then(|| candidate.to_string())
}

pub fn pick_port(base: u16, span: u16, is_free: impl Fn(u16) -> bool) -> Option<u16> {
    (0..=span).filter_map(|offset| base.checked_add(offset)).find(|port| is_free(*port))
}

pub fn parse_toggle(text: Option<&str>, default: bool) -> bool {
    match text.map(str::trim) {
        Some(TOGGLE_ON) => true,
        Some(TOGGLE_OFF) => false,
        _ => default,
    }
}

pub fn format_toggle(enabled: bool) -> &'static str {
    if enabled {
        TOGGLE_ON
    } else {
        TOGGLE_OFF
    }
}

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub struct ServerRecord {
    pub pid: u32,
    pub port: u16,
}

pub fn format_server_record(record: ServerRecord) -> String {
    format!("{} {}\n", record.pid, record.port)
}

pub fn parse_server_record(text: &str) -> Option<ServerRecord> {
    let mut fields = text.split_whitespace();
    let pid: u32 = fields.next()?.parse().ok()?;
    let port: u16 = fields.next()?.parse().ok()?;
    if fields.next().is_some() || pid <= 1 || port == 0 {
        return None;
    }
    Some(ServerRecord { pid, port })
}

pub fn looks_like_server_command(command: &str, entry: &str) -> bool {
    let (program, arguments) = split_program(command.trim());
    let program_is_node = program
        .rsplit(['/', '\\'])
        .next()
        .map(|name| name.to_ascii_lowercase().starts_with("node"))
        .unwrap_or(false);
    program_is_node && arguments.split_whitespace().any(|word| word.trim_matches('"') == entry)
}

fn split_program(command: &str) -> (&str, &str) {
    if let Some(quoted) = command.strip_prefix('"') {
        return quoted.split_once('"').unwrap_or((quoted, ""));
    }
    command.split_once(char::is_whitespace).unwrap_or((command, ""))
}

pub fn path_signs_out(url_path: &str) -> bool {
    SIGNED_OUT_PATHS.contains(&url_path.trim_end_matches('/'))
}

pub fn launched_hidden(arguments: impl IntoIterator<Item = String>) -> bool {
    arguments.into_iter().any(|argument| argument == HIDDEN_FLAG)
}

pub fn entry_location(ticket: &str, next: Option<&str>) -> String {
    match next.and_then(internal_path).filter(|path| path != "/") {
        Some(path) => format!("/desktop/enter?ticket={}&next={}", ticket, encode_component(&path)),
        None => format!("/desktop/enter?ticket={}", ticket),
    }
}

fn encode_component(text: &str) -> String {
    text.bytes()
        .map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => (byte as char).to_string(),
            _ => format!("%{:02X}", byte),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_only_paths_inside_the_app() {
        assert_eq!(internal_path("/trail?id=a&season=2").as_deref(), Some("/trail?id=a&season=2"));
        assert_eq!(internal_path("/transfer#importar").as_deref(), Some("/transfer#importar"));
        for unsafe_path in ["//evil.example", "https://evil.example", "javascript:alert(1)", "trail", "/\\evil", "/a b", ""] {
            assert_eq!(internal_path(unsafe_path), None, "{unsafe_path}");
        }
        assert_eq!(internal_path(&format!("/{}", "a".repeat(MAX_PATH_CHARS))), None);
    }

    #[test]
    fn picks_the_first_free_port_of_the_range() {
        assert_eq!(pick_port(1300, 10, |_| true), Some(1300));
        assert_eq!(pick_port(1300, 10, |port| port >= 1303), Some(1303));
        assert_eq!(pick_port(1300, 10, |_| false), None);
        assert_eq!(pick_port(u16::MAX, 10, |_| true), Some(u16::MAX));
        assert_eq!(pick_port(1300, 10, |port| port == 1311), None);
    }

    #[test]
    fn reads_a_toggle_with_its_default() {
        assert!(parse_toggle(None, true));
        assert!(!parse_toggle(None, false));
        assert!(parse_toggle(Some("on\n"), false));
        assert!(!parse_toggle(Some("off"), true));
        assert!(parse_toggle(Some("garbage"), true));
        assert!(parse_toggle(Some(format_toggle(true)), false));
        assert!(!parse_toggle(Some(format_toggle(false)), true));
    }

    #[test]
    fn round_trips_the_server_record() {
        let record = ServerRecord { pid: 4242, port: 1301 };
        assert_eq!(parse_server_record(&format_server_record(record)), Some(record));
        for broken in ["", "abc 1300", "4242", "4242 70000", "1 1300", "4242 1300 extra", "4242 0"] {
            assert_eq!(parse_server_record(broken), None, "{broken}");
        }
    }

    #[test]
    fn recognizes_only_the_node_server_command() {
        assert!(looks_like_server_command("/Applications/Deixa.app/Contents/MacOS/node server.js", "server.js"));
        assert!(looks_like_server_command("C:\\Deixa\\node.exe server.js", "server.js"));
        assert!(looks_like_server_command("\"C:\\Program Files\\Deixa\\node.exe\" server.js", "server.js"));
        assert!(!looks_like_server_command("\"C:\\Program Files\\Deixa\\node.exe\" other.js", "server.js"));
        assert!(!looks_like_server_command("\"C:\\Program Files\\Tools\\python.exe\" server.js", "server.js"));
        assert!(!looks_like_server_command("node.exe", "server.js"));
        assert!(!looks_like_server_command("/usr/bin/python3 server.js", "server.js"));
        assert!(!looks_like_server_command("/usr/local/bin/node other.js", "server.js"));
        assert!(!looks_like_server_command("", "server.js"));
    }

    #[test]
    fn notices_the_pages_that_mean_signed_out() {
        assert!(path_signs_out("/login"));
        assert!(path_signs_out("/login/"));
        assert!(path_signs_out("/signup"));
        assert!(!path_signs_out("/"));
        assert!(!path_signs_out("/review"));
    }

    #[test]
    fn detects_the_hidden_launch_flag() {
        assert!(launched_hidden(["deixa".to_string(), HIDDEN_FLAG.to_string()]));
        assert!(!launched_hidden(["deixa".to_string()]));
    }

    #[test]
    fn builds_the_entry_with_an_encoded_destination() {
        assert_eq!(entry_location("ab12", None), "/desktop/enter?ticket=ab12");
        assert_eq!(entry_location("ab12", Some("/")), "/desktop/enter?ticket=ab12");
        assert_eq!(entry_location("ab12", Some("//evil")), "/desktop/enter?ticket=ab12");
        assert_eq!(
            entry_location("ab12", Some("/trail?id=m1&season=2")),
            "/desktop/enter?ticket=ab12&next=%2Ftrail%3Fid%3Dm1%26season%3D2"
        );
    }
}
