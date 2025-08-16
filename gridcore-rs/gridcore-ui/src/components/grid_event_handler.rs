use gridcore_controller::controller::SpreadsheetController;
use gridcore_controller::state::Action;
use leptos::prelude::*;
use std::cell::RefCell;
use std::rc::Rc;
use wasm_bindgen::JsCast;
use web_sys::{MouseEvent, WheelEvent};

use crate::components::viewport::Viewport;
use crate::interaction::resize_handler::ResizeHandler;

#[component]
pub fn GridEventHandler(
    controller_stored: StoredValue<Rc<RefCell<SpreadsheetController>>, LocalStorage>,
    viewport_stored: StoredValue<Rc<RefCell<Viewport>>, LocalStorage>,
    resize_handler: ResizeHandler,
    children: Children,
) -> impl IntoView {
    let (resize_hover_state, set_resize_hover_state) = signal("cell");

    // Handle mouse click
    let on_click = move |ev: MouseEvent| {
        // Focus the parent grid-container instead of this element
        if let Some(current_target) = ev.current_target() {
            if let Ok(element) = current_target.dyn_into::<web_sys::HtmlElement>() {
                if let Some(parent) = element.parent_element() {
                    if let Ok(parent_element) = parent.dyn_into::<web_sys::HtmlElement>() {
                        if parent_element.class_name().contains("grid-container") {
                            let _ = parent_element.focus();
                        }
                    }
                }
            }
        }

        let x = ev.offset_x() as f64;
        let y = ev.offset_y() as f64;

        let config = controller_stored.with_value(|c| c.borrow().get_config().clone());

        if x > config.row_header_width && y > config.column_header_height {
            let cell_x = x - config.row_header_width;
            let cell_y = y - config.column_header_height;

            if let Some(cell) =
                viewport_stored.with_value(|vp| vp.borrow().get_cell_at_position(cell_x, cell_y))
            {
                controller_stored.with_value(|c| {
                    let _ = c
                        .borrow_mut()
                        .dispatch_action(Action::UpdateCursor { cursor: cell });
                });
            }
        }
    };

    // Handle double-click
    let on_dblclick = move |ev: MouseEvent| {
        let x = ev.offset_x() as f64;
        let y = ev.offset_y() as f64;

        let config = controller_stored.with_value(|c| c.borrow().get_config().clone());

        if x > config.row_header_width && y > config.column_header_height {
            let cell_x = x - config.row_header_width;
            let cell_y = y - config.column_header_height;

            if let Some(cell) =
                viewport_stored.with_value(|vp| vp.borrow().get_cell_at_position(cell_x, cell_y))
            {
                controller_stored.with_value(|ctrl| {
                    let mut ctrl_mut = ctrl.borrow_mut();
                    ctrl_mut.set_cursor(cell);

                    let existing_value = ctrl_mut.get_cell_display_for_ui(&cell);

                    use gridcore_controller::controller::mode::{CellEditMode, EditorMode};
                    use gridcore_controller::state::InsertMode;

                    ctrl_mut.set_mode(EditorMode::CellEditing {
                        value: existing_value,
                        cursor_pos: 0,
                        mode: CellEditMode::Insert(InsertMode::I),
                        visual_anchor: None,
                    });
                });

                // State change will be picked up automatically
            }
        }
    };

    // Handle mouse move
    let resize_handler_move = resize_handler.clone();
    let on_mouse_move = move |ev: MouseEvent| {
        let x = ev.offset_x() as f64;
        let y = ev.offset_y() as f64;

        if resize_handler_move.is_resizing() {
            resize_handler_move.handle_resize(&ev);
            // Render will update automatically via state changes
        } else {
            let config = controller_stored.with_value(|c| c.borrow().get_config().clone());
            let is_col_header = y < config.column_header_height;
            let is_row_header = x < config.row_header_width;

            if is_col_header || is_row_header {
                let cursor = resize_handler_move.get_cursor_style(
                    if is_col_header { x } else { 0.0 },
                    if is_row_header { y } else { 0.0 },
                    is_col_header,
                );
                set_resize_hover_state.set(cursor);
            } else {
                set_resize_hover_state.set("cell");
            }
        }
    };

    // Handle mouse down
    let resize_handler_down = resize_handler.clone();
    let on_mouse_down = move |ev: MouseEvent| {
        let x = ev.offset_x() as f64;
        let y = ev.offset_y() as f64;
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

    // Handle mouse up
    let resize_handler_up = resize_handler.clone();
    let on_mouse_up = move |_ev: MouseEvent| {
        if resize_handler_up.is_resizing() {
            resize_handler_up.end_resize();
            // Render will update automatically via state changes
        }
    };

    // Handle wheel
    let on_wheel = move |ev: WheelEvent| {
        ev.prevent_default();

        let delta_x = ev.delta_x();
        let delta_y = ev.delta_y();
        let scroll_factor = 1.0;
        let shift_pressed = ev.shift_key();

        let (scroll_x, scroll_y) = if shift_pressed {
            (delta_y * scroll_factor, 0.0)
        } else {
            (delta_x * scroll_factor, delta_y * scroll_factor)
        };

        if scroll_x != 0.0 || scroll_y != 0.0 {
            viewport_stored.with_value(|vp| vp.borrow_mut().scroll_by(scroll_x, scroll_y));
            // Manual render update for scroll
            if let Some(render_gen) = use_context::<RwSignal<u32>>() {
                render_gen.update(|g| *g += 1);
            }
        }
    };

    view! {
        <div
            class="grid-event-handler"
            on:click=on_click
            on:dblclick=on_dblclick
            on:mousedown=on_mouse_down
            on:mousemove=on_mouse_move
            on:mouseup=on_mouse_up
            on:wheel=on_wheel
            style=move || format!("cursor: {}; width: 100%; height: 100%; outline: none;", resize_hover_state.get())
        >
            {children()}
        </div>
    }
}
