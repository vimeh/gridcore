use crate::context::{use_app_state, use_reactive_signals};
use leptos::html::Div;
use leptos::prelude::*;
use std::cell::RefCell;
use std::rc::Rc;
use wasm_bindgen::JsCast;

use crate::components::cell_editor::CellEditor;
use crate::components::grid_canvas::GridCanvas;
use crate::components::grid_event_handler::GridEventHandler;
use crate::components::viewport::Viewport;
use crate::debug_log;
use crate::interaction::resize_handler::ResizeHandler;
use crate::rendering::default_theme;

#[component]
pub fn GridContainer() -> impl IntoView {
    // Get app state from context
    let app_state = use_app_state();
    let controller_stored = app_state.controller;
    let controller_rc = controller_stored.get_value();
    let (state_generation, render_generation) = use_reactive_signals();

    // Node refs
    let wrapper_ref = NodeRef::<Div>::new();
    let theme = default_theme();

    // Create viewport
    let viewport_rc = Rc::new(RefCell::new(Viewport::new(
        theme.clone(),
        controller_rc.clone(),
    )));
    let viewport_stored =
        StoredValue::<Rc<RefCell<Viewport>>, LocalStorage>::new_local(viewport_rc.clone());

    // Create resize handler
    let resize_handler = ResizeHandler::new(controller_rc.clone());

    // Derive reactive values from controller state
    let active_cell = Memo::new(move |_| {
        state_generation.get(); // Track changes
        controller_stored.with_value(|ctrl| ctrl.borrow().cursor())
    });

    // Derive editing mode
    let editing_mode = Memo::new(move |_| {
        state_generation.get(); // Track changes
        controller_stored.with_value(|ctrl| ctrl.borrow().get_mode().is_editing())
    });

    // Derive cell position for editor
    let cell_position = Memo::new(move |_| {
        if editing_mode.get() {
            let cell = active_cell.get();
            viewport_stored.with_value(|vp| {
                let vp_borrow = vp.borrow();
                let pos = vp_borrow.get_cell_position(&cell);
                let (row_header_width, column_header_height) = controller_stored.with_value(|c| {
                    let borrow = c.borrow();
                    let config = borrow.get_config();
                    (config.row_header_width, config.column_header_height)
                });
                (
                    pos.x + row_header_width,
                    pos.y + column_header_height,
                    pos.width,
                    pos.height,
                )
            })
        } else {
            (0.0, 0.0, 100.0, 25.0)
        }
    });

    // Auto-focus on mount
    Effect::new(move |_| {
        if let Some(wrapper) = wrapper_ref.get() {
            // Focus the grid container itself for proper navigation mode focus
            let element: &web_sys::HtmlDivElement = wrapper.as_ref();
            let _ = element.focus();
            debug_log!("Grid container auto-focused on mount");

            // Trigger initial render by updating generation
            render_generation.update(|g| *g += 1);

            // Use requestAnimationFrame for layout completion
            let window = web_sys::window().expect("window should exist");
            let render_gen_clone = render_generation;
            let closure = wasm_bindgen::closure::Closure::once(move || {
                render_gen_clone.update(|g| *g += 1);
            });
            window
                .request_animation_frame(closure.as_ref().unchecked_ref())
                .ok();
            closure.forget();
        }
    });

    // No need for formula bar effect - it's handled by derived signals in app.rs

    // Handle keyboard events
    let on_keydown = move |ev: web_sys::KeyboardEvent| {
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
        let _old_mode = controller_stored.with_value(|ctrl| ctrl.borrow().get_mode().clone());

        let result = controller_stored
            .with_value(|ctrl| ctrl.borrow_mut().handle_keyboard_event(controller_event));

        if let Err(e) = result {
            leptos::logging::log!("Error handling keyboard event: {:?}", e);
            return;
        }

        let new_cursor = controller_stored.with_value(|ctrl| ctrl.borrow().cursor());
        let _new_mode = controller_stored.with_value(|ctrl| ctrl.borrow().get_mode().clone());

        // State change will be picked up by reactive state automatically

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
                render_generation.update(|g| *g += 1);
            }
        }
    };

    view! {
        <div
            class="grid-container"
            node_ref=wrapper_ref
            tabindex="0"
            on:keydown=on_keydown
            style="width: 100%; height: 100%; outline: none; position: relative; overflow: hidden;"
        >
            <GridEventHandler
                viewport_stored=viewport_stored
                resize_handler=resize_handler
            >
                <GridCanvas
                    viewport_stored=viewport_stored
                />
                <CellEditor
                    active_cell=active_cell
                    editing_mode=editing_mode
                    cell_position=cell_position
                />
            </GridEventHandler>
        </div>
    }
}
