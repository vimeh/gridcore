//! Implementation of CellOperationsService trait

use crate::dependency::DependencyGraph;
use crate::domain::Cell;
use crate::formula::FormulaParser;
use crate::references::ReferenceTracker;
use crate::repository::CellRepository;
use crate::traits::CellOperationsService;
use crate::types::{CellAddress, CellValue};
use crate::{Result, SpreadsheetError};
use std::sync::{Arc, Mutex};

/// Concrete implementation of CellOperationsService
pub struct CellOperationsServiceImpl {
    repository: Arc<Mutex<CellRepository>>,
    dependency_graph: Arc<Mutex<DependencyGraph>>,
    reference_tracker: Arc<Mutex<ReferenceTracker>>,
}

impl CellOperationsServiceImpl {
    /// Create a new CellOperationsServiceImpl
    pub fn new(
        repository: Arc<Mutex<CellRepository>>,
        dependency_graph: Arc<Mutex<DependencyGraph>>,
        reference_tracker: Arc<Mutex<ReferenceTracker>>,
    ) -> Self {
        Self {
            repository,
            dependency_graph,
            reference_tracker,
        }
    }
}

impl CellOperationsService for CellOperationsServiceImpl {
    fn set_cell(&self, address: &CellAddress, value: &str) -> Result<Cell> {
        let mut repository = self.repository.lock().map_err(|_| {
            SpreadsheetError::LockError("Failed to acquire repository lock".to_string())
        })?;
        let mut dependency_graph = self.dependency_graph.lock().map_err(|_| {
            SpreadsheetError::LockError("Failed to acquire dependency graph lock".to_string())
        })?;
        let mut reference_tracker = self.reference_tracker.lock().map_err(|_| {
            SpreadsheetError::LockError("Failed to acquire reference tracker lock".to_string())
        })?;

        // Parse the value to determine if it's a formula
        let cell = if value.starts_with('=') {
            // Parse formula
            let formula_str = &value[1..];
            let parser = FormulaParser::new();
            let formula = parser.parse(formula_str)?;

            // Extract references from formula
            let references = formula.get_references();

            // Update dependency graph
            dependency_graph.set_dependencies(address, &references);

            // Update reference tracker
            reference_tracker.update_references(address, &references);

            // Create cell with formula
            Cell::with_formula(formula)
        } else {
            // Parse as direct value
            let cell_value = CellValue::from_str(value);
            Cell::with_value(cell_value)
        };

        // Store in repository
        repository.set(address, cell.clone());

        Ok(cell)
    }

    fn get_cell(&self, address: &CellAddress) -> Option<Cell> {
        let repository = self.repository.lock().ok()?;
        repository.get(address)
    }

    fn delete_cell(&self, address: &CellAddress) -> Result<()> {
        let mut repository = self.repository.lock().map_err(|_| {
            SpreadsheetError::LockError("Failed to acquire repository lock".to_string())
        })?;
        let mut dependency_graph = self.dependency_graph.lock().map_err(|_| {
            SpreadsheetError::LockError("Failed to acquire dependency graph lock".to_string())
        })?;
        let mut reference_tracker = self.reference_tracker.lock().map_err(|_| {
            SpreadsheetError::LockError("Failed to acquire reference tracker lock".to_string())
        })?;

        // Remove from repository
        repository.delete(address);

        // Clear dependencies
        dependency_graph.clear_dependencies(address);

        // Clear references
        reference_tracker.clear_references(address);

        Ok(())
    }

    fn get_cell_value(&self, address: &CellAddress) -> Option<CellValue> {
        let repository = self.repository.lock().ok()?;
        repository.get(address).map(|cell| cell.get_value())
    }
}
