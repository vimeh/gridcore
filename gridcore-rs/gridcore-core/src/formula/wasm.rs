use wasm_bindgen::prelude::*;
use serde_wasm_bindgen;
use crate::formula::FormulaParser;

/// WASM wrapper for formula parsing
#[wasm_bindgen]
pub struct WasmFormulaParser;

#[wasm_bindgen]
impl WasmFormulaParser {
    /// Create a new formula parser
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        WasmFormulaParser
    }
    
    /// Parse a formula string into an AST
    /// Returns a JavaScript object representing the AST
    #[wasm_bindgen(js_name = "parse")]
    pub fn parse(&self, formula: &str) -> std::result::Result<JsValue, JsValue> {
        match FormulaParser::parse(formula) {
            Ok(expr) => {
                // Convert the Expr to a JsValue using serde
                serde_wasm_bindgen::to_value(&expr)
                    .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
            }
            Err(e) => Err(JsValue::from_str(&e.to_string()))
        }
    }
    
    /// Parse a formula and return it as a JSON string
    #[wasm_bindgen(js_name = "parseToJson")]
    pub fn parse_to_json(&self, formula: &str) -> std::result::Result<String, JsValue> {
        match FormulaParser::parse(formula) {
            Ok(expr) => {
                serde_json::to_string(&expr)
                    .map_err(|e| JsValue::from_str(&format!("JSON serialization error: {}", e)))
            }
            Err(e) => Err(JsValue::from_str(&e.to_string()))
        }
    }
}

/// Parse a formula directly (convenience function)
#[wasm_bindgen(js_name = "parseFormula")]
pub fn parse_formula(formula: &str) -> std::result::Result<JsValue, JsValue> {
    match FormulaParser::parse(formula) {
        Ok(expr) => {
            serde_wasm_bindgen::to_value(&expr)
                .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
        }
        Err(e) => Err(JsValue::from_str(&e.to_string()))
    }
}