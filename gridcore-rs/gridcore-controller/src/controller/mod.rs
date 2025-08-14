pub mod events;
#[cfg(test)]
mod events_test;
pub mod operations;
pub mod spreadsheet;
#[cfg(test)]
mod spreadsheet_test;
pub mod viewport;

// New modular organization
pub mod event_handling;
pub mod managers;
pub mod sheet_management;

#[cfg(test)]
mod tests;

pub use event_handling::EventHandling;
pub use events::{EventDispatcher, KeyboardEvent, MouseEvent, SpreadsheetEvent};
pub use managers::ManagerAccess;
pub use operations::{CellOperations, ErrorOperations, SelectionOperations, SheetOperations};
pub use sheet_management::SheetManagement;
pub use spreadsheet::SpreadsheetController;
pub use viewport::{
    CellPosition, DefaultViewportManager, GridConfiguration, ScrollPosition, ViewportBounds,
    ViewportManager,
};
