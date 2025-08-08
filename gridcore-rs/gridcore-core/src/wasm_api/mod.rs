/// Function-based WASM API for gridcore-core
/// 
/// This module provides a function-based API as an alternative to class-based wrappers.
/// It uses ID-based instance management to avoid the limitations of wasm-bindgen with
/// complex Rust types like Rc<RefCell<>> and trait objects.

pub mod facade;
pub mod workbook;
pub mod evaluator;

// Re-export all functions for easier access
pub use facade::*;
pub use workbook::*;
pub use evaluator::*;