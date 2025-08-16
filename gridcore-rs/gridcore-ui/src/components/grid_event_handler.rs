use gridcore_controller::controller::SpreadsheetController;
use gridcore_controller::state::Action;
use leptos::prelude::*;
use std::cell::RefCell;
use std::rc::Rc;
use web_sys::{KeyboardEvent, MouseEvent, WheelEvent};

use crate::components::viewport::Viewport;
use crate::interaction::resize_handler::ResizeHandler;

#[component]
pub fn GridEventHandler(
    controller_stored: StoredValue<Rc<RefCell<SpreadsheetController>>, LocalStorage>,
    viewport_stored: StoredValue<Rc<RefCell<Viewport>>, LocalStorage>,
    resize_handler: ResizeHandler,
    render_trigger: Trigger,
    mode_trigger: Trigger,
    children: Children,
) -> impl IntoView {
    let (resize_hover_state, set_resize_hover_state) = signal("cell");

    // Handle mouse click
    let on_click = move |ev: MouseEvent| {
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

                mode_trigger.notify();
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
            render_trigger.notify();
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
            render_trigger.notify();
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
            render_trigger.notify();
        }
    };

    // Handle keyboard
    let on_keydown = move |ev: KeyboardEvent| {
        let key = ev.key();
        let shift_pressed = ev.shift_key();
        let ctrl_pressed = ev.ctrl_key();
        let alt_pressed = ev.alt_key();
        let meta_pressed = ev.meta_key();

        let is_editing = controller_stored.with_value(|ctrl| ctrl.borrow().get_mode().is_editing());

        if is_editing {
            return;
        }

        // Prevent default for navigation and editing keys
        match key.as_str() {
            "Tab" | "Enter" | "Escape" | "Delete" | "Backspace" | "ArrowUp" | "ArrowDown"
            | "ArrowLeft" | "ArrowRight" => {
                ev.prevent_default();
            }
            _ if key.len() == 1 => {
                ev.prevent_default();
            }
            _ => {}
        }

        let controller_event = gridcore_controller::controller::KeyboardEvent::new(key.clone())
            .with_modifiers(shift_pressed, ctrl_pressed, alt_pressed, meta_pressed);

        let old_cursor = controller_stored.with_value(|ctrl| ctrl.borrow().cursor());

        let result = controller_stored
            .with_value(|ctrl| ctrl.borrow_mut().handle_keyboard_event(controller_event));

        if let Err(e) = result {
            leptos::logging::log!("Error handling keyboard event: {:?}", e);
            return;
        }

        let new_cursor = controller_stored.with_value(|ctrl| ctrl.borrow().cursor());

        // Auto-scroll if cursor moved
        let is_editing = controller_stored.with_value(|ctrl| ctrl.borrow().get_mode().is_editing());
        if new_cursor != old_cursor && !is_editing {
            let needs_scroll = viewport_stored.with_value(|vp| {
                let mut vp_borrow = vp.borrow_mut();
                let cell_pos = vp_borrow.get_cell_position(&new_cursor);
                let absolute_x = cell_pos.x + vp_borrow.get_scroll_position().x;
                let absolute_y = cell_pos.y + vp_borrow.get_scroll_position().y;

                let config = controller_stored.with_value(|c| c.borrow().get_config().clone());
                let viewport_width = vp_borrow.get_viewport_width() - config.row_header_width;
                let viewport_height = vp_borrow.get_viewport_height() - config.column_header_height;
                let scroll_pos = vp_borrow.get_scroll_position();

                let mut needs_scroll = false;
                let mut new_scroll_x = scroll_pos.x;
                let mut new_scroll_y = scroll_pos.y;

                if absolute_x < scroll_pos.x {
                    new_scroll_x = absolute_x;
                    needs_scroll = true;
                } else if absolute_x + cell_pos.width > scroll_pos.x + viewport_width {
                    new_scroll_x = absolute_x + cell_pos.width - viewport_width;
                    needs_scroll = true;
                }

                if absolute_y < scroll_pos.y {
                    new_scroll_y = absolute_y;
                    needs_scroll = true;
                } else if absolute_y + cell_pos.height > scroll_pos.y + viewport_height {
                    new_scroll_y = absolute_y + cell_pos.height - viewport_height;
                    needs_scroll = true;
                }

                if needs_scroll {
                    vp_borrow.set_scroll_position(new_scroll_x.max(0.0), new_scroll_y.max(0.0));
                }
                needs_scroll
            });
            if needs_scroll {
                render_trigger.notify();
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
            on:keydown=on_keydown
            style=move || format!("cursor: {};", resize_hover_state.get())
        >
            {children()}
        </div>
    }
}
