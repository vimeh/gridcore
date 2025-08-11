//! Test utility functions for reducing unwrap usage and providing better error messages

#![cfg(test)]

use crate::Result;
use std::fmt::Debug;

/// Helper for expecting successful results in tests with descriptive messages
pub fn expect_ok<T, E: Debug>(result: Result<T, E>, context: &str) -> T {
    result.unwrap_or_else(|e| {
        panic!("Test expectation failed: {} - Error: {:?}", context, e)
    })
}

/// Helper for parsing operations in tests
pub fn expect_parse<T, E: Debug>(result: Result<T, E>, input: &str) -> T {
    result.unwrap_or_else(|e| {
        panic!("Failed to parse '{}' - Error: {:?}", input, e)
    })
}

/// Helper for mutex lock operations in tests
pub fn expect_lock<T>(
    lock_result: Result<std::sync::MutexGuard<T>, std::sync::PoisonError<std::sync::MutexGuard<T>>>,
    context: &str,
) -> std::sync::MutexGuard<T> {
    lock_result.unwrap_or_else(|_| {
        panic!("Test mutex poisoned: {} - Previous test likely panicked", context)
    })
}

/// Helper for cell address creation in tests
pub fn expect_cell_address(a1_notation: &str) -> crate::types::CellAddress {
    crate::types::CellAddress::from_a1(a1_notation)
        .unwrap_or_else(|_| {
            panic!("'{}' should be a valid cell address in A1 notation", a1_notation)
        })
}

/// Helper for formula parsing in tests
pub fn expect_formula(formula_str: &str) -> crate::formula::Expr {
    crate::formula::FormulaParser::parse(formula_str)
        .unwrap_or_else(|e| {
            panic!("Failed to parse formula '{}' - Error: {:?}", formula_str, e)
        })
}

/// Macro for creating expect messages with context
#[macro_export]
macro_rules! test_expect {
    ($result:expr, $msg:literal) => {
        $result.expect(concat!("Test failed: ", $msg))
    };
    ($result:expr, $msg:literal, $($arg:tt)*) => {
        $result.expect(&format!(concat!("Test failed: ", $msg), $($arg)*))
    };
}

/// Macro for vim key processing in tests
#[macro_export]
macro_rules! expect_key {
    ($vim:expr, $key:expr) => {
        $vim.process_key($key)
            .expect(&format!("Failed to process key '{}' in vim mode", $key))
    };
}