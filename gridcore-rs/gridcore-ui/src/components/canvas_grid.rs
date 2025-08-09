use gridcore_controller::controller::SpreadsheetController;
use gridcore_controller::state::{Action, InsertMode, SpreadsheetMode};
use gridcore_core::types::CellAddress;
use leptos::html::{Canvas, Div};
use leptos::*;
use std::cell::RefCell;
use std::rc::Rc;
use wasm_bindgen::JsCast;
use web_sys::{
    CanvasRenderingContext2d, HtmlCanvasElement, HtmlDivElement, KeyboardEvent, MouseEvent,
};

use crate::components::cell_editor::CellEditor;
use crate::components::viewport::Viewport;
use crate::interaction::resize_handler::ResizeHandler;
use crate::rendering::default_theme;
use crate::{debug_console, debug_log};

#[component]
pub fn CanvasGrid(
    active_cell: ReadSignal<CellAddress>,
    set_active_cell: WriteSignal<CellAddress>,
    set_formula_value: WriteSignal<String>,
    set_current_mode: WriteSignal<SpreadsheetMode>,
) -> impl IntoView {
    // Get controller from context
    let controller: Rc<RefCell<SpreadsheetController>> =
        use_context().expect("SpreadsheetController not found in context");

    // Node refs
    let canvas_ref = create_node_ref::<Canvas>();
    let wrapper_ref = create_node_ref::<Div>();
    let theme = default_theme();

    // State
    let viewport_rc = Rc::new(RefCell::new(Viewport::new(
        theme.clone(),
        Some(100),
        Some(26),
    )));
    let (viewport, set_viewport) = create_signal(viewport_rc.clone());
    let (editing_mode, set_editing_mode) = create_signal(false);
    let (cell_position, set_cell_position) = create_signal((0.0, 0.0, 100.0, 25.0));
    let (cursor_style, set_cursor_style) = create_signal("cell");
    let (canvas_dimensions, set_canvas_dimensions) = create_signal((0.0, 0.0));

    // Get device pixel ratio once
    let device_pixel_ratio = web_sys::window()
        .and_then(|w| Some(w.device_pixel_ratio()))
        .unwrap_or(1.0);

    // Create resize handler
    let resize_handler = ResizeHandler::new(viewport_rc.clone());
    let _resize_state = resize_handler.get_state();

    // Auto-focus the wrapper when component mounts
    create_effect(move |_| {
        if let Some(wrapper) = wrapper_ref.get() {
            let element: &HtmlDivElement = wrapper.as_ref();
            let _ = element.focus();
        }
    });

    // Clone controller references for closures
    let ctrl_render = controller.clone();
    let ctrl_formula = controller.clone();
    let ctrl_keyboard = controller.clone();

    // Clone viewport_rc for use in the effect
    let viewport_effect = viewport_rc.clone();

    // Set up canvas rendering after mount
    create_effect(move |_| {
        if let Some(canvas) = canvas_ref.get() {
            let canvas_elem: &web_sys::HtmlCanvasElement = &canvas;

            // Get device pixel ratio for high-DPI support
            let device_pixel_ratio = web_sys::window()
                .and_then(|w| Some(w.device_pixel_ratio()))
                .unwrap_or(1.0);

            // Update canvas dimensions based on parent container
            if let Some(parent) = canvas_elem.parent_element() {
                let rect = parent.get_bounding_client_rect();
                let width = rect.width();
                let height = rect.height();

                // Update canvas dimensions if they've changed
                if width > 0.0 && height > 0.0 {
                    // Set physical canvas size (actual pixels)
                    canvas_elem.set_width((width * device_pixel_ratio) as u32);
                    canvas_elem.set_height((height * device_pixel_ratio) as u32);

                    // Update the signal which will trigger the view to update
                    set_canvas_dimensions.set((width, height));

                    // Update viewport size - use the Rc directly to avoid signal tracking
                    viewport_effect
                        .borrow_mut()
                        .set_viewport_size(width, height);
                }
            }

            // Render the grid - borrow immutably for rendering
            let ctrl = ctrl_render.clone();
            {
                let ctrl_borrow = ctrl.borrow();
                render_grid(
                    canvas_elem,
                    &*viewport_effect.borrow(),
                    active_cell.get(),
                    ctrl_borrow.get_facade(),
                    device_pixel_ratio,
                );
            } // ctrl_borrow is dropped here
        }
    });

    // Update formula bar when cell changes
    create_effect(move |_| {
        let cell = active_cell.get();
        let ctrl = ctrl_formula.clone();

        debug_log!("Formula bar update: active_cell = {:?}", cell);

        // Get cell value and drop the borrow immediately
        let cell_value = {
            let ctrl_borrow = ctrl.borrow();
            let facade = ctrl_borrow.get_facade();

            if let Some(cell_obj) = facade.get_cell(&cell) {
                debug_log!(
                    "Cell found at {:?}: raw_value={}, has_formula={}",
                    cell,
                    cell_obj.raw_value,
                    cell_obj.has_formula()
                );
                // Check if cell has a formula
                if cell_obj.has_formula() {
                    // If it has a formula, show the raw value (which contains the formula)
                    Some(cell_obj.raw_value.to_string())
                } else {
                    // Otherwise show the display value
                    Some(cell_obj.get_display_value().to_string())
                }
            } else {
                debug_log!("No cell found at {:?}", cell);
                None
            }
        }; // ctrl_borrow is dropped here

        debug_log!("Setting formula value to: {:?}", cell_value);
        // Now update the formula value signal
        set_formula_value.set(cell_value.unwrap_or_default());
    });

    // Handle canvas click
    let on_click = move |ev: MouseEvent| {
        if let Some(_canvas) = canvas_ref.get() {
            let x = ev.offset_x() as f64;
            let y = ev.offset_y() as f64;

            // Only process clicks in the cell area (not headers)
            let vp = viewport.get();

            // Use a block to ensure the borrow is dropped before setting active cell
            let new_cell = {
                let vp_borrow = vp.borrow();
                let theme = vp_borrow.get_theme();
                if x > theme.row_header_width && y > theme.column_header_height {
                    // Subtract header offsets to get cell coordinates
                    let cell_x = x - theme.row_header_width;
                    let cell_y = y - theme.column_header_height;

                    vp_borrow.get_cell_at_position(cell_x, cell_y)
                } else {
                    None
                }
            }; // vp_borrow is dropped here

            // Now update active cell if we found one
            if let Some(cell) = new_cell {
                set_active_cell.set(cell);
                // For now, just update the UI state
                // TODO: Add proper selection action when available in controller
            }
        }
    };

    // Handle double-click to edit
    let ctrl_dblclick = controller.clone();
    let on_dblclick = move |ev: MouseEvent| {
        if let Some(_canvas) = canvas_ref.get() {
            let x = ev.offset_x() as f64;
            let y = ev.offset_y() as f64;

            // Only process clicks in the cell area (not headers)
            let vp = viewport.get();

            // Use a block to ensure the borrow is dropped before setting active cell
            let new_cell = {
                let vp_borrow = vp.borrow();
                let theme = vp_borrow.get_theme();
                if x > theme.row_header_width && y > theme.column_header_height {
                    // Subtract header offsets to get cell coordinates
                    let cell_x = x - theme.row_header_width;
                    let cell_y = y - theme.column_header_height;

                    vp_borrow.get_cell_at_position(cell_x, cell_y)
                } else {
                    None
                }
            }; // vp_borrow is dropped here

            // Now update active cell and start editing
            if let Some(cell) = new_cell {
                set_active_cell.set(cell);

                // Get existing cell value
                let existing_value = {
                    let ctrl = ctrl_dblclick.clone();
                    let ctrl_borrow = ctrl.borrow();
                    let facade = ctrl_borrow.get_facade();
                    if let Some(cell_obj) = facade.get_cell(&cell) {
                        if cell_obj.has_formula() {
                            cell_obj.raw_value.to_string()
                        } else {
                            cell_obj.get_display_value().to_string()
                        }
                    } else {
                        String::new()
                    }
                };

                // Calculate cell position for the editor
                let (pos, theme) = {
                    let vp_borrow = vp.borrow();
                    let pos = vp_borrow.get_cell_position(&cell);
                    let theme = vp_borrow.get_theme().clone();
                    (pos, theme)
                }; // vp_borrow is dropped here

                set_cell_position.set((
                    pos.x + theme.row_header_width,
                    pos.y + theme.column_header_height,
                    pos.width,
                    pos.height,
                ));

                // Start editing with 'a' mode (cursor at end)
                let cursor_pos = existing_value.len();
                let action = Action::StartEditing {
                    edit_mode: Some(InsertMode::A),
                    initial_value: Some(existing_value),
                    cursor_position: Some(cursor_pos),
                };

                let mut ctrl_mut = ctrl_dblclick.borrow_mut();
                if let Err(e) = ctrl_mut.dispatch_action(action) {
                    debug_log!("Error starting edit on double-click: {:?}", e);
                } else {
                    // Update UI state
                    set_editing_mode.set(true);
                    set_current_mode.set(SpreadsheetMode::Insert);
                }
            }
        }
    };

    // Handle mouse move for resize cursor
    let resize_handler_move = resize_handler.clone();
    let on_mouse_move = move |ev: MouseEvent| {
        let x = ev.offset_x() as f64;
        let y = ev.offset_y() as f64;

        // Check if we're resizing
        if resize_handler_move.is_resizing() {
            resize_handler_move.handle_resize(&ev);
            // Trigger re-render
            set_viewport.update(|_| {});
        } else {
            // Check if we're hovering over a resize handle
            let theme = default_theme();
            let is_col_header = y < theme.column_header_height;
            let is_row_header = x < theme.row_header_width;

            if is_col_header || is_row_header {
                let cursor = resize_handler_move.get_cursor_style(
                    if is_col_header { x } else { 0.0 },
                    if is_row_header { y } else { 0.0 },
                    is_col_header,
                );
                set_cursor_style.set(cursor);
            } else {
                set_cursor_style.set("cell");
            }
        }
    };

    // Handle mouse down for starting resize
    let resize_handler_down = resize_handler.clone();
    let on_mouse_down = move |ev: MouseEvent| {
        let x = ev.offset_x() as f64;
        let y = ev.offset_y() as f64;
        let theme = default_theme();

        let is_col_header = y < theme.column_header_height;
        let is_row_header = x < theme.row_header_width;

        if is_col_header || is_row_header {
            if let Some((resize_type, index)) = resize_handler_down.check_resize_hover(
                if is_col_header { x } else { 0.0 },
                if is_row_header { y } else { 0.0 },
                is_col_header,
            ) {
                ev.prevent_default();
                resize_handler_down.start_resize(&ev, resize_type, index);
            }
        }
    };

    // Handle mouse up for ending resize
    let resize_handler_up = resize_handler.clone();
    let on_mouse_up = move |_ev: MouseEvent| {
        if resize_handler_up.is_resizing() {
            resize_handler_up.end_resize();
            // Trigger final re-render
            set_viewport.update(|_| {});
        }
    };

    // Handle keyboard events through controller
    let on_keydown = move |ev: KeyboardEvent| {
        let key = ev.key();
        let shift_pressed = ev.shift_key();
        debug_log!("Key pressed: {}, shift: {}", key, shift_pressed);
        let ctrl = ctrl_keyboard.clone();

        // Get current mode only - we'll get cursor when needed
        let current_mode = {
            let ctrl_borrow = ctrl.borrow();
            ctrl_borrow.get_state().spreadsheet_mode()
        };

        // For navigation, handle movement directly since controller doesn't have Move action
        let action = match current_mode {
            SpreadsheetMode::Navigation => {
                // Get fresh cursor state for navigation actions
                let current_cursor = {
                    let ctrl_borrow = ctrl.borrow();
                    *ctrl_borrow.get_state().cursor()
                };
                match key.as_str() {
                    "h" | "ArrowLeft" => {
                        ev.prevent_default();
                        if current_cursor.col > 0 {
                            Some(Action::UpdateCursor {
                                cursor: CellAddress::new(
                                    current_cursor.col - 1,
                                    current_cursor.row,
                                ),
                            })
                        } else {
                            None
                        }
                    }
                    "j" | "ArrowDown" => {
                        ev.prevent_default();
                        Some(Action::UpdateCursor {
                            cursor: CellAddress::new(current_cursor.col, current_cursor.row + 1),
                        })
                    }
                    "k" | "ArrowUp" => {
                        ev.prevent_default();
                        if current_cursor.row > 0 {
                            Some(Action::UpdateCursor {
                                cursor: CellAddress::new(
                                    current_cursor.col,
                                    current_cursor.row - 1,
                                ),
                            })
                        } else {
                            None
                        }
                    }
                    "l" | "ArrowRight" => {
                        ev.prevent_default();
                        debug_log!(
                            "[NAV] Moving right from col={} to col={}, current_mode={:?}",
                            current_cursor.col,
                            current_cursor.col + 1,
                            current_mode
                        );
                        Some(Action::UpdateCursor {
                            cursor: CellAddress::new(current_cursor.col + 1, current_cursor.row),
                        })
                    }
                    "i" => {
                        ev.prevent_default();
                        // Get the current cursor from the controller, not the UI signal
                        // This ensures we're using the controller's actual state
                        let actual_cursor = {
                            let ctrl = controller.clone();
                            let ctrl_borrow = ctrl.borrow();
                            let state = ctrl_borrow.get_state();
                            debug_log!(
                                "[NAV] 'i' key pressed - current state mode: {:?}, cursor: {:?}",
                                state.spreadsheet_mode(),
                                state.cursor()
                            );
                            *state.cursor()
                        };
                        // Calculate cell position for the editor
                        let vp = viewport.get();
                        let (pos, theme) = {
                            let vp_borrow = vp.borrow();
                            let pos = vp_borrow.get_cell_position(&actual_cursor);
                            let theme = vp_borrow.get_theme().clone();
                            (pos, theme)
                        }; // vp_borrow is dropped here
                        set_cell_position.set((
                            pos.x + theme.row_header_width,
                            pos.y + theme.column_header_height,
                            pos.width,
                            pos.height,
                        ));
                        // Get existing cell value for 'i' key
                        let existing_value = {
                            let ctrl = controller.clone();
                            let ctrl_borrow = ctrl.borrow();
                            let facade = ctrl_borrow.get_facade();
                            if let Some(cell_obj) = facade.get_cell(&actual_cursor) {
                                // Check what type of value the cell has
                                let cell_value = facade.get_cell_value(&actual_cursor);
                                debug_log!(
                                    "[NAV] Cell at {:?} has_formula: {}, cell_value: {:?}",
                                    actual_cursor,
                                    cell_obj.has_formula(),
                                    cell_value
                                );
                                // Get the display value - use raw_value if it's a formula, otherwise computed_value
                                if cell_obj.has_formula() {
                                    cell_obj.raw_value.to_string()
                                } else {
                                    cell_obj.get_display_value().to_string()
                                }
                            } else {
                                String::new()
                            }
                        };
                        // 'i' key preserves existing content and positions cursor at beginning
                        debug_log!(
                            "[NAV] Creating StartEditing action with existing_value='{}', cursor={:?}",
                            existing_value,
                            actual_cursor
                        );
                        Some(Action::StartEditing {
                            edit_mode: Some(InsertMode::I),
                            initial_value: Some(existing_value),
                            cursor_position: Some(0), // Cursor at beginning for 'i'
                        })
                    }
                    "a" => {
                        ev.prevent_default();
                        // Get the current cursor from the controller, not the UI signal
                        // This ensures we're using the controller's actual state
                        let actual_cursor = {
                            let ctrl = controller.clone();
                            let ctrl_borrow = ctrl.borrow();
                            *ctrl_borrow.get_state().cursor()
                        };
                        // Calculate cell position for the editor
                        let vp = viewport.get();
                        let (pos, theme) = {
                            let vp_borrow = vp.borrow();
                            let pos = vp_borrow.get_cell_position(&actual_cursor);
                            let theme = vp_borrow.get_theme().clone();
                            (pos, theme)
                        }; // vp_borrow is dropped here
                        set_cell_position.set((
                            pos.x + theme.row_header_width,
                            pos.y + theme.column_header_height,
                            pos.width,
                            pos.height,
                        ));
                        // Get existing cell value for 'a' key
                        let existing_value = {
                            let ctrl = controller.clone();
                            let ctrl_borrow = ctrl.borrow();
                            let facade = ctrl_borrow.get_facade();
                            if let Some(cell_obj) = facade.get_cell(&actual_cursor) {
                                // Get the display value - use raw_value if it's a formula, otherwise computed_value
                                if cell_obj.has_formula() {
                                    cell_obj.raw_value.to_string()
                                } else {
                                    cell_obj.get_display_value().to_string()
                                }
                            } else {
                                String::new()
                            }
                        };
                        let cursor_pos = existing_value.len();
                        // 'a' key preserves existing content and positions cursor at end
                        Some(Action::StartEditing {
                            edit_mode: Some(InsertMode::A),
                            initial_value: Some(existing_value),
                            cursor_position: Some(cursor_pos), // Cursor at end for 'a'
                        })
                    }
                    "o" => {
                        ev.prevent_default();
                        // Get fresh cursor state
                        let current_cursor = {
                            let ctrl_borrow = ctrl.borrow();
                            *ctrl_borrow.get_state().cursor()
                        };
                        // Move to next row and start editing
                        let new_cursor =
                            CellAddress::new(current_cursor.col, current_cursor.row + 1);
                        set_active_cell.set(new_cursor);
                        // Calculate cell position for the editor
                        let vp = viewport.get();
                        let (pos, theme) = {
                            let vp_borrow = vp.borrow();
                            let pos = vp_borrow.get_cell_position(&new_cursor);
                            let theme = vp_borrow.get_theme().clone();
                            (pos, theme)
                        }; // vp_borrow is dropped here
                        set_cell_position.set((
                            pos.x + theme.row_header_width,
                            pos.y + theme.column_header_height,
                            pos.width,
                            pos.height,
                        ));
                        Some(Action::UpdateCursor { cursor: new_cursor })
                    }
                    "O" => {
                        ev.prevent_default();
                        // Get fresh cursor state
                        let current_cursor = {
                            let ctrl_borrow = ctrl.borrow();
                            *ctrl_borrow.get_state().cursor()
                        };
                        // Move to previous row and start editing
                        if current_cursor.row > 0 {
                            let new_cursor =
                                CellAddress::new(current_cursor.col, current_cursor.row - 1);
                            set_active_cell.set(new_cursor);
                            // Calculate cell position for the editor
                            let vp = viewport.get();
                            let (pos, theme) = {
                                let vp_borrow = vp.borrow();
                                let pos = vp_borrow.get_cell_position(&new_cursor);
                                let theme = vp_borrow.get_theme().clone();
                                (pos, theme)
                            }; // vp_borrow is dropped here
                            set_cell_position.set((
                                pos.x + theme.row_header_width,
                                pos.y + theme.column_header_height,
                                pos.width,
                                pos.height,
                            ));
                            Some(Action::UpdateCursor { cursor: new_cursor })
                        } else {
                            None
                        }
                    }
                    "Enter" => {
                        ev.prevent_default();
                        // Get the current cursor from the controller, not the UI signal
                        // This ensures we're using the controller's actual state
                        let actual_cursor = {
                            let ctrl = controller.clone();
                            let ctrl_borrow = ctrl.borrow();
                            *ctrl_borrow.get_state().cursor()
                        };
                        // Calculate cell position for the editor
                        let vp = viewport.get();
                        let (pos, theme) = {
                            let vp_borrow = vp.borrow();
                            let pos = vp_borrow.get_cell_position(&actual_cursor);
                            let theme = vp_borrow.get_theme().clone();
                            (pos, theme)
                        }; // vp_borrow is dropped here
                        set_cell_position.set((
                            pos.x + theme.row_header_width,
                            pos.y + theme.column_header_height,
                            pos.width,
                            pos.height,
                        ));
                        // Enter key replaces existing content
                        Some(Action::StartEditing {
                            edit_mode: Some(InsertMode::I),
                            initial_value: Some(String::new()), // Empty string to signal replace
                            cursor_position: Some(0),
                        })
                    }
                    "Delete" | "Backspace" => {
                        ev.prevent_default();
                        // Get fresh cursor state
                        let current_cursor = {
                            let ctrl_borrow = ctrl.borrow();
                            *ctrl_borrow.get_state().cursor()
                        };
                        // Clear the current cell
                        let ctrl = controller.clone();
                        {
                            let ctrl_borrow = ctrl.borrow();
                            let facade = ctrl_borrow.get_facade();
                            if let Err(e) = facade.set_cell_value(&current_cursor, "") {
                                debug_log!("Error clearing cell: {:?}", e);
                            }
                        }
                        // Update formula bar
                        set_formula_value.set(String::new());
                        None
                    }
                    "v" => {
                        ev.prevent_default();
                        // Get fresh cursor state
                        let current_cursor = {
                            let ctrl_borrow = ctrl.borrow();
                            *ctrl_borrow.get_state().cursor()
                        };
                        use gridcore_controller::state::{
                            Selection, SelectionType, SpreadsheetVisualMode,
                        };
                        Some(Action::EnterSpreadsheetVisualMode {
                            visual_mode: SpreadsheetVisualMode::Char,
                            selection: Selection {
                                selection_type: SelectionType::Cell {
                                    address: current_cursor,
                                },
                                anchor: Some(current_cursor),
                            },
                        })
                    }
                    "Tab" => {
                        ev.prevent_default();
                        // Get fresh cursor state
                        let current_cursor = {
                            let ctrl_borrow = ctrl.borrow();
                            *ctrl_borrow.get_state().cursor()
                        };
                        if shift_pressed {
                            // Shift+Tab moves to previous cell (left, then wrap to previous row)
                            if current_cursor.col > 0 {
                                Some(Action::UpdateCursor {
                                    cursor: CellAddress::new(
                                        current_cursor.col - 1,
                                        current_cursor.row,
                                    ),
                                })
                            } else if current_cursor.row > 0 {
                                // Wrap to previous row, last column
                                Some(Action::UpdateCursor {
                                    cursor: CellAddress::new(99, current_cursor.row - 1), // Go to column 99 (reasonable limit)
                                })
                            } else {
                                None // Can't go further back
                            }
                        } else {
                            // Tab moves to next cell (right, then wrap to next row)
                            let next_col = current_cursor.col + 1;
                            if next_col < 100 {
                                // Reasonable column limit
                                Some(Action::UpdateCursor {
                                    cursor: CellAddress::new(next_col, current_cursor.row),
                                })
                            } else {
                                // Wrap to next row
                                Some(Action::UpdateCursor {
                                    cursor: CellAddress::new(0, current_cursor.row + 1),
                                })
                            }
                        }
                    }
                    _ => {
                        // Check if it's an alphanumeric character or special character to start editing
                        if key.len() == 1 {
                            let ch = key.chars().next().unwrap();
                            if ch.is_alphanumeric()
                                || "!@#$%^&*()_+-=[]{}|;':\",./<>?`~".contains(ch)
                            {
                                ev.prevent_default();
                                debug_log!("Direct typing: key='{}', starting edit mode", key);
                                // Get the current cursor from the controller, not the UI signal
                                // This ensures we're using the controller's actual state
                                let actual_cursor = {
                                    let ctrl = controller.clone();
                                    let ctrl_borrow = ctrl.borrow();
                                    *ctrl_borrow.get_state().cursor()
                                };
                                // Calculate cell position for the editor
                                let vp = viewport.get();
                                let (pos, theme) = {
                                    let vp_borrow = vp.borrow();
                                    let pos = vp_borrow.get_cell_position(&actual_cursor);
                                    let theme = vp_borrow.get_theme().clone();
                                    (pos, theme)
                                }; // vp_borrow is dropped here
                                set_cell_position.set((
                                    pos.x + theme.row_header_width,
                                    pos.y + theme.column_header_height,
                                    pos.width,
                                    pos.height,
                                ));
                                // Start editing with the typed character
                                Some(Action::StartEditing {
                                    edit_mode: Some(InsertMode::I),
                                    initial_value: Some(key.clone()),
                                    cursor_position: Some(1), // Position cursor after the typed character
                                })
                            } else {
                                None
                            }
                        } else {
                            None
                        }
                    }
                }
            }
            SpreadsheetMode::Editing | SpreadsheetMode::Insert => {
                // Editing is handled by CellEditor component
                None
            }
            _ => None,
        };

        // Dispatch action if we have one
        if let Some(action) = action {
            debug_log!("[DISPATCH] About to dispatch action: {:?}", action);
            // Check if this is a StartEditing action before dispatch
            let is_start_editing = matches!(action, Action::StartEditing { .. });

            // Dispatch action and get new state, then drop the borrow
            let (new_mode, new_cursor, is_editing, dispatch_ok) = {
                let mut ctrl_mut = ctrl.borrow_mut();
                let old_state = ctrl_mut.get_state().clone();
                debug_log!(
                    "[DISPATCH] Before dispatch - mode: {:?}, cursor: {:?}",
                    old_state.spreadsheet_mode(),
                    old_state.cursor()
                );
                let dispatch_result = ctrl_mut.dispatch_action(action.clone());
                if let Err(e) = &dispatch_result {
                    debug_log!("[DISPATCH] Error dispatching action: {:?}", e);
                }

                let state = ctrl_mut.get_state();
                let mode = state.spreadsheet_mode();
                let cursor = *state.cursor();

                // Debug: Log the exact state variant
                let state_variant = match state {
                    gridcore_controller::state::UIState::Navigation { .. } => "Navigation",
                    gridcore_controller::state::UIState::Editing { .. } => "Editing",
                    gridcore_controller::state::UIState::Visual { .. } => "Visual",
                    gridcore_controller::state::UIState::Command { .. } => "Command",
                    gridcore_controller::state::UIState::Resize { .. } => "Resize",
                    gridcore_controller::state::UIState::Insert { .. } => "Insert",
                    gridcore_controller::state::UIState::Delete { .. } => "Delete",
                    gridcore_controller::state::UIState::BulkOperation { .. } => "BulkOperation",
                };

                let is_editing =
                    matches!(state, gridcore_controller::state::UIState::Editing { .. });
                debug_log!(
                    "[DISPATCH] After dispatch - state_variant: {}, mode: {:?}, cursor: {:?}, is_editing: {}, dispatch_ok: {}",
                    state_variant,
                    mode,
                    cursor,
                    is_editing,
                    dispatch_result.is_ok()
                );
                (mode, cursor, is_editing, dispatch_result.is_ok())
            }; // ctrl_mut is dropped here

            // Now update UI state after borrow is dropped
            set_current_mode.set(new_mode);
            set_active_cell.set(new_cursor);

            // If we just started editing, show the editor and calculate position
            // Force editing mode if we successfully dispatched StartEditing
            let should_be_editing = is_editing || (is_start_editing && dispatch_ok);
            debug_log!(
                "[EDITING_MODE] is_editing: {}, should_be_editing: {}, editing_mode.get(): {}, is_start_editing: {}, dispatch_ok: {}",
                is_editing,
                should_be_editing,
                editing_mode.get(),
                is_start_editing,
                dispatch_ok
            );
            if should_be_editing && !editing_mode.get() {
                debug_log!("[EDITING_MODE] Setting editing_mode to true (forced by StartEditing or state check)");
                set_editing_mode.set(true);
                // Calculate cell position for the editor
                let vp = viewport.get();
                let (pos, theme) = {
                    let vp_borrow = vp.borrow();
                    let pos = vp_borrow.get_cell_position(&new_cursor);
                    let theme = vp_borrow.get_theme().clone();
                    (pos, theme)
                };
                set_cell_position.set((
                    pos.x + theme.row_header_width,
                    pos.y + theme.column_header_height,
                    pos.width,
                    pos.height,
                ));
                debug_log!("[EDITING_MODE] Cell position set for editor");
            } else if !should_be_editing && editing_mode.get() && !is_start_editing {
                // We exited editing mode (but not if we just dispatched StartEditing)
                debug_log!(
                    "[EDITING_MODE] Setting editing_mode to false (exiting), is_start_editing: {}",
                    is_start_editing
                );
                set_editing_mode.set(false);
                // Return focus to the grid container
                // Use a longer timeout and retry mechanism to ensure focus is properly set
                let wrapper_clone = wrapper_ref.clone();
                let retry_count = std::rc::Rc::new(std::cell::Cell::new(0));
                let retry_count_clone = retry_count.clone();

                let focus_fn = std::rc::Rc::new(std::cell::RefCell::new(None::<Box<dyn Fn()>>));
                let focus_fn_clone = focus_fn.clone();

                *focus_fn.borrow_mut() = Some(Box::new(move || {
                    if let Some(wrapper) = wrapper_clone.get() {
                        let _ = wrapper.focus();

                        // Check if focus was actually set
                        if let Some(window) = web_sys::window() {
                            if let Some(document) = window.document() {
                                if let Some(active) = document.active_element() {
                                    // Check if the wrapper or one of its children has focus
                                    let wrapper_element: &web_sys::Element = wrapper.as_ref();
                                    if !wrapper.contains(Some(&active))
                                        && !wrapper_element.is_same_node(Some(&active))
                                    {
                                        // Focus failed, retry if we haven't exceeded max retries
                                        if retry_count_clone.get() < 3 {
                                            retry_count_clone.set(retry_count_clone.get() + 1);
                                            debug_log!(
                                                "[FOCUS] Retrying focus set, attempt {}",
                                                retry_count_clone.get()
                                            );
                                            let focus_fn_clone2 = focus_fn_clone.clone();
                                            set_timeout(
                                                move || {
                                                    if let Some(f) = &*focus_fn_clone2.borrow() {
                                                        f();
                                                    }
                                                },
                                                std::time::Duration::from_millis(50),
                                            );
                                        } else {
                                            debug_log!(
                                                "[FOCUS] Failed to set focus after 3 retries"
                                            );
                                        }
                                    } else {
                                        debug_log!(
                                            "[FOCUS] Successfully set focus to grid container"
                                        );
                                    }
                                }
                            }
                        }
                    }
                }));

                // Initial attempt with 50ms delay
                set_timeout(
                    move || {
                        if let Some(f) = &*focus_fn.borrow() {
                            f();
                        }
                    },
                    std::time::Duration::from_millis(50),
                );
            }

            debug_log!(
                "Updated active cell to: col={}, row={}, editing={}",
                new_cursor.col,
                new_cursor.row,
                is_editing
            );
        }
    };

    view! {
        <div
            class="canvas-grid-wrapper grid-container"
            node_ref=wrapper_ref
            tabindex="0"
            on:keydown=on_keydown
            style="width: 100%; height: 100%; outline: none; position: relative; overflow: hidden;"
        >
            <canvas
                class="grid-canvas"
                node_ref=canvas_ref
                width=move || {
                    let (width, _) = canvas_dimensions.get();
                    (width * device_pixel_ratio) as u32
                }
                height=move || {
                    let (_, height) = canvas_dimensions.get();
                    (height * device_pixel_ratio) as u32
                }
                on:click=on_click
                on:dblclick=on_dblclick
                on:mousedown=on_mouse_down
                on:mousemove=on_mouse_move
                on:mouseup=on_mouse_up
                style=move || {
                    let (width, height) = canvas_dimensions.get();
                    format!(
                        "display: block; border: 1px solid #e0e0e0; background: white; cursor: {}; width: {}px; height: {}px;",
                        cursor_style.get(),
                        if width > 0.0 { width } else { 0.0 },
                        if height > 0.0 { height } else { 0.0 }
                    )
                }
            />
            <CellEditor
                active_cell=active_cell
                editing_mode=editing_mode
                set_editing_mode=set_editing_mode
                cell_position=cell_position
                set_formula_value=set_formula_value
                set_current_mode=set_current_mode
            />
        </div>
    }
}

fn render_grid(
    canvas: &HtmlCanvasElement,
    viewport: &Viewport,
    active_cell: CellAddress,
    facade: &gridcore_core::SpreadsheetFacade,
    device_pixel_ratio: f64,
) {
    // Get 2D context
    let ctx = match canvas.get_context("2d") {
        Ok(Some(ctx)) => ctx,
        _ => return,
    };

    let ctx: CanvasRenderingContext2d = match ctx.dyn_into() {
        Ok(ctx) => ctx,
        _ => return,
    };

    let theme = viewport.get_theme();

    // Apply scaling for high-DPI displays
    ctx.save();
    ctx.scale(device_pixel_ratio, device_pixel_ratio).ok();

    // Clear canvas (use logical dimensions, not physical)
    let logical_width = (canvas.width() as f64) / device_pixel_ratio;
    let logical_height = (canvas.height() as f64) / device_pixel_ratio;
    ctx.clear_rect(0.0, 0.0, logical_width, logical_height);

    // Draw background
    ctx.set_fill_style_str(&theme.background_color);
    ctx.fill_rect(0.0, 0.0, logical_width, logical_height);

    // Draw grid lines and cells
    let bounds = viewport.get_visible_bounds();

    // Draw vertical lines
    ctx.set_stroke_style_str(&theme.grid_line_color);
    ctx.set_line_width(1.0);

    for col in bounds.start_col..=bounds.end_col {
        let x =
            viewport.get_column_x(col) - viewport.get_scroll_position().x + theme.row_header_width;
        ctx.begin_path();
        ctx.move_to(x, theme.column_header_height);
        ctx.line_to(x, logical_height);
        ctx.stroke();
    }

    // Draw horizontal lines
    for row in bounds.start_row..=bounds.end_row {
        let y =
            viewport.get_row_y(row) - viewport.get_scroll_position().y + theme.column_header_height;
        ctx.begin_path();
        ctx.move_to(theme.row_header_width, y);
        ctx.line_to(logical_width, y);
        ctx.stroke();
    }

    // Draw column headers
    ctx.set_fill_style_str(&theme.header_background_color);
    ctx.fill_rect(0.0, 0.0, logical_width, theme.column_header_height);

    ctx.set_fill_style_str(&theme.header_text_color);
    ctx.set_font(&format!(
        "{}px {}",
        theme.header_font_size, theme.header_font_family
    ));

    for col in bounds.start_col..=bounds.end_col {
        let x =
            viewport.get_column_x(col) - viewport.get_scroll_position().x + theme.row_header_width;
        let width = viewport.get_column_width(col);

        // Draw header background
        ctx.set_fill_style_str(&theme.header_background_color);
        ctx.fill_rect(x, 0.0, width, theme.column_header_height);

        // Draw column label
        ctx.set_fill_style_str(&theme.header_text_color);
        let label = get_column_label(col);
        let text_x = x + width / 2.0 - 8.0;
        let text_y = theme.column_header_height / 2.0 + 4.0;
        ctx.fill_text(&label, text_x, text_y).ok();
    }

    // Draw row headers
    for row in bounds.start_row..=bounds.end_row {
        let y =
            viewport.get_row_y(row) - viewport.get_scroll_position().y + theme.column_header_height;
        let height = viewport.get_row_height(row);

        // Draw header background
        ctx.set_fill_style_str(&theme.header_background_color);
        ctx.fill_rect(0.0, y, theme.row_header_width, height);

        // Draw row number
        ctx.set_fill_style_str(&theme.header_text_color);
        let label = (row + 1).to_string();
        let text_x = theme.row_header_width / 2.0 - 8.0;
        let text_y = y + height / 2.0 + 4.0;
        ctx.fill_text(&label, text_x, text_y).ok();
    }

    // Draw corner
    ctx.set_fill_style_str(&theme.header_background_color);
    ctx.fill_rect(0.0, 0.0, theme.row_header_width, theme.column_header_height);

    // Draw cell values
    ctx.set_fill_style_str(&theme.cell_text_color);
    ctx.set_font(&format!(
        "{}px {}",
        theme.cell_font_size, theme.cell_font_family
    ));

    for row in bounds.start_row..=bounds.end_row {
        for col in bounds.start_col..=bounds.end_col {
            let cell_address = CellAddress::new(col as u32, row as u32);

            // Get cell value from facade
            if let Some(cell) = facade.get_cell(&cell_address) {
                let display_value = cell.get_display_value();
                let value_str = display_value.to_string();

                let x = viewport.get_column_x(col) - viewport.get_scroll_position().x
                    + theme.row_header_width;
                let y = viewport.get_row_y(row) - viewport.get_scroll_position().y
                    + theme.column_header_height;
                let height = viewport.get_row_height(row);

                // Check if the value is an error and set appropriate color
                let is_error = matches!(display_value, gridcore_core::types::CellValue::Error(_));
                if is_error {
                    ctx.set_fill_style_str("#ff4444"); // Red color for errors
                } else {
                    ctx.set_fill_style_str(&theme.cell_text_color);
                }

                // Draw cell text
                let text_x = x + theme.cell_padding_left;
                let text_y = y + height / 2.0 + 4.0; // Vertical center alignment
                ctx.fill_text(&value_str, text_x, text_y).ok();

                // Reset fill style if it was changed
                if is_error {
                    ctx.set_fill_style_str(&theme.cell_text_color);
                }
            }
        }
    }

    // Highlight active cell
    if active_cell.row as usize <= bounds.end_row && active_cell.col as usize <= bounds.end_col {
        let pos = viewport.get_cell_position(&active_cell);

        // Add header offsets
        let cell_x = pos.x + theme.row_header_width;
        let cell_y = pos.y + theme.column_header_height;

        // Draw active cell border
        ctx.set_stroke_style_str(&theme.active_cell_border_color);
        ctx.set_line_width(2.0);
        ctx.stroke_rect(cell_x, cell_y, pos.width, pos.height);
    }

    // Restore context state (removes the scaling transform)
    ctx.restore();
}

fn get_column_label(col: usize) -> String {
    let mut label = String::new();
    let mut n = col;
    loop {
        label.insert(0, ((n % 26) as u8 + b'A') as char);
        n /= 26;
        if n == 0 {
            break;
        }
        n -= 1;
    }
    label
}
