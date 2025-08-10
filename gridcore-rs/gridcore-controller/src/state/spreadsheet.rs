use gridcore_core::types::CellAddress;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct ViewportInfo {
    pub start_row: u32,
    pub start_col: u32,
    pub rows: u32,
    pub cols: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CellMode {
    Normal,
    Insert,
    Visual,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum VisualMode {
    Character,
    Line,
    Block,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SpreadsheetVisualMode {
    Char,
    Line,
    Block,
    Column,
    Row,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum InsertMode {
    #[serde(rename = "i")]
    I, // insert before cursor
    #[serde(rename = "a")]
    A, // append after cursor
    #[serde(rename = "A")]
    CapitalA, // append at end of line
    #[serde(rename = "I")]
    CapitalI, // insert at beginning of line
    #[serde(rename = "o")]
    O, // open line below
    #[serde(rename = "O")]
    CapitalO, // open line above
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum SelectionType {
    #[serde(rename = "cell")]
    Cell { address: CellAddress },
    #[serde(rename = "range")]
    Range {
        start: CellAddress,
        end: CellAddress,
    },
    #[serde(rename = "column")]
    Column { columns: Vec<u32> },
    #[serde(rename = "row")]
    Row { rows: Vec<u32> },
    #[serde(rename = "multi")]
    Multi { selections: Vec<Selection> },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Selection {
    #[serde(rename = "type")]
    pub selection_type: SelectionType,
    pub anchor: Option<CellAddress>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SpreadsheetMode {
    Navigation,
    Visual,
    Editing,
    Command,
    Resize,
    Insert,
    Delete,
    BulkOperation,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum BulkOperationStatus {
    Preparing,
    Previewing,
    Executing,
    Completed,
    Error,
}

// ParsedBulkCommand represents different types of bulk operations
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ParsedBulkCommand {
    FindReplace {
        pattern: String,
        replacement: String,
        global: bool,
        case_sensitive: bool,
    },
    SetValue {
        value: String,
    },
    MathOperation {
        operation: String,
        value: f64,
    },
    Fill {
        direction: String,
    },
    Transform {
        transformation: String,
    },
    Format {
        format_type: String,
    },
    Clear {
        clear_type: String,
    },
    Sort {
        direction: String,
        column: Option<u32>,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "spreadsheetMode", rename_all = "camelCase")]
pub enum UIState {
    #[serde(rename = "navigation")]
    Navigation {
        cursor: CellAddress,
        viewport: ViewportInfo,
        selection: Option<Selection>,
    },
    #[serde(rename = "visual")]
    Visual {
        cursor: CellAddress,
        viewport: ViewportInfo,
        selection: Selection,
        #[serde(rename = "visualMode")]
        visual_mode: SpreadsheetVisualMode,
        anchor: CellAddress,
    },
    #[serde(rename = "editing")]
    Editing {
        cursor: CellAddress,
        viewport: ViewportInfo,
        #[serde(rename = "cellMode")]
        cell_mode: CellMode,
        #[serde(rename = "editingValue")]
        editing_value: String,
        #[serde(rename = "cursorPosition")]
        cursor_position: usize,
        #[serde(rename = "visualStart")]
        visual_start: Option<usize>,
        #[serde(rename = "visualType")]
        visual_type: Option<VisualMode>,
        #[serde(rename = "editVariant")]
        edit_variant: Option<InsertMode>,
    },
    #[serde(rename = "command")]
    Command {
        cursor: CellAddress,
        viewport: ViewportInfo,
        #[serde(rename = "commandValue")]
        command_value: String,
    },
    #[serde(rename = "resize")]
    Resize {
        cursor: CellAddress,
        viewport: ViewportInfo,
        target: ResizeTarget,
        #[serde(rename = "resizeTarget")]
        resize_target: ResizeTarget,
        #[serde(rename = "resizeIndex")]
        resize_index: u32,
        #[serde(rename = "originalSize")]
        original_size: u32,
        #[serde(rename = "currentSize")]
        current_size: u32,
        #[serde(rename = "initialPosition")]
        initial_position: f64,
        #[serde(rename = "currentPosition")]
        current_position: f64,
    },
    #[serde(rename = "insert")]
    Insert {
        cursor: CellAddress,
        viewport: ViewportInfo,
        #[serde(rename = "insertType")]
        insert_type: InsertType,
        position: InsertPosition,
        #[serde(rename = "insertPosition")]
        insert_position: InsertPosition,
        reference: u32,
        count: u32,
        target_index: u32,
    },
    #[serde(rename = "delete")]
    Delete {
        cursor: CellAddress,
        viewport: ViewportInfo,
        #[serde(rename = "deleteType")]
        delete_type: DeleteType,
        targets: Vec<u32>,
        selection: Vec<u32>,
        #[serde(rename = "confirmationPending")]
        confirmation_pending: bool,
    },
    #[serde(rename = "bulkOperation")]
    BulkOperation {
        cursor: CellAddress,
        viewport: ViewportInfo,
        #[serde(rename = "command")]
        parsed_command: ParsedBulkCommand,
        #[serde(rename = "previewAvailable")]
        preview_available: bool,
        #[serde(rename = "previewVisible")]
        preview_visible: bool,
        #[serde(rename = "affectedCells")]
        affected_cells: u32,
        status: BulkOperationStatus,
        #[serde(rename = "errorMessage")]
        error_message: Option<String>,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ResizeTarget {
    Column { index: u32 },
    Row { index: u32 },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ResizeMoveDirection {
    Previous,
    Next,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum InsertType {
    Row,
    Column,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum InsertPosition {
    Before,
    After,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DeleteType {
    Row,
    Column,
}

// Type guards
impl UIState {
    pub fn create_navigation_state(cursor: CellAddress, viewport: ViewportInfo) -> Self {
        UIState::Navigation {
            cursor,
            viewport,
            selection: None,
        }
    }

    pub fn spreadsheet_mode(&self) -> SpreadsheetMode {
        match self {
            UIState::Navigation { .. } => SpreadsheetMode::Navigation,
            UIState::Visual { .. } => SpreadsheetMode::Visual,
            UIState::Editing { cell_mode, .. } => {
                // Return different modes based on the cell editing mode
                match cell_mode {
                    CellMode::Insert => SpreadsheetMode::Insert,
                    CellMode::Normal => SpreadsheetMode::Editing, // Shows as "EDIT" in status bar
                    CellMode::Visual => SpreadsheetMode::Visual,
                }
            }
            UIState::Command { .. } => SpreadsheetMode::Command,
            UIState::Resize { .. } => SpreadsheetMode::Resize,
            UIState::Insert { .. } => SpreadsheetMode::Insert,
            UIState::Delete { .. } => SpreadsheetMode::Delete,
            UIState::BulkOperation { .. } => SpreadsheetMode::BulkOperation,
        }
    }

    pub fn cursor(&self) -> &CellAddress {
        match self {
            UIState::Navigation { cursor, .. }
            | UIState::Visual { cursor, .. }
            | UIState::Editing { cursor, .. }
            | UIState::Command { cursor, .. }
            | UIState::Resize { cursor, .. }
            | UIState::Insert { cursor, .. }
            | UIState::Delete { cursor, .. }
            | UIState::BulkOperation { cursor, .. } => cursor,
        }
    }

    pub fn viewport(&self) -> &ViewportInfo {
        match self {
            UIState::Navigation { viewport, .. }
            | UIState::Visual { viewport, .. }
            | UIState::Editing { viewport, .. }
            | UIState::Command { viewport, .. }
            | UIState::Resize { viewport, .. }
            | UIState::Insert { viewport, .. }
            | UIState::Delete { viewport, .. }
            | UIState::BulkOperation { viewport, .. } => viewport,
        }
    }
}

// Helper functions
pub fn is_navigation_mode(state: &UIState) -> bool {
    matches!(state, UIState::Navigation { .. })
}

pub fn is_editing_mode(state: &UIState) -> bool {
    matches!(state, UIState::Editing { .. })
}

pub fn is_command_mode(state: &UIState) -> bool {
    matches!(state, UIState::Command { .. })
}

pub fn is_visual_mode(state: &UIState) -> bool {
    matches!(state, UIState::Visual { .. })
}

pub fn is_resize_mode(state: &UIState) -> bool {
    matches!(state, UIState::Resize { .. })
}

pub fn is_bulk_operation_mode(state: &UIState) -> bool {
    matches!(state, UIState::BulkOperation { .. })
}

// Factory functions
pub fn create_navigation_state(
    cursor: CellAddress,
    viewport: ViewportInfo,
    selection: Option<Selection>,
) -> UIState {
    UIState::Navigation {
        cursor,
        viewport,
        selection,
    }
}

pub fn create_editing_state(
    cursor: CellAddress,
    viewport: ViewportInfo,
    cell_mode: CellMode,
) -> UIState {
    UIState::Editing {
        cursor,
        viewport,
        cell_mode,
        editing_value: String::new(),
        cursor_position: 0,
        visual_start: None,
        visual_type: None,
        edit_variant: None,
    }
}

pub fn create_command_state(cursor: CellAddress, viewport: ViewportInfo) -> UIState {
    UIState::Command {
        cursor,
        viewport,
        command_value: String::new(),
    }
}

pub fn create_visual_state(
    cursor: CellAddress,
    viewport: ViewportInfo,
    visual_mode: SpreadsheetVisualMode,
    anchor: CellAddress,
    selection: Selection,
) -> UIState {
    UIState::Visual {
        cursor,
        viewport,
        selection,
        visual_mode,
        anchor,
    }
}
