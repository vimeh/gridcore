use gridcore_ui::app::App;
use leptos::*;

fn main() {
    // Set panic hook for better error messages in browser console
    console_error_panic_hook::set_once();

    // Mount the app to the DOM element with id "app"
    mount_to_body(|| view! { <App/> })
}
