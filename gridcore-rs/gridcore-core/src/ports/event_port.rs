//! Event port interface for event handling
//!
//! This trait defines the contract for event publishing and subscription,
//! allowing the application layer to emit events without depending on
//! concrete event infrastructure.

use crate::types::{CellAddress, CellValue};
use crate::Result;
use std::fmt::Debug;

/// Types of events that can be emitted
#[derive(Debug, Clone)]
pub enum DomainEvent {
    /// Cell value changed
    CellChanged {
        address: CellAddress,
        old_value: Option<CellValue>,
        new_value: CellValue,
    },
    /// Cell deleted
    CellDeleted {
        address: CellAddress,
        old_value: CellValue,
    },
    /// Row inserted
    RowInserted {
        index: u32,
    },
    /// Row deleted
    RowDeleted {
        index: u32,
    },
    /// Column inserted
    ColumnInserted {
        index: u32,
    },
    /// Column deleted  
    ColumnDeleted {
        index: u32,
    },
    /// Batch operation started
    BatchStarted {
        batch_id: String,
    },
    /// Batch operation committed
    BatchCommitted {
        batch_id: String,
    },
    /// Batch operation rolled back
    BatchRolledBack {
        batch_id: String,
    },
    /// Calculation completed
    CalculationCompleted {
        affected_cells: Vec<CellAddress>,
    },
}

/// Event handler callback type
pub type EventHandler = Box<dyn Fn(&DomainEvent) + Send + Sync>;

/// Port interface for event operations
pub trait EventPort: Send + Sync {
    /// Publish an event
    fn publish(&self, event: DomainEvent) -> Result<()>;
    
    /// Subscribe to events with a handler
    fn subscribe(&mut self, handler: EventHandler) -> Result<String>;
    
    /// Unsubscribe a handler
    fn unsubscribe(&mut self, handler_id: &str) -> Result<()>;
    
    /// Clear all subscriptions
    fn clear_subscriptions(&mut self);
}