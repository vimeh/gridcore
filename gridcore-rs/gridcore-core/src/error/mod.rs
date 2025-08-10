pub mod recovery;

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

    #[error("Lock error: {0}")]
    LockError(String),

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

    #[error("Invalid command: {0}")]
    InvalidCommand(String),
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_to_error_type_division_by_zero() {
        let error = SpreadsheetError::DivisionByZero;
        let error_type = error.to_error_type();
        assert_eq!(error_type, ErrorType::DivideByZero);
    }

    #[test]
    fn test_to_error_type_ref_error() {
        let error = SpreadsheetError::RefError;
        let error_type = error.to_error_type();
        assert_eq!(
            error_type,
            ErrorType::InvalidRef {
                reference: "unknown".to_string()
            }
        );
    }

    #[test]
    fn test_to_error_type_name_error() {
        // Test both NameError and UnknownFunction
        let error = SpreadsheetError::NameError;
        let error_type = error.to_error_type();
        assert_eq!(
            error_type,
            ErrorType::NameError {
                name: "unknown".to_string()
            }
        );

        let error = SpreadsheetError::UnknownFunction("VLOOKUP".to_string());
        let error_type = error.to_error_type();
        assert_eq!(
            error_type,
            ErrorType::NameError {
                name: "VLOOKUP".to_string()
            }
        );
    }

    #[test]
    fn test_to_error_type_value_error() {
        let error = SpreadsheetError::ValueError;
        let error_type = error.to_error_type();
        assert_eq!(
            error_type,
            ErrorType::ValueError {
                expected: "valid value".to_string(),
                actual: "invalid".to_string()
            }
        );
    }

    #[test]
    fn test_to_error_type_num_error() {
        let error = SpreadsheetError::NumError;
        let error_type = error.to_error_type();
        assert_eq!(error_type, ErrorType::NumError);
    }

    #[test]
    fn test_to_error_type_circular_dependency() {
        let error = SpreadsheetError::CircularDependency;
        let error_type = error.to_error_type();
        assert_eq!(
            error_type,
            ErrorType::CircularDependency { cells: Vec::new() }
        );
    }

    #[test]
    fn test_to_error_type_invalid_address() {
        let error = SpreadsheetError::InvalidAddress("ZZ999999".to_string());
        let error_type = error.to_error_type();
        if let ErrorType::InvalidRef { reference } = error_type {
            assert!(reference.contains("ZZ999999"));
        } else {
            panic!("Expected InvalidRef error type");
        }
    }

    #[test]
    fn test_to_error_type_invalid_range() {
        let error = SpreadsheetError::InvalidRange("A1:Z".to_string());
        let error_type = error.to_error_type();
        assert_eq!(
            error_type,
            ErrorType::InvalidRange {
                range: "A1:Z".to_string()
            }
        );
    }

    #[test]
    fn test_to_error_type_type_mismatch() {
        let error = SpreadsheetError::TypeMismatch {
            expected: "number".to_string(),
            actual: "string".to_string(),
        };
        let error_type = error.to_error_type();
        assert_eq!(
            error_type,
            ErrorType::ValueError {
                expected: "number".to_string(),
                actual: "string".to_string()
            }
        );
    }

    #[test]
    fn test_to_error_type_invalid_arguments() {
        let error = SpreadsheetError::InvalidArguments("wrong number of arguments".to_string());
        let error_type = error.to_error_type();
        assert_eq!(
            error_type,
            ErrorType::InvalidArguments {
                function: "unknown".to_string(),
                message: "wrong number of arguments".to_string()
            }
        );
    }

    #[test]
    fn test_to_error_type_parse_with_ref() {
        let error = SpreadsheetError::Parse("Invalid reference: #REF!".to_string());
        let error_type = error.to_error_type();
        assert_eq!(
            error_type,
            ErrorType::InvalidRef {
                reference: "Invalid reference: #REF!".to_string()
            }
        );
    }

    #[test]
    fn test_to_error_type_parse_with_name() {
        let error = SpreadsheetError::Parse("Unknown function: VLOOKUP".to_string());
        let error_type = error.to_error_type();
        assert_eq!(
            error_type,
            ErrorType::NameError {
                name: "Unknown function: VLOOKUP".to_string()
            }
        );
    }

    #[test]
    fn test_to_error_type_parse_general() {
        let error = SpreadsheetError::Parse("unexpected token".to_string());
        let error_type = error.to_error_type();
        assert_eq!(
            error_type,
            ErrorType::ParseError {
                message: "unexpected token".to_string()
            }
        );
    }

    #[test]
    fn test_to_error_type_other_errors() {
        // Test that unknown function maps to NameError
        let error = SpreadsheetError::UnknownFunction("VLOOKUP".to_string());
        let error_type = error.to_error_type();
        if let ErrorType::NameError { name } = error_type {
            assert!(name.contains("VLOOKUP"));
        } else {
            panic!("Expected NameError error type");
        }
    }

    #[test]
    fn test_error_display() {
        let error = SpreadsheetError::DivisionByZero;
        assert_eq!(error.to_string(), "Division by zero");

        let error = SpreadsheetError::RefError;
        assert_eq!(error.to_string(), "#REF!");

        let error = SpreadsheetError::NameError;
        assert_eq!(error.to_string(), "#NAME?");

        let error = SpreadsheetError::ValueError;
        assert_eq!(error.to_string(), "#VALUE!");

        let error = SpreadsheetError::NumError;
        assert_eq!(error.to_string(), "#NUM!");
    }
}
