//! Implementation of CellOperationsService trait

use crate::dependency::{DependencyAnalyzer, DependencyGraph};
use crate::domain::Cell;
use crate::evaluator::{Evaluator, context::RepositoryContext};
use crate::formula::FormulaParser;
use crate::references::ReferenceTracker;
use crate::repository::CellRepository;
use crate::traits::CellOperationsService;
use crate::types::{CellAddress, CellValue};
use crate::{Result, SpreadsheetError};
use std::sync::{Arc, Mutex};
use std::rc::Rc;
use std::cell::RefCell;

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

    /// Parse a string value into a CellValue
    fn parse_value(value: &str) -> CellValue {
        // Try to parse as number
        if let Ok(num) = value.parse::<f64>() {
            return CellValue::Number(num);
        }

        // Try to parse as boolean
        if let Ok(bool_val) = value.parse::<bool>() {
            return CellValue::Boolean(bool_val);
        }

        // Treat as string
        CellValue::String(value.to_string())
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
            let formula = match FormulaParser::parse(value) {
                Ok(ast) => ast,
                Err(e) => {
                    // If parse fails, store the error in the cell
                    let error_cell = Cell::new(CellValue::Error(crate::types::ErrorType::ParseError {
                        message: e.to_string(),
                    }));
                    repository.set(address, error_cell.clone());
                    return Ok(error_cell);
                }
            };

            // Extract references from formula
            let references = DependencyAnalyzer::extract_dependencies(&formula);

            // Check for circular dependencies
            for reference in &references {
                if dependency_graph.would_create_cycle(address, reference) {
                    return Err(SpreadsheetError::CircularDependency);
                }
            }

            // Update dependency graph
            dependency_graph.remove_dependencies_for(address);
            for reference in &references {
                dependency_graph.add_dependency(*address, *reference);
            }

            // Update reference tracker
            reference_tracker.update_dependencies(address, &formula);

            // Evaluate the formula
            let computed_value = {
                // Create a temporary Rc<RefCell<>> for RepositoryContext
                let repo_snapshot = repository.clone();
                drop(repository); // Drop the MutexGuard before evaluation
                
                let repo_rc = Rc::new(RefCell::new(repo_snapshot));
                let mut context = RepositoryContext::new(&repo_rc);
                
                // Push current cell to evaluation stack
                context.push_evaluation(address);
                
                let mut evaluator = Evaluator::new(&mut context);
                let result = evaluator.evaluate(&formula);
                
                // Pop from evaluation stack
                context.pop_evaluation(address);
                
                match result {
                    Ok(val) => val,
                    Err(e) => {
                        // Convert SpreadsheetError to appropriate ErrorType
                        CellValue::Error(e.to_error_type())
                    }
                }
            };

            // Create cell with formula and computed value
            let raw_value = CellValue::String(value.to_string());
            let mut cell = Cell::with_formula(raw_value, formula);
            cell.set_computed_value(computed_value);
            
            // Re-acquire repository lock and store
            let mut repository = self.repository.lock().map_err(|_| {
                SpreadsheetError::LockError("Failed to acquire repository lock".to_string())
            })?;
            repository.set(address, cell.clone());
            
            cell
        } else {
            // Parse as direct value
            let cell_value = Self::parse_value(value);
            let cell = Cell::new(cell_value);
            repository.set(address, cell.clone());
            cell
        };

        Ok(cell)
    }

    fn get_cell(&self, address: &CellAddress) -> Option<Cell> {
        let repository = self.repository.lock().ok()?;
        repository.get(address).cloned()
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
        dependency_graph.remove_dependencies_for(address);

        // Clear references
        reference_tracker.remove_dependencies(address);

        Ok(())
    }

    fn get_cell_value(&self, address: &CellAddress) -> Option<CellValue> {
        let repository = self.repository.lock().ok()?;
        repository
            .get(address)
            .map(|cell| cell.get_computed_value())
    }
}
