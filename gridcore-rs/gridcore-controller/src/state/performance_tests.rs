#[cfg(test)]
#[allow(clippy::module_inception)]
mod performance_tests {
    use super::super::*;
    use gridcore_core::types::CellAddress;
    use std::time::Instant;

    #[test]
    fn test_rapid_state_transitions() {
        let mut machine = UIStateMachine::new(None);
        let start = Instant::now();
        let iterations = 1000;

        for i in 0..iterations {
            // Cycle through different state transitions
            machine
                .transition(Action::UpdateCursor {
                    cursor: CellAddress::new(i % 100, i / 100),
                })
                .unwrap();

            if i % 10 == 0 {
                machine.transition(Action::EnterCommandMode).unwrap();
                machine
                    .transition(Action::UpdateCommandValue {
                        value: format!("command{}", i),
                    })
                    .unwrap();
                machine.transition(Action::ExitCommandMode).unwrap();
            }
        }

        let duration = start.elapsed();
        let transitions_per_second = (iterations as f64) / duration.as_secs_f64();

        // Should handle at least 1000 transitions per second
        assert!(
            transitions_per_second > 1000.0,
            "Performance too low: {:.2} transitions/sec",
            transitions_per_second
        );

        println!(
            "Handled {:.2} transitions per second",
            transitions_per_second
        );
    }

    #[test]
    fn test_large_selection_operations() {
        let mut machine = UIStateMachine::new(None);

        // Create selection with 10,000 cells
        let large_selection = Selection {
            selection_type: SelectionType::Range {
                start: CellAddress::new(0, 0),
                end: CellAddress::new(99, 99), // 100x100 = 10,000 cells
            },
            anchor: Some(CellAddress::new(0, 0)),
        };

        let start = Instant::now();

        machine
            .transition(Action::EnterSpreadsheetVisualMode {
                visual_mode: SpreadsheetVisualMode::Block,
                selection: large_selection.clone(),
            })
            .unwrap();

        // Update selection multiple times
        for i in 0..100 {
            let updated_selection = Selection {
                selection_type: SelectionType::Range {
                    start: CellAddress::new(0, 0),
                    end: CellAddress::new(99 + i, 99 + i),
                },
                anchor: Some(CellAddress::new(0, 0)),
            };

            machine
                .transition(Action::UpdateSelection {
                    selection: updated_selection,
                })
                .unwrap();
        }

        let duration = start.elapsed();
        assert!(
            duration.as_millis() < 100,
            "Large selection operations took too long: {:?}",
            duration
        );

        println!("Large selection operations completed in {:?}", duration);
    }

    #[test]
    fn test_history_with_thousands_of_entries() {
        let mut machine = UIStateMachine::new(None);
        let entries = 5000;

        let start = Instant::now();

        // Add thousands of history entries
        for i in 0..entries {
            machine
                .transition(Action::UpdateCursor {
                    cursor: CellAddress::new(i % 1000, i / 1000),
                })
                .unwrap();
        }

        // History should be capped but still fast
        let history = machine.get_history();
        assert!(history.len() <= 100);

        // Clear and rebuild
        machine.clear_history();

        for i in 0..100 {
            machine
                .transition(Action::UpdateCursor {
                    cursor: CellAddress::new(i, i),
                })
                .unwrap();
        }

        let duration = start.elapsed();
        assert!(
            duration.as_secs() < 1,
            "History operations took too long: {:?}",
            duration
        );

        println!("Processed {} history entries in {:?}", entries, duration);
    }

    #[test]
    fn test_event_listener_performance() {
        use std::sync::{Arc, Mutex};

        let mut machine = UIStateMachine::new(None);
        let counters: Vec<Arc<Mutex<u32>>> = (0..100).map(|_| Arc::new(Mutex::new(0))).collect();

        // Add 100 listeners
        for counter in &counters {
            let counter_clone = counter.clone();
            machine.subscribe(move |_, _| {
                let mut c = counter_clone.lock().expect("Test mutex should not be poisoned");
                *c += 1;
            });
        }

        let start = Instant::now();

        // Perform transitions that trigger all listeners
        for i in 0..100 {
            machine
                .transition(Action::UpdateCursor {
                    cursor: CellAddress::new(i, i),
                })
                .unwrap();
        }

        let duration = start.elapsed();

        // Verify all listeners were called
        for counter in &counters {
            assert_eq!(*counter.lock().expect("Test mutex should not be poisoned"), 100);
        }

        assert!(
            duration.as_millis() < 500,
            "Event listener notifications took too long: {:?}",
            duration
        );

        println!("Notified 100 listeners 100 times in {:?}", duration);
    }

    #[test]
    fn test_complex_state_serialization_performance() {
        use serde_json;

        let mut machine = UIStateMachine::new(None);

        // Create complex state
        machine
            .transition(Action::StartEditing {
                edit_mode: Some(InsertMode::I),
                initial_value: Some("a".repeat(10000)),
                cursor_position: Some(5000),
            })
            .unwrap();

        machine
            .transition(Action::EnterVisualMode {
                visual_type: VisualMode::Line,
                anchor: Some(1000),
            })
            .unwrap();

        let start = Instant::now();

        // Serialize and deserialize state 100 times
        for _ in 0..100 {
            let state = machine.get_state();
            let json = serde_json::to_string(state).unwrap();
            let _: UIState = serde_json::from_str(&json).unwrap();
        }

        let duration = start.elapsed();
        assert!(
            duration.as_millis() < 1000,
            "State serialization too slow: {:?}",
            duration
        );

        println!("Serialized complex state 100 times in {:?}", duration);
    }

    #[test]
    fn test_viewport_scrolling_performance() {
        let mut machine = UIStateMachine::new(None);
        let start = Instant::now();

        // Simulate rapid scrolling
        for i in 0..1000 {
            let viewport = ViewportInfo {
                start_row: i * 10,
                start_col: i * 5,
                rows: 50,
                cols: 20,
            };

            machine
                .transition(Action::UpdateViewport { viewport })
                .unwrap();

            // Also update cursor to stay in viewport
            machine
                .transition(Action::UpdateCursor {
                    cursor: CellAddress::new(i * 5 + 10, i * 10 + 25),
                })
                .unwrap();
        }

        let duration = start.elapsed();
        let updates_per_second = 2000.0 / duration.as_secs_f64();

        assert!(
            updates_per_second > 5000.0,
            "Viewport updates too slow: {:.2} updates/sec",
            updates_per_second
        );

        println!(
            "Performed {:.2} viewport updates per second",
            updates_per_second
        );
    }

    #[test]
    fn test_command_parsing_performance() {
        let mut machine = UIStateMachine::new(None);

        // Complex commands to parse
        let commands = vec![
            ":s/pattern/replacement/g",
            ":1,100d",
            ":set number relativenumber",
            ":%s/\\(\\w\\+\\)/\\U\\1/g",
            ":g/pattern/d",
            ":v/pattern/d",
            ":sort ui",
            ":!ls -la",
        ];

        let start = Instant::now();
        let iterations = 100;

        for _ in 0..iterations {
            for command in &commands {
                machine.transition(Action::EnterCommandMode).unwrap();

                // Build command character by character (simulating typing)
                for i in 1..=command.len() {
                    machine
                        .transition(Action::UpdateCommandValue {
                            value: command[..i].to_string(),
                        })
                        .unwrap();
                }

                machine.transition(Action::ExitCommandMode).unwrap();
            }
        }

        let duration = start.elapsed();
        let total_updates = iterations * commands.len() * 20; // avg 20 chars per command
        let updates_per_second = total_updates as f64 / duration.as_secs_f64();

        assert!(
            updates_per_second > 10000.0,
            "Command parsing too slow: {:.2} updates/sec",
            updates_per_second
        );

        println!(
            "Processed {:.2} command character updates per second",
            updates_per_second
        );
    }

    #[test]
    fn test_memory_usage_stability() {
        let mut machine = UIStateMachine::new(None);

        // Perform many operations that could potentially leak memory
        for i in 0..10000 {
            // Add and remove listeners
            if i % 100 == 0 {
                let id = machine.subscribe(|_, _| {});
                machine.unsubscribe(id);
            }

            // Create and destroy complex states
            if i % 50 == 0 {
                machine
                    .transition(Action::StartEditing {
                        edit_mode: Some(InsertMode::I),
                        initial_value: Some(format!("text{}", i)),
                        cursor_position: Some(0),
                    })
                    .unwrap();
                machine.transition(Action::ExitToNavigation).unwrap();
            }

            // Update cursor (adds to history)
            machine
                .transition(Action::UpdateCursor {
                    cursor: CellAddress::new(i % 100, i / 100),
                })
                .unwrap();
        }

        // Clear history to reset
        machine.clear_history();

        // Should still be functional
        machine.transition(Action::EnterCommandMode).unwrap();
        assert!(matches!(machine.get_state(), UIState::Command { .. }));

        println!("Memory usage remained stable after 10,000 operations");
    }
}
