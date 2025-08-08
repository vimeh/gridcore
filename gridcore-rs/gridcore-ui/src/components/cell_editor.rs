use gridcore_controller::controller::SpreadsheetController;
use gridcore_controller::state::{Action, UIState, CellMode, InsertMode};
use gridcore_core::types::CellAddress;
use leptos::html::Input;
use leptos::*;
use std::cell::RefCell;
use std::rc::Rc;
use web_sys::KeyboardEvent;

#[component]
pub fn CellEditor(
    active_cell: ReadSignal<CellAddress>,
    editing_mode: ReadSignal<bool>,
    set_editing_mode: WriteSignal<bool>,
    cell_position: ReadSignal<(f64, f64, f64, f64)>, // x, y, width, height
    set_formula_value: WriteSignal<String>,
) -> impl IntoView {
    // Get controller from context
    let controller: Rc<RefCell<SpreadsheetController>> =
        use_context().expect("SpreadsheetController not found in context");

    let input_ref = create_node_ref::<Input>();
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
            let cell = active_cell.get();
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
                    gridcore_controller::state::UIState::Editing { edit_variant, .. } => {
                        if let Some(variant) = edit_variant {
                            match variant {
                                InsertMode::A | InsertMode::CapitalA => {
                                    // Append modes - cursor at end
                                    // Use set_timeout to ensure the value is set first
                                    let input_clone = input_ref.clone();
                                    set_timeout(move || {
                                        if let Some(input) = input_clone.get() {
                                            let len = input.value().len();
                                            let _ = input.set_selection_start(Some(len as u32));
                                            let _ = input.set_selection_end(Some(len as u32));
                                        }
                                    }, std::time::Duration::from_millis(0));
                                }
                                _ => {
                                    // Other modes - cursor at beginning or specified position
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

                // Submit the value
                let value = editor_value.get();
                let cell = active_cell.get();
                let ctrl = ctrl_submit.clone();

                if !value.is_empty() {
                    if let Err(e) = ctrl.borrow().get_facade().set_cell_value(&cell, &value) {
                        leptos::logging::log!("Error setting cell value: {:?}", e);
                    }
                }

                // Exit editing mode
                set_editing_mode.set(false);
                let mut ctrl_mut = ctrl.borrow_mut();
                if let Err(e) = ctrl_mut.dispatch_action(Action::ExitToNavigation) {
                    leptos::logging::log!("Error exiting edit mode: {:?}", e);
                }
            }
            "Escape" => {
                ev.prevent_default();
                
                let ctrl = ctrl_cancel.clone();
                let (is_insert_mode, is_normal_mode) = {
                    let ctrl_borrow = ctrl.borrow();
                    match ctrl_borrow.get_state() {
                        UIState::Editing { cell_mode, .. } => {
                            match cell_mode {
                                CellMode::Insert => (true, false),
                                CellMode::Normal => (false, true),
                                _ => (false, false),
                            }
                        }
                        _ => (false, false),
                    }
                };
                
                if is_insert_mode {
                    // First Escape: go from Insert to Normal mode (stay in editor)
                    let mut ctrl_mut = ctrl.borrow_mut();
                    if let Err(e) = ctrl_mut.dispatch_action(Action::ExitInsertMode) {
                        leptos::logging::log!("Error exiting insert mode: {:?}", e);
                    }
                } else if is_normal_mode {
                    // Second Escape: save and exit to navigation
                    // First save the value
                    let value = editor_value.get();
                    let cell = active_cell.get();
                    
                    if !value.is_empty() {
                        let ctrl_borrow = ctrl.borrow();
                        let facade = ctrl_borrow.get_facade();
                        if let Err(e) = facade.set_cell_value(&cell, &value) {
                            leptos::logging::log!("Error setting cell value: {:?}", e);
                        }
                    }
                    
                    // Then exit editing
                    set_editing_mode.set(false);
                    set_suggestions.set(Vec::new());
                    set_selected_suggestion.set(None);
                    
                    let mut ctrl_mut = ctrl.borrow_mut();
                    if let Err(e) = ctrl_mut.dispatch_action(Action::ExitToNavigation) {
                        leptos::logging::log!("Error exiting edit mode: {:?}", e);
                    }
                    
                    // Update formula bar
                    set_formula_value.set(value);
                } else {
                    // Not in expected state - just exit
                    set_editing_mode.set(false);
                    let mut ctrl_mut = ctrl.borrow_mut();
                    let _ = ctrl_mut.dispatch_action(Action::ExitToNavigation);
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
            _ => {}
        }
    });

    view! {
        <Show when=move || editing_mode.get()>
            <div
                class="cell-editor-overlay"
                style=move || {
                    let (x, y, width, height) = cell_position.get();
                    format!(
                        "position: absolute; left: {}px; top: {}px; width: {}px; height: {}px; z-index: 1000;",
                        x, y, width, height
                    )
                }
            >
                <input
                    node_ref=input_ref
                    type="text"
                    value=move || editor_value.get()
                    on:input=move |ev| set_editor_value.set(event_target_value(&ev))
                    on:keydown={let on_keydown = on_keydown.clone(); move |ev| on_keydown(ev)}
                    style="width: 100%; height: 100%; border: 2px solid #4285f4; padding: 2px 4px; font-family: monospace; font-size: 13px; outline: none;"
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
