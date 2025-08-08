use crate::components::canvas_grid::CanvasGrid;
use crate::components::error_display::{ErrorDisplay, ErrorMessage, ErrorSeverity};
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
    
    // We'll initialize test data after ErrorDisplay is available
    let init_data = create_rw_signal(false);
    
    provide_context(controller.clone());
    
    // Create error handling signals
    let (errors, set_errors) = create_signal::<Vec<ErrorMessage>>(Vec::new());
    let error_counter = create_rw_signal(0usize);
    
    // Set up controller event listener for errors
    {
        let set_errors = set_errors.clone();
        let error_counter = error_counter.clone();
        let callback = Box::new(move |event: &gridcore_controller::controller::events::SpreadsheetEvent| {
            if let gridcore_controller::controller::events::SpreadsheetEvent::ErrorOccurred { message, severity } = event {
                let id = error_counter.get();
                error_counter.set(id + 1);
                
                let sev = match severity {
                    gridcore_controller::controller::events::ErrorSeverity::Error => ErrorSeverity::Error,
                    gridcore_controller::controller::events::ErrorSeverity::Warning => ErrorSeverity::Warning,
                    gridcore_controller::controller::events::ErrorSeverity::Info => ErrorSeverity::Info,
                };
                
                let error_msg = ErrorMessage {
                    message: message.clone(),
                    severity: sev,
                    id,
                };
                
                set_errors.update(|errs| errs.push(error_msg));
            }
        });
        controller.borrow_mut().subscribe_to_events(callback);
    }

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
    let _ctrl_for_effect = controller.clone();
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
    let controller_for_effect = controller.clone();
    create_effect(move |_| {
        let cell = active_cell.get();
        let ctrl = controller_for_effect.clone();
        
        // Check if we're in editing mode
        let is_editing = matches!(
            ctrl.borrow().get_state(),
            gridcore_controller::state::UIState::Editing { .. }
        );
        
        // Only update formula bar if not editing
        if !is_editing {
            let ctrl_borrowed = ctrl.borrow();
            let facade = ctrl_borrowed.get_facade();
            
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
    let controller_for_submit = controller.clone();
    let on_formula_submit = move |ev: web_sys::KeyboardEvent| {
        if ev.key() == "Enter" {
            ev.prevent_default();
            let value = formula_value.get();
            let cell = active_cell.get();

            // Set cell value through controller
            let ctrl = controller_for_submit.clone();
            if !value.is_empty() {
                let result = ctrl.borrow().get_facade().set_cell_value(&cell, &value);
                match result {
                    Ok(_) => {
                        set_formula_value.set(String::new());
                    }
                    Err(e) => {
                        // Error will be displayed through controller events
                        leptos::logging::log!("Error setting cell value: {}", e);
                    }
                }
            }
        }
    };

    
    // Initialize test data with error handling after ErrorDisplay is mounted
    let controller_for_init = controller.clone();
    create_effect(move |_| {
        if !init_data.get() {
            init_data.set(true);
            
            let ctrl = controller_for_init.borrow();
            let facade = ctrl.get_facade();
            
            // Initialize test data with proper error handling
            let test_data = vec![
                (CellAddress::new(0, 0), "Hello"),
                (CellAddress::new(1, 0), "World"),
                (CellAddress::new(0, 1), "123"),
                (CellAddress::new(1, 1), "456"),
                (CellAddress::new(0, 2), "=A2+B2"),
                (CellAddress::new(1, 2), "789"),
            ];
            
            for (address, value) in test_data {
                if let Err(e) = facade.set_cell_value(&address, value) {
                    // Error will be displayed through controller events
                    leptos::logging::log!("Failed to initialize cell: {}", e);
                }
            }
        }
    });

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
            
            // Add error display overlay
            <ErrorDisplay errors=errors set_errors=set_errors />
        </div>
    }
}
