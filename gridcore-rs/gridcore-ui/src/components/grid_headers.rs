use gridcore_controller::controller::GridConfiguration;
use gridcore_controller::controller::ViewportBounds;
use gridcore_core::types::CellAddress;
use wasm_bindgen::JsCast;
use web_sys::{CanvasRenderingContext2d, HtmlCanvasElement};

use crate::components::viewport::Viewport;
use crate::rendering::GridTheme;

#[derive(Clone)]
pub struct GridHeaders {
    theme: GridTheme,
}

impl GridHeaders {
    pub fn new(theme: GridTheme) -> Self {
        Self { theme }
    }

    pub fn render(
        &self,
        canvas: &HtmlCanvasElement,
        viewport: &Viewport,
        bounds: &ViewportBounds,
        config: &GridConfiguration,
        device_pixel_ratio: f64,
    ) {
        let ctx = match self.get_context(canvas) {
            Some(ctx) => ctx,
            None => return,
        };

        ctx.save();
        ctx.scale(device_pixel_ratio, device_pixel_ratio).ok();

        let logical_width = (canvas.width() as f64) / device_pixel_ratio;

        self.render_column_headers(&ctx, viewport, bounds, config, logical_width);
        self.render_row_headers(&ctx, viewport, bounds, config);
        self.render_corner(&ctx, config);

        ctx.restore();
    }

    fn get_context(&self, canvas: &HtmlCanvasElement) -> Option<CanvasRenderingContext2d> {
        canvas
            .get_context("2d")
            .ok()?
            .and_then(|ctx| ctx.dyn_into::<CanvasRenderingContext2d>().ok())
    }

    fn render_column_headers(
        &self,
        ctx: &CanvasRenderingContext2d,
        viewport: &Viewport,
        bounds: &ViewportBounds,
        config: &GridConfiguration,
        logical_width: f64,
    ) {
        ctx.set_fill_style_str(&self.theme.header_background_color);
        ctx.fill_rect(0.0, 0.0, logical_width, config.column_header_height);

        ctx.set_fill_style_str(&self.theme.header_text_color);
        ctx.set_font(&format!(
            "{}px {}",
            self.theme.header_font_size, self.theme.header_font_family
        ));

        for col in bounds.start_col..=bounds.end_col {
            let x = viewport.get_column_x(col) - viewport.get_scroll_position().x
                + config.row_header_width;
            let width = viewport.get_column_width(col);

            ctx.set_fill_style_str(&self.theme.header_background_color);
            ctx.fill_rect(x, 0.0, width, config.column_header_height);

            ctx.set_stroke_style_str(&self.theme.grid_line_color);
            ctx.set_line_width(1.0);
            ctx.begin_path();
            ctx.move_to(x + width, 0.0);
            ctx.line_to(x + width, config.column_header_height);
            ctx.stroke();

            ctx.set_fill_style_str(&self.theme.header_text_color);
            let label = CellAddress::column_number_to_label(col as u32);
            let text_x = x + width / 2.0 - 8.0;
            let text_y = config.column_header_height / 2.0 + 4.0;
            ctx.fill_text(&label, text_x, text_y).ok();
        }
    }

    fn render_row_headers(
        &self,
        ctx: &CanvasRenderingContext2d,
        viewport: &Viewport,
        bounds: &ViewportBounds,
        config: &GridConfiguration,
    ) {
        ctx.set_fill_style_str(&self.theme.header_text_color);
        ctx.set_font(&format!(
            "{}px {}",
            self.theme.header_font_size, self.theme.header_font_family
        ));

        for row in bounds.start_row..=bounds.end_row {
            let y = viewport.get_row_y(row) - viewport.get_scroll_position().y
                + config.column_header_height;
            let height = viewport.get_row_height(row);

            ctx.set_fill_style_str(&self.theme.header_background_color);
            ctx.fill_rect(0.0, y, config.row_header_width, height);

            ctx.set_stroke_style_str(&self.theme.grid_line_color);
            ctx.set_line_width(1.0);
            ctx.begin_path();
            ctx.move_to(0.0, y + height);
            ctx.line_to(config.row_header_width, y + height);
            ctx.stroke();

            ctx.set_fill_style_str(&self.theme.header_text_color);
            let label = (row + 1).to_string();
            let text_x = config.row_header_width / 2.0 - 8.0;
            let text_y = y + height / 2.0 + 4.0;
            ctx.fill_text(&label, text_x, text_y).ok();
        }
    }

    fn render_corner(&self, ctx: &CanvasRenderingContext2d, config: &GridConfiguration) {
        ctx.set_fill_style_str(&self.theme.header_background_color);
        ctx.fill_rect(
            0.0,
            0.0,
            config.row_header_width,
            config.column_header_height,
        );

        ctx.set_stroke_style_str(&self.theme.grid_line_color);
        ctx.set_line_width(1.0);
        ctx.stroke_rect(
            0.0,
            0.0,
            config.row_header_width,
            config.column_header_height,
        );
    }
}
