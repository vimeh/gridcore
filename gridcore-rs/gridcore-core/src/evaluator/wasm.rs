use super::context::EvaluationContext;
use super::evaluator::Evaluator;
use crate::SpreadsheetError;
use crate::formula::FormulaParser;
use crate::types::{CellAddress, CellValue};
use std::collections::HashSet;
use wasm_bindgen::prelude::*;

/// WASM-compatible evaluation context that calls back to JavaScript
#[wasm_bindgen]
pub struct WasmEvaluationContext {
    /// JavaScript callback for getting cell values
    get_cell_value_callback: js_sys::Function,

    /// Stack of cells being evaluated (for circular dependency detection)
    evaluation_stack: HashSet<String>,
}

#[wasm_bindgen]
impl WasmEvaluationContext {
    #[wasm_bindgen(constructor)]
    pub fn new(get_cell_value_callback: js_sys::Function) -> Self {
        WasmEvaluationContext {
            get_cell_value_callback,
            evaluation_stack: HashSet::new(),
        }
    }
}

impl EvaluationContext for WasmEvaluationContext {
    fn get_cell_value(&self, address: &CellAddress) -> crate::Result<CellValue> {
        let addr_str = JsValue::from_str(&address.to_string());

        // Call JavaScript to get the cell value
        let result = self
            .get_cell_value_callback
            .call1(&JsValue::NULL, &addr_str)
            .map_err(|e| {
                SpreadsheetError::FormulaError(format!("Error calling JS callback: {:?}", e))
            })?;

        // Convert JS value to CellValue
        CellValue::from_js(result).map_err(|e| {
            SpreadsheetError::FormulaError(format!("Error converting JS value: {:?}", e))
        })
    }

    fn check_circular(&self, address: &CellAddress) -> bool {
        self.evaluation_stack.contains(&address.to_string())
    }

    fn push_evaluation(&mut self, address: &CellAddress) {
        self.evaluation_stack.insert(address.to_string());
    }

    fn pop_evaluation(&mut self, address: &CellAddress) {
        self.evaluation_stack.remove(&address.to_string());
    }
}

/// WASM wrapper for the formula evaluator
#[wasm_bindgen]
pub struct WasmEvaluator;

#[wasm_bindgen]
impl WasmEvaluator {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        WasmEvaluator
    }

    /// Evaluate a formula string
    #[wasm_bindgen(js_name = "evaluate")]
    pub fn evaluate(
        &self,
        formula: &str,
        get_cell_value: js_sys::Function,
    ) -> std::result::Result<JsValue, JsValue> {
        // Parse the formula
        let expr = FormulaParser::parse(formula).map_err(|e| JsValue::from_str(&e.to_string()))?;

        // Create evaluation context
        let mut context = WasmEvaluationContext::new(get_cell_value);

        // Create evaluator and evaluate
        let mut evaluator = Evaluator::new(&mut context);
        let result = evaluator
            .evaluate(&expr)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        // Convert result to JS value
        Ok(result.to_js())
    }

    /// Evaluate a formula that's already been parsed
    #[wasm_bindgen(js_name = "evaluateAST")]
    pub fn evaluate_ast(
        &self,
        ast_json: JsValue,
        get_cell_value: js_sys::Function,
    ) -> std::result::Result<JsValue, JsValue> {
        // Deserialize the AST from JSON
        let expr: crate::formula::ast::Expr = serde_wasm_bindgen::from_value(ast_json)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        // Create evaluation context
        let mut context = WasmEvaluationContext::new(get_cell_value);

        // Create evaluator and evaluate
        let mut evaluator = Evaluator::new(&mut context);
        let result = evaluator
            .evaluate(&expr)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        // Convert result to JS value
        Ok(result.to_js())
    }

    /// Check if a formula has circular dependencies
    #[wasm_bindgen(js_name = "checkCircular")]
    pub fn check_circular(
        &self,
        formula: &str,
        current_cell: &str,
        get_dependencies: js_sys::Function,
    ) -> std::result::Result<bool, JsValue> {
        // Parse the formula
        let expr = FormulaParser::parse(formula).map_err(|e| JsValue::from_str(&e.to_string()))?;

        // Extract dependencies
        let dependencies = crate::dependency::DependencyAnalyzer::extract_dependencies(&expr);

        // Check each dependency for circular reference
        for dep in dependencies {
            let dep_str = JsValue::from_str(&dep.to_string());
            let current = JsValue::from_str(current_cell);

            // Call JS to check if this would create a cycle
            let result = get_dependencies
                .call2(&JsValue::NULL, &dep_str, &current)
                .map_err(|e| JsValue::from_str(&format!("Error calling JS: {:?}", e)))?;

            if result.as_bool().unwrap_or(false) {
                return Ok(true);
            }
        }

        Ok(false)
    }
}
