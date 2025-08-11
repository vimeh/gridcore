use crate::state::{UIState, CellMode, SpreadsheetVisualMode, Selection};
use crate::state::machine::Action;
use gridcore_core::Result;

/// Helper methods for efficient state mutations
impl UIState {
    /// Update cursor without cloning the entire state
    pub fn with_cursor(mut self, cursor: gridcore_core::types::CellAddress) -> Self {
        match &mut self {
            UIState::Navigation { cursor: c, .. }
            | UIState::Visual { cursor: c, .. }
            | UIState::Editing { cursor: c, .. }
            | UIState::Command { cursor: c, .. }
            | UIState::Resize { cursor: c, .. }
            | UIState::Insert { cursor: c, .. }
            | UIState::Delete { cursor: c, .. }
            | UIState::BulkOperation { cursor: c, .. } => {
                *c = cursor;
            }
        }
        self
    }

    /// Update viewport without cloning the entire state
    pub fn with_viewport(mut self, viewport: crate::state::ViewportInfo) -> Self {
        match &mut self {
            UIState::Navigation { viewport: v, .. }
            | UIState::Visual { viewport: v, .. }
            | UIState::Editing { viewport: v, .. }
            | UIState::Command { viewport: v, .. }
            | UIState::Resize { viewport: v, .. }
            | UIState::Insert { viewport: v, .. }
            | UIState::Delete { viewport: v, .. }
            | UIState::BulkOperation { viewport: v, .. } => {
                *v = viewport;
            }
        }
        self
    }

    /// Update selection in Navigation state without cloning
    pub fn with_selection(mut self, selection: Option<Selection>) -> Self {
        if let UIState::Navigation { selection: s, .. } = &mut self {
            *s = selection;
        }
        self
    }

    /// Transition from Editing state efficiently
    pub fn editing_to_visual(mut self, visual_type: crate::state::VisualMode, anchor: Option<usize>) -> Result<Self> {
        if let UIState::Editing {
            cell_mode,
            visual_type: v_type,
            visual_start,
            cursor_position,
            ..
        } = &mut self {
            *cell_mode = CellMode::Visual;
            *v_type = Some(visual_type);
            *visual_start = Some(anchor.unwrap_or(*cursor_position));
            Ok(self)
        } else {
            Err(gridcore_core::SpreadsheetError::InvalidOperation(
                "Not in editing state".to_string()
            ))
        }
    }

    /// Update editing value efficiently  
    pub fn with_editing_value(mut self, value: String, cursor_pos: usize) -> Self {
        if let UIState::Editing {
            editing_value,
            cursor_position,
            ..
        } = &mut self {
            *editing_value = value;
            *cursor_position = cursor_pos;
        }
        self
    }

    /// Update command value efficiently
    pub fn with_command_value(mut self, value: String) -> Self {
        if let UIState::Command { command_value, .. } = &mut self {
            *command_value = value;
        }
        self
    }

    /// Transition cell mode efficiently
    pub fn with_cell_mode(mut self, mode: CellMode) -> Self {
        if let UIState::Editing { cell_mode, .. } = &mut self {
            *cell_mode = mode;
        }
        self
    }

    /// Clear visual mode efficiently
    pub fn clear_visual_mode(mut self) -> Self {
        if let UIState::Editing {
            cell_mode,
            visual_type,
            visual_start,
            ..
        } = &mut self {
            *cell_mode = CellMode::Normal;
            *visual_type = None;
            *visual_start = None;
        }
        self
    }
}