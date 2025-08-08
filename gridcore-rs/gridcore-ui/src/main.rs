use gridcore_ui::app::App;
use leptos::*;
use leptos::wasm_bindgen::JsCast;

fn main() {
    // Set panic hook for better error messages in browser console
    console_error_panic_hook::set_once();

    // Mount the app to the DOM element with id "app"
    let window = web_sys::window().expect("Could not get window");
    let document = window.document().expect("Could not get document");
    let app_element = document.get_element_by_id("app").expect("Could not find #app element");
    
    mount_to(
        app_element.unchecked_into(),
        || view! { <App/> }
    )
}
