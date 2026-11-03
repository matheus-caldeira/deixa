#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
const PROC_LISTEN_STATE: &str = "0A";
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
const PROC_LOCAL_ADDRESS_FIELD: usize = 1;
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
const PROC_STATE_FIELD: usize = 3;
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
const PROC_INODE_FIELD: usize = 9;
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
const SS_LISTEN_STATE: &str = "LISTEN";
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
const SS_LOCAL_ADDRESS_FIELD: usize = 3;
#[cfg_attr(not(windows), allow(dead_code))]
const NETSTAT_TCP: &str = "TCP";
#[cfg_attr(not(windows), allow(dead_code))]
const NETSTAT_IDLE_PEERS: [&str; 2] = ["0.0.0.0:0", "[::]:0"];
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
const SOCKET_LINK_PREFIX: &str = "socket:[";

fn push_unique(ids: &mut Vec<u32>, id: u32) {
    if !ids.contains(&id) {
        ids.push(id);
    }
}

#[cfg_attr(not(any(windows, target_os = "linux")), allow(dead_code))]
fn port_of(address: &str) -> Option<u16> {
    address.rsplit_once(':')?.1.parse().ok()
}

#[cfg_attr(windows, allow(dead_code))]
pub fn parse_lsof_ids(output: &str) -> Vec<u32> {
    let mut ids = Vec::new();
    for id in output.lines().filter_map(|line| line.trim().parse().ok()) {
        push_unique(&mut ids, id);
    }
    ids
}

#[cfg_attr(not(windows), allow(dead_code))]
pub fn parse_netstat(output: &str, port: u16) -> Vec<u32> {
    let mut ids = Vec::new();
    for line in output.lines() {
        let fields: Vec<&str> = line.split_whitespace().collect();
        let [proto, local, peer, .., pid] = fields.as_slice() else {
            continue;
        };
        let listening = proto.eq_ignore_ascii_case(NETSTAT_TCP)
            && NETSTAT_IDLE_PEERS.contains(peer)
            && port_of(local) == Some(port);
        if let Some(id) = listening.then(|| pid.parse().ok()).flatten() {
            push_unique(&mut ids, id);
        }
    }
    ids
}

#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
fn ss_process_ids(line: &str) -> impl Iterator<Item = u32> + '_ {
    line.split("pid=").skip(1).filter_map(|rest| {
        let digits: String = rest.chars().take_while(char::is_ascii_digit).collect();
        digits.parse().ok()
    })
}

#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
pub fn parse_ss(output: &str, port: u16) -> Vec<u32> {
    let mut ids = Vec::new();
    for line in output.lines() {
        let fields: Vec<&str> = line.split_whitespace().collect();
        let listening = fields.first() == Some(&SS_LISTEN_STATE)
            && fields.get(SS_LOCAL_ADDRESS_FIELD).and_then(|local| port_of(local)) == Some(port);
        if listening {
            for id in ss_process_ids(line) {
                push_unique(&mut ids, id);
            }
        }
    }
    ids
}

#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
pub fn parse_proc_net_tcp(table: &str, port: u16) -> Vec<u64> {
    table
        .lines()
        .filter_map(|line| {
            let fields: Vec<&str> = line.split_whitespace().collect();
            let local = fields.get(PROC_LOCAL_ADDRESS_FIELD)?;
            let local_port = u16::from_str_radix(local.rsplit_once(':')?.1, 16).ok()?;
            let listening = fields.get(PROC_STATE_FIELD) == Some(&PROC_LISTEN_STATE) && local_port == port;
            let inode: u64 = fields.get(PROC_INODE_FIELD)?.parse().ok()?;
            (listening && inode != 0).then_some(inode)
        })
        .collect()
}

#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
pub fn socket_inode(link: &str) -> Option<u64> {
    link.strip_prefix(SOCKET_LINK_PREFIX)?.strip_suffix(']')?.parse().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    const NETSTAT_SAMPLE: &str = "
Active Connections

  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       1180
  TCP    0.0.0.0:1300           0.0.0.0:0              LISTENING       5512
  TCP    0.0.0.0:13000          0.0.0.0:0              LISTENING       8080
  TCP    127.0.0.1:1300         127.0.0.1:52011        ESTABLISHED     5512
  TCP    127.0.0.1:52011        127.0.0.1:1300         ESTABLISHED     7720
  TCP    192.168.0.12:51234     140.82.112.4:443       ESTABLISHED     9932
  TCP    [::]:135               [::]:0                 LISTENING       1180
  TCP    [::]:1300              [::]:0                 LISTENING       5512
  TCP    [::1]:1301             [::]:0                 LISTENING       6100
  TCP    [fe80::1c2d:3e4f:5a6b:7c8d%12]:1300  [fe80::1c2d:3e4f:5a6b:7c8d%12]:52100  ESTABLISHED  4321
  UDP    0.0.0.0:1300           *:*                                    2236
  UDP    [::]:5353              *:*                                    2236
";

    const NETSTAT_LOCALIZED: &str = "
Conexões ativas

  Proto  Endereço local         Endereço externo       Estado          PID
  TCP    0.0.0.0:1300           0.0.0.0:0              ESCUTANDO       4044
  TCP    [::]:1300              [::]:0                 ESCUTANDO       4044
";

    #[test]
    fn netstat_finds_ipv4_and_ipv6_listeners_on_the_exact_port() {
        assert_eq!(parse_netstat(NETSTAT_SAMPLE, 1300), vec![5512]);
        assert_eq!(parse_netstat(NETSTAT_SAMPLE, 1301), vec![6100]);
        assert_eq!(parse_netstat(NETSTAT_SAMPLE, 13000), vec![8080]);
        assert_eq!(parse_netstat(NETSTAT_SAMPLE, 135), vec![1180]);
        assert!(parse_netstat(NETSTAT_SAMPLE, 52011).is_empty());
        assert!(parse_netstat(NETSTAT_SAMPLE, 443).is_empty());
        assert!(parse_netstat(NETSTAT_SAMPLE, 5353).is_empty());
    }

    #[test]
    fn netstat_does_not_depend_on_the_translated_state() {
        assert_eq!(parse_netstat(NETSTAT_LOCALIZED, 1300), vec![4044]);
        assert!(parse_netstat("", 1300).is_empty());
    }

    #[test]
    fn netstat_with_windows_line_endings() {
        let sample = NETSTAT_SAMPLE.replace('\n', "\r\n");
        assert_eq!(parse_netstat(&sample, 1300), vec![5512]);
    }

    #[test]
    fn lsof_lists_one_id_per_line() {
        assert_eq!(parse_lsof_ids("5512\n5512\n7720\n"), vec![5512, 7720]);
        assert_eq!(parse_lsof_ids("  5512  \n\nlsof: WARNING\n"), vec![5512]);
        assert!(parse_lsof_ids("").is_empty());
    }

    const SS_SAMPLE: &str = "State  Recv-Q Send-Q Local Address:Port  Peer Address:PortProcess
LISTEN 0      4096   127.0.0.53%lo:53          0.0.0.0:*
LISTEN 0      511          0.0.0.0:1300        0.0.0.0:*    users:((\"node\",pid=5512,fd=21))
LISTEN 0      511          0.0.0.0:13000       0.0.0.0:*    users:((\"node\",pid=8080,fd=19))
LISTEN 0      511             [::]:1300           [::]:*    users:((\"node\",pid=5512,fd=22),(\"node\",pid=5513,fd=22))
LISTEN 0      128            [::1]:1301           [::]:*
ESTAB  0      0          127.0.0.1:1300      127.0.0.1:52011 users:((\"node\",pid=9999,fd=30))
";

    #[test]
    fn ss_reads_every_process_of_the_listener() {
        assert_eq!(parse_ss(SS_SAMPLE, 1300), vec![5512, 5513]);
        assert_eq!(parse_ss(SS_SAMPLE, 13000), vec![8080]);
        assert!(parse_ss(SS_SAMPLE, 1301).is_empty());
        assert!(parse_ss(SS_SAMPLE, 52011).is_empty());
    }

    const PROC_TCP: &str = "  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 3500007F:0035 00000000:0000 0A 00000000:00000000 00:00000000 00000000   101        0 18221 1 0000000000000000 100 0 0 10 0
   1: 00000000:0514 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 412907 1 0000000000000000 100 0 0 10 0
   2: 0100007F:0514 0100007F:CB2B 01 00000000:00000000 00:00000000 00000000  1000        0 413500 1 0000000000000000 20 4 30 10 -1
   3: 00000000:32C8 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 0 1 0000000000000000 100 0 0 10 0
";

    const PROC_TCP6: &str = "  sl  local_address                         remote_address                        st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 00000000000000000000000000000000:0514 00000000000000000000000000000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 412908 1 0000000000000000 100 0 0 10 0
";

    #[test]
    fn proc_net_tcp_finds_listening_inodes() {
        assert_eq!(parse_proc_net_tcp(PROC_TCP, 1300), vec![412907]);
        assert_eq!(parse_proc_net_tcp(PROC_TCP6, 1300), vec![412908]);
        assert_eq!(parse_proc_net_tcp(PROC_TCP, 53), vec![18221]);
        assert!(parse_proc_net_tcp(PROC_TCP, 13000).is_empty());
        assert!(parse_proc_net_tcp(PROC_TCP, 52011).is_empty());
    }

    #[test]
    fn socket_links_carry_the_inode() {
        assert_eq!(socket_inode("socket:[412907]"), Some(412907));
        assert_eq!(socket_inode("pipe:[412907]"), None);
        assert_eq!(socket_inode("/dev/null"), None);
        assert_eq!(socket_inode("socket:[abc]"), None);
    }
}
