use crate::components::error_display::use_error_context;
use gridcore_controller::controller::SpreadsheetController;
use gridcore_controller::state::{Action, CellMode, InsertMode, SpreadsheetMode, UIState};
use gridcore_core::types::CellAddress;
use leptos::html::Textarea;
use leptos::*;
use std::cell::RefCell;
use std::rc::Rc;
use wasm_bindgen::JsCast;
use web_sys::KeyboardEvent;

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
    let controller: Rc<RefCell<SpreadsheetController>> =
        use_context().expect("SpreadsheetController not found in context");

    let input_ref = create_node_ref::<Textarea>();
    let (editor_value, set_editor_value) = create_signal(String::new());
    let (suggestions, set_suggestions) = create_signal::<Vec<String>>(Vec::new());
    let (selected_suggestion, set_selected_suggestion) = create_signal::<Option<usize>>(None);

    // Clone controller refs for closures
    let ctrl_value = controller.clone();
    let ctrl_submit = controller.clone();
    let ctrl_cancel = controller.clone();

    // Initialize editor value when entering edit mode
    create_effect(move |_| {
        if editing_mode.get() {
            let _cell = active_cell.get();
            let ctrl = ctrl_value.clone();
            let ctrl_borrow = ctrl.borrow();

            // Check the current editing state to get initial value and edit mode
            let editing_state = ctrl_borrow.get_state();

            let (should_set_cursor_pos, cursor_pos_to_set) = match editing_state {
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

            // Focus the input and set cursor position
            if let Some(input) = input_ref.get() {
                let _ = input.focus();

                // Set cursor position if needed (for direct typing)
                if should_set_cursor_pos {
                    let _ = input.set_selection_start(Some(cursor_pos_to_set as u32));
                    let _ = input.set_selection_end(Some(cursor_pos_to_set as u32));
                }

                // Set cursor position based on edit mode
                match editing_state {
                    gridcore_controller::state::UIState::Editing {
                        edit_variant,
                        cursor_position,
                        ..
                    } => {
                        if let Some(variant) = edit_variant {
                            match variant {
                                InsertMode::I => {
                                    // Insert mode 'i' - cursor at beginning
                                    // Only set to 0 if we're not direct typing (direct typing has cursor_position > 0)
                                    // Direct typing already has the correct cursor position from state
                                    if *cursor_position == 0 {
                                        // This is 'i' key press on existing content, not direct typing
                                        let _ = input.set_selection_start(Some(0));
                                        let _ = input.set_selection_end(Some(0));
                                    }
                                }
                                InsertMode::CapitalI => {
                                    // Insert mode 'I' - cursor at beginning of line
                                    // Use set_timeout to ensure the value is set first
                                    let input_clone = input_ref.clone();
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
                                    // Append mode 'a' - cursor after current position (at end)
                                    // Set immediately without timeout since we need cursor position right away
                                    let len = input.value().len();
                                    let _ = input.set_selection_start(Some(len as u32));
                                    let _ = input.set_selection_end(Some(len as u32));
                                }
                                InsertMode::CapitalA => {
                                    // Append mode 'A' - cursor at end of line
                                    // Use set_timeout to ensure the value is set first
                                    let input_clone = input_ref.clone();
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
                    _ => {}
                }
            }
        }
    });

    // Handle formula autocomplete
    create_effect(move |_| {
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

    let on_keydown = Rc::new(move |ev: KeyboardEvent| {
        let key = ev.key();
        let suggestions_list = suggestions.get();

        match key.as_str() {
            "Enter" => {
                // Check current editing mode
                let ctrl = ctrl_submit.clone();
                let is_insert_mode = {
                    let ctrl_borrow = ctrl.borrow();
                    matches!(
                        ctrl_borrow.get_state(),
                        UIState::Editing {
                            cell_mode: CellMode::Insert,
                            ..
                        }
                    )
                };

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
                    }
                    return; // Don't save, just add newline
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
                    {
                        let ctrl_borrow = ctrl.borrow();
                        let facade = ctrl_borrow.get_facade();
                        match facade.set_cell_value(&cell, &value) {
                            Ok(_) => {
                                // Check if the cell now contains an error value
                                if let Ok(cell_value) = facade.get_cell_value(&cell) {
                                    if let gridcore_core::types::CellValue::Error(error_msg) =
                                        cell_value
                                    {
                                        // Display the Excel-style error directly
                                        if let Some(error_ctx) = use_error_context() {
                                            error_ctx.show_error(error_msg.clone());
                                        }
                                        leptos::logging::log!(
                                            "Formula error detected: {}",
                                            error_msg
                                        );
                                    }
                                }
                            }
                            Err(e) => {
                                // Display error to user for setting errors
                                if let Some(error_ctx) = use_error_context() {
                                    let error_msg = if value.starts_with('=') {
                                        format!("Formula error: {}", e)
                                    } else {
                                        format!("Error: {}", e)
                                    };
                                    error_ctx.show_error(error_msg);
                                }
                                leptos::logging::log!("Error setting cell value: {:?}", e);
                            }
                        }
                    } // ctrl_borrow is dropped here

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

                    let mut ctrl_mut = ctrl.borrow_mut();
                    if let Err(e) = ctrl_mut.dispatch_action(Action::ExitToNavigation) {
                        leptos::logging::log!("Error exiting edit mode: {:?}", e);
                    }

                    // Update formula bar with the saved value
                    set_formula_value.set(value.clone());
                }
            }
            "Escape" => {
                ev.prevent_default();

                let ctrl = ctrl_cancel.clone();
                let (is_insert_mode, is_normal_mode, is_visual_mode) = {
                    let ctrl_borrow = ctrl.borrow();
                    match ctrl_borrow.get_state() {
                        UIState::Editing { cell_mode, .. } => match cell_mode {
                            CellMode::Insert => (true, false, false),
                            CellMode::Normal => (false, true, false),
                            CellMode::Visual => (false, false, true),
                        },
                        _ => (false, false, false),
                    }
                };

                if is_insert_mode {
                    // First Escape: go from Insert to Normal mode (stay in editor)
                    {
                        let mut ctrl_mut = ctrl.borrow_mut();
                        if let Err(e) = ctrl_mut.dispatch_action(Action::ExitInsertMode) {
                            leptos::logging::log!("Error exiting insert mode: {:?}", e);
                        }
                    } // Drop the borrow before updating the signal
                      // Update the mode to Editing (which shows as NORMAL in vim style)
                    set_current_mode.set(SpreadsheetMode::Editing);
                } else if is_visual_mode {
                    // Escape from visual mode goes to normal mode
                    {
                        let mut ctrl_mut = ctrl.borrow_mut();
                        if let Err(e) = ctrl_mut.dispatch_action(Action::ExitVisualMode) {
                            leptos::logging::log!("Error exiting visual mode: {:?}", e);
                        }
                    } // Drop the borrow before updating the signal
                      // Update the mode to Editing (which shows as NORMAL)
                    set_current_mode.set(SpreadsheetMode::Editing);
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
                    {
                        let ctrl_borrow = ctrl.borrow();
                        let facade = ctrl_borrow.get_facade();
                        match facade.set_cell_value(&cell, &value) {
                            Ok(_) => {
                                // Check if the cell now contains an error value
                                if let Ok(cell_value) = facade.get_cell_value(&cell) {
                                    if let gridcore_core::types::CellValue::Error(error_msg) =
                                        cell_value
                                    {
                                        // Display the Excel-style error directly
                                        if let Some(error_ctx) = use_error_context() {
                                            error_ctx.show_error(error_msg.clone());
                                        }
                                        leptos::logging::log!(
                                            "Formula error detected: {}",
                                            error_msg
                                        );
                                    }
                                }
                            }
                            Err(e) => {
                                // Display error to user for setting errors
                                if let Some(error_ctx) = use_error_context() {
                                    let error_msg = if value.starts_with('=') {
                                        format!("Formula error: {}", e)
                                    } else {
                                        format!("Error: {}", e)
                                    };
                                    error_ctx.show_error(error_msg);
                                }
                                leptos::logging::log!("Error setting cell value: {:?}", e);
                            }
                        }
                    }

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

                    {
                        let mut ctrl_mut = ctrl.borrow_mut();
                        if let Err(e) = ctrl_mut.dispatch_action(Action::Escape) {
                            leptos::logging::log!("Error exiting edit mode: {:?}", e);
                        }
                    } // Drop the borrow

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
                    let mut ctrl_mut = ctrl.borrow_mut();
                    let _ = ctrl_mut.dispatch_action(Action::Escape);
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
                let ctrl = controller.clone();
                let is_normal_mode = {
                    let ctrl_borrow = ctrl.borrow();
                    matches!(
                        ctrl_borrow.get_state(),
                        UIState::Editing {
                            cell_mode: CellMode::Normal,
                            ..
                        }
                    )
                };

                if is_normal_mode {
                    match key.as_str() {
                        "i" => {
                            // Enter insert mode at current position
                            ev.prevent_default();
                            {
                                let mut ctrl_mut = ctrl.borrow_mut();
                                if let Err(e) = ctrl_mut.dispatch_action(Action::EnterInsertMode {
                                    mode: Some(InsertMode::I),
                                }) {
                                    leptos::logging::log!("Error entering insert mode: {:?}", e);
                                }
                            } // Drop the borrow before updating signal
                            set_current_mode.set(SpreadsheetMode::Insert);
                        }
                        "a" => {
                            // Enter insert mode after current position
                            ev.prevent_default();
                            {
                                let mut ctrl_mut = ctrl.borrow_mut();
                                if let Err(e) = ctrl_mut.dispatch_action(Action::EnterInsertMode {
                                    mode: Some(InsertMode::A),
                                }) {
                                    leptos::logging::log!("Error entering insert mode: {:?}", e);
                                }
                            } // Drop the borrow before updating signal
                            set_current_mode.set(SpreadsheetMode::Insert);
                        }
                        "v" => {
                            // Enter visual character mode
                            ev.prevent_default();
                            use gridcore_controller::state::VisualMode;
                            {
                                let mut ctrl_mut = ctrl.borrow_mut();
                                if let Err(e) = ctrl_mut.dispatch_action(Action::EnterVisualMode {
                                    visual_type: VisualMode::Character,
                                    anchor: Some(0), // Start selection at current cursor position
                                }) {
                                    leptos::logging::log!("Error entering visual mode: {:?}", e);
                                }
                            } // Drop the borrow before updating signal
                              // Update mode to Visual
                            set_current_mode.set(SpreadsheetMode::Visual);
                        }
                        "V" => {
                            // Enter visual line mode
                            ev.prevent_default();
                            use gridcore_controller::state::VisualMode;
                            {
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
                            } // Drop the borrow before updating signal
                              // Update mode to Visual (the status bar will check the visual type)
                            set_current_mode.set(SpreadsheetMode::Visual);
                        }
                        "I" => {
                            // Enter insert mode at beginning of line
                            ev.prevent_default();
                            {
                                let mut ctrl_mut = ctrl.borrow_mut();
                                if let Err(e) = ctrl_mut.dispatch_action(Action::EnterInsertMode {
                                    mode: Some(InsertMode::CapitalI),
                                }) {
                                    leptos::logging::log!(
                                        "Error entering insert mode (I): {:?}",
                                        e
                                    );
                                }
                            } // Drop the borrow before updating signal
                            set_current_mode.set(SpreadsheetMode::Insert);
                        }
                        "A" => {
                            // Enter insert mode at end of line
                            ev.prevent_default();
                            {
                                let mut ctrl_mut = ctrl.borrow_mut();
                                if let Err(e) = ctrl_mut.dispatch_action(Action::EnterInsertMode {
                                    mode: Some(InsertMode::CapitalA),
                                }) {
                                    leptos::logging::log!(
                                        "Error entering insert mode (A): {:?}",
                                        e
                                    );
                                }
                            } // Drop the borrow before updating signal
                            set_current_mode.set(SpreadsheetMode::Insert);
                        }
                        _ => {}
                    }
                }
            }
        }
    });

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
                    on:keydown={let on_keydown = on_keydown.clone(); move |ev| on_keydown(ev)}
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
