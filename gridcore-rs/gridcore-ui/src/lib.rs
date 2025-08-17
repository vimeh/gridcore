pub mod app;
pub mod components;
pub mod context;
pub mod debug;
pub mod interaction;
pub mod reactive;
pub mod rendering;
pub mod utils;

#[cfg(feature = "perf")]
pub mod perf;

#[cfg(feature = "perf")]
pub mod metrics_collector;

// Re-export demo components when demo feature is enabled
#[cfg(feature = "demo")]
pub use gridcore_demo::components::{DemoProgressBar, PerformanceOverlay};
#[cfg(feature = "demo")]
pub use gridcore_demo::{DemoConfig, DemoController, DemoMode, demo};

use app::App;
use leptos::prelude::*;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn run_app() {
    // Set panic hook for better error messages in browser console (debug builds only)
    #[cfg(feature = "debug")]
    console_error_panic_hook::set_once();

    // Mount the app to the DOM element with id "app"
    let window = web_sys::window().expect("Could not get window");
    let document = window.document().expect("Could not get document");
    let app_element = document
        .get_element_by_id("app")
        .expect("Could not find #app element")
        .dyn_into::<web_sys::HtmlElement>()
        .expect("Could not cast to HtmlElement");

    mount_to(app_element, || view! { <App/> }).forget();
}
