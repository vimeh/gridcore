use gridcore_core::types::CellAddress;
use serde::{Deserialize, Serialize};

/// Simplified events - reduced from 27 to 10 core event types
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum SpreadsheetEvent {
    // Navigation & UI state
    CursorMoved {
        from: CellAddress,
        to: CellAddress,
    },
    StateChanged,

    // Cell editing with unified state
    CellEditCompleted {
        address: CellAddress,
        value: String,
    },

    // Formula bar
    FormulaBarUpdated {
        value: String,
    },

    // Command execution
    CommandExecuted {
        command: String,
    },

    // Sheet operations (consolidated)
    SheetChanged {
        from: String,
        to: String,
    },
    SheetAdded {
        name: String,
    },
    SheetRemoved {
        name: String,
    },
    SheetRenamed {
        old_name: String,
        new_name: String,
    },

    // Error handling
    ErrorOccurred {
        message: String,
        severity: ErrorSeverity,
    },
}

/// Error severity levels
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ErrorSeverity {
    Error,
    Warning,
    Info,
}

/// Keyboard event representation
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct KeyboardEvent {
    pub key: String,
    pub code: String,
    pub shift: bool,
    pub ctrl: bool,
    pub alt: bool,
    pub meta: bool,
}

impl KeyboardEvent {
    pub fn new(key: String) -> Self {
        Self {
            key,
            code: String::new(),
            shift: false,
            ctrl: false,
            alt: false,
            meta: false,
        }
    }

    pub fn with_modifiers(mut self, shift: bool, ctrl: bool, alt: bool, meta: bool) -> Self {
        self.shift = shift;
        self.ctrl = ctrl;
        self.alt = alt;
        self.meta = meta;
        self
    }

    /// Check if this is a printable character
    pub fn is_printable(&self) -> bool {
        self.key.len() == 1 && !self.ctrl && !self.alt && !self.meta
    }

    /// Check if this is a navigation key
    pub fn is_navigation(&self) -> bool {
        matches!(
            self.key.as_str(),
            "ArrowUp"
                | "ArrowDown"
                | "ArrowLeft"
                | "ArrowRight"
                | "Home"
                | "End"
                | "PageUp"
                | "PageDown"
        )
    }

    /// Convert to vim-style key notation
    pub fn to_vim_notation(&self) -> String {
        let mut result = String::new();

        if self.ctrl {
            result.push_str("C-");
        }
        if self.alt {
            result.push_str("A-");
        }
        if self.meta {
            result.push_str("M-");
        }

        // Map special keys
        let key_str = match self.key.as_str() {
            "ArrowUp" => "Up",
            "ArrowDown" => "Down",
            "ArrowLeft" => "Left",
            "ArrowRight" => "Right",
            "Escape" => "Esc",
            "Enter" => "CR",
            "Tab" => "Tab",
            "Backspace" => "BS",
            "Delete" => "Del",
            " " => "Space",
            key if key.len() == 1 && self.shift => {
                // Handle shifted characters
                &key.to_uppercase()
            }
            key => key,
        };

        result.push_str(key_str);
        result
    }
}

/// Mouse event representation
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MouseEvent {
    pub x: f64,
    pub y: f64,
    pub button: MouseButton,
    pub event_type: MouseEventType,
    pub shift: bool,
    pub ctrl: bool,
    pub alt: bool,
    pub meta: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MouseButton {
    Left,
    Middle,
    Right,
    None,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MouseEventType {
    Down,
    Up,
    Move,
    Click,
    DoubleClick,
    Wheel,
}

impl MouseEvent {
    pub fn new(x: f64, y: f64, button: MouseButton, event_type: MouseEventType) -> Self {
        Self {
            x,
            y,
            button,
            event_type,
            shift: false,
            ctrl: false,
            alt: false,
            meta: false,
        }
    }

    pub fn with_modifiers(mut self, shift: bool, ctrl: bool, alt: bool, meta: bool) -> Self {
        self.shift = shift;
        self.ctrl = ctrl;
        self.alt = alt;
        self.meta = meta;
        self
    }
}

/// Type alias for event listener functions
type EventListener = Box<dyn Fn(&SpreadsheetEvent) + Send>;

/// Type alias for cell callback function
type CellCallback = Box<dyn Fn(&CellAddress, &str)>;

/// Type alias for error callback function
type ErrorCallback = Box<dyn Fn(&str, ErrorSeverity)>;

/// Simplified event dispatcher with direct callbacks for common events
pub struct EventDispatcher {
    listeners: Vec<EventListener>,
    // Direct callbacks for high-frequency events
    state_callback: Option<Box<dyn Fn()>>,
    cell_callback: Option<CellCallback>,
    error_callback: Option<ErrorCallback>,
}

impl EventDispatcher {
    pub fn new() -> Self {
        Self {
            listeners: Vec::new(),
            state_callback: None,
            cell_callback: None,
            error_callback: None,
        }
    }

    pub fn subscribe<F>(&mut self, listener: F) -> usize
    where
        F: Fn(&SpreadsheetEvent) + Send + 'static,
    {
        self.listeners.push(Box::new(listener));
        self.listeners.len() - 1
    }

    pub fn unsubscribe(&mut self, index: usize) {
        if index < self.listeners.len() {
            let _ = self.listeners.remove(index);
        }
    }

    pub fn dispatch(&self, event: &SpreadsheetEvent) {
        // Call direct callbacks for common events
        match event {
            SpreadsheetEvent::StateChanged => {
                if let Some(ref callback) = self.state_callback {
                    callback();
                }
            }
            SpreadsheetEvent::CellEditCompleted { address, value } => {
                if let Some(ref callback) = self.cell_callback {
                    callback(address, value);
                }
            }
            SpreadsheetEvent::ErrorOccurred { message, severity } => {
                if let Some(ref callback) = self.error_callback {
                    callback(message, *severity);
                }
            }
            _ => {}
        }

        // Also dispatch to generic listeners
        for listener in &self.listeners {
            listener(event);
        }
    }

    /// Set direct callback for state changes (avoids event allocation)
    pub fn on_state_change<F>(&mut self, callback: F)
    where
        F: Fn() + 'static,
    {
        self.state_callback = Some(Box::new(callback));
    }

    /// Set direct callback for cell edits (avoids event allocation)
    pub fn on_cell_edit<F>(&mut self, callback: F)
    where
        F: Fn(&CellAddress, &str) + 'static,
    {
        self.cell_callback = Some(Box::new(callback));
    }

    /// Set direct callback for errors (avoids event allocation)
    pub fn on_error<F>(&mut self, callback: F)
    where
        F: Fn(&str, ErrorSeverity) + 'static,
    {
        self.error_callback = Some(Box::new(callback));
    }

    /// Direct notification methods for high-frequency events
    pub fn notify_state_change(&self) {
        if let Some(ref callback) = self.state_callback {
            callback();
        }
        // Also dispatch as event for compatibility
        self.dispatch(&SpreadsheetEvent::StateChanged);
    }

    pub fn notify_cell_edit(&self, address: &CellAddress, value: &str) {
        if let Some(ref callback) = self.cell_callback {
            callback(address, value);
        }
        // Also dispatch as event for compatibility
        self.dispatch(&SpreadsheetEvent::CellEditCompleted {
            address: *address,
            value: value.to_string(),
        });
    }

    pub fn notify_error(&self, message: &str, severity: ErrorSeverity) {
        if let Some(ref callback) = self.error_callback {
            callback(message, severity);
        }
        // Also dispatch as event for compatibility
        self.dispatch(&SpreadsheetEvent::ErrorOccurred {
            message: message.to_string(),
            severity,
        });
    }

    pub fn clear(&mut self) {
        self.listeners.clear();
        self.state_callback = None;
        self.cell_callback = None;
        self.error_callback = None;
    }
}

impl Default for EventDispatcher {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_keyboard_event() {
        let event = KeyboardEvent::new("a".to_string());
        assert!(event.is_printable());
        assert!(!event.is_navigation());
        assert_eq!(event.to_vim_notation(), "a");

        let ctrl_a = KeyboardEvent::new("a".to_string()).with_modifiers(false, true, false, false);
        assert!(!ctrl_a.is_printable());
        assert_eq!(ctrl_a.to_vim_notation(), "C-a");

        let arrow = KeyboardEvent::new("ArrowUp".to_string());
        assert!(arrow.is_navigation());
        assert_eq!(arrow.to_vim_notation(), "Up");
    }

    #[test]
    fn test_event_dispatcher() {
        use std::sync::{Arc, Mutex};

        let mut dispatcher = EventDispatcher::new();
        let received = Arc::new(Mutex::new(Vec::new()));
        let received_clone = received.clone();

        dispatcher.subscribe(move |event| {
            let mut events = received_clone
                .lock()
                .expect("Test mutex should not be poisoned");
            events.push(format!("{:?}", event));
        });

        dispatcher.dispatch(&SpreadsheetEvent::CursorMoved {
            from: CellAddress::new(0, 0),
            to: CellAddress::new(1, 1),
        });

        let events = received.lock().expect("Test mutex should not be poisoned");
        assert_eq!(events.len(), 1);
    }
}
