#[cfg(feature = "wasm")]
use wasm_bindgen::prelude::*;

#[cfg(feature = "wasm")]
pub mod state;
#[cfg(feature = "wasm")]
pub mod controller;
#[cfg(feature = "wasm")]
pub mod events;
#[cfg(feature = "wasm")]
pub mod viewport;

#[cfg(feature = "wasm")]
#[wasm_bindgen(start)]
pub fn init() {
    // Initialize panic hook for better error messages in browser
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
    
    // Initialize console logging
    #[cfg(feature = "console_log")]
    console_log::init_with_level(log::Level::Debug).unwrap();
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}