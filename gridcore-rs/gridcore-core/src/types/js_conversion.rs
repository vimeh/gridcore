use crate::types::CellValue;
use wasm_bindgen::prelude::*;

/// Trait for converting Rust types to JavaScript values
pub trait ToJs {
    fn to_js(&self) -> JsValue;
}

impl ToJs for CellValue {
    fn to_js(&self) -> JsValue {
        match self {
            CellValue::Empty => JsValue::NULL,
            CellValue::Number(n) => JsValue::from_f64(*n),
            CellValue::String(s) => JsValue::from_str(s),
            CellValue::Boolean(b) => JsValue::from_bool(*b),
            CellValue::Error(e) => {
                let obj = js_sys::Object::new();
                let _ = js_sys::Reflect::set(&obj, &JsValue::from_str("error"), &JsValue::from_str(e));
                obj.into()
            }
            CellValue::Array(arr) => {
                let js_array = js_sys::Array::new();
                for val in arr {
                    js_array.push(&val.to_js());
                }
                js_array.into()
            }
        }
    }
}