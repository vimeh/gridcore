use crate::state::{
    actions::Action, CoreState, EditMode, NavigationModal, Selection, UIState, VisualSelection,
};
use gridcore_core::Result;

/// Consolidated handler for all state transitions
pub struct StateTransitionHandler;

impl StateTransitionHandler {
    pub fn new() -> Self {
        Self
    }

    pub fn handle(&self, state: &UIState, action: &Action) -> Result<UIState> {
        // Handle core actions that work in any state
        match action {
            Action::UpdateCursor { cursor } => match state {
                UIState::Navigation {
                    core,
                    selection,
                    modal,
                } => {
                    let mut new_core = core.clone();
                    new_core.cursor = *cursor;
                    return Ok(UIState::Navigation {
                        core: new_core,
                        selection: selection.clone(),
                        modal: modal.clone(),
                    });
                }
                UIState::Editing {
                    core,
                    value,
                    cursor_pos,
                    mode,
                    visual_selection,
                    insert_variant,
                } => {
                    let mut new_core = core.clone();
                    new_core.cursor = *cursor;
                    return Ok(UIState::Editing {
                        core: new_core,
                        value: value.clone(),
                        cursor_pos: *cursor_pos,
                        mode: *mode,
                        visual_selection: visual_selection.clone(),
                        insert_variant: *insert_variant,
                    });
                }
            },
            Action::UpdateViewport { viewport } => match state {
                UIState::Navigation {
                    core,
                    selection,
                    modal,
                } => {
                    let mut new_core = core.clone();
                    new_core.viewport = *viewport;
                    return Ok(UIState::Navigation {
                        core: new_core,
                        selection: selection.clone(),
                        modal: modal.clone(),
                    });
                }
                UIState::Editing {
                    core,
                    value,
                    cursor_pos,
                    mode,
                    visual_selection,
                    insert_variant,
                } => {
                    let mut new_core = core.clone();
                    new_core.viewport = *viewport;
                    return Ok(UIState::Editing {
                        core: new_core,
                        value: value.clone(),
                        cursor_pos: *cursor_pos,
                        mode: *mode,
                        visual_selection: visual_selection.clone(),
                        insert_variant: *insert_variant,
                    });
                }
            },
            _ => {} // Fall through to state-specific handling
        }

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

            // Start bulk operation
            Action::StartBulkOperation {
                parsed_command,
                affected_cells: _,
            } => Ok(UIState::Navigation {
                core: core.clone(),
                selection,
                modal: Some(NavigationModal::BulkOperation {
                    command: parsed_command.clone(),
                    status: crate::state::BulkOperationStatus::Preparing,
                }),
            }),

            // Start resize
            Action::StartResize {
                target,
                initial_position,
            } => {
                let resize_index = match target {
                    crate::state::ResizeTarget::Column { index }
                    | crate::state::ResizeTarget::Row { index } => *index,
                };
                Ok(UIState::Navigation {
                    core: core.clone(),
                    selection,
                    modal: Some(NavigationModal::Resize {
                        target: *target,
                        sizes: crate::state::ResizeSizes {
                            original_size: 100, // Default value
                            current_size: 100,
                            initial_position: *initial_position,
                            current_position: *initial_position,
                            resize_index,
                        },
                    }),
                })
            }

            // Start insert
            Action::StartInsert {
                insert_type,
                position,
                reference,
            } => Ok(UIState::Navigation {
                core: core.clone(),
                selection,
                modal: Some(NavigationModal::Insert {
                    config: crate::state::InsertConfig {
                        insert_type: *insert_type,
                        position: *position,
                        reference: *reference,
                        count: 1,
                        target_index: *reference, // Use reference as target_index
                    },
                }),
            }),

            // Start delete
            Action::StartDelete {
                targets,
                delete_type,
            } => Ok(UIState::Navigation {
                core: core.clone(),
                selection,
                modal: Some(NavigationModal::Delete {
                    config: crate::state::DeleteConfig {
                        targets: targets.clone(),
                        delete_type: *delete_type,
                        selection: targets.clone(), // Use targets as selection
                        confirmation_pending: false,
                    },
                }),
            }),

            // Handle modal-specific actions
            _ => {
                if let Some(modal) = modal {
                    self.handle_modal_action(core, selection, modal, action)
                } else {
                    // Check for invalid actions in Navigation state
                    match action {
                        Action::EnterInsertMode { .. }
                        | Action::ExitInsertMode
                        | Action::UpdateEditingValue { .. }
                        | Action::UpdateEditingCursor { .. }
                        | Action::InsertCharacterAtCursor { .. }
                        | Action::DeleteCharacterAtCursor { .. }
                        | Action::EnterVisualMode { .. }
                        | Action::ExitVisualMode => Err(gridcore_core::SpreadsheetError::Parse(
                            "Invalid action for Navigation state".to_string(),
                        )),
                        _ => Ok(UIState::Navigation {
                            core: core.clone(),
                            selection,
                            modal: None,
                        }),
                    }
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

            // Bulk operation actions
            (NavigationModal::BulkOperation { command, .. }, Action::GeneratePreview) => {
                Ok(UIState::Navigation {
                    core: core.clone(),
                    selection,
                    modal: Some(NavigationModal::BulkOperation {
                        command: command.clone(),
                        status: crate::state::BulkOperationStatus::Previewing,
                    }),
                })
            }

            (NavigationModal::BulkOperation { .. }, Action::ExecuteBulkOperation) => {
                // Exit modal after execution
                Ok(UIState::Navigation {
                    core: core.clone(),
                    selection,
                    modal: None,
                })
            }

            (NavigationModal::BulkOperation { .. }, Action::CancelBulkOperation) => {
                // Exit modal on cancel
                Ok(UIState::Navigation {
                    core: core.clone(),
                    selection,
                    modal: None,
                })
            }

            // Resize actions
            (NavigationModal::Resize { .. }, Action::ConfirmResize) => {
                // Exit modal after confirmation
                Ok(UIState::Navigation {
                    core: core.clone(),
                    selection,
                    modal: None,
                })
            }

            (NavigationModal::Resize { .. }, Action::CancelResize) => {
                // Exit modal on cancel
                Ok(UIState::Navigation {
                    core: core.clone(),
                    selection,
                    modal: None,
                })
            }

            // Insert actions
            (NavigationModal::Insert { config }, Action::UpdateInsertCount { count }) => {
                let mut new_config = config.clone();
                new_config.count = *count;
                Ok(UIState::Navigation {
                    core: core.clone(),
                    selection,
                    modal: Some(NavigationModal::Insert { config: new_config }),
                })
            }

            (NavigationModal::Insert { .. }, Action::ConfirmInsert) => {
                // Exit modal after confirmation
                Ok(UIState::Navigation {
                    core: core.clone(),
                    selection,
                    modal: None,
                })
            }

            (NavigationModal::Insert { .. }, Action::CancelInsert) => {
                // Exit modal on cancel
                Ok(UIState::Navigation {
                    core: core.clone(),
                    selection,
                    modal: None,
                })
            }

            // Delete actions
            (NavigationModal::Delete { .. }, Action::ConfirmDelete) => {
                // Exit modal after confirmation
                Ok(UIState::Navigation {
                    core: core.clone(),
                    selection,
                    modal: None,
                })
            }

            (NavigationModal::Delete { .. }, Action::CancelDelete) => {
                // Exit modal on cancel
                Ok(UIState::Navigation {
                    core: core.clone(),
                    selection,
                    modal: None,
                })
            }

            // Command mode - exit
            (NavigationModal::Command { .. }, Action::ExitCommandMode) => Ok(UIState::Navigation {
                core: core.clone(),
                selection,
                modal: None,
            }),

            // Visual mode - exit
            (NavigationModal::Visual { .. }, Action::ExitSpreadsheetVisualMode) => {
                Ok(UIState::Navigation {
                    core: core.clone(),
                    selection,
                    modal: None,
                })
            }

            // Visual mode - change mode
            (
                NavigationModal::Visual {
                    anchor,
                    selection: vis_selection,
                    ..
                },
                Action::ChangeVisualMode { new_mode },
            ) => Ok(UIState::Navigation {
                core: core.clone(),
                selection,
                modal: Some(NavigationModal::Visual {
                    mode: *new_mode,
                    anchor: *anchor,
                    selection: vis_selection.clone(),
                }),
            }),

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

            // Update editing value
            Action::UpdateEditingValue {
                value: new_value,
                cursor_position,
            } => Ok(UIState::Editing {
                core: core.clone(),
                value: new_value.clone(),
                cursor_pos: *cursor_position,
                mode,
                visual_selection: visual_selection.clone(),
                insert_variant,
            }),

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

            // Enter/Exit visual mode within editing
            Action::EnterVisualMode {
                visual_type,
                anchor,
            } => Ok(UIState::Editing {
                core: core.clone(),
                value: value.clone(),
                cursor_pos,
                mode: EditMode::Visual,
                visual_selection: Some(VisualSelection {
                    mode: *visual_type,
                    start: anchor.unwrap_or(cursor_pos),
                }),
                insert_variant,
            }),

            Action::ExitVisualMode => Ok(UIState::Editing {
                core: core.clone(),
                value: value.clone(),
                cursor_pos,
                mode: EditMode::Normal,
                visual_selection: None,
                insert_variant,
            }),

            // Escape handling
            Action::Escape => {
                if mode == EditMode::Normal {
                    // Exit to navigation
                    Ok(UIState::Navigation {
                        core: core.clone(),
                        selection: None,
                        modal: None,
                    })
                } else {
                    // Exit to normal mode
                    Ok(UIState::Editing {
                        core: core.clone(),
                        value: value.clone(),
                        cursor_pos,
                        mode: EditMode::Normal,
                        visual_selection: None,
                        insert_variant: None,
                    })
                }
            }

            // Default: check for invalid actions
            _ => {
                // Check for invalid actions in Editing state
                match action {
                    Action::EnterCommandMode
                    | Action::ExitCommandMode
                    | Action::UpdateCommandValue { .. }
                    | Action::EnterSpreadsheetVisualMode { .. }
                    | Action::ExitSpreadsheetVisualMode
                    | Action::UpdateSelection { .. }
                    | Action::ChangeVisualMode { .. }
                    | Action::StartBulkOperation { .. }
                    | Action::GeneratePreview
                    | Action::ExecuteBulkOperation
                    | Action::CancelBulkOperation
                    | Action::StartResize { .. }
                    | Action::UpdateResize { .. }
                    | Action::ConfirmResize
                    | Action::CancelResize
                    | Action::StartInsert { .. }
                    | Action::UpdateInsertCount { .. }
                    | Action::ConfirmInsert
                    | Action::CancelInsert
                    | Action::StartDelete { .. }
                    | Action::ConfirmDelete
                    | Action::CancelDelete => Err(gridcore_core::SpreadsheetError::Parse(
                        "Invalid action for Editing state".to_string(),
                    )),
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
    }
}

impl Default for StateTransitionHandler {
    fn default() -> Self {
        Self::new()
    }
}
