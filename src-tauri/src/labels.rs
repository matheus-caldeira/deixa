use serde_json::Value;

pub const DEFAULT_LOCALE: &str = "pt-BR";
const NAMESPACE: &str = "desktop";
const CATALOGS: [(&str, &str); 2] = [
    ("pt-BR", include_str!("../../locales/pt-BR.json")),
    ("en", include_str!("../../locales/en.json")),
];

#[derive(Clone)]
pub struct Labels {
    locale: String,
    entries: Value,
}

fn namespace(source: &str) -> Value {
    serde_json::from_str::<Value>(source)
        .ok()
        .and_then(|all| all.get(NAMESPACE).cloned())
        .unwrap_or(Value::Null)
}

impl Labels {
    pub fn for_locale(locale: &str) -> Labels {
        let (code, source) = CATALOGS
            .iter()
            .find(|(code, _)| *code == locale)
            .or_else(|| CATALOGS.iter().find(|(code, _)| *code == DEFAULT_LOCALE))
            .copied()
            .unwrap_or((DEFAULT_LOCALE, "{}"));
        Labels { locale: code.to_string(), entries: namespace(source) }
    }

    pub fn locale(&self) -> &str {
        &self.locale
    }

    pub fn get(&self, key: &str) -> String {
        self.entries
            .get(key)
            .and_then(Value::as_str)
            .map(str::to_string)
            .unwrap_or_else(|| key.to_string())
    }

    pub fn fill(&self, key: &str, params: &[(&str, &str)]) -> String {
        params
            .iter()
            .fold(self.get(key), |text, (name, value)| text.replace(&format!("{{{}}}", name), value))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_each_locale_from_the_shared_json() {
        assert_eq!(Labels::for_locale("pt-BR").get("trayQuit"), "Sair");
        assert_eq!(Labels::for_locale("en").get("trayQuit"), "Quit");
    }

    #[test]
    fn unknown_locale_falls_back_to_the_default() {
        let labels = Labels::for_locale("de");
        assert_eq!(labels.locale(), DEFAULT_LOCALE);
        assert_eq!(labels.get("trayQuit"), "Sair");
    }

    #[test]
    fn fills_named_parameters() {
        let text = Labels::for_locale("en").fill("inboxMany", &[("count", "3")]);
        assert_eq!(text, "3 new notifications");
    }

    #[test]
    fn every_key_used_by_the_shell_exists_in_both_locales() {
        for locale in ["pt-BR", "en"] {
            let labels = Labels::for_locale(locale);
            for key in USED_KEYS {
                assert_ne!(labels.get(key), *key, "{locale} sem {key}");
            }
        }
    }

    const USED_KEYS: &[&str] = &[
        "about", "aboutComments", "settings", "quit", "hide", "hideOthers", "showAll", "file", "openBrowser",
        "openPhone", "import", "export", "closeWindow", "edit", "undo", "redo", "cut", "copy", "paste",
        "selectAll", "go", "goHome", "goCatalog", "goReview", "goTutor", "goProgress", "goTransfer",
        "goSettings", "reload", "window", "minimize", "zoom", "fullscreen", "phoneWindow", "trayOpen",
        "trayQuit", "resume", "resumeEmpty", "inboxEmpty", "inboxOne", "inboxMany", "statusStarting",
        "statusBusy", "statusMissing", "statusUp", "statusDown", "trayAutoEnter", "trayAutostart", "updateAvailable",
    ];
}
