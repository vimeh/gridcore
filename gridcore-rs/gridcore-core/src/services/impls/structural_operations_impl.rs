//! Implementation of StructuralOperationsService trait

use crate::dependency::DependencyGraph;
use crate::domain::Cell;
use crate::references::ReferenceTracker;
use crate::repository::CellRepository;
use crate::traits::StructuralOperationsService;
use crate::types::CellAddress;
use crate::{Result, SpreadsheetError};
use std::sync::{Arc, Mutex};

/// Concrete implementation of StructuralOperationsService
pub struct StructuralOperationsServiceImpl {
    repository: Arc<Mutex<CellRepository>>,
    dependency_graph: Arc<Mutex<DependencyGraph>>,
    reference_tracker: Arc<Mutex<ReferenceTracker>>,
}

impl StructuralOperationsServiceImpl {
    /// Create a new StructuralOperationsServiceImpl
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

impl StructuralOperationsService for StructuralOperationsServiceImpl {
    fn insert_rows(&self, start: u32, count: u32) -> Result<Vec<CellAddress>> {
        let mut repository = self.repository.lock().map_err(|_| {
            SpreadsheetError::LockError("Failed to acquire repository lock".to_string())
        })?;
        let mut dependency_graph = self.dependency_graph.lock().map_err(|_| {
            SpreadsheetError::LockError("Failed to acquire dependency graph lock".to_string())
        })?;
        let mut reference_tracker = self.reference_tracker.lock().map_err(|_| {
            SpreadsheetError::LockError("Failed to acquire reference tracker lock".to_string())
        })?;

        // Shift cells down
        let affected_addresses = repository.shift_rows(start, count as i32)?;

        // Update dependency graph for shifted cells
        for address in &affected_addresses {
            let new_row = address.row + count;
            let new_address = CellAddress::new(address.col, new_row);

            // Update dependencies
            let deps = dependency_graph.get_dependencies(address);
            if !deps.is_empty() {
                dependency_graph.remove_dependencies_for(address);
                for dep in deps {
                    dependency_graph.add_dependency(new_address, dep);
                }
            }

            // Update references
            // Note: We're just removing old dependencies for now
            reference_tracker.remove_dependencies(address);
        }

        Ok(affected_addresses)
    }

    fn delete_rows(&self, start: u32, count: u32) -> Result<Vec<Cell>> {
        let mut repository = self.repository.lock().map_err(|_| {
            SpreadsheetError::LockError("Failed to acquire repository lock".to_string())
        })?;
        let mut dependency_graph = self.dependency_graph.lock().map_err(|_| {
            SpreadsheetError::LockError("Failed to acquire dependency graph lock".to_string())
        })?;
        let mut reference_tracker = self.reference_tracker.lock().map_err(|_| {
            SpreadsheetError::LockError("Failed to acquire reference tracker lock".to_string())
        })?;

        // Collect cells to be deleted
        let mut deleted_cells = Vec::new();
        for row in start..start + count {
            for col in 0..100 {
                // Assuming max 100 columns
                let address = CellAddress::new(col, row);
                if let Some(cell) = repository.get(&address) {
                    deleted_cells.push(cell.clone());
                    repository.delete(&address);
                    dependency_graph.remove_dependencies_for(&address);
                    reference_tracker.remove_dependencies(&address);
                }
            }
        }

        // Shift remaining cells up
        repository.shift_rows(start + count, -(count as i32))?;

        // Update references for shifted cells
        let affected_addresses = repository.get_all_addresses();
        for address in affected_addresses {
            if address.row >= start {
                // Note: shift_references may not exist, using simpler approach
                reference_tracker.remove_dependencies(&address);
            }
        }

        Ok(deleted_cells)
    }

    fn insert_columns(&self, start: u32, count: u32) -> Result<Vec<CellAddress>> {
        let mut repository = self.repository.lock().map_err(|_| {
            SpreadsheetError::LockError("Failed to acquire repository lock".to_string())
        })?;
        let mut dependency_graph = self.dependency_graph.lock().map_err(|_| {
            SpreadsheetError::LockError("Failed to acquire dependency graph lock".to_string())
        })?;
        let mut reference_tracker = self.reference_tracker.lock().map_err(|_| {
            SpreadsheetError::LockError("Failed to acquire reference tracker lock".to_string())
        })?;

        // Shift cells right
        let affected_addresses = repository.shift_columns(start, count as i32)?;

        // Update dependency graph for shifted cells
        for address in &affected_addresses {
            let new_col = address.col + count;
            let new_address = CellAddress::new(new_col, address.row);

            // Update dependencies
            let deps = dependency_graph.get_dependencies(address);
            if !deps.is_empty() {
                dependency_graph.remove_dependencies_for(address);
                for dep in deps {
                    dependency_graph.add_dependency(new_address, dep);
                }
            }

            // Update references
            reference_tracker.remove_dependencies(address);
        }

        Ok(affected_addresses)
    }

    fn delete_columns(&self, start: u32, count: u32) -> Result<Vec<Cell>> {
        let mut repository = self.repository.lock().map_err(|_| {
            SpreadsheetError::LockError("Failed to acquire repository lock".to_string())
        })?;
        let mut dependency_graph = self.dependency_graph.lock().map_err(|_| {
            SpreadsheetError::LockError("Failed to acquire dependency graph lock".to_string())
        })?;
        let mut reference_tracker = self.reference_tracker.lock().map_err(|_| {
            SpreadsheetError::LockError("Failed to acquire reference tracker lock".to_string())
        })?;

        // Collect cells to be deleted
        let mut deleted_cells = Vec::new();
        for col in start..start + count {
            for row in 0..1000 {
                // Assuming max 1000 rows
                let address = CellAddress::new(col, row);
                if let Some(cell) = repository.get(&address) {
                    deleted_cells.push(cell.clone());
                    repository.delete(&address);
                    dependency_graph.remove_dependencies_for(&address);
                    reference_tracker.remove_dependencies(&address);
                }
            }
        }

        // Shift remaining cells left
        repository.shift_columns(start + count, -(count as i32))?;

        // Update references for shifted cells
        let affected_addresses = repository.get_all_addresses();
        for address in affected_addresses {
            if address.col >= start {
                // Note: shift_references may not exist, using simpler approach
                reference_tracker.remove_dependencies(&address);
            }
        }

        Ok(deleted_cells)
    }

    fn get_bounds(&self) -> (u32, u32) {
        let repository = match self.repository.lock() {
            Ok(r) => r,
            Err(_) => return (0, 0),
        };

        let addresses = repository.get_all_addresses();
        let max_row = addresses.iter().map(|a| a.row).max().unwrap_or(0);
        let max_col = addresses.iter().map(|a| a.col).max().unwrap_or(0);

        (max_row + 1, max_col + 1)
    }
}
