use crate::Result;
use crate::dependency::DependencyGraph;
use crate::domain::Cell;
use crate::evaluator::{Evaluator, context::BasicContext};
use crate::formula::FormulaParser;
use crate::references::ReferenceTracker;
use crate::repository::CellRepository;
use crate::types::{CellAddress, CellValue};
use std::cell::RefCell;
use std::collections::HashSet;
use std::rc::Rc;

/// Service for handling cell-specific operations
pub struct CellOperations {
    repository: Rc<RefCell<CellRepository>>,
    dependency_graph: Rc<RefCell<DependencyGraph>>,
    reference_tracker: Rc<RefCell<ReferenceTracker>>,
}

impl CellOperations {
    /// Create a new CellOperations service
    pub fn new(
        repository: Rc<RefCell<CellRepository>>,
        dependency_graph: Rc<RefCell<DependencyGraph>>,
    ) -> Self {
        CellOperations {
            repository,
            dependency_graph,
            reference_tracker: Rc::new(RefCell::new(ReferenceTracker::new())),
        }
    }

    /// Set a cell value (formula or direct value)
    pub fn set_cell(&self, address: &CellAddress, value: &str) -> Result<Cell> {
        if value.starts_with('=') {
            self.set_formula(address, value)
        } else {
            self.set_value(address, value)
        }
    }

    /// Set a direct value to a cell
    pub fn set_value(&self, address: &CellAddress, value: &str) -> Result<Cell> {
        let cell_value = self.parse_value(value);
        let cell = Cell::new(cell_value);

        self.repository.borrow_mut().set(address, cell.clone());
        self.dependency_graph.borrow_mut().remove_cell(address);

        Ok(cell)
    }

    /// Set a formula to a cell
    pub fn set_formula(&self, address: &CellAddress, formula: &str) -> Result<Cell> {
        let parsed = FormulaParser::parse(formula)?;

        // Extract references from the parsed expression
        let parser = crate::references::ReferenceParser::new();
        let references = parser.extract_from_expr(&parsed);

        // Add dependencies one by one
        for dep in &references {
            self.dependency_graph
                .borrow_mut()
                .add_dependency(*address, *dep);
        }

        // Create evaluation context
        let mut context = BasicContext::new();
        let mut evaluator = Evaluator::new(&mut context);

        // Evaluate the formula
        let value = evaluator.evaluate(&parsed)?;

        // Create the cell with formula
        let mut cell = Cell::with_formula(CellValue::String(formula.to_string()), parsed);
        cell.set_computed_value(value);

        self.repository.borrow_mut().set(address, cell.clone());

        Ok(cell)
    }

    /// Get a cell
    pub fn get_cell(&self, address: &CellAddress) -> Option<Cell> {
        self.repository.borrow().get(address).cloned()
    }

    /// Delete a cell
    pub fn delete_cell(&self, address: &CellAddress) -> Result<()> {
        self.repository.borrow_mut().delete(address);
        self.dependency_graph.borrow_mut().remove_cell(address);
        Ok(())
    }

    /// Clear a range of cells
    pub fn clear_range(&self, start: &CellAddress, end: &CellAddress) -> Result<Vec<CellAddress>> {
        let mut cleared = Vec::new();

        for row in start.row..=end.row {
            for col in start.col..=end.col {
                let addr = CellAddress::new(col, row);
                if self.repository.borrow().get(&addr).is_some() {
                    self.delete_cell(&addr)?;
                    cleared.push(addr);
                }
            }
        }

        Ok(cleared)
    }

    /// Copy cells from source to target range
    pub fn copy_range(
        &self,
        source_start: &CellAddress,
        source_end: &CellAddress,
        target_start: &CellAddress,
    ) -> Result<Vec<(CellAddress, Cell)>> {
        let mut copied = Vec::new();
        let row_offset = target_start.row as i32 - source_start.row as i32;
        let col_offset = target_start.col as i32 - source_start.col as i32;

        for row in source_start.row..=source_end.row {
            for col in source_start.col..=source_end.col {
                let source_addr = CellAddress::new(col, row);

                if let Some(cell) = self.repository.borrow().get(&source_addr) {
                    let target_row = (row as i32 + row_offset) as u32;
                    let target_col = (col as i32 + col_offset) as u32;
                    let target_addr = CellAddress::new(target_col, target_row);

                    // Clone the cell and adjust formulas if needed
                    let new_cell = cell.clone();
                    // TODO: Adjust formula references based on offset

                    self.repository
                        .borrow_mut()
                        .set(&target_addr, new_cell.clone());
                    copied.push((target_addr, new_cell));
                }
            }
        }

        Ok(copied)
    }

    /// Get all cells that depend on the given cell
    pub fn get_dependents(&self, address: &CellAddress) -> HashSet<CellAddress> {
        self.dependency_graph
            .borrow()
            .get_dependents(address)
            .into_iter()
            .collect()
    }

    /// Get all cells that the given cell depends on
    pub fn get_dependencies(&self, address: &CellAddress) -> HashSet<CellAddress> {
        self.dependency_graph
            .borrow()
            .get_dependencies(address)
            .into_iter()
            .collect()
    }

    /// Parse a string value into a CellValue
    fn parse_value(&self, value: &str) -> CellValue {
        if value.is_empty() {
            return CellValue::Empty;
        }

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

        // Default to string
        CellValue::String(value.to_string())
    }

    /// Recalculate all cells that depend on the given cells
    pub fn recalculate_dependents(&self, addresses: &[CellAddress]) -> Result<Vec<CellAddress>> {
        let mut recalculated = Vec::new();
        let mut to_recalc = HashSet::new();

        // Collect all dependents
        for addr in addresses {
            for dependent in self.dependency_graph.borrow().get_dependents(addr) {
                to_recalc.insert(dependent);
            }
        }

        // Recalculate in topological order
        let sorted = self.dependency_graph.borrow().get_calculation_order()?;
        for addr in sorted {
            if to_recalc.contains(&addr) {
                if let Some(cell) = self.repository.borrow().get(&addr) {
                    if cell.has_formula() {
                        // Re-evaluate the formula
                        if let Some(formula_expr) = &cell.formula {
                            let mut context = BasicContext::new();
                            let mut evaluator = Evaluator::new(&mut context);
                            let value = evaluator.evaluate(formula_expr)?;

                            let mut new_cell = cell.clone();
                            new_cell.set_computed_value(value);

                            self.repository.borrow_mut().set(&addr, new_cell);
                            recalculated.push(addr);
                        }
                    }
                }
            }
        }

        Ok(recalculated)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_service() -> CellOperations {
        let repository = Rc::new(RefCell::new(CellRepository::new()));
        let dependency_graph = Rc::new(RefCell::new(DependencyGraph::new()));
        CellOperations::new(repository, dependency_graph)
    }

    #[test]
    fn test_set_value() {
        let service = create_test_service();
        let addr = CellAddress::new(0, 0); // col, row

        let cell = service.set_value(&addr, "42").unwrap();
        assert_eq!(cell.get_computed_value(), CellValue::Number(42.0));

        let cell = service.set_value(&addr, "hello").unwrap();
        assert_eq!(
            cell.get_computed_value(),
            CellValue::String("hello".to_string())
        );
    }

    #[test]
    fn test_delete_cell() {
        let service = create_test_service();
        let addr = CellAddress::new(0, 0); // col, row

        service.set_value(&addr, "42").unwrap();
        assert!(service.get_cell(&addr).is_some());

        service.delete_cell(&addr).unwrap();
        assert!(service.get_cell(&addr).is_none());
    }

    #[test]
    fn test_clear_range() {
        let service = create_test_service();

        // Set some cells
        for row in 0..3 {
            for col in 0..3 {
                let addr = CellAddress::new(col, row); // col, row
                service
                    .set_value(&addr, &format!("{},{}", row, col))
                    .unwrap();
            }
        }

        // Clear a range
        let start = CellAddress::new(0, 0); // col, row
        let end = CellAddress::new(1, 1); // col, row
        let cleared = service.clear_range(&start, &end).unwrap();

        assert_eq!(cleared.len(), 4);
        assert!(service.get_cell(&CellAddress::new(0, 0)).is_none());
        assert!(service.get_cell(&CellAddress::new(2, 2)).is_some()); // col, row
    }
}
