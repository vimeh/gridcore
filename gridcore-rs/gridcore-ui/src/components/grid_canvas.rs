use crate::context::{use_controller, use_device_pixel_ratio, use_reactive_signals, use_viewport};
use leptos::html::Canvas;
use leptos::prelude::*;

use crate::rendering::{CanvasRenderer, RenderParams, default_theme};

#[component]
pub fn GridCanvas() -> impl IntoView {
    // Get controller, viewport and reactive signals from context
    let controller_stored = use_controller();
    let viewport_stored = use_viewport();
    let (state_generation, render_generation) = use_reactive_signals();
    let device_pixel_ratio_signal = use_device_pixel_ratio();
    let canvas_ref = NodeRef::<Canvas>::new();
    let (canvas_dimensions, set_canvas_dimensions) = signal((0.0, 0.0));

    let theme = default_theme();
    let renderer = CanvasRenderer::new(theme);

    // Set up canvas rendering effect - only for DOM updates
    Effect::new(move |_| {
        render_generation.get(); // Track render changes
        state_generation.get(); // Also track state changes
        let device_pixel_ratio = device_pixel_ratio_signal.get();

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
                    let active_cell = ctrl_borrow.cursor();
                    let selection = ctrl_borrow.get_selection().cloned();
                    let facade = ctrl_borrow.facade();
                    let config = ctrl_borrow.get_config();

                    let render_params = RenderParams {
                        canvas: canvas_elem,
                        viewport: &vp.borrow(),
                        active_cell,
                        selection,
                        facade,
                        device_pixel_ratio,
                        config,
                    };
                    renderer.render(&render_params);
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
                (width * device_pixel_ratio_signal.get()) as u32
            }
            height=move || {
                let (_, height) = canvas_dimensions.get();
                (height * device_pixel_ratio_signal.get()) as u32
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
