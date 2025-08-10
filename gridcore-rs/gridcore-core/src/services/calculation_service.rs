use crate::dependency::DependencyGraph;
use crate::domain::Cell;
use crate::evaluator::{EvaluationContext, Evaluator};
use crate::facade::event::SpreadsheetEvent;
use crate::repository::CellRepository;
use crate::services::EventManager;
use crate::types::{CellAddress, CellValue};
use crate::{Result, SpreadsheetError};
use std::cell::RefCell;
use std::collections::HashSet;
use std::rc::Rc;
use std::time::Instant;

/// Service for managing spreadsheet calculations and recalculations
pub struct CalculationService {
    repository: Rc<RefCell<CellRepository>>,
    dependency_graph: Rc<RefCell<DependencyGraph>>,
    event_manager: Rc<EventManager>,
}

impl CalculationService {
    /// Create a new calculation service
    pub fn new(
        repository: Rc<RefCell<CellRepository>>,
        dependency_graph: Rc<RefCell<DependencyGraph>>,
        event_manager: Rc<EventManager>,
    ) -> Self {
        CalculationService {
            repository,
            dependency_graph,
            event_manager,
        }
    }

    /// Recalculate all cells in dependency order
    pub fn recalculate(&self) -> Result<()> {
        let start = Instant::now();

        // Get calculation order
        let order = self.dependency_graph.borrow().get_calculation_order()?;

        // Emit calculation started event
        let affected_cells: Vec<String> = order.iter().map(|a| a.to_string()).collect();
        self.event_manager
            .emit(SpreadsheetEvent::calculation_started(
                affected_cells.clone(),
            ));

        // Recalculate each cell in order
        for address in &order {
            self.recalculate_single_cell(address)?;
        }

        // Emit calculation completed event
        let duration_ms = start.elapsed().as_millis() as u64;
        self.event_manager
            .emit(SpreadsheetEvent::calculation_completed(
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
            // Evaluate in a separate scope to ensure context is dropped before mutable borrow
            let result = {
                let mut context = RepositoryContext::new(&self.repository);
                let mut evaluator = Evaluator::new(&mut context);
                evaluator.evaluate(ast)?
            };
            cell.set_computed_value(result);
            self.repository.borrow_mut().set(address, cell.clone());
        }

        Ok(cell)
    }

    /// Batch recalculate a set of cells and their dependents
    pub fn batch_recalculate(&self, cells: HashSet<CellAddress>) -> Result<()> {
        // Collect all cells that need recalculation (including dependents)
        let mut to_recalculate = HashSet::new();
        for cell in cells {
            to_recalculate.insert(cell);
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
            self.recalculate_single_cell(&address)?;
        }

        Ok(())
    }

    /// Recalculate a single cell (internal helper)
    fn recalculate_single_cell(&self, address: &CellAddress) -> Result<()> {
        // Get the cell, ensuring the borrow is dropped immediately
        let cell_opt = self.repository.borrow().get(address).cloned();
        if let Some(mut cell) = cell_opt
            && let Some(ast) = &cell.formula
        {
            // Evaluate in a separate scope to ensure context is dropped before mutable borrow
            let result = {
                let mut context = RepositoryContext::new(&self.repository);
                // Push the current cell to the evaluation stack for circular reference detection
                context.push_evaluation(address);
                let mut evaluator = Evaluator::new(&mut context);
                // Try to evaluate, but store error values if evaluation fails
                let eval_result = match evaluator.evaluate(ast) {
                    Ok(val) => val,
                    Err(e) => CellValue::Error(e.to_error_type()),
                };
                // Pop the current cell from the evaluation stack
                context.pop_evaluation(address);
                eval_result
            };
            cell.set_computed_value(result);
            self.repository.borrow_mut().set(address, cell);
        }
        Ok(())
    }

    /// Recursively collect all dependents of a cell
    fn collect_all_dependents(&self, address: &CellAddress, collected: &mut HashSet<CellAddress>) {
        let dependents = self.dependency_graph.borrow().get_dependents(address);
        for dependent in dependents {
            if collected.insert(dependent) {
                self.collect_all_dependents(&dependent, collected);
            }
        }
    }
}

/// Evaluation context that uses the cell repository
pub struct RepositoryContext<'a> {
    repository: &'a Rc<RefCell<CellRepository>>,
    evaluation_stack: RefCell<HashSet<CellAddress>>,
}

impl<'a> RepositoryContext<'a> {
    pub fn new(repository: &'a Rc<RefCell<CellRepository>>) -> Self {
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
        self.evaluation_stack.borrow_mut().insert(*address);
    }

    fn pop_evaluation(&mut self, address: &CellAddress) {
        self.evaluation_stack.borrow_mut().remove(address);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::Cell;
    use crate::facade::event::EventCollector;
    use crate::formula::FormulaParser;

    #[test]
    fn test_calculation_service() {
        let repository = Rc::new(RefCell::new(CellRepository::new()));
        let dependency_graph = Rc::new(RefCell::new(DependencyGraph::new()));
        let event_manager = Rc::new(EventManager::new());

        let calc_service = CalculationService::new(
            repository.clone(),
            dependency_graph.clone(),
            event_manager.clone(),
        );

        // Add event collector
        let collector = EventCollector::new();
        event_manager.add_callback(Box::new(collector.clone()));

        // Set up cells with values
        let a1 = CellAddress::new(0, 0);
        let b1 = CellAddress::new(1, 0);

        repository
            .borrow_mut()
            .set(&a1, Cell::new(CellValue::Number(10.0)));
        repository
            .borrow_mut()
            .set(&b1, Cell::new(CellValue::Number(20.0)));

        // Add a formula cell
        let c1 = CellAddress::new(2, 0);
        let ast = FormulaParser::parse("A1+B1").unwrap();
        let formula_cell = Cell::with_formula(CellValue::Empty, ast.clone());
        repository.borrow_mut().set(&c1, formula_cell);

        // Set up dependencies (c1 depends on a1 and b1)
        dependency_graph.borrow_mut().add_dependency(c1, a1);
        dependency_graph.borrow_mut().add_dependency(c1, b1);

        // Recalculate
        calc_service.recalculate().unwrap();

        // Check result
        let result_cell = repository.borrow().get(&c1).cloned().unwrap();
        assert_eq!(result_cell.get_computed_value(), CellValue::Number(30.0));

        // Check events
        let events = collector.get_events();
        assert_eq!(events.len(), 2); // calculation_started and calculation_completed
    }

    #[test]
    fn test_batch_recalculate() {
        let repository = Rc::new(RefCell::new(CellRepository::new()));
        let dependency_graph = Rc::new(RefCell::new(DependencyGraph::new()));
        let event_manager = Rc::new(EventManager::new());

        let calc_service =
            CalculationService::new(repository.clone(), dependency_graph.clone(), event_manager);

        // Set up cells
        let a1 = CellAddress::new(0, 0);
        let b1 = CellAddress::new(1, 0);
        let c1 = CellAddress::new(2, 0);

        repository
            .borrow_mut()
            .set(&a1, Cell::new(CellValue::Number(5.0)));
        repository
            .borrow_mut()
            .set(&b1, Cell::new(CellValue::Number(10.0)));

        // Add formula cell
        let ast = FormulaParser::parse("A1*B1").unwrap();
        let formula_cell = Cell::with_formula(CellValue::Empty, ast);
        repository.borrow_mut().set(&c1, formula_cell);

        // Set up dependencies (c1 depends on a1 and b1)
        dependency_graph.borrow_mut().add_dependency(c1, a1);
        dependency_graph.borrow_mut().add_dependency(c1, b1);

        // Batch recalculate
        let mut affected = HashSet::new();
        affected.insert(a1);
        calc_service.batch_recalculate(affected).unwrap();

        // Check result
        let result_cell = repository.borrow().get(&c1).cloned().unwrap();
        assert_eq!(result_cell.get_computed_value(), CellValue::Number(50.0));
    }
}
