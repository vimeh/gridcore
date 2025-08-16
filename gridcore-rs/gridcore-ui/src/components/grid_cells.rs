use gridcore_controller::controller::GridConfiguration;
use gridcore_controller::controller::ViewportBounds;
use gridcore_core::types::{CellAddress, CellValue};
use gridcore_core::SpreadsheetFacade;
use wasm_bindgen::JsCast;
use web_sys::{CanvasRenderingContext2d, HtmlCanvasElement};

use crate::components::viewport::Viewport;
use crate::rendering::GridTheme;

#[derive(Clone)]
pub struct GridCells {
    theme: GridTheme,
}

impl GridCells {
    pub fn new(theme: GridTheme) -> Self {
        Self { theme }
    }

    pub fn render(
        &self,
        canvas: &HtmlCanvasElement,
        viewport: &Viewport,
        bounds: &ViewportBounds,
        facade: &SpreadsheetFacade,
        config: &GridConfiguration,
        device_pixel_ratio: f64,
    ) {
        let ctx = match self.get_context(canvas) {
            Some(ctx) => ctx,
            None => return,
        };

        ctx.save();
        ctx.scale(device_pixel_ratio, device_pixel_ratio).ok();

        self.render_cell_content(&ctx, viewport, bounds, facade, config);

        ctx.restore();
    }

    fn get_context(&self, canvas: &HtmlCanvasElement) -> Option<CanvasRenderingContext2d> {
        canvas
            .get_context("2d")
            .ok()?
            .and_then(|ctx| ctx.dyn_into::<CanvasRenderingContext2d>().ok())
    }

    fn render_cell_content(
        &self,
        ctx: &CanvasRenderingContext2d,
        viewport: &Viewport,
        bounds: &ViewportBounds,
        facade: &SpreadsheetFacade,
        config: &GridConfiguration,
    ) {
        ctx.set_fill_style_str(&self.theme.cell_text_color);
        ctx.set_font(&format!(
            "{}px {}",
            self.theme.cell_font_size, self.theme.cell_font_family
        ));

        for row in bounds.start_row..=bounds.end_row {
            for col in bounds.start_col..=bounds.end_col {
                let cell_address = CellAddress::new(col as u32, row as u32);

                if let Some(cell) = facade.get_cell(&cell_address) {
                    let display_value = cell.get_display_value();
                    let value_str = display_value.to_string();

                    let x = viewport.get_column_x(col) - viewport.get_scroll_position().x
                        + config.row_header_width;
                    let y = viewport.get_row_y(row) - viewport.get_scroll_position().y
                        + config.column_header_height;
                    let height = viewport.get_row_height(row);

                    let is_error = matches!(display_value, CellValue::Error(_));
                    if is_error {
                        ctx.set_fill_style_str("#ff4444");
                    } else {
                        ctx.set_fill_style_str(&self.theme.cell_text_color);
                    }

                    let text_x = x + self.theme.cell_padding_left;
                    let text_y = y + height / 2.0 + 4.0;
                    ctx.fill_text(&value_str, text_x, text_y).ok();

                    if is_error {
                        ctx.set_fill_style_str(&self.theme.cell_text_color);
                    }
                }
            }
        }
    }
}
