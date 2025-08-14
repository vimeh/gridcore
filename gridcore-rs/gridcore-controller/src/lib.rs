pub mod behaviors;
pub mod controller;
pub mod managers;
pub mod state;

// Re-export key types
pub use controller::SpreadsheetController;
pub use state::{
    Action, EditMode, Selection, SelectionType, SpreadsheetMode, UIState, UIStateMachine,
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
