pub mod machine;
pub mod spreadsheet;
pub mod context;
pub mod transitions;

#[cfg(test)]
mod tests;

pub use machine::{UIStateMachine, Action};
pub use spreadsheet::{
    UIState, SpreadsheetMode, CellMode, VisualMode, SpreadsheetVisualMode,
    InsertMode, ViewportInfo, Selection, SelectionType, ParsedBulkCommand,
    ResizeTarget, InsertType, InsertPosition, DeleteType,
    is_navigation_mode, is_editing_mode, is_command_mode, is_visual_mode,
    is_resize_mode, is_bulk_operation_mode,
    create_navigation_state, create_editing_state, create_command_state, create_visual_state,
};
pub use context::StateContext;