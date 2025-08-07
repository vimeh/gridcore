#[cfg(test)]
mod complex_transition_tests {
    use super::super::*;
    use gridcore_core::types::CellAddress;

    #[test]
    fn test_vim_workflow_navigation_to_edit_to_visual() {
        let mut machine = UIStateMachine::new(None);

        // Navigate to a cell
        machine
            .transition(Action::UpdateCursor {
                cursor: CellAddress::new(5, 5),
            })
            .unwrap();

        // Start editing with 'i'
        machine
            .transition(Action::StartEditing {
                edit_mode: Some(InsertMode::I),
                initial_value: Some("Hello".to_string()),
                cursor_position: Some(0),
            })
            .unwrap();

        // Type some text
        machine
            .transition(Action::UpdateEditingValue {
                value: "Hello World".to_string(),
                cursor_position: 11,
            })
            .unwrap();

        // Enter visual mode within cell
        machine
            .transition(Action::EnterVisualMode {
                visual_type: VisualMode::Character,
                anchor: Some(6),
            })
            .unwrap();

        match machine.get_state() {
            UIState::Editing {
                cell_mode,
                visual_type,
                visual_start,
                cursor_position,
                ..
            } => {
                assert_eq!(*cell_mode, CellMode::Visual);
                assert_eq!(*visual_type, Some(VisualMode::Character));
                assert_eq!(*visual_start, Some(6));
                assert_eq!(*cursor_position, 11);
            }
            _ => panic!("Expected editing state with visual mode"),
        }

        // Escape back through modes
        machine.transition(Action::ExitVisualMode).unwrap(); // To normal
        machine.transition(Action::Escape).unwrap(); // To navigation

        assert!(matches!(machine.get_state(), UIState::Navigation { .. }));
    }

    #[test]
    fn test_nested_mode_transitions() {
        let mut machine = UIStateMachine::new(None);

        // Navigation -> Command -> Navigation -> Visual -> Navigation
        machine.transition(Action::EnterCommandMode).unwrap();
        machine
            .transition(Action::UpdateCommandValue {
                value: ":set number".to_string(),
            })
            .unwrap();
        machine.transition(Action::ExitCommandMode).unwrap();

        let selection = Selection {
            selection_type: SelectionType::Range {
                start: CellAddress::new(0, 0),
                end: CellAddress::new(5, 5),
            },
            anchor: Some(CellAddress::new(0, 0)),
        };

        machine
            .transition(Action::EnterSpreadsheetVisualMode {
                visual_mode: SpreadsheetVisualMode::Line,
                selection: selection.clone(),
            })
            .unwrap();

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
            .unwrap();

        machine
            .transition(Action::ExitSpreadsheetVisualMode)
            .unwrap();

        assert!(matches!(machine.get_state(), UIState::Navigation { .. }));
    }

    #[test]
    fn test_multi_step_vim_commands() {
        let mut machine = UIStateMachine::new(None);

        // Simulate "5j" (move down 5 lines)
        let start = machine.get_state().cursor().clone();
        for _ in 0..5 {
            let current = machine.get_state().cursor().clone();
            machine
                .transition(Action::UpdateCursor {
                    cursor: CellAddress::new(current.col, current.row + 1),
                })
                .unwrap();
        }

        let end = machine.get_state().cursor();
        assert_eq!(end.row, start.row + 5);
        assert_eq!(end.col, start.col);

        // Simulate "3l2k" (move right 3, up 2)
        for _ in 0..3 {
            let current = machine.get_state().cursor().clone();
            machine
                .transition(Action::UpdateCursor {
                    cursor: CellAddress::new(current.col + 1, current.row),
                })
                .unwrap();
        }

        for _ in 0..2 {
            let current = machine.get_state().cursor().clone();
            machine
                .transition(Action::UpdateCursor {
                    cursor: CellAddress::new(current.col, current.row.saturating_sub(1)),
                })
                .unwrap();
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
                .transition(Action::UpdateCursor {
                    cursor: pos.clone(),
                })
                .unwrap();
        }

        // Enter editing mode
        machine
            .transition(Action::StartEditing {
                edit_mode: Some(InsertMode::I),
                initial_value: Some("test".to_string()),
                cursor_position: Some(0),
            })
            .unwrap();

        // Make changes
        machine
            .transition(Action::UpdateEditingValue {
                value: "test123".to_string(),
                cursor_position: 7,
            })
            .unwrap();

        // Exit editing
        machine.transition(Action::ExitToNavigation).unwrap();

        // History should contain all transitions
        let history = machine.get_history();
        assert!(history.len() >= 6);

        // Verify we can continue after all these transitions
        machine.transition(Action::EnterCommandMode).unwrap();
        assert!(matches!(machine.get_state(), UIState::Command { .. }));
    }

    #[test]
    fn test_bulk_operation_workflow() {
        let mut machine = UIStateMachine::new(None);

        // Start bulk operation
        let parsed_command = ParsedBulkCommand {
            command: ":format A1:Z100 bold".to_string(),
            operation: "format".to_string(),
            range_spec: "A1:Z100".to_string(),
            parameters: vec!["bold".to_string()],
        };

        machine
            .transition(Action::StartBulkOperation {
                parsed_command: parsed_command.clone(),
                affected_cells: Some(2600),
            })
            .unwrap();

        match machine.get_state() {
            UIState::BulkOperation {
                parsed_command: cmd,
                preview_available,
                ..
            } => {
                assert_eq!(*cmd, parsed_command);
                assert!(!preview_available);
            }
            _ => panic!("Expected bulk operation state"),
        }

        // Generate preview
        machine.transition(Action::GeneratePreview).unwrap();

        match machine.get_state() {
            UIState::BulkOperation {
                preview_available, ..
            } => {
                assert!(preview_available);
            }
            _ => panic!("Expected bulk operation state"),
        }

        // Execute operation
        machine.transition(Action::ExecuteBulkOperation).unwrap();
        assert!(matches!(machine.get_state(), UIState::Navigation { .. }));
    }

    #[test]
    fn test_interrupted_bulk_operation() {
        let mut machine = UIStateMachine::new(None);

        // Start bulk operation
        machine
            .transition(Action::StartBulkOperation {
                parsed_command: ParsedBulkCommand {
                    command: ":delete A:A".to_string(),
                    operation: "delete".to_string(),
                    range_spec: "A:A".to_string(),
                    parameters: vec![],
                },
                affected_cells: None,
            })
            .unwrap();

        // Generate preview
        machine.transition(Action::GeneratePreview).unwrap();

        // Cancel instead of executing
        machine.transition(Action::CancelBulkOperation).unwrap();

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
            .unwrap();

        match machine.get_state() {
            UIState::Resize {
                target,
                current_position,
                ..
            } => {
                assert_eq!(*target, ResizeTarget::Column { index: 5 });
                assert_eq!(*current_position, 100.0);
            }
            _ => panic!("Expected resize state"),
        }

        // Update resize position
        machine
            .transition(Action::UpdateResize { delta: 50.0 })
            .unwrap();

        match machine.get_state() {
            UIState::Resize {
                current_position, ..
            } => {
                assert_eq!(*current_position, 150.0);
            }
            _ => panic!("Expected resize state"),
        }

        // Complete resize
        machine.transition(Action::ConfirmResize).unwrap();
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
            .unwrap();

        match machine.get_state() {
            UIState::Insert {
                insert_type,
                position,
                reference,
                count,
                ..
            } => {
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
            .unwrap();

        // Confirm insert
        machine.transition(Action::ConfirmInsert).unwrap();
        assert!(matches!(machine.get_state(), UIState::Navigation { .. }));

        // Start delete mode
        machine
            .transition(Action::StartDelete {
                targets: vec![0, 1, 2],
                delete_type: DeleteType::Column,
            })
            .unwrap();

        match machine.get_state() {
            UIState::Delete {
                targets,
                delete_type,
                ..
            } => {
                assert_eq!(*targets, vec![0, 1, 2]);
                assert_eq!(*delete_type, DeleteType::Column);
            }
            _ => panic!("Expected delete state"),
        }

        // Cancel delete
        machine.transition(Action::CancelDelete).unwrap();
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
                visual_mode: SpreadsheetVisualMode::Char,
                selection: initial_selection,
            })
            .unwrap();

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
            .unwrap();

        // Change to line mode
        machine
            .transition(Action::ChangeVisualMode {
                new_mode: SpreadsheetVisualMode::Line,
            })
            .unwrap();

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
            .unwrap();

        match machine.get_state() {
            UIState::Visual {
                visual_mode,
                selection,
                ..
            } => {
                assert_eq!(*visual_mode, SpreadsheetVisualMode::Line);
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
        machine.transition(Action::EnterCommandMode).unwrap();

        // Build complex command character by character
        let command = ":s/foo/bar/g";
        for (i, _) in command.chars().enumerate() {
            machine
                .transition(Action::UpdateCommandValue {
                    value: command[..=i].to_string(),
                })
                .unwrap();
        }

        match machine.get_state() {
            UIState::Command { command_value, .. } => {
                assert_eq!(command_value, command);
            }
            _ => panic!("Expected command state"),
        }

        // Exit and re-enter with different command
        machine.transition(Action::ExitCommandMode).unwrap();
        machine.transition(Action::EnterCommandMode).unwrap();

        // Try range command
        let range_command = ":1,100d";
        machine
            .transition(Action::UpdateCommandValue {
                value: range_command.to_string(),
            })
            .unwrap();

        match machine.get_state() {
            UIState::Command { command_value, .. } => {
                assert_eq!(command_value, range_command);
            }
            _ => panic!("Expected command state"),
        }
    }
}
