#[cfg(feature = "wasm")]
use wasm_bindgen::prelude::*;

#[cfg(feature = "wasm")]
pub mod controller;
#[cfg(feature = "wasm")]
pub mod events;
#[cfg(feature = "wasm")]
pub mod state;
#[cfg(feature = "wasm")]
pub mod viewport;

#[cfg(feature = "wasm")]
#[wasm_bindgen(js_name = "initController")]
pub fn init_controller() {
    // Initialize panic hook for better error messages in browser
    console_error_panic_hook::set_once();

    // Initialize console logging
    let _ = console_log::init_with_level(log::Level::Debug);
}

#[cfg(feature = "wasm")]
#[wasm_bindgen(js_name = "controllerVersion")]
pub fn controller_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
