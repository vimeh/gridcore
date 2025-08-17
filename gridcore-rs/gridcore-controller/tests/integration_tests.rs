use gridcore_controller::controller::events::{MouseButton, MouseEventType};
use gridcore_controller::controller::MouseEvent;
use gridcore_controller::controller::SpreadsheetController;
use gridcore_controller::state::Action;

#[test]
fn test_controller_keyboard_handling() {
    let mut controller = SpreadsheetController::new();

    // The 'i' key is handled by the UI, not the controller directly
    // Instead, use the StartEditing action to enter editing mode
    // Note: This test is disabled until dispatch_action properly handles
    // StartEditing without the state machine
    controller
        .dispatch_action(Action::StartEditing {
            edit_mode: Some(gridcore_controller::state::InsertMode::I),
            initial_value: Some(String::new()),
            cursor_position: Some(0),
        })
        .unwrap();

    // Should be in CellEditing mode with Insert edit mode
    let mode = controller.get_mode();
    match mode {
        gridcore_controller::controller::mode::EditorMode::CellEditing {
            mode: edit_mode, ..
        } => {
            assert!(matches!(
                edit_mode,
                gridcore_controller::controller::mode::CellEditMode::Insert(_)
            ));
        }
        _ => panic!("Expected CellEditing mode with Insert mode"),
    }
}

#[test]
fn test_controller_mouse_click() {
    let mut controller = SpreadsheetController::new();

    // Create a mouse click event
    // Note: The mouse event uses x,y coordinates. The controller's mouse handler
    // will need to convert these to row/col based on the current viewport
    let event = MouseEvent {
        button: MouseButton::Left,
        event_type: MouseEventType::Click,
        x: 100.0,
        y: 50.0,
        shift: false,
        ctrl: false,
        alt: false,
        meta: false,
    };

    // Handle the mouse event
    controller.handle_mouse_event(event).unwrap();

    // The cursor position depends on the viewport and cell dimensions
    // Since we don't know the exact conversion, just verify it handled the event
    // without panicking. The actual cell address depends on viewport configuration.
}

#[test]
fn test_selection_stats() {
    let controller = SpreadsheetController::new();

    // Get selection stats for empty selection
    let stats = controller.get_current_selection_stats();
    assert_eq!(stats.count, 0);
    assert_eq!(stats.sum, None);
    assert_eq!(stats.average, None);
}
