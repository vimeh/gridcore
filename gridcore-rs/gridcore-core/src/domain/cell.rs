use crate::formula::ast::Expr;
use crate::types::CellValue;
use serde::{Deserialize, Serialize};

/// Represents a spreadsheet cell with its value and optional formula
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Cell {
    /// The raw value entered by the user (could be a formula string)
    pub raw_value: CellValue,

    /// The computed value after formula evaluation
    pub computed_value: CellValue,

    /// The parsed formula AST if this cell contains a formula
    pub formula: Option<Expr>,

    /// Any error that occurred during parsing or evaluation
    pub error: Option<String>,
}

impl Cell {
    /// Create a new cell with a value
    pub fn new(value: CellValue) -> Self {
        Cell {
            raw_value: value.clone(),
            computed_value: value,
            formula: None,
            error: None,
        }
    }

    /// Create a cell with a formula
    pub fn with_formula(raw_value: CellValue, formula: Expr) -> Self {
        Cell {
            raw_value,
            computed_value: CellValue::Empty, // Will be computed later
            formula: Some(formula),
            error: None,
        }
    }

    /// Create a cell with an error
    pub fn with_error(raw_value: CellValue, error: String) -> Self {
        Cell {
            raw_value,
            computed_value: CellValue::Error(error.clone()),
            formula: None,
            error: Some(error),
        }
    }

    /// Create an empty cell
    pub fn empty() -> Self {
        Cell {
            raw_value: CellValue::Empty,
            computed_value: CellValue::Empty,
            formula: None,
            error: None,
        }
    }

    /// Check if the cell contains a formula
    pub fn has_formula(&self) -> bool {
        self.formula.is_some()
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
        self.error = Some(error.clone());
        self.computed_value = CellValue::Error(error);
    }
}

// Cell cannot be directly exported with wasm_bindgen because it contains non-Copy fields.
// However, since Cell has serde derives, we can use serde-wasm-bindgen for all conversions.
// The WasmCell wrapper below provides a thin layer for JavaScript interop.

#[cfg(feature = "wasm")]
pub mod wasm_bindings {
    use super::*;
    use wasm_bindgen::prelude::*;

    /// Thin wrapper for Cell to expose to WASM
    /// Uses serde for all conversions
    #[wasm_bindgen]
    pub struct WasmCell {
        inner: Cell,
    }

    impl WasmCell {
        /// Create from an existing Cell
        pub fn from_cell(cell: Cell) -> Self {
            WasmCell { inner: cell }
        }

        /// Get the inner Cell
        pub fn into_inner(self) -> Cell {
            self.inner
        }
    }

    #[wasm_bindgen]
    impl WasmCell {
        /// Create from a JavaScript object using serde
        #[wasm_bindgen(js_name = "fromObject")]
        pub fn from_object(obj: JsValue) -> Result<WasmCell, JsValue> {
            let cell: Cell = serde_wasm_bindgen::from_value(obj)
                .map_err(|e| JsValue::from_str(&format!("Failed to deserialize Cell: {}", e)))?;
            Ok(WasmCell { inner: cell })
        }

        /// Create from a value
        #[wasm_bindgen(constructor)]
        pub fn new(value: JsValue) -> Result<WasmCell, JsValue> {
            let cell_value = CellValue::from_js(value)?;
            Ok(WasmCell {
                inner: Cell::new(cell_value),
            })
        }

        /// Create an empty cell
        #[wasm_bindgen(js_name = "empty")]
        pub fn empty() -> WasmCell {
            WasmCell {
                inner: Cell::empty(),
            }
        }

        /// Convert to JavaScript object using serde
        #[wasm_bindgen(js_name = "toObject")]
        pub fn to_object(&self) -> Result<JsValue, JsValue> {
            serde_wasm_bindgen::to_value(&self.inner)
                .map_err(|e| JsValue::from_str(&format!("Failed to serialize Cell: {}", e)))
        }

        /// Check if the cell has a formula
        #[wasm_bindgen(js_name = "hasFormula")]
        pub fn has_formula(&self) -> bool {
            self.inner.has_formula()
        }

        /// Check if the cell has an error
        #[wasm_bindgen(js_name = "hasError")]
        pub fn has_error(&self) -> bool {
            self.inner.has_error()
        }

        /// Check if the cell is empty
        #[wasm_bindgen(js_name = "isEmpty")]
        pub fn is_empty(&self) -> bool {
            self.inner.is_empty()
        }

        /// Get the computed value as a JavaScript value
        #[wasm_bindgen(js_name = "getComputedValue")]
        pub fn get_computed_value(&self) -> JsValue {
            self.inner.computed_value.to_js()
        }

        /// Get the raw value as a JavaScript value
        #[wasm_bindgen(js_name = "getRawValue")]
        pub fn get_raw_value(&self) -> JsValue {
            self.inner.raw_value.to_js()
        }

        /// Get the error message if any
        #[wasm_bindgen(js_name = "getError")]
        pub fn get_error(&self) -> Option<String> {
            self.inner.error.clone()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::formula::ast::{BinaryOperator, Expr};
    use crate::types::CellAddress;

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
        let cell = Cell::new(CellValue::String("hello".to_string()));
        assert_eq!(cell.raw_value, CellValue::String("hello".to_string()));
        assert_eq!(cell.computed_value, CellValue::String("hello".to_string()));
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
        let formula = Expr::BinaryOp {
            op: BinaryOperator::Add,
            left: Box::new(Expr::Reference {
                address: CellAddress::new(0, 0),
                absolute_col: false,
                absolute_row: false,
            }),
            right: Box::new(Expr::Reference {
                address: CellAddress::new(1, 0),
                absolute_col: false,
                absolute_row: false,
            }),
        };
        let cell = Cell::with_formula(CellValue::String("=A1+B1".to_string()), formula.clone());
        assert!(cell.has_formula());
        assert_eq!(cell.formula, Some(formula));
        assert_eq!(cell.raw_value, CellValue::String("=A1+B1".to_string()));
        assert_eq!(cell.computed_value, CellValue::Empty);
        assert!(!cell.has_error());
    }

    #[test]
    fn test_cell_with_error() {
        let cell = Cell::with_error(
            CellValue::String("=INVALID()".to_string()),
            "Unknown function".to_string(),
        );
        assert!(cell.has_error());
        assert_eq!(cell.error, Some("Unknown function".to_string()));
        assert_eq!(
            cell.computed_value,
            CellValue::Error("Unknown function".to_string())
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
        assert_eq!(cell.error, Some("Division by zero".to_string()));
        assert_eq!(
            cell.computed_value,
            CellValue::Error("Division by zero".to_string())
        );
        assert_eq!(cell.raw_value, CellValue::Number(42.0));
    }

    #[test]
    fn test_get_display_value() {
        let cell = Cell::new(CellValue::Number(42.0));
        assert_eq!(cell.get_display_value(), &CellValue::Number(42.0));

        let cell_with_error = Cell::with_error(
            CellValue::String("=1/0".to_string()),
            "Division by zero".to_string(),
        );
        assert_eq!(
            cell_with_error.get_display_value(),
            &CellValue::Error("Division by zero".to_string())
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
        let formula = Expr::BinaryOp {
            op: BinaryOperator::Add,
            left: Box::new(Expr::Literal {
                value: CellValue::Number(1.0),
            }),
            right: Box::new(Expr::Literal {
                value: CellValue::Number(2.0),
            }),
        };
        let cell1 = Cell::with_formula(CellValue::String("=1+2".to_string()), formula.clone());
        let cell2 = Cell::with_formula(CellValue::String("=1+2".to_string()), formula.clone());
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
            CellValue::String("=1/0".to_string()),
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
        let formula = Expr::Literal {
            value: CellValue::Number(42.0),
        };
        let mut cell = Cell::with_formula(CellValue::String("=42".to_string()), formula);
        assert_eq!(cell.computed_value, CellValue::Empty);

        cell.set_computed_value(CellValue::Number(42.0));
        assert_eq!(cell.computed_value, CellValue::Number(42.0));
        assert_eq!(cell.raw_value, CellValue::String("=42".to_string()));
    }
}
