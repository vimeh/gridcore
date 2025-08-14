use crate::state::{actions::Action, CoreState, EditMode, NavigationModal, Selection, UIState};
use gridcore_core::Result;

/// Consolidated handler for all state transitions
pub struct StateTransitionHandler;

impl StateTransitionHandler {
    pub fn new() -> Self {
        Self
    }

    pub fn handle(&self, state: &UIState, action: &Action) -> Result<UIState> {
        match (state, action) {
            // ============================================================
            // Navigation State Transitions
            // ============================================================
            (
                UIState::Navigation {
                    core,
                    selection,
                    modal,
                },
                action,
            ) => self.handle_navigation(core, selection.clone(), modal.clone(), action),

            // ============================================================
            // Editing State Transitions
            // ============================================================
            (UIState::Editing { .. }, action) => self.handle_editing(state, action),
        }
    }

    fn handle_navigation(
        &self,
        core: &CoreState,
        selection: Option<Selection>,
        modal: Option<NavigationModal>,
        action: &Action,
    ) -> Result<UIState> {
        match action {
            // Start editing
            Action::StartEditing {
                edit_mode,
                initial_value,
                cursor_position,
            } => {
                let state = UIState::Editing {
                    core: core.clone(),
                    value: initial_value.clone().unwrap_or_default(),
                    cursor_pos: cursor_position.unwrap_or(0),
                    mode: if edit_mode.is_some() {
                        EditMode::Insert
                    } else {
                        EditMode::Normal
                    },
                    visual_selection: None,
                    insert_variant: *edit_mode,
                };
                Ok(state)
            }

            // Enter command mode
            Action::EnterCommandMode => Ok(UIState::Navigation {
                core: core.clone(),
                selection,
                modal: Some(NavigationModal::Command {
                    value: String::new(),
                }),
            }),

            // Enter visual mode
            Action::EnterSpreadsheetVisualMode {
                visual_mode,
                selection: new_selection,
            } => Ok(UIState::Navigation {
                core: core.clone(),
                selection: None,
                modal: Some(NavigationModal::Visual {
                    mode: *visual_mode,
                    anchor: core.cursor,
                    selection: new_selection.clone(),
                }),
            }),

            // Escape - exit any modal
            Action::Escape => Ok(UIState::Navigation {
                core: core.clone(),
                selection,
                modal: None,
            }),

            // No direct MoveCursor action in current system - handled elsewhere

            // Update viewport actions are handled separately

            // Handle modal-specific actions
            _ => {
                if let Some(modal) = modal {
                    self.handle_modal_action(core, selection, modal, action)
                } else {
                    Ok(UIState::Navigation {
                        core: core.clone(),
                        selection,
                        modal: None,
                    })
                }
            }
        }
    }

    fn handle_modal_action(
        &self,
        core: &CoreState,
        selection: Option<Selection>,
        modal: NavigationModal,
        action: &Action,
    ) -> Result<UIState> {
        match (&modal, action) {
            // Command mode actions
            (
                NavigationModal::Command { value: _ },
                Action::UpdateCommandValue { value: new_value },
            ) => Ok(UIState::Navigation {
                core: core.clone(),
                selection,
                modal: Some(NavigationModal::Command {
                    value: new_value.clone(),
                }),
            }),

            // Visual mode actions
            (
                NavigationModal::Visual { mode, anchor, .. },
                Action::UpdateSelection {
                    selection: new_selection,
                },
            ) => Ok(UIState::Navigation {
                core: core.clone(),
                selection: None,
                modal: Some(NavigationModal::Visual {
                    mode: *mode,
                    anchor: *anchor,
                    selection: new_selection.clone(),
                }),
            }),

            // Resize mode actions
            (NavigationModal::Resize { target, sizes }, Action::UpdateResize { delta }) => {
                let mut new_sizes = *sizes;
                new_sizes.current_size =
                    (new_sizes.current_size as i32 + *delta as i32).max(1) as u32;
                new_sizes.current_position += delta;

                Ok(UIState::Navigation {
                    core: core.clone(),
                    selection,
                    modal: Some(NavigationModal::Resize {
                        target: *target,
                        sizes: new_sizes,
                    }),
                })
            }

            // Default: preserve current state
            _ => Ok(UIState::Navigation {
                core: core.clone(),
                selection,
                modal: Some(modal),
            }),
        }
    }

    fn handle_editing(&self, state: &UIState, action: &Action) -> Result<UIState> {
        // Extract editing state components
        let (core, value, cursor_pos, mode, visual_selection, insert_variant) = match state {
            UIState::Editing {
                core,
                value,
                cursor_pos,
                mode,
                visual_selection,
                insert_variant,
            } => (
                core,
                value,
                *cursor_pos,
                *mode,
                visual_selection,
                *insert_variant,
            ),
            _ => {
                return Err(gridcore_core::SpreadsheetError::Parse(
                    "Invalid state for editing handler".to_string(),
                ))
            }
        };
        match action {
            // Exit editing
            Action::ExitToNavigation | Action::SubmitCellEdit { .. } => Ok(UIState::Navigation {
                core: core.clone(),
                selection: None,
                modal: None,
            }),

            // Text input
            Action::InsertCharacterAtCursor { character } => {
                let mut new_value = value.clone();
                new_value.insert(cursor_pos, *character);
                Ok(UIState::Editing {
                    core: core.clone(),
                    value: new_value,
                    cursor_pos: cursor_pos + 1,
                    mode,
                    visual_selection: visual_selection.clone(),
                    insert_variant,
                })
            }

            // Delete character
            Action::DeleteCharacterAtCursor { forward } => {
                let mut new_value = value.clone();
                let new_cursor_pos = if *forward {
                    // Delete forward
                    if cursor_pos < value.len() {
                        new_value.remove(cursor_pos);
                    }
                    cursor_pos
                } else {
                    // Backspace
                    if cursor_pos > 0 {
                        new_value.remove(cursor_pos - 1);
                        cursor_pos - 1
                    } else {
                        cursor_pos
                    }
                };
                Ok(UIState::Editing {
                    core: core.clone(),
                    value: new_value,
                    cursor_pos: new_cursor_pos,
                    mode,
                    visual_selection: visual_selection.clone(),
                    insert_variant,
                })
            }

            // Update editing cursor
            Action::UpdateEditingCursor { cursor_position } => {
                let new_cursor_pos = (*cursor_position).min(value.len());
                Ok(UIState::Editing {
                    core: core.clone(),
                    value: value.clone(),
                    cursor_pos: new_cursor_pos,
                    mode,
                    visual_selection: visual_selection.clone(),
                    insert_variant,
                })
            }

            // Enter/Exit insert mode
            Action::EnterInsertMode { mode: insert_mode } => Ok(UIState::Editing {
                core: core.clone(),
                value: value.clone(),
                cursor_pos,
                mode: EditMode::Insert,
                visual_selection: visual_selection.clone(),
                insert_variant: *insert_mode,
            }),

            Action::ExitInsertMode => Ok(UIState::Editing {
                core: core.clone(),
                value: value.clone(),
                cursor_pos,
                mode: EditMode::Normal,
                visual_selection: visual_selection.clone(),
                insert_variant: None,
            }),

            // Default: preserve current state
            _ => Ok(UIState::Editing {
                core: core.clone(),
                value: value.clone(),
                cursor_pos,
                mode,
                visual_selection: visual_selection.clone(),
                insert_variant,
            }),
        }
    }
}

impl Default for StateTransitionHandler {
    fn default() -> Self {
        Self::new()
    }
}
