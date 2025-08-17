use crate::context::{use_controller, use_render_generation, use_viewport};
use crate::debug_log;
use crate::interaction::auto_scroll::AutoScroller;
use leptos::html::Div;
use leptos::prelude::*;
use wasm_bindgen::JsCast;

#[component]
pub fn GridKeyboardHandler(children: Children) -> impl IntoView {
    let controller_stored = use_controller();
    let viewport_stored = use_viewport();
    let render_generation = use_render_generation();
    let wrapper_ref = NodeRef::<Div>::new();

    Effect::new(move |_| {
        if let Some(wrapper) = wrapper_ref.get() {
            let element: &web_sys::HtmlDivElement = wrapper.as_ref();
            let _ = element.focus();
            debug_log!("Grid keyboard handler auto-focused on mount");

            render_generation.update(|g| *g += 1);

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

        let is_editing = controller_stored.with_value(|ctrl| ctrl.borrow().get_mode().is_editing());
        if new_cursor != old_cursor && !is_editing {
            let config = controller_stored.with_value(|c| c.borrow().get_config().clone());
            let needs_scroll =
                AutoScroller::auto_scroll_to_cell(&new_cursor, viewport_stored, &config);
            if needs_scroll {
                render_generation.update(|g| *g += 1);
            }
        }
    };

    view! {
        <div
            class="grid-container grid-keyboard-handler"
            node_ref=wrapper_ref
            tabindex="0"
            on:keydown=on_keydown
            style="width: 100%; height: 100%; outline: none; position: relative; overflow: hidden;"
        >
            {children()}
        </div>
    }
}
