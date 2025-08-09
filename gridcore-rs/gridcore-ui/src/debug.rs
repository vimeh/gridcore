use leptos::*;
use std::sync::atomic::{AtomicBool, Ordering};

// Global debug flag
static DEBUG_MODE: AtomicBool = AtomicBool::new(false);

/// Enable or disable debug mode
pub fn set_debug_mode(enabled: bool) {
    DEBUG_MODE.store(enabled, Ordering::SeqCst);
}

/// Check if debug mode is enabled
pub fn is_debug_enabled() -> bool {
    DEBUG_MODE.load(Ordering::SeqCst)
}

/// Log a debug message only if debug mode is enabled
#[macro_export]
macro_rules! debug_log {
    ($($arg:tt)*) => {
        if $crate::debug::is_debug_enabled() {
            leptos::logging::log!($($arg)*);
        }
    };
}

/// Log to browser console only if debug mode is enabled (for WASM target)
#[cfg(target_arch = "wasm32")]
#[macro_export]
macro_rules! debug_console {
    ($($arg:tt)*) => {
        if $crate::debug::is_debug_enabled() {
            web_sys::console::log_1(&format!($($arg)*).into());
        }
    };
}

#[cfg(not(target_arch = "wasm32"))]
#[macro_export]
macro_rules! debug_console {
    ($($arg:tt)*) => {};
}

/// Create a debug mode signal for reactive UI updates
#[component]
pub fn DebugModeProvider(children: Children) -> impl IntoView {
    let (debug_mode, set_debug_mode_signal) = create_signal(false);

    // Sync with global state
    create_effect(move |_| {
        set_debug_mode(debug_mode.get());
    });

    provide_context(debug_mode);
    provide_context(set_debug_mode_signal);

    children()
}

/// Get the debug mode signal from context
pub fn use_debug_mode() -> (ReadSignal<bool>, WriteSignal<bool>) {
    let debug_mode = use_context::<ReadSignal<bool>>()
        .expect("use_debug_mode must be used within DebugModeProvider");
    let set_debug_mode = use_context::<WriteSignal<bool>>()
        .expect("use_debug_mode must be used within DebugModeProvider");
    (debug_mode, set_debug_mode)
}
