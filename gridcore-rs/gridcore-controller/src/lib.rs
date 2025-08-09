pub mod behaviors;
pub mod controller;
pub mod managers;
pub mod state;
pub mod utils;

// Re-export key types
pub use controller::SpreadsheetController;
pub use managers::{CellContent, ClipboardContent, Direction, SelectionManager};
pub use state::{
    Action, CellMode, Selection, SelectionType, SpreadsheetMode, UIState, UIStateMachine,
    ViewportInfo,
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_module_imports() {
        // Basic smoke test to ensure modules compile
        let _ = state::UIStateMachine::new(None);
    }
}
