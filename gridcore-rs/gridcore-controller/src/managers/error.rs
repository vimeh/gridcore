use crate::controller::events::ErrorSeverity;
use chrono::{DateTime, Duration, Utc};
use gridcore_core::SpreadsheetError;
use std::collections::VecDeque;

/// An error message with metadata
#[derive(Debug, Clone)]
pub struct ErrorEntry {
    pub id: usize,
    pub message: String,
    pub severity: ErrorSeverity,
    pub timestamp: DateTime<Utc>,
    pub auto_dismiss_after: Option<Duration>,
}

/// Unified error management system combining error queue management and formatting
pub struct ErrorSystem {
    errors: VecDeque<ErrorEntry>,
    next_id: usize,
    max_errors: usize,
}

impl ErrorSystem {
    /// Create a new ErrorSystem with default capacity
    pub fn new() -> Self {
        Self {
            errors: VecDeque::new(),
            next_id: 0,
            max_errors: 100, // Keep max 100 errors in memory
        }
    }

    /// Create an ErrorSystem with specified max capacity
    pub fn with_capacity(max_errors: usize) -> Self {
        Self {
            errors: VecDeque::with_capacity(max_errors),
            next_id: 0,
            max_errors,
        }
    }

    /// Add a new error to the queue
    pub fn add_error(&mut self, message: String, severity: ErrorSeverity) -> usize {
        let auto_dismiss_after = match severity {
            ErrorSeverity::Info => Some(Duration::seconds(5)),
            ErrorSeverity::Warning => Some(Duration::seconds(10)),
            ErrorSeverity::Error => None, // Errors don't auto-dismiss
        };

        let error = ErrorEntry {
            id: self.next_id,
            message,
            severity,
            timestamp: Utc::now(),
            auto_dismiss_after,
        };

        let id = error.id;
        self.next_id += 1;

        // Remove oldest errors if we're at capacity
        while self.errors.len() >= self.max_errors {
            self.errors.pop_front();
        }

        self.errors.push_back(error);
        id
    }

    /// Remove an error by ID
    pub fn remove_error(&mut self, id: usize) -> bool {
        if let Some(pos) = self.errors.iter().position(|e| e.id == id) {
            self.errors.remove(pos);
            true
        } else {
            false
        }
    }

    /// Get all current errors
    pub fn get_errors(&self) -> Vec<ErrorEntry> {
        self.errors.iter().cloned().collect()
    }

    /// Get errors that should still be displayed (not auto-dismissed)
    pub fn get_active_errors(&self) -> Vec<ErrorEntry> {
        let now = Utc::now();
        self.errors
            .iter()
            .filter(|error| {
                if let Some(dismiss_after) = error.auto_dismiss_after {
                    now.signed_duration_since(error.timestamp) < dismiss_after
                } else {
                    true // No auto-dismiss, always active
                }
            })
            .cloned()
            .collect()
    }

    /// Clear all errors
    pub fn clear_all(&mut self) {
        self.errors.clear();
    }

    /// Clean up expired errors (should be called periodically)
    pub fn cleanup_expired(&mut self) {
        let now = Utc::now();
        self.errors.retain(|error| {
            if let Some(dismiss_after) = error.auto_dismiss_after {
                now.signed_duration_since(error.timestamp) < dismiss_after
            } else {
                true
            }
        });
    }

    /// Get the count of active errors
    pub fn error_count(&self) -> usize {
        self.get_active_errors().len()
    }

    /// Check if there are any errors
    pub fn has_errors(&self) -> bool {
        !self.get_active_errors().is_empty()
    }

    // Error formatting methods (previously in ErrorFormatter)

    /// Convert parse errors to Excel-style error codes with descriptions
    pub fn format_error(error: &SpreadsheetError) -> String {
        // Check for specific error types directly
        if let SpreadsheetError::RefError = error {
            return "Formula error: #REF! - Invalid reference".to_string();
        }

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

impl Default for ErrorSystem {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add_error() {
        let mut system = ErrorSystem::new();
        let id = system.add_error("Test error".to_string(), ErrorSeverity::Error);
        assert_eq!(id, 0);
        assert_eq!(system.error_count(), 1);
    }

    #[test]
    fn test_remove_error() {
        let mut system = ErrorSystem::new();
        let id = system.add_error("Test error".to_string(), ErrorSeverity::Error);
        assert!(system.remove_error(id));
        assert_eq!(system.error_count(), 0);
        assert!(!system.remove_error(id)); // Already removed
    }

    #[test]
    fn test_auto_dismiss_timing() {
        let mut system = ErrorSystem::new();

        // Add info message (5 second auto-dismiss)
        system.add_error("Info message".to_string(), ErrorSeverity::Info);
        assert_eq!(system.error_count(), 1);

        // Should still be there immediately
        assert_eq!(system.get_active_errors().len(), 1);
    }

    #[test]
    fn test_max_capacity() {
        let mut system = ErrorSystem::with_capacity(3);

        // Add 5 errors
        for i in 0..5 {
            system.add_error(format!("Error {}", i), ErrorSeverity::Error);
        }

        // Should only have 3 errors (oldest removed)
        assert_eq!(system.error_count(), 3);

        // Check that the oldest were removed
        let errors = system.get_errors();
        assert_eq!(errors[0].message, "Error 2");
        assert_eq!(errors[1].message, "Error 3");
        assert_eq!(errors[2].message, "Error 4");
    }

    #[test]
    fn test_clear_all() {
        let mut system = ErrorSystem::new();

        system.add_error("Error 1".to_string(), ErrorSeverity::Error);
        system.add_error("Error 2".to_string(), ErrorSeverity::Warning);
        system.add_error("Error 3".to_string(), ErrorSeverity::Info);

        assert_eq!(system.error_count(), 3);

        system.clear_all();
        assert_eq!(system.error_count(), 0);
        assert!(!system.has_errors());
    }

    #[test]
    fn test_severity_auto_dismiss() {
        let mut system = ErrorSystem::new();

        // Add different severity errors
        system.add_error("Info".to_string(), ErrorSeverity::Info);
        system.add_error("Warning".to_string(), ErrorSeverity::Warning);
        system.add_error("Error".to_string(), ErrorSeverity::Error);

        // Check auto-dismiss durations are set correctly
        let errors = system.get_errors();
        assert_eq!(errors[0].auto_dismiss_after, Some(Duration::seconds(5))); // Info
        assert_eq!(errors[1].auto_dismiss_after, Some(Duration::seconds(10))); // Warning
        assert_eq!(errors[2].auto_dismiss_after, None); // Error (no auto-dismiss)
    }

    #[test]
    fn test_cleanup_expired() {
        let mut system = ErrorSystem::new();

        // Add an info message with very short dismiss time for testing
        let error = ErrorEntry {
            id: 0,
            message: "Test".to_string(),
            severity: ErrorSeverity::Info,
            timestamp: Utc::now() - Duration::seconds(10), // Old timestamp
            auto_dismiss_after: Some(Duration::seconds(5)),
        };

        // Manually add expired error
        system.errors.push_back(error);

        // Add a fresh error
        system.add_error("Fresh error".to_string(), ErrorSeverity::Error);

        assert_eq!(system.errors.len(), 2);

        // Cleanup should remove the expired one
        system.cleanup_expired();
        assert_eq!(system.errors.len(), 1);
        assert_eq!(system.get_errors()[0].message, "Fresh error");
    }

    // Error formatting tests

    #[test]
    fn test_format_ref_error() {
        let error = "#REF!";
        let result = ErrorSystem::format_parse_error(error, true);
        assert_eq!(result, "#REF! - Invalid reference");
    }

    #[test]
    fn test_format_name_error() {
        let error = "Unknown function FOO";
        let result = ErrorSystem::format_parse_error(error, true);
        assert_eq!(result, "#NAME? - Unknown function or name");
    }

    #[test]
    fn test_format_value_error() {
        let error = "Type mismatch";
        let result = ErrorSystem::format_parse_error(error, true);
        assert_eq!(result, "#VALUE! - Type mismatch or invalid value");
    }

    #[test]
    fn test_format_div_zero_error() {
        let error = "Division by zero";
        let result = ErrorSystem::format_parse_error(error, true);
        assert_eq!(result, "#DIV/0! - Division by zero");
    }

    #[test]
    fn test_format_circular_error() {
        let error = "Circular reference detected";
        let result = ErrorSystem::format_parse_error(error, true);
        assert_eq!(result, "#CIRC! - Circular reference detected");
    }

    #[test]
    fn test_format_generic_formula_error() {
        let error = "Some other error";
        let result = ErrorSystem::format_parse_error(error, true);
        assert_eq!(result, "Formula error: Some other error");
    }

    #[test]
    fn test_format_generic_non_formula_error() {
        let error = "Some other error";
        let result = ErrorSystem::format_parse_error(error, false);
        assert_eq!(result, "Error: Some other error");
    }
}
