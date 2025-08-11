use crate::constants::*;
use crate::types::{CellValue, ErrorType};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Represents a spreadsheet cell with its value and optional formula
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Cell {
    /// The raw value entered by the user (could be a formula string)
    pub raw_value: CellValue,

    /// The computed value after formula evaluation
    pub computed_value: CellValue,

    /// The formula text if this cell contains a formula (without the leading '=')
    pub formula_text: Option<Arc<str>>,

    /// Any error that occurred during parsing or evaluation
    pub error: Option<Arc<str>>,
}

impl Cell {
    /// Create a new cell with a value
    pub fn new(value: CellValue) -> Self {
        let computed = value.clone();
        Cell {
            raw_value: value,
            computed_value: computed,
            formula_text: None,
            error: None,
        }
    }

    /// Create a cell with a formula
    pub fn with_formula(raw_value: CellValue, formula_text: String) -> Self {
        Cell {
            raw_value,
            computed_value: CellValue::Empty, // Will be computed later
            formula_text: Some(Arc::from(formula_text.as_str())),
            error: None,
        }
    }

    /// Create a cell with an error
    pub fn with_error(raw_value: CellValue, error: String) -> Self {
        // Parse the error string to determine the appropriate ErrorType
        let error_arc = Arc::from(error.as_str());
        let error_type = if error.contains(ERROR_DIV_ZERO) || error.contains(DESC_DIVISION_BY_ZERO)
        {
            ErrorType::DivideByZero
        } else if error.contains(ERROR_REF) || error.contains(DESC_INVALID_REFERENCE) {
            ErrorType::InvalidRef {
                reference: error.clone(),
            }
        } else if error.contains(ERROR_NAME) || error.contains(DESC_UNKNOWN_FUNCTION) {
            ErrorType::NameError {
                name: error.clone(),
            }
        } else if error.contains(ERROR_VALUE) || error.contains(DESC_TYPE_MISMATCH) {
            ErrorType::ValueError {
                expected: ERROR_VALID_VALUE.to_string(),
                actual: error.clone(),
            }
        } else if error.contains(ERROR_CIRC) || error.contains(DESC_CIRCULAR_REFERENCE) {
            ErrorType::CircularDependency { cells: Vec::new() }
        } else if error.contains(ERROR_NUM) {
            ErrorType::NumError
        } else {
            ErrorType::ParseError {
                message: error.clone(),
            }
        };

        Cell {
            raw_value,
            computed_value: CellValue::from_error(error_type),
            formula_text: None,
            error: Some(error_arc),
        }
    }

    /// Create an empty cell
    pub fn empty() -> Self {
        Cell {
            raw_value: CellValue::Empty,
            computed_value: CellValue::Empty,
            formula_text: None,
            error: None,
        }
    }

    /// Check if the cell contains a formula
    pub fn has_formula(&self) -> bool {
        self.formula_text.is_some()
    }

    /// Check if the cell has an error
    pub fn has_error(&self) -> bool {
        self.error.is_some()
    }

    /// Check if the cell is empty
    pub fn is_empty(&self) -> bool {
        matches!(self.raw_value, CellValue::Empty)
    }

    /// Get the display value (computed value or error)
    pub fn get_display_value(&self) -> &CellValue {
        &self.computed_value
    }

    /// Get the computed value
    pub fn get_computed_value(&self) -> CellValue {
        self.computed_value.clone()
    }

    /// Update the computed value
    pub fn set_computed_value(&mut self, value: CellValue) {
        self.computed_value = value;
        self.error = None;
    }

    /// Set an error on the cell
    pub fn set_error(&mut self, error: String) {
        // Convert to Arc for storage
        let error_arc = Arc::from(error.as_str());
        self.error = Some(Arc::clone(&error_arc));

        // Parse the error string to determine the appropriate ErrorType
        let error_type = if error.contains("#DIV/0!") || error.contains("Division by zero") {
            ErrorType::DivideByZero
        } else if error.contains("#REF!") || error.contains("Invalid reference") {
            ErrorType::InvalidRef {
                reference: error.clone(),
            }
        } else if error.contains("#NAME?") || error.contains("Unknown function") {
            ErrorType::NameError {
                name: error.clone(),
            }
        } else if error.contains("#VALUE!") || error.contains("Type mismatch") {
            ErrorType::ValueError {
                expected: "valid".to_string(),
                actual: error.clone(),
            }
        } else if error.contains("#CIRC!") || error.contains("Circular") {
            ErrorType::CircularDependency { cells: Vec::new() }
        } else if error.contains("#NUM!") {
            ErrorType::NumError
        } else {
            ErrorType::ParseError {
                message: error.clone(),
            }
        };

        self.computed_value = CellValue::from_error(error_type);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cell_creation() {
        let cell = Cell::new(CellValue::Number(42.0));
        assert_eq!(cell.raw_value, CellValue::Number(42.0));
        assert_eq!(cell.computed_value, CellValue::Number(42.0));
        assert!(!cell.has_formula());
        assert!(!cell.has_error());
    }

    #[test]
    fn test_cell_with_string_value() {
        let cell = Cell::new(CellValue::from_string("hello".to_string()));
        assert_eq!(cell.raw_value, CellValue::from_string("hello".to_string()));
        assert_eq!(
            cell.computed_value,
            CellValue::from_string("hello".to_string())
        );
        assert!(!cell.has_formula());
        assert!(!cell.has_error());
    }

    #[test]
    fn test_cell_with_boolean_value() {
        let cell = Cell::new(CellValue::Boolean(true));
        assert_eq!(cell.raw_value, CellValue::Boolean(true));
        assert_eq!(cell.computed_value, CellValue::Boolean(true));
        assert!(!cell.has_formula());
    }

    #[test]
    fn test_empty_cell() {
        let cell = Cell::empty();
        assert!(cell.is_empty());
        assert!(!cell.has_formula());
        assert!(!cell.has_error());
        assert_eq!(cell.raw_value, CellValue::Empty);
        assert_eq!(cell.computed_value, CellValue::Empty);
    }

    #[test]
    fn test_cell_with_formula() {
        let cell = Cell::with_formula(
            CellValue::from_string("=A1+B1".to_string()),
            "A1+B1".to_string(),
        );
        assert!(cell.has_formula());
        assert_eq!(cell.formula_text.as_deref(), Some("A1+B1"));
        assert_eq!(cell.raw_value, CellValue::from_string("=A1+B1".to_string()));
        assert_eq!(cell.computed_value, CellValue::Empty);
        assert!(!cell.has_error());
    }

    #[test]
    fn test_cell_with_error() {
        let cell = Cell::with_error(
            CellValue::from_string("=INVALID()".to_string()),
            "Unknown function".to_string(),
        );
        assert!(cell.has_error());
        assert_eq!(cell.error.as_deref(), Some("Unknown function"));
        assert_eq!(
            cell.computed_value,
            CellValue::from_error(ErrorType::NameError {
                name: "Unknown function".to_string()
            })
        );
    }

    #[test]
    fn test_set_computed_value() {
        let mut cell = Cell::new(CellValue::Number(10.0));
        cell.set_computed_value(CellValue::Number(20.0));
        assert_eq!(cell.raw_value, CellValue::Number(10.0));
        assert_eq!(cell.computed_value, CellValue::Number(20.0));
        assert!(cell.error.is_none());
    }

    #[test]
    fn test_set_error() {
        let mut cell = Cell::new(CellValue::Number(42.0));
        cell.set_error("Division by zero".to_string());
        assert!(cell.has_error());
        assert_eq!(cell.error.as_deref(), Some("Division by zero"));
        assert_eq!(
            cell.computed_value,
            CellValue::from_error(ErrorType::DivideByZero)
        );
        assert_eq!(cell.raw_value, CellValue::Number(42.0));
    }

    #[test]
    fn test_get_display_value() {
        let cell = Cell::new(CellValue::Number(42.0));
        assert_eq!(cell.get_display_value(), &CellValue::Number(42.0));

        let cell_with_error = Cell::with_error(
            CellValue::from_string("=1/0".to_string()),
            "Division by zero".to_string(),
        );
        assert_eq!(
            cell_with_error.get_display_value(),
            &CellValue::from_error(ErrorType::DivideByZero)
        );
    }

    #[test]
    fn test_cell_equality() {
        let cell1 = Cell::new(CellValue::Number(42.0));
        let cell2 = Cell::new(CellValue::Number(42.0));
        assert_eq!(cell1, cell2);

        let cell3 = Cell::new(CellValue::Number(43.0));
        assert_ne!(cell1, cell3);
    }

    #[test]
    fn test_cells_with_same_formula_are_equal() {
        let cell1 = Cell::with_formula(
            CellValue::from_string("=1+2".to_string()),
            "1+2".to_string(),
        );
        let cell2 = Cell::with_formula(
            CellValue::from_string("=1+2".to_string()),
            "1+2".to_string(),
        );
        assert_eq!(cell1, cell2);
    }

    #[test]
    fn test_cells_with_different_errors_are_not_equal() {
        let cell1 = Cell::with_error(CellValue::Number(42.0), "Error 1".to_string());
        let cell2 = Cell::with_error(CellValue::Number(42.0), "Error 2".to_string());
        assert_ne!(cell1, cell2);
    }

    #[test]
    fn test_computed_value_update_clears_error() {
        let mut cell = Cell::with_error(
            CellValue::from_string("=1/0".to_string()),
            "Division by zero".to_string(),
        );
        assert!(cell.has_error());

        cell.set_computed_value(CellValue::Number(42.0));
        assert!(!cell.has_error());
        assert_eq!(cell.computed_value, CellValue::Number(42.0));
        assert!(cell.error.is_none());
    }

    #[test]
    fn test_formula_cell_computed_value() {
        let mut cell =
            Cell::with_formula(CellValue::from_string("=42".to_string()), "42".to_string());
        assert_eq!(cell.computed_value, CellValue::Empty);

        cell.set_computed_value(CellValue::Number(42.0));
        assert_eq!(cell.computed_value, CellValue::Number(42.0));
        assert_eq!(cell.raw_value, CellValue::from_string("=42".to_string()));
    }
}
