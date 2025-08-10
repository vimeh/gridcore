//! Error recovery mechanisms for graceful error handling
//!
//! This module provides utilities for recovering from errors gracefully
//! instead of panicking or propagating errors that could crash the application.

use super::{Result, SpreadsheetError};
use crate::types::CellValue;

/// Trait for types that can recover from errors
pub trait ErrorRecovery {
    /// The type to return when recovery succeeds
    type RecoveryValue;

    /// Attempt to recover from an error with a default value
    fn recover_with_default(self) -> Self::RecoveryValue;

    /// Attempt to recover from an error with a custom fallback
    fn recover_with<F>(self, fallback: F) -> Self::RecoveryValue
    where
        F: FnOnce() -> Self::RecoveryValue;
}

/// Extension trait for Result types to add recovery methods
impl<T> ErrorRecovery for Result<T>
where
    T: Default,
{
    type RecoveryValue = T;

    fn recover_with_default(self) -> Self::RecoveryValue {
        self.unwrap_or_default()
    }

    fn recover_with<F>(self, fallback: F) -> Self::RecoveryValue
    where
        F: FnOnce() -> Self::RecoveryValue,
    {
        self.unwrap_or_else(|_| fallback())
    }
}

/// Extension trait for Option types to add safe unwrapping
pub trait SafeUnwrap<T> {
    /// Unwrap with a context message for debugging
    fn unwrap_or_log(self, context: &str) -> Option<T>;

    /// Unwrap with a default value and log the issue
    fn unwrap_or_default_with_log(self, context: &str) -> T
    where
        T: Default;
}

impl<T> SafeUnwrap<T> for Option<T> {
    fn unwrap_or_log(self, context: &str) -> Option<T> {
        if self.is_none() {
            // TODO: Add logging when log crate is available
            eprintln!("SafeUnwrap: None value encountered in context: {}", context);
        }
        self
    }

    fn unwrap_or_default_with_log(self, context: &str) -> T
    where
        T: Default,
    {
        self.unwrap_or_else(|| {
            // TODO: Add logging when log crate is available
            eprintln!("SafeUnwrap: Using default value in context: {}", context);
            T::default()
        })
    }
}

/// Helper to convert any error into a cell error value
pub fn to_cell_error<E: std::fmt::Display>(error: E) -> CellValue {
    let spreadsheet_error = SpreadsheetError::Parse(error.to_string());
    CellValue::Error(spreadsheet_error.to_error_type())
}

/// Macro to safely unwrap with context
#[macro_export]
macro_rules! safe_unwrap {
    ($expr:expr, $context:expr) => {
        match $expr {
            Some(val) => val,
            None => {
                eprintln!("Unwrap failed at {}:{} - {}", file!(), line!(), $context);
                return Err($crate::error::SpreadsheetError::Parse(format!(
                    "Unexpected None value: {}",
                    $context
                )));
            }
        }
    };
    ($expr:expr, $context:expr, $default:expr) => {
        match $expr {
            Some(val) => val,
            None => {
                eprintln!(
                    "Using default value at {}:{} - {}",
                    file!(),
                    line!(),
                    $context
                );
                $default
            }
        }
    };
}

/// Macro to replace panic! with error return
#[macro_export]
macro_rules! error_instead_of_panic {
    ($msg:expr) => {
        return Err($crate::error::SpreadsheetError::Parse(
            format!("Error at {}:{} - {}", file!(), line!(), $msg)
        ))
    };
    ($fmt:expr, $($arg:tt)*) => {
        return Err($crate::error::SpreadsheetError::Parse(
            format!("Error at {}:{} - {}", file!(), line!(), format!($fmt, $($arg)*))
        ))
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_recovery_with_default() {
        let result: Result<String> = Err(SpreadsheetError::Parse("test".to_string()));
        let recovered = result.recover_with_default();
        assert_eq!(recovered, String::default());
    }

    #[test]
    fn test_error_recovery_with_fallback() {
        let result: Result<i32> = Err(SpreadsheetError::Parse("test".to_string()));
        let recovered = result.recover_with(|| 42);
        assert_eq!(recovered, 42);
    }

    #[test]
    fn test_safe_unwrap_macro() {
        fn test_function() -> Result<i32> {
            let value = Some(42);
            let result = safe_unwrap!(value, "test context", 0);
            Ok(result)
        }

        assert_eq!(test_function().unwrap(), 42);
    }
}
