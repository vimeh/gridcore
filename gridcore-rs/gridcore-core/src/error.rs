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
}

pub type Result<T> = std::result::Result<T, SpreadsheetError>;