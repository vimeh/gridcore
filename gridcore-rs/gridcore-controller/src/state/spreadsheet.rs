use gridcore_core::types::CellAddress;
use serde::{Deserialize, Serialize};
use std::borrow::Cow;

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct ViewportInfo {
    pub start_row: u32,
    pub start_col: u32,
    pub rows: u32,
    pub cols: u32,
}

// CellMode removed - use EditMode instead

// Unified VisualMode for both cell editing and spreadsheet selection
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum VisualMode {
    Character, // For text selection within cell editing
    Line,      // Line-based selection (text or spreadsheet rows)
    Block,     // Block selection (text or spreadsheet range)
    Column,    // Column selection (spreadsheet only)
    Row,       // Row selection (spreadsheet only)
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

// ModalKind represents different modal states the spreadsheet can be in
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ModalKind {
    Command,
    Resize,
    Insert, // Structural insert (rows/columns)
    Delete, // Structural delete (rows/columns)
    BulkOperation,
    Visual, // Spreadsheet visual mode (range selection)
}

// EditMode represents modes within cell editing
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EditMode {
    Normal,
    Insert,
    Visual,
}

// SpreadsheetMode is derived from UIState, not stored separately
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
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

// ResizeSizes holds the size information for resize operations
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct ResizeSizes {
    pub original_size: u32,
    pub current_size: u32,
    pub initial_position: f64,
    pub current_position: f64,
    pub resize_index: u32,
}

// ModalData holds data specific to each modal type
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "modalType", rename_all = "camelCase")]
pub enum ModalData {
    Command {
        value: String,
    },
    Resize {
        target: ResizeTarget,
        sizes: ResizeSizes,
    },
    Insert {
        insert_type: InsertType,
        position: InsertPosition,
        reference: u32,
        count: u32,
        target_index: u32,
    },
    Delete {
        delete_type: DeleteType,
        targets: Vec<u32>,
        selection: Vec<u32>,
        confirmation_pending: bool,
    },
    BulkOperation {
        parsed_command: ParsedBulkCommand,
        preview_available: bool,
        preview_visible: bool,
        affected_cells: u32,
        status: BulkOperationStatus,
        error_message: Option<String>,
    },
    Visual {
        selection: Selection,
        visual_mode: VisualMode,
        anchor: CellAddress,
    },
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
        direction: Cow<'static, str>,
        column: Option<u32>,
    },
}

// Simplified UIState with only 3 core variants
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "stateType", rename_all = "camelCase")]
pub enum UIState {
    #[serde(rename = "navigation")]
    Navigation {
        cursor: CellAddress,
        viewport: ViewportInfo,
        selection: Option<Selection>,
    },
    #[serde(rename = "editing")]
    Editing {
        cursor: CellAddress,
        viewport: ViewportInfo,
        #[serde(rename = "editingValue")]
        value: String,
        #[serde(rename = "cursorPosition")]
        cursor_pos: usize,
        #[serde(rename = "editMode")]
        mode: EditMode,
        // Cell editing specific fields
        #[serde(rename = "visualStart")]
        visual_start: Option<usize>, // For visual mode within editing
        #[serde(rename = "visualType")]
        visual_type: Option<VisualMode>, // Character/Line/Block selection
        #[serde(rename = "insertVariant")]
        insert_variant: Option<InsertMode>, // Which insert mode (i, a, I, A, etc.)
    },
    #[serde(rename = "modal")]
    Modal {
        cursor: CellAddress,
        viewport: ViewportInfo,
        kind: ModalKind,
        data: ModalData,
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
            UIState::Editing { mode, .. } => {
                // Return different modes based on the edit mode
                match mode {
                    EditMode::Insert => SpreadsheetMode::Insert,
                    EditMode::Normal => SpreadsheetMode::Editing, // Shows as "EDIT" in status bar
                    EditMode::Visual => SpreadsheetMode::Visual,
                }
            }
            UIState::Modal { kind, .. } => match kind {
                ModalKind::Command => SpreadsheetMode::Command,
                ModalKind::Resize => SpreadsheetMode::Resize,
                ModalKind::Insert => SpreadsheetMode::Insert,
                ModalKind::Delete => SpreadsheetMode::Delete,
                ModalKind::BulkOperation => SpreadsheetMode::BulkOperation,
                ModalKind::Visual => SpreadsheetMode::Visual,
            },
        }
    }

    pub fn cursor(&self) -> &CellAddress {
        match self {
            UIState::Navigation { cursor, .. }
            | UIState::Editing { cursor, .. }
            | UIState::Modal { cursor, .. } => cursor,
        }
    }

    pub fn viewport(&self) -> &ViewportInfo {
        match self {
            UIState::Navigation { viewport, .. }
            | UIState::Editing { viewport, .. }
            | UIState::Modal { viewport, .. } => viewport,
        }
    }

    pub fn selection(&self) -> Option<&Selection> {
        match self {
            UIState::Navigation { selection, .. } => selection.as_ref(),
            UIState::Modal {
                kind: ModalKind::Visual,
                data,
                ..
            } => {
                if let ModalData::Visual { selection, .. } = data {
                    Some(selection)
                } else {
                    None
                }
            }
            _ => None,
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
    matches!(
        state,
        UIState::Modal {
            kind: ModalKind::Command,
            ..
        }
    )
}

pub fn is_visual_mode(state: &UIState) -> bool {
    matches!(
        state,
        UIState::Modal {
            kind: ModalKind::Visual,
            ..
        }
    )
}

pub fn is_resize_mode(state: &UIState) -> bool {
    matches!(
        state,
        UIState::Modal {
            kind: ModalKind::Resize,
            ..
        }
    )
}

pub fn is_bulk_operation_mode(state: &UIState) -> bool {
    matches!(
        state,
        UIState::Modal {
            kind: ModalKind::BulkOperation,
            ..
        }
    )
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
    mode: EditMode,
) -> UIState {
    UIState::Editing {
        cursor,
        viewport,
        value: String::new(),
        cursor_pos: 0,
        mode,
        visual_start: None,
        visual_type: None,
        insert_variant: None,
    }
}

pub fn create_command_state(cursor: CellAddress, viewport: ViewportInfo) -> UIState {
    UIState::Modal {
        cursor,
        viewport,
        kind: ModalKind::Command,
        data: ModalData::Command {
            value: String::new(),
        },
    }
}

pub fn create_visual_state(
    cursor: CellAddress,
    viewport: ViewportInfo,
    visual_mode: VisualMode,
    anchor: CellAddress,
    selection: Selection,
) -> UIState {
    UIState::Modal {
        cursor,
        viewport,
        kind: ModalKind::Visual,
        data: ModalData::Visual {
            selection,
            visual_mode,
            anchor,
        },
    }
}
