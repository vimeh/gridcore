use crate::state::{
    DeleteType, InsertMode, InsertPosition, InsertType, ParsedBulkCommand, ResizeMoveDirection,
    ResizeTarget, Selection, ViewportInfo, VisualMode,
};
use gridcore_core::types::CellAddress;
use serde::{Deserialize, Serialize};

// Slimmed down Action enum - removed redundant actions that can be handled directly
// Keep only actions that:
// - Trigger complex operations (undo, redo, bulk operations)
// - Need validation
// - Affect multiple systems
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Action {
    // Complex editing operations
    StartEditing {
        edit_mode: Option<InsertMode>,
        initial_value: Option<String>,
        cursor_position: Option<usize>,
    },
    SubmitCellEdit {
        value: String,
    },
    UpdateEditingValue {
        value: String,
        cursor_position: usize,
    },
    InsertCharacterAtCursor {
        character: char,
    },
    DeleteCharacterAtCursor {
        forward: bool, // true for delete, false for backspace
    },
    HandleEditingKey {
        key: String,
        shift: bool,
        ctrl: bool,
        alt: bool,
        selection_start: Option<usize>,
        selection_end: Option<usize>,
    },

    // Command mode operations
    UpdateCommandValue {
        value: String,
    },

    // Formula bar operations
    UpdateFormulaBar {
        value: String,
    },
    SubmitFormulaBar,

    // Sheet operations
    AddSheet {
        name: String,
    },
    RemoveSheet {
        name: String,
    },
    RenameSheet {
        old_name: String,
        new_name: String,
    },
    SetActiveSheet {
        name: String,
    },

    // Structural operations
    StartInsert {
        insert_type: InsertType,
        position: InsertPosition,
        reference: u32,
    },
    ConfirmInsert,
    CancelInsert,

    StartDelete {
        targets: Vec<u32>,
        delete_type: DeleteType,
    },
    ConfirmDelete,
    CancelDelete,

    StartResize {
        target: ResizeTarget,
        initial_position: f64,
    },
    UpdateResize {
        delta: f64,
    },
    MoveResizeTarget {
        direction: ResizeMoveDirection,
    },
    AutoFitResize,
    ConfirmResize,
    CancelResize,

    // Bulk operations
    StartBulkOperation {
        parsed_command: ParsedBulkCommand,
        affected_cells: Option<u32>,
    },
    ShowBulkPreview,
    GeneratePreview,
    ExecuteBulkOperation,
    CancelBulkOperation,
    CompleteBulkOperation,
    BulkOperationError {
        error: String,
    },
    BulkCommand {
        command: ParsedBulkCommand,
    },

    // Undo/Redo
    Undo,
    UndoLine,
    Redo,

    // General
    Escape,
    ExitToNavigation,

    // TEMPORARY: Keep these for VIM compatibility until fully refactored
    UpdateCursor {
        cursor: CellAddress,
    },
    UpdateSelection {
        selection: Selection,
    },
    UpdateViewport {
        viewport: ViewportInfo,
    },
    EnterInsertMode {
        mode: Option<InsertMode>,
    },
    ExitInsertMode,
    EnterVisualMode {
        visual_type: VisualMode,
        anchor: Option<usize>,
    },
    ExitVisualMode,
    EnterSpreadsheetVisualMode {
        visual_mode: VisualMode,
        selection: Selection,
    },
    ExitSpreadsheetVisualMode,
    EnterCommandMode,
    ExitCommandMode,
    ChangeVisualMode {
        new_mode: VisualMode,
    },
}
