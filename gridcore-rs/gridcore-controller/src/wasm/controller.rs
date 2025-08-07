use wasm_bindgen::prelude::*;
use serde_wasm_bindgen::{from_value, to_value};
use crate::controller::{SpreadsheetController, KeyboardEvent, MouseEvent};
use crate::state::Action;
use gridcore_core::types::CellAddress;

#[wasm_bindgen]
pub struct WasmSpreadsheetController {
    inner: SpreadsheetController,
}

#[wasm_bindgen]
impl WasmSpreadsheetController {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: SpreadsheetController::new(),
        }
    }
    
    #[wasm_bindgen(js_name = "getState")]
    pub fn get_state(&self) -> Result<JsValue, JsValue> {
        to_value(self.inner.get_state())
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
    
    #[wasm_bindgen(js_name = "dispatchAction")]
    pub fn dispatch_action(&mut self, action_js: JsValue) -> Result<(), JsValue> {
        let action: Action = from_value(action_js)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        self.inner.dispatch_action(action)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
    
    #[wasm_bindgen(js_name = "handleKeyboardEvent")]
    pub fn handle_keyboard_event(&mut self, event_js: JsValue) -> Result<(), JsValue> {
        let event: KeyboardEvent = from_value(event_js)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        self.inner.handle_keyboard_event(event)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
    
    #[wasm_bindgen(js_name = "handleMouseEvent")]
    pub fn handle_mouse_event(&mut self, event_js: JsValue) -> Result<(), JsValue> {
        let event: MouseEvent = from_value(event_js)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        self.inner.handle_mouse_event(event)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
    
    #[wasm_bindgen(js_name = "getCellValue")]
    pub fn get_cell_value(&self, col: u32, row: u32) -> Result<JsValue, JsValue> {
        let address = CellAddress::new(col, row);
        let cell = self.inner.get_facade().get_cell(&address);
        to_value(&cell).map_err(|e| JsValue::from_str(&e.to_string()))
    }
    
    #[wasm_bindgen(js_name = "setCellValue")]
    pub fn set_cell_value(&mut self, col: u32, row: u32, value: String) -> Result<(), JsValue> {
        let address = CellAddress::new(col, row);
        self.inner.get_facade_mut().set_cell_value(&address, &value)
            .map(|_| ()) // Ignore the returned Cell
            .map_err(|e| JsValue::from_str(&e.to_string()))
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
    
    #[wasm_bindgen(js_name = "getSpreadsheetMode")]
    pub fn get_spreadsheet_mode(&self) -> String {
        format!("{:?}", self.inner.get_state().spreadsheet_mode())
    }
    
    // Helper method to create keyboard events from TypeScript
    #[wasm_bindgen(js_name = "createKeyboardEvent")]
    pub fn create_keyboard_event(
        key: String,
        shift: bool,
        ctrl: bool,
        alt: bool,
        meta: bool,
    ) -> Result<JsValue, JsValue> {
        let event = KeyboardEvent::new(key)
            .with_modifiers(shift, ctrl, alt, meta);
        to_value(&event).map_err(|e| JsValue::from_str(&e.to_string()))
    }
    
    // Helper method to create mouse events from TypeScript
    #[wasm_bindgen(js_name = "createMouseEvent")]
    pub fn create_mouse_event(
        x: f64,
        y: f64,
        button: String,
        event_type: String,
    ) -> Result<JsValue, JsValue> {
        use crate::controller::events::{MouseButton, MouseEventType};
        
        let button = match button.as_str() {
            "left" => MouseButton::Left,
            "middle" => MouseButton::Middle,
            "right" => MouseButton::Right,
            _ => MouseButton::None,
        };
        
        let event_type = match event_type.as_str() {
            "down" => MouseEventType::Down,
            "up" => MouseEventType::Up,
            "move" => MouseEventType::Move,
            "click" => MouseEventType::Click,
            "doubleclick" => MouseEventType::DoubleClick,
            "wheel" => MouseEventType::Wheel,
            _ => MouseEventType::Move,
        };
        
        let event = MouseEvent::new(x, y, button, event_type);
        to_value(&event).map_err(|e| JsValue::from_str(&e.to_string()))
    }
}