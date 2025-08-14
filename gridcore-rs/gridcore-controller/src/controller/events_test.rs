#[cfg(test)]
mod tests {
    use super::super::*;
    use crate::state::{Action, InsertMode, SpreadsheetMode, UIState};
    use gridcore_core::types::CellAddress;

    #[test]
    fn test_cursor_move_changes_state() {
        let mut controller = SpreadsheetController::new();
        let start_cursor = controller.cursor();

        // Use keyboard event to move cursor
        controller
            .handle_keyboard_event(KeyboardEvent::new("ArrowRight".to_string()))
            .unwrap();

        // Verify cursor actually moved
        let end_cursor = controller.cursor();
        assert_ne!(start_cursor, end_cursor, "Cursor should have moved");
        assert_eq!(end_cursor, CellAddress::new(1, 0), "Cursor should be at B1");
    }

    #[test]
    fn test_event_dispatching_on_mode_change() {
        let mut controller = SpreadsheetController::new();

        // Verify initial mode
        assert_eq!(
            controller.state().spreadsheet_mode(),
            SpreadsheetMode::Navigation
        );

        // Start editing
        controller
            .dispatch_action(Action::StartEditing {
                edit_mode: Some(InsertMode::I),
                initial_value: None,
                cursor_position: None,
            })
            .unwrap();

        // Verify mode changed to insert (which is a type of editing mode)
        let state = controller.state();
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
        let facade = controller.facade();
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
        let facade = controller.facade();
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
        assert_eq!(controller.cursor(), CellAddress::new(1, 0));

        // Move down
        controller
            .handle_keyboard_event(KeyboardEvent::new("ArrowDown".to_string()))
            .unwrap();
        assert_eq!(controller.cursor(), CellAddress::new(1, 1));

        // Move left
        controller
            .handle_keyboard_event(KeyboardEvent::new("ArrowLeft".to_string()))
            .unwrap();
        assert_eq!(controller.cursor(), CellAddress::new(0, 1));

        // Move up
        controller
            .handle_keyboard_event(KeyboardEvent::new("ArrowUp".to_string()))
            .unwrap();
        assert_eq!(controller.cursor(), CellAddress::new(0, 0));
    }

    #[test]
    fn test_selection_stats_update() {
        let mut controller = SpreadsheetController::new();

        // Set some cell values
        let facade = controller.facade_mut();
        facade
            .set_cell_value(&CellAddress::new(0, 0), "10")
            .unwrap();
        facade
            .set_cell_value(&CellAddress::new(1, 0), "20")
            .unwrap();
        facade
            .set_cell_value(&CellAddress::new(2, 0), "30")
            .unwrap();

        // Get selection stats for current cell
        let stats = controller.get_current_selection_stats();
        assert_eq!(stats.count, 1);
        assert_eq!(stats.sum, Some(10.0));
    }

    #[test]
    fn test_formula_bar_initialization() {
        let controller = SpreadsheetController::new();

        // Formula bar should be initialized to empty (A1 has no value initially)
        assert_eq!(controller.get_formula_bar_value(), "");
    }

    #[test]
    fn test_formula_bar_update_on_cursor_move() {
        let mut controller = SpreadsheetController::new();

        // Set values in some cells
        controller
            .facade_mut()
            .set_cell_value(&CellAddress::new(0, 0), "Hello")
            .unwrap();
        controller
            .facade_mut()
            .set_cell_value(&CellAddress::new(1, 0), "World")
            .unwrap();

        // Move cursor to B1
        controller
            .handle_keyboard_event(KeyboardEvent::new("ArrowRight".to_string()))
            .unwrap();

        // Formula bar should show B1's value after cursor update
        controller.update_formula_bar_from_cursor();
        assert_eq!(controller.get_formula_bar_value(), "World");
    }

    #[test]
    fn test_formula_bar_actions() {
        let mut controller = SpreadsheetController::new();

        // Test UpdateFormulaBar action
        controller
            .dispatch_action(Action::UpdateFormulaBar {
                value: "=A1+B1".to_string(),
            })
            .unwrap();
        assert_eq!(controller.get_formula_bar_value(), "=A1+B1");

        // Test SubmitFormulaBar action
        controller
            .dispatch_action(Action::SubmitFormulaBar)
            .unwrap();

        // Check that the formula was applied to the current cell (A1)
        let cell_value = controller.facade().get_cell(&CellAddress::new(0, 0));
        assert!(cell_value.is_some());
        let cell = cell_value.unwrap();
        assert!(cell.has_formula());
        assert_eq!(cell.raw_value.to_string(), "=A1+B1");
    }

    #[test]
    fn test_formula_bar_shows_formula_not_value() {
        let mut controller = SpreadsheetController::new();

        // Set up cells with values
        controller
            .facade_mut()
            .set_cell_value(&CellAddress::new(0, 0), "10")
            .unwrap();
        controller
            .facade_mut()
            .set_cell_value(&CellAddress::new(1, 0), "20")
            .unwrap();

        // Set a formula in C1
        controller
            .facade_mut()
            .set_cell_value(&CellAddress::new(2, 0), "=A1+B1")
            .unwrap();

        // Move to C1
        controller
            .handle_keyboard_event(KeyboardEvent::new("ArrowRight".to_string()))
            .unwrap();
        controller
            .handle_keyboard_event(KeyboardEvent::new("ArrowRight".to_string()))
            .unwrap();

        // Update formula bar and verify it shows the formula, not the computed value
        controller.update_formula_bar_from_cursor();
        assert_eq!(controller.get_formula_bar_value(), "=A1+B1");
    }

    #[test]
    fn test_formula_bar_clears_after_submission() {
        let mut controller = SpreadsheetController::new();

        // Set a value in the formula bar
        controller
            .dispatch_action(Action::UpdateFormulaBar {
                value: "Test Value".to_string(),
            })
            .unwrap();

        // Submit the formula bar
        controller
            .dispatch_action(Action::SubmitFormulaBar)
            .unwrap();

        // Formula bar should be cleared after successful submission
        assert_eq!(controller.get_formula_bar_value(), "");
    }
}
