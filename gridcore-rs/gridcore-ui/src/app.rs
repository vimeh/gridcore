use crate::components::canvas_grid::CanvasGrid;
use crate::components::error_display::ErrorDisplay;
use crate::components::status_bar::StatusBar;
use crate::components::tab_bar::{Sheet, TabBar};
use gridcore_controller::controller::SpreadsheetController;
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

    // State version to trigger updates when controller events occur
    let (state_version, set_state_version) = signal(0u32);

    // Create formula bar signal that will be synced from controller
    let (formula_bar_value, set_formula_bar_value) = signal(String::new());

    // Set up comprehensive controller event listener
    {
        let set_formula_bar_for_event = set_formula_bar_value;
        let callback = Box::new(
            move |event: &gridcore_controller::controller::events::SpreadsheetEvent| {
                use gridcore_controller::controller::events::SpreadsheetEvent;

                leptos::logging::log!("Controller event received: {:?}", event);

                // Increment state version for any state-changing event
                match event {
                    SpreadsheetEvent::CursorMoved { .. }
                    | SpreadsheetEvent::ViewportChanged { .. }
                    | SpreadsheetEvent::CellEditStarted { .. }
                    | SpreadsheetEvent::CellEditCompleted { .. }
                    | SpreadsheetEvent::CellEditCancelled { .. }
                    | SpreadsheetEvent::SelectionChanged { .. }
                    | SpreadsheetEvent::RangeSelected { .. }
                    | SpreadsheetEvent::ModeChanged { .. }
                    | SpreadsheetEvent::CommandExecuted { .. }
                    | SpreadsheetEvent::CommandCancelled
                    | SpreadsheetEvent::RowsInserted { .. }
                    | SpreadsheetEvent::RowsDeleted { .. }
                    | SpreadsheetEvent::ColumnsInserted { .. }
                    | SpreadsheetEvent::ColumnsDeleted { .. }
                    | SpreadsheetEvent::ColumnResized { .. }
                    | SpreadsheetEvent::RowResized { .. }
                    | SpreadsheetEvent::CellsCopied { .. }
                    | SpreadsheetEvent::CellsCut { .. }
                    | SpreadsheetEvent::CellsPasted { .. }
                    | SpreadsheetEvent::UndoPerformed
                    | SpreadsheetEvent::RedoPerformed
                    | SpreadsheetEvent::FormulaBarUpdated { .. }
                    | SpreadsheetEvent::SheetAdded { .. }
                    | SpreadsheetEvent::SheetRemoved { .. }
                    | SpreadsheetEvent::SheetRenamed { .. }
                    | SpreadsheetEvent::SheetChanged { .. } => {
                        set_state_version.update(|v| *v += 1);
                    }
                    _ => {}
                }

                // Handle specific events
                if let SpreadsheetEvent::FormulaBarUpdated { value } = event {
                    leptos::logging::log!("Formula bar updated: {}", value);
                    set_formula_bar_for_event.set(value.clone());
                }

                // Error handling is now done through the controller's ErrorManager
                if let SpreadsheetEvent::ErrorOccurred { message, severity } = event {
                    leptos::logging::log!(
                        "ErrorOccurred event received: {} ({:?})",
                        message,
                        severity
                    );
                    // The controller's ErrorManager has already added this error
                }
            },
        );
        controller.borrow_mut().subscribe_to_events(callback);
    }

    // Create signals that will be synced with controller state
    let initial_cursor = controller.borrow().get_cursor();
    let (active_cell, set_active_cell) = signal(initial_cursor);

    // Sync active cell from controller state changes
    Effect::new(move |_| {
        // Trigger on state_version change
        let _ = state_version.get();
        controller_stored.with_value(|ctrl| {
            let cursor = ctrl.borrow().get_cursor();
            if active_cell.get() != cursor {
                set_active_cell.set(cursor);
            }
        });
    });

    // Create mode signal that will be synced with controller
    let initial_mode = controller.borrow().get_state().spreadsheet_mode();
    let (current_mode, set_current_mode) = signal(initial_mode);

    // Sync mode from controller state changes
    Effect::new(move |_| {
        // Trigger on state_version change
        let _ = state_version.get();
        controller_stored.with_value(|ctrl| {
            let mode = ctrl.borrow().get_state().spreadsheet_mode();
            if current_mode.get() != mode {
                set_current_mode.set(mode);
            }
        });
    });

    // Sheet management - sync from controller
    let initial_sheets = controller
        .borrow()
        .get_sheets()
        .into_iter()
        .map(|(name, id)| Sheet { id, name })
        .collect::<Vec<_>>();
    let (sheets, set_sheets) = signal(initial_sheets);
    let _initial_active_sheet = controller.borrow().get_active_sheet();
    let (active_sheet, set_active_sheet) = signal(0usize); // For now, we'll use index 0

    // Sync sheets from controller state changes
    Effect::new(move |_| {
        // Trigger on state_version change
        let _ = state_version.get();
        controller_stored.with_value(|ctrl| {
            let new_sheets = ctrl
                .borrow()
                .get_sheets()
                .into_iter()
                .map(|(name, id)| Sheet { id, name })
                .collect::<Vec<_>>();
            set_sheets.set(new_sheets);
        });
    });

    // Keyboard-only mode state
    let (keyboard_only_mode, set_keyboard_only_mode) = signal(false);

    // Derive selection stats from controller state
    let selection_stats = Memo::new(move |_| {
        // Trigger on state_version change
        let _ = state_version.get();
        controller_stored.with_value(|ctrl| ctrl.borrow().get_current_selection_stats())
    });

    // Handle formula bar Enter key
    let on_formula_submit = move |ev: web_sys::KeyboardEvent| {
        if ev.key() == "Enter" {
            ev.prevent_default();

            // Submit formula bar through controller action
            controller_stored.with_value(|ctrl| {
                ctrl.borrow_mut()
                    .dispatch_action(gridcore_controller::state::Action::SubmitFormulaBar)
                    .unwrap_or_else(|e| {
                        leptos::logging::log!("Error submitting formula bar: {}", e);
                    });
            });
        }
    };

    // Initialize test data with error handling after ErrorDisplay is mounted
    Effect::new(move |_| {
        if !init_data.get() {
            init_data.set(true);

            controller_stored.with_value(|ctrl| {
                {
                    let ctrl_borrow = ctrl.borrow();
                    let facade = ctrl_borrow.get_facade();

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
                
                // Update formula bar to show initial cell value
                ctrl.borrow_mut().update_formula_bar_from_cursor();
            });
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
                            let value = formula_bar_value.get();
                            leptos::logging::log!("Formula bar value update: {}", value);
                            value
                        }
                        on:input=move |ev| {
                            let new_value = event_target_value(&ev);
                            leptos::logging::log!("Formula bar input change: {}", new_value);
                            // Update controller's formula bar value
                            controller.borrow_mut().dispatch_action(
                                gridcore_controller::state::Action::UpdateFormulaBar { value: new_value }
                            ).unwrap_or_else(|e| {
                                leptos::logging::log!("Error updating formula bar: {}", e);
                            });
                        }
                        on:keydown=on_formula_submit
                    />
                </div>
            </div>

            <div class="main-content">
                <CanvasGrid
                    active_cell=active_cell
                    set_active_cell=set_active_cell
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
            <ErrorDisplay state_version=state_version />
        </div>
    }
}
