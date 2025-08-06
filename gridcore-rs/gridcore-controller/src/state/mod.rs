pub mod machine;
pub mod spreadsheet;
pub mod context;
pub mod transitions;

pub use machine::{UIStateMachine, Action};
pub use spreadsheet::{
    UIState, SpreadsheetMode, CellMode, VisualMode, SpreadsheetVisualMode,
    InsertMode, ViewportInfo, Selection, SelectionType,
    is_navigation_mode, is_editing_mode, is_command_mode, is_visual_mode,
    is_resize_mode, is_bulk_operation_mode,
};
pub use context::StateContext;