use gridcore_core::types::CellAddress;
use serde::{Deserialize, Serialize};

/// Events that can occur in the spreadsheet
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum SpreadsheetEvent {
    // Navigation events
    CursorMoved {
        from: CellAddress,
        to: CellAddress,
    },
    ViewportChanged {
        start_row: u32,
        start_col: u32,
        rows: u32,
        cols: u32,
    },

    // Cell events
    CellEditStarted {
        address: CellAddress,
    },
    CellEditCompleted {
        address: CellAddress,
        value: String,
    },
    CellEditCancelled {
        address: CellAddress,
    },

    // Selection events
    SelectionChanged {
        selection: crate::state::Selection,
    },
    RangeSelected {
        start: CellAddress,
        end: CellAddress,
    },

    // State changes
    StateChanged,

    // Command events
    CommandExecuted {
        command: String,
    },
    CommandCancelled,

    // Structural events
    RowsInserted {
        index: u32,
        count: u32,
    },
    RowsDeleted {
        indices: Vec<u32>,
    },
    ColumnsInserted {
        index: u32,
        count: u32,
    },
    ColumnsDeleted {
        indices: Vec<u32>,
    },

    // Resize events
    ColumnResized {
        index: u32,
        new_width: u32,
    },
    RowResized {
        index: u32,
        new_height: u32,
    },

    // Copy/paste events
    CellsCopied {
        selection: crate::state::Selection,
    },
    CellsCut {
        selection: crate::state::Selection,
    },
    CellsPasted {
        target: CellAddress,
    },

    // Undo/redo events
    UndoPerformed,
    RedoPerformed,

    // File events
    FileSaved {
        path: String,
    },
    FileLoaded {
        path: String,
    },

    // Formula bar events
    FormulaBarUpdated {
        value: String,
    },

    // Sheet events
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
    SheetChanged {
        from: String,
        to: String,
    },

    // Error events
    ErrorOccurred {
        message: String,
        severity: ErrorSeverity,
    },
    ErrorDismissed {
        id: usize,
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

/// Event dispatcher for handling events
pub struct EventDispatcher {
    listeners: Vec<EventListener>,
}

impl EventDispatcher {
    pub fn new() -> Self {
        Self {
            listeners: Vec::new(),
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
        for listener in &self.listeners {
            listener(event);
        }
    }

    pub fn clear(&mut self) {
        self.listeners.clear();
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
