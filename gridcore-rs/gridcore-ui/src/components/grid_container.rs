use gridcore_controller::controller::SpreadsheetController;
use gridcore_controller::state::SpreadsheetMode;
use gridcore_core::types::CellAddress;
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
pub fn GridContainer(
    active_cell: Memo<CellAddress>,
    current_mode: Memo<SpreadsheetMode>,
    render_trigger: Trigger,
    mode_trigger: Trigger,
) -> impl IntoView {
    // Get controller from context
    let controller_stored: StoredValue<Rc<RefCell<SpreadsheetController>>, LocalStorage> =
        use_context().expect("SpreadsheetController not found in context");
    let controller_rc = controller_stored.get_value();

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

    // Derive editing mode
    let editing_mode = Memo::new(move |_| {
        mode_trigger.track();
        controller_stored.with_value(|ctrl| {
            let ctrl_borrow = ctrl.borrow();
            ctrl_borrow.get_mode().is_editing()
        })
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
            let element: &web_sys::HtmlDivElement = wrapper.as_ref();
            let _ = element.focus();
            debug_log!("Grid container auto-focused on mount");

            // Trigger initial render
            render_trigger.notify();

            // Use requestAnimationFrame for layout completion
            let window = web_sys::window().expect("window should exist");
            let render_trigger_clone = render_trigger;
            let closure = wasm_bindgen::closure::Closure::once(move || {
                render_trigger_clone.notify();
            });
            window
                .request_animation_frame(closure.as_ref().unchecked_ref())
                .ok();
            closure.forget();
        }
    });

    // Update formula bar when cell changes
    Effect::new(move |_| {
        let cell = active_cell.get();
        debug_log!("Formula bar update: active_cell = {:?}", cell);

        controller_stored.with_value(|ctrl| {
            let ctrl_borrow = ctrl.borrow();
            let value = ctrl_borrow.get_cell_display_for_ui(&cell);
            if !value.is_empty() {
                debug_log!("Cell found at {:?}: value={}", cell, value);
            }
        });
    });

    view! {
        <div
            class="grid-container"
            node_ref=wrapper_ref
            tabindex="0"
            style="width: 100%; height: 100%; outline: none; position: relative; overflow: hidden;"
        >
            <GridEventHandler
                controller_stored=controller_stored
                viewport_stored=viewport_stored
                resize_handler=resize_handler
                render_trigger=render_trigger
                mode_trigger=mode_trigger
            >
                <GridCanvas
                    controller_stored=controller_stored
                    viewport_stored=viewport_stored
                    active_cell=active_cell
                    render_trigger=render_trigger
                />
                <CellEditor
                    active_cell=active_cell
                    editing_mode=editing_mode
                    cell_position=cell_position
                    _current_mode=current_mode
                    _render_trigger=render_trigger
                />
            </GridEventHandler>
        </div>
    }
}
