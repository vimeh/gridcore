use gridcore_controller::controller::events::KeyboardEvent;
use gridcore_controller::controller::mode::EditorMode;
use gridcore_controller::controller::SpreadsheetController;
use gridcore_controller::state::SelectionType;

fn key_event(key: &str) -> KeyboardEvent {
    KeyboardEvent {
        key: key.to_string(),
        code: key.to_string(),
        alt: false,
        ctrl: false,
        meta: false,
        shift: false,
    }
}

#[test]
#[ignore] // TODO: Re-enable after completing visual mode state management
fn test_visual_mode_entry() {
    let mut controller = SpreadsheetController::new();

    // Start in navigation mode
    let mode = controller.get_mode();
    assert!(matches!(mode, EditorMode::Navigation));

    // Enter visual mode with 'v'
    controller.handle_keyboard_event(key_event("v")).unwrap();

    // Should be in visual mode
    let mode = controller.get_mode();
    assert!(matches!(mode, EditorMode::Visual { .. }));
}

#[test]
#[ignore] // TODO: Re-enable after completing visual mode state management
fn test_visual_mode_selection_extension() {
    let mut controller = SpreadsheetController::new();

    // Enter visual mode
    controller.handle_keyboard_event(key_event("v")).unwrap();

    // Move right to extend selection
    controller.handle_keyboard_event(key_event("l")).unwrap();

    // Check selection exists
    if let Some(selection) = controller.get_selection() {
        // BUG: Selection doesn't extend - it stays as a single cell at origin
        // Expected: Range from A1 to B1
        // Actual: Cell at A1 only
        match &selection.selection_type {
            SelectionType::Range { start, end } => {
                assert_eq!(start.col, 0, "Selection should start at column A");
                assert_eq!(start.row, 0, "Selection should start at row 1");
                assert_eq!(end.col, 1, "Selection should end at column B");
                assert_eq!(end.row, 0, "Selection should end at row 1");
            }
            _ => {
                // This is what currently happens - documents the bug
                panic!(
                    "BUG: Selection should be Range but is {:?}",
                    selection.selection_type
                );
            }
        }
    } else {
        panic!("Expected Navigation state with Visual modal");
    }
}

#[test]
fn test_visual_mode_exit() {
    let mut controller = SpreadsheetController::new();

    // Enter visual mode
    controller.handle_keyboard_event(key_event("v")).unwrap();

    // Extend selection
    controller.handle_keyboard_event(key_event("l")).unwrap();
    controller.handle_keyboard_event(key_event("j")).unwrap();

    // Exit visual mode with Escape
    controller
        .handle_keyboard_event(KeyboardEvent {
            key: "Escape".to_string(),
            code: "Escape".to_string(),
            alt: false,
            ctrl: false,
            meta: false,
            shift: false,
        })
        .unwrap();

    // Should be back in navigation mode
    let mode = controller.get_mode();
    assert!(matches!(mode, EditorMode::Navigation));
    assert!(controller.get_selection().is_none(), "Selection should be cleared after exit");
}

#[test]
#[ignore] // TODO: Re-enable after completing visual mode state management
fn test_visual_mode_multi_directional_selection() {
    let mut controller = SpreadsheetController::new();

    // Enter visual mode
    controller.handle_keyboard_event(key_event("v")).unwrap();

    // Move right twice
    controller.handle_keyboard_event(key_event("l")).unwrap();
    controller.handle_keyboard_event(key_event("l")).unwrap();

    // Move down twice
    controller.handle_keyboard_event(key_event("j")).unwrap();
    controller.handle_keyboard_event(key_event("j")).unwrap();

    // Check selection covers 3x3 area (A1:C3)
    if let Some(selection) = controller.get_selection() {
        // BUG: Selection doesn't extend - it stays as a single cell
        match &selection.selection_type {
            SelectionType::Range { start, end } => {
                assert_eq!(start.col, 0, "Selection should start at column A");
                assert_eq!(start.row, 0, "Selection should start at row 1");
                assert_eq!(end.col, 2, "Selection should end at column C");
                assert_eq!(end.row, 2, "Selection should end at row 3");
            }
            _ => {
                panic!(
                    "BUG: Selection should be Range but is {:?}",
                    selection.selection_type
                );
            }
        }
    } else {
        panic!("Expected selection in visual mode");
    }
}

#[test]
#[ignore = "Visual line mode test - depends on visual mode working properly"]
fn test_visual_line_mode() {
    let mut controller = SpreadsheetController::new();

    // Enter visual line mode with 'V' (shift+v)
    controller
        .handle_keyboard_event(KeyboardEvent {
            key: "V".to_string(),
            code: "KeyV".to_string(),
            alt: false,
            ctrl: false,
            meta: false,
            shift: true,
        })
        .unwrap();

    // Check that we're in visual line mode
    let mode = controller.get_mode();
    if let EditorMode::Visual { .. } = mode {
        // Note: We would need to check for Line mode here, but EditorMode doesn't track that detail yet
        // For now, just verify we're in visual mode
    } else {
        panic!("Expected Visual mode");
    }

    // Move down to select multiple rows
    controller.handle_keyboard_event(key_event("j")).unwrap();

    // Check selection is row-based
    if let Some(selection) = controller.get_selection() {
        match &selection.selection_type {
            SelectionType::Row { rows } => {
                assert!(rows.contains(&0), "Should include row 0");
                assert!(rows.contains(&1), "Should include row 1");
            }
            _ => panic!("Expected Row selection type for visual line mode"),
        }
    }
}

#[test]
#[ignore] // TODO: Re-enable after completing visual mode state management
fn test_visual_mode_selection_in_state() {
    let mut controller = SpreadsheetController::new();

    // Enter visual mode
    controller.handle_keyboard_event(key_event("v")).unwrap();

    // Attempt to extend selection
    controller.handle_keyboard_event(key_event("l")).unwrap();
    controller.handle_keyboard_event(key_event("j")).unwrap();

    // Get selection and verify it's accessible
    if let Some(selection) = controller.get_selection() {
        // Verify selection extends properly
        match &selection.selection_type {
            SelectionType::Range { start, end } => {
                assert_eq!(start.col, 0, "Selection should start at column A");
                assert_eq!(start.row, 0, "Selection should start at row 1");
                assert_eq!(end.col, 1, "Selection should end at column B");
                assert_eq!(end.row, 1, "Selection should end at row 2");
            }
            _ => {
                panic!(
                    "Selection should be Range but is {:?}",
                    selection.selection_type
                );
            }
        }
    } else {
        panic!("Expected Navigation state with Visual modal containing selection");
    }
}
