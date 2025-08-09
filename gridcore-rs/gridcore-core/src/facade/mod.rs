pub mod batch;
pub mod event;
pub mod spreadsheet_facade;

// Re-export main types
pub use batch::{BatchManager, BatchOperation};
pub use event::{EventCallback, EventType, SpreadsheetEvent};
pub use spreadsheet_facade::SpreadsheetFacade;
