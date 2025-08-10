//! Event adapter implementation
//!
//! Adapts the existing EventManager to implement the EventPort trait.

use crate::Result;
use crate::ports::EventPort;
use crate::ports::event_port::{DomainEvent, EventHandler};
use crate::services::{EventManager, SpreadsheetEvent};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// Adapter that wraps EventManager to implement EventPort
pub struct EventAdapter {
    event_manager: Arc<EventManager>,
    handlers: Arc<Mutex<HashMap<String, EventHandler>>>,
    next_handler_id: Arc<Mutex<u64>>,
}

impl EventAdapter {
    /// Create a new event adapter
    pub fn new(event_manager: Arc<EventManager>) -> Self {
        Self {
            event_manager,
            handlers: Arc::new(Mutex::new(HashMap::new())),
            next_handler_id: Arc::new(Mutex::new(0)),
        }
    }

    /// Create a new event adapter with a fresh event manager
    pub fn new_empty() -> Self {
        Self::new(Arc::new(EventManager::new()))
    }

    /// Convert a domain event to a spreadsheet event
    fn domain_to_spreadsheet_event(event: &DomainEvent) -> SpreadsheetEvent {
        match event {
            DomainEvent::CellChanged {
                address,
                old_value,
                new_value,
            } => {
                SpreadsheetEvent::cell_updated(address, old_value.clone(), new_value.clone(), None)
            }
            DomainEvent::CellDeleted { address, .. } => SpreadsheetEvent::cell_deleted(address),
            DomainEvent::RowInserted { index } => {
                SpreadsheetEvent::error(format!("Row {} inserted", index), None)
            }
            DomainEvent::RowDeleted { index } => {
                SpreadsheetEvent::error(format!("Row {} deleted", index), None)
            }
            DomainEvent::ColumnInserted { index } => {
                SpreadsheetEvent::error(format!("Column {} inserted", index), None)
            }
            DomainEvent::ColumnDeleted { index } => {
                SpreadsheetEvent::error(format!("Column {} deleted", index), None)
            }
            DomainEvent::BatchStarted { batch_id } => {
                SpreadsheetEvent::batch_started(batch_id.clone())
            }
            DomainEvent::BatchCommitted { batch_id } => {
                SpreadsheetEvent::batch_completed(batch_id.clone(), 0)
            }
            DomainEvent::BatchRolledBack { batch_id } => {
                SpreadsheetEvent::batch_completed(batch_id.clone(), 0)
            }
            DomainEvent::CalculationCompleted { affected_cells } => {
                let cell_strings: Vec<String> =
                    affected_cells.iter().map(|addr| addr.to_string()).collect();
                SpreadsheetEvent::calculation_completed(cell_strings, 0)
            }
        }
    }
}

impl EventPort for EventAdapter {
    fn publish(&self, event: DomainEvent) -> Result<()> {
        // Convert domain event to spreadsheet event and emit
        let spreadsheet_event = Self::domain_to_spreadsheet_event(&event);
        self.event_manager.emit(spreadsheet_event);

        // Also call registered handlers directly
        if let Ok(handlers) = self.handlers.lock() {
            for handler in handlers.values() {
                handler(&event);
            }
        }

        Ok(())
    }

    fn subscribe(&mut self, handler: EventHandler) -> Result<String> {
        let handler_id = {
            let mut id_counter = self.next_handler_id.lock().map_err(|_| {
                crate::SpreadsheetError::InvalidOperation(
                    "Failed to lock handler ID counter".to_string(),
                )
            })?;
            *id_counter += 1;
            format!("handler_{}", *id_counter)
        };

        if let Ok(mut handlers) = self.handlers.lock() {
            handlers.insert(handler_id.clone(), handler);
        }

        Ok(handler_id)
    }

    fn unsubscribe(&mut self, handler_id: &str) -> Result<()> {
        if let Ok(mut handlers) = self.handlers.lock() {
            handlers.remove(handler_id);
        }
        Ok(())
    }

    fn clear_subscriptions(&mut self) {
        if let Ok(mut handlers) = self.handlers.lock() {
            handlers.clear();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{CellAddress, CellValue};
    use std::sync::atomic::{AtomicUsize, Ordering};

    #[test]
    fn test_event_adapter_publish() {
        let adapter = EventAdapter::new_empty();
        let event = DomainEvent::CellChanged {
            address: CellAddress::new(0, 0),
            old_value: None,
            new_value: CellValue::Number(42.0),
        };

        assert!(adapter.publish(event).is_ok());
    }

    #[test]
    fn test_event_adapter_subscribe_and_publish() {
        let mut adapter = EventAdapter::new_empty();
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

        // Publish another event
        let event2 = DomainEvent::CellDeleted {
            address: CellAddress::new(0, 0),
            old_value: CellValue::Number(42.0),
        };
        adapter.publish(event2).unwrap();

        // Handler should not have been called again
        assert_eq!(counter.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn test_event_adapter_clear_subscriptions() {
        let mut adapter = EventAdapter::new_empty();
        let counter = Arc::new(AtomicUsize::new(0));

        // Add multiple handlers
        for _ in 0..3 {
            let counter_clone = counter.clone();
            let handler = Box::new(move |_event: &DomainEvent| {
                counter_clone.fetch_add(1, Ordering::SeqCst);
            });
            adapter.subscribe(handler).unwrap();
        }

        // Publish an event
        let event = DomainEvent::CellChanged {
            address: CellAddress::new(0, 0),
            old_value: None,
            new_value: CellValue::Number(42.0),
        };
        adapter.publish(event.clone()).unwrap();
        assert_eq!(counter.load(Ordering::SeqCst), 3);

        // Clear all subscriptions
        adapter.clear_subscriptions();

        // Publish another event
        adapter.publish(event).unwrap();

        // No handlers should have been called
        assert_eq!(counter.load(Ordering::SeqCst), 3);
    }
}
