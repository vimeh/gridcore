use crate::components::canvas_grid::CanvasGrid;
use crate::components::error_display::{ErrorDisplay, ErrorMessage, ErrorSeverity};
use crate::components::status_bar::StatusBar;
use crate::components::tab_bar::{Sheet, TabBar};
use gridcore_controller::controller::SpreadsheetController;
use gridcore_controller::managers::SelectionStats;
use gridcore_core::types::CellAddress;
use leptos::prelude::*;
use std::cell::RefCell;
use std::rc::Rc;

#[component]
pub fn App() -> impl IntoView {
    // Initialize wasm-logger once for the entire application
    wasm_logger::init(wasm_logger::Config::default());

    // Set panic hook for better error messages
    #[cfg(feature = "debug")]
    console_error_panic_hook::set_once();

    // Create the SpreadsheetController
    let controller = Rc::new(RefCell::new(SpreadsheetController::new()));

    // We'll initialize test data after ErrorDisplay is available
    let init_data = RwSignal::new(false);

    let controller_stored = StoredValue::<_, LocalStorage>::new_local(controller.clone());
    provide_context(controller_stored);

    // Create error handling signals
    let (errors, set_errors) = signal::<Vec<ErrorMessage>>(Vec::new());
    let error_counter = RwSignal::new(0usize);

    // Set up controller event listener for errors
    {
        let callback = Box::new(
            move |event: &gridcore_controller::controller::events::SpreadsheetEvent| {
                leptos::logging::log!("Controller event received: {:?}", event);
                if let gridcore_controller::controller::events::SpreadsheetEvent::ErrorOccurred {
                    message,
                    severity,
                } = event
                {
                    leptos::logging::log!(
                        "ErrorOccurred event received: {} ({:?})",
                        message,
                        severity
                    );
                    leptos::logging::log!(
                        "Error event: message={}, severity={:?}",
                        message,
                        severity
                    );
                    let id = error_counter.get();
                    error_counter.set(id + 1);

                    let sev = match severity {
                        gridcore_controller::controller::events::ErrorSeverity::Error => {
                            ErrorSeverity::Error
                        }
                        gridcore_controller::controller::events::ErrorSeverity::Warning => {
                            ErrorSeverity::Warning
                        }
                        gridcore_controller::controller::events::ErrorSeverity::Info => {
                            ErrorSeverity::Info
                        }
                    };

                    let error_msg = ErrorMessage {
                        message: message.clone(),
                        severity: sev,
                        id,
                    };

                    leptos::logging::log!(
                        "Adding error to display: id={}, message={}",
                        id,
                        message
                    );
                    set_errors.update(|errs| errs.push(error_msg));
                }
            },
        );
        controller.borrow_mut().subscribe_to_events(callback);
    }

    // Create reactive signals for UI state
    // Create a signal for the active cell that we'll update when controller changes
    let (active_cell, set_active_cell) = signal(CellAddress::new(0, 0));
    let (active_sheet, set_active_sheet) = signal(0);

    // Initialize formula value with A1's content
    let initial_formula_value = {
        let ctrl_borrow = controller.borrow();
        ctrl_borrow.get_cell_display_for_ui(&CellAddress::new(0, 0))
    };
    let (formula_value, set_formula_value) = signal(initial_formula_value);

    // Get initial mode from controller
    let initial_mode = controller.borrow().get_state().spreadsheet_mode();

    // Update formula bar when active cell changes
    let _ctrl_for_effect = controller.clone();
    // Removed duplicate create_effect - we have the better one below
    let (current_mode, set_current_mode) = signal(initial_mode);

    // State version to trigger updates when UIState changes internally
    let (state_version, set_state_version) = signal(0u32);

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
    let (sheets, _set_sheets) = signal(initial_sheets);

    // Selection statistics (will be calculated from selection)
    let (selection_stats, set_selection_stats) = signal(SelectionStats::default());

    // Keyboard-only mode state
    let (keyboard_only_mode, set_keyboard_only_mode) = signal(false);

    // Update selection stats when the cursor or selection changes
    let controller_for_stats = controller.clone();
    Effect::new(move |_| {
        // Track active cell changes to trigger recalculation
        let _ = active_cell.get();

        // Get the current selection stats from the controller
        let stats = controller_for_stats.borrow().get_current_selection_stats();
        set_selection_stats.set(stats);
    });

    // Update formula bar when active cell changes (but not during editing)
    let controller_for_effect = controller.clone();
    Effect::new(move |_| {
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
            let value = ctrl_borrowed.get_cell_display_for_ui(&cell);
            set_formula_value.set(value);
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
                let ctrl_borrow = ctrl.borrow();
                let facade = ctrl_borrow.get_facade();
                match facade.set_cell_value(&cell, &value) {
                    Ok(_) => {
                        // Check if the cell now contains an error value
                        if let Some(gridcore_core::types::CellValue::Error(error_type)) =
                            facade.get_cell_raw_value(&cell)
                        {
                            // Display the error with both code and description
                            set_errors.update(|errs| {
                                errs.push(ErrorMessage {
                                    message: error_type.full_display(),
                                    severity: ErrorSeverity::Error,
                                    id: errs.len(),
                                });
                            });
                            leptos::logging::log!(
                                "Formula error detected: {}",
                                error_type.full_display()
                            );
                            // Don't clear the formula bar when there's an error - keep it for editing
                        } else {
                            // Only clear formula bar on successful evaluation
                            set_formula_value.set(String::new());
                        }
                    }
                    Err(e) => {
                        // Display error to user for setting errors
                        let error_msg = if value.starts_with('=') {
                            format!("Formula error: {}", e)
                        } else {
                            format!("Error: {}", e)
                        };
                        set_errors.update(|errs| {
                            errs.push(ErrorMessage {
                                message: error_msg,
                                severity: ErrorSeverity::Error,
                                id: errs.len(),
                            });
                        });
                        leptos::logging::log!("Error setting cell value: {}", e);
                    }
                }
            }
        }
    };

    // Initialize test data with error handling after ErrorDisplay is mounted
    let controller_for_init = controller.clone();
    Effect::new(move |_| {
        if !init_data.get() {
            init_data.set(true);

            let ctrl = controller_for_init.borrow();
            let facade = ctrl.get_facade();

            // Initialize test data with proper error handling
            let test_data = vec![
                (CellAddress::new(0, 0), "Hello"),  // A1
                (CellAddress::new(1, 0), "World"),  // B1
                (CellAddress::new(0, 1), "123"),    // A2
                (CellAddress::new(1, 1), "123"),    // B2
                (CellAddress::new(2, 1), "=A2+B2"), // C2
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
                <div class="toolbar-row">
                    <button class="toolbar-button">"Import"</button>
                    <button class="toolbar-button">"Export"</button>
                    <label style="margin-left: 20px;">
                        <input
                            type="checkbox"
                            on:change=move |ev| {
                                let checked = event_target_checked(&ev);
                                crate::debug::set_debug_mode(checked);
                            }
                        />
                        " Debug Mode"
                    </label>
                    <label style="margin-left: 10px;">
                        <input
                            type="checkbox"
                            prop:checked=move || keyboard_only_mode.get()
                            on:change=move |ev| {
                                let checked = event_target_checked(&ev);
                                set_keyboard_only_mode.set(checked);
                                leptos::logging::log!("Keyboard-only mode toggled: {}", checked);
                            }
                        />
                        " Keyboard Only"
                    </label>
                </div>
                <div class="formula-bar">
                    <input
                        type="text"
                        class="cell-indicator"
                        value=move || {
                            let cell = active_cell.get();
                            // Use core's column label implementation for consistency
                            let col = gridcore_core::types::CellAddress::column_number_to_label(cell.col);
                            let row = (cell.row + 1).to_string();
                            let result = format!("{}{}", col, row);
                            leptos::logging::log!("Cell indicator update: col={}, row={}, display={}", cell.col, cell.row, result);
                            result
                        }
                        readonly=true
                    />
                    <span class="formula-fx">"fx"</span>
                    <input
                        type="text"
                        class="formula-input"
                        placeholder="Enter formula or value"
                        value=move || {
                            let value = formula_value.get();
                            leptos::logging::log!("Formula bar value update: {}", value);
                            value
                        }
                        on:input=move |ev| {
                            let new_value = event_target_value(&ev);
                            leptos::logging::log!("Formula bar input change: {}", new_value);
                            set_formula_value.set(new_value);
                        }
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
                    state_version=state_version
                    set_state_version=set_state_version
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
                    state_version=state_version
                />
            </div>

            // Add error display overlay
            <ErrorDisplay errors=errors set_errors=set_errors />
        </div>
    }
}
