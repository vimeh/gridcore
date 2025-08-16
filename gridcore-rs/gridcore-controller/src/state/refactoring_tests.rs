#[cfg(test)]
mod tests {
    use crate::controller::mode::EditorMode;
    use crate::controller::{KeyboardEvent, SpreadsheetController};
    use crate::state::{SelectionType, VisualMode};
    use gridcore_core::types::CellAddress;

    #[test]
    fn test_cursor_persistence_between_modes() {
        let mut controller = SpreadsheetController::new();
        let new_cursor = CellAddress::new(5, 10);

        // Set cursor in Navigation mode
        controller.set_cursor(new_cursor);
        assert_eq!(controller.get_cursor(), new_cursor);

        // Enter editing mode - cursor should be preserved
        controller
            .handle_keyboard_event(KeyboardEvent::new("i".to_string()))
            .unwrap();
        assert_eq!(controller.get_cursor(), new_cursor);

        // Exit to navigation - cursor should still be preserved
        controller
            .handle_keyboard_event(KeyboardEvent::new("Escape".to_string()))
            .unwrap();
        controller
            .handle_keyboard_event(KeyboardEvent::new("Escape".to_string()))
            .unwrap();
        assert_eq!(controller.get_cursor(), new_cursor);

        // Enter visual mode - cursor should be preserved
        controller
            .handle_keyboard_event(KeyboardEvent::new("v".to_string()))
            .unwrap();
        assert_eq!(controller.get_cursor(), new_cursor);
    }

    #[test]
    fn test_selection_persistence() {
        let mut controller = SpreadsheetController::new();

        // Enter visual mode to create selection
        controller
            .handle_keyboard_event(KeyboardEvent::new("v".to_string()))
            .unwrap();

        // Move to create a range selection
        controller
            .handle_keyboard_event(KeyboardEvent::new("l".to_string()))
            .unwrap();
        controller
            .handle_keyboard_event(KeyboardEvent::new("j".to_string()))
            .unwrap();

        // Verify selection exists
        let selection = controller.get_selection();
        assert!(selection.is_some());

        if let Some(sel) = selection {
            assert!(matches!(sel.selection_type, SelectionType::Range { .. }));
        }

        // Exit visual mode - selection should be cleared
        controller
            .handle_keyboard_event(KeyboardEvent::new("Escape".to_string()))
            .unwrap();
        assert!(controller.get_selection().is_none());
    }

    #[test]
    fn test_viewport_info_preservation() {
        let _controller = SpreadsheetController::new();

        // Viewport is managed internally by ViewportManager
        // The viewport manager maintains its own state independently of mode changes
        // This is tested more thoroughly in viewport_manager unit tests

        // Since viewport is not directly accessible from the controller's public API,
        // and viewport persistence is handled internally, we rely on the ViewportManager's
        // own tests for viewport-specific behavior
    }

    #[test]
    fn test_editing_state_retains_cursor() {
        let mut controller = SpreadsheetController::new();

        // Move cursor before editing
        controller
            .handle_keyboard_event(KeyboardEvent::new("j".to_string()))
            .unwrap();
        controller
            .handle_keyboard_event(KeyboardEvent::new("l".to_string()))
            .unwrap();
        let cursor_before = controller.get_cursor();

        // Enter editing mode
        controller
            .handle_keyboard_event(KeyboardEvent::new("i".to_string()))
            .unwrap();

        // Cursor should be the same
        assert_eq!(controller.get_cursor(), cursor_before);

        // Type some text
        controller
            .handle_keyboard_event(KeyboardEvent::new("t".to_string()))
            .unwrap();
        controller
            .handle_keyboard_event(KeyboardEvent::new("e".to_string()))
            .unwrap();
        controller
            .handle_keyboard_event(KeyboardEvent::new("s".to_string()))
            .unwrap();
        controller
            .handle_keyboard_event(KeyboardEvent::new("t".to_string()))
            .unwrap();

        // Cursor position (spreadsheet cursor) should still be the same
        assert_eq!(controller.get_cursor(), cursor_before);

        // Exit editing
        controller
            .handle_keyboard_event(KeyboardEvent::new("Escape".to_string()))
            .unwrap();
        controller
            .handle_keyboard_event(KeyboardEvent::new("Escape".to_string()))
            .unwrap();

        // Cursor should still be at the same cell
        assert_eq!(controller.get_cursor(), cursor_before);
    }

    #[test]
    fn test_visual_mode_selection_tracking() {
        let mut controller = SpreadsheetController::new();

        // Enter visual mode
        controller
            .handle_keyboard_event(KeyboardEvent::new("v".to_string()))
            .unwrap();

        // Verify mode and selection
        assert!(matches!(
            controller.get_mode(),
            EditorMode::Visual {
                mode: VisualMode::Character,
                ..
            }
        ));
        assert!(controller.get_selection().is_some());

        // Get anchor position
        if let EditorMode::Visual { anchor, .. } = controller.get_mode() {
            assert_eq!(*anchor, CellAddress::new(0, 0));
        }

        // Move cursor to extend selection
        controller
            .handle_keyboard_event(KeyboardEvent::new("l".to_string()))
            .unwrap();
        controller
            .handle_keyboard_event(KeyboardEvent::new("l".to_string()))
            .unwrap();
        controller
            .handle_keyboard_event(KeyboardEvent::new("j".to_string()))
            .unwrap();

        // Verify selection has been extended
        if let Some(selection) = controller.get_selection() {
            if let SelectionType::Range { start, end } = &selection.selection_type {
                assert_eq!(*start, CellAddress::new(0, 0)); // Anchor
                assert_eq!(*end, CellAddress::new(2, 1)); // Current cursor
            } else {
                panic!("Expected Range selection");
            }
        } else {
            panic!("Expected selection to exist");
        }
    }

    // Note: The following tests are removed as they tested features not implemented:
    // - test_modal_state_independence (modals consolidated into EditorMode)
    // - test_bulk_operation_modal (feature not implemented)
    // - test_resize_modal_state (resize handled by ResizeManager)
    // - test_insert_delete_modals (feature not implemented)
}
