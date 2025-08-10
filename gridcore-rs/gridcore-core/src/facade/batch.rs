use crate::Result;
use crate::types::{CellAddress, CellValue};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Represents a single operation in a batch
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum BatchOperation {
    SetCell {
        address: CellAddress,
        value: CellValue,
        formula: Option<String>,
    },
    DeleteCell {
        address: CellAddress,
    },
    SetRange {
        start: CellAddress,
        end: CellAddress,
        values: Vec<Vec<CellValue>>,
    },
    DeleteRange {
        start: CellAddress,
        end: CellAddress,
    },
}

/// Manages batch operations for the spreadsheet
#[derive(Debug)]
pub struct BatchManager {
    /// Active batches mapped by ID
    batches: HashMap<String, Vec<BatchOperation>>,
    /// Counter for generating batch IDs
    batch_counter: usize,
}

impl BatchManager {
    /// Create a new batch manager
    pub fn new() -> Self {
        BatchManager {
            batches: HashMap::new(),
            batch_counter: 0,
        }
    }

    /// Begin a new batch operation
    pub fn begin_batch(&mut self, batch_id: Option<String>) -> String {
        let id = batch_id.unwrap_or_else(|| {
            self.batch_counter += 1;
            format!("batch_{}", self.batch_counter)
        });

        self.batches.insert(id.clone(), Vec::new());
        id
    }

    /// Add an operation to a batch
    pub fn add_operation(&mut self, batch_id: &str, operation: BatchOperation) -> Result<()> {
        if let Some(batch) = self.batches.get_mut(batch_id) {
            batch.push(operation);
            Ok(())
        } else {
            Err(crate::SpreadsheetError::BatchNotFound(batch_id.to_string()))
        }
    }

    /// Get all operations in a batch
    pub fn get_operations(&self, batch_id: &str) -> Option<&Vec<BatchOperation>> {
        self.batches.get(batch_id)
    }

    /// Remove and return all operations in a batch
    pub fn take_operations(&mut self, batch_id: &str) -> Option<Vec<BatchOperation>> {
        self.batches.remove(batch_id)
    }

    /// Check if a batch exists
    pub fn has_batch(&self, batch_id: &str) -> bool {
        self.batches.contains_key(batch_id)
    }

    /// Get the number of operations in a batch
    pub fn operation_count(&self, batch_id: &str) -> usize {
        self.batches.get(batch_id).map(|ops| ops.len()).unwrap_or(0)
    }

    /// Check if any batches are active
    pub fn has_active_batches(&self) -> bool {
        !self.batches.is_empty()
    }

    /// Check if a batch is active (alias for has_active_batches)
    pub fn is_batch_active(&self) -> bool {
        self.has_active_batches()
    }

    /// Get all active batch IDs
    pub fn active_batch_ids(&self) -> Vec<String> {
        self.batches.keys().cloned().collect()
    }

    /// Clear all batches
    pub fn clear(&mut self) {
        self.batches.clear();
    }

    /// Rollback a batch (remove without executing)
    pub fn rollback_batch(&mut self, batch_id: &str) -> Result<()> {
        if self.batches.remove(batch_id).is_some() {
            Ok(())
        } else {
            Err(crate::SpreadsheetError::BatchNotFound(batch_id.to_string()))
        }
    }
}

impl Default for BatchManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_batch_manager_basic() {
        let mut manager = BatchManager::new();

        // Begin a batch
        let batch_id = manager.begin_batch(None);
        assert!(manager.has_batch(&batch_id));

        // Add operations
        let addr = CellAddress::new(0, 0);
        let op = BatchOperation::SetCell {
            address: addr,
            value: CellValue::Number(42.0),
            formula: None,
        };

        manager.add_operation(&batch_id, op.clone()).unwrap();
        assert_eq!(manager.operation_count(&batch_id), 1);

        // Take operations
        let ops = manager.take_operations(&batch_id).unwrap();
        assert_eq!(ops.len(), 1);
        assert!(!manager.has_batch(&batch_id));
    }

    #[test]
    fn test_batch_manager_rollback() {
        let mut manager = BatchManager::new();

        let batch_id = manager.begin_batch(Some("test_batch".to_string()));
        assert_eq!(batch_id, "test_batch");

        // Add an operation
        let addr = CellAddress::new(0, 0);
        let op = BatchOperation::DeleteCell { address: addr };
        manager.add_operation(&batch_id, op).unwrap();

        // Rollback
        manager.rollback_batch(&batch_id).unwrap();
        assert!(!manager.has_batch(&batch_id));
    }

    #[test]
    fn test_batch_manager_multiple_batches() {
        let mut manager = BatchManager::new();

        let _batch1 = manager.begin_batch(None);
        let _batch2 = manager.begin_batch(None);

        assert!(manager.has_active_batches());
        assert_eq!(manager.active_batch_ids().len(), 2);

        manager.clear();
        assert!(!manager.has_active_batches());
    }
}
