use gridcore_controller::controller::ViewportBounds;
use leptos::prelude::{GetUntracked, WithValue};
use wasm_bindgen::JsCast;
use web_sys::{CanvasRenderingContext2d, HtmlCanvasElement};

use crate::components::grid_cells::GridCells;
use crate::components::grid_headers::GridHeaders;
use crate::components::grid_selection::GridSelection;
use crate::context::{use_controller, use_device_pixel_ratio, use_viewport};
use crate::rendering::GridTheme;

pub struct CanvasRenderer {
    theme: GridTheme,
    headers: GridHeaders,
    cells: GridCells,
    selection: GridSelection,
}

impl CanvasRenderer {
    pub fn new(theme: GridTheme) -> Self {
        Self {
            headers: GridHeaders::new(theme.clone()),
            cells: GridCells::new(theme.clone()),
            selection: GridSelection::new(theme.clone()),
            theme,
        }
    }

    pub fn render(&self, canvas: &HtmlCanvasElement) {
        let ctx = match self.get_context(canvas) {
            Some(ctx) => ctx,
            None => return,
        };

        let controller_stored = use_controller();
        let viewport_stored = use_viewport();
        let device_pixel_ratio = use_device_pixel_ratio().get_untracked();

        ctx.save();
        ctx.scale(device_pixel_ratio, device_pixel_ratio).ok();

        let logical_width = (canvas.width() as f64) / device_pixel_ratio;
        let logical_height = (canvas.height() as f64) / device_pixel_ratio;

        self.clear_canvas(&ctx, logical_width, logical_height);

        viewport_stored.with_value(|vp| {
            controller_stored.with_value(|ctrl| {
                let viewport = vp.borrow();
                let bounds = viewport.get_visible_bounds();
                let ctrl_borrow = ctrl.borrow();
                let config = ctrl_borrow.get_config();

                self.render_background(&ctx, logical_width, logical_height);
                self.render_grid_lines(
                    &ctx,
                    &viewport,
                    &bounds,
                    config,
                    logical_width,
                    logical_height,
                );
            });
        });

        ctx.restore();

        // Render components using their own contexts
        self.headers.render(canvas);
        self.cells.render(canvas);
        self.selection.render(canvas);
    }

    fn get_context(&self, canvas: &HtmlCanvasElement) -> Option<CanvasRenderingContext2d> {
        canvas
            .get_context("2d")
            .ok()?
            .and_then(|ctx| ctx.dyn_into::<CanvasRenderingContext2d>().ok())
    }

    fn clear_canvas(&self, ctx: &CanvasRenderingContext2d, width: f64, height: f64) {
        ctx.clear_rect(0.0, 0.0, width, height);
    }

    fn render_background(&self, ctx: &CanvasRenderingContext2d, width: f64, height: f64) {
        ctx.set_fill_style_str(&self.theme.background_color);
        ctx.fill_rect(0.0, 0.0, width, height);
    }

    fn render_grid_lines(
        &self,
        ctx: &CanvasRenderingContext2d,
        viewport: &crate::components::viewport::Viewport,
        bounds: &ViewportBounds,
        config: &gridcore_controller::controller::GridConfiguration,
        logical_width: f64,
        logical_height: f64,
    ) {
        ctx.set_stroke_style_str(&self.theme.grid_line_color);
        ctx.set_line_width(1.0);

        // Vertical lines
        for col in bounds.start_col..=bounds.end_col {
            let x = viewport.get_column_x(col) - viewport.get_scroll_position().x
                + config.row_header_width;
            ctx.begin_path();
            ctx.move_to(x, config.column_header_height);
            ctx.line_to(x, logical_height);
            ctx.stroke();
        }

        // Horizontal lines
        for row in bounds.start_row..=bounds.end_row {
            let y = viewport.get_row_y(row) - viewport.get_scroll_position().y
                + config.column_header_height;
            ctx.begin_path();
            ctx.move_to(config.row_header_width, y);
            ctx.line_to(logical_width, y);
            ctx.stroke();
        }
    }
}
