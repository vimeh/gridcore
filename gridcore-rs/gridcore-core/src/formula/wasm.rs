use crate::formula::FormulaParser;
use wasm_bindgen::prelude::*;

// Formula parsing is exposed through simple functions rather than a wrapper class.
// All formula types (Expr, CellRange, etc.) have serde derives and are automatically
// serialized to JavaScript objects.

/// Parse a formula string into an AST
/// Returns a JavaScript object representing the AST
#[wasm_bindgen(js_name = "parseFormula")]
pub fn parse_formula(formula: &str) -> Result<JsValue, JsValue> {
    FormulaParser::parse(formula)
        .map_err(|e| JsValue::from_str(&e.to_string()))
        .and_then(|expr| {
            serde_wasm_bindgen::to_value(&expr)
                .map_err(|e| JsValue::from_str(&format!("Failed to serialize formula: {}", e)))
        })
}

/// Parse a formula and return it as a JSON string
#[wasm_bindgen(js_name = "parseFormulaToJson")]
pub fn parse_formula_to_json(formula: &str) -> Result<String, JsValue> {
    FormulaParser::parse(formula)
        .map_err(|e| JsValue::from_str(&e.to_string()))
        .and_then(|expr| {
            serde_json::to_string(&expr)
                .map_err(|e| JsValue::from_str(&format!("Failed to serialize to JSON: {}", e)))
        })
}

/// Validate a formula without returning the AST
#[wasm_bindgen(js_name = "validateFormula")]
pub fn validate_formula(formula: &str) -> bool {
    FormulaParser::parse(formula).is_ok()
}

/// Get error message for invalid formula
#[wasm_bindgen(js_name = "getFormulaError")]
pub fn get_formula_error(formula: &str) -> Option<String> {
    FormulaParser::parse(formula).err().map(|e| e.to_string())
}

// WasmFormulaParser wrapper removed - use the standalone functions instead:
// - parseFormula(formula): Parse and return as JS object
// - parseFormulaToJson(formula): Parse and return as JSON string  
// - validateFormula(formula): Check if formula is valid
// - getFormulaError(formula): Get parse error message
