use wasm_bindgen::JsCast;
use web_sys::{HtmlElement};

pub fn get_window() -> web_sys::Window {
    web_sys::window().expect("no global window exists")
}

pub fn get_document() -> web_sys::Document {
    get_window()
        .document()
        .expect("should have a document on window")
}

pub fn get_element_by_id(id: &str) -> Option<HtmlElement> {
    get_document()
        .get_element_by_id(id)
        .and_then(|e| e.dyn_into::<HtmlElement>().ok())
}

pub fn request_animation_frame(f: &wasm_bindgen::closure::Closure<dyn FnMut()>) {
    get_window()
        .request_animation_frame(f.as_ref().unchecked_ref())
        .expect("should register `requestAnimationFrame` OK");
}