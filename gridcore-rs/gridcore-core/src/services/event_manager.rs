use crate::facade::{EventCallback, SpreadsheetEvent};
use std::cell::RefCell;
use std::rc::Rc;

/// Manages event callbacks and event emission for the spreadsheet
pub struct EventManager {
    callbacks: RefCell<Vec<Box<dyn EventCallback>>>,
}

impl EventManager {
    /// Create a new event manager
    pub fn new() -> Self {
        EventManager {
            callbacks: RefCell::new(Vec::new()),
        }
    }

    /// Add an event callback
    pub fn add_callback(&self, callback: Box<dyn EventCallback>) {
        self.callbacks.borrow_mut().push(callback);
    }

    /// Remove all callbacks
    pub fn clear_callbacks(&self) {
        self.callbacks.borrow_mut().clear();
    }

    /// Emit an event to all registered callbacks
    pub fn emit(&self, event: SpreadsheetEvent) {
        for callback in self.callbacks.borrow().iter() {
            callback.on_event(&event);
        }
    }

    /// Get the number of registered callbacks
    pub fn callback_count(&self) -> usize {
        self.callbacks.borrow().len()
    }
}

impl Default for EventManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Helper to create a shared EventManager
pub fn create_shared_event_manager() -> Rc<EventManager> {
    Rc::new(EventManager::new())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    use std::rc::Rc;

    struct TestCallback {
        events: Rc<RefCell<Vec<SpreadsheetEvent>>>,
    }

    impl EventCallback for TestCallback {
        fn on_event(&self, event: &SpreadsheetEvent) {
            self.events.borrow_mut().push(event.clone());
        }
    }

    #[test]
    fn test_event_manager_basic() {
        let manager = EventManager::new();
        let events = Rc::new(RefCell::new(Vec::new()));

        let callback = Box::new(TestCallback {
            events: events.clone(),
        });

        manager.add_callback(callback);
        assert_eq!(manager.callback_count(), 1);

        manager.emit(SpreadsheetEvent::CellUpdated {
            address: crate::types::CellAddress::new(0, 0),
            old_value: None,
            new_value: crate::types::CellValue::Number(42.0),
        });

        assert_eq!(events.borrow().len(), 1);
    }

    #[test]
    fn test_event_manager_multiple_callbacks() {
        let manager = EventManager::new();
        let events1 = Rc::new(RefCell::new(Vec::new()));
        let events2 = Rc::new(RefCell::new(Vec::new()));

        manager.add_callback(Box::new(TestCallback {
            events: events1.clone(),
        }));
        manager.add_callback(Box::new(TestCallback {
            events: events2.clone(),
        }));

        assert_eq!(manager.callback_count(), 2);

        manager.emit(SpreadsheetEvent::BatchStarted {
            batch_id: "test".to_string(),
        });

        assert_eq!(events1.borrow().len(), 1);
        assert_eq!(events2.borrow().len(), 1);
    }

    #[test]
    fn test_event_manager_clear() {
        let manager = EventManager::new();
        
        manager.add_callback(Box::new(TestCallback {
            events: Rc::new(RefCell::new(Vec::new())),
        }));

        assert_eq!(manager.callback_count(), 1);
        
        manager.clear_callbacks();
        assert_eq!(manager.callback_count(), 0);
    }
}