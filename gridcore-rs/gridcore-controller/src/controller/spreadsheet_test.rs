#[cfg(test)]
mod tests {
    use crate::controller::{KeyboardEvent, SpreadsheetController};
    use crate::state::{InsertMode, SpreadsheetMode, UIState};
    use gridcore_core::types::CellAddress;

    #[test]
    fn test_i_key_starts_insert_mode_with_cursor_at_zero() {
        // Arrange
        let mut controller = SpreadsheetController::new();
        
        // Set a cell value first
        let cell_addr = CellAddress::new(0, 0);
        controller.get_facade_mut().set_cell_value(&cell_addr, "World").unwrap();
        
        // Act - Press 'i' to enter insert mode
        let event = KeyboardEvent {
            key: "i".to_string(),
            code: String::new(),
            ctrl: false,
            alt: false,
            shift: false,
            meta: false,
        };
        controller.handle_keyboard_event(event).unwrap();

        // Assert
        let state = controller.get_state();
        match state {
            UIState::Editing {
                editing_value,
                cursor_position,
                edit_variant,
                ..
            } => {
                assert_eq!(editing_value, "World", "Should have existing cell value");
                assert_eq!(*cursor_position, 0, "Cursor should be at position 0 for 'i' key");
                assert_eq!(*edit_variant, Some(InsertMode::I), "Should be in InsertMode::I");
            }
            _ => panic!("Expected Editing state after pressing 'i', got {:?}", state),
        }
    }

    #[test]
    fn test_a_key_starts_append_mode_with_cursor_at_end() {
        // Arrange
        let mut controller = SpreadsheetController::new();
        
        // Set a cell value first
        let cell_addr = CellAddress::new(0, 0);
        controller.get_facade_mut().set_cell_value(&cell_addr, "World").unwrap();
        
        // Act - Press 'a' to enter append mode
        let event = KeyboardEvent {
            key: "a".to_string(),
            code: String::new(),
            ctrl: false,
            alt: false,
            shift: false,
            meta: false,
        };
        controller.handle_keyboard_event(event).unwrap();

        // Assert
        let state = controller.get_state();
        match state {
            UIState::Editing {
                editing_value,
                cursor_position,
                edit_variant,
                ..
            } => {
                assert_eq!(editing_value, "World", "Should have existing cell value");
                assert_eq!(*cursor_position, 5, "Cursor should be at end (position 5) for 'a' key");
                assert_eq!(*edit_variant, Some(InsertMode::A), "Should be in InsertMode::A");
            }
            _ => panic!("Expected Editing state after pressing 'a', got {:?}", state),
        }
    }

    #[test]
    fn test_enter_key_starts_editing_with_empty_value() {
        // Arrange
        let mut controller = SpreadsheetController::new();
        
        // Set a cell value first
        let cell_addr = CellAddress::new(0, 0);
        controller.get_facade_mut().set_cell_value(&cell_addr, "World").unwrap();
        
        // Act - Press Enter to start editing with empty value
        let event = KeyboardEvent {
            key: "Enter".to_string(),
            code: String::new(),
            ctrl: false,
            alt: false,
            shift: false,
            meta: false,
        };
        controller.handle_keyboard_event(event).unwrap();

        // Assert
        let state = controller.get_state();
        match state {
            UIState::Editing {
                editing_value,
                cursor_position,
                ..
            } => {
                assert_eq!(editing_value, "", "Should have empty value for Enter key");
                assert_eq!(*cursor_position, 0, "Cursor should be at position 0");
            }
            _ => panic!("Expected Editing state after pressing Enter, got {:?}", state),
        }
    }

    #[test]
    fn test_direct_typing_starts_editing() {
        // Arrange
        let mut controller = SpreadsheetController::new();
        
        // Act - Type a character directly
        let event = KeyboardEvent {
            key: "x".to_string(),
            code: String::new(),
            ctrl: false,
            alt: false,
            shift: false,
            meta: false,
        };
        controller.handle_keyboard_event(event).unwrap();

        // Assert
        let state = controller.get_state();
        match state {
            UIState::Editing {
                editing_value,
                cursor_position,
                edit_variant,
                ..
            } => {
                assert_eq!(editing_value, "x", "Should have the typed character");
                assert_eq!(*cursor_position, 1, "Cursor should be after the typed character");
                assert_eq!(*edit_variant, Some(InsertMode::I), "Should default to InsertMode::I");
            }
            _ => panic!("Expected Editing state after typing, got {:?}", state),
        }
    }

    #[test]
    fn test_cursor_movement_in_navigation_mode() {
        // Arrange
        let mut controller = SpreadsheetController::new();
        let initial_cursor = controller.get_cursor();
        assert_eq!(initial_cursor, CellAddress::new(0, 0));

        // Act - Move right
        let event = KeyboardEvent {
            key: "l".to_string(),
            code: String::new(),
            ctrl: false,
            alt: false,
            shift: false,
            meta: false,
        };
        controller.handle_keyboard_event(event).unwrap();

        // Assert
        assert_eq!(controller.get_cursor(), CellAddress::new(1, 0), "Should move right");

        // Act - Move down
        let event = KeyboardEvent {
            key: "j".to_string(),
            code: String::new(),
            ctrl: false,
            alt: false,
            shift: false,
            meta: false,
        };
        controller.handle_keyboard_event(event).unwrap();

        // Assert
        assert_eq!(controller.get_cursor(), CellAddress::new(1, 1), "Should move down");
    }

    #[test]
    fn test_mode_transitions() {
        // Arrange
        let mut controller = SpreadsheetController::new();
        
        // Initially in Navigation mode
        assert_eq!(controller.get_state().spreadsheet_mode(), SpreadsheetMode::Navigation);

        // Act - Enter insert mode
        let event = KeyboardEvent {
            key: "i".to_string(),
            code: String::new(),
            ctrl: false,
            alt: false,
            shift: false,
            meta: false,
        };
        controller.handle_keyboard_event(event).unwrap();

        // Assert - Should be in Insert mode
        assert_eq!(controller.get_state().spreadsheet_mode(), SpreadsheetMode::Insert);
    }
}