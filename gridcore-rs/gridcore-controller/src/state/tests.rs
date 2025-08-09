#[cfg(test)]
mod tests {
    use super::super::*;
    use gridcore_core::types::CellAddress;

    fn create_test_state_machine() -> UIStateMachine {
        UIStateMachine::new(None)
    }

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
                cell_mode,
                editing_value,
                cursor_position,
                ..
            } => {
                assert_eq!(*cell_mode, CellMode::Normal);
                assert_eq!(editing_value, "");
                assert_eq!(*cursor_position, 0);
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
                cell_mode,
                editing_value,
                cursor_position,
                edit_variant,
                ..
            } => {
                assert_eq!(*cell_mode, CellMode::Insert);
                assert_eq!(editing_value, "test");
                assert_eq!(*cursor_position, 2);
                assert_eq!(*edit_variant, Some(InsertMode::I));
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
            .unwrap();

        // Enter insert mode
        let result = machine.transition(Action::EnterInsertMode {
            mode: Some(InsertMode::A),
        });
        assert!(result.is_ok());

        match machine.get_state() {
            UIState::Editing {
                cell_mode,
                edit_variant,
                ..
            } => {
                assert_eq!(*cell_mode, CellMode::Insert);
                assert_eq!(*edit_variant, Some(InsertMode::A));
            }
            _ => panic!("Expected editing state"),
        }

        // Exit insert mode
        machine.transition(Action::ExitInsertMode).unwrap();

        match machine.get_state() {
            UIState::Editing {
                cell_mode,
                edit_variant,
                ..
            } => {
                assert_eq!(*cell_mode, CellMode::Normal);
                assert_eq!(*edit_variant, None);
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
            .unwrap();

        // Enter visual mode
        let result = machine.transition(Action::EnterVisualMode {
            visual_type: VisualMode::Character,
            anchor: Some(3),
        });
        assert!(result.is_ok());

        match machine.get_state() {
            UIState::Editing {
                cell_mode,
                visual_type,
                visual_start,
                ..
            } => {
                assert_eq!(*cell_mode, CellMode::Visual);
                assert_eq!(*visual_type, Some(VisualMode::Character));
                assert_eq!(*visual_start, Some(3));
            }
            _ => panic!("Expected editing state"),
        }

        // Exit visual mode
        machine.transition(Action::ExitVisualMode).unwrap();

        match machine.get_state() {
            UIState::Editing {
                cell_mode,
                visual_type,
                visual_start,
                ..
            } => {
                assert_eq!(*cell_mode, CellMode::Normal);
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
            UIState::Command { command_value, .. } => {
                assert_eq!(command_value, "");
            }
            _ => panic!("Expected command state"),
        }

        // Update command value
        machine
            .transition(Action::UpdateCommandValue {
                value: ":w".to_string(),
            })
            .unwrap();

        match machine.get_state() {
            UIState::Command { command_value, .. } => {
                assert_eq!(command_value, ":w");
            }
            _ => panic!("Expected command state"),
        }

        // Exit command mode
        machine.transition(Action::ExitCommandMode).unwrap();
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
            visual_mode: SpreadsheetVisualMode::Block,
            selection: selection.clone(),
        });
        assert!(result.is_ok());

        match machine.get_state() {
            UIState::Visual {
                visual_mode,
                selection: sel,
                ..
            } => {
                assert_eq!(*visual_mode, SpreadsheetVisualMode::Block);
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
            .unwrap();

        match machine.get_state() {
            UIState::Visual { selection, .. } => {
                assert_eq!(*selection, new_selection);
            }
            _ => panic!("Expected visual state"),
        }

        // Exit visual mode
        machine
            .transition(Action::ExitSpreadsheetVisualMode)
            .unwrap();
        assert!(matches!(machine.get_state(), UIState::Navigation { .. }));
    }

    #[test]
    fn test_escape_handling() {
        let mut machine = create_test_state_machine();

        // Test escape in navigation (should do nothing)
        machine.transition(Action::Escape).unwrap();
        assert!(matches!(machine.get_state(), UIState::Navigation { .. }));

        // Test escape in editing insert mode (should go to normal)
        machine
            .transition(Action::StartEditing {
                edit_mode: Some(InsertMode::I),
                initial_value: None,
                cursor_position: None,
            })
            .unwrap();

        machine.transition(Action::Escape).unwrap();

        match machine.get_state() {
            UIState::Editing { cell_mode, .. } => {
                assert_eq!(*cell_mode, CellMode::Normal);
            }
            _ => panic!("Expected editing state"),
        }

        // Another escape should exit editing
        machine.transition(Action::Escape).unwrap();
        assert!(matches!(machine.get_state(), UIState::Navigation { .. }));

        // Test escape in command mode
        machine.transition(Action::EnterCommandMode).unwrap();
        machine.transition(Action::Escape).unwrap();
        assert!(matches!(machine.get_state(), UIState::Navigation { .. }));

        // Test escape in spreadsheet visual mode
        machine
            .transition(Action::EnterSpreadsheetVisualMode {
                visual_mode: SpreadsheetVisualMode::Block,
                selection: Selection {
                    selection_type: SelectionType::Cell {
                        address: CellAddress::new(0, 0),
                    },
                    anchor: None,
                },
            })
            .unwrap();
        machine.transition(Action::Escape).unwrap();
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
            .transition(Action::UpdateCursor {
                cursor: new_cursor.clone(),
            })
            .unwrap();

        assert_eq!(machine.get_state().cursor(), &new_cursor);

        let new_viewport = ViewportInfo {
            start_row: 10,
            start_col: 5,
            rows: 30,
            cols: 15,
        };

        machine
            .transition(Action::UpdateViewport {
                viewport: new_viewport.clone(),
            })
            .unwrap();

        assert_eq!(machine.get_state().viewport(), &new_viewport);
    }

    #[test]
    fn test_history_tracking() {
        let mut machine = create_test_state_machine();

        // Perform several transitions
        machine.transition(Action::EnterCommandMode).unwrap();
        machine
            .transition(Action::UpdateCommandValue {
                value: "test".to_string(),
            })
            .unwrap();
        machine.transition(Action::ExitCommandMode).unwrap();

        let history = machine.get_history();
        assert_eq!(history.len(), 3);

        // Check first entry
        assert!(matches!(history[0].action, Action::EnterCommandMode));
        assert!(matches!(history[0].state, UIState::Navigation { .. }));

        // Check that timestamps are set
        assert!(history[0].timestamp > 0);
    }

    #[test]
    fn test_listener_notifications() {
        use std::sync::{Arc, Mutex};

        let mut machine = create_test_state_machine();
        let notifications = Arc::new(Mutex::new(Vec::new()));
        let notifications_clone = notifications.clone();

        machine.subscribe(move |state, _action| {
            let mut notifs = notifications_clone.lock().unwrap();
            notifs.push(format!("{:?}", state.spreadsheet_mode()));
        });

        machine.transition(Action::EnterCommandMode).unwrap();
        machine.transition(Action::ExitCommandMode).unwrap();

        let notifs = notifications.lock().unwrap();
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
            .unwrap();

        match machine.get_state() {
            UIState::Editing {
                editing_value,
                cursor_position,
                ..
            } => {
                assert_eq!(editing_value, "test");
                assert_eq!(*cursor_position, 2);
            }
            _ => panic!("Expected editing state"),
        }

        // Test exit_editing_mode helper
        machine.exit_editing_mode().unwrap();
        assert!(matches!(machine.get_state(), UIState::Navigation { .. }));

        // Test spreadsheet visual mode helpers
        let selection = Selection {
            selection_type: SelectionType::Cell {
                address: CellAddress::new(1, 1),
            },
            anchor: None,
        };

        machine
            .enter_spreadsheet_visual_mode(SpreadsheetVisualMode::Line, selection)
            .unwrap();

        assert!(matches!(machine.get_state(), UIState::Visual { .. }));

        machine.exit_spreadsheet_visual_mode().unwrap();
        assert!(matches!(machine.get_state(), UIState::Navigation { .. }));
    }
}
