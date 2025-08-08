pub mod command;
pub mod dependency;
pub mod domain;
pub mod error;
pub mod evaluator;
pub mod facade;
pub mod fill;
pub mod formula;
pub mod references;
pub mod repository;
pub mod types;
pub mod workbook;

// Re-export commonly used types
pub use dependency::{DependencyAnalyzer, DependencyGraph};
pub use domain::Cell;
pub use error::{Result, SpreadsheetError};
pub use evaluator::{EvaluationContext, Evaluator};
pub use facade::{EventCallback, SpreadsheetEvent, SpreadsheetFacade};
pub use formula::{BinaryOperator, CellRange, Expr, FormulaParser, UnaryOperator};
pub use repository::CellRepository;

#[cfg(feature = "wasm")]
pub mod wasm {
    use wasm_bindgen::prelude::*;

    // Re-export all WASM bindings
    pub use crate::domain::cell::wasm_bindings::*;
    pub use crate::evaluator::wasm::*;
    pub use crate::facade::wasm::WasmSpreadsheetFacade;
    pub use crate::formula::wasm::*;
    pub use crate::repository::cell_repository::wasm_bindings::*;
    pub use crate::types::CellAddress;
    pub use crate::workbook::wasm::{WasmSheet, WasmSheetManager, WasmWorkbook};

    /// Initialize the WASM module
    #[wasm_bindgen(start)]
    pub fn init() {
        // Set panic hook for better error messages in browser
        #[cfg(feature = "console_error_panic_hook")]
        console_error_panic_hook::set_once();
    }

    /// Get the version of the library
    #[wasm_bindgen]
    pub fn version() -> String {
        env!("CARGO_PKG_VERSION").to_string()
    }
}
