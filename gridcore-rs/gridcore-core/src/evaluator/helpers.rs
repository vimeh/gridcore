//! Helper functions for formula evaluation

use crate::domain::Cell;
use crate::evaluator::{Evaluator, PortContext};
use crate::formula::FormulaParser;
use crate::ports::RepositoryPort;
use crate::types::CellValue;
use crate::{Result, SpreadsheetError};
use std::sync::Arc;

/// Evaluate a cell formula and return a fully configured Cell
pub fn evaluate_cell_formula(value: &str, repository: Arc<dyn RepositoryPort>) -> Result<Cell> {
    if let Some(formula_text) = value.strip_prefix('=') {
        // It's a formula
        let formula_string = formula_text.to_string();
        let mut cell = Cell::with_formula(
            CellValue::from_string(value.to_string()),
            formula_string.clone(),
        );

        // Try to evaluate the formula
        match FormulaParser::parse(&formula_string) {
            Ok(expr) => {
                let mut context = PortContext::new(repository);
                let mut evaluator = Evaluator::new(&mut context);

                // Evaluate and set the computed value
                match evaluator.evaluate(&expr) {
                    Ok(result) => cell.set_computed_value(result),
                    Err(e) => cell.set_error(e.to_string()),
                }
            }
            Err(SpreadsheetError::RefError) => {
                cell.set_error("#REF!".to_string());
            }
            Err(e) => {
                cell.set_error(e.to_string());
            }
        }

        Ok(cell)
    } else {
        // Regular value - parse as number, boolean, or string
        let cell_value = parse_cell_value(value);
        Ok(Cell::new(cell_value))
    }
}

/// Parse a string into a CellValue
pub fn parse_cell_value(value: &str) -> CellValue {
    if let Ok(num) = value.parse::<f64>() {
        CellValue::Number(num)
    } else if let Ok(bool_val) = value.parse::<bool>() {
        CellValue::Boolean(bool_val)
    } else {
        CellValue::from_string(value.to_string())
    }
}
