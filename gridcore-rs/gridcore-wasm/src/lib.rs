use wasm_bindgen::prelude::*;

// Re-export all WASM types from gridcore-core
pub use gridcore_core::domain::cell::wasm_bindings::WasmCell;
pub use gridcore_core::evaluator::wasm::WasmEvaluator;
pub use gridcore_core::facade::wasm::WasmSpreadsheetFacade;
pub use gridcore_core::formula::wasm::WasmFormulaParser;
pub use gridcore_core::types::CellAddress; // Use CellAddress directly now
pub use gridcore_core::workbook::wasm::{WasmSheet, WasmSheetManager, WasmWorkbook};

// Re-export controller types if available
#[cfg(feature = "controller")]
pub use gridcore_controller::wasm::{WasmSpreadsheetController, WasmUIState};

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen(start)]
pub fn init() {
    // Set panic hook for better error messages in browser
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
