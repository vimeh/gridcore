use crate::state::{
    DeleteType, InsertMode, InsertPosition, InsertType, ParsedBulkCommand, ResizeMoveDirection,
    ResizeTarget, Selection, SpreadsheetVisualMode, ViewportInfo, VisualMode,
};
use gridcore_core::types::CellAddress;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Action {
    StartEditing {
        edit_mode: Option<InsertMode>,
        initial_value: Option<String>,
        cursor_position: Option<usize>,
    },
    ExitToNavigation,
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
        visual_mode: SpreadsheetVisualMode,
        selection: Selection,
    },
    ExitSpreadsheetVisualMode,
    UpdateSelection {
        selection: Selection,
    },
    EnterCommandMode,
    ExitCommandMode,
    EnterResizeMode {
        target: ResizeTarget,
        index: u32,
        size: u32,
    },
    ExitResizeMode,
    EnterStructuralInsertMode {
        insert_type: InsertType,
        insert_position: InsertPosition,
    },
    StartInsert {
        insert_type: InsertType,
        position: InsertPosition,
        reference: u32,
    },
    ExitStructuralInsertMode,
    UpdateInsertCount {
        count: u32,
    },
    ConfirmInsert,
    CancelInsert,
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
    EnterDeleteMode {
        delete_type: DeleteType,
        selection: Vec<u32>,
    },
    ExitDeleteMode,
    ConfirmDelete,
    CancelDelete,
    StartDelete {
        targets: Vec<u32>,
        delete_type: DeleteType,
    },
    ChangeVisualMode {
        new_mode: SpreadsheetVisualMode,
    },
    UpdateEditingValue {
        value: String,
        cursor_position: usize,
    },
    UpdateEditingCursor {
        cursor_position: usize,
    },
    InsertCharacterAtCursor {
        character: char,
    },
    DeleteCharacterAtCursor {
        forward: bool, // true for delete, false for backspace
    },
    SubmitCellEdit {
        value: String,
    },
    UpdateCommandValue {
        value: String,
    },
    UpdateFormulaBar {
        value: String,
    },
    SubmitFormulaBar,
    UpdateResizeSize {
        size: u32,
    },
    UpdateCursor {
        cursor: CellAddress,
    },
    UpdateViewport {
        viewport: ViewportInfo,
    },
    Escape,
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
    Undo,
    UndoLine,
    Redo,
}
