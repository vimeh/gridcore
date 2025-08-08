use crate::evaluator::{EvaluationContext, Evaluator};
use crate::formula::FormulaParser;
use crate::types::{CellAddress, CellValue};
use std::collections::HashSet;
use wasm_bindgen::prelude::*;

/// Evaluate a formula string with context
#[wasm_bindgen(js_name = "evaluateFormula")]
pub fn evaluate_formula(formula: &str, context: JsValue) -> Result<JsValue, JsValue> {
    // Parse the formula
    let expr = FormulaParser::parse(formula).map_err(|e| JsValue::from_str(&e.to_string()))?;

    // Create evaluation context from JS object
    let mut eval_context = JsEvaluationContext::from_js(context)?;

    // Create evaluator and evaluate
    let mut evaluator = Evaluator::new(&mut eval_context);
    let result = evaluator
        .evaluate(&expr)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;

    // Convert result to JS value
    Ok(result.to_js())
}

/// Evaluate a formula AST with context
#[wasm_bindgen(js_name = "evaluateAst")]
pub fn evaluate_ast(ast_json: JsValue, context: JsValue) -> Result<JsValue, JsValue> {
    // Deserialize the AST from JSON
    let expr: crate::formula::ast::Expr =
        serde_wasm_bindgen::from_value(ast_json).map_err(|e| JsValue::from_str(&e.to_string()))?;

    // Create evaluation context from JS object
    let mut eval_context = JsEvaluationContext::from_js(context)?;

    // Create evaluator and evaluate
    let mut evaluator = Evaluator::new(&mut eval_context);
    let result = evaluator
        .evaluate(&expr)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;

    // Convert result to JS value
    Ok(result.to_js())
}

/// Parse a formula and return its AST
#[wasm_bindgen(js_name = "parseFormulaToAst")]
pub fn parse_formula_to_ast(formula: &str) -> Result<JsValue, JsValue> {
    let expr = FormulaParser::parse(formula).map_err(|e| JsValue::from_str(&e.to_string()))?;

    serde_wasm_bindgen::to_value(&expr)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize AST: {}", e)))
}

/// Extract dependencies from a formula
#[wasm_bindgen(js_name = "extractFormulaDependencies")]
pub fn extract_formula_dependencies(formula: &str) -> Result<js_sys::Array, JsValue> {
    // Parse the formula
    let expr = FormulaParser::parse(formula).map_err(|e| JsValue::from_str(&e.to_string()))?;

    // Extract dependencies
    let dependencies = crate::dependency::DependencyAnalyzer::extract_dependencies(&expr);

    // Convert to JS array
    let array = js_sys::Array::new();
    for dep in dependencies {
        array.push(&JsValue::from_str(&dep.to_a1()));
    }

    Ok(array)
}

/// Check if a formula would create circular dependencies
#[wasm_bindgen(js_name = "checkCircularDependencies")]
pub fn check_circular_dependencies(
    formula: &str,
    current_cell: &str,
    dependency_graph: JsValue,
) -> Result<bool, JsValue> {
    // Parse the formula
    let expr = FormulaParser::parse(formula).map_err(|e| JsValue::from_str(&e.to_string()))?;

    // Parse current cell address
    let current_addr =
        CellAddress::from_a1(current_cell).map_err(|e| JsValue::from_str(&e.to_string()))?;

    // Extract dependencies from formula
    let dependencies = crate::dependency::DependencyAnalyzer::extract_dependencies(&expr);

    // Parse dependency graph from JS (expected format: { "A1": ["B1", "C1"], ... })
    let graph: std::collections::HashMap<String, Vec<String>> =
        serde_wasm_bindgen::from_value(dependency_graph)
            .map_err(|e| JsValue::from_str(&format!("Invalid dependency graph: {}", e)))?;

    // Check for circular dependencies using DFS
    for dep in dependencies {
        if would_create_cycle(&dep.to_a1(), &current_addr.to_a1(), &graph) {
            return Ok(true);
        }
    }

    Ok(false)
}

/// Helper function to check for cycles in dependency graph
fn would_create_cycle(
    from: &str,
    to: &str,
    graph: &std::collections::HashMap<String, Vec<String>>,
) -> bool {
    // If 'from' depends on 'to', adding 'to' -> 'from' would create a cycle
    let mut visited = HashSet::new();
    let mut stack = vec![from.to_string()];

    while let Some(current) = stack.pop() {
        if current == to {
            return true; // Found a path from 'from' to 'to'
        }

        if visited.insert(current.clone()) {
            if let Some(deps) = graph.get(&current) {
                for dep in deps {
                    stack.push(dep.clone());
                }
            }
        }
    }

    false
}

/// JavaScript-based evaluation context
struct JsEvaluationContext {
    cell_values: std::collections::HashMap<String, CellValue>,
    evaluation_stack: HashSet<String>,
}

impl JsEvaluationContext {
    fn from_js(context: JsValue) -> Result<Self, JsValue> {
        // Parse context object from JS
        // Expected format: { cellValues: { "A1": value, ... } }
        let context_obj: serde_json::Value = serde_wasm_bindgen::from_value(context)
            .map_err(|e| JsValue::from_str(&format!("Invalid context: {}", e)))?;

        let mut cell_values = std::collections::HashMap::new();

        if let Some(values) = context_obj.get("cellValues").and_then(|v| v.as_object()) {
            for (addr_str, value) in values {
                // Convert JSON value to CellValue
                let cell_value = match value {
                    serde_json::Value::Number(n) => CellValue::Number(n.as_f64().unwrap_or(0.0)),
                    serde_json::Value::String(s) => CellValue::String(s.clone()),
                    serde_json::Value::Bool(b) => CellValue::Boolean(*b),
                    serde_json::Value::Null => CellValue::Empty,
                    _ => CellValue::Empty,
                };

                cell_values.insert(addr_str.clone(), cell_value);
            }
        }

        Ok(JsEvaluationContext {
            cell_values,
            evaluation_stack: HashSet::new(),
        })
    }
}

impl EvaluationContext for JsEvaluationContext {
    fn get_cell_value(&self, address: &CellAddress) -> crate::Result<CellValue> {
        let addr_str = address.to_a1();

        Ok(self
            .cell_values
            .get(&addr_str)
            .cloned()
            .unwrap_or(CellValue::Empty))
    }

    fn check_circular(&self, address: &CellAddress) -> bool {
        self.evaluation_stack.contains(&address.to_a1())
    }

    fn push_evaluation(&mut self, address: &CellAddress) {
        self.evaluation_stack.insert(address.to_a1());
    }

    fn pop_evaluation(&mut self, address: &CellAddress) {
        self.evaluation_stack.remove(&address.to_a1());
    }
}
