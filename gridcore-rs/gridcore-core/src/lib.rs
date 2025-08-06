pub mod error;
pub mod types;

// Re-export commonly used types
pub use error::{Result, SpreadsheetError};

#[cfg(feature = "wasm")]
pub mod wasm {
    pub use crate::types::wasm::*;
}