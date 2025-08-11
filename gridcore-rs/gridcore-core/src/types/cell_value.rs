use super::ErrorType;
use serde::{Deserialize, Serialize};
use std::fmt;
use std::sync::Arc;

/// CellValue with optimized memory layout
/// Primitive variants (Number, Boolean, Empty) are Copy
/// Heap-allocated variants use Arc for cheap cloning
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub enum CellValue {
    Number(f64),
    String(Arc<String>),
    Boolean(bool),
    #[default]
    Empty,
    Error(Arc<ErrorType>),
    Array(Arc<Vec<CellValue>>),
}

impl CellValue {
    /// Create a String variant from a String
    pub fn from_string(s: String) -> Self {
        CellValue::String(Arc::new(s))
    }

    /// Create a String variant from a &str
    pub fn string_from_str(s: &str) -> Self {
        CellValue::String(Arc::new(s.to_string()))
    }

    /// Create an Error variant from ErrorType
    pub fn from_error(e: ErrorType) -> Self {
        CellValue::Error(Arc::new(e))
    }

    /// Create an Array variant from Vec<CellValue>
    pub fn from_array(arr: Vec<CellValue>) -> Self {
        CellValue::Array(Arc::new(arr))
    }

    /// Check if this value is cheap to clone (primitive types)
    pub fn is_cheap_clone(&self) -> bool {
        matches!(
            self,
            CellValue::Number(_) | CellValue::Boolean(_) | CellValue::Empty
        )
    }

    /// Get or clone the value - for primitives returns self, for heap types clones
    pub fn get_or_clone(&self) -> Self {
        self.clone()
    }
    /// Check if the value is numeric
    pub fn is_number(&self) -> bool {
        matches!(self, CellValue::Number(_))
    }

    /// Check if the value is a string
    pub fn is_string(&self) -> bool {
        matches!(self, CellValue::String(_))
    }

    /// Check if the value is a boolean
    pub fn is_boolean(&self) -> bool {
        matches!(self, CellValue::Boolean(_))
    }

    /// Check if the value is null/empty
    pub fn is_empty(&self) -> bool {
        matches!(self, CellValue::Empty)
    }

    /// Check if the value is an error
    pub fn is_error(&self) -> bool {
        matches!(self, CellValue::Error(_))
    }

    /// Try to get the numeric value
    pub fn as_number(&self) -> Option<f64> {
        match self {
            CellValue::Number(n) => Some(*n),
            _ => None,
        }
    }

    /// Try to get the string value
    pub fn as_string(&self) -> Option<&str> {
        match self {
            CellValue::String(s) => Some(s.as_ref()),
            _ => None,
        }
    }

    /// Try to get the boolean value
    pub fn as_boolean(&self) -> Option<bool> {
        match self {
            CellValue::Boolean(b) => Some(*b),
            _ => None,
        }
    }

    /// Get a human-readable type name
    pub fn type_name(&self) -> &str {
        match self {
            CellValue::Number(_) => "number",
            CellValue::String(_) => "string",
            CellValue::Boolean(_) => "boolean",
            CellValue::Empty => "empty",
            CellValue::Error(_) => "error",
            CellValue::Array(_) => "array",
        }
    }

    /// Convert to display string
    pub fn to_display_string(&self) -> String {
        match self {
            CellValue::Number(n) => n.to_string(),
            CellValue::String(s) => s.as_ref().clone(),
            CellValue::Boolean(b) => b.to_string().to_uppercase(),
            CellValue::Empty => String::new(),
            CellValue::Error(e) => e.excel_code().to_string(),
            CellValue::Array(arr) => format!("{:?}", arr),
        }
    }
}

impl fmt::Display for CellValue {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.to_display_string())
    }
}

// The from_js() and to_js() methods provide conversion utilities.

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::CellAddress;

    #[test]
    fn test_is_number() {
        assert!(CellValue::Number(42.0).is_number());
        assert!(CellValue::Number(0.0).is_number());
        assert!(CellValue::Number(-123.45).is_number());
        assert!(CellValue::Number(f64::INFINITY).is_number());

        assert!(!CellValue::string_from_str("42").is_number());
        assert!(!CellValue::Boolean(true).is_number());
        assert!(!CellValue::Empty.is_number());
        assert!(!CellValue::from_error(ErrorType::DivideByZero).is_number());
    }

    #[test]
    fn test_is_string() {
        assert!(CellValue::string_from_str("hello").is_string());
        assert!(CellValue::string_from_str("").is_string());
        assert!(CellValue::string_from_str("123").is_string());

        assert!(!CellValue::Number(42.0).is_string());
        assert!(!CellValue::Boolean(true).is_string());
        assert!(!CellValue::Empty.is_string());
        assert!(
            !CellValue::from_error(ErrorType::ParseError {
                message: "error".to_string()
            })
            .is_string()
        );
    }

    #[test]
    fn test_is_boolean() {
        assert!(CellValue::Boolean(true).is_boolean());
        assert!(CellValue::Boolean(false).is_boolean());

        assert!(!CellValue::string_from_str("true").is_boolean());
        assert!(!CellValue::Number(1.0).is_boolean());
        assert!(!CellValue::Number(0.0).is_boolean());
        assert!(!CellValue::Empty.is_boolean());
    }

    #[test]
    fn test_is_empty() {
        assert!(CellValue::Empty.is_empty());

        assert!(!CellValue::string_from_str("").is_empty());
        assert!(!CellValue::Number(0.0).is_empty());
        assert!(!CellValue::Boolean(false).is_empty());
        assert!(!CellValue::from_array(vec![]).is_empty());
    }

    #[test]
    fn test_is_error() {
        assert!(CellValue::from_error(ErrorType::DivideByZero).is_error());
        assert!(
            CellValue::from_error(ErrorType::ParseError {
                message: "".to_string()
            })
            .is_error()
        );

        assert!(!CellValue::string_from_str("error").is_error());
        assert!(!CellValue::Number(0.0).is_error());
        assert!(!CellValue::Empty.is_error());
    }

    #[test]
    fn test_as_number() {
        assert_eq!(CellValue::Number(42.0).as_number(), Some(42.0));
        assert_eq!(CellValue::Number(0.0).as_number(), Some(0.0));
        assert_eq!(CellValue::Number(-123.45).as_number(), Some(-123.45));

        assert_eq!(CellValue::string_from_str("42").as_number(), None);
        assert_eq!(CellValue::Boolean(true).as_number(), None);
        assert_eq!(CellValue::Empty.as_number(), None);
    }

    #[test]
    fn test_as_string() {
        assert_eq!(
            CellValue::string_from_str("hello").as_string(),
            Some("hello")
        );
        assert_eq!(CellValue::string_from_str("").as_string(), Some(""));

        assert_eq!(CellValue::Number(42.0).as_string(), None);
        assert_eq!(CellValue::Boolean(true).as_string(), None);
        assert_eq!(CellValue::Empty.as_string(), None);
    }

    #[test]
    fn test_as_boolean() {
        assert_eq!(CellValue::Boolean(true).as_boolean(), Some(true));
        assert_eq!(CellValue::Boolean(false).as_boolean(), Some(false));

        assert_eq!(CellValue::Number(1.0).as_boolean(), None);
        assert_eq!(CellValue::string_from_str("true").as_boolean(), None);
        assert_eq!(CellValue::Empty.as_boolean(), None);
    }

    #[test]
    fn test_type_name() {
        assert_eq!(CellValue::Number(42.0).type_name(), "number");
        assert_eq!(CellValue::string_from_str("hello").type_name(), "string");
        assert_eq!(CellValue::Boolean(true).type_name(), "boolean");
        assert_eq!(CellValue::Empty.type_name(), "empty");
        assert_eq!(
            CellValue::from_error(ErrorType::DivideByZero).type_name(),
            "error"
        );
        assert_eq!(CellValue::from_array(vec![]).type_name(), "array");
    }

    #[test]
    fn test_to_display_string() {
        assert_eq!(CellValue::Number(42.0).to_display_string(), "42");
        assert_eq!(CellValue::Number(123.45).to_display_string(), "123.45");
        assert_eq!(
            CellValue::string_from_str("hello").to_display_string(),
            "hello"
        );
        assert_eq!(CellValue::Boolean(true).to_display_string(), "TRUE");
        assert_eq!(CellValue::Boolean(false).to_display_string(), "FALSE");
        assert_eq!(CellValue::Empty.to_display_string(), "");
        assert_eq!(
            CellValue::from_error(ErrorType::DivideByZero).to_display_string(),
            "#DIV/0!"
        );
        assert_eq!(
            CellValue::from_error(ErrorType::InvalidRef {
                reference: "A0".to_string()
            })
            .to_display_string(),
            "#REF!"
        );

        let array = CellValue::from_array(vec![CellValue::Number(1.0), CellValue::Number(2.0)]);
        assert!(array.to_display_string().contains("Number(1"));
        assert!(array.to_display_string().contains("Number(2"));
    }

    #[test]
    fn test_default() {
        let default_value = CellValue::default();
        assert!(default_value.is_empty());
        assert_eq!(default_value, CellValue::Empty);
    }

    #[test]
    fn test_error_variants() {
        // Test different error types
        let div_error = CellValue::from_error(ErrorType::DivideByZero);
        assert!(div_error.is_error());
        assert_eq!(div_error.to_display_string(), "#DIV/0!");
        assert_eq!(div_error.type_name(), "error");

        let ref_error = CellValue::from_error(ErrorType::InvalidRef {
            reference: "Sheet1!A0".to_string(),
        });
        assert!(ref_error.is_error());
        assert_eq!(ref_error.to_display_string(), "#REF!");

        let name_error = CellValue::from_error(ErrorType::NameError {
            name: "VLOOKUP".to_string(),
        });
        assert!(name_error.is_error());
        assert_eq!(name_error.to_display_string(), "#NAME?");

        let value_error = CellValue::from_error(ErrorType::ValueError {
            expected: "number".to_string(),
            actual: "text".to_string(),
        });
        assert!(value_error.is_error());
        assert_eq!(value_error.to_display_string(), "#VALUE!");

        let circ_error = CellValue::from_error(ErrorType::CircularDependency {
            cells: vec![CellAddress::new(0, 0), CellAddress::new(1, 1)],
        });
        assert!(circ_error.is_error());
        assert_eq!(circ_error.to_display_string(), "#CIRC!");

        let num_error = CellValue::from_error(ErrorType::NumError);
        assert!(num_error.is_error());
        assert_eq!(num_error.to_display_string(), "#NUM!");
    }

    #[test]
    fn test_error_not_convertible() {
        let error = CellValue::from_error(ErrorType::DivideByZero);

        // Errors should not convert to other types
        assert_eq!(error.as_number(), None);
        assert_eq!(error.as_string(), None);
        assert_eq!(error.as_boolean(), None);
        assert!(!error.is_empty());
        assert!(!error.is_number());
        assert!(!error.is_string());
        assert!(!error.is_boolean());
        assert!(error.is_error());
    }

    #[test]
    fn test_error_equality() {
        let error1 = CellValue::from_error(ErrorType::DivideByZero);
        let error2 = CellValue::from_error(ErrorType::DivideByZero);
        let error3 = CellValue::from_error(ErrorType::NumError);

        assert_eq!(error1, error2);
        assert_ne!(error1, error3);

        let ref_error1 = CellValue::from_error(ErrorType::InvalidRef {
            reference: "A1".to_string(),
        });
        let ref_error2 = CellValue::from_error(ErrorType::InvalidRef {
            reference: "A1".to_string(),
        });
        let ref_error3 = CellValue::from_error(ErrorType::InvalidRef {
            reference: "B1".to_string(),
        });

        assert_eq!(ref_error1, ref_error2);
        assert_ne!(ref_error1, ref_error3);
    }

    #[test]
    fn test_equality() {
        assert_eq!(CellValue::Number(42.0), CellValue::Number(42.0));
        assert_ne!(CellValue::Number(42.0), CellValue::Number(43.0));

        assert_eq!(
            CellValue::string_from_str("hello"),
            CellValue::string_from_str("hello")
        );
        assert_ne!(
            CellValue::string_from_str("hello"),
            CellValue::string_from_str("world")
        );

        assert_eq!(CellValue::Boolean(true), CellValue::Boolean(true));
        assert_ne!(CellValue::Boolean(true), CellValue::Boolean(false));

        assert_eq!(CellValue::Empty, CellValue::Empty);

        assert_eq!(
            CellValue::from_error(ErrorType::DivideByZero),
            CellValue::from_error(ErrorType::DivideByZero)
        );
        assert_ne!(
            CellValue::from_error(ErrorType::DivideByZero),
            CellValue::from_error(ErrorType::NumError)
        );
    }

    #[test]
    fn test_clone() {
        let original = CellValue::string_from_str("hello");
        let cloned = original.clone();
        assert_eq!(original, cloned);

        let original = CellValue::from_array(vec![
            CellValue::Number(1.0),
            CellValue::string_from_str("test"),
        ]);
        let cloned = original.clone();
        assert_eq!(original, cloned);
    }

    #[test]
    fn test_display_trait() {
        assert_eq!(format!("{}", CellValue::Number(42.0)), "42");
        assert_eq!(format!("{}", CellValue::string_from_str("hello")), "hello");
        assert_eq!(format!("{}", CellValue::Boolean(true)), "TRUE");
        assert_eq!(format!("{}", CellValue::Empty), "");
        assert_eq!(
            format!("{}", CellValue::from_error(ErrorType::DivideByZero)),
            "#DIV/0!"
        );
        assert_eq!(
            format!(
                "{}",
                CellValue::from_error(ErrorType::NameError {
                    name: "FOO".to_string()
                })
            ),
            "#NAME?"
        );
    }

    #[test]
    fn test_parse_numeric_value() {
        // Test parsing from strings (similar to TypeScript parseNumericValue)
        fn parse_numeric(s: &str) -> Option<f64> {
            s.parse::<f64>().ok()
        }

        assert_eq!(parse_numeric("42"), Some(42.0));
        assert_eq!(parse_numeric("123.45"), Some(123.45));
        assert_eq!(parse_numeric("-67.89"), Some(-67.89));
        assert_eq!(parse_numeric("0"), Some(0.0));

        assert_eq!(parse_numeric("abc"), None);
        assert_eq!(parse_numeric(""), None);
        assert_eq!(parse_numeric(" "), None);
    }

    #[test]
    fn test_nan_handling() {
        // Test that NaN is handled properly
        let nan_value = CellValue::Number(f64::NAN);
        assert!(nan_value.is_number());
        if let Some(n) = nan_value.as_number() {
            assert!(n.is_nan());
        }
    }

    #[test]
    fn test_infinity_handling() {
        let pos_inf = CellValue::Number(f64::INFINITY);
        assert!(pos_inf.is_number());
        assert_eq!(pos_inf.as_number(), Some(f64::INFINITY));

        let neg_inf = CellValue::Number(f64::NEG_INFINITY);
        assert!(neg_inf.is_number());
        assert_eq!(neg_inf.as_number(), Some(f64::NEG_INFINITY));
    }
}
