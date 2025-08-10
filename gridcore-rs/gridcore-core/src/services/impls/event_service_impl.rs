//! Implementation of EventService trait

use crate::services::EventManager;
use crate::traits::EventService;
use std::sync::Arc;

/// Concrete implementation of EventService
pub struct EventServiceImpl {
    event_manager: Arc<EventManager>,
}

impl EventServiceImpl {
    /// Create a new EventServiceImpl
    pub fn new(event_manager: Arc<EventManager>) -> Self {
        Self { event_manager }
    }
}

impl EventService for EventServiceImpl {
    fn subscribe(&self, callback: Box<dyn Fn(&str) + Send + Sync>) -> usize {
        self.event_manager.subscribe(callback)
    }

    fn unsubscribe(&self, id: usize) {
        self.event_manager.unsubscribe(id);
    }

    fn emit(&self, event: &str) {
        self.event_manager.emit_raw(event);
    }
}
