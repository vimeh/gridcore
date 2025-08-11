#[cfg(test)]
mod tests {
    use super::super::*;
    use crate::state::{Action, SpreadsheetMode, InsertMode, UIState};
    use gridcore_core::types::CellAddress;

    #[test]
    fn test_cursor_move_changes_state() {
        let mut controller = SpreadsheetController::new();
        let start_cursor = controller.get_cursor();
        
        // Use keyboard event to move cursor
        controller
            .handle_keyboard_event(KeyboardEvent::new("ArrowRight".to_string()))
            .unwrap();

        // Verify cursor actually moved
        let end_cursor = controller.get_cursor();
        assert_ne!(start_cursor, end_cursor, "Cursor should have moved");
        assert_eq!(end_cursor, CellAddress::new(1, 0), "Cursor should be at B1");
    }

    #[test]
    fn test_event_dispatching_on_mode_change() {
        let mut controller = SpreadsheetController::new();
        
        // Verify initial mode
        assert_eq!(controller.get_state().spreadsheet_mode(), SpreadsheetMode::Navigation);

        // Start editing
        controller
            .dispatch_action(Action::StartEditing {
                edit_mode: Some(InsertMode::I),
                initial_value: None,
                cursor_position: None,
            })
            .unwrap();

        // Verify mode changed to insert (which is a type of editing mode)
        let state = controller.get_state();
        assert!(matches!(state, UIState::Editing { .. }));
    }

    #[test]
    fn test_event_dispatching_on_cell_edit() {
        let mut controller = SpreadsheetController::new();
        let cell = CellAddress::new(0, 0);
        
        // Start editing
        controller
            .dispatch_action(Action::StartEditing {
                edit_mode: Some(InsertMode::I),
                initial_value: None,
                cursor_position: None,
            })
            .unwrap();

        // Submit edit
        controller
            .dispatch_action(Action::SubmitCellEdit {
                value: "test".to_string(),
            })
            .unwrap();

        // Verify the cell value was set
        let facade = controller.get_facade();
        let value = facade.get_cell_value(&cell);
        assert!(value.is_some());
        // Just verify cell was updated
        assert!(facade.get_cell_value(&cell).is_some());
    }

    #[test]
    fn test_error_event_on_invalid_formula() {
        let mut controller = SpreadsheetController::new();
        
        // Start editing 
        controller
            .dispatch_action(Action::StartEditing {
                edit_mode: Some(InsertMode::I),
                initial_value: None,
                cursor_position: None,
            })
            .unwrap();
        
        // Submit invalid formula - division by zero
        controller
            .dispatch_action(Action::SubmitCellEdit {
                value: "=1/0".to_string(),
            })
            .unwrap();

        // Verify the cell shows an error
        let facade = controller.get_facade();
        let cell_value = facade.get_cell_raw_value(&CellAddress::new(0, 0));
        assert!(
            matches!(cell_value, Some(gridcore_core::types::CellValue::Error(_))),
            "Cell should contain an error value"
        );
    }

    #[test]
    fn test_cursor_movement_updates_state() {
        let mut controller = SpreadsheetController::new();
        
        // Move right
        controller
            .handle_keyboard_event(KeyboardEvent::new("ArrowRight".to_string()))
            .unwrap();
        assert_eq!(controller.get_cursor(), CellAddress::new(1, 0));
        
        // Move down
        controller
            .handle_keyboard_event(KeyboardEvent::new("ArrowDown".to_string()))
            .unwrap();
        assert_eq!(controller.get_cursor(), CellAddress::new(1, 1));
        
        // Move left
        controller
            .handle_keyboard_event(KeyboardEvent::new("ArrowLeft".to_string()))
            .unwrap();
        assert_eq!(controller.get_cursor(), CellAddress::new(0, 1));
        
        // Move up
        controller
            .handle_keyboard_event(KeyboardEvent::new("ArrowUp".to_string()))
            .unwrap();
        assert_eq!(controller.get_cursor(), CellAddress::new(0, 0));
    }

    #[test]
    fn test_selection_stats_update() {
        let mut controller = SpreadsheetController::new();
        
        // Set some cell values
        let facade = controller.get_facade_mut();
        facade.set_cell_value(&CellAddress::new(0, 0), "10").unwrap();
        facade.set_cell_value(&CellAddress::new(1, 0), "20").unwrap();
        facade.set_cell_value(&CellAddress::new(2, 0), "30").unwrap();
        
        // Get selection stats for current cell
        let stats = controller.get_current_selection_stats();
        assert_eq!(stats.count, 1);
        assert_eq!(stats.sum, Some(10.0));
    }
}