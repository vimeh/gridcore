use crate::SpreadsheetError;
use crate::formula::ast::{CellRange, Expr};
use crate::types::{CellAddress, CellValue, ErrorType};

/// Transformer for adjusting formulas during structural operations
#[derive(Debug, Clone)]
pub struct FormulaTransformer;

impl FormulaTransformer {
    /// Create a new formula transformer
    pub fn new() -> Self {
        FormulaTransformer
    }

    /// Adjust formula references when a row is inserted
    pub fn adjust_for_row_insert(&self, ast: Expr, inserted_row: u32) -> Expr {
        self.transform_expr(ast, |addr, abs_col, abs_row| {
            let mut new_addr = *addr;
            // Always adjust for absolute references, adjust for relative if beyond insertion point
            if addr.row >= inserted_row {
                new_addr.row += 1;
            }
            Ok((new_addr, abs_col, abs_row))
        })
    }

    /// Adjust formula references when a row is deleted
    pub fn adjust_for_row_delete(&self, ast: Expr, deleted_row: u32) -> Expr {
        self.transform_expr(ast, |addr, abs_col, abs_row| {
            let mut new_addr = *addr;

            // If the reference is to the deleted row, return #REF! error
            if addr.row == deleted_row {
                return Err(SpreadsheetError::RefError);
            }

            // Adjust references beyond the deleted row
            if addr.row > deleted_row {
                new_addr.row -= 1;
            }

            Ok((new_addr, abs_col, abs_row))
        })
    }

    /// Adjust formula references when a column is inserted
    pub fn adjust_for_column_insert(&self, ast: Expr, inserted_col: u32) -> Expr {
        self.transform_expr(ast, |addr, abs_col, abs_row| {
            let mut new_addr = *addr;
            // Always adjust for absolute references, adjust for relative if beyond insertion point
            if addr.col >= inserted_col {
                new_addr.col += 1;
            }
            Ok((new_addr, abs_col, abs_row))
        })
    }

    /// Adjust formula references when a column is deleted
    pub fn adjust_for_column_delete(&self, ast: Expr, deleted_col: u32) -> Expr {
        self.transform_expr(ast, |addr, abs_col, abs_row| {
            let mut new_addr = *addr;

            // If the reference is to the deleted column, return #REF! error
            if addr.col == deleted_col {
                return Err(SpreadsheetError::RefError);
            }

            // Adjust references beyond the deleted column
            if addr.col > deleted_col {
                new_addr.col -= 1;
            }

            Ok((new_addr, abs_col, abs_row))
        })
    }

    /// Adjust formula references when a range of cells is moved
    pub fn adjust_for_range_move(
        &self,
        ast: Expr,
        from_start: &CellAddress,
        from_end: &CellAddress,
        to_start: &CellAddress,
    ) -> Expr {
        let row_delta = to_start.row as i32 - from_start.row as i32;
        let col_delta = to_start.col as i32 - from_start.col as i32;

        self.transform_expr(ast, |addr, abs_col, abs_row| {
            let mut new_addr = *addr;

            // Check if the address is within the moved range
            if addr.col >= from_start.col
                && addr.col <= from_end.col
                && addr.row >= from_start.row
                && addr.row <= from_end.row
            {
                // Move the reference with the range
                new_addr.col = ((addr.col as i32) + col_delta) as u32;
                new_addr.row = ((addr.row as i32) + row_delta) as u32;
            }

            Ok((new_addr, abs_col, abs_row))
        })
    }

    /// Transform an expression by applying a transformation function to all cell references
    #[allow(clippy::only_used_in_recursion)]
    fn transform_expr<F>(&self, expr: Expr, transform: F) -> Expr
    where
        F: Fn(&CellAddress, bool, bool) -> Result<(CellAddress, bool, bool), SpreadsheetError>
            + Clone,
    {
        match expr {
            Expr::Literal { value } => Expr::Literal { value },

            Expr::Reference {
                address,
                absolute_col,
                absolute_row,
            } => match transform(&address, absolute_col, absolute_row) {
                Ok((new_addr, new_abs_col, new_abs_row)) => Expr::Reference {
                    address: new_addr,
                    absolute_col: new_abs_col,
                    absolute_row: new_abs_row,
                },
                Err(_) => Expr::Literal {
                    value: CellValue::Error(ErrorType::InvalidRef {
                        reference: "deleted".to_string(),
                    }),
                },
            },

            Expr::Range {
                range,
                absolute_start_col,
                absolute_start_row,
                absolute_end_col,
                absolute_end_row,
            } => {
                let start_result = transform(&range.start, absolute_start_col, absolute_start_row);
                let end_result = transform(&range.end, absolute_end_col, absolute_end_row);

                match (start_result, end_result) {
                    (
                        Ok((new_start, start_abs_col, start_abs_row)),
                        Ok((new_end, end_abs_col, end_abs_row)),
                    ) => Expr::Range {
                        range: CellRange::new(new_start, new_end),
                        absolute_start_col: start_abs_col,
                        absolute_start_row: start_abs_row,
                        absolute_end_col: end_abs_col,
                        absolute_end_row: end_abs_row,
                    },
                    _ => Expr::Literal {
                        value: CellValue::Error(ErrorType::InvalidRef {
                            reference: "deleted".to_string(),
                        }),
                    },
                }
            }

            Expr::FunctionCall { name, args } => {
                let new_args = args
                    .into_iter()
                    .map(|arg| self.transform_expr(arg, transform.clone()))
                    .collect();
                Expr::FunctionCall {
                    name,
                    args: new_args,
                }
            }

            Expr::UnaryOp { op, expr } => Expr::UnaryOp {
                op,
                expr: Box::new(self.transform_expr(*expr, transform)),
            },

            Expr::BinaryOp { op, left, right } => Expr::BinaryOp {
                op,
                left: Box::new(self.transform_expr(*left, transform.clone())),
                right: Box::new(self.transform_expr(*right, transform)),
            },
        }
    }

    /// Shift all references in a formula by the given row and column deltas
    pub fn shift_references(&self, ast: Expr, row_delta: i32, col_delta: i32) -> Expr {
        self.transform_expr(ast, |addr, abs_col, abs_row| {
            let new_col = (addr.col as i32 + col_delta).max(0) as u32;
            let new_row = (addr.row as i32 + row_delta).max(0) as u32;
            Ok((CellAddress::new(new_col, new_row), abs_col, abs_row))
        })
    }
}

impl Default for FormulaTransformer {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::formula::parser::FormulaParser;

    fn parse_formula(formula: &str) -> Expr {
        FormulaParser::parse(formula).expect("Failed to parse formula")
    }

    #[test]
    fn test_row_insert_simple_reference() {
        let transformer = FormulaTransformer::new();
        let ast = parse_formula("A5");
        let result = transformer.adjust_for_row_insert(ast, 3);

        // A5 should become A6 when row 3 is inserted
        match result {
            Expr::Reference { address, .. } => {
                assert_eq!(address.row, 5); // Row 5 becomes row 6 (but internally 0-indexed)
            }
            _ => panic!("Expected Reference"),
        }
    }

    #[test]
    fn test_row_insert_before_reference() {
        let transformer = FormulaTransformer::new();
        let ast = parse_formula("A2");
        let result = transformer.adjust_for_row_insert(ast, 5);

        // A2 should remain A2 when row 5 is inserted
        match result {
            Expr::Reference { address, .. } => {
                assert_eq!(address.row, 1); // A2 is row index 1
            }
            _ => panic!("Expected Reference"),
        }
    }

    #[test]
    fn test_row_delete_creates_ref_error() {
        let transformer = FormulaTransformer::new();
        let ast = parse_formula("A5");
        let result = transformer.adjust_for_row_delete(ast, 4); // Delete row 5 (index 4)

        // A5 should become #REF! when row 5 is deleted
        match result {
            Expr::Literal { value } => {
                assert_eq!(
                    value,
                    CellValue::Error(ErrorType::InvalidRef {
                        reference: "deleted".to_string()
                    })
                );
            }
            _ => panic!("Expected #REF! error"),
        }
    }

    #[test]
    fn test_column_insert_in_range() {
        let transformer = FormulaTransformer::new();
        let ast = parse_formula("B1:D5");
        let result = transformer.adjust_for_column_insert(ast, 2); // Insert column C

        // B1:D5 should become B1:E5 when column C is inserted
        match result {
            Expr::Range { range, .. } => {
                assert_eq!(range.start.col, 1); // B
                assert_eq!(range.end.col, 4); // E (was D)
            }
            _ => panic!("Expected Range"),
        }
    }

    #[test]
    fn test_complex_formula_adjustment() {
        let transformer = FormulaTransformer::new();
        let ast = parse_formula("SUM(A1:A10) + B5 * C3");
        let result = transformer.adjust_for_row_insert(ast, 4);

        // Check that all references are properly adjusted
        // This would need more detailed assertion based on the AST structure
        match result {
            Expr::BinaryOp { .. } => {
                // Successfully transformed without panic
            }
            _ => panic!("Expected BinaryOp"),
        }
    }

    #[test]
    fn test_range_move() {
        let transformer = FormulaTransformer::new();
        let ast = parse_formula("A1");
        let from_start = CellAddress::new(0, 0); // A1
        let from_end = CellAddress::new(2, 2); // C3
        let to_start = CellAddress::new(3, 3); // D4

        let result = transformer.adjust_for_range_move(ast, &from_start, &from_end, &to_start);

        // A1 should move to D4
        match result {
            Expr::Reference { address, .. } => {
                assert_eq!(address.col, 3); // D
                assert_eq!(address.row, 3); // 4
            }
            _ => panic!("Expected Reference"),
        }
    }

    #[test]
    fn test_absolute_reference_adjustment() {
        let transformer = FormulaTransformer::new();
        // We need to create an absolute reference manually since the parser might not support $
        let ast = Expr::Reference {
            address: CellAddress::new(0, 4), // A5
            absolute_col: true,
            absolute_row: true,
        };

        let result = transformer.adjust_for_row_insert(ast, 3);

        // $A$5 should become $A$6 when row 3 is inserted
        match result {
            Expr::Reference {
                address,
                absolute_col,
                absolute_row,
            } => {
                assert_eq!(address.row, 5); // Row 5 becomes row 6
                assert!(absolute_col);
                assert!(absolute_row);
            }
            _ => panic!("Expected Reference"),
        }
    }

    #[test]
    fn test_shift_references() {
        let transformer = FormulaTransformer::new();
        let ast = parse_formula("A1 + B2");
        let result = transformer.shift_references(ast, 2, 1);

        // A1 should become B3, B2 should become C4
        // This would need more detailed assertion based on the AST structure
        match result {
            Expr::BinaryOp { .. } => {
                // Successfully transformed without panic
            }
            _ => panic!("Expected BinaryOp"),
        }
    }
}
