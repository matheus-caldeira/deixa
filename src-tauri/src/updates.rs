use std::cmp::Ordering;

use serde_json::Value;

pub const RELEASES_PAGE_PREFIX: &str = "https://github.com/matheus-caldeira/deixa/releases/";
pub const CHECK_INTERVAL_SECONDS: u64 = 24 * 60 * 60;
const MAX_VERSION_CHARS: usize = 64;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Version {
    core: [u64; 3],
    pre: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Release {
    pub version: String,
    pub url: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct CheckRecord {
    pub checked_at: Option<u64>,
    pub release: Option<Release>,
}

pub fn parse_version(text: &str) -> Option<Version> {
    let text = text.trim();
    if text.is_empty() || text.len() > MAX_VERSION_CHARS {
        return None;
    }
    let text = text.strip_prefix('v').unwrap_or(text);
    let without_build = text.split('+').next()?;
    let (core_text, pre_text) = match without_build.split_once('-') {
        Some((core, pre)) => (core, Some(pre)),
        None => (without_build, None),
    };
    let numbers: Vec<u64> = core_text
        .split('.')
        .map(|part| {
            let valid = !part.is_empty() && part.chars().all(|c| c.is_ascii_digit());
            valid.then(|| part.parse().ok()).flatten()
        })
        .collect::<Option<Vec<u64>>>()?;
    let core: [u64; 3] = numbers.try_into().ok()?;
    let pre = match pre_text {
        Some(pre) => {
            let parts: Vec<String> = pre.split('.').map(str::to_string).collect();
            let valid = parts
                .iter()
                .all(|part| !part.is_empty() && part.chars().all(|c| c.is_ascii_alphanumeric() || c == '-'));
            if !valid {
                return None;
            }
            parts
        }
        None => Vec::new(),
    };
    Some(Version { core, pre })
}

fn compare_identifier(left: &str, right: &str) -> Ordering {
    match (left.parse::<u64>(), right.parse::<u64>()) {
        (Ok(a), Ok(b)) => a.cmp(&b),
        (Ok(_), Err(_)) => Ordering::Less,
        (Err(_), Ok(_)) => Ordering::Greater,
        (Err(_), Err(_)) => left.cmp(right),
    }
}

fn compare(left: &Version, right: &Version) -> Ordering {
    left.core.cmp(&right.core).then_with(|| match (left.pre.is_empty(), right.pre.is_empty()) {
        (true, true) => Ordering::Equal,
        (true, false) => Ordering::Greater,
        (false, true) => Ordering::Less,
        (false, false) => left
            .pre
            .iter()
            .zip(right.pre.iter())
            .map(|(a, b)| compare_identifier(a, b))
            .find(|order| *order != Ordering::Equal)
            .unwrap_or_else(|| left.pre.len().cmp(&right.pre.len())),
    })
}

pub fn is_newer(candidate: &str, current: &str) -> bool {
    match (parse_version(candidate), parse_version(current)) {
        (Some(candidate), Some(current)) => {
            candidate.pre.is_empty() && compare(&candidate, &current) == Ordering::Greater
        }
        _ => false,
    }
}

fn display_version(tag: &str) -> String {
    tag.trim().strip_prefix('v').unwrap_or(tag.trim()).to_string()
}

pub fn parse_release(body: &str) -> Option<Release> {
    let release: Value = serde_json::from_str(body).ok()?;
    let flag = |key: &str| release.get(key).and_then(Value::as_bool).unwrap_or(true);
    if flag("draft") || flag("prerelease") {
        return None;
    }
    let tag = release.get("tag_name")?.as_str()?;
    let version = parse_version(tag)?;
    if !version.pre.is_empty() {
        return None;
    }
    let url = release.get("html_url")?.as_str()?;
    let safe_url = url.starts_with(RELEASES_PAGE_PREFIX)
        && !url.chars().any(|c| c.is_whitespace() || c.is_control());
    safe_url.then(|| Release { version: display_version(tag), url: url.to_string() })
}

pub fn newer_release(release: Option<&Release>, current: &str) -> Option<Release> {
    release.filter(|release| is_newer(&release.version, current)).cloned()
}

pub fn should_check(last: Option<u64>, now: u64) -> bool {
    match last {
        Some(last) if last <= now => now - last >= CHECK_INTERVAL_SECONDS,
        _ => true,
    }
}

pub fn format_record(record: &CheckRecord) -> String {
    let stamp = record.checked_at.map(|value| value.to_string()).unwrap_or_default();
    match &record.release {
        Some(release) => format!("{}\n{}\n{}\n", stamp, release.version, release.url),
        None => format!("{}\n", stamp),
    }
}

pub fn parse_record(text: &str) -> CheckRecord {
    let mut lines = text.lines().map(str::trim);
    let checked_at = lines.next().and_then(|line| line.parse().ok());
    let release = match (lines.next(), lines.next()) {
        (Some(version), Some(url))
            if parse_version(version).is_some()
                && url.starts_with(RELEASES_PAGE_PREFIX)
                && !url.chars().any(char::is_whitespace) =>
        {
            Some(Release { version: version.to_string(), url: url.to_string() })
        }
        _ => None,
    };
    CheckRecord { checked_at, release }
}

#[cfg(test)]
mod tests {
    use super::*;

    const PAGE: &str = "https://github.com/matheus-caldeira/deixa/releases/tag/v0.1.0";

    fn release_json(tag: &str, draft: bool, prerelease: bool, url: &str) -> String {
        serde_json::json!({ "tag_name": tag, "draft": draft, "prerelease": prerelease, "html_url": url }).to_string()
    }

    #[test]
    fn compares_semantic_versions() {
        assert!(is_newer("0.0.6", "0.0.5"));
        assert!(is_newer("v0.1.0", "0.0.9"));
        assert!(is_newer("1.0.0", "0.99.99"));
        assert!(is_newer("0.0.10", "0.0.9"));
        assert!(!is_newer("0.0.5", "0.0.5"));
        assert!(!is_newer("0.0.4", "0.0.5"));
        assert!(!is_newer("v0.0.5+build.7", "0.0.5"));
    }

    #[test]
    fn a_final_release_beats_its_own_prerelease() {
        assert!(is_newer("1.0.0", "1.0.0-beta.2"));
        assert!(!is_newer("1.0.0-beta.3", "1.0.0-beta.2"));
        assert!(!is_newer("2.0.0-rc.1", "1.0.0"));
    }

    #[test]
    fn orders_prerelease_identifiers_like_semver() {
        let order = ["1.0.0-alpha", "1.0.0-alpha.1", "1.0.0-alpha.beta", "1.0.0-beta", "1.0.0-beta.2", "1.0.0-beta.11", "1.0.0-rc.1", "1.0.0"];
        for pair in order.windows(2) {
            let left = parse_version(pair[0]).unwrap();
            let right = parse_version(pair[1]).unwrap();
            assert_eq!(compare(&left, &right), Ordering::Less, "{} < {}", pair[0], pair[1]);
        }
    }

    #[test]
    fn rejects_malformed_versions() {
        for text in ["", "1", "1.2", "1.2.3.4", "01a.2.3", "1..3", "x.y.z", "1.2.3-", "1.2.3-a..b", "latest"] {
            assert!(parse_version(text).is_none(), "{text}");
            assert!(!is_newer(text, "0.0.1"), "{text}");
        }
    }

    #[test]
    fn reads_only_final_releases_from_the_github_answer() {
        let found = parse_release(&release_json("v0.1.0", false, false, PAGE));
        assert_eq!(found, Some(Release { version: "0.1.0".into(), url: PAGE.into() }));
        assert!(parse_release(&release_json("v0.1.0", true, false, PAGE)).is_none());
        assert!(parse_release(&release_json("v0.1.0", false, true, PAGE)).is_none());
        assert!(parse_release(&release_json("v0.1.0-rc.1", false, false, PAGE)).is_none());
        assert!(parse_release("{\"tag_name\":\"v0.1.0\",\"html_url\":\"x\"}").is_none());
        assert!(parse_release("not json").is_none());
    }

    #[test]
    fn opens_only_the_project_release_page() {
        assert!(parse_release(&release_json("v0.1.0", false, false, "https://evil.example/deixa")).is_none());
        assert!(parse_release(&release_json("v0.1.0", false, false, "javascript:alert(1)")).is_none());
        let spaced = format!("{} x", PAGE);
        assert!(parse_release(&release_json("v0.1.0", false, false, &spaced)).is_none());
    }

    #[test]
    fn checks_at_most_once_a_day() {
        assert!(should_check(None, 1_000));
        assert!(!should_check(Some(1_000), 1_000 + CHECK_INTERVAL_SECONDS - 1));
        assert!(should_check(Some(1_000), 1_000 + CHECK_INTERVAL_SECONDS));
        assert!(should_check(Some(5_000), 1_000));
    }

    #[test]
    fn round_trips_the_check_record() {
        let record = CheckRecord {
            checked_at: Some(42),
            release: Some(Release { version: "0.1.0".into(), url: PAGE.into() }),
        };
        assert_eq!(parse_record(&format_record(&record)), record);
        let empty = CheckRecord { checked_at: Some(7), release: None };
        assert_eq!(parse_record(&format_record(&empty)), empty);
        assert_eq!(parse_record("lixo\n1.0\nhttps://evil.example"), CheckRecord::default());
    }

    #[test]
    fn shows_only_a_saved_release_newer_than_the_app() {
        let saved = Release { version: "0.1.0".into(), url: PAGE.into() };
        assert_eq!(newer_release(Some(&saved), "0.0.5"), Some(saved.clone()));
        assert_eq!(newer_release(Some(&saved), "0.1.0"), None);
        assert_eq!(newer_release(None, "0.0.5"), None);
    }
}
