pub mod app;
pub mod benchmark;
pub mod components;
pub mod debug;
pub mod demo;
pub mod interaction;
pub mod rendering;
pub mod utils;

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
