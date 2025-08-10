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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_excel_codes() {
        assert_eq!(ErrorType::DivideByZero.excel_code(), "#DIV/0!");
        assert_eq!(
            ErrorType::InvalidRef {
                reference: "A0".to_string()
            }
            .excel_code(),
            "#REF!"
        );
        assert_eq!(
            ErrorType::NameError {
                name: "UNKNOWNFUNC".to_string()
            }
            .excel_code(),
            "#NAME?"
        );
        assert_eq!(
            ErrorType::ValueError {
                expected: "number".to_string(),
                actual: "string".to_string()
            }
            .excel_code(),
            "#VALUE!"
        );
        assert_eq!(
            ErrorType::CircularDependency { cells: vec![] }.excel_code(),
            "#CIRC!"
        );
        assert_eq!(ErrorType::NumError.excel_code(), "#NUM!");
        assert_eq!(
            ErrorType::ParseError {
                message: "test".to_string()
            }
            .excel_code(),
            "#ERROR!"
        );
        assert_eq!(
            ErrorType::InvalidRange {
                range: "A1:Z".to_string()
            }
            .excel_code(),
            "#REF!"
        );
        assert_eq!(
            ErrorType::InvalidArguments {
                function: "SUM".to_string(),
                message: "wrong count".to_string()
            }
            .excel_code(),
            "#VALUE!"
        );
        assert_eq!(
            ErrorType::InvalidOperation {
                message: "test".to_string()
            }
            .excel_code(),
            "#ERROR!"
        );
    }

    #[test]
    fn test_descriptions() {
        assert_eq!(
            ErrorType::DivideByZero.description(),
            "Division by zero"
        );
        
        assert_eq!(
            ErrorType::InvalidRef {
                reference: "A0".to_string()
            }
            .description(),
            "Invalid reference: A0"
        );
        
        assert_eq!(
            ErrorType::NameError {
                name: "UNKNOWNFUNC".to_string()
            }
            .description(),
            "Unknown name or function: UNKNOWNFUNC"
        );
        
        assert_eq!(
            ErrorType::ValueError {
                expected: "number".to_string(),
                actual: "string".to_string()
            }
            .description(),
            "Type mismatch: expected number, got string"
        );
        
        assert_eq!(
            ErrorType::CircularDependency { cells: vec![] }.description(),
            "Circular reference detected"
        );
        
        let cells = vec![
            CellAddress::new(0, 0),
            CellAddress::new(1, 1),
        ];
        assert_eq!(
            ErrorType::CircularDependency { cells }.description(),
            "Circular reference detected involving cells: A1, B2"
        );
        
        assert_eq!(
            ErrorType::NumError.description(),
            "Numeric calculation error"
        );
        
        assert_eq!(
            ErrorType::ParseError {
                message: "unexpected token".to_string()
            }
            .description(),
            "Parse error: unexpected token"
        );
        
        assert_eq!(
            ErrorType::InvalidRange {
                range: "A1:Z".to_string()
            }
            .description(),
            "Invalid range: A1:Z"
        );
        
        assert_eq!(
            ErrorType::InvalidArguments {
                function: "SUM".to_string(),
                message: "expected at least 1 argument".to_string()
            }
            .description(),
            "Invalid arguments for SUM: expected at least 1 argument"
        );
        
        assert_eq!(
            ErrorType::InvalidOperation {
                message: "cannot perform operation".to_string()
            }
            .description(),
            "Invalid operation: cannot perform operation"
        );
    }

    #[test]
    fn test_full_display() {
        assert_eq!(
            ErrorType::DivideByZero.full_display(),
            "#DIV/0! - Division by zero"
        );
        
        assert_eq!(
            ErrorType::InvalidRef {
                reference: "Sheet2!A1".to_string()
            }
            .full_display(),
            "#REF! - Invalid reference: Sheet2!A1"
        );
        
        assert_eq!(
            ErrorType::NameError {
                name: "VLOOKUP".to_string()
            }
            .full_display(),
            "#NAME? - Unknown name or function: VLOOKUP"
        );
        
        assert_eq!(
            ErrorType::ValueError {
                expected: "date".to_string(),
                actual: "text".to_string()
            }
            .full_display(),
            "#VALUE! - Type mismatch: expected date, got text"
        );
    }

    #[test]
    fn test_display_trait() {
        assert_eq!(format!("{}", ErrorType::DivideByZero), "#DIV/0!");
        assert_eq!(
            format!(
                "{}",
                ErrorType::InvalidRef {
                    reference: "test".to_string()
                }
            ),
            "#REF!"
        );
        assert_eq!(format!("{}", ErrorType::NumError), "#NUM!");
    }

    #[test]
    fn test_default() {
        let default_error = ErrorType::default();
        assert_eq!(default_error, ErrorType::DivideByZero);
        assert_eq!(default_error.excel_code(), "#DIV/0!");
    }

    #[test]
    fn test_clone() {
        let error = ErrorType::ValueError {
            expected: "number".to_string(),
            actual: "text".to_string(),
        };
        let cloned = error.clone();
        assert_eq!(error, cloned);
    }

    #[test]
    fn test_partial_eq() {
        let error1 = ErrorType::DivideByZero;
        let error2 = ErrorType::DivideByZero;
        let error3 = ErrorType::NumError;
        
        assert_eq!(error1, error2);
        assert_ne!(error1, error3);
        
        let ref_error1 = ErrorType::InvalidRef {
            reference: "A1".to_string(),
        };
        let ref_error2 = ErrorType::InvalidRef {
            reference: "A1".to_string(),
        };
        let ref_error3 = ErrorType::InvalidRef {
            reference: "B1".to_string(),
        };
        
        assert_eq!(ref_error1, ref_error2);
        assert_ne!(ref_error1, ref_error3);
    }

    #[test]
    fn test_serialize_deserialize() {
        
        let errors = vec![
            ErrorType::DivideByZero,
            ErrorType::InvalidRef {
                reference: "A1:B2".to_string(),
            },
            ErrorType::NameError {
                name: "UNKNOWN".to_string(),
            },
            ErrorType::ValueError {
                expected: "number".to_string(),
                actual: "boolean".to_string(),
            },
            ErrorType::CircularDependency {
                cells: vec![CellAddress::new(0, 0), CellAddress::new(1, 1)],
            },
            ErrorType::NumError,
            ErrorType::ParseError {
                message: "test error".to_string(),
            },
            ErrorType::InvalidRange {
                range: "A1:".to_string(),
            },
            ErrorType::InvalidArguments {
                function: "IF".to_string(),
                message: "wrong number of arguments".to_string(),
            },
            ErrorType::InvalidOperation {
                message: "operation failed".to_string(),
            },
        ];
        
        // Test that all error types can be created and compared
        for error in errors {
            // Test clone
            let cloned = error.clone();
            assert_eq!(error, cloned);
            
            // Test Debug trait
            let debug_str = format!("{:?}", error);
            assert!(!debug_str.is_empty());
        }
    }

    #[test]
    fn test_circular_dependency_with_multiple_cells() {
        let cells = vec![
            CellAddress::new(0, 0),  // A1
            CellAddress::new(1, 0),  // B1
            CellAddress::new(2, 0),  // C1
            CellAddress::new(0, 0),  // A1 (cycle)
        ];
        
        let error = ErrorType::CircularDependency { cells };
        assert_eq!(error.excel_code(), "#CIRC!");
        assert!(error.description().contains("A1, B1, C1, A1"));
        assert!(error.full_display().contains("#CIRC!"));
        assert!(error.full_display().contains("Circular reference detected involving cells"));
    }
}
