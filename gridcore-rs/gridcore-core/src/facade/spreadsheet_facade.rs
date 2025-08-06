use crate::dependency::{DependencyAnalyzer, DependencyGraph};
use crate::domain::Cell;
use crate::evaluator::{EvaluationContext, Evaluator};
use crate::formula::FormulaParser;
use crate::repository::CellRepository;
use crate::types::{CellAddress, CellValue};
use crate::{Result, SpreadsheetError};
use std::cell::RefCell;
use std::collections::HashSet;
use std::rc::Rc;
use std::time::Instant;

use super::batch::{BatchManager, BatchOperation};
use super::event::{EventCallback, SpreadsheetEvent};

/// Main facade for spreadsheet operations
pub struct SpreadsheetFacade {
    /// Cell repository for storing cells
    repository: Rc<RefCell<CellRepository>>,
    /// Dependency graph for tracking cell dependencies
    dependency_graph: Rc<RefCell<DependencyGraph>>,
    /// Batch manager for batch operations
    batch_manager: RefCell<BatchManager>,
    /// Event callbacks
    event_callbacks: RefCell<Vec<Box<dyn EventCallback>>>,
}

impl SpreadsheetFacade {
    /// Create a new spreadsheet facade
    pub fn new() -> Self {
        SpreadsheetFacade {
            repository: Rc::new(RefCell::new(CellRepository::new())),
            dependency_graph: Rc::new(RefCell::new(DependencyGraph::new())),
            batch_manager: RefCell::new(BatchManager::new()),
            event_callbacks: RefCell::new(Vec::new()),
        }
    }

    /// Add an event callback
    pub fn add_event_callback(&self, callback: Box<dyn EventCallback>) {
        self.event_callbacks.borrow_mut().push(callback);
    }

    /// Emit an event to all callbacks
    fn emit_event(&self, event: SpreadsheetEvent) {
        for callback in self.event_callbacks.borrow().iter() {
            callback.on_event(&event);
        }
    }

    /// Set a cell value (formula or direct value)
    pub fn set_cell_value(&self, address: &CellAddress, value: &str) -> Result<Cell> {
        // Check if we're in a batch
        let batch_manager = self.batch_manager.borrow();
        if batch_manager.has_active_batches() {
            // Queue the operation for batch processing
            let batch_ids = batch_manager.active_batch_ids();
            if let Some(batch_id) = batch_ids.first() {
                drop(batch_manager); // Release borrow
                self.queue_batch_operation(
                    batch_id,
                    BatchOperation::SetCell {
                        address: address.clone(),
                        value: CellValue::String(value.to_string()),
                        formula: if value.starts_with('=') {
                            Some(value.to_string())
                        } else {
                            None
                        },
                    },
                )?;
                // Return a placeholder cell for now
                return Ok(Cell::new(CellValue::String(value.to_string())));
            }
        }
        drop(batch_manager);

        // Get old value for event
        let old_value = self
            .repository
            .borrow()
            .get(address)
            .map(|cell| cell.get_computed_value());

        // Parse and create cell
        let cell = if value.starts_with('=') {
            // Parse formula
            let formula = &value[1..];
            let ast = FormulaParser::parse(formula)?;

            // Analyze dependencies
            let dependencies = DependencyAnalyzer::extract_dependencies(&ast);

            // Update dependency graph
            {
                let mut graph = self.dependency_graph.borrow_mut();
                graph.remove_dependencies_for(address);
                for dep in &dependencies {
                    // Check for circular dependencies
                    if graph.would_create_cycle(address, dep) {
                        return Err(SpreadsheetError::CircularDependency);
                    }
                    graph.add_dependency(address.clone(), dep.clone());
                }
            }

            // Create cell with formula
            let mut cell = Cell::with_formula(CellValue::String(value.to_string()), ast.clone());

            // Evaluate the formula
            let mut context = RepositoryContext::new(&self.repository);
            let mut evaluator = Evaluator::new(&mut context);
            let computed_value = evaluator.evaluate(&ast)?;
            cell.set_computed_value(computed_value.clone());

            cell
        } else {
            // Parse as direct value
            let cell_value = Self::parse_value(value);
            Cell::new(cell_value.clone())
        };

        // Store the cell
        let computed_value = cell.get_computed_value();
        self.repository.borrow_mut().set(address, cell.clone());

        // Emit event
        self.emit_event(SpreadsheetEvent::cell_updated(
            address,
            old_value,
            computed_value.clone(),
            if value.starts_with('=') {
                Some(value.to_string())
            } else {
                None
            },
        ));

        // Recalculate dependents
        self.recalculate_dependents(address)?;

        Ok(cell)
    }

    /// Get a cell value
    pub fn get_cell_value(&self, address: &CellAddress) -> Result<CellValue> {
        Ok(self
            .repository
            .borrow()
            .get(address)
            .map(|cell| cell.get_computed_value())
            .unwrap_or(CellValue::Empty))
    }

    /// Get a cell
    pub fn get_cell(&self, address: &CellAddress) -> Option<Cell> {
        self.repository.borrow().get(address).cloned()
    }

    /// Delete a cell
    pub fn delete_cell(&self, address: &CellAddress) -> Result<()> {
        // Check if we're in a batch
        let batch_manager = self.batch_manager.borrow();
        if batch_manager.has_active_batches() {
            let batch_ids = batch_manager.active_batch_ids();
            if let Some(batch_id) = batch_ids.first() {
                drop(batch_manager);
                self.queue_batch_operation(
                    batch_id,
                    BatchOperation::DeleteCell {
                        address: address.clone(),
                    },
                )?;
                return Ok(());
            }
        }
        drop(batch_manager);

        // Remove from repository
        self.repository.borrow_mut().delete(address);

        // Remove from dependency graph
        self.dependency_graph.borrow_mut().remove_cell(address);

        // Emit event
        self.emit_event(SpreadsheetEvent::cell_deleted(address));

        // Recalculate dependents
        self.recalculate_dependents(address)?;

        Ok(())
    }

    /// Recalculate all cells
    pub fn recalculate(&self) -> Result<()> {
        let start = Instant::now();

        // Get calculation order
        let order = self.dependency_graph.borrow().get_calculation_order()?;

        // Emit calculation started event
        let affected_cells: Vec<String> = order.iter().map(|a| a.to_string()).collect();
        self.emit_event(SpreadsheetEvent::calculation_started(
            affected_cells.clone(),
        ));

        // Recalculate each cell in order
        for address in &order {
            if let Some(mut cell) = self.repository.borrow().get(address).cloned() {
                if let Some(ast) = &cell.formula {
                    let mut context = RepositoryContext::new(&self.repository);
                    let mut evaluator = Evaluator::new(&mut context);
                    let result = evaluator.evaluate(ast)?;
                    cell.set_computed_value(result);
                    self.repository.borrow_mut().set(address, cell);
                }
            }
        }

        // Emit calculation completed event
        let duration_ms = start.elapsed().as_millis() as u64;
        self.emit_event(SpreadsheetEvent::calculation_completed(
            affected_cells,
            duration_ms,
        ));

        Ok(())
    }

    /// Recalculate a specific cell
    pub fn recalculate_cell(&self, address: &CellAddress) -> Result<Cell> {
        let mut cell = self
            .repository
            .borrow()
            .get(address)
            .cloned()
            .ok_or_else(|| SpreadsheetError::InvalidRef(address.to_string()))?;

        if let Some(ast) = &cell.formula {
            let mut context = RepositoryContext::new(&self.repository);
            let mut evaluator = Evaluator::new(&mut context);
            let result = evaluator.evaluate(ast)?;
            cell.set_computed_value(result);
            self.repository.borrow_mut().set(address, cell.clone());
        }

        Ok(cell)
    }

    /// Begin a batch operation
    pub fn begin_batch(&self, batch_id: Option<String>) -> String {
        let mut batch_manager = self.batch_manager.borrow_mut();
        let id = batch_manager.begin_batch(batch_id);

        // Emit batch started event
        self.emit_event(SpreadsheetEvent::batch_started(id.clone()));

        id
    }

    /// Commit a batch operation
    pub fn commit_batch(&self, batch_id: &str) -> Result<()> {
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
                    affected_cells.insert(address.clone());
                    // Convert CellValue to string for set_cell_value
                    let value_str = if let Some(formula) = formula {
                        formula
                    } else {
                        match value {
                            CellValue::Number(n) => n.to_string(),
                            CellValue::String(s) => s,
                            CellValue::Boolean(b) => b.to_string(),
                            CellValue::Error(e) => e,
                            _ => String::new(),
                        }
                    };
                    // Temporarily disable batch mode for individual operations
                    self.set_cell_value_internal(&address, &value_str)?;
                }
                BatchOperation::DeleteCell { address } => {
                    affected_cells.insert(address.clone());
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
                            affected_cells.insert(addr.clone());
                            self.delete_cell_internal(&addr)?;
                        }
                    }
                }
            }
        }

        // Batch recalculation of all affected cells and their dependents
        self.batch_recalculate(affected_cells)?;

        // Emit batch completed event
        self.emit_event(SpreadsheetEvent::batch_completed(
            batch_id.to_string(),
            operation_count,
        ));

        Ok(())
    }

    /// Rollback a batch operation
    pub fn rollback_batch(&self, batch_id: &str) -> Result<()> {
        self.batch_manager.borrow_mut().rollback_batch(batch_id)
    }

    /// Clear all cells
    pub fn clear(&self) {
        self.repository.borrow_mut().clear();
        self.dependency_graph.borrow_mut().clear();
        self.batch_manager.borrow_mut().clear();
    }

    /// Get the number of cells
    pub fn get_cell_count(&self) -> usize {
        self.repository.borrow().len()
    }

    // Helper methods

    /// Queue an operation for batch processing
    fn queue_batch_operation(&self, batch_id: &str, operation: BatchOperation) -> Result<()> {
        self.batch_manager
            .borrow_mut()
            .add_operation(batch_id, operation)
    }

    /// Internal set cell value (without batch check)
    fn set_cell_value_internal(&self, address: &CellAddress, value: &str) -> Result<()> {
        // Similar to set_cell_value but without batch check
        let cell = if value.starts_with('=') {
            let formula = &value[1..];
            let ast = FormulaParser::parse(formula)?;

            let dependencies = DependencyAnalyzer::extract_dependencies(&ast);

            let mut graph = self.dependency_graph.borrow_mut();
            graph.remove_dependencies_for(address);
            for dep in &dependencies {
                if graph.would_create_cycle(address, dep) {
                    return Err(SpreadsheetError::CircularDependency);
                }
                graph.add_dependency(address.clone(), dep.clone());
            }

            let mut cell = Cell::with_formula(CellValue::String(value.to_string()), ast.clone());
            let mut context = RepositoryContext::new(&self.repository);
            let mut evaluator = Evaluator::new(&mut context);
            let computed_value = evaluator.evaluate(&ast)?;
            cell.set_computed_value(computed_value);
            cell
        } else {
            let cell_value = Self::parse_value(value);
            Cell::new(cell_value)
        };

        self.repository.borrow_mut().set(address, cell);
        Ok(())
    }

    /// Internal delete cell (without batch check)
    fn delete_cell_internal(&self, address: &CellAddress) -> Result<()> {
        self.repository.borrow_mut().delete(address);
        self.dependency_graph.borrow_mut().remove_cell(address);
        Ok(())
    }

    /// Recalculate cells that depend on the given address
    fn recalculate_dependents(&self, address: &CellAddress) -> Result<()> {
        let dependents = self.dependency_graph.borrow().get_dependents(address);

        for dependent in dependents {
            if let Some(mut cell) = self.repository.borrow().get(&dependent).cloned() {
                if let Some(ast) = &cell.formula {
                    let mut context = RepositoryContext::new(&self.repository);
                    let mut evaluator = Evaluator::new(&mut context);
                    let result = evaluator.evaluate(ast)?;
                    cell.set_computed_value(result);
                    self.repository.borrow_mut().set(&dependent, cell);

                    // Recursively recalculate cells that depend on this one
                    self.recalculate_dependents(&dependent)?;
                }
            }
        }

        Ok(())
    }

    /// Batch recalculate multiple cells and their dependents
    fn batch_recalculate(&self, cells: HashSet<CellAddress>) -> Result<()> {
        // Collect all cells that need recalculation (including dependents)
        let mut to_recalculate = HashSet::new();
        for cell in cells {
            to_recalculate.insert(cell.clone());
            self.collect_all_dependents(&cell, &mut to_recalculate);
        }

        // Get calculation order for affected cells
        let full_order = self.dependency_graph.borrow().get_calculation_order()?;
        let ordered_cells: Vec<CellAddress> = full_order
            .into_iter()
            .filter(|addr| to_recalculate.contains(addr))
            .collect();

        // Recalculate in order
        for address in ordered_cells {
            if let Some(mut cell) = self.repository.borrow().get(&address).cloned() {
                if let Some(ast) = &cell.formula {
                    let mut context = RepositoryContext::new(&self.repository);
                    let mut evaluator = Evaluator::new(&mut context);
                    let result = evaluator.evaluate(ast)?;
                    cell.set_computed_value(result);
                    self.repository.borrow_mut().set(&address, cell);
                }
            }
        }

        Ok(())
    }

    /// Recursively collect all dependents of a cell
    fn collect_all_dependents(&self, address: &CellAddress, collected: &mut HashSet<CellAddress>) {
        let dependents = self.dependency_graph.borrow().get_dependents(address);
        for dependent in dependents {
            if collected.insert(dependent.clone()) {
                self.collect_all_dependents(&dependent, collected);
            }
        }
    }

    /// Parse a string value into a CellValue
    fn parse_value(value: &str) -> CellValue {
        // Try to parse as number
        if let Ok(num) = value.parse::<f64>() {
            return CellValue::Number(num);
        }

        // Try to parse as boolean
        if value.eq_ignore_ascii_case("true") {
            return CellValue::Boolean(true);
        }
        if value.eq_ignore_ascii_case("false") {
            return CellValue::Boolean(false);
        }

        // Check for error values
        if value.starts_with('#') && value.ends_with('!') {
            return CellValue::Error(value.to_string());
        }

        // Default to string
        CellValue::String(value.to_string())
    }
}

impl Default for SpreadsheetFacade {
    fn default() -> Self {
        Self::new()
    }
}

/// Evaluation context that uses the cell repository
struct RepositoryContext<'a> {
    repository: &'a Rc<RefCell<CellRepository>>,
    evaluation_stack: RefCell<HashSet<CellAddress>>,
}

impl<'a> RepositoryContext<'a> {
    fn new(repository: &'a Rc<RefCell<CellRepository>>) -> Self {
        RepositoryContext {
            repository,
            evaluation_stack: RefCell::new(HashSet::new()),
        }
    }
}

impl<'a> EvaluationContext for RepositoryContext<'a> {
    fn get_cell_value(&self, address: &CellAddress) -> Result<CellValue> {
        Ok(self
            .repository
            .borrow()
            .get(address)
            .map(|cell| cell.get_computed_value())
            .unwrap_or(CellValue::Empty))
    }

    fn check_circular(&self, address: &CellAddress) -> bool {
        self.evaluation_stack.borrow().contains(address)
    }

    fn push_evaluation(&mut self, address: &CellAddress) {
        self.evaluation_stack.borrow_mut().insert(address.clone());
    }

    fn pop_evaluation(&mut self, address: &CellAddress) {
        self.evaluation_stack.borrow_mut().remove(address);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::facade::event::EventCollector;

    #[test]
    fn test_facade_basic_operations() {
        let facade = SpreadsheetFacade::new();

        // Add event collector
        let collector = EventCollector::new();
        facade.add_event_callback(Box::new(collector.clone()));

        // Set a cell value
        let addr = CellAddress::new(0, 0);
        let cell = facade.set_cell_value(&addr, "42").unwrap();
        assert_eq!(cell.get_computed_value(), CellValue::Number(42.0));

        // Get cell value
        let value = facade.get_cell_value(&addr).unwrap();
        assert_eq!(value, CellValue::Number(42.0));

        // Check events
        let events = collector.get_events();
        assert_eq!(events.len(), 1);
    }

    #[test]
    fn test_facade_formula() {
        let facade = SpreadsheetFacade::new();

        // Set up cells
        let a1 = CellAddress::new(0, 0);
        let b1 = CellAddress::new(1, 0);
        let c1 = CellAddress::new(2, 0);

        facade.set_cell_value(&a1, "10").unwrap();
        facade.set_cell_value(&b1, "20").unwrap();
        facade.set_cell_value(&c1, "=A1+B1").unwrap();

        // Check computed value
        let value = facade.get_cell_value(&c1).unwrap();
        assert_eq!(value, CellValue::Number(30.0));
    }

    #[test]
    fn test_facade_batch_operations() {
        let facade = SpreadsheetFacade::new();

        // Begin batch
        let batch_id = facade.begin_batch(None);

        // Queue operations
        let a1 = CellAddress::new(0, 0);
        let b1 = CellAddress::new(1, 0);

        facade.set_cell_value(&a1, "100").unwrap();
        facade.set_cell_value(&b1, "200").unwrap();

        // Commit batch
        facade.commit_batch(&batch_id).unwrap();

        // Check values
        assert_eq!(
            facade.get_cell_value(&a1).unwrap(),
            CellValue::Number(100.0)
        );
        assert_eq!(
            facade.get_cell_value(&b1).unwrap(),
            CellValue::Number(200.0)
        );
    }

    #[test]
    fn test_facade_circular_dependency() {
        let facade = SpreadsheetFacade::new();

        let a1 = CellAddress::new(0, 0);
        let b1 = CellAddress::new(1, 0);

        // Set up initial formula
        facade.set_cell_value(&a1, "=B1").unwrap();

        // Try to create circular dependency
        let result = facade.set_cell_value(&b1, "=A1");
        assert!(result.is_err());
        assert!(matches!(
            result.unwrap_err(),
            SpreadsheetError::CircularDependency
        ));
    }
}
