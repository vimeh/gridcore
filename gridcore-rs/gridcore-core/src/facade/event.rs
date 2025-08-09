use crate::types::{CellAddress, CellValue};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Types of events that can occur in the spreadsheet
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum EventType {
    CellUpdated,
    CellsUpdated,
    RangeUpdated,
    CellDeleted,
    CalculationStarted,
    CalculationCompleted,
    BatchStarted,
    BatchCompleted,
    Error,
}

/// Event data for spreadsheet events
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpreadsheetEvent {
    pub event_type: EventType,
    pub timestamp: u64,
    pub data: EventData,
}

/// Specific data for different event types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum EventData {
    CellUpdate {
        address: String,
        old_value: Option<CellValue>,
        new_value: CellValue,
        formula: Option<String>,
    },
    CellsUpdate {
        cells: HashMap<String, CellValue>,
        count: usize,
    },
    RangeUpdate {
        start_address: String,
        end_address: String,
        affected_cells: usize,
    },
    CellDelete {
        address: String,
    },
    Calculation {
        affected_cells: Vec<String>,
        duration_ms: Option<u64>,
    },
    Batch {
        batch_id: String,
        operation_count: usize,
    },
    Error {
        message: String,
        address: Option<String>,
    },
}

impl SpreadsheetEvent {
    /// Create a cell updated event
    pub fn cell_updated(
        address: &CellAddress,
        old_value: Option<CellValue>,
        new_value: CellValue,
        formula: Option<String>,
    ) -> Self {
        SpreadsheetEvent {
            event_type: EventType::CellUpdated,
            timestamp: Self::current_timestamp(),
            data: EventData::CellUpdate {
                address: address.to_string(),
                old_value,
                new_value,
                formula,
            },
        }
    }

    /// Create a cells updated event
    pub fn cells_updated(cells: HashMap<String, CellValue>) -> Self {
        let count = cells.len();
        SpreadsheetEvent {
            event_type: EventType::CellsUpdated,
            timestamp: Self::current_timestamp(),
            data: EventData::CellsUpdate { cells, count },
        }
    }

    /// Create a range updated event
    pub fn range_updated(start: &CellAddress, end: &CellAddress, affected_cells: usize) -> Self {
        SpreadsheetEvent {
            event_type: EventType::RangeUpdated,
            timestamp: Self::current_timestamp(),
            data: EventData::RangeUpdate {
                start_address: start.to_string(),
                end_address: end.to_string(),
                affected_cells,
            },
        }
    }

    /// Create a cell deleted event
    pub fn cell_deleted(address: &CellAddress) -> Self {
        SpreadsheetEvent {
            event_type: EventType::CellDeleted,
            timestamp: Self::current_timestamp(),
            data: EventData::CellDelete {
                address: address.to_string(),
            },
        }
    }

    /// Create a calculation started event
    pub fn calculation_started(affected_cells: Vec<String>) -> Self {
        SpreadsheetEvent {
            event_type: EventType::CalculationStarted,
            timestamp: Self::current_timestamp(),
            data: EventData::Calculation {
                affected_cells,
                duration_ms: None,
            },
        }
    }

    /// Create a calculation completed event
    pub fn calculation_completed(affected_cells: Vec<String>, duration_ms: u64) -> Self {
        SpreadsheetEvent {
            event_type: EventType::CalculationCompleted,
            timestamp: Self::current_timestamp(),
            data: EventData::Calculation {
                affected_cells,
                duration_ms: Some(duration_ms),
            },
        }
    }

    /// Create a batch started event
    pub fn batch_started(batch_id: String) -> Self {
        SpreadsheetEvent {
            event_type: EventType::BatchStarted,
            timestamp: Self::current_timestamp(),
            data: EventData::Batch {
                batch_id,
                operation_count: 0,
            },
        }
    }

    /// Create a batch completed event
    pub fn batch_completed(batch_id: String, operation_count: usize) -> Self {
        SpreadsheetEvent {
            event_type: EventType::BatchCompleted,
            timestamp: Self::current_timestamp(),
            data: EventData::Batch {
                batch_id,
                operation_count,
            },
        }
    }

    /// Create an error event
    pub fn error(message: String, address: Option<&CellAddress>) -> Self {
        SpreadsheetEvent {
            event_type: EventType::Error,
            timestamp: Self::current_timestamp(),
            data: EventData::Error {
                message,
                address: address.map(|a| a.to_string()),
            },
        }
    }

    /// Get current timestamp in milliseconds
    fn current_timestamp() -> u64 {
        // In a real implementation, this would use system time
        // For now, return a placeholder
        0
    }
}

/// Trait for handling spreadsheet events
pub trait EventCallback: Send + Sync {
    fn on_event(&self, event: &SpreadsheetEvent);
}

/// Simple event callback implementation for testing
#[derive(Debug, Clone, Default)]
pub struct EventCollector {
    events: std::sync::Arc<std::sync::Mutex<Vec<SpreadsheetEvent>>>,
}

impl EventCollector {
    pub fn new() -> Self {
        EventCollector {
            events: std::sync::Arc::new(std::sync::Mutex::new(Vec::new())),
        }
    }

    pub fn get_events(&self) -> Vec<SpreadsheetEvent> {
        self.events.lock().unwrap().clone()
    }

    pub fn clear(&self) {
        self.events.lock().unwrap().clear();
    }
}

impl EventCallback for EventCollector {
    fn on_event(&self, event: &SpreadsheetEvent) {
        self.events.lock().unwrap().push(event.clone());
    }
}
