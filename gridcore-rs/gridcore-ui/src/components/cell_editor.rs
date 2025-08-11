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

#[component]
pub fn CellEditor(
    active_cell: ReadSignal<CellAddress>,
    editing_mode: Memo<bool>,
    cell_position: Memo<(f64, f64, f64, f64)>, // x, y, width, height
    set_current_mode: WriteSignal<SpreadsheetMode>,
    _set_state_version: WriteSignal<u32>,
) -> impl IntoView {
    // Get controller from context
    let controller_stored: StoredValue<Rc<RefCell<SpreadsheetController>>, LocalStorage> =
        use_context().expect("SpreadsheetController not found in context");
    let controller = controller_stored.with_value(|c| c.clone());

    let input_ref = NodeRef::<Textarea>::new();
    let (suggestions, set_suggestions) = signal::<Vec<String>>(Vec::new());
    let (selected_suggestion, set_selected_suggestion) = signal::<Option<usize>>(None);

    // Store controller refs for closures using LocalStorage
    let ctrl_value = controller.clone();
    let _ctrl_submit_stored = StoredValue::<_, LocalStorage>::new_local(controller.clone());
    let _ctrl_cancel_stored = StoredValue::<_, LocalStorage>::new_local(controller.clone());

    // Initialize editor when entering edit mode
    Effect::new(move |_| {
        if editing_mode.get() {
            let _cell = active_cell.get();
            let ctrl = ctrl_value.clone();
            let ctrl_borrow = ctrl.borrow();

            // Get the current editing state
            let editing_state = ctrl_borrow.get_state();

            if let gridcore_controller::state::UIState::Editing {
                editing_value,
                cursor_position,
                ..
            } = editing_state
            {
                // Focus the input and set value and cursor from controller state
                if let Some(input) = input_ref.get() {
                    // Focus immediately
                    let _ = input.focus();

                    // Set the value from controller state
                    input.set_value(editing_value);

                    // Set cursor position from controller state
                    let _ = input.set_selection_start(Some(*cursor_position as u32));
                    let _ = input.set_selection_end(Some(*cursor_position as u32));
                    leptos::logging::log!(
                        "Initialized editor with value '{}' and cursor at {}",
                        editing_value,
                        cursor_position
                    );
                }
            }
        }
    });

    // Create a derived signal for the current editing value from controller
    let current_editing_value = Signal::derive(move || {
        controller_stored.with_value(|ctrl| {
            let ctrl_borrow = ctrl.borrow();
            if let gridcore_controller::state::UIState::Editing { editing_value, .. } =
                ctrl_borrow.get_state()
            {
                editing_value.clone()
            } else {
                String::new()
            }
        })
    });

    // Handle formula autocomplete using controller's AutocompleteManager
    Effect::new(move |_| {
        let value = current_editing_value.get();

        // Get suggestions from the controller's AutocompleteManager
        let suggestions = controller_stored.with_value(|ctrl| {
            let ctrl_borrow = ctrl.borrow();
            let cursor_pos = if let Some(input) = input_ref.get() {
                input.selection_start().unwrap_or(Some(0)).unwrap_or(0) as usize
            } else {
                value.len()
            };

            let autocomplete_manager = ctrl_borrow.get_autocomplete_manager();
            let suggestions = autocomplete_manager.get_suggestions(&value, cursor_pos);

            // Convert to simple string suggestions for the UI
            suggestions
                .into_iter()
                .map(|s| s.value().to_string())
                .collect::<Vec<String>>()
        });

        set_suggestions.set(suggestions.clone());
        if !suggestions.is_empty() {
            set_selected_suggestion.set(Some(0));
        } else {
            set_selected_suggestion.set(None);
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
                    on:input=move |ev| {
                        let new_value = event_target_value(&ev);

                        // Get current cursor position
                        let cursor_pos = if let Some(input) = input_ref.get() {
                            input.selection_start().unwrap_or(Some(0)).unwrap_or(0) as usize
                        } else {
                            new_value.len()
                        };

                        leptos::logging::log!(
                            "Input event: new value = '{}', cursor at {}",
                            new_value,
                            cursor_pos
                        );

                        // Update the controller's editing value immediately
                        controller_stored.with_value(|ctrl| {
                            let mut ctrl_mut = ctrl.borrow_mut();
                            if let Err(e) = ctrl_mut.dispatch_action(Action::UpdateEditingValue {
                                value: new_value.clone(),
                                cursor_position: cursor_pos,
                            }) {
                                leptos::logging::log!("Error updating editing value: {:?}", e);
                            }
                        });

                        // Formula bar is now updated via controller events
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

                                        let new_cursor_pos = cursor_pos + 1;

                                        // Update the controller's editing value
                                        controller_stored.with_value(|ctrl| {
                                            let mut ctrl_mut = ctrl.borrow_mut();
                                            if let Err(e) = ctrl_mut.dispatch_action(Action::UpdateEditingValue {
                                                value: new_value.clone(),
                                                cursor_position: new_cursor_pos,
                                            }) {
                                                leptos::logging::log!("Error updating editing value: {:?}", e);
                                            }
                                        });

                                        // Set the value and cursor in the textarea
                                        input.set_value(&new_value);
                                        let _ = input.set_selection_start(Some(new_cursor_pos as u32));
                                        let _ = input.set_selection_end(Some(new_cursor_pos as u32));

                                        // Formula bar is now updated via controller events
                                    }
                                } else {
                                    // Not in INSERT mode - Enter saves and exits
                                    let value = current_editing_value.get();

                                    // Use the new SubmitCellEdit action to handle all submission logic
                                    controller_stored.with_value(|ctrl| {
                                        let mut ctrl_mut = ctrl.borrow_mut();
                                        if let Err(e) = ctrl_mut.dispatch_action(Action::SubmitCellEdit {
                                            value: value.clone(),
                                        }) {
                                            leptos::logging::log!("Error submitting cell edit: {:?}", e);
                                        }
                                    });

                                    // Don't set editing_mode here - canvas_grid manages it based on controller state
                                    // Formula bar is now updated via controller events
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
                                        // Update the mode signal to reflect the change
                                        drop(ctrl_mut);
                                        let new_state = ctrl.borrow().get_state().clone();
                                        let new_mode = new_state.spreadsheet_mode();
                                        set_current_mode.set(new_mode);
                                        // State version now updated via controller events
                                        leptos::logging::log!("Updated mode to {:?} after ExitInsertMode", new_mode);
                                    } else if is_visual_mode {
                                        // Escape from Visual mode goes to Normal mode (stay in editor)
                                        drop(ctrl_borrow);
                                        let mut ctrl_mut = ctrl.borrow_mut();
                                        if let Err(e) = ctrl_mut.dispatch_action(Action::ExitVisualMode) {
                                            leptos::logging::log!("Error exiting visual mode: {:?}", e);
                                        }
                                        // Update the mode signal to reflect the change
                                        drop(ctrl_mut);
                                        let new_state = ctrl.borrow().get_state().clone();
                                        let new_mode = new_state.spreadsheet_mode();
                                        set_current_mode.set(new_mode);
                                        // State version now updated via controller events
                                        leptos::logging::log!("Updated mode to {:?} after ExitVisualMode", new_mode);
                                    } else if is_normal_mode {
                                        // In Normal mode - save and exit
                                        let value = current_editing_value.get();

                                        // Use the consolidated submission action
                                        drop(ctrl_borrow);
                                        let mut ctrl_mut = ctrl.borrow_mut();
                                        if let Err(e) = ctrl_mut.dispatch_action(Action::SubmitCellEdit {
                                            value: value.clone(),
                                        }) {
                                            leptos::logging::log!("Error submitting cell edit: {:?}", e);
                                        }

                                        // Don't set editing_mode here - canvas_grid manages it based on controller state
                                        // Formula bar is now updated via controller events
                                        // Controller will handle mode transition to Navigation

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
                                        // Don't set editing_mode here - canvas_grid manages it based on controller state
                                        // Controller will handle mode transition

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
                                                // Update the mode signal to reflect the change
                                                drop(ctrl_mut);
                                                let new_state = ctrl.borrow().get_state().clone();
                                                let new_mode = new_state.spreadsheet_mode();
                                                set_current_mode.set(new_mode);
                                                // State version now updated via controller events
                                                leptos::logging::log!("Updated mode to {:?} after EnterInsertMode", new_mode);
                                            });
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
                                                // Update the mode signal to reflect the change
                                                drop(ctrl_mut);
                                                let new_state = ctrl.borrow().get_state().clone();
                                                let new_mode = new_state.spreadsheet_mode();
                                                set_current_mode.set(new_mode);
                                                // State version now updated via controller events
                                                leptos::logging::log!("Updated mode to {:?} after EnterInsertMode", new_mode);
                                            });
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
                                            // Controller will handle mode transition to Visual
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
                                            // Controller will handle mode transition to Visual
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
                                                // Update the mode signal to reflect the change
                                                drop(ctrl_mut);
                                                let new_state = ctrl.borrow().get_state().clone();
                                                let new_mode = new_state.spreadsheet_mode();
                                                set_current_mode.set(new_mode);
                                                // State version now updated via controller events
                                                leptos::logging::log!("Updated mode to {:?} after EnterInsertMode (I)", new_mode);
                                            });
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
                                                // Update the mode signal to reflect the change
                                                drop(ctrl_mut);
                                                let new_state = ctrl.borrow().get_state().clone();
                                                let new_mode = new_state.spreadsheet_mode();
                                                set_current_mode.set(new_mode);
                                                // State version now updated via controller events
                                                leptos::logging::log!("Updated mode to {:?} after EnterInsertMode (A)", new_mode);
                                            });
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
                                                let current_value = current_editing_value.get();
                                                let cursor_pos = if let Some(input) = input_ref.get() {
                                                    input.selection_start().unwrap_or(Some(0)).unwrap_or(0) as usize
                                                } else {
                                                    current_value.len()
                                                };

                                                // Use controller's AutocompleteManager to apply the suggestion
                                                let (new_value, new_cursor) = controller_stored.with_value(|ctrl| {
                                                    let ctrl_borrow = ctrl.borrow();
                                                    let manager = ctrl_borrow.get_autocomplete_manager();
                                                    let suggestion = gridcore_controller::managers::autocomplete::AutocompleteSuggestion::Function {
                                                        name: suggestion_for_click.clone(),
                                                        signature: String::new(), // Not needed for application
                                                    };
                                                    manager.apply_suggestion(&current_value, &suggestion, cursor_pos)
                                                });

                                                // Update the controller's editing value
                                                controller_stored.with_value(|ctrl| {
                                                    let mut ctrl_mut = ctrl.borrow_mut();
                                                    if let Err(e) = ctrl_mut.dispatch_action(Action::UpdateEditingValue {
                                                        value: new_value.clone(),
                                                        cursor_position: new_cursor,
                                                    }) {
                                                        leptos::logging::log!("Error updating editing value: {:?}", e);
                                                    }
                                                });

                                                set_suggestions.set(Vec::new());
                                                set_selected_suggestion.set(None);

                                                // Refocus the input and set cursor position
                                                if let Some(input) = input_ref.get() {
                                                    input.set_value(&new_value);
                                                    let _ = input.focus();
                                                    let _ = input.set_selection_start(Some(new_cursor as u32));
                                                    let _ = input.set_selection_end(Some(new_cursor as u32));
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
