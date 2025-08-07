use thiserror::Error;

#[derive(Debug, Error, Clone)]
#[cfg_attr(feature = "wasm", derive(serde::Serialize))]
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

pub type Result<T> = std::result::Result<T, SpreadsheetError>;
