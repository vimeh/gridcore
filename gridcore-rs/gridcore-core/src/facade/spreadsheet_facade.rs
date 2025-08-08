use crate::command::{CommandExecutor, UndoRedoManager};
use crate::dependency::{DependencyAnalyzer, DependencyGraph};
use crate::domain::Cell;
use crate::evaluator::{EvaluationContext, Evaluator};
use crate::fill::{FillEngine, FillOperation, FillResult};
use crate::formula::FormulaParser;
use crate::references::{ReferenceAdjuster, ReferenceTracker, StructuralOperation};
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
    /// Reference tracker for formula reference management
    reference_tracker: RefCell<ReferenceTracker>,
    /// Batch manager for batch operations
    batch_manager: RefCell<BatchManager>,
    /// Event callbacks
    event_callbacks: RefCell<Vec<Box<dyn EventCallback>>>,
    /// Undo/redo manager
    undo_redo_manager: RefCell<UndoRedoManager>,
}

impl SpreadsheetFacade {
    /// Create a new spreadsheet facade
    pub fn new() -> Self {
        SpreadsheetFacade {
            repository: Rc::new(RefCell::new(CellRepository::new())),
            dependency_graph: Rc::new(RefCell::new(DependencyGraph::new())),
            reference_tracker: RefCell::new(ReferenceTracker::new()),
            batch_manager: RefCell::new(BatchManager::new()),
            event_callbacks: RefCell::new(Vec::new()),
            undo_redo_manager: RefCell::new(UndoRedoManager::new()),
        }
    }

    /// Create a facade with specific repositories (for sheet integration)
    pub fn with_repositories(
        repository: Rc<RefCell<CellRepository>>,
        dependency_graph: Rc<RefCell<DependencyGraph>>,
    ) -> Self {
        SpreadsheetFacade {
            repository,
            dependency_graph,
            reference_tracker: RefCell::new(ReferenceTracker::new()),
            batch_manager: RefCell::new(BatchManager::new()),
            event_callbacks: RefCell::new(Vec::new()),
            undo_redo_manager: RefCell::new(UndoRedoManager::new()),
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

            // Update reference tracker
            self.reference_tracker
                .borrow_mut()
                .update_dependencies(address, &ast);

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
            .map(|(addr, _)| addr.clone())
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

    /// Queue an operation for batch processing
    fn queue_batch_operation(&self, batch_id: &str, operation: BatchOperation) -> Result<()> {
        self.batch_manager
            .borrow_mut()
            .add_operation(batch_id, operation)
    }

    /// Insert rows and adjust all affected references
    pub fn insert_rows(&self, before_row: u32, count: u32) -> Result<()> {
        let operation = StructuralOperation::InsertRows { before_row, count };
        self.apply_structural_operation(operation)
    }

    /// Insert columns and adjust all affected references
    pub fn insert_columns(&self, before_col: u32, count: u32) -> Result<()> {
        let operation = StructuralOperation::InsertColumns { before_col, count };
        self.apply_structural_operation(operation)
    }

    /// Delete rows and adjust all affected references
    pub fn delete_rows(&self, start_row: u32, count: u32) -> Result<()> {
        let operation = StructuralOperation::DeleteRows { start_row, count };
        self.apply_structural_operation(operation)
    }

    /// Delete columns and adjust all affected references
    pub fn delete_columns(&self, start_col: u32, count: u32) -> Result<()> {
        let operation = StructuralOperation::DeleteColumns { start_col, count };
        self.apply_structural_operation(operation)
    }

    /// Apply a structural operation and adjust all formulas
    fn apply_structural_operation(&self, operation: StructuralOperation) -> Result<()> {
        let adjuster = ReferenceAdjuster::new();
        let mut adjusted_cells = Vec::new();

        // First pass: collect all cells with formulas that need adjustment
        {
            let repo = self.repository.borrow();
            for (address, cell) in repo.iter() {
                if cell.has_formula() {
                    // Get the original formula string from raw_value
                    if let CellValue::String(formula_str) = &cell.raw_value {
                        if formula_str.starts_with('=') {
                            if let Ok(adjusted_formula) =
                                adjuster.adjust_formula(formula_str, &operation)
                            {
                                if adjusted_formula != *formula_str {
                                    adjusted_cells.push((address.clone(), adjusted_formula));
                                }
                            }
                        }
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

    /// Insert a row at the specified index
    pub fn insert_row(&self, row_index: u32) -> Result<()> {
        let transformer = crate::formula::FormulaTransformer::new();
        let mut cells_to_update = Vec::new();
        let mut cells_to_move = Vec::new();

        // Collect all cells that need to be updated
        for (address, cell) in self.repository.borrow().iter() {
            if address.row >= row_index {
                // This cell needs to be moved down
                let new_address = CellAddress::new(address.col, address.row + 1);
                cells_to_move.push((address.clone(), new_address, cell.clone()));
            } else if let Some(ast) = &cell.formula {
                // This cell's formula might reference cells that are moving
                let new_ast = transformer.adjust_for_row_insert(ast.clone(), row_index);
                if *ast != new_ast {
                    cells_to_update.push((address.clone(), new_ast));
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
                // Re-evaluate the formula
                let mut context = RepositoryContext::new(&self.repository);
                let mut evaluator = Evaluator::new(&mut context);
                if let Ok(result) = evaluator.evaluate(&new_ast) {
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
        let transformer = crate::formula::FormulaTransformer::new();
        let mut cells_to_update = Vec::new();
        let mut cells_to_move = Vec::new();
        let mut cells_to_delete = Vec::new();

        // Collect all cells that need to be updated
        for (address, cell) in self.repository.borrow().iter() {
            if address.row == row_index {
                // This cell is being deleted
                cells_to_delete.push(address.clone());
            } else if address.row > row_index {
                // This cell needs to be moved up
                let new_address = CellAddress::new(address.col, address.row - 1);
                cells_to_move.push((address.clone(), new_address, cell.clone()));
            } else if let Some(ast) = &cell.formula {
                // This cell's formula might reference cells that are moving or being deleted
                let new_ast = transformer.adjust_for_row_delete(ast.clone(), row_index);
                if *ast != new_ast {
                    cells_to_update.push((address.clone(), new_ast));
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
                // Re-evaluate the formula
                let mut context = RepositoryContext::new(&self.repository);
                let mut evaluator = Evaluator::new(&mut context);
                if let Ok(result) = evaluator.evaluate(&new_ast) {
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
        let transformer = crate::formula::FormulaTransformer::new();
        let mut cells_to_update = Vec::new();
        let mut cells_to_move = Vec::new();

        // Collect all cells that need to be updated
        for (address, cell) in self.repository.borrow().iter() {
            if address.col >= col_index {
                // This cell needs to be moved right
                let new_address = CellAddress::new(address.col + 1, address.row);
                cells_to_move.push((address.clone(), new_address, cell.clone()));
            } else if let Some(ast) = &cell.formula {
                // This cell's formula might reference cells that are moving
                let new_ast = transformer.adjust_for_column_insert(ast.clone(), col_index);
                if *ast != new_ast {
                    cells_to_update.push((address.clone(), new_ast));
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
                // Re-evaluate the formula
                let mut context = RepositoryContext::new(&self.repository);
                let mut evaluator = Evaluator::new(&mut context);
                if let Ok(result) = evaluator.evaluate(&new_ast) {
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
        let transformer = crate::formula::FormulaTransformer::new();
        let mut cells_to_update = Vec::new();
        let mut cells_to_move = Vec::new();
        let mut cells_to_delete = Vec::new();

        // Collect all cells that need to be updated
        for (address, cell) in self.repository.borrow().iter() {
            if address.col == col_index {
                // This cell is being deleted
                cells_to_delete.push(address.clone());
            } else if address.col > col_index {
                // This cell needs to be moved left
                let new_address = CellAddress::new(address.col - 1, address.row);
                cells_to_move.push((address.clone(), new_address, cell.clone()));
            } else if let Some(ast) = &cell.formula {
                // This cell's formula might reference cells that are moving or being deleted
                let new_ast = transformer.adjust_for_column_delete(ast.clone(), col_index);
                if *ast != new_ast {
                    cells_to_update.push((address.clone(), new_ast));
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
                // Re-evaluate the formula
                let mut context = RepositoryContext::new(&self.repository);
                let mut evaluator = Evaluator::new(&mut context);
                if let Ok(result) = evaluator.evaluate(&new_ast) {
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
                        affected.push((addr.clone(), cell.clone()));
                    }
                }
                self.facade.insert_row_without_command(index)?;
                Ok(affected)
            }

            fn delete_row_direct(&mut self, index: u32) -> Result<Vec<(CellAddress, Cell)>> {
                let mut deleted = Vec::new();
                for (addr, cell) in self.facade.get_all_cells() {
                    if addr.row == index {
                        deleted.push((addr.clone(), cell.clone()));
                    }
                }
                self.facade.delete_row_without_command(index)?;
                Ok(deleted)
            }

            fn insert_column_direct(&mut self, index: u32) -> Result<Vec<(CellAddress, Cell)>> {
                let mut affected = Vec::new();
                for (addr, cell) in self.facade.get_all_cells() {
                    if addr.col >= index {
                        affected.push((addr.clone(), cell.clone()));
                    }
                }
                self.facade.insert_column_without_command(index)?;
                Ok(affected)
            }

            fn delete_column_direct(&mut self, index: u32) -> Result<Vec<(CellAddress, Cell)>> {
                let mut deleted = Vec::new();
                for (addr, cell) in self.facade.get_all_cells() {
                    if addr.col == index {
                        deleted.push((addr.clone(), cell.clone()));
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
                        affected.push((addr.clone(), cell.clone()));
                    }
                }
                self.facade.insert_row_without_command(index)?;
                Ok(affected)
            }

            fn delete_row_direct(&mut self, index: u32) -> Result<Vec<(CellAddress, Cell)>> {
                let mut deleted = Vec::new();
                for (addr, cell) in self.facade.get_all_cells() {
                    if addr.row == index {
                        deleted.push((addr.clone(), cell.clone()));
                    }
                }
                self.facade.delete_row_without_command(index)?;
                Ok(deleted)
            }

            fn insert_column_direct(&mut self, index: u32) -> Result<Vec<(CellAddress, Cell)>> {
                let mut affected = Vec::new();
                for (addr, cell) in self.facade.get_all_cells() {
                    if addr.col >= index {
                        affected.push((addr.clone(), cell.clone()));
                    }
                }
                self.facade.insert_column_without_command(index)?;
                Ok(affected)
            }

            fn delete_column_direct(&mut self, index: u32) -> Result<Vec<(CellAddress, Cell)>> {
                let mut deleted = Vec::new();
                for (addr, cell) in self.facade.get_all_cells() {
                    if addr.col == index {
                        deleted.push((addr.clone(), cell.clone()));
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
            .map(|(addr, cell)| (addr.clone(), cell.clone()))
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
