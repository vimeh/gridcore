use wasm_bindgen::prelude::*;
use serde_wasm_bindgen::to_value;
use crate::controller::{SpreadsheetEvent, KeyboardEvent, MouseEvent};
use crate::controller::events::{MouseButton, MouseEventType};

#[wasm_bindgen]
pub struct EventFactory;

#[wasm_bindgen]
impl EventFactory {
    #[wasm_bindgen(js_name = "keyboardEvent")]
    pub fn keyboard_event(
        key: String,
        code: String,
        shift: bool,
        ctrl: bool,
        alt: bool,
        meta: bool,
    ) -> Result<JsValue, JsValue> {
        let mut event = KeyboardEvent::new(key);
        event.code = code;
        event.shift = shift;
        event.ctrl = ctrl;
        event.alt = alt;
        event.meta = meta;
        
        to_value(&event).map_err(|e| JsValue::from_str(&e.to_string()))
    }
    
    #[wasm_bindgen(js_name = "mouseEvent")]
    pub fn mouse_event(
        x: f64,
        y: f64,
        button: String,
        event_type: String,
        shift: bool,
        ctrl: bool,
        alt: bool,
        meta: bool,
    ) -> Result<JsValue, JsValue> {
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
        
        let event = MouseEvent::new(x, y, button, event_type)
            .with_modifiers(shift, ctrl, alt, meta);
        
        to_value(&event).map_err(|e| JsValue::from_str(&e.to_string()))
    }
    
    #[wasm_bindgen(js_name = "cursorMovedEvent")]
    pub fn cursor_moved_event(from_col: u32, from_row: u32, to_col: u32, to_row: u32) -> Result<JsValue, JsValue> {
        use gridcore_core::types::CellAddress;
        
        let event = SpreadsheetEvent::CursorMoved {
            from: CellAddress::new(from_col, from_row),
            to: CellAddress::new(to_col, to_row),
        };
        
        to_value(&event).map_err(|e| JsValue::from_str(&e.to_string()))
    }
    
    #[wasm_bindgen(js_name = "cellEditStartedEvent")]
    pub fn cell_edit_started_event(col: u32, row: u32) -> Result<JsValue, JsValue> {
        use gridcore_core::types::CellAddress;
        
        let event = SpreadsheetEvent::CellEditStarted {
            address: CellAddress::new(col, row),
        };
        
        to_value(&event).map_err(|e| JsValue::from_str(&e.to_string()))
    }
    
    #[wasm_bindgen(js_name = "cellEditCompletedEvent")]
    pub fn cell_edit_completed_event(col: u32, row: u32, value: String) -> Result<JsValue, JsValue> {
        use gridcore_core::types::CellAddress;
        
        let event = SpreadsheetEvent::CellEditCompleted {
            address: CellAddress::new(col, row),
            value,
        };
        
        to_value(&event).map_err(|e| JsValue::from_str(&e.to_string()))
    }
    
    #[wasm_bindgen(js_name = "commandExecutedEvent")]
    pub fn command_executed_event(command: String) -> Result<JsValue, JsValue> {
        let event = SpreadsheetEvent::CommandExecuted { command };
        to_value(&event).map_err(|e| JsValue::from_str(&e.to_string()))
    }
}

// Export enum values as constants for TypeScript
#[wasm_bindgen]
pub struct EventTypes;

#[wasm_bindgen]
impl EventTypes {
    #[wasm_bindgen(js_name = "CURSOR_MOVED")]
    pub fn cursor_moved() -> String {
        "CursorMoved".to_string()
    }
    
    #[wasm_bindgen(js_name = "VIEWPORT_CHANGED")]
    pub fn viewport_changed() -> String {
        "ViewportChanged".to_string()
    }
    
    #[wasm_bindgen(js_name = "CELL_EDIT_STARTED")]
    pub fn cell_edit_started() -> String {
        "CellEditStarted".to_string()
    }
    
    #[wasm_bindgen(js_name = "CELL_EDIT_COMPLETED")]
    pub fn cell_edit_completed() -> String {
        "CellEditCompleted".to_string()
    }
    
    #[wasm_bindgen(js_name = "CELL_EDIT_CANCELLED")]
    pub fn cell_edit_cancelled() -> String {
        "CellEditCancelled".to_string()
    }
    
    #[wasm_bindgen(js_name = "MODE_CHANGED")]
    pub fn mode_changed() -> String {
        "ModeChanged".to_string()
    }
    
    #[wasm_bindgen(js_name = "COMMAND_EXECUTED")]
    pub fn command_executed() -> String {
        "CommandExecuted".to_string()
    }
}

#[wasm_bindgen]
pub struct MouseButtons;

#[wasm_bindgen]
impl MouseButtons {
    #[wasm_bindgen(js_name = "LEFT")]
    pub fn left() -> String {
        "left".to_string()
    }
    
    #[wasm_bindgen(js_name = "MIDDLE")]
    pub fn middle() -> String {
        "middle".to_string()
    }
    
    #[wasm_bindgen(js_name = "RIGHT")]
    pub fn right() -> String {
        "right".to_string()
    }
    
    #[wasm_bindgen(js_name = "NONE")]
    pub fn none() -> String {
        "none".to_string()
    }
}

#[wasm_bindgen]
pub struct MouseEventTypes;

#[wasm_bindgen]
impl MouseEventTypes {
    #[wasm_bindgen(js_name = "DOWN")]
    pub fn down() -> String {
        "down".to_string()
    }
    
    #[wasm_bindgen(js_name = "UP")]
    pub fn up() -> String {
        "up".to_string()
    }
    
    #[wasm_bindgen(js_name = "MOVE")]
    pub fn move_event() -> String {
        "move".to_string()
    }
    
    #[wasm_bindgen(js_name = "CLICK")]
    pub fn click() -> String {
        "click".to_string()
    }
    
    #[wasm_bindgen(js_name = "DOUBLE_CLICK")]
    pub fn double_click() -> String {
        "doubleclick".to_string()
    }
    
    #[wasm_bindgen(js_name = "WHEEL")]
    pub fn wheel() -> String {
        "wheel".to_string()
    }
}