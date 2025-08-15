use crate::state::{InsertMode, VisualMode};
use gridcore_core::types::CellAddress;
use serde::{Deserialize, Serialize};

/// Simplified editor mode tracking - what the user is doing
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum EditorMode {
    /// Navigation mode - moving around the spreadsheet
    Navigation,

    /// Editing a cell's content
    Editing {
        value: String,
        cursor_pos: usize,
        insert_mode: Option<InsertMode>,
    },

    /// Command mode for Vim-style commands
    Command { value: String },

    /// Visual selection mode
    Visual {
        mode: VisualMode,
        anchor: CellAddress,
    },

    /// Resizing columns or rows
    Resizing,
}

impl EditorMode {
    pub fn is_editing(&self) -> bool {
        matches!(self, EditorMode::Editing { .. })
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

impl Default for EditorMode {
    fn default() -> Self {
        EditorMode::Navigation
    }
}
