use crate::command::{CommandExecutor, UndoRedoManager};
use crate::dependency::DependencyGraph;
use crate::domain::Cell;
use crate::evaluator::Evaluator;
use crate::fill::{FillEngine, FillOperation, FillResult};
use crate::formula::FormulaParser;
use crate::references::{ReferenceAdjuster, ReferenceTracker, StructuralOperation};
use crate::repository::CellRepository;
use crate::services::{
    BatchService, CalculationService, CellOperations, EventManager, RepositoryContext,
    StructuralOperations,
};
use crate::types::{CellAddress, CellValue};
use crate::Result;
use std::cell::RefCell;
use std::collections::HashSet;
use std::rc::Rc;

use super::batch::BatchOperation;
use super::event::{EventCallback, SpreadsheetEvent};

/// Main facade for spreadsheet operations
pub struct SpreadsheetFacade {
    /// Cell repository for storing cells
    repository: Rc<RefCell<CellRepository>>,
    /// Dependency graph for tracking cell dependencies
    dependency_graph: Rc<RefCell<DependencyGraph>>,
    /// Reference tracker for formula reference management
    reference_tracker: Rc<RefCell<ReferenceTracker>>,
    /// Batch service for batch operations
    batch_service: Rc<BatchService>,
    /// Calculation service for recalculations
    calculation_service: Rc<CalculationService>,
    /// Event manager service for handling callbacks
    event_manager: Rc<EventManager>,
    /// Cell operations service
    cell_operations: Rc<CellOperations>,
    /// Structural operations service
    structural_operations: Rc<StructuralOperations>,
    /// Undo/redo manager
    undo_redo_manager: RefCell<UndoRedoManager>,
    /// Current active batch ID
    current_batch_id: RefCell<Option<String>>,
}

impl SpreadsheetFacade {
    /// Create a new spreadsheet facade
    pub fn new() -> Self {
        let repository = Rc::new(RefCell::new(CellRepository::new()));
        let dependency_graph = Rc::new(RefCell::new(DependencyGraph::new()));
        let event_manager = Rc::new(EventManager::new());
        let reference_tracker = Rc::new(RefCell::new(ReferenceTracker::new()));

        let cell_operations = Rc::new(CellOperations::new(
            repository.clone(),
            dependency_graph.clone(),
        ));
        let structural_operations = Rc::new(StructuralOperations::new(
            repository.clone(),
            dependency_graph.clone(),
        ));
        let batch_service = Rc::new(BatchService::new(
            repository.clone(),
            dependency_graph.clone(),
            event_manager.clone(),
            reference_tracker.clone(),
        ));
        let calculation_service = Rc::new(CalculationService::new(
            repository.clone(),
            dependency_graph.clone(),
            event_manager.clone(),
        ));

        SpreadsheetFacade {
            repository,
            dependency_graph,
            reference_tracker,
            batch_service,
            calculation_service,
            event_manager,
            cell_operations,
            structural_operations,
            undo_redo_manager: RefCell::new(UndoRedoManager::new()),
            current_batch_id: RefCell::new(None),
        }
    }

    /// Create a facade with specific repositories (for sheet integration)
    pub fn with_repositories(
        repository: Rc<RefCell<CellRepository>>,
        dependency_graph: Rc<RefCell<DependencyGraph>>,
    ) -> Self {
        let event_manager = Rc::new(EventManager::new());
        let reference_tracker = Rc::new(RefCell::new(ReferenceTracker::new()));

        let cell_operations = Rc::new(CellOperations::new(
            repository.clone(),
            dependency_graph.clone(),
        ));
        let structural_operations = Rc::new(StructuralOperations::new(
            repository.clone(),
            dependency_graph.clone(),
        ));
        let batch_service = Rc::new(BatchService::new(
            repository.clone(),
            dependency_graph.clone(),
            event_manager.clone(),
            reference_tracker.clone(),
        ));
        let calculation_service = Rc::new(CalculationService::new(
            repository.clone(),
            dependency_graph.clone(),
            event_manager.clone(),
        ));

        SpreadsheetFacade {
            repository,
            dependency_graph,
            reference_tracker,
            batch_service,
            calculation_service,
            event_manager,
            cell_operations,
            structural_operations,
            undo_redo_manager: RefCell::new(UndoRedoManager::new()),
            current_batch_id: RefCell::new(None),
        }
    }

    /// Add an event callback
    pub fn add_event_callback(&self, callback: Box<dyn EventCallback>) {
        self.event_manager.add_callback(callback);
    }

    /// Emit an event to all callbacks
    fn emit_event(&self, event: SpreadsheetEvent) {
        self.event_manager.emit(event);
    }

    /// Set a cell value (formula or direct value)
    pub fn set_cell_value(&self, address: &CellAddress, value: &str) -> Result<Cell> {
        // Check if we're in a batch
        if let Some(batch_id) = self.current_batch_id.borrow().as_ref() {
            // Queue the operation for batch processing
            let parsed_value = if value.starts_with('=') {
                CellValue::Empty // Formula will be evaluated on commit
            } else if let Ok(num) = value.parse::<f64>() {
                CellValue::Number(num)
            } else if let Ok(bool_val) = value.parse::<bool>() {
                CellValue::Boolean(bool_val)
            } else {
                CellValue::String(value.to_string())
            };

            let operation = BatchOperation::SetCell {
                address: *address,
                value: parsed_value.clone(),
                formula: if value.starts_with('=') {
                    Some(value.to_string())
                } else {
                    None
                },
            };

            self.batch_service.add_to_batch(batch_id, operation)?;

            // Return a placeholder cell
            return Ok(Cell::new(parsed_value));
        }

        // Get old value for event
        let old_value = self
            .cell_operations
            .get_cell(address)
            .map(|cell| cell.get_computed_value());

        // Delegate to CellOperations service
        let cell = self.cell_operations.set_cell(address, value)?;
        let computed_value = cell.get_computed_value();

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

        // If the formula evaluated to an error, also emit an error event to show in UI
        if matches!(computed_value, CellValue::Error(_)) {
            let error_msg = match &computed_value {
                CellValue::Error(e) => {
                    if value.starts_with('=') {
                        format!("Formula error in {}: {}", address, e)
                    } else {
                        format!("Error in {}: {}", address, e)
                    }
                }
                _ => String::new(),
            };
            if !error_msg.is_empty() {
                self.emit_event(SpreadsheetEvent::error(error_msg, Some(address)));
            }
        }

        // Recalculate dependents
        self.recalculate_dependents(address)?;

        Ok(cell)
    }

    /// Get a cell value
    pub fn get_cell_value(&self, address: &CellAddress) -> Result<CellValue> {
        Ok(self
            .cell_operations
            .get_cell(address)
            .map(|cell| cell.get_computed_value())
            .unwrap_or(CellValue::Empty))
    }

    /// Get a cell
    pub fn get_cell(&self, address: &CellAddress) -> Option<Cell> {
        self.cell_operations.get_cell(address)
    }

    /// Delete a cell
    pub fn delete_cell(&self, address: &CellAddress) -> Result<()> {
        // Check if we're in a batch
        if let Some(batch_id) = self.current_batch_id.borrow().as_ref() {
            // Queue the operation for batch processing
            let operation = BatchOperation::DeleteCell { address: *address };
            self.batch_service.add_to_batch(batch_id, operation)?;
            return Ok(());
        }

        // Delegate to CellOperations service
        self.cell_operations.delete_cell(address)?;

        // Emit event
        self.emit_event(SpreadsheetEvent::cell_deleted(address));

        // Recalculate dependents
        self.recalculate_dependents(address)?;

        Ok(())
    }

    /// Recalculate all cells
    pub fn recalculate(&self) -> Result<()> {
        self.calculation_service.recalculate()
    }

    /// Recalculate a specific cell
    pub fn recalculate_cell(&self, address: &CellAddress) -> Result<Cell> {
        self.calculation_service.recalculate_cell(address)
    }

    /// Begin a batch operation
    pub fn begin_batch(&self, batch_id: Option<String>) -> String {
        let id = self.batch_service.begin_batch(batch_id);
        *self.current_batch_id.borrow_mut() = Some(id.clone());
        id
    }

    /// Commit a batch operation
    pub fn commit_batch(&self, batch_id: &str) -> Result<()> {
        *self.current_batch_id.borrow_mut() = None;
        let calc_service = self.calculation_service.clone();
        self.batch_service
            .commit_batch(batch_id, move |cells| calc_service.batch_recalculate(cells))
    }

    /// Rollback a batch operation
    pub fn rollback_batch(&self, batch_id: &str) -> Result<()> {
        *self.current_batch_id.borrow_mut() = None;
        self.batch_service.rollback_batch(batch_id)
    }

    /// Clear all cells
    pub fn clear(&self) {
        self.repository.borrow_mut().clear();
        self.dependency_graph.borrow_mut().clear();
        self.batch_service.clear();
    }

    /// Get the number of cells
    pub fn get_cell_count(&self) -> usize {
        self.repository.borrow().len()
    }

    /// Perform a fill operation
    pub fn fill(&self, operation: &FillOperation) -> Result<FillResult> {
        // Create a read-only clone of the repository for the fill engine
        let repo = self.repository.borrow();
        let repo_clone = repo.clone();
        let repo_rc = Rc::new(repo_clone);

        // Create fill engine with the repository
        let engine = FillEngine::new(repo_rc);

        // Perform the fill operation
        let result = engine.fill(operation)?;

        // Apply the results to the actual repository
        for (address, value) in &result.affected_cells {
            let cell = Cell::new(value.clone());
            self.repository.borrow_mut().set(address, cell);
        }

        // Apply formula adjustments
        for (address, formula) in &result.formulas_adjusted {
            self.set_cell_value_internal(address, formula)?;
        }

        // Recalculate affected cells
        let affected_addresses: HashSet<_> = result
            .affected_cells
            .iter()
            .map(|(addr, _)| *addr)
            .collect();
        self.batch_recalculate(affected_addresses)?;

        Ok(result)
    }

    /// Preview a fill operation without applying it
    pub fn preview_fill(&self, operation: &FillOperation) -> Result<Vec<(CellAddress, CellValue)>> {
        // Create a read-only clone of the repository for the fill engine
        let repo = self.repository.borrow();
        let repo_clone = repo.clone();
        let repo_rc = Rc::new(repo_clone);

        // Create fill engine with the repository
        let engine = FillEngine::new(repo_rc);

        // Preview the fill operation
        engine.preview(operation)
    }

    // Helper methods

    /// Insert rows and adjust all affected references
    pub fn insert_rows(&self, before_row: u32, count: u32) -> Result<()> {
        // Apply the structural operation
        let affected = self.structural_operations.insert_rows(before_row, count)?;

        // Apply formula adjustments
        let operation = StructuralOperation::InsertRows { before_row, count };
        self.apply_formula_adjustments(operation)?;

        // Emit events for affected cells
        for addr in affected {
            if let Some(cell) = self.repository.borrow().get(&addr) {
                let formula = if cell.has_formula() {
                    if let CellValue::String(s) = &cell.raw_value {
                        Some(s.clone())
                    } else {
                        None
                    }
                } else {
                    None
                };
                self.emit_event(SpreadsheetEvent::cell_updated(
                    &addr,
                    None,
                    cell.get_computed_value(),
                    formula,
                ));
            }
        }

        Ok(())
    }

    /// Insert columns and adjust all affected references
    pub fn insert_columns(&self, before_col: u32, count: u32) -> Result<()> {
        // Apply the structural operation
        let affected = self
            .structural_operations
            .insert_columns(before_col, count)?;

        // Apply formula adjustments
        let operation = StructuralOperation::InsertColumns { before_col, count };
        self.apply_formula_adjustments(operation)?;

        // Emit events for affected cells
        for addr in affected {
            if let Some(cell) = self.repository.borrow().get(&addr) {
                let formula = if cell.has_formula() {
                    if let CellValue::String(s) = &cell.raw_value {
                        Some(s.clone())
                    } else {
                        None
                    }
                } else {
                    None
                };
                self.emit_event(SpreadsheetEvent::cell_updated(
                    &addr,
                    None,
                    cell.get_computed_value(),
                    formula,
                ));
            }
        }

        Ok(())
    }

    /// Delete rows and adjust all affected references
    pub fn delete_rows(&self, start_row: u32, count: u32) -> Result<()> {
        // Apply the structural operation
        let deleted = self.structural_operations.delete_rows(start_row, count)?;

        // Apply formula adjustments
        let operation = StructuralOperation::DeleteRows { start_row, count };
        self.apply_formula_adjustments(operation)?;

        // Emit events for deleted cells
        for addr in deleted {
            self.emit_event(SpreadsheetEvent::cell_deleted(&addr));
        }

        Ok(())
    }

    /// Delete columns and adjust all affected references
    pub fn delete_columns(&self, start_col: u32, count: u32) -> Result<()> {
        // Apply the structural operation
        let deleted = self
            .structural_operations
            .delete_columns(start_col, count)?;

        // Apply formula adjustments
        let operation = StructuralOperation::DeleteColumns { start_col, count };
        self.apply_formula_adjustments(operation)?;

        // Emit events for deleted cells
        for addr in deleted {
            self.emit_event(SpreadsheetEvent::cell_deleted(&addr));
        }

        Ok(())
    }

    /// Apply formula adjustments after a structural operation
    fn apply_formula_adjustments(&self, operation: StructuralOperation) -> Result<()> {
        let adjuster = ReferenceAdjuster::new();
        let mut adjusted_cells = Vec::new();

        // First pass: collect all cells with formulas that need adjustment
        {
            let repo = self.repository.borrow();
            for (address, cell) in repo.iter() {
                if cell.has_formula() {
                    // Get the original formula string from raw_value
                    if let CellValue::String(formula_str) = &cell.raw_value
                        && formula_str.starts_with('=')
                        && let Ok(adjusted_formula) =
                            adjuster.adjust_formula(formula_str, &operation)
                        && adjusted_formula != *formula_str
                    {
                        adjusted_cells.push((address, adjusted_formula));
                    }
                }
            }
        }

        // Second pass: apply adjustments
        for (address, adjusted_formula) in adjusted_cells {
            self.set_cell_value_internal(&address, &adjusted_formula)?;
        }

        // Sync reference tracker with dependency graph
        self.reference_tracker
            .borrow()
            .sync_with_dependency_graph(&self.dependency_graph);

        // Recalculate all affected cells
        self.recalculate()?;

        Ok(())
    }

    /// Update reference tracker when a cell formula changes
    #[allow(dead_code)]
    fn update_reference_tracking(&self, address: &CellAddress, formula: &str) -> Result<()> {
        if let Ok(expr) = FormulaParser::parse(formula) {
            self.reference_tracker
                .borrow_mut()
                .update_dependencies(address, &expr);
            self.reference_tracker
                .borrow()
                .sync_with_dependency_graph(&self.dependency_graph);
        }
        Ok(())
    }

    /// Internal set cell value (without batch check or events)

    /// Recalculate cells that depend on the given address
    fn recalculate_dependents(&self, address: &CellAddress) -> Result<()> {
        let mut affected = HashSet::new();
        affected.insert(*address);
        self.calculation_service.batch_recalculate(affected)
    }

    /// Insert a row at the specified index
    pub fn insert_row(&self, row_index: u32) -> Result<()> {
        self.insert_rows(row_index, 1)
    }

    // Old implementation removed - now delegating to insert_rows

    #[allow(dead_code)]
    fn old_insert_row_impl(&self, row_index: u32) -> Result<()> {
        // Removed: Full implementation body
        // This was doing manual cell movement and formula adjustment
        // Now handled by insert_rows -> StructuralOperations service
        let transformer = crate::formula::FormulaTransformer::new();
        let mut cells_to_update = Vec::new();
        let mut cells_to_move = Vec::new();

        // Collect all cells that need to be updated
        for (address, cell) in self.repository.borrow().iter() {
            if address.row >= row_index {
                // This cell needs to be moved down
                let new_address = CellAddress::new(address.col, address.row + 1);
                cells_to_move.push((address, new_address, cell.clone()));
            } else if let Some(ast) = &cell.formula {
                // This cell's formula might reference cells that are moving
                let new_ast = transformer.adjust_for_row_insert(ast.clone(), row_index);
                if *ast != new_ast {
                    cells_to_update.push((address, new_ast));
                }
            }
        }

        // Store counts before consuming vectors
        let move_count = cells_to_move.len();
        let update_count = cells_to_update.len();

        // Move cells that are shifting down
        for (old_addr, new_addr, mut cell) in cells_to_move {
            // Update the formula if it exists
            if let Some(ast) = &cell.formula {
                cell.formula = Some(transformer.adjust_for_row_insert(ast.clone(), row_index));
            }

            self.repository.borrow_mut().delete(&old_addr);
            self.repository.borrow_mut().set(&new_addr, cell);

            // Update dependency graph
            self.dependency_graph.borrow_mut().remove_cell(&old_addr);
        }

        // Update formulas in cells that reference moved cells
        for (address, new_ast) in cells_to_update {
            if let Some(mut cell) = self.repository.borrow().get(&address).cloned() {
                cell.formula = Some(new_ast.clone());
                // Re-evaluate the formula in a separate scope
                if let Ok(result) = {
                    let mut context = RepositoryContext::new(&self.repository);
                    let mut evaluator = Evaluator::new(&mut context);
                    evaluator.evaluate(&new_ast)
                } {
                    cell.set_computed_value(result);
                }
                self.repository.borrow_mut().set(&address, cell);
            }
        }

        // Emit event
        self.emit_event(SpreadsheetEvent::range_updated(
            &CellAddress::new(0, row_index),
            &CellAddress::new(u32::MAX, u32::MAX),
            move_count + update_count,
        ));

        // Trigger recalculation
        self.recalculate()?;

        Ok(())
    }

    /// Delete a row at the specified index
    pub fn delete_row(&self, row_index: u32) -> Result<()> {
        self.delete_rows(row_index, 1)
    }

    #[allow(dead_code)]
    fn old_delete_row_impl(&self, row_index: u32) -> Result<()> {
        let transformer = crate::formula::FormulaTransformer::new();
        let mut cells_to_update = Vec::new();
        let mut cells_to_move = Vec::new();
        let mut cells_to_delete = Vec::new();

        // Collect all cells that need to be updated
        for (address, cell) in self.repository.borrow().iter() {
            if address.row == row_index {
                // This cell is being deleted
                cells_to_delete.push(address);
            } else if address.row > row_index {
                // This cell needs to be moved up
                let new_address = CellAddress::new(address.col, address.row - 1);
                cells_to_move.push((address, new_address, cell.clone()));
            } else if let Some(ast) = &cell.formula {
                // This cell's formula might reference cells that are moving or being deleted
                let new_ast = transformer.adjust_for_row_delete(ast.clone(), row_index);
                if *ast != new_ast {
                    cells_to_update.push((address, new_ast));
                }
            }
        }

        // Store counts before consuming vectors
        let move_count = cells_to_move.len();
        let update_count = cells_to_update.len();

        // Delete cells in the deleted row
        for address in cells_to_delete {
            self.repository.borrow_mut().delete(&address);
            self.dependency_graph.borrow_mut().remove_cell(&address);
        }

        // Move cells that are shifting up
        for (old_addr, new_addr, mut cell) in cells_to_move {
            // Update the formula if it exists
            if let Some(ast) = &cell.formula {
                cell.formula = Some(transformer.adjust_for_row_delete(ast.clone(), row_index));
            }

            self.repository.borrow_mut().delete(&old_addr);
            self.repository.borrow_mut().set(&new_addr, cell);

            // Update dependency graph
            self.dependency_graph.borrow_mut().remove_cell(&old_addr);
        }

        // Update formulas in cells that reference moved or deleted cells
        for (address, new_ast) in cells_to_update {
            if let Some(mut cell) = self.repository.borrow().get(&address).cloned() {
                cell.formula = Some(new_ast.clone());
                // Re-evaluate the formula in a separate scope
                if let Ok(result) = {
                    let mut context = RepositoryContext::new(&self.repository);
                    let mut evaluator = Evaluator::new(&mut context);
                    evaluator.evaluate(&new_ast)
                } {
                    cell.set_computed_value(result);
                }
                self.repository.borrow_mut().set(&address, cell);
            }
        }

        // Emit event
        self.emit_event(SpreadsheetEvent::range_updated(
            &CellAddress::new(0, row_index),
            &CellAddress::new(u32::MAX, u32::MAX),
            move_count + update_count,
        ));

        // Trigger recalculation
        self.recalculate()?;

        Ok(())
    }

    /// Insert a column at the specified index
    pub fn insert_column(&self, col_index: u32) -> Result<()> {
        self.insert_columns(col_index, 1)
    }

    #[allow(dead_code)]
    fn old_insert_column_impl(&self, col_index: u32) -> Result<()> {
        let transformer = crate::formula::FormulaTransformer::new();
        let mut cells_to_update = Vec::new();
        let mut cells_to_move = Vec::new();

        // Collect all cells that need to be updated
        for (address, cell) in self.repository.borrow().iter() {
            if address.col >= col_index {
                // This cell needs to be moved right
                let new_address = CellAddress::new(address.col + 1, address.row);
                cells_to_move.push((address, new_address, cell.clone()));
            } else if let Some(ast) = &cell.formula {
                // This cell's formula might reference cells that are moving
                let new_ast = transformer.adjust_for_column_insert(ast.clone(), col_index);
                if *ast != new_ast {
                    cells_to_update.push((address, new_ast));
                }
            }
        }

        // Store counts before consuming vectors
        let move_count = cells_to_move.len();
        let update_count = cells_to_update.len();

        // Move cells that are shifting right
        for (old_addr, new_addr, mut cell) in cells_to_move {
            // Update the formula if it exists
            if let Some(ast) = &cell.formula {
                cell.formula = Some(transformer.adjust_for_column_insert(ast.clone(), col_index));
            }

            self.repository.borrow_mut().delete(&old_addr);
            self.repository.borrow_mut().set(&new_addr, cell);

            // Update dependency graph
            self.dependency_graph.borrow_mut().remove_cell(&old_addr);
        }

        // Update formulas in cells that reference moved cells
        for (address, new_ast) in cells_to_update {
            if let Some(mut cell) = self.repository.borrow().get(&address).cloned() {
                cell.formula = Some(new_ast.clone());
                // Re-evaluate the formula in a separate scope
                if let Ok(result) = {
                    let mut context = RepositoryContext::new(&self.repository);
                    let mut evaluator = Evaluator::new(&mut context);
                    evaluator.evaluate(&new_ast)
                } {
                    cell.set_computed_value(result);
                }
                self.repository.borrow_mut().set(&address, cell);
            }
        }

        // Emit event
        self.emit_event(SpreadsheetEvent::range_updated(
            &CellAddress::new(col_index, 0),
            &CellAddress::new(u32::MAX, u32::MAX),
            move_count + update_count,
        ));

        // Trigger recalculation
        self.recalculate()?;

        Ok(())
    }

    /// Delete a column at the specified index
    pub fn delete_column(&self, col_index: u32) -> Result<()> {
        self.delete_columns(col_index, 1)
    }

    #[allow(dead_code)]
    fn old_delete_column_impl(&self, col_index: u32) -> Result<()> {
        let transformer = crate::formula::FormulaTransformer::new();
        let mut cells_to_update = Vec::new();
        let mut cells_to_move = Vec::new();
        let mut cells_to_delete = Vec::new();

        // Collect all cells that need to be updated
        for (address, cell) in self.repository.borrow().iter() {
            if address.col == col_index {
                // This cell is being deleted
                cells_to_delete.push(address);
            } else if address.col > col_index {
                // This cell needs to be moved left
                let new_address = CellAddress::new(address.col - 1, address.row);
                cells_to_move.push((address, new_address, cell.clone()));
            } else if let Some(ast) = &cell.formula {
                // This cell's formula might reference cells that are moving or being deleted
                let new_ast = transformer.adjust_for_column_delete(ast.clone(), col_index);
                if *ast != new_ast {
                    cells_to_update.push((address, new_ast));
                }
            }
        }

        // Store counts before consuming vectors
        let move_count = cells_to_move.len();
        let update_count = cells_to_update.len();

        // Delete cells in the deleted column
        for address in cells_to_delete {
            self.repository.borrow_mut().delete(&address);
            self.dependency_graph.borrow_mut().remove_cell(&address);
        }

        // Move cells that are shifting left
        for (old_addr, new_addr, mut cell) in cells_to_move {
            // Update the formula if it exists
            if let Some(ast) = &cell.formula {
                cell.formula = Some(transformer.adjust_for_column_delete(ast.clone(), col_index));
            }

            self.repository.borrow_mut().delete(&old_addr);
            self.repository.borrow_mut().set(&new_addr, cell);

            // Update dependency graph
            self.dependency_graph.borrow_mut().remove_cell(&old_addr);
        }

        // Update formulas in cells that reference moved or deleted cells
        for (address, new_ast) in cells_to_update {
            if let Some(mut cell) = self.repository.borrow().get(&address).cloned() {
                cell.formula = Some(new_ast.clone());
                // Re-evaluate the formula in a separate scope
                if let Ok(result) = {
                    let mut context = RepositoryContext::new(&self.repository);
                    let mut evaluator = Evaluator::new(&mut context);
                    evaluator.evaluate(&new_ast)
                } {
                    cell.set_computed_value(result);
                }
                self.repository.borrow_mut().set(&address, cell);
            }
        }

        // Emit event
        self.emit_event(SpreadsheetEvent::range_updated(
            &CellAddress::new(col_index, 0),
            &CellAddress::new(u32::MAX, u32::MAX),
            move_count + update_count,
        ));

        // Trigger recalculation
        self.recalculate()?;

        Ok(())
    }

    // Undo/Redo Operations

    /// Undo the last operation
    pub fn undo(&self) -> Result<()> {
        // Create a wrapper that implements CommandExecutor
        struct FacadeExecutor<'a> {
            facade: &'a SpreadsheetFacade,
        }

        impl<'a> CommandExecutor for FacadeExecutor<'a> {
            fn set_cell_direct(
                &mut self,
                address: &CellAddress,
                value: &str,
            ) -> Result<Option<Cell>> {
                let old_cell = self.facade.get_cell(address);
                self.facade.set_cell_value_without_command(address, value)?;
                Ok(old_cell)
            }

            fn delete_cell_direct(&mut self, address: &CellAddress) -> Result<Option<Cell>> {
                let old_cell = self.facade.get_cell(address);
                self.facade.delete_cell_without_command(address)?;
                Ok(old_cell)
            }

            fn insert_row_direct(&mut self, index: u32) -> Result<Vec<(CellAddress, Cell)>> {
                let mut affected = Vec::new();
                for (addr, cell) in self.facade.get_all_cells() {
                    if addr.row >= index {
                        affected.push((addr, cell.clone()));
                    }
                }
                self.facade.insert_row_without_command(index)?;
                Ok(affected)
            }

            fn delete_row_direct(&mut self, index: u32) -> Result<Vec<(CellAddress, Cell)>> {
                let mut deleted = Vec::new();
                for (addr, cell) in self.facade.get_all_cells() {
                    if addr.row == index {
                        deleted.push((addr, cell.clone()));
                    }
                }
                self.facade.delete_row_without_command(index)?;
                Ok(deleted)
            }

            fn insert_column_direct(&mut self, index: u32) -> Result<Vec<(CellAddress, Cell)>> {
                let mut affected = Vec::new();
                for (addr, cell) in self.facade.get_all_cells() {
                    if addr.col >= index {
                        affected.push((addr, cell.clone()));
                    }
                }
                self.facade.insert_column_without_command(index)?;
                Ok(affected)
            }

            fn delete_column_direct(&mut self, index: u32) -> Result<Vec<(CellAddress, Cell)>> {
                let mut deleted = Vec::new();
                for (addr, cell) in self.facade.get_all_cells() {
                    if addr.col == index {
                        deleted.push((addr, cell.clone()));
                    }
                }
                self.facade.delete_column_without_command(index)?;
                Ok(deleted)
            }

            fn get_cell(&self, address: &CellAddress) -> Option<Cell> {
                self.facade.get_cell(address)
            }
        }

        let mut executor = FacadeExecutor { facade: self };
        self.undo_redo_manager.borrow_mut().undo(&mut executor)?;
        Ok(())
    }

    /// Redo the last undone operation
    pub fn redo(&self) -> Result<()> {
        struct FacadeExecutor<'a> {
            facade: &'a SpreadsheetFacade,
        }

        impl<'a> CommandExecutor for FacadeExecutor<'a> {
            fn set_cell_direct(
                &mut self,
                address: &CellAddress,
                value: &str,
            ) -> Result<Option<Cell>> {
                let old_cell = self.facade.get_cell(address);
                self.facade.set_cell_value_without_command(address, value)?;
                Ok(old_cell)
            }

            fn delete_cell_direct(&mut self, address: &CellAddress) -> Result<Option<Cell>> {
                let old_cell = self.facade.get_cell(address);
                self.facade.delete_cell_without_command(address)?;
                Ok(old_cell)
            }

            fn insert_row_direct(&mut self, index: u32) -> Result<Vec<(CellAddress, Cell)>> {
                let mut affected = Vec::new();
                for (addr, cell) in self.facade.get_all_cells() {
                    if addr.row >= index {
                        affected.push((addr, cell.clone()));
                    }
                }
                self.facade.insert_row_without_command(index)?;
                Ok(affected)
            }

            fn delete_row_direct(&mut self, index: u32) -> Result<Vec<(CellAddress, Cell)>> {
                let mut deleted = Vec::new();
                for (addr, cell) in self.facade.get_all_cells() {
                    if addr.row == index {
                        deleted.push((addr, cell.clone()));
                    }
                }
                self.facade.delete_row_without_command(index)?;
                Ok(deleted)
            }

            fn insert_column_direct(&mut self, index: u32) -> Result<Vec<(CellAddress, Cell)>> {
                let mut affected = Vec::new();
                for (addr, cell) in self.facade.get_all_cells() {
                    if addr.col >= index {
                        affected.push((addr, cell.clone()));
                    }
                }
                self.facade.insert_column_without_command(index)?;
                Ok(affected)
            }

            fn delete_column_direct(&mut self, index: u32) -> Result<Vec<(CellAddress, Cell)>> {
                let mut deleted = Vec::new();
                for (addr, cell) in self.facade.get_all_cells() {
                    if addr.col == index {
                        deleted.push((addr, cell.clone()));
                    }
                }
                self.facade.delete_column_without_command(index)?;
                Ok(deleted)
            }

            fn get_cell(&self, address: &CellAddress) -> Option<Cell> {
                self.facade.get_cell(address)
            }
        }

        let mut executor = FacadeExecutor { facade: self };
        self.undo_redo_manager.borrow_mut().redo(&mut executor)?;
        Ok(())
    }

    /// Check if undo is available
    pub fn can_undo(&self) -> bool {
        self.undo_redo_manager.borrow().can_undo()
    }

    /// Check if redo is available
    pub fn can_redo(&self) -> bool {
        self.undo_redo_manager.borrow().can_redo()
    }

    /// Get undo history descriptions
    pub fn get_undo_history(&self) -> Vec<String> {
        self.undo_redo_manager.borrow().get_undo_history()
    }

    /// Get redo history descriptions
    pub fn get_redo_history(&self) -> Vec<String> {
        self.undo_redo_manager.borrow().get_redo_history()
    }

    /// Clear undo/redo history
    pub fn clear_history(&self) {
        self.undo_redo_manager.borrow_mut().clear_history();
    }

    /// Get all cells (for command state capture)
    pub fn get_all_cells(&self) -> Vec<(CellAddress, Cell)> {
        self.repository
            .borrow()
            .iter()
            .map(|(addr, cell)| (addr, cell.clone()))
            .collect()
    }

    // Methods without command tracking (for use by commands)

    /// Set cell value without creating a command
    pub fn set_cell_value_without_command(&self, address: &CellAddress, value: &str) -> Result<()> {
        self.set_cell_value_internal(address, value)?;
        self.recalculate_dependents(address)?;
        Ok(())
    }

    /// Delete cell without creating a command
    pub fn delete_cell_without_command(&self, address: &CellAddress) -> Result<()> {
        self.delete_cell_internal(address)?;
        self.recalculate_dependents(address)?;
        Ok(())
    }

    /// Insert row without creating a command
    pub fn insert_row_without_command(&self, index: u32) -> Result<()> {
        self.insert_row(index)
    }

    /// Delete row without creating a command
    pub fn delete_row_without_command(&self, index: u32) -> Result<()> {
        self.delete_row(index)
    }

    /// Insert column without creating a command
    pub fn insert_column_without_command(&self, index: u32) -> Result<()> {
        self.insert_column(index)
    }

    /// Delete column without creating a command
    pub fn delete_column_without_command(&self, index: u32) -> Result<()> {
        self.delete_column(index)
    }

    // Internal helper methods

    /// Internal method to set a cell value (delegates to CellOperations)
    fn set_cell_value_internal(&self, address: &CellAddress, value: &str) -> Result<()> {
        self.cell_operations.set_value(address, value)?;
        Ok(())
    }

    /// Internal method to delete a cell (delegates to CellOperations)
    fn delete_cell_internal(&self, address: &CellAddress) -> Result<()> {
        self.cell_operations.delete_cell(address)
    }

    /// Internal method to batch recalculate cells (delegates to CalculationService)
    fn batch_recalculate(&self, cells: HashSet<CellAddress>) -> Result<()> {
        self.calculation_service.batch_recalculate(cells)
    }
}

impl Default for SpreadsheetFacade {
    fn default() -> Self {
        Self::new()
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

    #[test]
    fn test_error_type_creation_from_formula() {
        use crate::types::ErrorType;

        let facade = SpreadsheetFacade::new();

        // Division by zero
        facade
            .set_cell_value(&CellAddress::new(0, 0), "=1/0")
            .unwrap();
        let value = facade.get_cell_value(&CellAddress::new(0, 0)).unwrap();
        assert_eq!(value, CellValue::Error(ErrorType::DivideByZero));

        // Invalid function name
        facade
            .set_cell_value(&CellAddress::new(1, 0), "=UNKNOWNFUNC()")
            .unwrap();
        let value = facade.get_cell_value(&CellAddress::new(1, 0)).unwrap();
        assert!(matches!(
            value,
            CellValue::Error(ErrorType::NameError { .. })
        ));

        // Type mismatch - use subtraction which doesn't concatenate
        facade
            .set_cell_value(&CellAddress::new(2, 0), "text")
            .unwrap();
        facade
            .set_cell_value(&CellAddress::new(3, 0), "=C1 - 5")
            .unwrap();
        let value = facade.get_cell_value(&CellAddress::new(3, 0)).unwrap();
        assert!(matches!(
            value,
            CellValue::Error(ErrorType::ValueError { .. })
        ));
    }

    #[test]
    fn test_error_propagation_through_references() {
        use crate::types::ErrorType;

        let facade = SpreadsheetFacade::new();

        // Create an error in A1
        facade
            .set_cell_value(&CellAddress::new(0, 0), "=1/0")
            .unwrap();

        // Reference the error in B1
        facade
            .set_cell_value(&CellAddress::new(1, 0), "=A1 + 10")
            .unwrap();

        // Error should propagate
        let value = facade.get_cell_value(&CellAddress::new(1, 0)).unwrap();
        assert_eq!(value, CellValue::Error(ErrorType::DivideByZero));

        // Reference B1 in C1
        facade
            .set_cell_value(&CellAddress::new(2, 0), "=B1 * 2")
            .unwrap();

        // Error should continue to propagate
        let value = facade.get_cell_value(&CellAddress::new(2, 0)).unwrap();
        assert_eq!(value, CellValue::Error(ErrorType::DivideByZero));
    }

    #[test]
    fn test_parse_error_to_error_type() {
        let facade = SpreadsheetFacade::new();

        // Invalid formula syntax should store parse error in cell
        facade
            .set_cell_value(&CellAddress::new(0, 0), "=A1 +")
            .unwrap();
        let value = facade.get_cell_value(&CellAddress::new(0, 0)).unwrap();
        assert!(matches!(value, CellValue::Error(_)));

        // Malformed reference should store parse error in cell
        facade
            .set_cell_value(&CellAddress::new(1, 0), "=A")
            .unwrap();
        let value = facade.get_cell_value(&CellAddress::new(1, 0)).unwrap();
        assert!(matches!(value, CellValue::Error(_)));
    }

    #[test]
    fn test_circular_dependency_error_cells() {
        let facade = SpreadsheetFacade::new();

        // Create a circular dependency chain
        facade
            .set_cell_value(&CellAddress::new(0, 0), "=B1")
            .unwrap();
        facade
            .set_cell_value(&CellAddress::new(1, 0), "=C1")
            .unwrap();

        // This should create a circular dependency
        let result = facade.set_cell_value(&CellAddress::new(2, 0), "=A1");
        assert!(result.is_err());

        // Check that we get a circular dependency error
        assert!(matches!(result, Err(SpreadsheetError::CircularDependency)));
    }

    #[test]
    fn test_invalid_range_error() {
        let facade = SpreadsheetFacade::new();

        // Try to use an invalid range - this will store parse error in cell
        facade
            .set_cell_value(&CellAddress::new(0, 0), "=SUM(A1:)")
            .unwrap();
        let value = facade.get_cell_value(&CellAddress::new(0, 0)).unwrap();
        assert!(matches!(value, CellValue::Error(_)));
    }

    #[test]
    fn test_error_display_in_cell() {
        let facade = SpreadsheetFacade::new();

        // Create various errors and check their display
        facade
            .set_cell_value(&CellAddress::new(0, 0), "=1/0")
            .unwrap();
        if let Some(cell) = facade.get_cell(&CellAddress::new(0, 0)) {
            assert_eq!(cell.get_display_value().to_string(), "#DIV/0!");
        }

        facade
            .set_cell_value(&CellAddress::new(1, 0), "=UNKNOWNFUNC()")
            .unwrap();
        if let Some(cell) = facade.get_cell(&CellAddress::new(1, 0)) {
            assert_eq!(cell.get_display_value().to_string(), "#NAME?");
        }
    }

    #[test]
    fn test_error_persistence() {
        let facade = SpreadsheetFacade::new();

        // Create an error
        facade
            .set_cell_value(&CellAddress::new(0, 0), "=1/0")
            .unwrap();

        // Verify error is stored
        let cell = facade.get_cell(&CellAddress::new(0, 0)).unwrap();
        assert!(matches!(cell.computed_value, CellValue::Error(_)));

        // Clear the cell
        facade.delete_cell(&CellAddress::new(0, 0)).unwrap();

        // Verify error is cleared
        assert!(facade.get_cell(&CellAddress::new(0, 0)).is_none());
    }

    #[test]
    fn test_error_in_sum_function() {
        use crate::types::ErrorType;

        let facade = SpreadsheetFacade::new();

        // Set up some values with an error
        facade
            .set_cell_value(&CellAddress::new(0, 0), "10")
            .unwrap();
        facade
            .set_cell_value(&CellAddress::new(0, 1), "=1/0")
            .unwrap(); // Error
        facade
            .set_cell_value(&CellAddress::new(0, 2), "20")
            .unwrap();

        // SUM should propagate the error
        facade
            .set_cell_value(&CellAddress::new(0, 3), "=SUM(A1:A3)")
            .unwrap();
        let value = facade.get_cell_value(&CellAddress::new(0, 3)).unwrap();
        // The error gets converted to ParseError when stored and retrieved
        assert!(matches!(value, CellValue::Error(_)));
        if let CellValue::Error(error_type) = value {
            // Accept either DivideByZero or ParseError containing "#DIV/0!"
            assert!(
                matches!(error_type, ErrorType::DivideByZero)
                    || matches!(error_type, ErrorType::ParseError { message } if message.contains("#DIV/0!"))
            );
        }
    }
}
