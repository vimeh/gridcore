use crate::controller::SpreadsheetEvent;
use gridcore_core::types::CellAddress;

/// Manages the formula bar state and operations
pub struct FormulaBarManager {
    value: String,
}

impl FormulaBarManager {
    pub fn new() -> Self {
        Self {
            value: String::new(),
        }
    }

    /// Get the current formula bar value
    pub fn value(&self) -> &str {
        &self.value
    }

    /// Set the formula bar value
    pub fn set_value(&mut self, value: String) -> String {
        self.value = value.clone();
        value
    }

    /// Clear the formula bar
    pub fn clear(&mut self) {
        self.value.clear();
    }

    /// Update formula bar from cell content
    pub fn update_from_cell<F>(&mut self, address: &CellAddress, get_display_value: F) -> String
    where
        F: FnOnce(&CellAddress) -> String,
    {
        let value = get_display_value(address);
        self.value = value.clone();
        value
    }

    /// Create FormulaBarUpdated event
    pub fn create_update_event(&self) -> SpreadsheetEvent {
        SpreadsheetEvent::FormulaBarUpdated {
            value: self.value.clone(),
        }
    }
}

impl Default for FormulaBarManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Helper for managing formula bar operations within SpreadsheetController
pub struct FormulaBarOperations<'a> {
    manager: &'a mut FormulaBarManager,
    event_callback: Option<Box<dyn FnOnce(SpreadsheetEvent) + 'a>>,
}

impl<'a> FormulaBarOperations<'a> {
    pub fn new(manager: &'a mut FormulaBarManager) -> Self {
        Self {
            manager,
            event_callback: None,
        }
    }

    /// Set event callback for dispatching events
    pub fn with_event_callback<F>(mut self, callback: F) -> Self
    where
        F: FnOnce(SpreadsheetEvent) + 'a,
    {
        self.event_callback = Some(Box::new(callback));
        self
    }

    /// Get current value
    pub fn value(&self) -> &str {
        self.manager.value()
    }

    /// Set value and dispatch event if callback provided
    pub fn set_value(&mut self, value: String) {
        self.manager.set_value(value);
        if let Some(callback) = self.event_callback.take() {
            callback(self.manager.create_update_event());
        }
    }

    /// Clear formula bar
    pub fn clear(&mut self) {
        self.set_value(String::new());
    }

    /// Update from cell and dispatch event if callback provided
    pub fn update_from_cell<F>(&mut self, address: &CellAddress, get_display_value: F)
    where
        F: FnOnce(&CellAddress) -> String,
    {
        let value = self.manager.update_from_cell(address, get_display_value);
        if let Some(callback) = self.event_callback.take() {
            callback(SpreadsheetEvent::FormulaBarUpdated { value });
        }
    }
}