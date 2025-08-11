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

    // State version to trigger updates when controller events occur
    let (state_version, set_state_version) = signal(0u32);

    // Create error handling signals
    let (errors, set_errors) = signal::<Vec<ErrorMessage>>(Vec::new());
    let error_counter = RwSignal::new(0usize);

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

                if let SpreadsheetEvent::ErrorOccurred { message, severity } = event {
                    leptos::logging::log!(
                        "ErrorOccurred event received: {} ({:?})",
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

    // Create signals that will be synced with controller state
    let initial_cursor = controller.borrow().get_cursor();
    let (active_cell, set_active_cell) = signal(initial_cursor);

    // Sync active cell from controller state changes
    let controller_for_active_cell = controller.clone();
    Effect::new(move |_| {
        // Trigger on state_version change
        let _ = state_version.get();
        let cursor = controller_for_active_cell.borrow().get_cursor();
        if active_cell.get() != cursor {
            set_active_cell.set(cursor);
        }
    });

    // Create mode signal that will be synced with controller
    let initial_mode = controller.borrow().get_state().spreadsheet_mode();
    let (current_mode, set_current_mode) = signal(initial_mode);

    // Sync mode from controller state changes
    let controller_for_mode = controller.clone();
    Effect::new(move |_| {
        // Trigger on state_version change
        let _ = state_version.get();
        let mode = controller_for_mode.borrow().get_state().spreadsheet_mode();
        if current_mode.get() != mode {
            set_current_mode.set(mode);
        }
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
    let controller_for_sheets = controller.clone();
    Effect::new(move |_| {
        // Trigger on state_version change
        let _ = state_version.get();
        let new_sheets = controller_for_sheets
            .borrow()
            .get_sheets()
            .into_iter()
            .map(|(name, id)| Sheet { id, name })
            .collect::<Vec<_>>();
        set_sheets.set(new_sheets);
    });

    // Keyboard-only mode state
    let (keyboard_only_mode, set_keyboard_only_mode) = signal(false);

    // Keep selection stats as signal for now since SelectionStats doesn't implement PartialEq
    let (selection_stats, set_selection_stats) = signal(SelectionStats::default());

    // Update selection stats when state changes
    let controller_for_stats = controller.clone();
    Effect::new(move |_| {
        // Trigger on state_version change
        let _ = state_version.get();
        let stats = controller_for_stats.borrow().get_current_selection_stats();
        set_selection_stats.set(stats);
    });

    // Handle formula bar Enter key
    let controller_for_submit = controller.clone();
    let on_formula_submit = move |ev: web_sys::KeyboardEvent| {
        if ev.key() == "Enter" {
            ev.prevent_default();

            // Submit formula bar through controller action
            controller_for_submit
                .borrow_mut()
                .dispatch_action(gridcore_controller::state::Action::SubmitFormulaBar)
                .unwrap_or_else(|e| {
                    leptos::logging::log!("Error submitting formula bar: {}", e);
                });
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
            <ErrorDisplay errors=errors set_errors=set_errors />
        </div>
    }
}
