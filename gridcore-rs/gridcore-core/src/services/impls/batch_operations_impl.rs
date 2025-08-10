//! Implementation of BatchOperationsService trait

use crate::facade::batch::{BatchManager, BatchOperation};
use crate::traits::BatchOperationsService;
use crate::{Result, SpreadsheetError};
use std::sync::{Arc, Mutex};
use uuid::Uuid;

/// Concrete implementation of BatchOperationsService
pub struct BatchOperationsServiceImpl {
    batch_manager: Arc<Mutex<BatchManager>>,
}

impl BatchOperationsServiceImpl {
    /// Create a new BatchOperationsServiceImpl
    pub fn new() -> Self {
        Self {
            batch_manager: Arc::new(Mutex::new(BatchManager::new())),
        }
    }

    /// Add an operation to the current batch
    pub fn add_operation(&self, batch_id: &str, operation: BatchOperation) -> Result<()> {
        let mut manager = self.batch_manager.lock().map_err(|_| {
            SpreadsheetError::LockError("Failed to acquire batch manager lock".to_string())
        })?;

        manager.add_operation(batch_id, operation);
        Ok(())
    }

    /// Get operations for a batch
    pub fn get_operations(&self, batch_id: &str) -> Result<Vec<BatchOperation>> {
        let manager = self.batch_manager.lock().map_err(|_| {
            SpreadsheetError::LockError("Failed to acquire batch manager lock".to_string())
        })?;

        Ok(manager.get_operations(batch_id).unwrap_or_default())
    }
}

impl BatchOperationsService for BatchOperationsServiceImpl {
    fn start_batch(&self, description: Option<String>) -> String {
        let mut manager = match self.batch_manager.lock() {
            Ok(m) => m,
            Err(_) => return Uuid::new_v4().to_string(),
        };

        // Generate batch ID
        let batch_id = description.unwrap_or_else(|| Uuid::new_v4().to_string());

        // Begin the batch
        manager.begin_batch(Some(batch_id.clone()));

        batch_id
    }

    fn commit_batch(&self, batch_id: &str) -> Result<()> {
        let mut manager = self.batch_manager.lock().map_err(|_| {
            SpreadsheetError::LockError("Failed to acquire batch manager lock".to_string())
        })?;

        // Commit the batch
        manager.commit_batch(batch_id)?;

        Ok(())
    }

    fn rollback_batch(&self, batch_id: &str) -> Result<()> {
        let mut manager = self.batch_manager.lock().map_err(|_| {
            SpreadsheetError::LockError("Failed to acquire batch manager lock".to_string())
        })?;

        // Rollback the batch
        manager.rollback_batch(batch_id)?;

        Ok(())
    }

    fn has_active_batch(&self) -> bool {
        match self.batch_manager.lock() {
            Ok(manager) => manager.has_active_batch(),
            Err(_) => false,
        }
    }
}

impl Default for BatchOperationsServiceImpl {
    fn default() -> Self {
        Self::new()
    }
}
