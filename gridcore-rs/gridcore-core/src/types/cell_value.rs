use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum CellValue {
    Number(f64),
    String(String),
    Boolean(bool),
    Empty,
    Error(String),
    Array(Vec<CellValue>),
}

impl CellValue {
    /// Convert from JavaScript value
    #[cfg(feature = "wasm")]
    pub fn from_js(value: wasm_bindgen::JsValue) -> Result<Self, wasm_bindgen::JsValue> {
        if value.is_null() || value.is_undefined() {
            Ok(CellValue::Empty)
        } else if let Some(b) = value.as_bool() {
            Ok(CellValue::Boolean(b))
        } else if let Some(n) = value.as_f64() {
            Ok(CellValue::Number(n))
        } else if let Some(s) = value.as_string() {
            Ok(CellValue::String(s))
        } else {
            Err(wasm_bindgen::JsValue::from_str("Unsupported value type"))
        }
    }

    /// Convert to JavaScript value
    #[cfg(feature = "wasm")]
    pub fn to_js(&self) -> wasm_bindgen::JsValue {
        match self {
            CellValue::Number(n) => wasm_bindgen::JsValue::from_f64(*n),
            CellValue::String(s) => wasm_bindgen::JsValue::from_str(s),
            CellValue::Boolean(b) => wasm_bindgen::JsValue::from_bool(*b),
            CellValue::Empty => wasm_bindgen::JsValue::NULL,
            CellValue::Error(e) => wasm_bindgen::JsValue::from_str(e),
            CellValue::Array(arr) => {
                let js_array = js_sys::Array::new();
                for val in arr {
                    js_array.push(&val.to_js());
                }
                js_array.into()
            }
        }
    }

    /// Check if the value is numeric
    pub fn is_number(&self) -> bool {
        matches!(self, CellValue::Number(_))
    }

    /// Check if the value is a string
    pub fn is_string(&self) -> bool {
        matches!(self, CellValue::String(_))
    }

    /// Check if the value is a boolean
    pub fn is_boolean(&self) -> bool {
        matches!(self, CellValue::Boolean(_))
    }

    /// Check if the value is null/empty
    pub fn is_empty(&self) -> bool {
        matches!(self, CellValue::Empty)
    }

    /// Check if the value is an error
    pub fn is_error(&self) -> bool {
        matches!(self, CellValue::Error(_))
    }

    /// Try to get the numeric value
    pub fn as_number(&self) -> Option<f64> {
        match self {
            CellValue::Number(n) => Some(*n),
            _ => None,
        }
    }

    /// Try to get the string value
    pub fn as_string(&self) -> Option<&str> {
        match self {
            CellValue::String(s) => Some(s),
            _ => None,
        }
    }

    /// Try to get the boolean value
    pub fn as_boolean(&self) -> Option<bool> {
        match self {
            CellValue::Boolean(b) => Some(*b),
            _ => None,
        }
    }

    /// Get a human-readable type name
    pub fn type_name(&self) -> &str {
        match self {
            CellValue::Number(_) => "number",
            CellValue::String(_) => "string",
            CellValue::Boolean(_) => "boolean",
            CellValue::Empty => "empty",
            CellValue::Error(_) => "error",
            CellValue::Array(_) => "array",
        }
    }

    /// Convert to display string
    pub fn to_display_string(&self) -> String {
        match self {
            CellValue::Number(n) => n.to_string(),
            CellValue::String(s) => s.clone(),
            CellValue::Boolean(b) => b.to_string().to_uppercase(),
            CellValue::Empty => String::new(),
            CellValue::Error(e) => e.clone(),
            CellValue::Array(arr) => format!("{:?}", arr),
        }
    }
}

impl Default for CellValue {
    fn default() -> Self {
        CellValue::Empty
    }
}

impl fmt::Display for CellValue {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.to_display_string())
    }
}

#[cfg(feature = "wasm")]
pub mod wasm {
    use super::*;
    use wasm_bindgen::prelude::*;

    #[wasm_bindgen]
    pub struct WasmCellValue {
        inner: CellValue,
    }

    #[wasm_bindgen]
    impl WasmCellValue {
        #[wasm_bindgen(constructor)]
        pub fn new() -> Self {
            WasmCellValue {
                inner: CellValue::Empty,
            }
        }

        #[wasm_bindgen(js_name = "fromNumber")]
        pub fn from_number(value: f64) -> Self {
            WasmCellValue {
                inner: CellValue::Number(value),
            }
        }

        #[wasm_bindgen(js_name = "fromString")]
        pub fn from_string(value: String) -> Self {
            WasmCellValue {
                inner: CellValue::String(value),
            }
        }

        #[wasm_bindgen(js_name = "fromBoolean")]
        pub fn from_boolean(value: bool) -> Self {
            WasmCellValue {
                inner: CellValue::Boolean(value),
            }
        }

        #[wasm_bindgen(js_name = "fromError")]
        pub fn from_error(message: String) -> Self {
            WasmCellValue {
                inner: CellValue::Error(message),
            }
        }

        #[wasm_bindgen(js_name = "fromJS")]
        pub fn from_js(value: JsValue) -> Result<WasmCellValue, JsValue> {
            let inner = if value.is_null() || value.is_undefined() {
                CellValue::Empty
            } else if let Some(n) = value.as_f64() {
                CellValue::Number(n)
            } else if let Some(b) = value.as_bool() {
                CellValue::Boolean(b)
            } else if let Some(s) = value.as_string() {
                CellValue::String(s)
            } else {
                return Err(JsValue::from_str("Unsupported type"));
            };

            Ok(WasmCellValue { inner })
        }

        #[wasm_bindgen(js_name = "toJS")]
        pub fn to_js(&self) -> JsValue {
            match &self.inner {
                CellValue::Number(n) => JsValue::from_f64(*n),
                CellValue::String(s) => JsValue::from_str(s),
                CellValue::Boolean(b) => JsValue::from_bool(*b),
                CellValue::Empty => JsValue::NULL,
                CellValue::Error(e) => {
                    let obj = js_sys::Object::new();
                    js_sys::Reflect::set(&obj, &JsValue::from_str("error"), &JsValue::from_str(e))
                        .unwrap();
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

        #[wasm_bindgen(js_name = "isNumber")]
        pub fn is_number(&self) -> bool {
            self.inner.is_number()
        }

        #[wasm_bindgen(js_name = "isString")]
        pub fn is_string(&self) -> bool {
            self.inner.is_string()
        }

        #[wasm_bindgen(js_name = "isBoolean")]
        pub fn is_boolean(&self) -> bool {
            self.inner.is_boolean()
        }

        #[wasm_bindgen(js_name = "isEmpty")]
        pub fn is_empty(&self) -> bool {
            self.inner.is_empty()
        }

        #[wasm_bindgen(js_name = "isError")]
        pub fn is_error(&self) -> bool {
            self.inner.is_error()
        }

        #[wasm_bindgen(js_name = "toString")]
        pub fn to_string(&self) -> String {
            self.inner.to_display_string()
        }
    }
}
