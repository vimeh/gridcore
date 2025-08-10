//! Thread-safe event adapter implementation
//!
//! This version wraps the EventAdapter in Arc<Mutex<>> to allow
//! shared ownership while still supporting mutable operations.

use crate::adapters::EventAdapter;
use crate::ports::event_port::{DomainEvent, EventHandler};
use crate::ports::EventPort;
use crate::services::EventManager;
use crate::Result;
use std::sync::{Arc, Mutex};

/// Thread-safe wrapper around EventAdapter
pub struct ThreadSafeEventAdapter {
    inner: Arc<Mutex<EventAdapter>>,
}

impl ThreadSafeEventAdapter {
    /// Create a new thread-safe event adapter
    pub fn new(event_manager: Arc<EventManager>) -> Self {
        Self {
            inner: Arc::new(Mutex::new(EventAdapter::new(event_manager))),
        }
    }
    
    /// Create a new thread-safe event adapter with a fresh event manager
    pub fn new_empty() -> Self {
        Self {
            inner: Arc::new(Mutex::new(EventAdapter::new_empty())),
        }
    }
}

impl EventPort for ThreadSafeEventAdapter {
    fn publish(&self, event: DomainEvent) -> Result<()> {
        self.inner
            .lock()
            .map_err(|_| crate::SpreadsheetError::LockError("Failed to lock event adapter".to_string()))?
            .publish(event)
    }
    
    fn subscribe(&mut self, handler: EventHandler) -> Result<String> {
        self.inner
            .lock()
            .map_err(|_| crate::SpreadsheetError::LockError("Failed to lock event adapter".to_string()))?
            .subscribe(handler)
    }
    
    fn unsubscribe(&mut self, handler_id: &str) -> Result<()> {
        self.inner
            .lock()
            .map_err(|_| crate::SpreadsheetError::LockError("Failed to lock event adapter".to_string()))?
            .unsubscribe(handler_id)
    }
    
    fn clear_subscriptions(&mut self) {
        if let Ok(mut adapter) = self.inner.lock() {
            adapter.clear_subscriptions();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{CellAddress, CellValue};
    use std::sync::atomic::{AtomicUsize, Ordering};
    
    #[test]
    fn test_thread_safe_event_adapter() {
        let mut adapter = ThreadSafeEventAdapter::new_empty();
        let counter = Arc::new(AtomicUsize::new(0));
        let counter_clone = counter.clone();
        
        let handler = Box::new(move |_event: &DomainEvent| {
            counter_clone.fetch_add(1, Ordering::SeqCst);
        });
        
        let handler_id = adapter.subscribe(handler).unwrap();
        
        // Publish an event
        let event = DomainEvent::CellChanged {
            address: CellAddress::new(0, 0),
            old_value: None,
            new_value: CellValue::Number(42.0),
        };
        adapter.publish(event).unwrap();
        
        // Check handler was called
        assert_eq!(counter.load(Ordering::SeqCst), 1);
        
        // Unsubscribe
        adapter.unsubscribe(&handler_id).unwrap();
    }
}