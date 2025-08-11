use gridcore_core::SpreadsheetError;

/// Manages error formatting and conversion to user-friendly messages
pub struct ErrorFormatter;

impl ErrorFormatter {
    /// Convert parse errors to Excel-style error codes with descriptions
    pub fn format_error(error: &SpreadsheetError) -> String {
        let error_str = error.to_string();

        // Check for specific error patterns and convert to Excel codes
        if error_str.contains("#REF!")
            || error_str.contains("expected")
            || error_str.contains("found end of input")
        {
            "Formula error: #REF! - Invalid reference".to_string()
        } else if error_str.contains("Unknown function") || error_str.contains("UNKNOWNFUNC") {
            "Formula error: #NAME? - Unknown function or name".to_string()
        } else if error_str.contains("Type mismatch")
            || error_str.contains("cannot add")
            || error_str.contains("cannot subtract")
        {
            "Formula error: #VALUE! - Type mismatch or invalid value".to_string()
        } else if error_str.contains("Circular") || error_str.contains("circular") {
            "Formula error: #CIRC! - Circular reference detected".to_string()
        } else if error_str.contains("Division by zero") || error_str.contains("divide by zero") {
            "Formula error: #DIV/0! - Division by zero".to_string()
        } else {
            format!("Failed to set cell value: {}", error)
        }
    }

    /// Format a parse error based on whether it's a formula
    pub fn format_parse_error(error: &str, is_formula: bool) -> String {
        // Check for specific error patterns and convert to Excel codes
        if error.contains("#REF!") {
            "#REF! - Invalid reference".to_string()
        } else if error.contains("Unknown function") || error.contains("UNKNOWNFUNC") {
            "#NAME? - Unknown function or name".to_string()
        } else if error.contains("Type mismatch")
            || error.contains("cannot add")
            || error.contains("cannot subtract")
        {
            "#VALUE! - Type mismatch or invalid value".to_string()
        } else if error.contains("Circular") || error.contains("circular") {
            "#CIRC! - Circular reference detected".to_string()
        } else if error.contains("Division by zero") || error.contains("divide by zero") {
            "#DIV/0! - Division by zero".to_string()
        } else if error.contains("expected") || error.contains("found end of input") {
            // Parse errors often mean invalid references
            "#REF! - Invalid reference".to_string()
        } else if is_formula {
            format!("Formula error: {}", error)
        } else {
            format!("Error: {}", error)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_ref_error() {
        let error = "#REF!";
        let result = ErrorFormatter::format_parse_error(error, true);
        assert_eq!(result, "#REF! - Invalid reference");
    }

    #[test]
    fn test_format_name_error() {
        let error = "Unknown function FOO";
        let result = ErrorFormatter::format_parse_error(error, true);
        assert_eq!(result, "#NAME? - Unknown function or name");
    }

    #[test]
    fn test_format_value_error() {
        let error = "Type mismatch";
        let result = ErrorFormatter::format_parse_error(error, true);
        assert_eq!(result, "#VALUE! - Type mismatch or invalid value");
    }

    #[test]
    fn test_format_div_zero_error() {
        let error = "Division by zero";
        let result = ErrorFormatter::format_parse_error(error, true);
        assert_eq!(result, "#DIV/0! - Division by zero");
    }

    #[test]
    fn test_format_circular_error() {
        let error = "Circular reference detected";
        let result = ErrorFormatter::format_parse_error(error, true);
        assert_eq!(result, "#CIRC! - Circular reference detected");
    }

    #[test]
    fn test_format_generic_formula_error() {
        let error = "Some other error";
        let result = ErrorFormatter::format_parse_error(error, true);
        assert_eq!(result, "Formula error: Some other error");
    }

    #[test]
    fn test_format_generic_non_formula_error() {
        let error = "Some other error";
        let result = ErrorFormatter::format_parse_error(error, false);
        assert_eq!(result, "Error: Some other error");
    }
}
