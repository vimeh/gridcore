use crate::context::use_controller;
use gridcore_controller::state::actions::Action;
use gridcore_core::types::CellAddress;
use leptos::html::Textarea;
use leptos::prelude::*;
use wasm_bindgen::JsCast;
use web_sys::KeyboardEvent;

#[component]
pub fn CellEditor(
    active_cell: Memo<CellAddress>,
    editing_mode: Memo<bool>,
    cell_position: Memo<(f64, f64, f64, f64)>, // x, y, width, height
) -> impl IntoView {
    // Get controller from context
    let controller_stored = use_controller();

    let input_ref = NodeRef::<Textarea>::new();
    let (suggestions, set_suggestions) = signal::<Vec<String>>(Vec::new());
    let (selected_suggestion, set_selected_suggestion) = signal::<Option<usize>>(None);

    // Initialize editor when entering edit mode
    Effect::new(move |_| {
        if editing_mode.get() {
            let _cell = active_cell.get();
            controller_stored.with_value(|ctrl| {
                let ctrl_borrow = ctrl.borrow();

                // Get the current editing state from the new mode
                match ctrl_borrow.get_mode() {
                    gridcore_controller::controller::mode::EditorMode::Editing {
                        value,
                        cursor_pos,
                        ..
                    }
                    | gridcore_controller::controller::mode::EditorMode::CellEditing {
                        value,
                        cursor_pos,
                        ..
                    } => {
                        // Focus the input and set value and cursor from controller state
                        if let Some(input) = input_ref.get() {
                            // Focus immediately
                            let _ = input.focus();

                            // Set the value from controller state
                            input.set_value(value);

                            // Set cursor position from controller state
                            let _ = input.set_selection_start(Some(*cursor_pos as u32));
                            let _ = input.set_selection_end(Some(*cursor_pos as u32));
                            leptos::logging::log!(
                                "Initialized editor with value '{}' and cursor at {}",
                                value,
                                cursor_pos
                            );
                        }
                    }
                    _ => {}
                }
            })
        }
    });

    // Create a derived signal for the current editing value from controller
    let current_editing_value = Signal::derive(move || {
        controller_stored.with_value(|ctrl| {
            let ctrl_borrow = ctrl.borrow();
            match ctrl_borrow.get_mode() {
                gridcore_controller::controller::mode::EditorMode::Editing { value, .. }
                | gridcore_controller::controller::mode::EditorMode::CellEditing {
                    value, ..
                } => value.clone(),
                gridcore_controller::controller::mode::EditorMode::Visual { .. } => {
                    // In visual mode, use the formula bar value
                    ctrl_borrow.get_formula_bar().to_string()
                }
                _ => String::new(),
            }
        })
    });

    // Handle formula autocomplete using pure functions
    Effect::new(move |_| {
        let value = current_editing_value.get();

        // Get suggestions using pure autocomplete functions
        let suggestions = {
            let cursor_pos = if let Some(input) = input_ref.get() {
                input.selection_start().unwrap_or(Some(0)).unwrap_or(0) as usize
            } else {
                value.len()
            };

            let suggestions =
                gridcore_controller::behaviors::autocomplete::get_suggestions(&value, cursor_pos);

            // Convert to simple string suggestions for the UI
            suggestions
                .into_iter()
                .map(|s| s.value().to_string())
                .collect::<Vec<String>>()
        };

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
                    on:keydown=move |ev: KeyboardEvent| {
                        let key = ev.key();
                        let shift = ev.shift_key();
                        let ctrl = ev.ctrl_key();
                        let alt = ev.alt_key();

                        // Prevent default for all keys that we handle
                        // This stops the browser from inserting the character
                        if key.len() == 1 || matches!(key.as_str(), "Enter" | "Backspace" | "Delete" | "Tab" | "Escape" | "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown") {
                            ev.prevent_default();
                        }

                        // Get selection info
                        let (selection_start, selection_end) = if let Some(input) = input_ref.get() {
                            (
                                input.selection_start().unwrap_or(None).map(|v| v as usize),
                                input.selection_end().unwrap_or(None).map(|v| v as usize),
                            )
                        } else {
                            (None, None)
                        };

                        // Send all keystrokes to the controller for vim handling
                        controller_stored.with_value(|controller| {
                            let mut ctrl_mut = controller.borrow_mut();
                            if let Err(e) = ctrl_mut.dispatch_action(Action::HandleEditingKey {
                                key: key.clone(),
                                shift,
                                ctrl,
                                alt,
                                selection_start,
                                selection_end,
                            }) {
                                leptos::logging::log!("Error handling editing key: {:?}", e);
                            }
                        });

                        // After handling, check if we need to update the textarea
                        controller_stored.with_value(|controller| {
                            let ctrl_borrow = controller.borrow();
                            match ctrl_borrow.get_mode() {
                                gridcore_controller::controller::mode::EditorMode::Editing {
                                    value,
                                    cursor_pos,
                                    ..
                                }
                                | gridcore_controller::controller::mode::EditorMode::CellEditing {
                                    value,
                                    cursor_pos,
                                    ..
                                } => {
                                    if let Some(input) = input_ref.get() {
                                        // Only update if value changed
                                        if input.value() != *value {
                                            input.set_value(value);
                                        }
                                        // Update cursor position
                                        let _ = input.set_selection_start(Some(*cursor_pos as u32));
                                        let _ = input.set_selection_end(Some(*cursor_pos as u32));
                                    }
                                }
                                _ => {}
                            }
                        });
                        // Check if we've exited editing mode and return focus to grid
                        controller_stored.with_value(|controller| {
                            let ctrl_borrow = controller.borrow();
                            if matches!(
                                ctrl_borrow.get_mode(),
                                gridcore_controller::controller::mode::EditorMode::Navigation
                            ) {
                                // Return focus to grid container
                                if let Some(window) = web_sys::window()
                                    && let Some(document) = window.document()
                                    && let Ok(Some(element)) = document.query_selector(".grid-container")
                                    && let Ok(html_element) = element.dyn_into::<web_sys::HtmlElement>()
                                {
                                    let _ = html_element.focus();
                                }
                            }
                        });
                    }
                    prop:value=move || current_editing_value.get()
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

                                                // Use pure autocomplete functions to apply the suggestion
                                                let suggestion = gridcore_controller::behaviors::autocomplete::AutocompleteSuggestion::Function {
                                                    name: suggestion_for_click.clone(),
                                                    signature: String::new(), // Not needed for application
                                                };
                                                let (new_value, new_cursor) = gridcore_controller::behaviors::autocomplete::apply_suggestion(
                                                    &current_value,
                                                    &suggestion,
                                                    cursor_pos
                                                );

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
