use gridcore_core::types::CellAddress;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ViewportInfo {
    pub start_row: u32,
    pub start_col: u32,
    pub rows: u32,
    pub cols: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CellMode {
    Normal,
    Insert,
    Visual,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum VisualMode {
    Character,
    Line,
    Block,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SpreadsheetVisualMode {
    Char,
    Line,
    Block,
    Column,
    Row,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum InsertMode {
    I,  // insert before cursor
    A,  // append after cursor
    CapitalA,  // append at end of line
    CapitalI,  // insert at beginning of line
    O,  // open line below
    CapitalO,  // open line above
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum SelectionType {
    Cell { address: CellAddress },
    Range { start: CellAddress, end: CellAddress },
    Column { columns: Vec<u32> },
    Row { rows: Vec<u32> },
    // Alternative name for compatibility
    // Row { indices: Vec<u32> },
    Multi { selections: Vec<Selection> },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Selection {
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

// Placeholder for ParsedBulkCommand - will be implemented later
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ParsedBulkCommand {
    pub command: String,
    pub operation: String,
    pub range_spec: String,
    pub parameters: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum UIState {
    Navigation {
        cursor: CellAddress,
        viewport: ViewportInfo,
        selection: Option<Selection>,
    },
    Visual {
        cursor: CellAddress,
        viewport: ViewportInfo,
        selection: Selection,
        visual_mode: SpreadsheetVisualMode,
        anchor: CellAddress,
    },
    Editing {
        cursor: CellAddress,
        viewport: ViewportInfo,
        cell_mode: CellMode,
        editing_value: String,
        cursor_position: usize,
        visual_start: Option<usize>,
        visual_type: Option<VisualMode>,
        edit_variant: Option<InsertMode>,
    },
    Command {
        cursor: CellAddress,
        viewport: ViewportInfo,
        command_value: String,
    },
    Resize {
        cursor: CellAddress,
        viewport: ViewportInfo,
        target: ResizeTarget,
        resize_target: ResizeTarget,
        resize_index: u32,
        original_size: u32,
        current_size: u32,
        initial_position: f64,
        current_position: f64,
    },
    Insert {
        cursor: CellAddress,
        viewport: ViewportInfo,
        insert_type: InsertType,
        position: InsertPosition,
        insert_position: InsertPosition,
        reference: u32,
        count: u32,
        target_index: u32,
    },
    Delete {
        cursor: CellAddress,
        viewport: ViewportInfo,
        delete_type: DeleteType,
        targets: Vec<u32>,
        selection: Vec<u32>,
        confirmation_pending: bool,
    },
    BulkOperation {
        cursor: CellAddress,
        viewport: ViewportInfo,
        parsed_command: ParsedBulkCommand,
        preview_available: bool,
        preview_visible: bool,
        affected_cells: u32,
        status: BulkOperationStatus,
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
            UIState::Editing { .. } => SpreadsheetMode::Editing,
            UIState::Command { .. } => SpreadsheetMode::Command,
            UIState::Resize { .. } => SpreadsheetMode::Resize,
            UIState::Insert { .. } => SpreadsheetMode::Insert,
            UIState::Delete { .. } => SpreadsheetMode::Delete,
            UIState::BulkOperation { .. } => SpreadsheetMode::BulkOperation,
        }
    }

    pub fn cursor(&self) -> &CellAddress {
        match self {
            UIState::Navigation { cursor, .. } |
            UIState::Visual { cursor, .. } |
            UIState::Editing { cursor, .. } |
            UIState::Command { cursor, .. } |
            UIState::Resize { cursor, .. } |
            UIState::Insert { cursor, .. } |
            UIState::Delete { cursor, .. } |
            UIState::BulkOperation { cursor, .. } => cursor,
        }
    }

    pub fn viewport(&self) -> &ViewportInfo {
        match self {
            UIState::Navigation { viewport, .. } |
            UIState::Visual { viewport, .. } |
            UIState::Editing { viewport, .. } |
            UIState::Command { viewport, .. } |
            UIState::Resize { viewport, .. } |
            UIState::Insert { viewport, .. } |
            UIState::Delete { viewport, .. } |
            UIState::BulkOperation { viewport, .. } => viewport,
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

pub fn create_command_state(
    cursor: CellAddress,
    viewport: ViewportInfo,
) -> UIState {
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