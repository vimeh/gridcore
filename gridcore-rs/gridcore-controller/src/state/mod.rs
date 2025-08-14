pub mod actions;
pub mod context;
pub mod diff;
pub mod machine;
pub mod spreadsheet;
pub mod transition_handlers;
pub mod transitions;

#[cfg(test)]
mod complex_transition_tests;
#[cfg(test)]
mod edge_case_tests;
#[cfg(test)]
mod performance_tests;
#[cfg(test)]
mod tests;

pub use actions::Action;
pub use context::StateContext;
pub use machine::UIStateMachine;
pub use spreadsheet::{
    BulkOperationStatus, CoreState, DeleteConfig, DeleteType, EditMode, InsertConfig, InsertMode,
    InsertPosition, InsertType, ModalData, ModalKind, NavigationModal, ParsedBulkCommand,
    ResizeMoveDirection, ResizeSizes, ResizeTarget, Selection, SelectionType, SpreadsheetMode,
    UIState, ViewportInfo, VisualMode, VisualSelection,
};
