pub mod error;
pub mod types;
pub mod formula;

// Re-export commonly used types
pub use error::{Result, SpreadsheetError};
pub use formula::{Expr, BinaryOperator, UnaryOperator, FormulaParser, CellRange};

#[cfg(feature = "wasm")]
pub mod wasm {
    pub use crate::types::wasm::*;
    pub use crate::formula::wasm::*;
}