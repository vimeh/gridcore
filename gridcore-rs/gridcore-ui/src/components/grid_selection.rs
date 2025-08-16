use gridcore_controller::controller::GridConfiguration;
use gridcore_controller::controller::ViewportBounds;
use gridcore_controller::state::{Selection, SelectionType};
use gridcore_core::types::CellAddress;
use wasm_bindgen::JsCast;
use web_sys::{CanvasRenderingContext2d, HtmlCanvasElement};

use crate::components::viewport::Viewport;
use crate::rendering::GridTheme;

#[derive(Clone)]
pub struct GridSelection {
    theme: GridTheme,
}

impl GridSelection {
    pub fn new(theme: GridTheme) -> Self {
        Self { theme }
    }

    pub fn render(
        &self,
        canvas: &HtmlCanvasElement,
        selection: Option<&Selection>,
        active_cell: &CellAddress,
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

        if let Some(sel) = selection {
            self.render_selection_overlay(&ctx, sel, viewport, config, bounds);
        }

        self.render_active_cell_border(&ctx, viewport, active_cell, bounds, config);

        ctx.restore();
    }

    fn get_context(&self, canvas: &HtmlCanvasElement) -> Option<CanvasRenderingContext2d> {
        canvas
            .get_context("2d")
            .ok()?
            .and_then(|ctx| ctx.dyn_into::<CanvasRenderingContext2d>().ok())
    }

    fn render_selection_overlay(
        &self,
        ctx: &CanvasRenderingContext2d,
        selection: &Selection,
        viewport: &Viewport,
        config: &GridConfiguration,
        bounds: &ViewportBounds,
    ) {
        ctx.set_fill_style_str("rgba(0, 120, 215, 0.2)");
        ctx.set_stroke_style_str("rgba(0, 120, 215, 0.8)");
        ctx.set_line_width(1.0);

        match &selection.selection_type {
            SelectionType::Range { start, end } => {
                let min_col = start.col.min(end.col) as usize;
                let max_col = start.col.max(end.col) as usize;
                let min_row = start.row.min(end.row) as usize;
                let max_row = start.row.max(end.row) as usize;

                if min_col <= bounds.end_col
                    && max_col >= bounds.start_col
                    && min_row <= bounds.end_row
                    && max_row >= bounds.start_row
                {
                    let x1 = viewport.get_column_x(min_col) - viewport.get_scroll_position().x
                        + config.row_header_width;
                    let x2 = viewport.get_column_x(max_col) - viewport.get_scroll_position().x
                        + config.row_header_width
                        + viewport.get_column_width(max_col);
                    let y1 = viewport.get_row_y(min_row) - viewport.get_scroll_position().y
                        + config.column_header_height;
                    let y2 = viewport.get_row_y(max_row) - viewport.get_scroll_position().y
                        + config.column_header_height
                        + viewport.get_row_height(max_row);

                    ctx.fill_rect(x1, y1, x2 - x1, y2 - y1);
                    ctx.stroke_rect(x1, y1, x2 - x1, y2 - y1);
                }
            }
            SelectionType::Cell { address } => {
                if address.col as usize >= bounds.start_col
                    && address.col as usize <= bounds.end_col
                    && address.row as usize >= bounds.start_row
                    && address.row as usize <= bounds.end_row
                {
                    let pos = viewport.get_cell_position(address);
                    let cell_x = pos.x + config.row_header_width;
                    let cell_y = pos.y + config.column_header_height;
                    ctx.fill_rect(cell_x, cell_y, pos.width, pos.height);
                    ctx.stroke_rect(cell_x, cell_y, pos.width, pos.height);
                }
            }
            SelectionType::Row { rows } => {
                for row in rows {
                    if (*row as usize) >= bounds.start_row && (*row as usize) <= bounds.end_row {
                        let y = viewport.get_row_y(*row as usize)
                            - viewport.get_scroll_position().y
                            + config.column_header_height;
                        let height = viewport.get_row_height(*row as usize);
                        let viewport_width = (bounds.end_col - bounds.start_col + 1) as f64 * 100.0;
                        ctx.fill_rect(config.row_header_width, y, viewport_width, height);
                        ctx.stroke_rect(config.row_header_width, y, viewport_width, height);
                    }
                }
            }
            SelectionType::Column { columns } => {
                for col in columns {
                    if (*col as usize) >= bounds.start_col && (*col as usize) <= bounds.end_col {
                        let x = viewport.get_column_x(*col as usize)
                            - viewport.get_scroll_position().x
                            + config.row_header_width;
                        let width = viewport.get_column_width(*col as usize);
                        let viewport_height = (bounds.end_row - bounds.start_row + 1) as f64 * 25.0;
                        ctx.fill_rect(x, config.column_header_height, width, viewport_height);
                        ctx.stroke_rect(x, config.column_header_height, width, viewport_height);
                    }
                }
            }
            SelectionType::Multi { .. } => {
                // Multi-selection not implemented yet
            }
        }
    }

    fn render_active_cell_border(
        &self,
        ctx: &CanvasRenderingContext2d,
        viewport: &Viewport,
        active_cell: &CellAddress,
        bounds: &ViewportBounds,
        config: &GridConfiguration,
    ) {
        if active_cell.row as usize <= bounds.end_row && active_cell.col as usize <= bounds.end_col
        {
            let pos = viewport.get_cell_position(active_cell);
            let cell_x = pos.x + config.row_header_width;
            let cell_y = pos.y + config.column_header_height;

            ctx.set_stroke_style_str(&self.theme.active_cell_border_color);
            ctx.set_line_width(2.0);
            ctx.stroke_rect(cell_x, cell_y, pos.width, pos.height);
        }
    }
}
