#[cfg(test)]
#[allow(clippy::module_inception)]
mod tests {
    use super::super::*;
    use gridcore_core::types::CellAddress;
    use crate::state::{EditMode, ModalKind, ModalData, VisualMode};

    fn create_test_state_machine() -> UIStateMachine {
        UIStateMachine::new(None)
    }

    #[allow(dead_code)]
    fn create_test_viewport() -> ViewportInfo {
        ViewportInfo {
            start_row: 0,
            start_col: 0,
            rows: 20,
            cols: 10,
        }
    }

    #[test]
    fn test_initial_state() {
        let machine = create_test_state_machine();
        let state = machine.get_state();

        assert!(matches!(state, UIState::Navigation { .. }));
        assert_eq!(state.cursor(), &CellAddress::new(0, 0));
        assert_eq!(state.viewport().rows, 20);
        assert_eq!(state.viewport().cols, 10);
    }

    #[test]
    fn test_navigation_to_editing() {
        let mut machine = create_test_state_machine();

        // Start editing without insert mode
        let result = machine.transition(Action::StartEditing {
            edit_mode: None,
            initial_value: None,
            cursor_position: None,
        });

        assert!(result.is_ok());

        match machine.get_state() {
            UIState::Editing {
                mode,
                value,
                cursor_pos,
                ..
            } => {
                assert_eq!(*mode, EditMode::Normal);
                assert_eq!(value, "");
                assert_eq!(*cursor_pos, 0);
            }
            _ => panic!("Expected editing state"),
        }
    }

    #[test]
    fn test_navigation_to_editing_with_insert_mode() {
        let mut machine = create_test_state_machine();

        // Start editing in insert mode with initial value
        let result = machine.transition(Action::StartEditing {
            edit_mode: Some(InsertMode::I),
            initial_value: Some("test".to_string()),
            cursor_position: Some(2),
        });

        assert!(result.is_ok());

        match machine.get_state() {
            UIState::Editing {
                mode,
                value,
                cursor_pos,
                insert_variant,
                ..
            } => {
                assert_eq!(*mode, EditMode::Insert);
                assert_eq!(value, "test");
                assert_eq!(*cursor_pos, 2);
                assert_eq!(*insert_variant, Some(InsertMode::I));
            }
            _ => panic!("Expected editing state"),
        }
    }

    #[test]
    fn test_editing_mode_transitions() {
        let mut machine = create_test_state_machine();

        // Enter editing mode
        machine
            .transition(Action::StartEditing {
                edit_mode: None,
                initial_value: Some("hello".to_string()),
                cursor_position: Some(0),
            })
            .expect("State transition should succeed in test");

        // Enter insert mode
        let result = machine.transition(Action::EnterInsertMode {
            mode: Some(InsertMode::A),
        });
        assert!(result.is_ok());

        match machine.get_state() {
            UIState::Editing {
                mode,
                insert_variant,
                ..
            } => {
                assert_eq!(*mode, EditMode::Insert);
                assert_eq!(*insert_variant, Some(InsertMode::A));
            }
            _ => panic!("Expected editing state"),
        }

        // Exit insert mode
        machine
            .transition(Action::ExitInsertMode)
            .expect("State transition should succeed in test");

        match machine.get_state() {
            UIState::Editing {
                mode,
                insert_variant,
                ..
            } => {
                assert_eq!(*mode, EditMode::Normal);
                assert_eq!(*insert_variant, None);
            }
            _ => panic!("Expected editing state"),
        }
    }

    #[test]
    fn test_visual_mode_transitions() {
        let mut machine = create_test_state_machine();

        // Enter editing mode first
        machine
            .transition(Action::StartEditing {
                edit_mode: None,
                initial_value: Some("test content".to_string()),
                cursor_position: Some(5),
            })
            .expect("State transition should succeed in test");

        // Enter visual mode
        let result = machine.transition(Action::EnterVisualMode {
            visual_type: VisualMode::Character,
            anchor: Some(3),
        });
        assert!(result.is_ok());

        match machine.get_state() {
            UIState::Editing {
                mode,
                visual_type,
                visual_start,
                ..
            } => {
                assert_eq!(*mode, EditMode::Visual);
                assert_eq!(*visual_type, Some(VisualMode::Character));
                assert_eq!(*visual_start, Some(3));
            }
            _ => panic!("Expected editing state"),
        }

        // Exit visual mode
        machine
            .transition(Action::ExitVisualMode)
            .expect("State transition should succeed in test");

        match machine.get_state() {
            UIState::Editing {
                mode,
                visual_type,
                visual_start,
                ..
            } => {
                assert_eq!(*mode, EditMode::Normal);
                assert_eq!(*visual_type, None);
                assert_eq!(*visual_start, None);
            }
            _ => panic!("Expected editing state"),
        }
    }

    #[test]
    fn test_command_mode() {
        let mut machine = create_test_state_machine();

        // Enter command mode
        let result = machine.transition(Action::EnterCommandMode);
        assert!(result.is_ok());

        match machine.get_state() {
            UIState::Modal {
                kind: ModalKind::Command,
                data: ModalData::Command { value },
                ..
            } => {
                assert_eq!(value, "");
            }
            _ => panic!("Expected command state"),
        }

        // Update command value
        machine
            .transition(Action::UpdateCommandValue {
                value: ":w".to_string(),
            })
            .expect("State transition should succeed in test");

        match machine.get_state() {
            UIState::Modal {
                kind: ModalKind::Command,
                data: ModalData::Command { value },
                ..
            } => {
                assert_eq!(value, ":w");
            }
            _ => panic!("Expected command state"),
        }

        // Exit command mode
        machine
            .transition(Action::ExitCommandMode)
            .expect("State transition should succeed in test");
        assert!(matches!(machine.get_state(), UIState::Navigation { .. }));
    }

    #[test]
    fn test_spreadsheet_visual_mode() {
        let mut machine = create_test_state_machine();

        let selection = Selection {
            selection_type: SelectionType::Cell {
                address: CellAddress::new(0, 0),
            },
            anchor: None,
        };

        // Enter spreadsheet visual mode
        let result = machine.transition(Action::EnterSpreadsheetVisualMode {
            visual_mode: VisualMode::Block,
            selection: selection.clone(),
        });
        assert!(result.is_ok());

        match machine.get_state() {
            UIState::Modal {
                kind: ModalKind::Visual,
                data: ModalData::Visual {
                    visual_mode,
                    selection: sel,
                    ..
                },
                ..
            } => {
                assert_eq!(*visual_mode, VisualMode::Block);
                assert_eq!(*sel, selection);
            }
            _ => panic!("Expected visual state"),
        }

        // Update selection
        let new_selection = Selection {
            selection_type: SelectionType::Range {
                start: CellAddress::new(0, 0),
                end: CellAddress::new(5, 5),
            },
            anchor: Some(CellAddress::new(0, 0)),
        };

        machine
            .transition(Action::UpdateSelection {
                selection: new_selection.clone(),
            })
            .expect("State transition should succeed in test");

        match machine.get_state() {
            UIState::Modal {
                kind: ModalKind::Visual,
                data: ModalData::Visual { selection, .. },
                ..
            } => {
                assert_eq!(*selection, new_selection);
            }
            _ => panic!("Expected visual state"),
        }

        // Exit visual mode
        machine
            .transition(Action::ExitSpreadsheetVisualMode)
            .expect("State transition should succeed in test");
        assert!(matches!(machine.get_state(), UIState::Navigation { .. }));
    }

    #[test]
    fn test_escape_handling() {
        let mut machine = create_test_state_machine();

        // Test escape in navigation (should do nothing)
        machine
            .transition(Action::Escape)
            .expect("State transition should succeed in test");
        assert!(matches!(machine.get_state(), UIState::Navigation { .. }));

        // Test escape in editing insert mode (should go to normal)
        machine
            .transition(Action::StartEditing {
                edit_mode: Some(InsertMode::I),
                initial_value: None,
                cursor_position: None,
            })
            .expect("State transition should succeed in test");

        machine
            .transition(Action::Escape)
            .expect("State transition should succeed in test");

        match machine.get_state() {
            UIState::Editing { mode, .. } => {
                assert_eq!(*mode, EditMode::Normal);
            }
            _ => panic!("Expected editing state"),
        }

        // Another escape should exit editing
        machine
            .transition(Action::Escape)
            .expect("State transition should succeed in test");
        assert!(matches!(machine.get_state(), UIState::Navigation { .. }));

        // Test escape in command mode
        machine
            .transition(Action::EnterCommandMode)
            .expect("State transition should succeed in test");
        machine
            .transition(Action::Escape)
            .expect("State transition should succeed in test");
        assert!(matches!(machine.get_state(), UIState::Navigation { .. }));

        // Test escape in spreadsheet visual mode
        machine
            .transition(Action::EnterSpreadsheetVisualMode {
                visual_mode: VisualMode::Block,
                selection: Selection {
                    selection_type: SelectionType::Cell {
                        address: CellAddress::new(0, 0),
                    },
                    anchor: None,
                },
            })
            .expect("State transition should succeed in test");
        machine
            .transition(Action::Escape)
            .expect("State transition should succeed in test");
        assert!(matches!(machine.get_state(), UIState::Navigation { .. }));
    }

    #[test]
    fn test_invalid_transitions() {
        let mut machine = create_test_state_machine();

        // Can't enter insert mode from navigation
        let result = machine.transition(Action::EnterInsertMode {
            mode: Some(InsertMode::I),
        });
        assert!(result.is_err());

        // Can't exit insert mode when not in insert mode
        let result = machine.transition(Action::ExitInsertMode);
        assert!(result.is_err());

        // Can't update editing value when not editing
        let result = machine.transition(Action::UpdateEditingValue {
            value: "test".to_string(),
            cursor_position: 0,
        });
        assert!(result.is_err());
    }

    #[test]
    fn test_update_cursor_and_viewport() {
        let mut machine = create_test_state_machine();

        let new_cursor = CellAddress::new(5, 10);
        machine
            .transition(Action::UpdateCursor { cursor: new_cursor })
            .expect("State transition should succeed in test");

        assert_eq!(machine.get_state().cursor(), &new_cursor);

        let new_viewport = ViewportInfo {
            start_row: 10,
            start_col: 5,
            rows: 30,
            cols: 15,
        };

        machine
            .transition(Action::UpdateViewport {
                viewport: new_viewport,
            })
            .expect("State transition should succeed in test");

        assert_eq!(machine.get_state().viewport(), &new_viewport);
    }

    #[test]
    fn test_history_tracking() {
        let mut machine = create_test_state_machine();

        // Perform several transitions
        machine
            .transition(Action::EnterCommandMode)
            .expect("State transition should succeed in test");
        machine
            .transition(Action::UpdateCommandValue {
                value: "test".to_string(),
            })
            .expect("State transition should succeed in test");
        machine
            .transition(Action::ExitCommandMode)
            .expect("State transition should succeed in test");

        let history = machine.get_history();
        assert_eq!(history.len(), 3);

        // Check first entry
        assert!(matches!(history[0].action, Action::EnterCommandMode));
        // Now we store diffs instead of full states, so check the diff
        // The first diff should be a Full transition from Navigation to Command
        assert!(matches!(
            history[0].diff,
            crate::state::diff::StateDiff::Full(_)
        ));

        // Check that timestamps are set (non-wasm)
        #[cfg(not(target_arch = "wasm32"))]
        assert!(history[0].timestamp > 0);
    }

    #[test]
    fn test_listener_notifications() {
        use std::sync::{Arc, Mutex};

        let mut machine = create_test_state_machine();
        let notifications = Arc::new(Mutex::new(Vec::new()));
        let notifications_clone = notifications.clone();

        machine.subscribe(move |state, _action| {
            let mut notifs = notifications_clone
                .lock()
                .expect("Test mutex should not be poisoned");
            notifs.push(format!("{:?}", state.spreadsheet_mode()));
        });

        machine
            .transition(Action::EnterCommandMode)
            .expect("State transition should succeed in test");
        machine
            .transition(Action::ExitCommandMode)
            .expect("State transition should succeed in test");

        let notifs = notifications
            .lock()
            .expect("Test mutex should not be poisoned");
        assert_eq!(notifs.len(), 2);
        assert_eq!(notifs[0], "Command");
        assert_eq!(notifs[1], "Navigation");
    }

    #[test]
    fn test_helper_methods() {
        let mut machine = create_test_state_machine();

        // Test start_editing_mode helper
        machine
            .start_editing_mode(Some(InsertMode::A), Some("test".to_string()), Some(2))
            .expect("Start editing mode should succeed in test");

        match machine.get_state() {
            UIState::Editing {
                value,
                cursor_pos,
                ..
            } => {
                assert_eq!(value, "test");
                assert_eq!(*cursor_pos, 2);
            }
            _ => panic!("Expected editing state"),
        }

        // Test exit_editing_mode helper
        machine
            .exit_editing_mode()
            .expect("Exit editing mode should succeed in test");
        assert!(matches!(machine.get_state(), UIState::Navigation { .. }));

        // Test spreadsheet visual mode helpers
        let selection = Selection {
            selection_type: SelectionType::Cell {
                address: CellAddress::new(1, 1),
            },
            anchor: None,
        };

        machine
            .enter_spreadsheet_visual_mode(VisualMode::Line, selection)
            .expect("Enter visual mode should succeed in test");

        assert!(matches!(machine.get_state(), UIState::Modal {
            kind: ModalKind::Visual,
            ..
        }));

        machine
            .exit_spreadsheet_visual_mode()
            .expect("Exit visual mode should succeed in test");
        assert!(matches!(machine.get_state(), UIState::Navigation { .. }));
    }
}
