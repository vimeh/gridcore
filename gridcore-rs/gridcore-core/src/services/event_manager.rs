use crate::facade::{EventCallback, SpreadsheetEvent};
use std::rc::Rc;
use std::sync::{Arc, RwLock};

/// Thread-safe callback function type
pub type ThreadSafeCallback = Arc<dyn Fn(&str) + Send + Sync>;

/// Manages event callbacks and event emission for the spreadsheet
pub struct EventManager {
    callbacks: RwLock<Vec<Box<dyn EventCallback>>>,
    thread_safe_callbacks: RwLock<Vec<(usize, ThreadSafeCallback)>>,
    next_id: RwLock<usize>,
}

impl EventManager {
    /// Create a new event manager
    pub fn new() -> Self {
        EventManager {
            callbacks: RwLock::new(Vec::new()),
            thread_safe_callbacks: RwLock::new(Vec::new()),
            next_id: RwLock::new(0),
        }
    }

    /// Add an event callback
    pub fn add_callback(&self, callback: Box<dyn EventCallback>) {
        if let Ok(mut callbacks) = self.callbacks.write() {
            callbacks.push(callback);
        }
    }

    /// Subscribe with a thread-safe callback
    pub fn subscribe(&self, callback: Box<dyn Fn(&str) + Send + Sync>) -> usize {
        let mut callbacks = self
            .thread_safe_callbacks
            .write()
            .unwrap_or_else(|e| e.into_inner());
        let mut next_id = self.next_id.write().unwrap_or_else(|e| e.into_inner());

        let id = *next_id;
        *next_id += 1;

        callbacks.push((id, Arc::from(callback)));
        id
    }

    /// Unsubscribe a thread-safe callback
    pub fn unsubscribe(&self, id: usize) {
        if let Ok(mut callbacks) = self.thread_safe_callbacks.write() {
            callbacks.retain(|(callback_id, _)| *callback_id != id);
        }
    }

    /// Remove all callbacks
    pub fn clear_callbacks(&self) {
        if let Ok(mut callbacks) = self.callbacks.write() {
            callbacks.clear();
        }
        if let Ok(mut callbacks) = self.thread_safe_callbacks.write() {
            callbacks.clear();
        }
    }

    /// Emit an event to all registered callbacks
    pub fn emit(&self, event: SpreadsheetEvent) {
        if let Ok(callbacks) = self.callbacks.read() {
            for callback in callbacks.iter() {
                callback.on_event(&event);
            }
        }

        // Also emit to thread-safe callbacks as string
        let event_str = format!("{:?}", event);
        self.emit_raw(&event_str);
    }

    /// Emit a raw string event to thread-safe callbacks
    pub fn emit_raw(&self, event: &str) {
        if let Ok(callbacks) = self.thread_safe_callbacks.read() {
            for (_, callback) in callbacks.iter() {
                callback(event);
            }
        }
    }

    /// Get the number of registered callbacks
    pub fn callback_count(&self) -> usize {
        let regular = self.callbacks.read().map(|c| c.len()).unwrap_or(0);
        let thread_safe = self
            .thread_safe_callbacks
            .read()
            .map(|c| c.len())
            .unwrap_or(0);
        regular + thread_safe
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
    use std::sync::{Arc, Mutex};

    struct TestCallback {
        events: Arc<Mutex<Vec<SpreadsheetEvent>>>,
    }

    impl EventCallback for TestCallback {
        fn on_event(&self, event: &SpreadsheetEvent) {
            self.events.lock().unwrap().push(event.clone());
        }
    }

    #[test]
    fn test_event_manager_basic() {
        let manager = EventManager::new();
        let events = Arc::new(Mutex::new(Vec::new()));

        let callback = Box::new(TestCallback {
            events: events.clone(),
        });

        manager.add_callback(callback);
        assert_eq!(manager.callback_count(), 1);

        manager.emit(SpreadsheetEvent::cell_updated(
            &crate::types::CellAddress::new(0, 0),
            None,
            crate::types::CellValue::Number(42.0),
            None,
        ));

        assert_eq!(events.lock().unwrap().len(), 1);
    }

    #[test]
    fn test_event_manager_multiple_callbacks() {
        let manager = EventManager::new();
        let events1 = Arc::new(Mutex::new(Vec::new()));
        let events2 = Arc::new(Mutex::new(Vec::new()));

        manager.add_callback(Box::new(TestCallback {
            events: events1.clone(),
        }));
        manager.add_callback(Box::new(TestCallback {
            events: events2.clone(),
        }));

        assert_eq!(manager.callback_count(), 2);

        manager.emit(SpreadsheetEvent::batch_started("test".to_string()));

        assert_eq!(events1.lock().unwrap().len(), 1);
        assert_eq!(events2.lock().unwrap().len(), 1);
    }

    #[test]
    fn test_event_manager_clear() {
        let manager = EventManager::new();

        manager.add_callback(Box::new(TestCallback {
            events: Arc::new(Mutex::new(Vec::new())),
        }));

        assert_eq!(manager.callback_count(), 1);

        manager.clear_callbacks();
        assert_eq!(manager.callback_count(), 0);
    }
}
