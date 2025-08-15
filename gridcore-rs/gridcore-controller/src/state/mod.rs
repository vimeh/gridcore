pub mod actions;
pub mod context;
pub mod diff;
pub mod spreadsheet;

#[cfg(test)]
mod refactoring_tests;

// Keep only essential types - no more UIStateMachine
pub use actions::Action;
pub use context::StateContext;
pub use spreadsheet::{
    BulkOperationStatus, CoreState, DeleteConfig, DeleteType, EditMode, InsertConfig, InsertMode,
    InsertPosition, InsertType, ModalData, ModalKind, NavigationModal, ParsedBulkCommand,
    ResizeMoveDirection, ResizeSizes, ResizeTarget, Selection, SelectionType, SpreadsheetMode,
    UIState, ViewportInfo, VisualMode, VisualSelection,
};
