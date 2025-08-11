use crate::controller::events::ErrorSeverity;
use chrono::{DateTime, Duration, Utc};
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

/// Manages application errors with queue and auto-dismiss functionality
pub struct ErrorManager {
    errors: VecDeque<ErrorEntry>,
    next_id: usize,
    max_errors: usize,
}

impl ErrorManager {
    /// Create a new ErrorManager with default capacity
    pub fn new() -> Self {
        Self {
            errors: VecDeque::new(),
            next_id: 0,
            max_errors: 100, // Keep max 100 errors in memory
        }
    }

    /// Create an ErrorManager with specified max capacity
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
}

impl Default for ErrorManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add_error() {
        let mut manager = ErrorManager::new();
        let id = manager.add_error("Test error".to_string(), ErrorSeverity::Error);
        assert_eq!(id, 0);
        assert_eq!(manager.error_count(), 1);
    }

    #[test]
    fn test_remove_error() {
        let mut manager = ErrorManager::new();
        let id = manager.add_error("Test error".to_string(), ErrorSeverity::Error);
        assert!(manager.remove_error(id));
        assert_eq!(manager.error_count(), 0);
        assert!(!manager.remove_error(id)); // Already removed
    }

    #[test]
    fn test_auto_dismiss_timing() {
        let mut manager = ErrorManager::new();

        // Add info message (5 second auto-dismiss)
        manager.add_error("Info message".to_string(), ErrorSeverity::Info);
        assert_eq!(manager.error_count(), 1);

        // Should still be there immediately
        assert_eq!(manager.get_active_errors().len(), 1);
    }

    #[test]
    fn test_max_capacity() {
        let mut manager = ErrorManager::with_capacity(3);

        // Add 5 errors
        for i in 0..5 {
            manager.add_error(format!("Error {}", i), ErrorSeverity::Error);
        }

        // Should only have 3 errors (oldest removed)
        assert_eq!(manager.error_count(), 3);

        // Check that the oldest were removed
        let errors = manager.get_errors();
        assert_eq!(errors[0].message, "Error 2");
        assert_eq!(errors[1].message, "Error 3");
        assert_eq!(errors[2].message, "Error 4");
    }

    #[test]
    fn test_clear_all() {
        let mut manager = ErrorManager::new();

        manager.add_error("Error 1".to_string(), ErrorSeverity::Error);
        manager.add_error("Error 2".to_string(), ErrorSeverity::Warning);
        manager.add_error("Error 3".to_string(), ErrorSeverity::Info);

        assert_eq!(manager.error_count(), 3);

        manager.clear_all();
        assert_eq!(manager.error_count(), 0);
        assert!(!manager.has_errors());
    }

    #[test]
    fn test_severity_auto_dismiss() {
        let mut manager = ErrorManager::new();

        // Add different severity errors
        manager.add_error("Info".to_string(), ErrorSeverity::Info);
        manager.add_error("Warning".to_string(), ErrorSeverity::Warning);
        manager.add_error("Error".to_string(), ErrorSeverity::Error);

        // Check auto-dismiss durations are set correctly
        let errors = manager.get_errors();
        assert_eq!(errors[0].auto_dismiss_after, Some(Duration::seconds(5))); // Info
        assert_eq!(errors[1].auto_dismiss_after, Some(Duration::seconds(10))); // Warning
        assert_eq!(errors[2].auto_dismiss_after, None); // Error (no auto-dismiss)
    }

    #[test]
    fn test_cleanup_expired() {
        let mut manager = ErrorManager::new();

        // Add an info message with very short dismiss time for testing
        let error = ErrorEntry {
            id: 0,
            message: "Test".to_string(),
            severity: ErrorSeverity::Info,
            timestamp: Utc::now() - Duration::seconds(10), // Old timestamp
            auto_dismiss_after: Some(Duration::seconds(5)),
        };

        // Manually add expired error
        manager.errors.push_back(error);

        // Add a fresh error
        manager.add_error("Fresh error".to_string(), ErrorSeverity::Error);

        assert_eq!(manager.errors.len(), 2);

        // Cleanup should remove the expired one
        manager.cleanup_expired();
        assert_eq!(manager.errors.len(), 1);
        assert_eq!(manager.get_errors()[0].message, "Fresh error");
    }
}
