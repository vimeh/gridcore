#[cfg(test)]
mod controller_tests {
    use super::super::{KeyboardEvent, MouseEvent, SpreadsheetController};
    use crate::controller::events::{ErrorSeverity, MouseEventType};
    use crate::controller::mode::{CellEditMode, EditorMode};
    use crate::state::{InsertMode, SelectionType, VisualMode};
    use gridcore_core::types::CellAddress;

    // Helper functions
    fn create_controller() -> SpreadsheetController {
        SpreadsheetController::new()
    }

    fn key_event(key: &str) -> KeyboardEvent {
        KeyboardEvent::new(key.to_string())
    }

    fn mouse_click(x: f64, y: f64) -> MouseEvent {
        MouseEvent {
            x,
            y,
            event_type: MouseEventType::Click,
            button: crate::controller::events::MouseButton::Left,
            shift: false,
            ctrl: false,
            alt: false,
            meta: false,
        }
    }

    fn mouse_double_click(x: f64, y: f64) -> MouseEvent {
        MouseEvent {
            x,
            y,
            event_type: MouseEventType::DoubleClick,
            button: crate::controller::events::MouseButton::Left,
            shift: false,
            ctrl: false,
            alt: false,
            meta: false,
        }
    }

    #[test]
    fn test_basic_keyboard_handling() {
        let mut controller = create_controller();

        // Initial state should be Navigation
        assert!(matches!(controller.get_mode(), EditorMode::Navigation));

        // Press 'i' to enter insert mode
        controller.handle_keyboard_event(key_event("i")).unwrap();
        assert!(matches!(
            controller.get_mode(),
            EditorMode::CellEditing {
                mode: CellEditMode::Insert(_),
                ..
            }
        ));

        // Type some text
        controller.handle_keyboard_event(key_event("h")).unwrap();
        controller.handle_keyboard_event(key_event("e")).unwrap();
        controller.handle_keyboard_event(key_event("l")).unwrap();
        controller.handle_keyboard_event(key_event("l")).unwrap();
        controller.handle_keyboard_event(key_event("o")).unwrap();

        // Press Escape to go to normal mode
        controller
            .handle_keyboard_event(key_event("Escape"))
            .unwrap();
        assert!(matches!(
            controller.get_mode(),
            EditorMode::CellEditing {
                mode: CellEditMode::Normal,
                ..
            }
        ));

        // Press Escape again to go to Navigation
        controller
            .handle_keyboard_event(key_event("Escape"))
            .unwrap();
        assert!(matches!(controller.get_mode(), EditorMode::Navigation));
    }

    #[test]
    fn test_vim_navigation() {
        let mut controller = create_controller();

        // Initial position
        assert_eq!(controller.get_cursor(), CellAddress::new(0, 0));

        // Move down with 'j'
        controller.handle_keyboard_event(key_event("j")).unwrap();
        assert_eq!(controller.get_cursor(), CellAddress::new(0, 1));

        // Move right with 'l'
        controller.handle_keyboard_event(key_event("l")).unwrap();
        assert_eq!(controller.get_cursor(), CellAddress::new(1, 1));

        // Move up with 'k'
        controller.handle_keyboard_event(key_event("k")).unwrap();
        assert_eq!(controller.get_cursor(), CellAddress::new(1, 0));

        // Move left with 'h'
        controller.handle_keyboard_event(key_event("h")).unwrap();
        assert_eq!(controller.get_cursor(), CellAddress::new(0, 0));

        // Arrow keys should also work
        controller
            .handle_keyboard_event(key_event("ArrowDown"))
            .unwrap();
        assert_eq!(controller.get_cursor(), CellAddress::new(0, 1));

        controller
            .handle_keyboard_event(key_event("ArrowRight"))
            .unwrap();
        assert_eq!(controller.get_cursor(), CellAddress::new(1, 1));
    }

    #[test]
    fn test_formula_bar_behavior() {
        let mut controller = create_controller();

        // Set a value in a cell
        controller.handle_keyboard_event(key_event("i")).unwrap();
        controller.handle_keyboard_event(key_event("t")).unwrap();
        controller.handle_keyboard_event(key_event("e")).unwrap();
        controller.handle_keyboard_event(key_event("s")).unwrap();
        controller.handle_keyboard_event(key_event("t")).unwrap();

        // Get formula bar value during editing
        if let EditorMode::CellEditing { value, .. } = controller.get_mode() {
            assert_eq!(value, "test");
        } else {
            panic!("Should be in CellEditing mode");
        }

        // Exit editing
        controller
            .handle_keyboard_event(key_event("Escape"))
            .unwrap();
        controller
            .handle_keyboard_event(key_event("Escape"))
            .unwrap();

        // Formula bar should update when navigating
        controller.handle_keyboard_event(key_event("j")).unwrap();
        // The formula bar updates are handled by update_formula_bar_from_cursor
        // which reads from the sheet
    }

    #[test]
    fn test_visual_mode_selection() {
        let mut controller = create_controller();

        // Enter visual mode
        controller.handle_keyboard_event(key_event("v")).unwrap();
        assert!(matches!(
            controller.get_mode(),
            EditorMode::Visual {
                mode: VisualMode::Character,
                ..
            }
        ));

        // Should have initial selection
        assert!(controller.get_selection().is_some());
        let selection = controller.get_selection().unwrap();
        assert!(matches!(
            selection.selection_type,
            SelectionType::Cell { .. }
        ));

        // Move to extend selection
        controller.handle_keyboard_event(key_event("l")).unwrap();
        controller.handle_keyboard_event(key_event("j")).unwrap();

        let selection = controller.get_selection().unwrap();
        assert!(matches!(
            selection.selection_type,
            SelectionType::Range { .. }
        ));

        // Exit visual mode
        controller
            .handle_keyboard_event(key_event("Escape"))
            .unwrap();
        assert!(matches!(controller.get_mode(), EditorMode::Navigation));
        assert!(controller.get_selection().is_none());
    }

    #[test]
    fn test_command_mode() {
        let mut controller = create_controller();

        // Enter command mode
        controller.handle_keyboard_event(key_event(":")).unwrap();
        assert!(matches!(controller.get_mode(), EditorMode::Command { .. }));

        // Type a command
        controller.handle_keyboard_event(key_event("w")).unwrap();
        controller.handle_keyboard_event(key_event("q")).unwrap();

        if let EditorMode::Command { value } = controller.get_mode() {
            assert_eq!(value, "wq");
        } else {
            panic!("Should be in Command mode");
        }

        // Exit command mode
        controller
            .handle_keyboard_event(key_event("Escape"))
            .unwrap();
        assert!(matches!(controller.get_mode(), EditorMode::Navigation));
    }

    #[test]
    fn test_mouse_interaction() {
        let mut controller = create_controller();

        // Click on a cell (assuming default cell dimensions)
        // Click at position for cell B2 (col=1, row=1)
        let x = 50.0 + 100.0 + 50.0; // row header + 1 column + half cell
        let y = 25.0 + 25.0 + 12.0; // column header + 1 row + half cell

        controller.handle_mouse_event(mouse_click(x, y)).unwrap();
        assert_eq!(controller.get_cursor(), CellAddress::new(1, 1));

        // Double-click should enter edit mode
        controller
            .handle_mouse_event(mouse_double_click(x, y))
            .unwrap();
        assert!(matches!(
            controller.get_mode(),
            EditorMode::CellEditing { .. }
        ));

        // Click elsewhere should exit visual mode if active
        controller
            .handle_keyboard_event(key_event("Escape"))
            .unwrap();
        controller
            .handle_keyboard_event(key_event("Escape"))
            .unwrap();
        controller.handle_keyboard_event(key_event("v")).unwrap(); // Enter visual mode

        controller
            .handle_mouse_event(mouse_click(x + 100.0, y + 25.0))
            .unwrap();
        assert!(matches!(controller.get_mode(), EditorMode::Navigation));
    }

    #[test]
    fn test_modifiers_handling() {
        let mut controller = create_controller();

        // Shift+Arrow should extend selection (future feature)
        // For now, test that shift modifier is handled in keyboard events
        let mut event = key_event("ArrowRight");
        event.shift = true;

        // This should be handled differently than regular arrow
        controller.handle_keyboard_event(event).unwrap();

        // Ctrl+C, Ctrl+V for copy/paste (future feature)
        let mut ctrl_c = key_event("c");
        ctrl_c.ctrl = true;
        controller.handle_keyboard_event(ctrl_c).unwrap();

        // Alt+Enter for special insert (future feature)
        let mut alt_enter = key_event("Enter");
        alt_enter.alt = true;
        controller.handle_keyboard_event(alt_enter).unwrap();
    }

    #[test]
    fn test_editing_mode() {
        let mut controller = create_controller();

        // Test different ways to enter edit mode

        // 'i' for insert at beginning
        controller.handle_keyboard_event(key_event("i")).unwrap();
        if let EditorMode::CellEditing {
            cursor_pos, mode, ..
        } = controller.get_mode()
        {
            assert_eq!(*cursor_pos, 0);
            assert!(matches!(mode, CellEditMode::Insert(InsertMode::I)));
        }
        controller
            .handle_keyboard_event(key_event("Escape"))
            .unwrap();
        controller
            .handle_keyboard_event(key_event("Escape"))
            .unwrap();

        // 'a' for append
        controller.handle_keyboard_event(key_event("a")).unwrap();
        if let EditorMode::CellEditing { mode, .. } = controller.get_mode() {
            assert!(matches!(mode, CellEditMode::Insert(InsertMode::A)));
        }
        controller
            .handle_keyboard_event(key_event("Escape"))
            .unwrap();
        controller
            .handle_keyboard_event(key_event("Escape"))
            .unwrap();

        // Enter key
        controller
            .handle_keyboard_event(key_event("Enter"))
            .unwrap();
        assert!(matches!(
            controller.get_mode(),
            EditorMode::CellEditing { .. }
        ));
        controller
            .handle_keyboard_event(key_event("Escape"))
            .unwrap();
        controller
            .handle_keyboard_event(key_event("Escape"))
            .unwrap();

        // Direct typing (use a non-vim key)
        controller.handle_keyboard_event(key_event("t")).unwrap();
        assert!(matches!(
            controller.get_mode(),
            EditorMode::CellEditing { .. }
        ));
    }

    #[test]
    fn test_event_system() {
        // The event system is tested indirectly through other tests
        // that verify state changes occur correctly.
        // Direct subscription testing would require lifetime management
        // that's better tested at the integration level.

        let mut controller = create_controller();

        // Move cursor - should update internal state
        let initial_cursor = controller.get_cursor();
        controller.handle_keyboard_event(key_event("j")).unwrap();
        assert_ne!(controller.get_cursor(), initial_cursor);

        // Enter edit mode - should change mode
        controller.handle_keyboard_event(key_event("i")).unwrap();
        assert!(matches!(
            controller.get_mode(),
            EditorMode::CellEditing { .. }
        ));

        // Type text - should update cell content
        controller.handle_keyboard_event(key_event("t")).unwrap();
        controller.handle_keyboard_event(key_event("e")).unwrap();
        controller.handle_keyboard_event(key_event("s")).unwrap();
        controller.handle_keyboard_event(key_event("t")).unwrap();

        if let EditorMode::CellEditing { value, .. } = controller.get_mode() {
            assert_eq!(value, "test");
        }

        // Exit edit mode - should return to navigation
        controller
            .handle_keyboard_event(key_event("Escape"))
            .unwrap();
        controller
            .handle_keyboard_event(key_event("Escape"))
            .unwrap();
        assert!(matches!(controller.get_mode(), EditorMode::Navigation));
    }

    #[test]
    fn test_error_handling() {
        let mut controller = create_controller();

        // Add an error
        controller
            .errors()
            .add_error("Test error".to_string(), ErrorSeverity::Error);

        // Check error is present
        let errors = controller.errors().get_active_errors();
        assert_eq!(errors.len(), 1);
        assert_eq!(errors[0].message, "Test error");

        // Add a warning
        controller
            .errors()
            .add_error("Test warning".to_string(), ErrorSeverity::Warning);

        // Check both are present
        let errors = controller.errors().get_active_errors();
        assert_eq!(errors.len(), 2);

        // Clear errors by removing them
        controller.errors().remove_error(errors[0].id);
        controller.errors().remove_error(errors[1].id);
        let errors = controller.errors().get_active_errors();
        assert_eq!(errors.len(), 0);
    }
}
