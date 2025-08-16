use gridcore_controller::controller::SpreadsheetController;
use gridcore_core::types::CellAddress;
use leptos::html::Canvas;
use leptos::prelude::*;
use std::cell::RefCell;
use std::rc::Rc;

use crate::components::viewport::Viewport;
use crate::rendering::{default_theme, CanvasRenderer};

#[component]
pub fn GridCanvas(
    controller_stored: StoredValue<Rc<RefCell<SpreadsheetController>>, LocalStorage>,
    viewport_stored: StoredValue<Rc<RefCell<Viewport>>, LocalStorage>,
    active_cell: Memo<CellAddress>,
    render_trigger: Trigger,
) -> impl IntoView {
    let canvas_ref = NodeRef::<Canvas>::new();
    let (canvas_dimensions, set_canvas_dimensions) = signal((0.0, 0.0));

    let device_pixel_ratio = web_sys::window()
        .map(|w| w.device_pixel_ratio())
        .unwrap_or(1.0);

    let theme = default_theme();
    let renderer = CanvasRenderer::new(theme);

    // Set up canvas rendering
    Effect::new(move |_| {
        let _current_cell = active_cell.get();
        render_trigger.track();

        if let Some(canvas) = canvas_ref.get() {
            let canvas_elem: &web_sys::HtmlCanvasElement = &canvas;

            // Update canvas dimensions based on parent container
            if let Some(parent) = canvas_elem.parent_element() {
                let rect = parent.get_bounding_client_rect();
                let width = rect.width();
                let height = rect.height();

                if width > 0.0 && height > 0.0 {
                    canvas_elem.set_width((width * device_pixel_ratio) as u32);
                    canvas_elem.set_height((height * device_pixel_ratio) as u32);
                    set_canvas_dimensions.set((width, height));

                    viewport_stored.with_value(|vp| {
                        vp.borrow_mut().set_viewport_size(width, height);
                    });
                }
            }

            // Render the grid
            controller_stored.with_value(|ctrl| {
                viewport_stored.with_value(|vp| {
                    let ctrl_borrow = ctrl.borrow();
                    let active_cell = active_cell.get();
                    let selection = ctrl_borrow.get_selection().cloned();
                    let facade = ctrl_borrow.facade();
                    let config = ctrl_borrow.get_config();

                    renderer.render(
                        canvas_elem,
                        &vp.borrow(),
                        active_cell,
                        selection,
                        facade,
                        device_pixel_ratio,
                        config,
                    );
                });
            });
        }
    });

    view! {
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
            style=move || {
                let (width, height) = canvas_dimensions.get();
                format!(
                    "display: block; border: 1px solid #e0e0e0; background: white; width: {}px; height: {}px;",
                    if width > 0.0 { width } else { 0.0 },
                    if height > 0.0 { height } else { 0.0 }
                )
            }
        />
    }
}
