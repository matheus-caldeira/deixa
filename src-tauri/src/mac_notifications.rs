const IDENTIFIER_PREFIX: &str = "deixa-";
const APP_BUNDLE_SUFFIX: &str = ".app";

pub fn identifier_for(id: i32) -> String {
    format!("{IDENTIFIER_PREFIX}{id}")
}

pub fn id_from_identifier(identifier: &str) -> Option<i32> {
    identifier.strip_prefix(IDENTIFIER_PREFIX)?.parse().ok()
}

pub fn is_app_bundle(bundle_path: &str) -> bool {
    bundle_path.trim_end_matches('/').ends_with(APP_BUNDLE_SUFFIX)
}

#[cfg(target_os = "macos")]
mod native {
    use std::sync::OnceLock;

    use block2::{DynBlock, RcBlock};
    use objc2::rc::Retained;
    use objc2::runtime::{Bool, NSObject, NSObjectProtocol, ProtocolObject};
    use objc2::{define_class, msg_send, AllocAnyThread};
    use objc2_foundation::{NSBundle, NSError, NSString};
    use objc2_user_notifications::{
        UNAuthorizationOptions, UNMutableNotificationContent, UNNotification, UNNotificationPresentationOptions,
        UNNotificationRequest, UNNotificationResponse, UNNotificationSound, UNUserNotificationCenter,
        UNUserNotificationCenterDelegate,
    };

    type ClickHandler = Box<dyn Fn(Option<i32>) + Send + Sync>;

    static CLICK_HANDLER: OnceLock<ClickHandler> = OnceLock::new();
    static NATIVE_READY: OnceLock<bool> = OnceLock::new();

    define_class!(
        #[unsafe(super(NSObject))]
        #[name = "DeixaNotificationDelegate"]
        struct NotificationDelegate;

        unsafe impl NSObjectProtocol for NotificationDelegate {}

        unsafe impl UNUserNotificationCenterDelegate for NotificationDelegate {
            #[unsafe(method(userNotificationCenter:willPresentNotification:withCompletionHandler:))]
            fn will_present(
                &self,
                _center: &UNUserNotificationCenter,
                _notification: &UNNotification,
                completion_handler: &DynBlock<dyn Fn(UNNotificationPresentationOptions)>,
            ) {
                completion_handler.call((UNNotificationPresentationOptions::Banner
                    | UNNotificationPresentationOptions::List
                    | UNNotificationPresentationOptions::Sound,));
            }

            #[unsafe(method(userNotificationCenter:didReceiveNotificationResponse:withCompletionHandler:))]
            fn did_receive(
                &self,
                _center: &UNUserNotificationCenter,
                response: &UNNotificationResponse,
                completion_handler: &DynBlock<dyn Fn()>,
            ) {
                let identifier = response.notification().request().identifier().to_string();
                if let Some(handler) = CLICK_HANDLER.get() {
                    handler(super::id_from_identifier(&identifier));
                }
                completion_handler.call(());
            }
        }
    );

    impl NotificationDelegate {
        fn new() -> Retained<Self> {
            let this = Self::alloc().set_ivars(());
            unsafe { msg_send![super(this), init] }
        }
    }

    fn running_from_app_bundle() -> bool {
        super::is_app_bundle(&NSBundle::mainBundle().bundlePath().to_string())
    }

    pub fn start(on_click: impl Fn(Option<i32>) + Send + Sync + 'static) -> bool {
        *NATIVE_READY.get_or_init(|| {
            if !running_from_app_bundle() {
                return false;
            }
            let _ = CLICK_HANDLER.set(Box::new(on_click));
            let center = UNUserNotificationCenter::currentNotificationCenter();
            let delegate = NotificationDelegate::new();
            center.setDelegate(Some(ProtocolObject::from_ref(&*delegate)));
            std::mem::forget(delegate);
            let answered = RcBlock::new(|_granted: Bool, _error: *mut NSError| {});
            center.requestAuthorizationWithOptions_completionHandler(
                UNAuthorizationOptions::Alert | UNAuthorizationOptions::Sound,
                &answered,
            );
            true
        })
    }

    pub fn show(id: i32, title: &str, body: &str) -> bool {
        if NATIVE_READY.get() != Some(&true) {
            return false;
        }
        let content = UNMutableNotificationContent::new();
        content.setTitle(&NSString::from_str(title));
        content.setBody(&NSString::from_str(body));
        content.setSound(Some(&UNNotificationSound::defaultSound()));
        let request = UNNotificationRequest::requestWithIdentifier_content_trigger(
            &NSString::from_str(&super::identifier_for(id)),
            &content,
            None,
        );
        UNUserNotificationCenter::currentNotificationCenter().addNotificationRequest_withCompletionHandler(&request, None);
        true
    }
}

#[cfg(target_os = "macos")]
pub use native::{show, start};

#[cfg(not(target_os = "macos"))]
pub fn start(_on_click: impl Fn(Option<i32>) + Send + Sync + 'static) -> bool {
    false
}

#[cfg(not(target_os = "macos"))]
pub fn show(_id: i32, _title: &str, _body: &str) -> bool {
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identifier_round_trips_the_notification_id() {
        assert_eq!(id_from_identifier(&identifier_for(42)), Some(42));
    }

    #[test]
    fn foreign_identifier_has_no_id() {
        assert_eq!(id_from_identifier("other-7"), None);
        assert_eq!(id_from_identifier("deixa-abc"), None);
    }

    #[test]
    fn only_an_app_bundle_uses_the_native_center() {
        assert!(is_app_bundle("/Applications/Deixa.app"));
        assert!(is_app_bundle("/Applications/Deixa.app/"));
        assert!(!is_app_bundle("/Volumes/SSD/www/poc-anki/src-tauri/target/debug"));
    }
}
