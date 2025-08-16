use gridcore_controller::controller::{GridConfiguration, ViewportBounds};
use gridcore_controller::state::{Selection, SelectionType};
use gridcore_core::types::{CellAddress, CellValue};
use gridcore_core::SpreadsheetFacade;
use wasm_bindgen::JsCast;
use web_sys::{CanvasRenderingContext2d, HtmlCanvasElement};

use crate::components::viewport::Viewport;
use crate::rendering::GridTheme;

pub struct CanvasRenderer {
    theme: GridTheme,
}

impl CanvasRenderer {
    pub fn new(theme: GridTheme) -> Self {
        Self { theme }
    }

    pub fn render(
        &self,
        canvas: &HtmlCanvasElement,
        viewport: &Viewport,
        active_cell: CellAddress,
        selection: Option<Selection>,
        facade: &SpreadsheetFacade,
        device_pixel_ratio: f64,
        config: &GridConfiguration,
    ) {
        let ctx = match self.get_context(canvas) {
            Some(ctx) => ctx,
            None => return,
        };

        ctx.save();
        ctx.scale(device_pixel_ratio, device_pixel_ratio).ok();

        let logical_width = (canvas.width() as f64) / device_pixel_ratio;
        let logical_height = (canvas.height() as f64) / device_pixel_ratio;

        self.clear_canvas(&ctx, logical_width, logical_height);

        let bounds = viewport.get_visible_bounds();

        self.render_background(&ctx, logical_width, logical_height);
        self.render_grid_lines(
            &ctx,
            viewport,
            &bounds,
            config,
            logical_width,
            logical_height,
        );
        self.render_headers(
            &ctx,
            viewport,
            &bounds,
            config,
            logical_width,
            logical_height,
        );
        self.render_cells(&ctx, viewport, &bounds, facade, config);

        if let Some(sel) = selection {
            self.render_selection(&ctx, &sel, viewport, config, &bounds);
        }

        self.render_active_cell(&ctx, viewport, active_cell, &bounds, config);

        ctx.restore();
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
        viewport: &Viewport,
        bounds: &ViewportBounds,
        config: &GridConfiguration,
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

    fn render_headers(
        &self,
        ctx: &CanvasRenderingContext2d,
        viewport: &Viewport,
        bounds: &ViewportBounds,
        config: &GridConfiguration,
        logical_width: f64,
        _logical_height: f64,
    ) {
        // Column headers background
        ctx.set_fill_style_str(&self.theme.header_background_color);
        ctx.fill_rect(0.0, 0.0, logical_width, config.column_header_height);

        ctx.set_fill_style_str(&self.theme.header_text_color);
        ctx.set_font(&format!(
            "{}px {}",
            self.theme.header_font_size, self.theme.header_font_family
        ));

        // Render column headers
        for col in bounds.start_col..=bounds.end_col {
            let x = viewport.get_column_x(col) - viewport.get_scroll_position().x
                + config.row_header_width;
            let width = viewport.get_column_width(col);

            ctx.set_fill_style_str(&self.theme.header_background_color);
            ctx.fill_rect(x, 0.0, width, config.column_header_height);

            ctx.set_fill_style_str(&self.theme.header_text_color);
            let label = CellAddress::column_number_to_label(col as u32);
            let text_x = x + width / 2.0 - 8.0;
            let text_y = config.column_header_height / 2.0 + 4.0;
            ctx.fill_text(&label, text_x, text_y).ok();
        }

        // Render row headers
        for row in bounds.start_row..=bounds.end_row {
            let y = viewport.get_row_y(row) - viewport.get_scroll_position().y
                + config.column_header_height;
            let height = viewport.get_row_height(row);

            ctx.set_fill_style_str(&self.theme.header_background_color);
            ctx.fill_rect(0.0, y, config.row_header_width, height);

            ctx.set_fill_style_str(&self.theme.header_text_color);
            let label = (row + 1).to_string();
            let text_x = config.row_header_width / 2.0 - 8.0;
            let text_y = y + height / 2.0 + 4.0;
            ctx.fill_text(&label, text_x, text_y).ok();
        }

        // Corner
        ctx.set_fill_style_str(&self.theme.header_background_color);
        ctx.fill_rect(
            0.0,
            0.0,
            config.row_header_width,
            config.column_header_height,
        );
    }

    fn render_cells(
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

                    // Set color based on value type
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

    fn render_selection(
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
                    }
                }
            }
            SelectionType::Multi { .. } => {
                // Multi-selection not implemented yet
            }
        }
    }

    fn render_active_cell(
        &self,
        ctx: &CanvasRenderingContext2d,
        viewport: &Viewport,
        active_cell: CellAddress,
        bounds: &ViewportBounds,
        config: &GridConfiguration,
    ) {
        if active_cell.row as usize <= bounds.end_row && active_cell.col as usize <= bounds.end_col
        {
            let pos = viewport.get_cell_position(&active_cell);
            let cell_x = pos.x + config.row_header_width;
            let cell_y = pos.y + config.column_header_height;

            ctx.set_stroke_style_str(&self.theme.active_cell_border_color);
            ctx.set_line_width(2.0);
            ctx.stroke_rect(cell_x, cell_y, pos.width, pos.height);
        }
    }
}
