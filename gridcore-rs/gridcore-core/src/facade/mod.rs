pub mod batch;
pub mod event;
pub mod spreadsheet_facade;

#[cfg(feature = "wasm")]
pub mod wasm;

// Re-export main types
pub use batch::{BatchManager, BatchOperation};
pub use event::{EventCallback, EventType, SpreadsheetEvent};
pub use spreadsheet_facade::SpreadsheetFacade;

#[cfg(feature = "wasm")]
pub use wasm::WasmSpreadsheetFacade;
