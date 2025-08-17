pub mod behaviors;
pub mod controller;
pub mod managers;
pub mod state;

#[cfg(feature = "perf")]
pub mod perf;

// Re-export key types
pub use controller::SpreadsheetController;
pub use state::{
    Action, EditMode, Selection, SelectionType, SpreadsheetMode, UIState, ViewportInfo,
};

#[cfg(test)]
mod tests {
    #[test]
    fn test_module_imports() {
        // Basic smoke test to ensure modules compile
    }
}
