#[cfg(test)]
#[allow(clippy::module_inception)]
mod tests {
    use crate::controller::events::{MouseButton, MouseEventType};
    use crate::controller::{KeyboardEvent, MouseEvent, SpreadsheetController};
    use crate::state::{Action, InsertMode, SpreadsheetMode, UIState};
    use gridcore_core::types::CellAddress;

    #[test]
    fn test_controller_initialization() {
        let controller = SpreadsheetController::new();
        assert!(matches!(controller.get_state(), UIState::Navigation { .. }));
    }

    #[test]
    fn test_keyboard_navigation() {
        let mut controller = SpreadsheetController::new();

        // Test arrow key navigation
        let event = KeyboardEvent::new("j".to_string());
        controller.handle_keyboard_event(event).unwrap();

        // Cursor should have moved down
        let cursor = controller.get_state().cursor();
        assert_eq!(cursor.row, 1);
        assert_eq!(cursor.col, 0);

        // Test horizontal movement
        let event = KeyboardEvent::new("l".to_string());
        controller.handle_keyboard_event(event).unwrap();

        let cursor = controller.get_state().cursor();
        assert_eq!(cursor.row, 1);
        assert_eq!(cursor.col, 1);
    }

    #[test]
    fn test_mode_transitions() {
        let mut controller = SpreadsheetController::new();

        // Enter editing mode using StartEditing action (since 'i' key is handled by UI)
        controller
            .dispatch_action(Action::StartEditing {
                edit_mode: Some(crate::state::InsertMode::I),
                initial_value: Some(String::new()),
                cursor_position: Some(0),
            })
            .unwrap();
        assert_eq!(
            controller.get_state().spreadsheet_mode(),
            SpreadsheetMode::Insert // StartEditing with InsertMode creates Insert state
        );

        // In Insert mode, escape should go back to Editing
        let event = KeyboardEvent::new("Escape".to_string());
        controller.handle_keyboard_event(event).unwrap();
        assert_eq!(
            controller.get_state().spreadsheet_mode(),
            SpreadsheetMode::Editing
        );

        // From Editing mode, escape should go to Navigation
        let event = KeyboardEvent::new("Escape".to_string());
        controller.handle_keyboard_event(event).unwrap();
        assert_eq!(
            controller.get_state().spreadsheet_mode(),
            SpreadsheetMode::Navigation
        );

        // Enter command mode
        let event = KeyboardEvent::new(":".to_string());
        controller.handle_keyboard_event(event).unwrap();
        assert_eq!(
            controller.get_state().spreadsheet_mode(),
            SpreadsheetMode::Command
        );
    }

    #[test]
    fn test_editing_mode_variants() {
        let mut controller = SpreadsheetController::new();

        // Test 'i' for insert
        controller
            .handle_keyboard_event(KeyboardEvent::new("i".to_string()))
            .unwrap();
        if let UIState::Editing { insert_variant, .. } = controller.get_state() {
            assert_eq!(*insert_variant, Some(InsertMode::I));
        }

        // Return to navigation
        controller
            .handle_keyboard_event(KeyboardEvent::new("Escape".to_string()))
            .unwrap();

        // Test 'a' for append
        controller
            .handle_keyboard_event(KeyboardEvent::new("a".to_string()))
            .unwrap();
        if let UIState::Editing { insert_variant, .. } = controller.get_state() {
            assert_eq!(*insert_variant, Some(InsertMode::A));
        }
    }

    #[test]
    fn test_mouse_click_handling() {
        let mut controller = SpreadsheetController::new();

        // Click at specific coordinates
        let event = MouseEvent::new(150.0, 150.0, MouseButton::Left, MouseEventType::Click);
        controller.handle_mouse_event(event).unwrap();

        // Should update cursor position based on click
        // In a real implementation, this would calculate the cell from coordinates
        assert!(matches!(controller.get_state(), UIState::Navigation { .. }));
    }

    #[test]
    fn test_event_subscription() {
        let mut controller = SpreadsheetController::new();

        use std::sync::{Arc, Mutex};
        let received_events = Arc::new(Mutex::new(Vec::new()));
        let events_clone = received_events.clone();

        // Subscribe to events
        let index = controller.subscribe_to_events(move |event| {
            events_clone
                .lock()
                .expect("Test mutex should not be poisoned")
                .push(format!("{:?}", event));
        });

        // Trigger a mode change
        controller
            .dispatch_action(Action::EnterCommandMode)
            .unwrap();

        // Should have received a mode change event
        let events = received_events
            .lock()
            .expect("Test mutex should not be poisoned");
        assert!(!events.is_empty());

        // Unsubscribe
        controller.unsubscribe_from_events(index);
    }

    #[test]
    fn test_facade_integration() {
        let mut controller = SpreadsheetController::new();

        // Set a cell value through the facade
        let addr = CellAddress::new(0, 0);
        controller
            .get_facade_mut()
            .set_cell_value(&addr, "100")
            .unwrap();

        // Retrieve the value
        let cell = controller.get_facade().get_cell(&addr);
        assert!(cell.is_some());
        if let Some(cell) = cell {
            assert_eq!(cell.get_display_value().to_string(), "100");
        }
    }

    #[test]
    fn test_viewport_management() {
        let controller = SpreadsheetController::new();

        // Get viewport info from state
        let viewport = controller.get_state().viewport();

        // Should have default viewport
        assert_eq!(viewport.start_row, 0);
        assert_eq!(viewport.start_col, 0);
        assert!(viewport.rows > 0);
        assert!(viewport.cols > 0);
    }

    #[test]
    fn test_command_mode_input() {
        let mut controller = SpreadsheetController::new();

        // Enter command mode
        controller
            .handle_keyboard_event(KeyboardEvent::new(":".to_string()))
            .unwrap();

        // Type command characters
        controller
            .handle_keyboard_event(KeyboardEvent::new("w".to_string()))
            .unwrap();
        controller
            .handle_keyboard_event(KeyboardEvent::new("q".to_string()))
            .unwrap();

        // Check command value
        if let UIState::Modal {
            kind: crate::state::ModalKind::Command,
            data: crate::state::ModalData::Command { value },
            ..
        } = controller.get_state() {
            assert!(value.contains("wq"));
        }
    }

    #[test]
    fn test_action_dispatch() {
        let mut controller = SpreadsheetController::new();

        // Dispatch a cursor update action
        let new_cursor = CellAddress::new(5, 5);
        controller
            .dispatch_action(Action::UpdateCursor { cursor: new_cursor })
            .unwrap();

        // Verify cursor was updated
        let cursor = controller.get_state().cursor();
        assert_eq!(cursor.col, 5);
        assert_eq!(cursor.row, 5);
    }

    #[test]
    fn test_complex_keyboard_sequence() {
        let mut controller = SpreadsheetController::new();

        // Simulate vim-like navigation sequence
        // 5j - move down 5 times
        for _ in 0..5 {
            controller
                .handle_keyboard_event(KeyboardEvent::new("j".to_string()))
                .unwrap();
        }

        let cursor = controller.get_state().cursor();
        assert_eq!(cursor.row, 5);

        // 3l - move right 3 times
        for _ in 0..3 {
            controller
                .handle_keyboard_event(KeyboardEvent::new("l".to_string()))
                .unwrap();
        }

        let cursor = controller.get_state().cursor();
        assert_eq!(cursor.col, 3);
        assert_eq!(cursor.row, 5);
    }

    #[test]
    fn test_modifiers_handling() {
        let _controller = SpreadsheetController::new();

        // Create event with modifiers
        let event = KeyboardEvent::new("s".to_string()).with_modifiers(false, true, false, false); // Ctrl+S

        assert!(event.ctrl);
        assert!(!event.shift);
        assert!(!event.alt);
        assert!(!event.meta);
    }
}
