/// Example demonstrating direct state machine access
/// This shows how the UI can interact more directly with the state machine
/// without going through multiple abstraction layers

use gridcore_controller::controller::{SpreadsheetController, actions};
use gridcore_core::types::CellAddress;

pub fn demonstrate_direct_state_access() {
    let mut controller = SpreadsheetController::new();
    
    // Example 1: Direct state machine access for navigation
    {
        let mut state_machine = controller.state_machine();
        
        // Move cursor directly
        state_machine.execute(actions::move_cursor(CellAddress::new(5, 5))).unwrap();
        
        // Get current position
        let cursor = state_machine.cursor();
        println!("Current cursor: {:?}", cursor);
        
        // Move cursor multiple times
        state_machine.execute(actions::move_cursor(CellAddress::new(6, 6))).unwrap();
        state_machine.execute(actions::move_cursor(CellAddress::new(7, 6))).unwrap();
        state_machine.execute(actions::move_cursor(CellAddress::new(8, 6))).unwrap();
    }
    
    // Example 2: Direct state queries
    {
        let state = controller.state_ref();
        let mode = state.spreadsheet_mode();
        let cursor = state.cursor();
        
        println!("Mode: {:?}, Cursor: {:?}", mode, cursor);
    }
    
    // Example 3: Register direct state change listener
    {
        let mut state_machine = controller.state_machine();
        
        state_machine.on_state_change(|state, action| {
            println!("State changed via {:?} to mode {:?}", 
                action, state.spreadsheet_mode());
        });
    }
    
    // Example 4: Start editing directly
    {
        let mut state_machine = controller.state_machine();
        
        // Start editing with 'i' mode
        state_machine.execute(
            actions::start_edit(Some(gridcore_controller::state::InsertMode::I))
        ).unwrap();
        
        // Check we're in editing mode
        assert!(matches!(
            state_machine.mode(),
            gridcore_controller::state::SpreadsheetMode::Editing
        ));
    }
    
    // Example 5: Visual mode operations
    {
        let mut state_machine = controller.state_machine();
        
        // Enter visual mode
        state_machine.execute(
            actions::enter_visual(gridcore_controller::state::VisualMode::Cell)
        ).unwrap();
        
        // Get current selection
        if let Some(selection) = state_machine.selection() {
            println!("Current selection: {:?}", selection);
        }
        
        // Exit visual mode
        state_machine.execute(actions::exit_visual()).unwrap();
    }
    
    // Example 6: Sheet operations through direct access
    {
        let mut state_machine = controller.state_machine();
        
        // Add a new sheet
        state_machine.execute(
            actions::add_sheet("Sheet2".to_string())
        ).unwrap();
        
        // Rename sheet
        state_machine.execute(
            actions::rename_sheet("Sheet2".to_string(), "Budget".to_string())
        ).unwrap();
    }
}

/// Example of simplified UI event handling  
pub fn handle_ui_event_directly(controller: &mut SpreadsheetController, key: &str) {
    // For arrow keys, use the controller's keyboard handling since movement
    // requires computing the new cursor position based on current state
    match key {
        "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" => {
            // Use controller's keyboard event handling for proper navigation
            let event = gridcore_controller::controller::KeyboardEvent::new(key.to_string());
            let _ = controller.handle_keyboard_event(event);
        }
        _ => {
            let mut state_machine = controller.state_machine();
            
            // Direct state actions for other keys
            let action = match key {
                "i" => actions::start_edit(Some(gridcore_controller::state::InsertMode::I)),
                "Escape" => actions::cancel_edit(),
                "v" => actions::enter_visual(gridcore_controller::state::VisualMode::Column),
                _ => return,
            };
            
            // Execute the action directly
            if let Err(e) = state_machine.execute(action) {
                eprintln!("Error executing action: {:?}", e);
            }
        }
    }
}