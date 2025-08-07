use gridcore_controller::state::{UIStateMachine, Action, UIState};
use gridcore_controller::controller::SpreadsheetController;
use gridcore_controller::controller::{KeyboardEvent, MouseEvent};
use gridcore_controller::controller::events::{MouseButton, MouseEventType};
use gridcore_core::types::CellAddress;
use gridcore_core::facade::SpreadsheetFacade;

#[test]
fn test_state_machine_basic_transitions() {
    let mut machine = UIStateMachine::new(None);
    
    // Start in navigation mode
    assert!(matches!(machine.get_state(), UIState::Navigation { .. }));
    
    // Transition to editing
    machine.transition(Action::StartEditing {
        edit_mode: None,
        initial_value: Some("Hello".to_string()),
        cursor_position: Some(0),
    }).unwrap();
    
    assert!(matches!(machine.get_state(), UIState::Editing { .. }));
    
    // Exit to navigation
    machine.transition(Action::ExitToNavigation).unwrap();
    assert!(matches!(machine.get_state(), UIState::Navigation { .. }));
}

#[test]
fn test_controller_keyboard_handling() {
    let mut controller = SpreadsheetController::new();
    
    // Process 'i' key to enter insert mode
    let event = KeyboardEvent::new("i".to_string());
    controller.handle_keyboard_event(event).unwrap();
    
    // Should be in editing mode
    let state = controller.get_state();
    assert!(matches!(state, UIState::Editing { .. }));
}

#[test]
fn test_controller_mouse_handling() {
    let mut controller = SpreadsheetController::new();
    
    // Click on a cell
    let event = MouseEvent::new(100.0, 100.0, MouseButton::Left, MouseEventType::Click);
    controller.handle_mouse_event(event).unwrap();
    
    // Should update cursor position (in a real implementation)
    let state = controller.get_state();
    assert!(matches!(state, UIState::Navigation { .. }));
}

#[test]
fn test_vim_mode_navigation() {
    let mut machine = UIStateMachine::new(None);
    
    // Navigate with vim keys
    let start_cursor = machine.get_state().cursor().clone();
    
    // Move down (j)
    machine.transition(Action::UpdateCursor {
        cursor: CellAddress::new(start_cursor.col, start_cursor.row + 1),
    }).unwrap();
    
    let new_cursor = machine.get_state().cursor();
    assert_eq!(new_cursor.row, start_cursor.row + 1);
    assert_eq!(new_cursor.col, start_cursor.col);
}

#[test]
fn test_command_mode_workflow() {
    let mut machine = UIStateMachine::new(None);
    
    // Enter command mode
    machine.transition(Action::EnterCommandMode).unwrap();
    assert!(matches!(machine.get_state(), UIState::Command { .. }));
    
    // Type a command
    machine.transition(Action::UpdateCommandValue {
        value: ":w".to_string(),
    }).unwrap();
    
    // Exit command mode
    machine.transition(Action::ExitCommandMode).unwrap();
    assert!(matches!(machine.get_state(), UIState::Navigation { .. }));
}

#[test]
fn test_visual_mode_selection() {
    let mut machine = UIStateMachine::new(None);
    
    // Enter visual mode
    let selection = gridcore_controller::state::Selection {
        selection_type: gridcore_controller::state::SelectionType::Cell {
            address: CellAddress::new(0, 0),
        },
        anchor: None,
    };
    
    machine.transition(Action::EnterSpreadsheetVisualMode {
        visual_mode: gridcore_controller::state::SpreadsheetVisualMode::Char,
        selection,
    }).unwrap();
    
    assert!(matches!(machine.get_state(), UIState::Visual { .. }));
    
    // Update selection
    let new_selection = gridcore_controller::state::Selection {
        selection_type: gridcore_controller::state::SelectionType::Range {
            start: CellAddress::new(0, 0),
            end: CellAddress::new(5, 5),
        },
        anchor: Some(CellAddress::new(0, 0)),
    };
    
    machine.transition(Action::UpdateSelection {
        selection: new_selection,
    }).unwrap();
    
    // Exit visual mode
    machine.transition(Action::ExitSpreadsheetVisualMode).unwrap();
    assert!(matches!(machine.get_state(), UIState::Navigation { .. }));
}

#[test]
fn test_resize_mode_workflow() {
    let mut machine = UIStateMachine::new(None);
    
    // Start resize
    machine.transition(Action::StartResize {
        target: gridcore_controller::state::ResizeTarget::Column { index: 0 },
        initial_position: 100.0,
    }).unwrap();
    
    assert!(matches!(machine.get_state(), UIState::Resize { .. }));
    
    // Update size
    machine.transition(Action::UpdateResize { delta: 20.0 }).unwrap();
    
    // Confirm resize
    machine.transition(Action::ConfirmResize).unwrap();
    assert!(matches!(machine.get_state(), UIState::Navigation { .. }));
}

#[test]
fn test_bulk_operation_workflow() {
    let mut machine = UIStateMachine::new(None);
    
    // Start bulk operation
    let parsed_command = gridcore_controller::state::ParsedBulkCommand {
        command: ":format A1:B10 bold".to_string(),
        operation: "format".to_string(),
        range_spec: "A1:B10".to_string(),
        parameters: vec!["bold".to_string()],
    };
    
    machine.transition(Action::StartBulkOperation {
        parsed_command,
        affected_cells: Some(20),
    }).unwrap();
    
    assert!(matches!(machine.get_state(), UIState::BulkOperation { .. }));
    
    // Generate preview
    machine.transition(Action::GeneratePreview).unwrap();
    
    // Execute operation
    machine.transition(Action::ExecuteBulkOperation).unwrap();
    assert!(matches!(machine.get_state(), UIState::Navigation { .. }));
}

#[test]
fn test_undo_redo_history() {
    let mut machine = UIStateMachine::new(None);
    
    // Make several state changes
    for i in 0..5 {
        machine.transition(Action::UpdateCursor {
            cursor: CellAddress::new(i, i),
        }).unwrap();
    }
    
    // Check history
    let history = machine.get_history();
    assert!(history.len() >= 5);
    
    // Clear history
    machine.clear_history();
    assert_eq!(machine.get_history().len(), 0);
}

#[test]
fn test_controller_with_facade_integration() {
    let mut controller = SpreadsheetController::new();
    
    // Set some cell values
    let addr1 = CellAddress::new(0, 0);
    let addr2 = CellAddress::new(1, 0);
    
    controller.get_facade_mut().set_cell_value(&addr1, "10").unwrap();
    controller.get_facade_mut().set_cell_value(&addr2, "=A1*2").unwrap();
    
    // Get cell value through controller
    let cell = controller.get_facade().get_cell(&addr2);
    if let Some(cell) = cell {
        // Formula should be evaluated
        let display_value = cell.get_display_value();
        assert_eq!(display_value.to_string(), "20");
    }
}

#[cfg(feature = "wasm")]
mod wasm_tests {
    use wasm_bindgen_test::*;
    use gridcore_controller::wasm::state::WasmUIStateMachine;
    use gridcore_controller::wasm::controller::WasmSpreadsheetController;
    
    #[wasm_bindgen_test]
    fn test_wasm_state_machine() {
        let mut machine = WasmUIStateMachine::new();
        
        // Test basic transition
        machine.start_editing(Some("test".to_string())).unwrap();
        let mode = machine.get_spreadsheet_mode();
        assert!(mode.contains("Editing"));
        
        // Test escape
        machine.escape().unwrap();
        let mode = machine.get_spreadsheet_mode();
        assert!(mode.contains("Navigation"));
    }
    
    #[wasm_bindgen_test]
    fn test_wasm_controller() {
        let mut controller = WasmSpreadsheetController::new();
        
        // Set and get cell value
        controller.set_cell_value(0, 0, "100".to_string()).unwrap();
        
        // Process keyboard event
        controller.process_key("i".to_string(), false, false, false, false).unwrap();
        
        let mode = controller.get_spreadsheet_mode();
        assert!(mode.contains("Editing"));
    }
}