#[cfg(test)]
#[allow(clippy::module_inception)]
mod edge_case_tests {
    use super::super::*;
    use gridcore_core::types::CellAddress;
    use std::sync::{Arc, Mutex};

    #[test]
    fn test_maximum_history_size() {
        let mut machine = UIStateMachine::new(None);

        // Perform many transitions to exceed max history
        for i in 0..150 {
            let cursor = CellAddress::new(i % 10, i / 10);
            machine.transition(Action::UpdateCursor { cursor }).expect("State transition should succeed in test");
        }

        // History should be capped at max size (100)
        let history = machine.get_history();
        assert!(history.len() <= 100);
        assert!(history.len() > 50); // Should have kept recent history
    }

    #[test]
    fn test_concurrent_state_transitions() {
        use std::sync::Arc;
        use std::thread;

        let machine = Arc::new(Mutex::new(UIStateMachine::new(None)));
        let mut handles = vec![];

        // Try concurrent transitions (should be serialized by mutex)
        for i in 0..10 {
            let machine_clone = Arc::clone(&machine);
            let handle = thread::spawn(move || {
                let mut m = machine_clone
                    .lock()
                    .expect("Test mutex should not be poisoned");
                m.transition(Action::UpdateCursor {
                    cursor: CellAddress::new(i, i),
                })
                .ok();
            });
            handles.push(handle);
        }

        for handle in handles {
            handle.join().expect("Thread should join successfully in test");
        }

        // Machine should still be in valid state
        let m = machine.lock().expect("Test mutex should not be poisoned");
        assert!(matches!(m.get_state(), UIState::Navigation { .. }));
    }

    #[test]
    fn test_invalid_state_recovery() {
        let mut machine = UIStateMachine::new(None);

        // Try invalid transition
        let result = machine.transition(Action::ExitInsertMode);
        assert!(result.is_err());

        // Machine should still be usable
        machine.transition(Action::EnterCommandMode).expect("State transition should succeed in test");
        assert!(matches!(machine.get_state(), UIState::Command { .. }));
    }

    #[test]
    fn test_memory_limits_for_editing_values() {
        let mut machine = UIStateMachine::new(None);

        // Start editing with very long initial value
        let long_string = "a".repeat(100_000);
        machine
            .transition(Action::StartEditing {
                edit_mode: Some(InsertMode::I),
                initial_value: Some(long_string.clone()),
                cursor_position: Some(50_000),
            })
            .expect("State transition should succeed in test");

        match machine.get_state() {
            UIState::Editing {
                editing_value,
                cursor_position,
                ..
            } => {
                assert_eq!(editing_value.len(), 100_000);
                assert_eq!(*cursor_position, 50_000);
            }
            _ => panic!("Expected editing state"),
        }

        // Update with even longer value
        let longer_string = "b".repeat(500_000);
        machine
            .transition(Action::UpdateEditingValue {
                value: longer_string.clone(),
                cursor_position: 250_000,
            })
            .expect("State transition should succeed in test");

        match machine.get_state() {
            UIState::Editing { editing_value, .. } => {
                assert_eq!(editing_value.len(), 500_000);
            }
            _ => panic!("Expected editing state"),
        }
    }

    #[test]
    fn test_viewport_boundary_conditions() {
        let mut machine = UIStateMachine::new(None);

        // Test maximum viewport dimensions
        let huge_viewport = ViewportInfo {
            start_row: u32::MAX - 100,
            start_col: u32::MAX - 100,
            rows: 100,
            cols: 100,
        };

        machine
            .transition(Action::UpdateViewport {
                viewport: huge_viewport,
            })
            .expect("State transition should succeed in test");

        assert_eq!(machine.get_state().viewport(), &huge_viewport);

        // Test zero-sized viewport
        let zero_viewport = ViewportInfo {
            start_row: 0,
            start_col: 0,
            rows: 0,
            cols: 0,
        };

        machine
            .transition(Action::UpdateViewport {
                viewport: zero_viewport,
            })
            .expect("State transition should succeed in test");

        assert_eq!(machine.get_state().viewport(), &zero_viewport);
    }

    #[test]
    fn test_cursor_at_max_coordinates() {
        let mut machine = UIStateMachine::new(None);

        // Move cursor to maximum coordinates
        let max_cursor = CellAddress::new(u32::MAX, u32::MAX);
        machine
            .transition(Action::UpdateCursor { cursor: max_cursor })
            .expect("State transition should succeed in test");

        assert_eq!(machine.get_state().cursor(), &max_cursor);

        // Ensure we can still perform other operations
        machine.transition(Action::EnterCommandMode).expect("State transition should succeed in test");
        assert!(matches!(machine.get_state(), UIState::Command { .. }));
    }

    #[test]
    fn test_rapid_mode_switching() {
        let mut machine = UIStateMachine::new(None);

        // Rapidly switch between modes
        for _ in 0..100 {
            machine.transition(Action::EnterCommandMode).expect("State transition should succeed in test");
            machine.transition(Action::Escape).expect("State transition should succeed in test");
            machine
                .transition(Action::StartEditing {
                    edit_mode: Some(InsertMode::I),
                    initial_value: None,
                    cursor_position: None,
                })
                .expect("State transition should succeed in test");
            machine.transition(Action::Escape).expect("State transition should succeed in test"); // To normal mode
            machine.transition(Action::Escape).expect("State transition should succeed in test"); // To navigation
        }

        // Should end in navigation mode
        assert!(matches!(machine.get_state(), UIState::Navigation { .. }));

        // History should be capped
        assert!(machine.get_history().len() <= 100);
    }

    #[test]
    fn test_selection_with_extreme_ranges() {
        let mut machine = UIStateMachine::new(None);

        // Create selection spanning entire possible range
        let huge_selection = Selection {
            selection_type: SelectionType::Range {
                start: CellAddress::new(0, 0),
                end: CellAddress::new(u32::MAX, u32::MAX),
            },
            anchor: Some(CellAddress::new(u32::MAX / 2, u32::MAX / 2)),
        };

        machine
            .transition(Action::EnterSpreadsheetVisualMode {
                visual_mode: SpreadsheetVisualMode::Block,
                selection: huge_selection.clone(),
            })
            .expect("State transition should succeed in test");

        match machine.get_state() {
            UIState::Visual { selection, .. } => {
                assert_eq!(*selection, huge_selection);
            }
            _ => panic!("Expected visual state"),
        }
    }

    #[test]
    fn test_empty_command_execution() {
        let mut machine = UIStateMachine::new(None);

        // Enter command mode
        machine.transition(Action::EnterCommandMode).expect("State transition should succeed in test");

        // Try to execute empty command (should be allowed)
        machine
            .transition(Action::UpdateCommandValue {
                value: "".to_string(),
            })
            .expect("State transition should succeed in test");

        // Exit command mode
        machine.transition(Action::ExitCommandMode).expect("State transition should succeed in test");
        assert!(matches!(machine.get_state(), UIState::Navigation { .. }));
    }

    #[test]
    fn test_listener_removal_during_notification() {
        let mut machine = UIStateMachine::new(None);
        let removed = Arc::new(Mutex::new(false));
        let removed_clone = removed.clone();

        // Add listener that removes itself
        let listener_id = machine.subscribe(move |_, _| {
            let mut r = removed_clone
                .lock()
                .expect("Test mutex should not be poisoned");
            *r = true;
        });

        // Perform transition
        machine.transition(Action::EnterCommandMode).expect("State transition should succeed in test");

        // Check listener was called
        assert!(*removed.lock().expect("Test mutex should not be poisoned"));

        // Remove listener
        machine.unsubscribe(listener_id);

        // Reset flag
        *removed.lock().expect("Test mutex should not be poisoned") = false;

        // Another transition shouldn't trigger removed listener
        machine.transition(Action::ExitCommandMode).expect("State transition should succeed in test");
        assert!(!*removed.lock().expect("Test mutex should not be poisoned"));
    }

    #[test]
    fn test_special_characters_in_values() {
        let mut machine = UIStateMachine::new(None);

        // Test with various special characters
        let special_chars = "🎉 \n\r\t\0 \\\"'`<>&";

        machine
            .transition(Action::StartEditing {
                edit_mode: Some(InsertMode::I),
                initial_value: Some(special_chars.to_string()),
                cursor_position: Some(5),
            })
            .expect("State transition should succeed in test");

        match machine.get_state() {
            UIState::Editing { editing_value, .. } => {
                assert_eq!(editing_value, special_chars);
            }
            _ => panic!("Expected editing state"),
        }

        // Test command with special characters
        machine.transition(Action::Escape).expect("State transition should succeed in test");
        machine.transition(Action::Escape).expect("State transition should succeed in test");
        machine.transition(Action::EnterCommandMode).expect("State transition should succeed in test");
        machine
            .transition(Action::UpdateCommandValue {
                value: special_chars.to_string(),
            })
            .expect("State transition should succeed in test");

        match machine.get_state() {
            UIState::Command { command_value, .. } => {
                assert_eq!(command_value, special_chars);
            }
            _ => panic!("Expected command state"),
        }
    }

    #[test]
    fn test_state_machine_reset() {
        let mut machine = UIStateMachine::new(None);

        // Put machine in complex state
        machine
            .transition(Action::UpdateCursor {
                cursor: CellAddress::new(10, 20),
            })
            .expect("State transition should succeed in test");

        machine
            .transition(Action::StartEditing {
                edit_mode: Some(InsertMode::A),
                initial_value: Some("test".to_string()),
                cursor_position: Some(2),
            })
            .expect("State transition should succeed in test");

        // Clear history
        machine.clear_history();
        assert_eq!(machine.get_history().len(), 0);

        // Exit to navigation
        machine.transition(Action::Escape).expect("State transition should succeed in test");
        machine.transition(Action::Escape).expect("State transition should succeed in test");

        // Create new machine with initial state
        let initial_state = UIState::create_navigation_state(
            CellAddress::new(0, 0),
            ViewportInfo {
                start_row: 0,
                start_col: 0,
                rows: 20,
                cols: 10,
            },
        );

        let new_machine = UIStateMachine::new(Some(initial_state));
        assert_eq!(new_machine.get_state().cursor(), &CellAddress::new(0, 0));
    }
}
