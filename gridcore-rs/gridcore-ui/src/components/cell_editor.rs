// use crate::components::error_display::use_error_context; // TODO: Re-enable when full keyboard support is restored
use gridcore_controller::controller::SpreadsheetController;
use gridcore_controller::state::{actions::Action, InsertMode, SpreadsheetMode};
use gridcore_core::types::CellAddress;
use leptos::html::Textarea;
use leptos::prelude::*;
use std::cell::RefCell;
use std::rc::Rc;
use wasm_bindgen::JsCast;
use web_sys::KeyboardEvent;

/// Convert parse errors to Excel-style error codes with descriptions
#[allow(dead_code)] // TODO: Re-enable when full keyboard support is restored
fn format_parse_error(error: &str, is_formula: bool) -> String {
    // Check for specific error patterns and convert to Excel codes
    if error.contains("#REF!") {
        "#REF! - Invalid reference".to_string()
    } else if error.contains("Unknown function") || error.contains("UNKNOWNFUNC") {
        "#NAME? - Unknown function or name".to_string()
    } else if error.contains("Type mismatch")
        || error.contains("cannot add")
        || error.contains("cannot subtract")
    {
        "#VALUE! - Type mismatch or invalid value".to_string()
    } else if error.contains("Circular") || error.contains("circular") {
        "#CIRC! - Circular reference detected".to_string()
    } else if error.contains("Division by zero") || error.contains("divide by zero") {
        "#DIV/0! - Division by zero".to_string()
    } else if error.contains("expected") || error.contains("found end of input") {
        // Parse errors often mean invalid references
        "#REF! - Invalid reference".to_string()
    } else if is_formula {
        format!("Formula error: {}", error)
    } else {
        format!("Error: {}", error)
    }
}

#[component]
pub fn CellEditor(
    active_cell: ReadSignal<CellAddress>,
    editing_mode: ReadSignal<bool>,
    set_editing_mode: WriteSignal<bool>,
    cell_position: ReadSignal<(f64, f64, f64, f64)>, // x, y, width, height
    set_formula_value: WriteSignal<String>,
    set_current_mode: WriteSignal<SpreadsheetMode>,
) -> impl IntoView {
    // Get controller from context
    let controller_stored: StoredValue<Rc<RefCell<SpreadsheetController>>, LocalStorage> =
        use_context().expect("SpreadsheetController not found in context");
    let controller = controller_stored.with_value(|c| c.clone());

    let input_ref = NodeRef::<Textarea>::new();
    let (editor_value, set_editor_value) = signal(String::new());
    let (suggestions, set_suggestions) = signal::<Vec<String>>(Vec::new());
    let (selected_suggestion, set_selected_suggestion) = signal::<Option<usize>>(None);

    // Store controller refs for closures using LocalStorage
    let ctrl_value = controller.clone();
    let _ctrl_submit_stored = StoredValue::<_, LocalStorage>::new_local(controller.clone());
    let _ctrl_cancel_stored = StoredValue::<_, LocalStorage>::new_local(controller.clone());

    // Initialize editor value when entering edit mode
    Effect::new(move |_| {
        if editing_mode.get() {
            let _cell = active_cell.get();
            let ctrl = ctrl_value.clone();
            let ctrl_borrow = ctrl.borrow();

            // Check the current editing state to get initial value and edit mode
            let editing_state = ctrl_borrow.get_state();

            let (_should_set_cursor_pos, _cursor_pos_to_set) = match editing_state {
                gridcore_controller::state::UIState::Editing {
                    editing_value,

                    cursor_position,
                    ..
                } => {
                    // Always use the editing_value from state
                    // The state machine now properly sets it based on the action:
                    // - For Enter key: empty string (clear content)
                    // - For direct typing: the typed character
                    // - For 'i' key: existing cell content with cursor at 0
                    // - For 'a' key: existing cell content with cursor at end
                    leptos::logging::log!("Setting editor value from state: '{}'", editing_value);
                    set_editor_value.set(editing_value.clone());

                    // Use the cursor position from state
                    (true, *cursor_position)
                }
                _ => {
                    // Not in editing state
                    set_editor_value.set(String::new());
                    (false, 0)
                }
            };

            // Focus the input
            if let Some(input) = input_ref.get() {
                let _ = input.focus();

                // Handle cursor positioning based on whether this is direct typing or edit mode
                if let gridcore_controller::state::UIState::Editing {
                    edit_variant: Some(variant),
                    editing_value,
                    cursor_position,
                    ..
                } = editing_state
                {
                    // Check if this is direct typing (single character with cursor position 1)
                    let is_direct_typing = editing_value.len() == 1 && *cursor_position == 1 && matches!(variant, InsertMode::I);
                    
                    if is_direct_typing {
                        // Direct typing - position cursor after the typed character
                        // Use set_timeout to ensure the value is set first
                        let input_clone = input_ref;
                        set_timeout(
                            move || {
                                if let Some(input) = input_clone.get() {
                                    let _ = input.set_selection_start(Some(1));
                                    let _ = input.set_selection_end(Some(1));
                                }
                            },
                            std::time::Duration::from_millis(0),
                        );
                    } else {
                        // Regular edit mode handling
                        match variant {
                            InsertMode::I => {
                                // Insert mode 'i' - cursor at beginning
                                // Use set_timeout to ensure the value is set first
                                let input_clone = input_ref;
                                set_timeout(
                                    move || {
                                        if let Some(input) = input_clone.get() {
                                            let _ = input.set_selection_start(Some(0));
                                            let _ = input.set_selection_end(Some(0));
                                        }
                                    },
                                    std::time::Duration::from_millis(0),
                                );
                            }
                        InsertMode::CapitalI => {
                            // Insert mode 'I' - cursor at beginning of line
                            // Use set_timeout to ensure the value is set first
                            let input_clone = input_ref;
                            set_timeout(
                                move || {
                                    if let Some(input) = input_clone.get() {
                                        let _ = input.set_selection_start(Some(0));
                                        let _ = input.set_selection_end(Some(0));
                                    }
                                },
                                std::time::Duration::from_millis(0),
                            );
                        }
                        InsertMode::A => {
                            // Append mode 'a' - cursor after current position
                            // The state already has the correct cursor position for 'a' mode
                            // Controller sets it to the end of the text
                            let pos = *cursor_position as u32;
                            let _ = input.set_selection_start(Some(pos));
                            let _ = input.set_selection_end(Some(pos));
                        }
                        InsertMode::CapitalA => {
                            // Append mode 'A' - cursor at end of line
                            // Use set_timeout to ensure the value is set first
                            let input_clone = input_ref;
                            set_timeout(
                                move || {
                                    if let Some(input) = input_clone.get() {
                                        let len = input.value().len();
                                        let _ = input.set_selection_start(Some(len as u32));
                                        let _ = input.set_selection_end(Some(len as u32));
                                    }
                                },
                                std::time::Duration::from_millis(0),
                            );
                        }
                            _ => {
                                // Other modes - use specified position
                            }
                        }
                    }
                }
            }
        }
    });

    // Handle formula autocomplete
    Effect::new(move |_| {
        let value = editor_value.get();
        if value.starts_with('=') {
            // Extract the last word being typed for function suggestions
            let parts: Vec<&str> = value
                .rsplitn(2, |c: char| !c.is_alphanumeric() && c != '_')
                .collect();
            if let Some(prefix) = parts.first() {
                if !prefix.is_empty() {
                    let prefix_upper = prefix.to_uppercase();
                    let mut function_suggestions = vec![];

                    // Common spreadsheet functions
                    let functions = vec![
                        "SUM",
                        "AVERAGE",
                        "COUNT",
                        "MAX",
                        "MIN",
                        "IF",
                        "VLOOKUP",
                        "HLOOKUP",
                        "INDEX",
                        "MATCH",
                        "CONCATENATE",
                        "TODAY",
                        "NOW",
                    ];

                    for func in functions {
                        if func.starts_with(&prefix_upper) {
                            function_suggestions.push(func.to_string());
                        }
                    }

                    set_suggestions.set(function_suggestions.clone());
                    if !function_suggestions.is_empty() {
                        set_selected_suggestion.set(Some(0));
                    }
                } else {
                    set_suggestions.set(Vec::new());
                    set_selected_suggestion.set(None);
                }
            }
        } else {
            set_suggestions.set(Vec::new());
            set_selected_suggestion.set(None);
        }
    });

    // Complex on_keydown handler removed due to Send+Sync issues with Rc<RefCell<>>
    // Using simplified inline handler instead
    /*
    let on_keydown = move |ev: KeyboardEvent| {
        let key = ev.key();
        let suggestions_list = suggestions.get();

        match key.as_str() {
            "Enter" => {
                // Check current editing mode
                let is_insert_mode = ctrl_submit_stored.with_value(|ctrl| {
                    let ctrl_borrow = ctrl.borrow();
                    matches!(
                        ctrl_borrow.get_state(),
                        UIState::Editing {
                            cell_mode: CellMode::Insert,
                            ..
                        }
                    )
                });

                // In Insert mode, Enter adds a newline (Vim behavior)
                // Only save when not in Insert mode or with special modifiers
                if is_insert_mode && !ev.ctrl_key() {
                    // Enter in Insert mode adds a newline
                    ev.prevent_default(); // Prevent form submission

                    // Get current value and cursor position from textarea
                    if let Some(input) = input_ref.get() {
                        let current_value = input.value();
                        let cursor_pos =
                            input.selection_start().unwrap_or(Some(0)).unwrap_or(0) as usize;

                        // Insert newline at cursor position
                        let mut new_value = String::new();
                        new_value.push_str(&current_value[..cursor_pos]);
                        new_value.push('\n');
                        new_value.push_str(&current_value[cursor_pos..]);

                        // Update the value
                        set_editor_value.set(new_value.clone());
                        input.set_value(&new_value);

                        // Set cursor position after the newline
                        let new_cursor_pos = cursor_pos + 1;
                        let _ = input.set_selection_start(Some(new_cursor_pos as u32));
                        let _ = input.set_selection_end(Some(new_cursor_pos as u32));
                    } // Don't save, just add newline
                } else {
                    // Not in Insert mode - Enter saves the value
                    ev.prevent_default();

                    // Check if we should apply a suggestion
                    if !suggestions_list.is_empty() {
                        if let Some(idx) = selected_suggestion.get() {
                            // Apply the selected suggestion
                            let suggestion = &suggestions_list[idx];
                            let current_value = editor_value.get();

                            // Replace the partial function name with the full suggestion
                            let parts: Vec<&str> = current_value
                                .rsplitn(2, |c: char| !c.is_alphanumeric() && c != '_')
                                .collect();
                            if parts.len() == 2 {
                                let new_value = format!("{}{}(", parts[1], suggestion);
                                set_editor_value.set(new_value);
                            }

                            set_suggestions.set(Vec::new());
                            set_selected_suggestion.set(None);
                            return;
                        }
                    }

                    // Submit the value - always read from the textarea element when available
                    // This ensures we get the current value, not a stale one
                    let cell = active_cell.get();

                    // Get the current value - prioritize signal which is updated via on:input
                    // The textarea's value() might not be synchronized in all cases
                    let value = {
                        let signal_value = editor_value.get();

                        // Also check the textarea value for safety
                        if let Some(input) = input_ref.get() {
                            let textarea_value = input.value();
                            // Use textarea value if it's different and not empty
                            if !textarea_value.is_empty() && textarea_value != signal_value {
                                textarea_value
                            } else {
                                signal_value
                            }
                        } else {
                            signal_value
                        }
                    };

                    // Save the cell value
                    ctrl_submit_stored.with_value(|ctrl| {
                        let ctrl_borrow = ctrl.borrow();
                        let facade = ctrl_borrow.get_facade();
                        match facade.set_cell_value(&cell, &value) {
                            Ok(_) => {
                                // Check if the cell now contains an error value
                                if let Some(gridcore_core::types::CellValue::Error(error_type)) =
                                    facade.get_cell_raw_value(&cell)
                                {
                                    // Display the error with both code and description
                                    if let Some(error_ctx) = use_error_context() {
                                        error_ctx.show_error(error_type.full_display());
                                    }
                                    leptos::logging::log!(
                                        "Formula error detected: {}",
                                        error_type.full_display()
                                    );
                                }
                            }
                            Err(e) => {
                                // Display error to user for setting errors
                                if let Some(error_ctx) = use_error_context() {
                                    let error_msg =
                                        format_parse_error(&e.to_string(), value.starts_with('='));
                                    leptos::logging::log!("Showing error: {}", error_msg);
                                    error_ctx.show_error(error_msg);
                                }
                                leptos::logging::log!("Error setting cell value: {:?}", e);
                            }
                        }
                    }); // ctrl_borrow is dropped here

                    // Return focus to grid container before exiting
                    if let Some(window) = web_sys::window() {
                        if let Some(document) = window.document() {
                            if let Some(grid) =
                                document.query_selector(".grid-container").ok().flatten()
                            {
                                if let Ok(html_element) = grid.dyn_into::<web_sys::HtmlElement>() {
                                    let _ = html_element.focus();
                                }
                            }
                        }
                    }

                    // Exit editing mode
                    set_editing_mode.set(false);

                    ctrl_submit_stored.with_value(|ctrl| {
                        let mut ctrl_mut = ctrl.borrow_mut();
                        if let Err(e) = ctrl_mut.dispatch_action(Action::ExitToNavigation) {
                            leptos::logging::log!("Error exiting edit mode: {:?}", e);
                        }
                    });

                    // Update formula bar with the saved value
                    set_formula_value.set(value.clone());
                }
            }
            "Escape" => {
                ev.prevent_default();

                let (is_insert_mode, is_normal_mode, is_visual_mode) = ctrl_cancel_stored.with_value(|ctrl| {
                    let ctrl_borrow = ctrl.borrow();
                    match ctrl_borrow.get_state() {
                        UIState::Editing { cell_mode, .. } => match cell_mode {
                            CellMode::Insert => (true, false, false),
                            CellMode::Normal => (false, true, false),
                            CellMode::Visual => (false, false, true),
                        },
                        _ => (false, false, false),
                    }
                });

                if is_insert_mode {
                    // First Escape: go from Insert to Normal mode (stay in editor)
                    ctrl_cancel_stored.with_value(|ctrl| {
                        let mut ctrl_mut = ctrl.borrow_mut();
                        if let Err(e) = ctrl_mut.dispatch_action(Action::ExitInsertMode) {
                            leptos::logging::log!("Error exiting insert mode: {:?}", e);
                        }
                    }); // Drop the borrow before updating the signal
                      // Update the mode to Editing (which shows as NORMAL in vim style)
                    set_current_mode.set(SpreadsheetMode::Editing);
                } else if is_visual_mode {
                    // Escape from visual mode goes to normal mode
                    leptos::logging::log!("Visual mode escape: transitioning to normal mode");
                    ctrl_cancel_stored.with_value(|ctrl| {
                        let mut ctrl_mut = ctrl.borrow_mut();
                        if let Err(e) = ctrl_mut.dispatch_action(Action::ExitVisualMode) {
                            leptos::logging::log!("Error exiting visual mode: {:?}", e);
                        }
                    }); // Drop the borrow before updating the signal

                    // Force a signal update by temporarily setting a different value
                    // This ensures Leptos triggers a re-render even if the value was already Editing
                    leptos::logging::log!("Visual mode escape: forcing signal update");
                    set_current_mode.set(SpreadsheetMode::Navigation); // Temporary value
                    set_current_mode.set(SpreadsheetMode::Editing); // Actual value (NORMAL mode)
                } else if is_normal_mode {
                    // Second Escape: save and exit to navigation
                    // First save the value - use the same logic as Enter for consistency
                    let cell = active_cell.get();

                    // Get the current value from the textarea or signal (same logic as Enter)
                    let value = if let Some(input) = input_ref.get() {
                        // Always use the textarea's current value
                        input.value()
                    } else {
                        // Fallback to signal if textarea not available
                        editor_value.get()
                    };

                    // Always save the value, even if empty (user might want to clear the cell)
                    ctrl_cancel_stored.with_value(|ctrl| {
                        let ctrl_borrow = ctrl.borrow();
                        let facade = ctrl_borrow.get_facade();
                        match facade.set_cell_value(&cell, &value) {
                            Ok(_) => {
                                // Check if the cell now contains an error value
                                if let Some(gridcore_core::types::CellValue::Error(error_type)) =
                                    facade.get_cell_raw_value(&cell)
                                {
                                    // Display the error with both code and description
                                    if let Some(error_ctx) = use_error_context() {
                                        error_ctx.show_error(error_type.full_display());
                                    }
                                    leptos::logging::log!(
                                        "Formula error detected: {}",
                                        error_type.full_display()
                                    );
                                }
                            }
                            Err(e) => {
                                // Display error to user for setting errors
                                if let Some(error_ctx) = use_error_context() {
                                    let error_msg =
                                        format_parse_error(&e.to_string(), value.starts_with('='));
                                    leptos::logging::log!("Showing error: {}", error_msg);
                                    error_ctx.show_error(error_msg);
                                }
                                leptos::logging::log!("Error setting cell value: {:?}", e);
                            }
                        }
                    });

                    // Return focus to grid container before exiting
                    if let Some(window) = web_sys::window() {
                        if let Some(document) = window.document() {
                            if let Some(grid) =
                                document.query_selector(".grid-container").ok().flatten()
                            {
                                if let Ok(html_element) = grid.dyn_into::<web_sys::HtmlElement>() {
                                    let _ = html_element.focus();
                                }
                            }
                        }
                    }

                    // Then exit editing
                    set_editing_mode.set(false);
                    set_suggestions.set(Vec::new());
                    set_selected_suggestion.set(None);

                    ctrl_cancel_stored.with_value(|ctrl| {
                        let mut ctrl_mut = ctrl.borrow_mut();
                        if let Err(e) = ctrl_mut.dispatch_action(Action::Escape) {
                            leptos::logging::log!("Error exiting edit mode: {:?}", e);
                        }
                    }); // Drop the borrow

                    // Update mode to Navigation
                    set_current_mode.set(SpreadsheetMode::Navigation);

                    // Update formula bar
                    set_formula_value.set(value);
                } else {
                    // Return focus to grid container before exiting
                    if let Some(window) = web_sys::window() {
                        if let Some(document) = window.document() {
                            if let Some(grid) =
                                document.query_selector(".grid-container").ok().flatten()
                            {
                                if let Ok(html_element) = grid.dyn_into::<web_sys::HtmlElement>() {
                                    let _ = html_element.focus();
                                }
                            }
                        }
                    }

                    // Not in expected state - just exit
                    set_editing_mode.set(false);
                    ctrl_cancel_stored.with_value(|ctrl| {
                        let mut ctrl_mut = ctrl.borrow_mut();
                        let _ = ctrl_mut.dispatch_action(Action::Escape);
                    });
                    set_current_mode.set(SpreadsheetMode::Navigation);
                }
            }
            "ArrowDown" => {
                if !suggestions_list.is_empty() {
                    ev.prevent_default();
                    let current = selected_suggestion.get().unwrap_or(0);
                    let next = (current + 1) % suggestions_list.len();
                    set_selected_suggestion.set(Some(next));
                }
            }
            "ArrowUp" => {
                if !suggestions_list.is_empty() {
                    ev.prevent_default();
                    let current = selected_suggestion.get().unwrap_or(0);
                    let prev = if current == 0 {
                        suggestions_list.len() - 1
                    } else {
                        current - 1
                    };
                    set_selected_suggestion.set(Some(prev));
                }
            }
            "Tab" => {
                if !suggestions_list.is_empty() {
                    ev.prevent_default();
                    // Apply the first/selected suggestion
                    let idx = selected_suggestion.get().unwrap_or(0);
                    let suggestion = &suggestions_list[idx];
                    let current_value = editor_value.get();

                    let parts: Vec<&str> = current_value
                        .rsplitn(2, |c: char| !c.is_alphanumeric() && c != '_')
                        .collect();
                    if parts.len() == 2 {
                        let new_value = format!("{}{}(", parts[1], suggestion);
                        set_editor_value.set(new_value);
                    }

                    set_suggestions.set(Vec::new());
                    set_selected_suggestion.set(None);
                }
            }
            _ => {
                // Check if we're in Normal mode within editing
                let is_normal_mode = controller_stored.with_value(|ctrl| {
                    let ctrl_borrow = ctrl.borrow();
                    matches!(
                        ctrl_borrow.get_state(),
                        UIState::Editing {
                            cell_mode: CellMode::Normal,
                            ..
                        }
                    )
                });

                if is_normal_mode {
                    match key.as_str() {
                        "i" => {
                            // Enter insert mode at current position
                            ev.prevent_default();
                            controller_stored.with_value(|ctrl| {
                                let mut ctrl_mut = ctrl.borrow_mut();
                                if let Err(e) = ctrl_mut.dispatch_action(Action::EnterInsertMode {
                                    mode: Some(InsertMode::I),
                                }) {
                                    leptos::logging::log!("Error entering insert mode: {:?}", e);
                                }
                            }); // Drop the borrow before updating signal
                            set_current_mode.set(SpreadsheetMode::Insert);
                        }
                        "a" => {
                            // Enter insert mode after current position
                            ev.prevent_default();
                            controller_stored.with_value(|ctrl| {
                                let mut ctrl_mut = ctrl.borrow_mut();
                                if let Err(e) = ctrl_mut.dispatch_action(Action::EnterInsertMode {
                                    mode: Some(InsertMode::A),
                                }) {
                                    leptos::logging::log!("Error entering insert mode: {:?}", e);
                                }
                            }); // Drop the borrow before updating signal
                            set_current_mode.set(SpreadsheetMode::Insert);
                        }
                        "v" => {
                            // Enter visual character mode
                            ev.prevent_default();
                            leptos::logging::log!(
                                "Entering visual character mode from normal mode"
                            );
                            use gridcore_controller::state::VisualMode;
                            controller_stored.with_value(|ctrl| {
                                let mut ctrl_mut = ctrl.borrow_mut();
                                if let Err(e) = ctrl_mut.dispatch_action(Action::EnterVisualMode {
                                    visual_type: VisualMode::Character,
                                    anchor: Some(0), // Start selection at current cursor position
                                }) {
                                    leptos::logging::log!("Error entering visual mode: {:?}", e);
                                }
                            }); // Drop the borrow before updating signal
                              // Update mode to Visual
                            leptos::logging::log!("Setting mode signal to Visual");
                            set_current_mode.set(SpreadsheetMode::Visual);
                        }
                        "V" => {
                            // Enter visual line mode
                            ev.prevent_default();
                            use gridcore_controller::state::VisualMode;
                            controller_stored.with_value(|ctrl| {
                                let mut ctrl_mut = ctrl.borrow_mut();
                                if let Err(e) = ctrl_mut.dispatch_action(Action::EnterVisualMode {
                                    visual_type: VisualMode::Line,
                                    anchor: Some(0), // Start selection at current line
                                }) {
                                    leptos::logging::log!(
                                        "Error entering visual line mode: {:?}",
                                        e
                                    );
                                }
                            }); // Drop the borrow before updating signal
                              // Update mode to Visual (the status bar will check the visual type)
                            set_current_mode.set(SpreadsheetMode::Visual);
                        }
                        "I" => {
                            // Enter insert mode at beginning of line
                            ev.prevent_default();
                            controller_stored.with_value(|ctrl| {
                                let mut ctrl_mut = ctrl.borrow_mut();
                                if let Err(e) = ctrl_mut.dispatch_action(Action::EnterInsertMode {
                                    mode: Some(InsertMode::CapitalI),
                                }) {
                                    leptos::logging::log!(
                                        "Error entering insert mode (I): {:?}",
                                        e
                                    );
                                }
                            }); // Drop the borrow before updating signal
                            set_current_mode.set(SpreadsheetMode::Insert);
                        }
                        "A" => {
                            // Enter insert mode at end of line
                            ev.prevent_default();
                            controller_stored.with_value(|ctrl| {
                                let mut ctrl_mut = ctrl.borrow_mut();
                                if let Err(e) = ctrl_mut.dispatch_action(Action::EnterInsertMode {
                                    mode: Some(InsertMode::CapitalA),
                                }) {
                                    leptos::logging::log!(
                                        "Error entering insert mode (A): {:?}",
                                        e
                                    );
                                }
                            }); // Drop the borrow before updating signal
                            set_current_mode.set(SpreadsheetMode::Insert);
                        }
                        _ => {}
                    }
                }
            }
        }
    };
    */

    view! {
        <Show when=move || editing_mode.get()>
            <div
                class="cell-editor-overlay"
                tabindex="-1"
                style=move || {
                    let (x, y, width, height) = cell_position.get();
                    format!(
                        "position: absolute; left: {}px; top: {}px; width: {}px; height: {}px; z-index: 1000;",
                        x, y, width, height
                    )
                }
            >
                <textarea
                    node_ref=input_ref
                    prop:value=move || editor_value.get()
                    on:input=move |ev| {
                        let new_value = event_target_value(&ev);
                        set_editor_value.set(new_value.clone());
                        // Also update formula bar
                        set_formula_value.set(new_value);
                    }
                    on:keydown=move |ev: KeyboardEvent| {
                        let key = ev.key();

                        match key.as_str() {
                            "Enter" => {
                                ev.prevent_default();
                                
                                // Check if we're in INSERT mode (UIState::Editing with CellMode::Insert)
                                let is_insert_mode = controller_stored.with_value(|ctrl| {
                                    let ctrl_borrow = ctrl.borrow();
                                    matches!(
                                        ctrl_borrow.get_state(),
                                        gridcore_controller::state::UIState::Editing {
                                            cell_mode: gridcore_controller::state::CellMode::Insert,
                                            ..
                                        }
                                    )
                                });

                                if is_insert_mode {
                                    // In INSERT mode, Enter adds a newline
                                    if let Some(input) = input_ref.get() {
                                        let current_value = input.value();
                                        let cursor_pos = input.selection_start().unwrap_or(Some(0)).unwrap_or(0) as usize;
                                        
                                        // Insert newline at cursor position
                                        let mut new_value = String::new();
                                        new_value.push_str(&current_value[..cursor_pos]);
                                        new_value.push('\n');
                                        new_value.push_str(&current_value[cursor_pos..]);
                                        
                                        // Update the value
                                        set_editor_value.set(new_value.clone());
                                        input.set_value(&new_value);
                                        
                                        // Set cursor position after the newline
                                        let new_cursor_pos = cursor_pos + 1;
                                        let _ = input.set_selection_start(Some(new_cursor_pos as u32));
                                        let _ = input.set_selection_end(Some(new_cursor_pos as u32));
                                        
                                        // Update formula bar
                                        set_formula_value.set(new_value);
                                    }
                                } else {
                                    // Not in INSERT mode - Enter saves and exits
                                    let cell = active_cell.get();
                                    let value = editor_value.get();

                                    // Submit the value
                                    controller_stored.with_value(|ctrl| {
                                        let ctrl_borrow = ctrl.borrow();
                                        let facade = ctrl_borrow.get_facade();
                                        let _ = facade.set_cell_value(&cell, &value);
                                    });

                                    set_editing_mode.set(false);
                                    set_formula_value.set(value);
                                }
                            }
                            "Escape" => {
                                ev.prevent_default();
                                
                                // Check the current editing mode
                                controller_stored.with_value(|ctrl| {
                                    let ctrl_borrow = ctrl.borrow();
                                    let (is_insert_mode, is_normal_mode, is_visual_mode) = match ctrl_borrow.get_state() {
                                        gridcore_controller::state::UIState::Editing { cell_mode, .. } => {
                                            match cell_mode {
                                                gridcore_controller::state::CellMode::Insert => (true, false, false),
                                                gridcore_controller::state::CellMode::Normal => (false, true, false),
                                                gridcore_controller::state::CellMode::Visual => (false, false, true),
                                            }
                                        }
                                        _ => (false, false, false),
                                    };
                                    
                                    if is_insert_mode {
                                        // First Escape: go from Insert to Normal mode (stay in editor)
                                        drop(ctrl_borrow);
                                        let mut ctrl_mut = ctrl.borrow_mut();
                                        if let Err(e) = ctrl_mut.dispatch_action(Action::ExitInsertMode) {
                                            leptos::logging::log!("Error exiting insert mode: {:?}", e);
                                        }
                                        // Stay in editing mode but switch to Normal mode
                                        set_current_mode.set(SpreadsheetMode::Editing);
                                    } else if is_visual_mode {
                                        // Escape from Visual mode goes to Normal mode (stay in editor)
                                        drop(ctrl_borrow);
                                        let mut ctrl_mut = ctrl.borrow_mut();
                                        if let Err(e) = ctrl_mut.dispatch_action(Action::ExitVisualMode) {
                                            leptos::logging::log!("Error exiting visual mode: {:?}", e);
                                        }
                                        // Stay in editing mode but switch to Normal mode
                                        set_current_mode.set(SpreadsheetMode::Editing);
                                    } else if is_normal_mode {
                                        // In Normal mode - save and exit
                                        let cell = active_cell.get();
                                        let value = editor_value.get();
                                        
                                        // Save the value
                                        let facade = ctrl_borrow.get_facade();
                                        let _ = facade.set_cell_value(&cell, &value);
                                        
                                        drop(ctrl_borrow);
                                        let mut ctrl_mut = ctrl.borrow_mut();
                                        let _ = ctrl_mut.dispatch_action(Action::Escape);
                                        
                                        // Exit editing mode
                                        set_editing_mode.set(false);
                                        set_formula_value.set(value);
                                        set_current_mode.set(SpreadsheetMode::Navigation);
                                        
                                        // Return focus to grid container
                                        if let Some(window) = web_sys::window() {
                                            if let Some(document) = window.document() {
                                                if let Ok(Some(element)) = document.query_selector(".grid-container") {
                                                    if let Ok(html_element) = element.dyn_into::<web_sys::HtmlElement>() {
                                                        let _ = html_element.focus();
                                                    }
                                                }
                                            }
                                        }
                                    } else {
                                        // Fallback - just exit
                                        drop(ctrl_borrow);
                                        set_editing_mode.set(false);
                                        set_current_mode.set(SpreadsheetMode::Navigation);
                                        
                                        // Return focus to grid container
                                        if let Some(window) = web_sys::window() {
                                            if let Some(document) = window.document() {
                                                if let Ok(Some(element)) = document.query_selector(".grid-container") {
                                                    if let Ok(html_element) = element.dyn_into::<web_sys::HtmlElement>() {
                                                        let _ = html_element.focus();
                                                    }
                                                }
                                            }
                                        }
                                    }
                                });
                            }
                            // Handle vim mode keys in NORMAL mode
                            "i" | "a" | "v" | "V" | "I" | "A" => {
                                // Check if we're in Normal mode within editing
                                let is_normal_mode = controller_stored.with_value(|ctrl| {
                                    let ctrl_borrow = ctrl.borrow();
                                    matches!(
                                        ctrl_borrow.get_state(),
                                        gridcore_controller::state::UIState::Editing {
                                            cell_mode: gridcore_controller::state::CellMode::Normal,
                                            ..
                                        }
                                    )
                                });

                                if is_normal_mode {
                                    ev.prevent_default();
                                    match key.as_str() {
                                        "i" => {
                                            // Enter insert mode at current position
                                            controller_stored.with_value(|ctrl| {
                                                let mut ctrl_mut = ctrl.borrow_mut();
                                                if let Err(e) = ctrl_mut.dispatch_action(Action::EnterInsertMode {
                                                    mode: Some(InsertMode::I),
                                                }) {
                                                    leptos::logging::log!("Error entering insert mode: {:?}", e);
                                                }
                                            });
                                            set_current_mode.set(SpreadsheetMode::Insert);
                                        }
                                        "a" => {
                                            // Enter insert mode after current position
                                            controller_stored.with_value(|ctrl| {
                                                let mut ctrl_mut = ctrl.borrow_mut();
                                                if let Err(e) = ctrl_mut.dispatch_action(Action::EnterInsertMode {
                                                    mode: Some(InsertMode::A),
                                                }) {
                                                    leptos::logging::log!("Error entering insert mode: {:?}", e);
                                                }
                                            });
                                            set_current_mode.set(SpreadsheetMode::Insert);
                                        }
                                        "v" => {
                                            // Enter visual character mode
                                            use gridcore_controller::state::VisualMode;
                                            controller_stored.with_value(|ctrl| {
                                                let mut ctrl_mut = ctrl.borrow_mut();
                                                if let Err(e) = ctrl_mut.dispatch_action(Action::EnterVisualMode {
                                                    visual_type: VisualMode::Character,
                                                    anchor: Some(0),
                                                }) {
                                                    leptos::logging::log!("Error entering visual mode: {:?}", e);
                                                }
                                            });
                                            set_current_mode.set(SpreadsheetMode::Visual);
                                        }
                                        "V" => {
                                            // Enter visual line mode
                                            use gridcore_controller::state::VisualMode;
                                            controller_stored.with_value(|ctrl| {
                                                let mut ctrl_mut = ctrl.borrow_mut();
                                                if let Err(e) = ctrl_mut.dispatch_action(Action::EnterVisualMode {
                                                    visual_type: VisualMode::Line,
                                                    anchor: Some(0),
                                                }) {
                                                    leptos::logging::log!("Error entering visual line mode: {:?}", e);
                                                }
                                            });
                                            set_current_mode.set(SpreadsheetMode::Visual);
                                        }
                                        "I" => {
                                            // Enter insert mode at beginning of line
                                            controller_stored.with_value(|ctrl| {
                                                let mut ctrl_mut = ctrl.borrow_mut();
                                                if let Err(e) = ctrl_mut.dispatch_action(Action::EnterInsertMode {
                                                    mode: Some(InsertMode::CapitalI),
                                                }) {
                                                    leptos::logging::log!("Error entering insert mode (I): {:?}", e);
                                                }
                                            });
                                            set_current_mode.set(SpreadsheetMode::Insert);
                                        }
                                        "A" => {
                                            // Enter insert mode at end of line
                                            controller_stored.with_value(|ctrl| {
                                                let mut ctrl_mut = ctrl.borrow_mut();
                                                if let Err(e) = ctrl_mut.dispatch_action(Action::EnterInsertMode {
                                                    mode: Some(InsertMode::CapitalA),
                                                }) {
                                                    leptos::logging::log!("Error entering insert mode (A): {:?}", e);
                                                }
                                            });
                                            set_current_mode.set(SpreadsheetMode::Insert);
                                        }
                                        _ => {}
                                    }
                                }
                            }
                            _ => {}
                        }
                    }
                    style="width: 100%; height: 100%; border: 2px solid #4285f4; padding: 2px 4px; font-family: monospace; font-size: 13px; outline: none; resize: none; overflow: hidden;"
                />

                <Show when=move || !suggestions.get().is_empty()>
                    <div
                        class="autocomplete-dropdown"
                        style="position: absolute; top: 100%; left: 0; background: white; border: 1px solid #ccc; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); max-height: 150px; overflow-y: auto; z-index: 1001;"
                    >
                        {move || {
                            suggestions
                                .get()
                                .into_iter()
                                .enumerate()
                                .map(|(idx, suggestion)| {
                                    let is_selected = selected_suggestion.get() == Some(idx);
                                    let suggestion_clone = suggestion.clone();
                                    let suggestion_for_click = suggestion.clone();
                                    view! {
                                        <div
                                            on:click=move |_| {
                                                let current_value = editor_value.get();
                                                let parts: Vec<&str> = current_value
                                                    .rsplitn(2, |c: char| !c.is_alphanumeric() && c != '_')
                                                    .collect();
                                                if parts.len() == 2 {
                                                    let new_value = format!("{}{}(", parts[1], suggestion_for_click);
                                                    set_editor_value.set(new_value);
                                                }
                                                set_suggestions.set(Vec::new());
                                                set_selected_suggestion.set(None);
                                                // Refocus the input
                                                if let Some(input) = input_ref.get() {
                                                    let _ = input.focus();
                                                }
                                            }
                                            style=move || {
                                                format!(
                                                    "padding: 4px 8px; cursor: pointer; font-family: monospace; font-size: 12px; {}",
                                                    if is_selected {
                                                        "background: #e3f2fd;"
                                                    } else {
                                                        "background: white;"
                                                    }
                                                )
                                            }
                                            on:mouseenter=move |_| set_selected_suggestion.set(Some(idx))
                                        >
                                            {suggestion_clone}
                                        </div>
                                    }
                                })
                                .collect_view()
                        }}
                    </div>
                </Show>
            </div>
        </Show>
    }
}
