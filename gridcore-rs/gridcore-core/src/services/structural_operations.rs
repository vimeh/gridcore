use crate::Result;
use crate::dependency::DependencyGraph;
use crate::references::{ReferenceAdjuster, StructuralOperation};
use crate::repository::CellRepository;
use crate::types::CellAddress;
use std::cell::RefCell;
use std::rc::Rc;

/// Service for handling structural operations (insert/delete rows/columns)
pub struct StructuralOperations {
    repository: Rc<RefCell<CellRepository>>,
    dependency_graph: Rc<RefCell<DependencyGraph>>,
    reference_adjuster: ReferenceAdjuster,
}

impl StructuralOperations {
    /// Create a new StructuralOperations service
    pub fn new(
        repository: Rc<RefCell<CellRepository>>,
        dependency_graph: Rc<RefCell<DependencyGraph>>,
    ) -> Self {
        StructuralOperations {
            repository,
            dependency_graph,
            reference_adjuster: ReferenceAdjuster::new(),
        }
    }

    /// Insert rows at the specified index
    pub fn insert_rows(&self, index: u32, count: u32) -> Result<Vec<CellAddress>> {
        if count == 0 {
            return Ok(Vec::new());
        }

        let operation = StructuralOperation::InsertRows {
            before_row: index,
            count,
        };
        self.apply_structural_operation(operation)
    }

    /// Insert columns at the specified index
    pub fn insert_columns(&self, index: u32, count: u32) -> Result<Vec<CellAddress>> {
        if count == 0 {
            return Ok(Vec::new());
        }

        let operation = StructuralOperation::InsertColumns {
            before_col: index,
            count,
        };
        self.apply_structural_operation(operation)
    }

    /// Delete rows starting from the specified row
    pub fn delete_rows(&self, start_row: u32, count: u32) -> Result<Vec<CellAddress>> {
        if count == 0 {
            return Ok(Vec::new());
        }

        let operation = StructuralOperation::DeleteRows { start_row, count };

        // Collect cells to be deleted
        let mut deleted_cells = Vec::new();
        for row in start_row..(start_row + count) {
            let cells = self.get_cells_in_row(row);
            deleted_cells.extend(cells);
        }

        // Delete the cells
        for addr in &deleted_cells {
            self.repository.borrow_mut().delete(addr);
            self.dependency_graph.borrow_mut().remove_cell(addr);
        }

        // Apply the operation to adjust remaining cells
        self.apply_structural_operation(operation)?;

        Ok(deleted_cells)
    }

    /// Delete columns starting from the specified column
    pub fn delete_columns(&self, start_col: u32, count: u32) -> Result<Vec<CellAddress>> {
        if count == 0 {
            return Ok(Vec::new());
        }

        let operation = StructuralOperation::DeleteColumns { start_col, count };

        // Collect cells to be deleted
        let mut deleted_cells = Vec::new();
        for col in start_col..(start_col + count) {
            let cells = self.get_cells_in_column(col);
            deleted_cells.extend(cells);
        }

        // Delete the cells
        for addr in &deleted_cells {
            self.repository.borrow_mut().delete(addr);
            self.dependency_graph.borrow_mut().remove_cell(addr);
        }

        // Apply the operation to adjust remaining cells
        self.apply_structural_operation(operation)?;

        Ok(deleted_cells)
    }

    /// Apply a structural operation to the spreadsheet
    fn apply_structural_operation(
        &self,
        operation: StructuralOperation,
    ) -> Result<Vec<CellAddress>> {
        let mut affected_addresses = Vec::new();

        // Get all cells that need to be moved/adjusted
        let all_cells: Vec<(CellAddress, _)> = self
            .repository
            .borrow()
            .iter()
            .map(|(addr, cell)| (addr, cell.clone()))
            .collect();

        // Create a new repository with adjusted cells
        let mut new_cells = Vec::new();

        for (addr, cell) in all_cells {
            if let Some(new_addr) = self.adjust_address(&addr, &operation) {
                // Adjust formula references if the cell has a formula
                let adjusted_cell = cell.clone();
                // TODO: Implement formula adjustment when cell has a formula

                new_cells.push((new_addr, adjusted_cell));
                affected_addresses.push(new_addr);
            }
        }

        // Clear the repository and re-add all cells with new addresses
        self.repository.borrow_mut().clear();
        for (addr, cell) in new_cells {
            self.repository.borrow_mut().set(&addr, cell);
        }

        // Update dependency graph
        self.rebuild_dependency_graph()?;

        Ok(affected_addresses)
    }

    /// Adjust a cell address based on a structural operation
    fn adjust_address(
        &self,
        address: &CellAddress,
        operation: &StructuralOperation,
    ) -> Option<CellAddress> {
        match operation {
            StructuralOperation::InsertRows { before_row, count } => {
                if address.row >= *before_row {
                    Some(CellAddress::new(address.col, address.row + count))
                } else {
                    Some(*address)
                }
            }
            StructuralOperation::InsertColumns { before_col, count } => {
                if address.col >= *before_col {
                    Some(CellAddress::new(address.col + count, address.row))
                } else {
                    Some(*address)
                }
            }
            StructuralOperation::DeleteRows { start_row, count } => {
                if address.row >= *start_row && address.row < *start_row + *count {
                    None // Cell is deleted
                } else if address.row >= *start_row + *count {
                    Some(CellAddress::new(address.col, address.row - count))
                } else {
                    Some(*address)
                }
            }
            StructuralOperation::DeleteColumns { start_col, count } => {
                if address.col >= *start_col && address.col < *start_col + *count {
                    None // Cell is deleted
                } else if address.col >= *start_col + *count {
                    Some(CellAddress::new(address.col - count, address.row))
                } else {
                    Some(*address)
                }
            }
            StructuralOperation::MoveRange { from: _, to: _ } => {
                // MoveRange is handled differently - not a simple address adjustment
                // This would be handled at a higher level
                Some(*address)
            }
        }
    }

    /// Get all cells in a specific row
    fn get_cells_in_row(&self, row: u32) -> Vec<CellAddress> {
        self.repository
            .borrow()
            .iter()
            .filter_map(|(addr, _)| if addr.row == row { Some(addr) } else { None })
            .collect()
    }

    /// Get all cells in a specific column
    fn get_cells_in_column(&self, column: u32) -> Vec<CellAddress> {
        self.repository
            .borrow()
            .iter()
            .filter_map(
                |(addr, _)| {
                    if addr.col == column { Some(addr) } else { None }
                },
            )
            .collect()
    }

    /// Rebuild the dependency graph after a structural operation
    fn rebuild_dependency_graph(&self) -> Result<()> {
        self.dependency_graph.borrow_mut().clear();

        // Re-add all dependencies
        let cells: Vec<_> = self
            .repository
            .borrow()
            .iter()
            .map(|(addr, cell)| (addr, cell.clone()))
            .collect();

        for (addr, cell) in cells {
            if cell.has_formula() {
                // Extract references from the formula AST
                if let Some(formula_expr) = &cell.formula {
                    let parser = crate::references::ReferenceParser::new();
                    let references = parser.extract_from_expr(formula_expr);
                    for dep in &references {
                        self.dependency_graph
                            .borrow_mut()
                            .add_dependency(addr, *dep);
                    }
                }
            }
        }

        Ok(())
    }

    /// Get the bounds of the spreadsheet (max row and column with data)
    pub fn get_bounds(&self) -> (u32, u32) {
        let mut max_row = 0;
        let mut max_col = 0;

        for (addr, _) in self.repository.borrow().iter() {
            max_row = max_row.max(addr.row);
            max_col = max_col.max(addr.col);
        }

        (max_row, max_col)
    }

    /// Check if a row is empty
    pub fn is_row_empty(&self, row: u32) -> bool {
        self.get_cells_in_row(row).is_empty()
    }

    /// Check if a column is empty
    pub fn is_column_empty(&self, column: u32) -> bool {
        self.get_cells_in_column(column).is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::Cell;
    use crate::types::CellValue;

    fn create_test_service() -> StructuralOperations {
        let repository = Rc::new(RefCell::new(CellRepository::new()));
        let dependency_graph = Rc::new(RefCell::new(DependencyGraph::new()));
        StructuralOperations::new(repository, dependency_graph)
    }

    #[test]
    fn test_insert_rows() {
        let service = create_test_service();

        // Add some cells
        service
            .repository
            .borrow_mut()
            .set(&CellAddress::new(0, 0), Cell::new(CellValue::Number(1.0)));
        service
            .repository
            .borrow_mut()
            .set(&CellAddress::new(0, 1), Cell::new(CellValue::Number(2.0)));

        // Insert a row at index 1
        let affected = service.insert_rows(1, 1).unwrap();

        // Check that the cell at row 1 moved to row 2
        assert!(
            service
                .repository
                .borrow()
                .get_cell(&CellAddress::new(1, 0))
                .is_none()
        );
        assert!(
            service
                .repository
                .borrow()
                .get_cell(&CellAddress::new(2, 0))
                .is_some()
        );
        assert!(!affected.is_empty());
    }

    #[test]
    fn test_delete_columns() {
        let service = create_test_service();

        // Add cells in different columns
        for col in 0..3 {
            service.repository.borrow_mut().set(
                &CellAddress::new(col, 0),
                Cell::new(CellValue::Number(col as f64)),
            );
        }

        // Delete column 1
        let deleted = service.delete_columns(vec![1]).unwrap();

        assert_eq!(deleted.len(), 1);
        assert!(
            service
                .repository
                .borrow()
                .get_cell(&CellAddress::new(0, 1))
                .is_some()
        );
        // Column 2 should now be at column 1
        let cell = service
            .repository
            .borrow()
            .get_cell(&CellAddress::new(0, 1))
            .unwrap();
        assert_eq!(cell.get_computed_value(), CellValue::Number(2.0));
    }

    #[test]
    fn test_get_bounds() {
        let service = create_test_service();

        service
            .repository
            .borrow_mut()
            .set(&CellAddress::new(10, 5), Cell::new(CellValue::Number(42.0)));

        let (max_row, max_col) = service.get_bounds();
        assert_eq!(max_row, 5);
        assert_eq!(max_col, 10);
    }
}
