use gridcore_core::types::CellAddress;
use serde::{Deserialize, Serialize};
use std::borrow::Cow;

// ============================================================================
// Core State - Shared across all UI states
// ============================================================================

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CoreState {
    pub cursor: CellAddress,
    pub viewport: ViewportInfo,
}

impl CoreState {
    pub fn new(cursor: CellAddress, viewport: ViewportInfo) -> Self {
        Self { cursor, viewport }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct ViewportInfo {
    pub start_row: u32,
    pub start_col: u32,
    pub rows: u32,
    pub cols: u32,
}

// ============================================================================
// Selection Types
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum VisualMode {
    Character, // For text selection within cell editing
    Line,      // Line-based selection (text or spreadsheet rows)
    Block,     // Block selection (text or spreadsheet range)
    Column,    // Column selection (spreadsheet only)
    Row,       // Row selection (spreadsheet only)
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

// ============================================================================
// Modal Types - Consolidated modal behaviors
// ============================================================================

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "modalType", rename_all = "camelCase")]
pub enum NavigationModal {
    Command {
        value: String,
    },
    Visual {
        mode: VisualMode,
        anchor: CellAddress,
        selection: Selection,
    },
    Resize {
        target: ResizeTarget,
        sizes: ResizeSizes,
    },
    Insert {
        config: InsertConfig,
    },
    Delete {
        config: DeleteConfig,
    },
    BulkOperation {
        command: ParsedBulkCommand,
        status: BulkOperationStatus,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct InsertConfig {
    pub insert_type: InsertType,
    pub position: InsertPosition,
    pub reference: u32,
    pub count: u32,
    pub target_index: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DeleteConfig {
    pub delete_type: DeleteType,
    pub targets: Vec<u32>,
    pub selection: Vec<u32>,
    pub confirmation_pending: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct ResizeSizes {
    pub original_size: u32,
    pub current_size: u32,
    pub initial_position: f64,
    pub current_position: f64,
    pub resize_index: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum BulkOperationStatus {
    Preparing,
    Previewing,
    Executing,
    Completed,
    Error,
}

// ============================================================================
// Editing Types
// ============================================================================

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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EditMode {
    Normal,
    Insert,
    Visual,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct VisualSelection {
    pub start: usize,
    pub mode: VisualMode,
}

// ============================================================================
// Simplified UIState - Only 2 variants
// ============================================================================

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "stateType", rename_all = "camelCase")]
pub enum UIState {
    #[serde(rename = "navigation")]
    Navigation {
        #[serde(flatten)]
        core: CoreState,
        selection: Option<Selection>,
        modal: Option<NavigationModal>,
    },
    #[serde(rename = "editing")]
    Editing {
        #[serde(flatten)]
        core: CoreState,
        #[serde(rename = "editingValue")]
        value: String,
        #[serde(rename = "cursorPosition")]
        cursor_pos: usize,
        #[serde(rename = "editMode")]
        mode: EditMode,
        #[serde(rename = "visualSelection")]
        visual_selection: Option<VisualSelection>,
        #[serde(rename = "insertVariant")]
        insert_variant: Option<InsertMode>,
    },
}

// ============================================================================
// UIState Methods - Replace factory functions and type guards
// ============================================================================

impl UIState {
    // Factory methods
    pub fn new_navigation(cursor: CellAddress, viewport: ViewportInfo) -> Self {
        UIState::Navigation {
            core: CoreState::new(cursor, viewport),
            selection: None,
            modal: None,
        }
    }

    pub fn new_editing(cursor: CellAddress, viewport: ViewportInfo) -> Self {
        UIState::Editing {
            core: CoreState::new(cursor, viewport),
            value: String::new(),
            cursor_pos: 0,
            mode: EditMode::Normal,
            visual_selection: None,
            insert_variant: None,
        }
    }

    // Core state accessors
    pub fn core(&self) -> &CoreState {
        match self {
            UIState::Navigation { core, .. } | UIState::Editing { core, .. } => core,
        }
    }

    pub fn core_mut(&mut self) -> &mut CoreState {
        match self {
            UIState::Navigation { core, .. } | UIState::Editing { core, .. } => core,
        }
    }

    pub fn cursor(&self) -> &CellAddress {
        &self.core().cursor
    }

    pub fn viewport(&self) -> &ViewportInfo {
        &self.core().viewport
    }

    // Type checks
    pub fn is_navigation(&self) -> bool {
        matches!(self, UIState::Navigation { .. })
    }

    pub fn is_editing(&self) -> bool {
        matches!(self, UIState::Editing { .. })
    }

    pub fn is_modal(&self, kind: ModalKind) -> bool {
        match self {
            UIState::Navigation {
                modal: Some(modal), ..
            } => modal.kind() == kind,
            _ => false,
        }
    }

    // Modal accessors
    pub fn modal(&self) -> Option<&NavigationModal> {
        match self {
            UIState::Navigation { modal, .. } => modal.as_ref(),
            _ => None,
        }
    }

    pub fn modal_mut(&mut self) -> Option<&mut NavigationModal> {
        match self {
            UIState::Navigation { modal, .. } => modal.as_mut(),
            _ => None,
        }
    }

    // Selection accessors
    pub fn selection(&self) -> Option<&Selection> {
        match self {
            UIState::Navigation {
                selection, modal, ..
            } => {
                // Check modal first for visual mode selection
                if let Some(NavigationModal::Visual { selection, .. }) = modal {
                    Some(selection)
                } else {
                    selection.as_ref()
                }
            }
            _ => None,
        }
    }

    // Spreadsheet mode derivation
    pub fn spreadsheet_mode(&self) -> SpreadsheetMode {
        match self {
            UIState::Navigation { modal, .. } => match modal {
                None => SpreadsheetMode::Navigation,
                Some(modal) => match modal {
                    NavigationModal::Command { .. } => SpreadsheetMode::Command,
                    NavigationModal::Visual { .. } => SpreadsheetMode::Visual,
                    NavigationModal::Resize { .. } => SpreadsheetMode::Resize,
                    NavigationModal::Insert { .. } => SpreadsheetMode::Insert,
                    NavigationModal::Delete { .. } => SpreadsheetMode::Delete,
                    NavigationModal::BulkOperation { .. } => SpreadsheetMode::BulkOperation,
                },
            },
            UIState::Editing { mode, .. } => match mode {
                EditMode::Normal => SpreadsheetMode::Editing,
                EditMode::Insert => SpreadsheetMode::Insert,
                EditMode::Visual => SpreadsheetMode::Visual,
            },
        }
    }

    // Modal transitions
    pub fn enter_modal(self, modal: NavigationModal) -> Self {
        match self {
            UIState::Navigation {
                core, selection, ..
            } => UIState::Navigation {
                core,
                selection,
                modal: Some(modal),
            },
            _ => self, // Can't enter modal from editing
        }
    }

    pub fn exit_modal(self) -> Self {
        match self {
            UIState::Navigation {
                core, selection, ..
            } => UIState::Navigation {
                core,
                selection,
                modal: None,
            },
            _ => self,
        }
    }

    // Editing transitions
    pub fn to_editing(self) -> Self {
        let core = self.core().clone();
        UIState::new_editing(core.cursor, core.viewport)
    }

    pub fn to_navigation(self) -> Self {
        let core = self.core().clone();
        UIState::new_navigation(core.cursor, core.viewport)
    }
}

// ============================================================================
// Modal Kind for type checking
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ModalKind {
    Command,
    Visual,
    Resize,
    Insert,
    Delete,
    BulkOperation,
}

impl NavigationModal {
    pub fn kind(&self) -> ModalKind {
        match self {
            NavigationModal::Command { .. } => ModalKind::Command,
            NavigationModal::Visual { .. } => ModalKind::Visual,
            NavigationModal::Resize { .. } => ModalKind::Resize,
            NavigationModal::Insert { .. } => ModalKind::Insert,
            NavigationModal::Delete { .. } => ModalKind::Delete,
            NavigationModal::BulkOperation { .. } => ModalKind::BulkOperation,
        }
    }
}

// ============================================================================
// Supporting Types
// ============================================================================

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
