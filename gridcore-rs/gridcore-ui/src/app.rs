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
    provide_context(controller.clone());

    // Create reactive signals for UI state
    let (formula_value, set_formula_value) = create_signal(String::new());
    let (active_cell, set_active_cell) = create_signal(CellAddress::new(0, 0));
    let (active_sheet, set_active_sheet) = create_signal(0);

    // Get initial mode from controller
    let initial_mode = controller.borrow().get_state().spreadsheet_mode();
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
                    <span style="padding: 0 8px; font-weight: bold;">"fx"</span>
                    <input
                        type="text"
                        placeholder="Enter formula or value"
                        value=move || formula_value.get()
                        on:input=move |ev| set_formula_value.set(event_target_value(&ev))
                        on:keydown=on_formula_submit
                        style="flex: 1; border: 1px solid #e0e0e0; padding: 4px; font-family: monospace;"
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

            <div class="bottom-toolbar" style="display: flex; flex-direction: column;">
                <TabBar
                    sheets=sheets
                    active_sheet=active_sheet
                    set_active_sheet=set_active_sheet
                />
                <StatusBar
                    current_mode=current_mode
                    active_cell=active_cell
                    selection_stats=selection_stats
                />
            </div>
        </div>
    }
}
