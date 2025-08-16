use crate::state::{InsertMode, VisualMode};
use gridcore_core::types::CellAddress;
use serde::{Deserialize, Serialize};

/// Mode for cell-level text editing (vim modes within a cell)
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum CellEditMode {
    Normal,
    Insert(InsertMode),
    Visual(VisualMode),
}

/// Simplified editor mode tracking - what the user is doing
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub enum EditorMode {
    /// Navigation mode - moving around the spreadsheet
    #[default]
    Navigation,

    /// Editing a cell's content
    Editing {
        value: String,
        cursor_pos: usize,
        insert_mode: Option<InsertMode>,
    },

    /// Command mode for Vim-style commands
    Command { value: String },

    /// Visual selection mode for grid-level selection
    Visual {
        mode: VisualMode,
        anchor: CellAddress,
    },

    /// Cell editing with vim modes - tracks text editing state
    CellEditing {
        value: String,
        cursor_pos: usize,
        mode: CellEditMode,
        visual_anchor: Option<usize>, // For text visual mode
    },

    /// Resizing columns or rows
    Resizing,
}

impl EditorMode {
    pub fn is_editing(&self) -> bool {
        matches!(
            self,
            EditorMode::Editing { .. } | EditorMode::CellEditing { .. }
        )
    }

    pub fn is_cell_editing(&self) -> bool {
        matches!(self, EditorMode::CellEditing { .. })
    }

    pub fn is_visual(&self) -> bool {
        matches!(self, EditorMode::Visual { .. })
    }

    pub fn is_command(&self) -> bool {
        matches!(self, EditorMode::Command { .. })
    }

    pub fn is_navigation(&self) -> bool {
        matches!(self, EditorMode::Navigation)
    }

    pub fn is_resizing(&self) -> bool {
        matches!(self, EditorMode::Resizing)
    }
}
