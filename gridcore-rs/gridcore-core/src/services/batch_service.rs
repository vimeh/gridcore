use crate::dependency::DependencyGraph;
use crate::domain::Cell;
use crate::facade::batch::{BatchManager, BatchOperation};
use crate::facade::event::SpreadsheetEvent;
use crate::formula::FormulaParser;
use crate::references::ReferenceTracker;
use crate::repository::CellRepository;
use crate::services::EventManager;
use crate::types::{CellAddress, CellValue};
use crate::{Result, SpreadsheetError};
use std::cell::RefCell;
use std::collections::HashSet;
use std::rc::Rc;

/// Service for managing batch operations on the spreadsheet
pub struct BatchService {
    repository: Rc<RefCell<CellRepository>>,
    dependency_graph: Rc<RefCell<DependencyGraph>>,
    batch_manager: RefCell<BatchManager>,
    event_manager: Rc<EventManager>,
    reference_tracker: Rc<RefCell<ReferenceTracker>>,
}

impl BatchService {
    /// Create a new batch service
    pub fn new(
        repository: Rc<RefCell<CellRepository>>,
        dependency_graph: Rc<RefCell<DependencyGraph>>,
        event_manager: Rc<EventManager>,
        reference_tracker: Rc<RefCell<ReferenceTracker>>,
    ) -> Self {
        BatchService {
            repository,
            dependency_graph,
            batch_manager: RefCell::new(BatchManager::new()),
            event_manager,
            reference_tracker,
        }
    }

    /// Begin a new batch operation
    pub fn begin_batch(&self, batch_id: Option<String>) -> String {
        let mut batch_manager = self.batch_manager.borrow_mut();
        let id = batch_manager.begin_batch(batch_id);

        // Emit batch started event
        self.event_manager
            .emit(SpreadsheetEvent::batch_started(id.clone()));

        id
    }

    /// Add an operation to a batch
    pub fn add_to_batch(&self, batch_id: &str, operation: BatchOperation) -> Result<()> {
        self.batch_manager
            .borrow_mut()
            .add_operation(batch_id, operation)
    }

    /// Commit a batch operation
    pub fn commit_batch<F>(&self, batch_id: &str, recalculate_fn: F) -> Result<()>
    where
        F: FnOnce(HashSet<CellAddress>) -> Result<()>,
    {
        // Take operations from batch manager
        let operations = self
            .batch_manager
            .borrow_mut()
            .take_operations(batch_id)
            .ok_or_else(|| SpreadsheetError::BatchNotFound(batch_id.to_string()))?;

        let operation_count = operations.len();

        // Track affected cells for recalculation
        let mut affected_cells = HashSet::new();

        // Execute all operations
        for operation in operations {
            match operation {
                BatchOperation::SetCell {
                    address,
                    value,
                    formula,
                } => {
                    affected_cells.insert(address);
                    // Convert CellValue to string for set_cell_value
                    let value_str = if let Some(formula) = formula {
                        formula
                    } else {
                        match value {
                            CellValue::Number(n) => n.to_string(),
                            CellValue::String(s) => s,
                            CellValue::Boolean(b) => b.to_string(),
                            CellValue::Error(e) => e.excel_code().to_string(),
                            _ => String::new(),
                        }
                    };
                    self.set_cell_value_internal(&address, &value_str)?;
                }
                BatchOperation::DeleteCell { address } => {
                    affected_cells.insert(address);
                    self.delete_cell_internal(&address)?;
                }
                BatchOperation::SetRange {
                    start,
                    end,
                    values: _,
                } => {
                    // Add range operations
                    for row in start.row..=end.row {
                        for col in start.col..=end.col {
                            let addr = CellAddress::new(col, row);
                            affected_cells.insert(addr);
                        }
                    }
                }
                BatchOperation::DeleteRange { start, end } => {
                    for row in start.row..=end.row {
                        for col in start.col..=end.col {
                            let addr = CellAddress::new(col, row);
                            affected_cells.insert(addr);
                            self.delete_cell_internal(&addr)?;
                        }
                    }
                }
            }
        }

        // Batch recalculation of all affected cells and their dependents
        recalculate_fn(affected_cells)?;

        // Emit batch completed event
        self.event_manager.emit(SpreadsheetEvent::batch_completed(
            batch_id.to_string(),
            operation_count,
        ));

        Ok(())
    }

    /// Rollback a batch operation
    pub fn rollback_batch(&self, batch_id: &str) -> Result<()> {
        self.batch_manager.borrow_mut().rollback_batch(batch_id)
    }

    /// Clear all batches
    pub fn clear(&self) {
        self.batch_manager.borrow_mut().clear();
    }

    /// Check if a batch is active
    pub fn is_batch_active(&self) -> bool {
        self.batch_manager.borrow().is_batch_active()
    }

    /// Internal method to set a cell value without triggering batch logic
    fn set_cell_value_internal(&self, address: &CellAddress, value: &str) -> Result<()> {
        // Parse the value
        let cell = if value.starts_with('=') {
            // Formula cell
            let formula_str = &value[1..];
            let ast = FormulaParser::parse(formula_str)?;

            // Track references
            self.reference_tracker
                .borrow_mut()
                .update_dependencies(address, &ast);
            let references = self.reference_tracker.borrow().get_dependencies(address);

            // Update dependency graph
            self.dependency_graph
                .borrow_mut()
                .remove_dependencies_for(address);
            for reference in &references {
                self.dependency_graph
                    .borrow_mut()
                    .add_dependency(*reference, *address);
            }

            Cell::with_formula(CellValue::Empty, ast)
        } else {
            // Value cell
            let parsed_value = Self::parse_value(value);
            Cell::new(parsed_value)
        };

        // Store the cell
        self.repository.borrow_mut().set(address, cell.clone());

        Ok(())
    }

    /// Internal method to delete a cell without triggering batch logic
    fn delete_cell_internal(&self, address: &CellAddress) -> Result<()> {
        // Clear dependencies
        self.dependency_graph
            .borrow_mut()
            .remove_dependencies_for(address);

        // Clear reference tracking
        self.reference_tracker
            .borrow_mut()
            .remove_dependencies(address);

        // Remove from repository
        self.repository.borrow_mut().delete(address);

        Ok(())
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::facade::event::EventCollector;

    #[test]
    fn test_batch_service_operations() {
        let repository = Rc::new(RefCell::new(CellRepository::new()));
        let dependency_graph = Rc::new(RefCell::new(DependencyGraph::new()));
        let event_manager = Rc::new(EventManager::new());
        let reference_tracker = Rc::new(RefCell::new(ReferenceTracker::new()));

        let batch_service = BatchService::new(
            repository.clone(),
            dependency_graph.clone(),
            event_manager.clone(),
            reference_tracker,
        );

        // Add event collector
        let collector = EventCollector::new();
        event_manager.add_callback(Box::new(collector.clone()));

        // Begin batch
        let batch_id = batch_service.begin_batch(Some("test_batch".to_string()));
        assert_eq!(batch_id, "test_batch");

        // Add operations
        let addr = CellAddress::new(0, 0);
        batch_service
            .add_to_batch(
                &batch_id,
                BatchOperation::SetCell {
                    address: addr,
                    value: CellValue::Number(42.0),
                    formula: None,
                },
            )
            .unwrap();

        // Commit batch
        batch_service
            .commit_batch(&batch_id, |_cells| Ok(()))
            .unwrap();

        // Check events
        let events = collector.get_events();
        assert_eq!(events.len(), 2); // batch_started and batch_completed
    }

    #[test]
    fn test_batch_rollback() {
        let repository = Rc::new(RefCell::new(CellRepository::new()));
        let dependency_graph = Rc::new(RefCell::new(DependencyGraph::new()));
        let event_manager = Rc::new(EventManager::new());
        let reference_tracker = Rc::new(RefCell::new(ReferenceTracker::new()));

        let batch_service = BatchService::new(
            repository,
            dependency_graph,
            event_manager,
            reference_tracker,
        );

        // Begin batch
        let batch_id = batch_service.begin_batch(None);

        // Add operation
        let addr = CellAddress::new(0, 0);
        batch_service
            .add_to_batch(
                &batch_id,
                BatchOperation::SetCell {
                    address: addr,
                    value: CellValue::Number(42.0),
                    formula: None,
                },
            )
            .unwrap();

        // Rollback
        batch_service.rollback_batch(&batch_id).unwrap();

        // Try to commit should fail
        let result = batch_service.commit_batch(&batch_id, |_| Ok(()));
        assert!(result.is_err());
    }
}
