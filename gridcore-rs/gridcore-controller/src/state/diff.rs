use super::{
    CellMode, EditMode, InsertMode, ModalData, ModalKind, Selection, SpreadsheetVisualMode, 
    UIState, ViewportInfo, VisualMode,
};
use gridcore_core::types::CellAddress;
use serde::{Deserialize, Serialize};

/// Represents a change in the UI state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StateDiff {
    /// Complete state replacement (used for first entry or major transitions)
    Full(UIState),
    /// Partial state update with only changed fields
    Partial(StateChanges),
}

/// Tracks specific changes between states
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct StateChanges {
    /// Type transition (e.g., Navigation -> Editing)
    pub state_type_changed: Option<StateTypeChange>,
    /// Cursor position change
    pub cursor_changed: Option<CellAddress>,
    /// Viewport change
    pub viewport_changed: Option<ViewportInfo>,
    /// Selection change
    pub selection_changed: Option<Option<Selection>>,
    /// Editing value change
    pub editing_value_changed: Option<String>,
    /// Cursor position in text change
    pub text_cursor_changed: Option<usize>,
    /// Cell mode change
    pub cell_mode_changed: Option<CellMode>,
    /// Visual mode change
    pub visual_mode_changed: Option<SpreadsheetVisualMode>,
    /// Visual anchor change
    pub anchor_changed: Option<CellAddress>,
    /// Visual start position change
    pub visual_start_changed: Option<Option<usize>>,
    /// Visual type change
    pub visual_type_changed: Option<Option<VisualMode>>,
    /// Edit variant change
    pub edit_variant_changed: Option<Option<InsertMode>>,
}

/// Represents a change in the state type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StateTypeChange {
    ToNavigation,
    ToVisual,
    ToEditing,
    ToCommand,
    ToResize,
    ToStructuralInsert,
    ToDelete,
    ToBulkOperation,
}

impl StateDiff {
    /// Create a diff between two states
    pub fn create(old_state: &UIState, new_state: &UIState) -> Self {
        // Check if this is a type transition
        if std::mem::discriminant(old_state) != std::mem::discriminant(new_state) {
            // For major transitions, store the full state
            return StateDiff::Full(new_state.clone());
        }

        // Otherwise, create a partial diff
        let mut changes = StateChanges::default();

        match (old_state, new_state) {
            (
                UIState::Navigation {
                    cursor: old_cursor,
                    viewport: old_viewport,
                    selection: old_selection,
                },
                UIState::Navigation {
                    cursor: new_cursor,
                    viewport: new_viewport,
                    selection: new_selection,
                },
            ) => {
                if old_cursor != new_cursor {
                    changes.cursor_changed = Some(*new_cursor);
                }
                if old_viewport != new_viewport {
                    changes.viewport_changed = Some(*new_viewport);
                }
                if old_selection != new_selection {
                    changes.selection_changed = Some(new_selection.clone());
                }
            }
            (
                UIState::Modal {
                    cursor: old_cursor,
                    viewport: old_viewport,
                    kind: ModalKind::Visual,
                    data: ModalData::Visual {
                        selection: old_selection,
                        visual_mode: old_mode,
                        anchor: old_anchor,
                    },
                },
                UIState::Modal {
                    cursor: new_cursor,
                    viewport: new_viewport,
                    kind: ModalKind::Visual,
                    data: ModalData::Visual {
                        selection: new_selection,
                        visual_mode: new_mode,
                        anchor: new_anchor,
                    },
                },
            ) => {
                if old_cursor != new_cursor {
                    changes.cursor_changed = Some(*new_cursor);
                }
                if old_viewport != new_viewport {
                    changes.viewport_changed = Some(*new_viewport);
                }
                if old_selection != new_selection {
                    changes.selection_changed = Some(Some(new_selection.clone()));
                }
                if old_mode != new_mode {
                    changes.visual_mode_changed = Some(*new_mode);
                }
                if old_anchor != new_anchor {
                    changes.anchor_changed = Some(*new_anchor);
                }
            }
            (
                UIState::Editing {
                    cursor: old_cursor,
                    viewport: old_viewport,
                    mode: old_mode,
                    value: old_value,
                    cursor_pos: old_pos,
                    visual_start: old_vstart,
                    visual_type: old_vtype,
                    insert_variant: old_variant,
                },
                UIState::Editing {
                    cursor: new_cursor,
                    viewport: new_viewport,
                    mode: new_mode,
                    value: new_value,
                    cursor_pos: new_pos,
                    visual_start: new_vstart,
                    visual_type: new_vtype,
                    insert_variant: new_variant,
                },
            ) => {
                if old_cursor != new_cursor {
                    changes.cursor_changed = Some(*new_cursor);
                }
                if old_viewport != new_viewport {
                    changes.viewport_changed = Some(*new_viewport);
                }
                if old_mode != new_mode {
                    changes.cell_mode_changed = Some(*new_mode);
                }
                if old_value != new_value {
                    changes.editing_value_changed = Some(new_value.clone());
                }
                if old_pos != new_pos {
                    changes.text_cursor_changed = Some(*new_pos);
                }
                if old_vstart != new_vstart {
                    changes.visual_start_changed = Some(*new_vstart);
                }
                if old_vtype != new_vtype {
                    changes.visual_type_changed = Some(*new_vtype);
                }
                if old_variant != new_variant {
                    changes.edit_variant_changed = Some(*new_variant);
                }
            }
            _ => {
                // For other state types or mismatched comparisons, store full state
                return StateDiff::Full(new_state.clone());
            }
        }

        // Check if any changes were made
        if changes.has_changes() {
            StateDiff::Partial(changes)
        } else {
            // No changes detected (shouldn't happen in practice)
            StateDiff::Partial(changes)
        }
    }

    /// Apply a diff to a state to produce a new state
    pub fn apply(&self, base_state: &UIState) -> UIState {
        match self {
            StateDiff::Full(state) => state.clone(),
            StateDiff::Partial(changes) => changes.apply_to(base_state),
        }
    }
}

impl StateChanges {
    /// Check if there are any changes
    fn has_changes(&self) -> bool {
        self.state_type_changed.is_some()
            || self.cursor_changed.is_some()
            || self.viewport_changed.is_some()
            || self.selection_changed.is_some()
            || self.editing_value_changed.is_some()
            || self.text_cursor_changed.is_some()
            || self.cell_mode_changed.is_some()
            || self.visual_mode_changed.is_some()
            || self.anchor_changed.is_some()
            || self.visual_start_changed.is_some()
            || self.visual_type_changed.is_some()
            || self.edit_variant_changed.is_some()
    }

    /// Apply changes to a base state
    fn apply_to(&self, base_state: &UIState) -> UIState {
        let mut result = base_state.clone();

        match &mut result {
            UIState::Navigation {
                cursor,
                viewport,
                selection,
            } => {
                if let Some(new_cursor) = self.cursor_changed {
                    *cursor = new_cursor;
                }
                if let Some(new_viewport) = self.viewport_changed {
                    *viewport = new_viewport;
                }
                if let Some(ref new_selection) = self.selection_changed {
                    *selection = new_selection.clone();
                }
            }
            UIState::Visual {
                cursor,
                viewport,
                selection,
                visual_mode,
                anchor,
            } => {
                if let Some(new_cursor) = self.cursor_changed {
                    *cursor = new_cursor;
                }
                if let Some(new_viewport) = self.viewport_changed {
                    *viewport = new_viewport;
                }
                if let Some(Some(ref new_selection)) = self.selection_changed {
                    *selection = new_selection.clone();
                }
                if let Some(new_mode) = self.visual_mode_changed {
                    *visual_mode = new_mode;
                }
                if let Some(new_anchor) = self.anchor_changed {
                    *anchor = new_anchor;
                }
            }
            UIState::Editing {
                cursor,
                viewport,
                cell_mode,
                editing_value,
                cursor_position,
                visual_start,
                visual_type,
                edit_variant,
            } => {
                if let Some(new_cursor) = self.cursor_changed {
                    *cursor = new_cursor;
                }
                if let Some(new_viewport) = self.viewport_changed {
                    *viewport = new_viewport;
                }
                if let Some(new_mode) = self.cell_mode_changed {
                    *cell_mode = new_mode;
                }
                if let Some(ref new_value) = self.editing_value_changed {
                    *editing_value = new_value.clone();
                }
                if let Some(new_pos) = self.text_cursor_changed {
                    *cursor_position = new_pos;
                }
                if let Some(new_vstart) = self.visual_start_changed {
                    *visual_start = new_vstart;
                }
                if let Some(new_vtype) = self.visual_type_changed {
                    *visual_type = new_vtype;
                }
                if let Some(new_variant) = self.edit_variant_changed {
                    *edit_variant = new_variant;
                }
            }
            _ => {
                // For other state types, no partial updates supported yet
            }
        }

        result
    }
}
