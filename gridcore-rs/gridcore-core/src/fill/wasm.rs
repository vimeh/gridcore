use super::{CellRange, FillDirection, FillOperation, FillResult, PatternType};
use crate::types::{CellAddress, CellValue};

#[cfg(feature = "wasm")]
use serde::{Deserialize, Serialize};
#[cfg(feature = "wasm")]
use wasm_bindgen::prelude::*;

#[cfg(feature = "wasm")]
#[derive(Serialize, Deserialize)]
pub struct JsFillOperation {
    pub source_start_col: u32,
    pub source_start_row: u32,
    pub source_end_col: u32,
    pub source_end_row: u32,
    pub target_start_col: u32,
    pub target_start_row: u32,
    pub target_end_col: u32,
    pub target_end_row: u32,
    pub direction: String,          // "down", "up", "left", "right"
    pub pattern: Option<String>, // "linear", "exponential", "date", "text", "copy", or null for auto-detect
    pub pattern_param: Option<f64>, // slope for linear, rate for exponential, etc.
}

#[cfg(feature = "wasm")]
#[derive(Serialize, Deserialize)]
pub struct JsFillResult {
    pub affected_cells: Vec<JsAffectedCell>,
    pub formulas_adjusted: Vec<JsAdjustedFormula>,
}

#[cfg(feature = "wasm")]
#[derive(Serialize, Deserialize)]
pub struct JsAffectedCell {
    pub col: u32,
    pub row: u32,
    pub value: JsCellValue,
}

#[cfg(feature = "wasm")]
#[derive(Serialize, Deserialize)]
pub struct JsAdjustedFormula {
    pub col: u32,
    pub row: u32,
    pub formula: String,
}

#[cfg(feature = "wasm")]
#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum JsCellValue {
    Empty,
    Number { value: f64 },
    String { value: String },
    Boolean { value: bool },
    Error { value: String },
}

#[cfg(feature = "wasm")]
impl From<CellValue> for JsCellValue {
    fn from(value: CellValue) -> Self {
        match value {
            CellValue::Empty => JsCellValue::Empty,
            CellValue::Number(n) => JsCellValue::Number { value: n },
            CellValue::String(s) => JsCellValue::String { value: s },
            CellValue::Boolean(b) => JsCellValue::Boolean { value: b },
            CellValue::Error(e) => JsCellValue::Error { value: e },
            CellValue::Array(_) => JsCellValue::Error {
                value: "Array values not yet supported in fill operations".to_string(),
            },
        }
    }
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub struct WasmFillOperation {
    source_start_col: u32,
    source_start_row: u32,
    source_end_col: u32,
    source_end_row: u32,
    target_start_col: u32,
    target_start_row: u32,
    target_end_col: u32,
    target_end_row: u32,
    direction: String,
    pattern: Option<String>,
    pattern_param: Option<f64>,
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
impl WasmFillOperation {
    #[wasm_bindgen(constructor)]
    pub fn new(
        source_start_col: u32,
        source_start_row: u32,
        source_end_col: u32,
        source_end_row: u32,
        target_start_col: u32,
        target_start_row: u32,
        target_end_col: u32,
        target_end_row: u32,
        direction: String,
    ) -> Self {
        Self {
            source_start_col,
            source_start_row,
            source_end_col,
            source_end_row,
            target_start_col,
            target_start_row,
            target_end_col,
            target_end_row,
            direction,
            pattern: None,
            pattern_param: None,
        }
    }

    #[wasm_bindgen(js_name = "setPattern")]
    pub fn set_pattern(&mut self, pattern: String, param: Option<f64>) {
        self.pattern = Some(pattern);
        self.pattern_param = param;
    }

    #[wasm_bindgen(js_name = "toInternal")]
    pub fn to_internal(&self) -> Result<JsValue, JsValue> {
        let operation = JsFillOperation {
            source_start_col: self.source_start_col,
            source_start_row: self.source_start_row,
            source_end_col: self.source_end_col,
            source_end_row: self.source_end_row,
            target_start_col: self.target_start_col,
            target_start_row: self.target_start_row,
            target_end_col: self.target_end_row,
            target_end_row: self.target_end_row,
            direction: self.direction.clone(),
            pattern: self.pattern.clone(),
            pattern_param: self.pattern_param,
        };

        serde_wasm_bindgen::to_value(&operation)
            .map_err(|e| JsValue::from_str(&format!("Failed to convert operation: {}", e)))
    }
}

// Helper function to parse a fill operation from JS
#[cfg(feature = "wasm")]
pub fn parse_fill_operation(op: JsFillOperation) -> Result<FillOperation, String> {
    let source_range = CellRange::new(
        CellAddress::new(op.source_start_col, op.source_start_row),
        CellAddress::new(op.source_end_col, op.source_end_row),
    );

    let target_range = CellRange::new(
        CellAddress::new(op.target_start_col, op.target_start_row),
        CellAddress::new(op.target_end_col, op.target_end_row),
    );

    let direction = match op.direction.as_str() {
        "down" => FillDirection::Down,
        "up" => FillDirection::Up,
        "left" => FillDirection::Left,
        "right" => FillDirection::Right,
        _ => return Err(format!("Invalid direction: {}", op.direction)),
    };

    let pattern = if let Some(pattern_type) = op.pattern {
        match pattern_type.as_str() {
            "linear" => Some(PatternType::Linear(op.pattern_param.unwrap_or(1.0))),
            "exponential" => Some(PatternType::Exponential(op.pattern_param.unwrap_or(2.0))),
            "copy" => Some(PatternType::Copy),
            "text" => Some(PatternType::Text),
            _ => None,
        }
    } else {
        None // Auto-detect
    };

    Ok(FillOperation {
        source_range,
        target_range,
        direction,
        pattern,
    })
}

// Helper function to convert a fill result to JS
#[cfg(feature = "wasm")]
pub fn convert_fill_result(result: FillResult) -> JsFillResult {
    JsFillResult {
        affected_cells: result
            .affected_cells
            .into_iter()
            .map(|(addr, value)| JsAffectedCell {
                col: addr.col,
                row: addr.row,
                value: value.into(),
            })
            .collect(),
        formulas_adjusted: result
            .formulas_adjusted
            .into_iter()
            .map(|(addr, formula)| JsAdjustedFormula {
                col: addr.col,
                row: addr.row,
                formula,
            })
            .collect(),
    }
}

// Helper to create a fill operation from JS values
#[cfg(feature = "wasm")]
#[wasm_bindgen(js_name = "createFillOperation")]
pub fn create_fill_operation(
    source_start_col: u32,
    source_start_row: u32,
    source_end_col: u32,
    source_end_row: u32,
    target_start_col: u32,
    target_start_row: u32,
    target_end_col: u32,
    target_end_row: u32,
    direction: &str,
) -> Result<JsValue, JsValue> {
    let operation = JsFillOperation {
        source_start_col,
        source_start_row,
        source_end_col,
        source_end_row,
        target_start_col,
        target_start_row,
        target_end_col,
        target_end_row,
        direction: direction.to_string(),
        pattern: None,
        pattern_param: None,
    };

    serde_wasm_bindgen::to_value(&operation)
        .map_err(|e| JsValue::from_str(&format!("Failed to create operation: {}", e)))
}
