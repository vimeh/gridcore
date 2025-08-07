use crate::controller::{KeyboardEvent, MouseEvent, SpreadsheetController};
use crate::state::Action;
use gridcore_core::types::CellAddress;
use serde_wasm_bindgen::{from_value, to_value};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct WasmSpreadsheetController {
    inner: SpreadsheetController,
    // Note: Event subscriptions will be handled differently in WASM
    // JavaScript will poll for events or we'll use a different mechanism
}

#[wasm_bindgen]
impl WasmSpreadsheetController {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        let controller = SpreadsheetController::new();

        Self { inner: controller }
    }

    #[wasm_bindgen(js_name = "withViewport")]
    pub fn with_viewport(_viewport: JsValue) -> Result<WasmSpreadsheetController, JsValue> {
        // For now, just create a new controller
        // In a full implementation, we'd parse the viewport config
        Ok(Self::new())
    }

    #[wasm_bindgen(js_name = "getState")]
    pub fn get_state(&self) -> Result<JsValue, JsValue> {
        to_value(self.inner.get_state()).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    #[wasm_bindgen(js_name = "dispatchAction")]
    pub fn dispatch_action(&mut self, action_js: JsValue) -> Result<(), JsValue> {
        let action: Action =
            from_value(action_js).map_err(|e| JsValue::from_str(&e.to_string()))?;
        self.inner
            .dispatch_action(action)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    #[wasm_bindgen(js_name = "handleKeyboardEvent")]
    pub fn handle_keyboard_event(&mut self, event_js: JsValue) -> Result<(), JsValue> {
        let event: KeyboardEvent =
            from_value(event_js).map_err(|e| JsValue::from_str(&e.to_string()))?;
        self.inner
            .handle_keyboard_event(event)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    #[wasm_bindgen(js_name = "handleMouseEvent")]
    pub fn handle_mouse_event(&mut self, event_js: JsValue) -> Result<(), JsValue> {
        let event: MouseEvent =
            from_value(event_js).map_err(|e| JsValue::from_str(&e.to_string()))?;
        self.inner
            .handle_mouse_event(event)
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
        self.inner
            .get_facade_mut()
            .set_cell_value(&address, &value)
            .map(|_| ()) // Ignore the returned Cell
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    #[wasm_bindgen(js_name = "getCursor")]
    pub fn get_cursor(&self) -> Result<JsValue, JsValue> {
        to_value(self.inner.get_state().cursor()).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    #[wasm_bindgen(js_name = "getViewport")]
    pub fn get_viewport(&self) -> Result<JsValue, JsValue> {
        to_value(self.inner.get_state().viewport()).map_err(|e| JsValue::from_str(&e.to_string()))
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
        let event = KeyboardEvent::new(key).with_modifiers(shift, ctrl, alt, meta);
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

    // Subscribe to events - simplified for WASM
    // In production, we'd use a different pattern like message passing
    #[wasm_bindgen(js_name = "subscribe")]
    pub fn subscribe(&mut self, _callback: js_sys::Function) -> usize {
        // For now, return a dummy ID
        // Real implementation would use a different event system
        0
    }

    // Unsubscribe from events
    #[wasm_bindgen(js_name = "unsubscribe")]
    pub fn unsubscribe(&mut self, _listener_id: usize) -> bool {
        // For now, always return true
        true
    }

    // Get facade (for advanced operations)
    #[wasm_bindgen(js_name = "getFacade")]
    pub fn get_facade(&self) -> Result<JsValue, JsValue> {
        // Return a reference to the facade for operations
        // Note: This would need WasmSpreadsheetFacade wrapper
        to_value(&()).map_err(|e| JsValue::from_str(&e.to_string()))
    }
}
