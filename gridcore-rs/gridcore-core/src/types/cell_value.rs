use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum CellValue {
    Number(f64),
    String(String),
    Boolean(bool),
    Empty,
    Error(String),
    Array(Vec<CellValue>),
}

impl CellValue {
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
            CellValue::String(s) => Some(s),
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
            CellValue::String(s) => s.clone(),
            CellValue::Boolean(b) => b.to_string().to_uppercase(),
            CellValue::Empty => String::new(),
            CellValue::Error(e) => {
                // Display Excel-compatible error format
                if !e.starts_with('#') {
                    format!("#{}", e)
                } else {
                    e.clone()
                }
            }
            CellValue::Array(arr) => format!("{:?}", arr),
        }
    }
}

impl Default for CellValue {
    fn default() -> Self {
        CellValue::Empty
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

    #[test]
    fn test_is_number() {
        assert!(CellValue::Number(42.0).is_number());
        assert!(CellValue::Number(0.0).is_number());
        assert!(CellValue::Number(-123.45).is_number());
        assert!(CellValue::Number(f64::INFINITY).is_number());

        assert!(!CellValue::String("42".to_string()).is_number());
        assert!(!CellValue::Boolean(true).is_number());
        assert!(!CellValue::Empty.is_number());
        assert!(!CellValue::Error("error".to_string()).is_number());
    }

    #[test]
    fn test_is_string() {
        assert!(CellValue::String("hello".to_string()).is_string());
        assert!(CellValue::String("".to_string()).is_string());
        assert!(CellValue::String("123".to_string()).is_string());

        assert!(!CellValue::Number(42.0).is_string());
        assert!(!CellValue::Boolean(true).is_string());
        assert!(!CellValue::Empty.is_string());
        assert!(!CellValue::Error("error".to_string()).is_string());
    }

    #[test]
    fn test_is_boolean() {
        assert!(CellValue::Boolean(true).is_boolean());
        assert!(CellValue::Boolean(false).is_boolean());

        assert!(!CellValue::String("true".to_string()).is_boolean());
        assert!(!CellValue::Number(1.0).is_boolean());
        assert!(!CellValue::Number(0.0).is_boolean());
        assert!(!CellValue::Empty.is_boolean());
    }

    #[test]
    fn test_is_empty() {
        assert!(CellValue::Empty.is_empty());

        assert!(!CellValue::String("".to_string()).is_empty());
        assert!(!CellValue::Number(0.0).is_empty());
        assert!(!CellValue::Boolean(false).is_empty());
        assert!(!CellValue::Array(vec![]).is_empty());
    }

    #[test]
    fn test_is_error() {
        assert!(CellValue::Error("Division by zero".to_string()).is_error());
        assert!(CellValue::Error("".to_string()).is_error());

        assert!(!CellValue::String("error".to_string()).is_error());
        assert!(!CellValue::Number(0.0).is_error());
        assert!(!CellValue::Empty.is_error());
    }

    #[test]
    fn test_as_number() {
        assert_eq!(CellValue::Number(42.0).as_number(), Some(42.0));
        assert_eq!(CellValue::Number(0.0).as_number(), Some(0.0));
        assert_eq!(CellValue::Number(-123.45).as_number(), Some(-123.45));

        assert_eq!(CellValue::String("42".to_string()).as_number(), None);
        assert_eq!(CellValue::Boolean(true).as_number(), None);
        assert_eq!(CellValue::Empty.as_number(), None);
    }

    #[test]
    fn test_as_string() {
        assert_eq!(
            CellValue::String("hello".to_string()).as_string(),
            Some("hello")
        );
        assert_eq!(CellValue::String("".to_string()).as_string(), Some(""));

        assert_eq!(CellValue::Number(42.0).as_string(), None);
        assert_eq!(CellValue::Boolean(true).as_string(), None);
        assert_eq!(CellValue::Empty.as_string(), None);
    }

    #[test]
    fn test_as_boolean() {
        assert_eq!(CellValue::Boolean(true).as_boolean(), Some(true));
        assert_eq!(CellValue::Boolean(false).as_boolean(), Some(false));

        assert_eq!(CellValue::Number(1.0).as_boolean(), None);
        assert_eq!(CellValue::String("true".to_string()).as_boolean(), None);
        assert_eq!(CellValue::Empty.as_boolean(), None);
    }

    #[test]
    fn test_type_name() {
        assert_eq!(CellValue::Number(42.0).type_name(), "number");
        assert_eq!(CellValue::String("hello".to_string()).type_name(), "string");
        assert_eq!(CellValue::Boolean(true).type_name(), "boolean");
        assert_eq!(CellValue::Empty.type_name(), "empty");
        assert_eq!(CellValue::Error("error".to_string()).type_name(), "error");
        assert_eq!(CellValue::Array(vec![]).type_name(), "array");
    }

    #[test]
    fn test_to_display_string() {
        assert_eq!(CellValue::Number(42.0).to_display_string(), "42");
        assert_eq!(CellValue::Number(123.45).to_display_string(), "123.45");
        assert_eq!(
            CellValue::String("hello".to_string()).to_display_string(),
            "hello"
        );
        assert_eq!(CellValue::Boolean(true).to_display_string(), "TRUE");
        assert_eq!(CellValue::Boolean(false).to_display_string(), "FALSE");
        assert_eq!(CellValue::Empty.to_display_string(), "");
        assert_eq!(
            CellValue::Error("ERROR".to_string()).to_display_string(),
            "#ERROR"
        );

        let array = CellValue::Array(vec![CellValue::Number(1.0), CellValue::Number(2.0)]);
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
    fn test_equality() {
        assert_eq!(CellValue::Number(42.0), CellValue::Number(42.0));
        assert_ne!(CellValue::Number(42.0), CellValue::Number(43.0));

        assert_eq!(
            CellValue::String("hello".to_string()),
            CellValue::String("hello".to_string())
        );
        assert_ne!(
            CellValue::String("hello".to_string()),
            CellValue::String("world".to_string())
        );

        assert_eq!(CellValue::Boolean(true), CellValue::Boolean(true));
        assert_ne!(CellValue::Boolean(true), CellValue::Boolean(false));

        assert_eq!(CellValue::Empty, CellValue::Empty);

        assert_eq!(
            CellValue::Error("error".to_string()),
            CellValue::Error("error".to_string())
        );
        assert_ne!(
            CellValue::Error("error1".to_string()),
            CellValue::Error("error2".to_string())
        );
    }

    #[test]
    fn test_clone() {
        let original = CellValue::String("hello".to_string());
        let cloned = original.clone();
        assert_eq!(original, cloned);

        let original = CellValue::Array(vec![
            CellValue::Number(1.0),
            CellValue::String("test".to_string()),
        ]);
        let cloned = original.clone();
        assert_eq!(original, cloned);
    }

    #[test]
    fn test_display_trait() {
        assert_eq!(format!("{}", CellValue::Number(42.0)), "42");
        assert_eq!(
            format!("{}", CellValue::String("hello".to_string())),
            "hello"
        );
        assert_eq!(format!("{}", CellValue::Boolean(true)), "TRUE");
        assert_eq!(format!("{}", CellValue::Empty), "");
        assert_eq!(
            format!("{}", CellValue::Error("ERROR".to_string())),
            "#ERROR"
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
