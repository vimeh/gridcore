pub mod state;
pub mod controller;
pub mod behaviors;
pub mod managers;

#[cfg(feature = "wasm")]
pub mod wasm;

// Re-export key types
pub use state::{
    UIState, UIStateMachine, SpreadsheetMode, CellMode, Action,
    ViewportInfo, Selection, SelectionType,
};
pub use controller::SpreadsheetController;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_module_imports() {
        // Basic smoke test to ensure modules compile
        let _ = state::UIStateMachine::new(None);
    }
}