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
    create_command_state, create_editing_state, create_navigation_state, create_visual_state,
    is_bulk_operation_mode, is_command_mode, is_editing_mode, is_navigation_mode, is_resize_mode,
    is_visual_mode, BulkOperationStatus, CoreState, DeleteConfig, DeleteType, EditMode,
    InsertConfig, InsertMode, InsertPosition, InsertType, ModalData, ModalKind, NavigationModal,
    ParsedBulkCommand, ResizeMoveDirection, ResizeSizes, ResizeTarget, Selection, SelectionType,
    SpreadsheetMode, UIState, ViewportInfo, VisualMode, VisualSelection,
};
