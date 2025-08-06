pub mod error;
pub mod types;
pub mod formula;
pub mod domain;
pub mod repository;
pub mod dependency;

// Re-export commonly used types
pub use error::{Result, SpreadsheetError};
pub use formula::{Expr, BinaryOperator, UnaryOperator, FormulaParser, CellRange};
pub use domain::Cell;
pub use repository::CellRepository;
pub use dependency::{DependencyGraph, DependencyAnalyzer};

#[cfg(feature = "wasm")]
pub mod wasm {
    pub use crate::types::wasm::*;
    pub use crate::formula::wasm::*;
    pub use crate::domain::cell::wasm_bindings::*;
    pub use crate::repository::cell_repository::wasm_bindings::*;
}