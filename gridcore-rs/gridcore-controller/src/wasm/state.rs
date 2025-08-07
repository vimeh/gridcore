use wasm_bindgen::prelude::*;
use serde_wasm_bindgen::{from_value, to_value};
use crate::state::{UIStateMachine, UIState, Action};
use gridcore_core::types::CellAddress;

#[wasm_bindgen]
pub struct WasmUIStateMachine {
    inner: UIStateMachine,
}

#[wasm_bindgen]
impl WasmUIStateMachine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: UIStateMachine::new(None),
        }
    }
    
    #[wasm_bindgen(js_name = "withInitialState")]
    pub fn with_initial_state(state_js: JsValue) -> Result<WasmUIStateMachine, JsValue> {
        let state: UIState = from_value(state_js)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        Ok(Self {
            inner: UIStateMachine::new(Some(state)),
        })
    }
    
    #[wasm_bindgen(js_name = "getState")]
    pub fn get_state(&self) -> Result<JsValue, JsValue> {
        to_value(self.inner.get_state())
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
    
    #[wasm_bindgen(js_name = "transition")]
    pub fn transition(&mut self, action_js: JsValue) -> Result<(), JsValue> {
        let action: Action = from_value(action_js)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        self.inner.transition(action)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
    
    #[wasm_bindgen(js_name = "getSpreadsheetMode")]
    pub fn get_spreadsheet_mode(&self) -> String {
        format!("{:?}", self.inner.get_state().spreadsheet_mode())
    }
    
    #[wasm_bindgen(js_name = "getCursor")]
    pub fn get_cursor(&self) -> Result<JsValue, JsValue> {
        to_value(self.inner.get_state().cursor())
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
    
    #[wasm_bindgen(js_name = "getViewport")]
    pub fn get_viewport(&self) -> Result<JsValue, JsValue> {
        to_value(self.inner.get_state().viewport())
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
    
    #[wasm_bindgen(js_name = "getHistory")]
    pub fn get_history(&self) -> Result<JsValue, JsValue> {
        to_value(&self.inner.get_history())
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
    
    #[wasm_bindgen(js_name = "clearHistory")]
    pub fn clear_history(&mut self) {
        self.inner.clear_history();
    }
    
    // Helper methods for common transitions
    #[wasm_bindgen(js_name = "startEditing")]
    pub fn start_editing(&mut self, initial_value: Option<String>) -> Result<(), JsValue> {
        self.inner.transition(Action::StartEditing {
            edit_mode: None,
            initial_value,
            cursor_position: None,
        })
        .map_err(|e| JsValue::from_str(&e.to_string()))
    }
    
    #[wasm_bindgen(js_name = "enterCommandMode")]
    pub fn enter_command_mode(&mut self) -> Result<(), JsValue> {
        self.inner.transition(Action::EnterCommandMode)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
    
    #[wasm_bindgen(js_name = "escape")]
    pub fn escape(&mut self) -> Result<(), JsValue> {
        self.inner.transition(Action::Escape)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
    
    #[wasm_bindgen(js_name = "updateCursor")]
    pub fn update_cursor(&mut self, col: u32, row: u32) -> Result<(), JsValue> {
        let cursor = CellAddress::new(col, row);
        self.inner.transition(Action::UpdateCursor { cursor })
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
}

// Export action types as static methods for TypeScript
#[wasm_bindgen]
pub struct ActionBuilder;

#[wasm_bindgen]
impl ActionBuilder {
    #[wasm_bindgen(js_name = "startEditing")]
    pub fn start_editing(initial_value: Option<String>) -> Result<JsValue, JsValue> {
        let action = Action::StartEditing {
            edit_mode: None,
            initial_value,
            cursor_position: None,
        };
        to_value(&action).map_err(|e| JsValue::from_str(&e.to_string()))
    }
    
    #[wasm_bindgen(js_name = "enterCommandMode")]
    pub fn enter_command_mode() -> Result<JsValue, JsValue> {
        to_value(&Action::EnterCommandMode)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
    
    #[wasm_bindgen(js_name = "escape")]
    pub fn escape() -> Result<JsValue, JsValue> {
        to_value(&Action::Escape)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
    
    #[wasm_bindgen(js_name = "updateCursor")]
    pub fn update_cursor(col: u32, row: u32) -> Result<JsValue, JsValue> {
        let action = Action::UpdateCursor {
            cursor: CellAddress::new(col, row),
        };
        to_value(&action).map_err(|e| JsValue::from_str(&e.to_string()))
    }
    
    #[wasm_bindgen(js_name = "updateCommandValue")]
    pub fn update_command_value(value: String) -> Result<JsValue, JsValue> {
        let action = Action::UpdateCommandValue { value };
        to_value(&action).map_err(|e| JsValue::from_str(&e.to_string()))
    }
}