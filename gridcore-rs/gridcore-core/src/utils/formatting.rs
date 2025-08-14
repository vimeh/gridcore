//! Formatting utilities for cell values

use crate::types::CellValue;

/// Format a cell value as a string for display
pub fn format_cell_value(value: CellValue) -> String {
    match value {
        CellValue::Number(n) => n.to_string(),
        CellValue::String(s) => s.as_ref().clone(),
        CellValue::Boolean(b) => b.to_string(),
        CellValue::Error(e) => format!("#{}", e),
        CellValue::Empty => String::new(),
        CellValue::Array(arr) => format_array(&arr),
    }
}

/// Format an array of cell values
fn format_array(arr: &[CellValue]) -> String {
    let values: Vec<String> = arr.iter().map(|v| format_cell_value(v.clone())).collect();
    format!("{{{}}}", values.join(", "))
}
