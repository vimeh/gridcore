#[cfg(test)]
mod tests {
    use super::super::*;
    use crate::state::{
        actions::Action, create_navigation_state,
        transition_handlers::navigation::NavigationHandler, CellMode, InsertMode, UIState,
        ViewportInfo,
    };
    use gridcore_core::types::CellAddress;

    #[test]
    fn test_start_editing_with_insert_mode_i_sets_cursor_to_zero() {
        // Arrange
        let initial_state = create_navigation_state(
            CellAddress::new(0, 0),
            ViewportInfo {
                start_row: 0,
                start_col: 0,
                rows: 10,
                cols: 10,
            },
            None,
        );
        let handler = NavigationHandler;
        let action = Action::StartEditing {
            edit_mode: Some(InsertMode::I),
            initial_value: Some("existing text".to_string()),
            cursor_position: Some(0),
        };

        // Act
        let result = handler.handle(&initial_state, &action);

        // Assert
        assert!(result.is_ok());
        let new_state = result.unwrap();

        match new_state {
            UIState::Editing {
                editing_value,
                cursor_position,
                cell_mode,
                edit_variant,
                ..
            } => {
                assert_eq!(editing_value, "existing text");
                assert_eq!(
                    cursor_position, 0,
                    "Cursor should be at position 0 for InsertMode::I"
                );
                assert_eq!(cell_mode, CellMode::Insert);
                assert_eq!(edit_variant, Some(InsertMode::I));
            }
            _ => panic!("Expected Editing state, got {:?}", new_state),
        }
    }

    #[test]
    fn test_start_editing_with_insert_mode_a_sets_cursor_at_end() {
        // Arrange
        let initial_state = create_navigation_state(
            CellAddress::new(0, 0),
            ViewportInfo {
                start_row: 0,
                start_col: 0,
                rows: 10,
                cols: 10,
            },
            None,
        );
        let handler = NavigationHandler;
        let text = "existing text".to_string();
        let expected_cursor_pos = text.len();

        let action = Action::StartEditing {
            edit_mode: Some(InsertMode::A),
            initial_value: Some(text.clone()),
            cursor_position: Some(expected_cursor_pos),
        };

        // Act
        let result = handler.handle(&initial_state, &action);

        // Assert
        assert!(result.is_ok());
        let new_state = result.unwrap();

        match new_state {
            UIState::Editing {
                editing_value,
                cursor_position,
                cell_mode,
                edit_variant,
                ..
            } => {
                assert_eq!(editing_value, text);
                assert_eq!(
                    cursor_position, expected_cursor_pos,
                    "Cursor should be at end for InsertMode::A"
                );
                assert_eq!(cell_mode, CellMode::Insert);
                assert_eq!(edit_variant, Some(InsertMode::A));
            }
            _ => panic!("Expected Editing state, got {:?}", new_state),
        }
    }

    #[test]
    fn test_start_editing_preserves_cursor_position() {
        // Arrange
        let initial_state = create_navigation_state(
            CellAddress::new(0, 0),
            ViewportInfo {
                start_row: 0,
                start_col: 0,
                rows: 10,
                cols: 10,
            },
            None,
        );
        let handler = NavigationHandler;
        let action = Action::StartEditing {
            edit_mode: Some(InsertMode::I),
            initial_value: Some("test".to_string()),
            cursor_position: Some(2), // Middle of "test"
        };

        // Act
        let result = handler.handle(&initial_state, &action);

        // Assert
        assert!(result.is_ok());
        let new_state = result.unwrap();

        match new_state {
            UIState::Editing {
                cursor_position, ..
            } => {
                assert_eq!(cursor_position, 2, "Cursor position should be preserved");
            }
            _ => panic!("Expected Editing state"),
        }
    }

    #[test]
    fn test_start_editing_with_empty_string() {
        // Arrange
        let initial_state = create_navigation_state(
            CellAddress::new(0, 0),
            ViewportInfo {
                start_row: 0,
                start_col: 0,
                rows: 10,
                cols: 10,
            },
            None,
        );
        let handler = NavigationHandler;
        let action = Action::StartEditing {
            edit_mode: Some(InsertMode::I),
            initial_value: Some(String::new()), // Empty string for Enter key
            cursor_position: Some(0),
        };

        // Act
        let result = handler.handle(&initial_state, &action);

        // Assert
        assert!(result.is_ok());
        let new_state = result.unwrap();

        match new_state {
            UIState::Editing {
                editing_value,
                cursor_position,
                ..
            } => {
                assert_eq!(editing_value, "");
                assert_eq!(cursor_position, 0);
            }
            _ => panic!("Expected Editing state"),
        }
    }

    #[test]
    fn test_only_handles_navigation_state() {
        // Arrange
        let handler = NavigationHandler;
        let editing_state = UIState::Editing {
            cursor: CellAddress::new(0, 0),
            viewport: ViewportInfo {
                start_row: 0,
                start_col: 0,
                rows: 10,
                cols: 10,
            },
            cell_mode: CellMode::Normal,
            editing_value: String::new(),
            cursor_position: 0,
            visual_start: None,
            visual_type: None,
            edit_variant: None,
        };

        let action = Action::StartEditing {
            edit_mode: Some(InsertMode::I),
            initial_value: Some("test".to_string()),
            cursor_position: Some(0),
        };

        // Act & Assert
        assert!(
            !handler.can_handle(&editing_state, &action),
            "Should not handle actions when not in Navigation state"
        );
    }

    #[test]
    fn test_update_editing_value_action() {
        // Arrange
        use crate::state::transition_handlers::editing::EditingHandler;

        let initial_state = UIState::Editing {
            cursor: CellAddress::new(0, 0),
            viewport: ViewportInfo {
                start_row: 0,
                start_col: 0,
                rows: 10,
                cols: 10,
            },
            cell_mode: CellMode::Insert,
            editing_value: "Hello".to_string(),
            cursor_position: 5,
            visual_start: None,
            visual_type: None,
            edit_variant: Some(InsertMode::I),
        };

        let handler = EditingHandler;
        let action = Action::UpdateEditingValue {
            value: "Hello World".to_string(),
            cursor_position: 11,
        };

        // Act
        let result = handler.handle(&initial_state, &action);

        // Assert
        assert!(result.is_ok());
        let new_state = result.unwrap();

        match new_state {
            UIState::Editing {
                editing_value,
                cursor_position,
                ..
            } => {
                assert_eq!(editing_value, "Hello World", "Value should be updated");
                assert_eq!(cursor_position, 11, "Cursor position should be updated");
            }
            _ => panic!("Expected Editing state after UpdateEditingValue"),
        }
    }
}
