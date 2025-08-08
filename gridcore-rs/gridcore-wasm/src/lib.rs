// Re-export all WASM types from gridcore-core
pub use gridcore_core::domain::cell::wasm_bindings::WasmCell;
pub use gridcore_core::evaluator::wasm::WasmEvaluator;
pub use gridcore_core::facade::wasm::WasmSpreadsheetFacade;
pub use gridcore_core::formula::wasm::{
    get_formula_error, parse_formula, parse_formula_to_json, validate_formula,
};
pub use gridcore_core::types::CellAddress; // Use CellAddress directly now
pub use gridcore_core::workbook::wasm::{WasmSheet, WasmSheetManager, WasmWorkbook};

// Re-export the new function-based API
pub use gridcore_core::wasm_api::*;

// Note: Controller types are not re-exported here
// Use gridcore-controller package directly for controller functionality

// Note: wee_alloc feature has been removed
// The default allocator is used for better performance and compatibility

// Note: This package is maintained for backward compatibility
// All functionality has been moved to gridcore-core
// The init() and version() functions are now provided by gridcore-core
