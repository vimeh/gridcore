#[cfg(test)]
mod refactoring_tests {
    use crate::state::{
        Action, BulkOperationStatus, CoreState, DeleteType, EditMode, InsertMode, InsertPosition,
        InsertType, ModalKind, NavigationModal, ParsedBulkCommand, ResizeTarget, Selection,
        SelectionType, UIState, UIStateMachine, ViewportInfo, VisualMode,
    };
    use gridcore_core::types::CellAddress;

    #[test]
    fn test_core_state_shared_between_modes() {
        let mut machine = UIStateMachine::new(None);
        let new_cursor = CellAddress::new(5, 10);

        // Update cursor in Navigation
        machine
            .transition(Action::UpdateCursor { cursor: new_cursor })
            .unwrap();
        assert_eq!(machine.get_state().cursor(), &new_cursor);

        // Enter editing mode
        machine
            .transition(Action::StartEditing {
                edit_mode: None,
                initial_value: None,
                cursor_position: None,
            })
            .unwrap();

        // Cursor should be preserved
        assert_eq!(machine.get_state().cursor(), &new_cursor);

        // Update cursor in editing
        let another_cursor = CellAddress::new(7, 12);
        machine
            .transition(Action::UpdateCursor {
                cursor: another_cursor,
            })
            .unwrap();
        assert_eq!(machine.get_state().cursor(), &another_cursor);

        // Exit to navigation
        machine.transition(Action::ExitToNavigation).unwrap();
        // Cursor should still be preserved
        assert_eq!(machine.get_state().cursor(), &another_cursor);
    }

    #[test]
    fn test_two_variant_state_structure() {
        let viewport = ViewportInfo {
            start_row: 0,
            start_col: 0,
            rows: 20,
            cols: 10,
        };

        let state_navigation = UIState::Navigation {
            core: CoreState::new(CellAddress::new(0, 0), viewport),
            selection: None,
            modal: None,
        };

        let state_editing = UIState::Editing {
            core: CoreState::new(CellAddress::new(0, 0), viewport),
            value: String::new(),
            cursor_pos: 0,
            mode: EditMode::Normal,
            visual_selection: None,
            insert_variant: None,
        };

        // Verify only two variants exist
        assert!(matches!(state_navigation, UIState::Navigation { .. }));
        assert!(matches!(state_editing, UIState::Editing { .. }));
    }

    #[test]
    fn test_modal_consolidation_in_navigation() {
        let mut machine = UIStateMachine::new(None);

        // Test Command modal
        machine.transition(Action::EnterCommandMode).unwrap();
        assert!(machine.get_state().is_modal(ModalKind::Command));

        machine.transition(Action::ExitCommandMode).unwrap();

        // Test Visual modal
        let selection = Selection {
            selection_type: SelectionType::Cell {
                address: CellAddress::new(0, 0),
            },
            anchor: None,
        };
        machine
            .transition(Action::EnterSpreadsheetVisualMode {
                visual_mode: VisualMode::Character,
                selection,
            })
            .unwrap();
        assert!(machine.get_state().is_modal(ModalKind::Visual));

        machine
            .transition(Action::ExitSpreadsheetVisualMode)
            .unwrap();

        // Test Resize modal
        machine
            .transition(Action::StartResize {
                target: ResizeTarget::Column { index: 0 },
                initial_position: 100.0,
            })
            .unwrap();
        assert!(machine.get_state().is_modal(ModalKind::Resize));

        machine.transition(Action::ConfirmResize).unwrap();

        // Test Insert modal
        machine
            .transition(Action::StartInsert {
                insert_type: InsertType::Row,
                position: InsertPosition::Before,
                reference: 5,
            })
            .unwrap();
        assert!(machine.get_state().is_modal(ModalKind::Insert));

        machine.transition(Action::CancelInsert).unwrap();

        // Test Delete modal
        machine
            .transition(Action::StartDelete {
                targets: vec![1, 2, 3],
                delete_type: DeleteType::Row,
            })
            .unwrap();
        assert!(machine.get_state().is_modal(ModalKind::Delete));

        machine.transition(Action::CancelDelete).unwrap();

        // Test BulkOperation modal
        machine
            .transition(Action::StartBulkOperation {
                parsed_command: ParsedBulkCommand::Format {
                    format_type: "bold".to_string(),
                },
                affected_cells: Some(100),
            })
            .unwrap();
        assert!(machine.get_state().is_modal(ModalKind::BulkOperation));

        machine.transition(Action::CancelBulkOperation).unwrap();
    }

    #[test]
    fn test_visual_selection_in_editing_state() {
        let mut machine = UIStateMachine::new(None);

        // Enter editing mode
        machine
            .transition(Action::StartEditing {
                edit_mode: None,
                initial_value: Some("Hello World".to_string()),
                cursor_position: Some(5),
            })
            .unwrap();

        // Enter visual mode within editing
        machine
            .transition(Action::EnterVisualMode {
                visual_type: VisualMode::Character,
                anchor: Some(2),
            })
            .unwrap();

        match machine.get_state() {
            UIState::Editing {
                mode,
                visual_selection,
                cursor_pos,
                ..
            } => {
                assert_eq!(*mode, EditMode::Visual);
                assert!(visual_selection.is_some());
                let visual = visual_selection.as_ref().unwrap();
                assert_eq!(visual.mode, VisualMode::Character);
                assert_eq!(visual.start, 2);
                assert_eq!(*cursor_pos, 5);
            }
            _ => panic!("Expected editing state"),
        }

        // Exit visual mode
        machine.transition(Action::ExitVisualMode).unwrap();

        match machine.get_state() {
            UIState::Editing {
                mode,
                visual_selection,
                ..
            } => {
                assert_eq!(*mode, EditMode::Normal);
                assert!(visual_selection.is_none());
            }
            _ => panic!("Expected editing state"),
        }
    }

    #[test]
    fn test_consolidated_handler_coverage() {
        let mut machine = UIStateMachine::new(None);

        // Test transitions that should work
        let valid_transitions = vec![
            (
                Action::UpdateCursor {
                    cursor: CellAddress::new(1, 1),
                },
                true,
            ),
            (
                Action::UpdateViewport {
                    viewport: ViewportInfo {
                        start_row: 0,
                        start_col: 0,
                        rows: 20,
                        cols: 10,
                    },
                },
                true,
            ),
            (Action::EnterCommandMode, true),
            (Action::ExitCommandMode, true),
            (
                Action::StartEditing {
                    edit_mode: None,
                    initial_value: None,
                    cursor_position: None,
                },
                true,
            ),
            (Action::ExitToNavigation, true),
        ];

        for (action, should_succeed) in valid_transitions {
            let result = machine.transition(action.clone());
            assert_eq!(
                result.is_ok(),
                should_succeed,
                "Action {:?} should {} but {}",
                action,
                if should_succeed { "succeed" } else { "fail" },
                if result.is_ok() {
                    "succeeded"
                } else {
                    "failed"
                }
            );

            // Reset to navigation if needed
            if matches!(machine.get_state(), UIState::Editing { .. }) {
                machine.transition(Action::ExitToNavigation).unwrap();
            }
        }
    }

    #[test]
    fn test_invalid_action_rejection() {
        let mut machine = UIStateMachine::new(None);

        // Invalid actions in Navigation state
        assert!(machine
            .transition(Action::EnterInsertMode {
                mode: Some(InsertMode::I)
            })
            .is_err());
        assert!(machine.transition(Action::ExitInsertMode).is_err());
        assert!(machine
            .transition(Action::UpdateEditingValue {
                value: "test".to_string(),
                cursor_position: 0
            })
            .is_err());

        // Enter editing mode
        machine
            .transition(Action::StartEditing {
                edit_mode: None,
                initial_value: None,
                cursor_position: None,
            })
            .unwrap();

        // Invalid actions in Editing state
        assert!(machine.transition(Action::EnterCommandMode).is_err());
        assert!(machine
            .transition(Action::StartBulkOperation {
                parsed_command: ParsedBulkCommand::Clear {
                    clear_type: "all".to_string()
                },
                affected_cells: None,
            })
            .is_err());
    }

    #[test]
    fn test_modal_state_transitions() {
        let mut machine = UIStateMachine::new(None);

        // Enter command mode and update value
        machine.transition(Action::EnterCommandMode).unwrap();
        machine
            .transition(Action::UpdateCommandValue {
                value: ":w".to_string(),
            })
            .unwrap();

        match machine.get_state() {
            UIState::Navigation {
                modal: Some(NavigationModal::Command { value }),
                ..
            } => {
                assert_eq!(value, ":w");
            }
            _ => panic!("Expected command modal"),
        }

        // Escape should exit modal
        machine.transition(Action::Escape).unwrap();
        assert!(!machine.get_state().is_modal(ModalKind::Command));
    }

    #[test]
    fn test_bulk_operation_status_transitions() {
        let mut machine = UIStateMachine::new(None);

        // Start bulk operation
        machine
            .transition(Action::StartBulkOperation {
                parsed_command: ParsedBulkCommand::Format {
                    format_type: "bold".to_string(),
                },
                affected_cells: Some(50),
            })
            .unwrap();

        match machine.get_state() {
            UIState::Navigation {
                modal: Some(NavigationModal::BulkOperation { status, .. }),
                ..
            } => {
                assert_eq!(*status, BulkOperationStatus::Preparing);
            }
            _ => panic!("Expected bulk operation modal"),
        }

        // Generate preview
        machine.transition(Action::GeneratePreview).unwrap();

        match machine.get_state() {
            UIState::Navigation {
                modal: Some(NavigationModal::BulkOperation { status, .. }),
                ..
            } => {
                assert_eq!(*status, BulkOperationStatus::Previewing);
            }
            _ => panic!("Expected bulk operation modal"),
        }

        // Execute
        machine.transition(Action::ExecuteBulkOperation).unwrap();
        assert!(!machine.get_state().is_modal(ModalKind::BulkOperation));
    }

    #[test]
    fn test_resize_modal_updates() {
        let mut machine = UIStateMachine::new(None);

        machine
            .transition(Action::StartResize {
                target: ResizeTarget::Column { index: 5 },
                initial_position: 100.0,
            })
            .unwrap();

        match machine.get_state() {
            UIState::Navigation {
                modal: Some(NavigationModal::Resize { sizes, .. }),
                ..
            } => {
                assert_eq!(sizes.current_position, 100.0);
            }
            _ => panic!("Expected resize modal"),
        }

        // Update resize
        machine
            .transition(Action::UpdateResize { delta: 50.0 })
            .unwrap();

        match machine.get_state() {
            UIState::Navigation {
                modal: Some(NavigationModal::Resize { sizes, .. }),
                ..
            } => {
                assert_eq!(sizes.current_position, 150.0);
            }
            _ => panic!("Expected resize modal"),
        }
    }

    #[test]
    fn test_editing_mode_state_preservation() {
        let mut machine = UIStateMachine::new(None);

        // Start editing with specific state
        machine
            .transition(Action::StartEditing {
                edit_mode: Some(InsertMode::A),
                initial_value: Some("test".to_string()),
                cursor_position: Some(4),
            })
            .unwrap();

        match machine.get_state() {
            UIState::Editing {
                value,
                cursor_pos,
                mode,
                insert_variant,
                ..
            } => {
                assert_eq!(value, "test");
                assert_eq!(*cursor_pos, 4);
                assert_eq!(*mode, EditMode::Insert);
                assert_eq!(*insert_variant, Some(InsertMode::A));
            }
            _ => panic!("Expected editing state"),
        }

        // Update value
        machine
            .transition(Action::UpdateEditingValue {
                value: "test123".to_string(),
                cursor_position: 7,
            })
            .unwrap();

        match machine.get_state() {
            UIState::Editing {
                value, cursor_pos, ..
            } => {
                assert_eq!(value, "test123");
                assert_eq!(*cursor_pos, 7);
            }
            _ => panic!("Expected editing state"),
        }
    }
}
