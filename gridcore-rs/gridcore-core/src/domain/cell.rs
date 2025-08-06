use crate::types::CellValue;
use crate::formula::ast::Expr;
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

#[cfg(feature = "wasm")]
pub mod wasm_bindings {
    use super::*;
    use wasm_bindgen::prelude::*;
    
    #[wasm_bindgen]
    pub struct WasmCell {
        inner: Cell,
    }
    
    #[wasm_bindgen]
    impl WasmCell {
        #[wasm_bindgen(constructor)]
        pub fn new(value: JsValue) -> Result<WasmCell, JsValue> {
            let cell_value = CellValue::from_js(value)?;
            Ok(WasmCell {
                inner: Cell::new(cell_value),
            })
        }
        
        #[wasm_bindgen(js_name = "empty")]
        pub fn empty() -> WasmCell {
            WasmCell {
                inner: Cell::empty(),
            }
        }
        
        #[wasm_bindgen(js_name = "hasFormula")]
        pub fn has_formula(&self) -> bool {
            self.inner.has_formula()
        }
        
        #[wasm_bindgen(js_name = "hasError")]
        pub fn has_error(&self) -> bool {
            self.inner.has_error()
        }
        
        #[wasm_bindgen(js_name = "isEmpty")]
        pub fn is_empty(&self) -> bool {
            self.inner.is_empty()
        }
        
        #[wasm_bindgen(js_name = "getRawValue")]
        pub fn get_raw_value(&self) -> JsValue {
            self.inner.raw_value.to_js()
        }
        
        #[wasm_bindgen(js_name = "getComputedValue")]
        pub fn get_computed_value(&self) -> JsValue {
            self.inner.computed_value.to_js()
        }
        
        #[wasm_bindgen(js_name = "getError")]
        pub fn get_error(&self) -> Option<String> {
            self.inner.error.clone()
        }
        
        #[wasm_bindgen(js_name = "toJson")]
        pub fn to_json(&self) -> Result<JsValue, JsValue> {
            serde_wasm_bindgen::to_value(&self.inner)
                .map_err(|e| JsValue::from_str(&e.to_string()))
        }
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
    fn test_empty_cell() {
        let cell = Cell::empty();
        assert!(cell.is_empty());
        assert!(!cell.has_formula());
        assert!(!cell.has_error());
    }
    
    #[test]
    fn test_cell_with_error() {
        let cell = Cell::with_error(
            CellValue::String("=INVALID()".to_string()),
            "Unknown function".to_string()
        );
        assert!(cell.has_error());
        assert_eq!(cell.error, Some("Unknown function".to_string()));
        assert_eq!(cell.computed_value, CellValue::Error("Unknown function".to_string()));
    }
}