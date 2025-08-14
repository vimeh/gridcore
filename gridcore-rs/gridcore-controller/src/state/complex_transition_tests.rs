#[cfg(test)]
#[allow(clippy::module_inception)]
mod complex_transition_tests {
    use super::super::*;
    use gridcore_core::types::CellAddress;
    use crate::state::{EditMode, ModalKind, ModalData, VisualMode};

    #[test]
    fn test_vim_workflow_navigation_to_edit_to_visual() {
        let mut machine = UIStateMachine::new(None);

        // Navigate to a cell
        machine
            .transition(Action::UpdateCursor {
                cursor: CellAddress::new(5, 5),
            })
            .expect("State transition should succeed in test");

        // Start editing with 'i'
        machine
            .transition(Action::StartEditing {
                edit_mode: Some(InsertMode::I),
                initial_value: Some("Hello".to_string()),
                cursor_position: Some(0),
            })
            .expect("State transition should succeed in test");

        // Type some text
        machine
            .transition(Action::UpdateEditingValue {
                value: "Hello World".to_string(),
                cursor_position: 11,
            })
            .expect("State transition should succeed in test");

        // Enter visual mode within cell
        machine
            .transition(Action::EnterVisualMode {
                visual_type: VisualMode::Character,
                anchor: Some(6),
            })
            .expect("State transition should succeed in test");

        match machine.get_state() {
            UIState::Editing {
                mode,
                visual_type,
                visual_start,
                cursor_pos,
                ..
            } => {
                assert_eq!(*mode, EditMode::Visual);
                assert_eq!(*visual_type, Some(VisualMode::Character));
                assert_eq!(*visual_start, Some(6));
                assert_eq!(*cursor_pos, 11);
            }
            _ => panic!("Expected editing state with visual mode"),
        }

        // Escape back through modes
        machine
            .transition(Action::ExitVisualMode)
            .expect("Transition should succeed in test"); // To normal
        machine
            .transition(Action::Escape)
            .expect("Transition should succeed in test"); // To navigation

        assert!(matches!(machine.get_state(), UIState::Navigation { .. }));
    }

    #[test]
    fn test_nested_mode_transitions() {
        let mut machine = UIStateMachine::new(None);

        // Navigation -> Command -> Navigation -> Visual -> Navigation
        machine
            .transition(Action::EnterCommandMode)
            .expect("Transition should succeed in test");
        machine
            .transition(Action::UpdateCommandValue {
                value: ":set number".to_string(),
            })
            .expect("State transition should succeed in test");
        machine
            .transition(Action::ExitCommandMode)
            .expect("Transition should succeed in test");

        let selection = Selection {
            selection_type: SelectionType::Range {
                start: CellAddress::new(0, 0),
                end: CellAddress::new(5, 5),
            },
            anchor: Some(CellAddress::new(0, 0)),
        };

        machine
            .transition(Action::EnterSpreadsheetVisualMode {
                visual_mode: VisualMode::Line,
                selection: selection.clone(),
            })
            .expect("State transition should succeed in test");

        machine
            .transition(Action::UpdateSelection {
                selection: Selection {
                    selection_type: SelectionType::Range {
                        start: CellAddress::new(0, 0),
                        end: CellAddress::new(10, 10),
                    },
                    anchor: Some(CellAddress::new(0, 0)),
                },
            })
            .expect("State transition should succeed in test");

        machine
            .transition(Action::ExitSpreadsheetVisualMode)
            .expect("State transition should succeed in test");

        assert!(matches!(machine.get_state(), UIState::Navigation { .. }));
    }

    #[test]
    fn test_multi_step_vim_commands() {
        let mut machine = UIStateMachine::new(None);

        // Simulate "5j" (move down 5 lines)
        let start = *machine.get_state().cursor();
        for _ in 0..5 {
            let current = *machine.get_state().cursor();
            machine
                .transition(Action::UpdateCursor {
                    cursor: CellAddress::new(current.col, current.row + 1),
                })
                .expect("State transition should succeed in test");
        }

        let end = machine.get_state().cursor();
        assert_eq!(end.row, start.row + 5);
        assert_eq!(end.col, start.col);

        // Simulate "3l2k" (move right 3, up 2)
        for _ in 0..3 {
            let current = *machine.get_state().cursor();
            machine
                .transition(Action::UpdateCursor {
                    cursor: CellAddress::new(current.col + 1, current.row),
                })
                .expect("State transition should succeed in test");
        }

        for _ in 0..2 {
            let current = *machine.get_state().cursor();
            machine
                .transition(Action::UpdateCursor {
                    cursor: CellAddress::new(current.col, current.row.saturating_sub(1)),
                })
                .expect("State transition should succeed in test");
        }

        let final_pos = machine.get_state().cursor();
        assert_eq!(final_pos.row, start.row + 3);
        assert_eq!(final_pos.col, start.col + 3);
    }

    #[test]
    fn test_undo_redo_with_state_transitions() {
        let mut machine = UIStateMachine::new(None);

        // Build up history
        let positions = vec![
            CellAddress::new(1, 1),
            CellAddress::new(2, 2),
            CellAddress::new(3, 3),
            CellAddress::new(4, 4),
        ];

        for pos in &positions {
            machine
                .transition(Action::UpdateCursor { cursor: *pos })
                .expect("State transition should succeed in test");
        }

        // Enter editing mode
        machine
            .transition(Action::StartEditing {
                edit_mode: Some(InsertMode::I),
                initial_value: Some("test".to_string()),
                cursor_position: Some(0),
            })
            .expect("State transition should succeed in test");

        // Make changes
        machine
            .transition(Action::UpdateEditingValue {
                value: "test123".to_string(),
                cursor_position: 7,
            })
            .expect("State transition should succeed in test");

        // Exit editing
        machine
            .transition(Action::ExitToNavigation)
            .expect("Transition should succeed in test");

        // History should contain all transitions
        let history = machine.get_history();
        assert!(history.len() >= 6);

        // Verify we can continue after all these transitions
        machine
            .transition(Action::EnterCommandMode)
            .expect("Transition should succeed in test");
        assert!(matches!(machine.get_state(), UIState::Modal { kind: ModalKind::Command, data: ModalData::Command { .. }, .. }));
    }

    #[test]
    fn test_bulk_operation_workflow() {
        let mut machine = UIStateMachine::new(None);

        // Start bulk operation
        let parsed_command = ParsedBulkCommand::Format {
            format_type: "bold".to_string(),
        };

        machine
            .transition(Action::StartBulkOperation {
                parsed_command: parsed_command.clone(),
                affected_cells: Some(2600),
            })
            .expect("State transition should succeed in test");

        match machine.get_state() {
            UIState::Modal { kind: ModalKind::BulkOperation, data: ModalData::BulkOperation {
                parsed_command: cmd,
                preview_available,
                ..
            }, .. } => {
                assert_eq!(*cmd, parsed_command);
                assert!(!preview_available);
            }
            _ => panic!("Expected bulk operation state"),
        }

        // Generate preview
        machine
            .transition(Action::GeneratePreview)
            .expect("Transition should succeed in test");

        match machine.get_state() {
            UIState::Modal { kind: ModalKind::BulkOperation, data: ModalData::BulkOperation {
                preview_available, ..
            }, .. } => {
                assert!(preview_available);
            }
            _ => panic!("Expected bulk operation state"),
        }

        // Execute operation
        machine
            .transition(Action::ExecuteBulkOperation)
            .expect("Transition should succeed in test");
        assert!(matches!(machine.get_state(), UIState::Navigation { .. }));
    }

    #[test]
    fn test_interrupted_bulk_operation() {
        let mut machine = UIStateMachine::new(None);

        // Start bulk operation
        machine
            .transition(Action::StartBulkOperation {
                parsed_command: ParsedBulkCommand::Clear {
                    clear_type: "all".to_string(),
                },
                affected_cells: None,
            })
            .expect("State transition should succeed in test");

        // Generate preview
        machine
            .transition(Action::GeneratePreview)
            .expect("Transition should succeed in test");

        // Cancel instead of executing
        machine
            .transition(Action::CancelBulkOperation)
            .expect("Transition should succeed in test");

        assert!(matches!(machine.get_state(), UIState::Navigation { .. }));
    }

    #[test]
    fn test_resize_mode_workflow() {
        let mut machine = UIStateMachine::new(None);

        // Start resize mode
        machine
            .transition(Action::StartResize {
                target: ResizeTarget::Column { index: 5 },
                initial_position: 100.0,
            })
            .expect("State transition should succeed in test");

        match machine.get_state() {
            UIState::Modal { kind: ModalKind::Resize, data: ModalData::Resize {
                target,
                sizes,
            }, .. } => {
                assert_eq!(*target, ResizeTarget::Column { index: 5 });
                assert_eq!(sizes.current_position, 100.0);
            }
            _ => panic!("Expected resize state"),
        }

        // Update resize position
        machine
            .transition(Action::UpdateResize { delta: 50.0 })
            .expect("State transition should succeed in test");

        match machine.get_state() {
            UIState::Modal { kind: ModalKind::Resize, data: ModalData::Resize {
                sizes, ..
            }, .. } => {
                assert_eq!(sizes.current_position, 150.0);
            }
            _ => panic!("Expected resize state"),
        }

        // Complete resize
        machine
            .transition(Action::ConfirmResize)
            .expect("Transition should succeed in test");
        assert!(matches!(machine.get_state(), UIState::Navigation { .. }));
    }

    #[test]
    fn test_insert_delete_workflow() {
        let mut machine = UIStateMachine::new(None);

        // Start insert mode
        machine
            .transition(Action::StartInsert {
                insert_type: InsertType::Row,
                position: InsertPosition::Before,
                reference: 10,
            })
            .expect("State transition should succeed in test");

        match machine.get_state() {
            UIState::Modal { kind: ModalKind::Insert, data: ModalData::Insert {
                insert_type,
                position,
                reference,
                count,
                ..
            }, .. } => {
                assert_eq!(*insert_type, InsertType::Row);
                assert_eq!(*position, InsertPosition::Before);
                assert_eq!(*reference, 10);
                assert_eq!(*count, 1);
            }
            _ => panic!("Expected insert state"),
        }

        // Update count
        machine
            .transition(Action::UpdateInsertCount { count: 5 })
            .expect("State transition should succeed in test");

        // Confirm insert
        machine
            .transition(Action::ConfirmInsert)
            .expect("Transition should succeed in test");
        assert!(matches!(machine.get_state(), UIState::Navigation { .. }));

        // Start delete mode
        machine
            .transition(Action::StartDelete {
                targets: vec![0, 1, 2],
                delete_type: DeleteType::Column,
            })
            .expect("State transition should succeed in test");

        match machine.get_state() {
            UIState::Modal { kind: ModalKind::Delete, data: ModalData::Delete {
                targets,
                delete_type,
                ..
            }, .. } => {
                assert_eq!(*targets, vec![0, 1, 2]);
                assert_eq!(*delete_type, DeleteType::Column);
            }
            _ => panic!("Expected delete state"),
        }

        // Cancel delete
        machine
            .transition(Action::CancelDelete)
            .expect("Transition should succeed in test");
        assert!(matches!(machine.get_state(), UIState::Navigation { .. }));
    }

    #[test]
    fn test_complex_visual_selection_expansion() {
        let mut machine = UIStateMachine::new(None);

        // Start with cell selection
        let initial_selection = Selection {
            selection_type: SelectionType::Cell {
                address: CellAddress::new(5, 5),
            },
            anchor: None,
        };

        machine
            .transition(Action::EnterSpreadsheetVisualMode {
                visual_mode: VisualMode::Character,
                selection: initial_selection,
            })
            .expect("State transition should succeed in test");

        // Expand to range
        machine
            .transition(Action::UpdateSelection {
                selection: Selection {
                    selection_type: SelectionType::Range {
                        start: CellAddress::new(5, 5),
                        end: CellAddress::new(10, 10),
                    },
                    anchor: Some(CellAddress::new(5, 5)),
                },
            })
            .expect("State transition should succeed in test");

        // Change to line mode
        machine
            .transition(Action::ChangeVisualMode {
                new_mode: VisualMode::Line,
            })
            .expect("State transition should succeed in test");

        // Expand further
        machine
            .transition(Action::UpdateSelection {
                selection: Selection {
                    selection_type: SelectionType::Row {
                        rows: vec![5, 6, 7, 8, 9, 10],
                    },
                    anchor: Some(CellAddress::new(5, 5)),
                },
            })
            .expect("State transition should succeed in test");

        match machine.get_state() {
            UIState::Modal { kind: ModalKind::Visual, data: ModalData::Visual {
                visual_mode,
                selection,
                ..
            }, .. } => {
                assert_eq!(*visual_mode, VisualMode::Line);
                match &selection.selection_type {
                    SelectionType::Row { rows } => {
                        assert_eq!(rows.len(), 6);
                    }
                    _ => panic!("Expected row selection"),
                }
            }
            _ => panic!("Expected visual state"),
        }
    }

    #[test]
    fn test_command_mode_with_complex_commands() {
        let mut machine = UIStateMachine::new(None);

        // Enter command mode
        machine
            .transition(Action::EnterCommandMode)
            .expect("Transition should succeed in test");

        // Build complex command character by character
        let command = ":s/foo/bar/g";
        for (i, _) in command.char_indices() {
            machine
                .transition(Action::UpdateCommandValue {
                    value: command[..=i].to_string(),
                })
                .expect("State transition should succeed in test");
        }

        match machine.get_state() {
            UIState::Modal { kind: ModalKind::Command, data: ModalData::Command { value, .. }, .. } => {
                assert_eq!(value, command);
            }
            _ => panic!("Expected command state"),
        }

        // Exit and re-enter with different command
        machine
            .transition(Action::ExitCommandMode)
            .expect("Transition should succeed in test");
        machine
            .transition(Action::EnterCommandMode)
            .expect("Transition should succeed in test");

        // Try range command
        let range_command = ":1,100d";
        machine
            .transition(Action::UpdateCommandValue {
                value: range_command.to_string(),
            })
            .expect("State transition should succeed in test");

        match machine.get_state() {
            UIState::Modal { kind: ModalKind::Command, data: ModalData::Command { value, .. }, .. } => {
                assert_eq!(value, range_command);
            }
            _ => panic!("Expected command state"),
        }
    }
}
