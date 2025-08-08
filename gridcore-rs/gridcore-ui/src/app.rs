use crate::components::canvas_grid::CanvasGrid;
use crate::components::status_bar::{SelectionStats, StatusBar};
use crate::components::tab_bar::{Sheet, TabBar};
use gridcore_controller::controller::SpreadsheetController;
use gridcore_core::types::CellAddress;
use leptos::*;
use std::cell::RefCell;
use std::rc::Rc;

#[component]
pub fn App() -> impl IntoView {
    // Create the SpreadsheetController
    let controller = Rc::new(RefCell::new(SpreadsheetController::new()));
    
    // Initialize with test data
    {
        let ctrl_borrow = controller.borrow();
        let facade = ctrl_borrow.get_facade();
        let _ = facade.set_cell_value(&CellAddress::new(0, 0), "Hello");   // A1
        let _ = facade.set_cell_value(&CellAddress::new(1, 0), "World");   // B1
        let _ = facade.set_cell_value(&CellAddress::new(0, 1), "123");     // A2
        let _ = facade.set_cell_value(&CellAddress::new(1, 1), "=A2+B2");  // B2 (formula)
        let _ = facade.set_cell_value(&CellAddress::new(1, 2), "456");     // B3
    }
    
    provide_context(controller.clone());

    // Create reactive signals for UI state
    let (active_cell, set_active_cell) = create_signal(CellAddress::new(0, 0));
    let (active_sheet, set_active_sheet) = create_signal(0);
    
    // Initialize formula value with A1's content
    let initial_formula_value = {
        let ctrl_borrow = controller.borrow();
        let facade = ctrl_borrow.get_facade();
        if let Some(cell_obj) = facade.get_cell(&CellAddress::new(0, 0)) {
            if cell_obj.has_formula() {
                cell_obj.raw_value.to_string()
            } else {
                cell_obj.get_display_value().to_string()
            }
        } else {
            String::new()
        }
    };
    let (formula_value, set_formula_value) = create_signal(initial_formula_value);

    // Get initial mode from controller
    let initial_mode = controller.borrow().get_state().spreadsheet_mode();
    
    // Update formula bar when active cell changes
    let ctrl_for_effect = controller.clone();
    // Removed duplicate create_effect - we have the better one below
    let (current_mode, set_current_mode) = create_signal(initial_mode);

    // Sheet management
    let initial_sheets = vec![
        Sheet {
            id: 0,
            name: "Sheet1".to_string(),
        },
        Sheet {
            id: 1,
            name: "Sheet2".to_string(),
        },
        Sheet {
            id: 2,
            name: "Sheet3".to_string(),
        },
    ];
    let (sheets, _set_sheets) = create_signal(initial_sheets);

    // Selection statistics (will be calculated from selection)
    let (selection_stats, _set_selection_stats) = create_signal(SelectionStats::default());

    // Update formula bar when active cell changes (but not during editing)
    create_effect(move |_| {
        let cell = active_cell.get();
        let ctrl = controller.clone();
        
        // Check if we're in editing mode
        let is_editing = matches!(
            ctrl.borrow().get_state(),
            gridcore_controller::state::UIState::Editing { .. }
        );
        
        // Only update formula bar if not editing
        if !is_editing {
            let facade = ctrl.borrow().get_facade();
            
            // Get the value of the active cell
            if let Some(cell_obj) = facade.get_cell(&cell) {
                // Show the formula if it exists, otherwise show the display value
                let value = if cell_obj.has_formula() {
                    cell_obj.raw_value.to_string()
                } else {
                    cell_obj.get_display_value().to_string()
                };
                set_formula_value.set(value);
            } else {
                set_formula_value.set(String::new());
            }
        }
    });

    // Handle formula bar Enter key
    let on_formula_submit = move |ev: web_sys::KeyboardEvent| {
        if ev.key() == "Enter" {
            ev.prevent_default();
            let value = formula_value.get();
            let cell = active_cell.get();

            // Set cell value through controller
            let ctrl = controller.clone();
            if !value.is_empty() {
                if let Err(e) = ctrl.borrow().get_facade().set_cell_value(&cell, &value) {
                    leptos::logging::log!("Error setting cell value: {:?}", e);
                }
                set_formula_value.set(String::new());
            }
        }
    };

    view! {
        <div class="spreadsheet-app">
            <div class="top-toolbar">
                <div class="formula-bar">
                    <div class="cell-indicator">
                        {move || {
                            let cell = active_cell.get();
                            // Fix column calculation for multi-character columns
                            let col = if cell.col < 26 {
                                ((cell.col as u8 + b'A') as char).to_string()
                            } else {
                                let first = ((cell.col / 26 - 1) as u8 + b'A') as char;
                                let second = ((cell.col % 26) as u8 + b'A') as char;
                                format!("{}{}", first, second)
                            };
                            let row = (cell.row + 1).to_string();
                            leptos::logging::log!("Cell indicator: col={}, row={}, display={}{}", cell.col, cell.row, col, row);
                            format!("{}{}", col, row)
                        }}
                    </div>
                    <span class="formula-fx">"fx"</span>
                    <input
                        type="text"
                        class="formula-input"
                        placeholder="Enter formula or value"
                        value=move || formula_value.get()
                        on:input=move |ev| set_formula_value.set(event_target_value(&ev))
                        on:keydown=on_formula_submit
                    />
                </div>
            </div>

            <div class="main-content">
                <CanvasGrid
                    active_cell=active_cell
                    set_active_cell=set_active_cell
                    set_formula_value=set_formula_value
                    set_current_mode=set_current_mode
                />
            </div>

            <div class="bottom-toolbar">
                <TabBar
                    sheets=sheets
                    active_sheet=active_sheet
                    set_active_sheet=set_active_sheet
                />
                <StatusBar
                    current_mode=current_mode
                    selection_stats=selection_stats
                />
            </div>
        </div>
    }
}
