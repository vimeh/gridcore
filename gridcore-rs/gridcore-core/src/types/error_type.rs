use crate::types::CellAddress;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub enum ErrorType {
    #[default]
    DivideByZero,
    InvalidRef {
        reference: String,
    },
    NameError {
        name: String,
    },
    ValueError {
        expected: String,
        actual: String,
    },
    CircularDependency {
        cells: Vec<CellAddress>,
    },
    NumError,
    ParseError {
        message: String,
    },
    InvalidRange {
        range: String,
    },
    InvalidArguments {
        function: String,
        message: String,
    },
    InvalidOperation {
        message: String,
    },
}

impl ErrorType {
    /// Get the Excel-compatible error code
    pub fn excel_code(&self) -> &str {
        match self {
            ErrorType::DivideByZero => "#DIV/0!",
            ErrorType::InvalidRef { .. } => "#REF!",
            ErrorType::NameError { .. } => "#NAME?",
            ErrorType::ValueError { .. } => "#VALUE!",
            ErrorType::CircularDependency { .. } => "#CIRC!",
            ErrorType::NumError => "#NUM!",
            ErrorType::ParseError { .. } => "#ERROR!",
            ErrorType::InvalidRange { .. } => "#REF!",
            ErrorType::InvalidArguments { .. } => "#VALUE!",
            ErrorType::InvalidOperation { .. } => "#ERROR!",
        }
    }

    /// Get a human-readable description of the error
    pub fn description(&self) -> String {
        match self {
            ErrorType::DivideByZero => "Division by zero".to_string(),
            ErrorType::InvalidRef { reference } => format!("Invalid reference: {}", reference),
            ErrorType::NameError { name } => format!("Unknown name or function: {}", name),
            ErrorType::ValueError { expected, actual } => {
                format!("Type mismatch: expected {}, got {}", expected, actual)
            }
            ErrorType::CircularDependency { cells } => {
                if cells.is_empty() {
                    "Circular reference detected".to_string()
                } else {
                    format!(
                        "Circular reference detected involving cells: {}",
                        cells
                            .iter()
                            .map(|c| c.to_string())
                            .collect::<Vec<_>>()
                            .join(", ")
                    )
                }
            }
            ErrorType::NumError => "Numeric calculation error".to_string(),
            ErrorType::ParseError { message } => format!("Parse error: {}", message),
            ErrorType::InvalidRange { range } => format!("Invalid range: {}", range),
            ErrorType::InvalidArguments { function, message } => {
                format!("Invalid arguments for {}: {}", function, message)
            }
            ErrorType::InvalidOperation { message } => format!("Invalid operation: {}", message),
        }
    }

    /// Get both the Excel code and description for display
    pub fn full_display(&self) -> String {
        format!("{} - {}", self.excel_code(), self.description())
    }
}

impl std::fmt::Display for ErrorType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.excel_code())
    }
}
