use gridcore_controller::controller::SpreadsheetController;
use gridcore_controller::state::{Action, InsertMode, SpreadsheetMode, UIState};
use gridcore_core::types::CellAddress;
use leptos::html::{Canvas, Div};
use leptos::prelude::*;
use std::cell::RefCell;
use std::rc::Rc;
use wasm_bindgen::JsCast;
use web_sys::{
    CanvasRenderingContext2d, HtmlCanvasElement, HtmlDivElement, KeyboardEvent, MouseEvent,
    WheelEvent,
};

use crate::components::cell_editor::CellEditor;
use crate::components::viewport::Viewport;
use crate::debug_log;
use crate::interaction::resize_handler::ResizeHandler;
use crate::rendering::default_theme;

#[component]
pub fn CanvasGrid(
    active_cell: ReadSignal<CellAddress>,
    set_active_cell: WriteSignal<CellAddress>,
    set_formula_value: WriteSignal<String>,
    set_current_mode: WriteSignal<SpreadsheetMode>,
    state_version: ReadSignal<u32>,
    set_state_version: WriteSignal<u32>,
) -> impl IntoView {
    // Get controller from context (keep as StoredValue to avoid cloning)
    let controller_stored: StoredValue<Rc<RefCell<SpreadsheetController>>, LocalStorage> =
        use_context().expect("SpreadsheetController not found in context");
    let controller_rc = controller_stored.get_value();

    // Create a signal to track state changes and trigger re-renders
    // State version is now passed from app.rs for global state tracking

    // Node refs
    let canvas_ref = NodeRef::<Canvas>::new();
    let wrapper_ref = NodeRef::<Div>::new();
    let theme = default_theme();

    // State
    let viewport_rc = Rc::new(RefCell::new(Viewport::new(
        theme.clone(),
        controller_rc.clone(),
    )));
    let (viewport, set_viewport) = signal_local(viewport_rc.clone());
    let (editing_mode, set_editing_mode) = signal(false);
    let (cell_position, set_cell_position) = signal((0.0, 0.0, 100.0, 25.0));
    let (cursor_style, set_cursor_style) = signal("cell");
    let (canvas_dimensions, set_canvas_dimensions) = signal((0.0, 0.0));

    // Get device pixel ratio once
    let device_pixel_ratio = web_sys::window()
        .map(|w| w.device_pixel_ratio())
        .unwrap_or(1.0);

    // Create resize handler
    let resize_handler = ResizeHandler::new(controller_rc.clone());

    // Auto-focus the wrapper when component mounts
    Effect::new(move |_| {
        if let Some(wrapper) = wrapper_ref.get() {
            let element: &HtmlDivElement = wrapper.as_ref();
            let result = element.focus();
            leptos::logging::log!("Grid container auto-focus on mount: {:?}", result);
        }
    });

    // No need to clone controller - we'll use controller_stored directly in closures

    // Clone viewport_rc for use in the effect
    let viewport_effect = viewport_rc.clone();

    // Set up canvas rendering after mount and when active cell changes
    Effect::new(move |_| {
        // Track active_cell and state_version to trigger re-render when they change
        let current_cell = active_cell.get();
        let _ = state_version.get(); // Track state version to trigger re-renders

        if let Some(canvas) = canvas_ref.get() {
            let canvas_elem: &web_sys::HtmlCanvasElement = &canvas;

            // Get device pixel ratio for high-DPI support
            let device_pixel_ratio = web_sys::window()
                .map(|w| w.device_pixel_ratio())
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
            controller_stored.with_value(|ctrl| {
                let ctrl_borrow = ctrl.borrow();
                leptos::logging::log!("Rendering grid with active cell: {:?}", current_cell);
                render_grid(
                    canvas_elem,
                    &viewport_effect.borrow(),
                    current_cell,
                    ctrl_borrow.get_facade(),
                    device_pixel_ratio,
                    ctrl_borrow.get_config(),
                );
            }); // ctrl_borrow is dropped here
        }
    });

    // Update formula bar when cell changes
    Effect::new(move |_| {
        let cell = active_cell.get();

        debug_log!("Formula bar update: active_cell = {:?}", cell);

        // Get cell value and drop the borrow immediately
        let cell_value = controller_stored.with_value(|ctrl| {
            let ctrl_borrow = ctrl.borrow();
            let value = ctrl_borrow.get_cell_display_for_ui(&cell);
            if !value.is_empty() {
                debug_log!("Cell found at {:?}: value={}", cell, value);
                Some(value)
            } else {
                debug_log!("No cell found at {:?}", cell);
                None
            }
        }); // ctrl_borrow is dropped here

        debug_log!("Setting formula value to: {:?}", cell_value);
        // Now update the formula value signal
        set_formula_value.set(cell_value.unwrap_or_default());
    });

    // Handle canvas click
    let on_click = move |ev: MouseEvent| {
        leptos::logging::log!("Canvas click at ({}, {})", ev.offset_x(), ev.offset_y());
        if let Some(_canvas) = canvas_ref.get() {
            let x = ev.offset_x() as f64;
            let y = ev.offset_y() as f64;

            // Only process clicks in the cell area (not headers)
            let vp = viewport.get();

            // Use a block to ensure the borrow is dropped before setting active cell
            let new_cell = {
                let vp_borrow = vp.borrow();
                let _theme = vp_borrow.get_theme();
                let config = controller_stored.with_value(|c| c.borrow().get_config().clone());
                if x > config.row_header_width && y > config.column_header_height {
                    // Subtract header offsets to get cell coordinates
                    let cell_x = x - config.row_header_width;
                    let cell_y = y - config.column_header_height;

                    vp_borrow.get_cell_at_position(cell_x, cell_y)
                } else {
                    None
                }
            }; // vp_borrow is dropped here

            // Now update active cell if we found one
            if let Some(cell) = new_cell {
                leptos::logging::log!("Setting active cell to {:?} from click", cell);

                // Update the controller's cursor and the signal
                controller_stored.with_value(|c| {
                    let _ = c
                        .borrow_mut()
                        .dispatch_action(Action::UpdateCursor { cursor: cell });
                });

                // Update the active cell signal
                set_active_cell.set(cell);

                // Trigger a re-render
                set_state_version.update(|v| *v += 1);

                // Ensure grid container maintains focus
                if let Some(wrapper) = wrapper_ref.get() {
                    let element: &HtmlDivElement = wrapper.as_ref();
                    let _ = element.focus();
                    leptos::logging::log!("Refocused grid container after click");
                }
            }
        }
    };

    // Handle double-click to edit
    let on_dblclick = move |ev: MouseEvent| {
        leptos::logging::log!(
            "Canvas double-click at ({}, {})",
            ev.offset_x(),
            ev.offset_y()
        );
        if let Some(_canvas) = canvas_ref.get() {
            let x = ev.offset_x() as f64;
            let y = ev.offset_y() as f64;

            // Only process clicks in the cell area (not headers)
            let vp = viewport.get();

            // Use a block to ensure the borrow is dropped before setting active cell
            let new_cell = {
                let vp_borrow = vp.borrow();
                let _theme = vp_borrow.get_theme();
                let config = controller_stored.with_value(|c| c.borrow().get_config().clone());
                if x > config.row_header_width && y > config.column_header_height {
                    // Subtract header offsets to get cell coordinates
                    let cell_x = x - config.row_header_width;
                    let cell_y = y - config.column_header_height;

                    vp_borrow.get_cell_at_position(cell_x, cell_y)
                } else {
                    None
                }
            }; // vp_borrow is dropped here

            // Now update active cell and start editing
            if let Some(cell) = new_cell {
                // Update cursor in controller
                controller_stored.with_value(|c| {
                    let _ = c
                        .borrow_mut()
                        .dispatch_action(Action::UpdateCursor { cursor: cell });
                });

                // Update the active cell signal
                set_active_cell.set(cell);

                // Trigger a re-render
                set_state_version.update(|v| *v += 1);

                // Get existing cell value
                let existing_value = controller_stored.with_value(|ctrl| {
                    let ctrl_borrow = ctrl.borrow();
                    ctrl_borrow.get_cell_display_for_ui(&cell)
                });

                // Calculate cell position for the editor
                let (pos, config) = {
                    let vp_borrow = vp.borrow();
                    let pos = vp_borrow.get_cell_position(&cell);
                    let config = controller_stored.with_value(|c| c.borrow().get_config().clone());
                    (pos, config)
                }; // vp_borrow is dropped here

                set_cell_position.set((
                    pos.x + config.row_header_width,
                    pos.y + config.column_header_height,
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

                if let Err(e) =
                    controller_stored.with_value(|c| c.borrow_mut().dispatch_action(action))
                {
                    debug_log!("Error starting edit on double-click: {:?}", e);
                } else {
                    // Canvas_grid's effect will handle setting editing_mode based on controller state
                    // Controller will handle mode transition
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
            let _theme = default_theme();
            let config = controller_stored.with_value(|c| c.borrow().get_config().clone());
            let is_col_header = y < config.column_header_height;
            let is_row_header = x < config.row_header_width;

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
        let _theme = default_theme();
        let config = controller_stored.with_value(|c| c.borrow().get_config().clone());
        let is_col_header = y < config.column_header_height;
        let is_row_header = x < config.row_header_width;

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

    // Handle mouse wheel for scrolling
    let viewport_wheel = viewport_rc.clone();
    let on_wheel = move |ev: WheelEvent| {
        ev.prevent_default();

        // Get delta values (normalize for different scroll modes)
        let delta_x = ev.delta_x();
        let delta_y = ev.delta_y();

        // Apply scroll with sensitivity factor
        let scroll_factor = 1.0;
        let vp = viewport_wheel.clone();

        // Check if shift is pressed for horizontal scrolling
        let shift_pressed = ev.shift_key();

        let (scroll_x, scroll_y) = if shift_pressed {
            // Shift+wheel scrolls horizontally
            (delta_y * scroll_factor, 0.0)
        } else {
            // Normal wheel scrolls vertically, with horizontal if deltaX is present
            (delta_x * scroll_factor, delta_y * scroll_factor)
        };

        if scroll_x != 0.0 || scroll_y != 0.0 {
            vp.borrow_mut().scroll_by(scroll_x, scroll_y);
            // Trigger re-render
            set_viewport.update(|_| {});
            debug_log!("Scrolled by: x={}, y={}", scroll_x, scroll_y);
        }
    };

    // Handle keyboard events through controller
    let on_keydown = move |ev: KeyboardEvent| {
        let key = ev.key();
        let shift_pressed = ev.shift_key();
        let ctrl_pressed = ev.ctrl_key();
        let alt_pressed = ev.alt_key();
        let meta_pressed = ev.meta_key();

        leptos::logging::log!(
            "Canvas grid keydown: key='{}', shift={}",
            key,
            shift_pressed
        );

        // Check if we're already in editing mode
        let is_editing = controller_stored.with_value(|ctrl| {
            let ctrl_borrow = ctrl.borrow();
            let state = ctrl_borrow.get_state();
            matches!(
                state.spreadsheet_mode(),
                SpreadsheetMode::Editing | SpreadsheetMode::Insert
            )
        });

        // If we're in editing mode, let the cell editor handle the key
        if is_editing {
            leptos::logging::log!("Already in editing mode, letting cell editor handle key");
            return;
        }

        // Always prevent default for keys we might handle
        match key.as_str() {
            "Tab" | "Enter" | "Escape" | "Delete" | "Backspace" | "ArrowUp" | "ArrowDown"
            | "ArrowLeft" | "ArrowRight" => {
                ev.prevent_default();
            }
            _ if key.len() == 1 => {
                // Single character keys that might start editing
                ev.prevent_default();
            }
            _ => {}
        }

        // Convert browser keyboard event to controller event
        let controller_event = gridcore_controller::controller::KeyboardEvent::new(key.clone())
            .with_modifiers(shift_pressed, ctrl_pressed, alt_pressed, meta_pressed);

        // Get the current state before handling the event, including cell_mode
        let (old_mode, old_cursor, old_cell_mode) = controller_stored.with_value(|ctrl| {
            let ctrl_borrow = ctrl.borrow();
            let state = ctrl_borrow.get_state();
            let cell_mode = match state {
                UIState::Editing { cell_mode, .. } => Some(*cell_mode),
                _ => None,
            };
            (state.spreadsheet_mode(), *state.cursor(), cell_mode)
        });

        // Forward the event to the controller and drop the borrow immediately
        leptos::logging::log!("About to call handle_keyboard_event");
        let result = controller_stored.with_value(|ctrl| {
            let mut ctrl_borrow = ctrl.borrow_mut();
            ctrl_borrow.handle_keyboard_event(controller_event)
        }); // ctrl_borrow is dropped here

        leptos::logging::log!("Controller handle_keyboard_event returned: {:?}", result);

        // Handle any errors
        if let Err(e) = result {
            leptos::logging::log!("Error handling keyboard event: {:?}", e);
            return; // Exit early on error
        }

        // Get the updated state after handling - new borrow, including cell_mode
        let (new_mode, new_cursor, new_cell_mode) = controller_stored.with_value(|ctrl| {
            let ctrl_borrow = ctrl.borrow();
            let state = ctrl_borrow.get_state();
            let mode = state.spreadsheet_mode();
            let cursor = *state.cursor();
            let cell_mode = match state {
                UIState::Editing { cell_mode, .. } => Some(*cell_mode),
                _ => None,
            };
            leptos::logging::log!(
                "Controller state after event: mode={:?}, cursor={:?}, cell_mode={:?}",
                mode,
                cursor,
                cell_mode
            );
            (mode, cursor, cell_mode)
        });

        leptos::logging::log!(
            "After keyboard event: old_cursor={:?}, new_cursor={:?}, equal={}",
            old_cursor,
            new_cursor,
            new_cursor == old_cursor
        );

        // Update UI state based on controller state
        // Check for both mode changes and cell_mode changes within Editing state
        let mode_changed = new_mode != old_mode;
        let cell_mode_changed = new_cell_mode != old_cell_mode;
        
        if mode_changed || cell_mode_changed {
            if mode_changed {
                leptos::logging::log!("Mode changed from {:?} to {:?}", old_mode, new_mode);
            }
            if cell_mode_changed {
                leptos::logging::log!("Cell mode changed from {:?} to {:?}", old_cell_mode, new_cell_mode);
            }
            // Trigger a re-render when mode or cell_mode changes
            set_state_version.update(|v| *v += 1);
        }
        set_current_mode.set(new_mode);

        if new_cursor != old_cursor {
            leptos::logging::log!(
                "Cursor changed from {:?} to {:?}, updating active cell signal",
                old_cursor,
                new_cursor
            );
            // Update the active cell signal when cursor changes
            set_active_cell.set(new_cursor);
            // Trigger a re-render when cursor changes
            set_state_version.update(|v| *v += 1);
        } else {
            leptos::logging::log!("Cursor did not change, still at {:?}", new_cursor);
        }

        // Update cell position for editor if we're in editing mode (including visual mode within editing)
        leptos::logging::log!(
            "Checking if should show editor: new_mode = {:?}, matches Editing/Insert/Visual = {}",
            new_mode,
            matches!(
                new_mode,
                SpreadsheetMode::Editing | SpreadsheetMode::Insert | SpreadsheetMode::Visual
            )
        );
        if matches!(
            new_mode,
            SpreadsheetMode::Editing | SpreadsheetMode::Insert | SpreadsheetMode::Visual
        ) {
            let vp = viewport.get();
            let (pos, config) = {
                let vp_borrow = vp.borrow();
                let pos = vp_borrow.get_cell_position(&new_cursor);
                let config = controller_stored.with_value(|c| c.borrow().get_config().clone());
                (pos, config)
            };
            set_cell_position.set((
                pos.x + config.row_header_width,
                pos.y + config.column_header_height,
                pos.width,
                pos.height,
            ));

            // Show editor if transitioning to editing mode
            if !editing_mode.get() {
                leptos::logging::log!("Setting editing_mode to true to show cell editor");
                set_editing_mode.set(true);
            } else {
                leptos::logging::log!("editing_mode already true");
            }
        } else if editing_mode.get()
            && !matches!(
                new_mode,
                SpreadsheetMode::Editing | SpreadsheetMode::Insert | SpreadsheetMode::Visual
            )
        {
            // Hide editor if leaving editing mode (but keep visible for visual mode within editing)
            set_editing_mode.set(false);
        }

        // Update formula bar based on current state
        controller_stored.with_value(|ctrl| {
            let ctrl_borrow = ctrl.borrow();
            let state = ctrl_borrow.get_state();
            match state {
                UIState::Editing { editing_value, .. } => {
                    set_formula_value.set(editing_value.clone());
                }
                UIState::Navigation { cursor, .. } => {
                    // Update formula bar with current cell value
                    let facade = ctrl_borrow.get_facade();
                    let cell_value = if let Some(cell) = facade.get_cell(cursor) {
                        if cell.has_formula() {
                            cell.raw_value.to_string()
                        } else {
                            cell.get_display_value().to_string()
                        }
                    } else {
                        String::new()
                    };
                    set_formula_value.set(cell_value);
                }
                _ => {}
            }
        });

        // Auto-scroll to keep the active cell visible if cursor moved
        if new_cursor != old_cursor
            && !matches!(
                new_mode,
                SpreadsheetMode::Editing | SpreadsheetMode::Insert | SpreadsheetMode::Visual
            )
        {
            let vp = viewport.get();
            let mut vp_borrow = vp.borrow_mut();

            // Check if the cell is visible and scroll if needed
            let cell_pos = vp_borrow.get_cell_position(&new_cursor);

            // Calculate absolute position (without scroll offset)
            let absolute_x = cell_pos.x + vp_borrow.get_scroll_position().x;
            let absolute_y = cell_pos.y + vp_borrow.get_scroll_position().y;

            // Check if we need to scroll
            let config = controller_stored.with_value(|c| c.borrow().get_config().clone());
            let viewport_width = vp_borrow.get_viewport_width() - config.row_header_width;
            let viewport_height = vp_borrow.get_viewport_height() - config.column_header_height;
            let scroll_pos = vp_borrow.get_scroll_position();

            let mut needs_scroll = false;
            let mut new_scroll_x = scroll_pos.x;
            let mut new_scroll_y = scroll_pos.y;

            // Check horizontal scrolling
            if absolute_x < scroll_pos.x {
                new_scroll_x = absolute_x;
                needs_scroll = true;
            } else if absolute_x + cell_pos.width > scroll_pos.x + viewport_width {
                new_scroll_x = absolute_x + cell_pos.width - viewport_width;
                needs_scroll = true;
            }

            // Check vertical scrolling
            if absolute_y < scroll_pos.y {
                new_scroll_y = absolute_y;
                needs_scroll = true;
            } else if absolute_y + cell_pos.height > scroll_pos.y + viewport_height {
                new_scroll_y = absolute_y + cell_pos.height - viewport_height;
                needs_scroll = true;
            }

            if needs_scroll {
                vp_borrow.set_scroll_position(new_scroll_x.max(0.0), new_scroll_y.max(0.0));
                drop(vp_borrow);
                set_viewport.update(|_| {});
                debug_log!("Auto-scrolled to keep cell {:?} visible", new_cursor);
            }
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
                on:wheel=on_wheel
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
                _set_editing_mode=set_editing_mode
                cell_position=cell_position
                set_formula_value=set_formula_value
                set_current_mode=set_current_mode
                set_state_version=set_state_version
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
    config: &gridcore_controller::controller::GridConfiguration,
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
            viewport.get_column_x(col) - viewport.get_scroll_position().x + config.row_header_width;
        ctx.begin_path();
        ctx.move_to(x, config.column_header_height);
        ctx.line_to(x, logical_height);
        ctx.stroke();
    }

    // Draw horizontal lines
    for row in bounds.start_row..=bounds.end_row {
        let y = viewport.get_row_y(row) - viewport.get_scroll_position().y
            + config.column_header_height;
        ctx.begin_path();
        ctx.move_to(config.row_header_width, y);
        ctx.line_to(logical_width, y);
        ctx.stroke();
    }

    // Draw column headers
    ctx.set_fill_style_str(&theme.header_background_color);
    ctx.fill_rect(0.0, 0.0, logical_width, config.column_header_height);

    ctx.set_fill_style_str(&theme.header_text_color);
    ctx.set_font(&format!(
        "{}px {}",
        theme.header_font_size, theme.header_font_family
    ));

    for col in bounds.start_col..=bounds.end_col {
        let x =
            viewport.get_column_x(col) - viewport.get_scroll_position().x + config.row_header_width;
        let width = viewport.get_column_width(col);

        // Draw header background
        ctx.set_fill_style_str(&theme.header_background_color);
        ctx.fill_rect(x, 0.0, width, config.column_header_height);

        // Draw column label
        ctx.set_fill_style_str(&theme.header_text_color);
        let label = get_column_label(col);
        let text_x = x + width / 2.0 - 8.0;
        let text_y = config.column_header_height / 2.0 + 4.0;
        ctx.fill_text(&label, text_x, text_y).ok();
    }

    // Draw row headers
    for row in bounds.start_row..=bounds.end_row {
        let y = viewport.get_row_y(row) - viewport.get_scroll_position().y
            + config.column_header_height;
        let height = viewport.get_row_height(row);

        // Draw header background
        ctx.set_fill_style_str(&theme.header_background_color);
        ctx.fill_rect(0.0, y, config.row_header_width, height);

        // Draw row number
        ctx.set_fill_style_str(&theme.header_text_color);
        let label = (row + 1).to_string();
        let text_x = config.row_header_width / 2.0 - 8.0;
        let text_y = y + height / 2.0 + 4.0;
        ctx.fill_text(&label, text_x, text_y).ok();
    }

    // Draw corner
    ctx.set_fill_style_str(&theme.header_background_color);
    ctx.fill_rect(
        0.0,
        0.0,
        config.row_header_width,
        config.column_header_height,
    );

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
                    + config.row_header_width;
                let y = viewport.get_row_y(row) - viewport.get_scroll_position().y
                    + config.column_header_height;
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
        let cell_x = pos.x + config.row_header_width;
        let cell_y = pos.y + config.column_header_height;

        // Draw active cell border
        ctx.set_stroke_style_str(&theme.active_cell_border_color);
        ctx.set_line_width(2.0);
        ctx.stroke_rect(cell_x, cell_y, pos.width, pos.height);
    }

    // Restore context state (removes the scaling transform)
    ctx.restore();
}

fn get_column_label(col: usize) -> String {
    // Use the core's implementation for consistency
    gridcore_core::types::CellAddress::column_number_to_label(col as u32)
}
