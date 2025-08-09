use crate::types::ErrorType;
use thiserror::Error;

#[derive(Debug, Error, Clone)]
pub enum SpreadsheetError {
    #[error("Parse error: {0}")]
    Parse(String),

    #[error("Invalid cell reference: {0}")]
    InvalidRef(String),

    #[error("Invalid cell address: {0}")]
    InvalidAddress(String),

    #[error("#DIV/0!")]
    DivideByZero,

    #[error("#VALUE!")]
    ValueError,

    #[error("#REF!")]
    RefError,

    #[error("#NAME?")]
    NameError,

    #[error("#NUM!")]
    NumError,

    #[error("Circular dependency detected")]
    CircularDependency,

    #[error("Invalid range: {0}")]
    InvalidRange(String),

    #[error("Type mismatch: expected {expected}, got {actual}")]
    TypeMismatch { expected: String, actual: String },

    #[error("Division by zero")]
    DivisionByZero,

    #[error("Type error: {0}")]
    TypeError(String),

    #[error("Unknown function: {0}")]
    UnknownFunction(String),

    #[error("Invalid arguments: {0}")]
    InvalidArguments(String),

    #[error("Formula error: {0}")]
    FormulaError(String),

    #[error("Invalid formula: {0}")]
    InvalidFormula(String),

    #[error("Batch not found: {0}")]
    BatchNotFound(String),

    #[error("Batch operation failed: {0}")]
    BatchOperationFailed(String),

    #[error("Invalid operation: {0}")]
    InvalidOperation(String),
}

impl SpreadsheetError {
    /// Convert SpreadsheetError to ErrorType for cell values
    pub fn to_error_type(&self) -> ErrorType {
        match self {
            SpreadsheetError::DivisionByZero | SpreadsheetError::DivideByZero => {
                ErrorType::DivideByZero
            }
            SpreadsheetError::ValueError => ErrorType::ValueError {
                expected: "valid value".to_string(),
                actual: "invalid".to_string(),
            },
            SpreadsheetError::TypeError(msg) => ErrorType::ValueError {
                expected: "valid value".to_string(),
                actual: msg.clone(),
            },
            SpreadsheetError::RefError => ErrorType::InvalidRef {
                reference: "unknown".to_string(),
            },
            SpreadsheetError::InvalidRef(reference) => ErrorType::InvalidRef {
                reference: reference.clone(),
            },
            SpreadsheetError::InvalidAddress(addr) => ErrorType::InvalidRef {
                reference: addr.clone(),
            },
            SpreadsheetError::NameError => ErrorType::NameError {
                name: "unknown".to_string(),
            },
            SpreadsheetError::UnknownFunction(name) => ErrorType::NameError { name: name.clone() },
            SpreadsheetError::NumError => ErrorType::NumError,
            SpreadsheetError::CircularDependency => {
                ErrorType::CircularDependency { cells: Vec::new() }
            }
            SpreadsheetError::InvalidRange(range) => ErrorType::InvalidRange {
                range: range.clone(),
            },
            SpreadsheetError::TypeMismatch { expected, actual } => ErrorType::ValueError {
                expected: expected.clone(),
                actual: actual.clone(),
            },
            SpreadsheetError::InvalidArguments(msg) => ErrorType::InvalidArguments {
                function: "unknown".to_string(),
                message: msg.clone(),
            },
            SpreadsheetError::Parse(msg) => {
                // Try to determine the specific error type from the message
                if msg.contains("#REF!") || msg.contains("Invalid reference") {
                    ErrorType::InvalidRef {
                        reference: msg.clone(),
                    }
                } else if msg.contains("#NAME?") || msg.contains("Unknown function") {
                    ErrorType::NameError { name: msg.clone() }
                } else {
                    ErrorType::ParseError {
                        message: msg.clone(),
                    }
                }
            }
            _ => ErrorType::InvalidOperation {
                message: self.to_string(),
            },
        }
    }
}

pub type Result<T> = std::result::Result<T, SpreadsheetError>;
