use super::{EditMode, InsertMode, NavigationModal, Selection, UIState, ViewportInfo, VisualMode};
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
    /// Edit mode change
    pub edit_mode_changed: Option<EditMode>,
    /// Visual mode change
    pub visual_mode_changed: Option<VisualMode>,
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
                    core: old_core,
                    selection: old_selection,
                    modal: old_modal,
                },
                UIState::Navigation {
                    core: new_core,
                    selection: new_selection,
                    modal: new_modal,
                },
            ) => {
                if old_core.cursor != new_core.cursor {
                    changes.cursor_changed = Some(new_core.cursor);
                }
                if old_core.viewport != new_core.viewport {
                    changes.viewport_changed = Some(new_core.viewport);
                }
                if old_selection != new_selection {
                    changes.selection_changed = Some(new_selection.clone());
                }
                if old_modal != new_modal {
                    // Handle modal changes if needed
                }
            }
            // Handle Navigation with Visual modal specially
            (
                UIState::Navigation {
                    core: old_core,
                    modal:
                        Some(NavigationModal::Visual {
                            mode: old_mode,
                            anchor: old_anchor,
                            selection: old_selection,
                        }),
                    ..
                },
                UIState::Navigation {
                    core: new_core,
                    modal:
                        Some(NavigationModal::Visual {
                            mode: new_mode,
                            anchor: new_anchor,
                            selection: new_selection,
                        }),
                    ..
                },
            ) => {
                if old_core.cursor != new_core.cursor {
                    changes.cursor_changed = Some(new_core.cursor);
                }
                if old_core.viewport != new_core.viewport {
                    changes.viewport_changed = Some(new_core.viewport);
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
                    core: old_core,
                    mode: old_mode,
                    value: old_value,
                    cursor_pos: old_pos,
                    visual_selection: old_visual,
                    insert_variant: old_variant,
                },
                UIState::Editing {
                    core: new_core,
                    mode: new_mode,
                    value: new_value,
                    cursor_pos: new_pos,
                    visual_selection: new_visual,
                    insert_variant: new_variant,
                },
            ) => {
                if old_core.cursor != new_core.cursor {
                    changes.cursor_changed = Some(new_core.cursor);
                }
                if old_core.viewport != new_core.viewport {
                    changes.viewport_changed = Some(new_core.viewport);
                }
                if old_mode != new_mode {
                    changes.edit_mode_changed = Some(*new_mode);
                }
                if old_value != new_value {
                    changes.editing_value_changed = Some(new_value.clone());
                }
                if old_pos != new_pos {
                    changes.text_cursor_changed = Some(*new_pos);
                }
                if old_visual != new_visual {
                    // Handle visual selection changes
                    if let (Some(old_v), Some(new_v)) = (old_visual, new_visual) {
                        if old_v.start != new_v.start {
                            changes.visual_start_changed = Some(Some(new_v.start));
                        }
                        if old_v.mode != new_v.mode {
                            changes.visual_type_changed = Some(Some(new_v.mode));
                        }
                    } else {
                        changes.visual_start_changed = Some(new_visual.as_ref().map(|v| v.start));
                        changes.visual_type_changed = Some(new_visual.as_ref().map(|v| v.mode));
                    }
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
            || self.edit_mode_changed.is_some()
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
                core, selection, ..
            } => {
                if let Some(new_cursor) = self.cursor_changed {
                    core.cursor = new_cursor;
                }
                if let Some(new_viewport) = self.viewport_changed {
                    core.viewport = new_viewport;
                }
                if let Some(ref new_selection) = self.selection_changed {
                    *selection = new_selection.clone();
                }
            }
            UIState::Editing {
                core,
                mode,
                value,
                cursor_pos,
                visual_selection,
                insert_variant,
            } => {
                if let Some(new_cursor) = self.cursor_changed {
                    core.cursor = new_cursor;
                }
                if let Some(new_viewport) = self.viewport_changed {
                    core.viewport = new_viewport;
                }
                if let Some(new_mode) = self.edit_mode_changed {
                    *mode = new_mode;
                }
                if let Some(ref new_value) = self.editing_value_changed {
                    *value = new_value.clone();
                }
                if let Some(new_pos) = self.text_cursor_changed {
                    *cursor_pos = new_pos;
                }
                // Handle visual selection changes
                if let Some(new_vstart) = self.visual_start_changed {
                    if let Some(ref mut visual) = visual_selection {
                        visual.start = new_vstart.unwrap_or(0);
                    } else if let Some(start) = new_vstart {
                        *visual_selection = Some(crate::state::VisualSelection {
                            start,
                            mode: crate::state::VisualMode::Character,
                        });
                    }
                }
                if let Some(new_vtype) = self.visual_type_changed {
                    if let Some(ref mut visual) = visual_selection {
                        if let Some(mode) = new_vtype {
                            visual.mode = mode;
                        }
                    }
                }
                if let Some(new_variant) = self.edit_variant_changed {
                    *insert_variant = new_variant;
                }
            }
            _ => {
                // For other state types, no partial updates supported yet
            }
        }

        result
    }
}
