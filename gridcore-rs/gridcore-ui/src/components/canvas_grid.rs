use gridcore_core::types::CellAddress;
use leptos::html::Canvas;
use leptos::*;
use wasm_bindgen::JsCast;
use web_sys::{CanvasRenderingContext2d, HtmlCanvasElement, KeyboardEvent, MouseEvent};

use crate::components::viewport::Viewport;
use crate::rendering::{default_theme, GridTheme};

#[component]
pub fn CanvasGrid() -> impl IntoView {
    // Canvas node ref
    let canvas_ref = create_node_ref::<Canvas>();
    let theme = default_theme();

    // State
    let (active_cell, set_active_cell) = create_signal(CellAddress::new(0, 0));
    let (viewport, set_viewport) = create_signal(Viewport::new(theme.clone(), Some(100), Some(26)));

    // Set up canvas rendering after mount
    create_effect(move |_| {
        if let Some(canvas) = canvas_ref.get() {
            let canvas_elem: &web_sys::HtmlCanvasElement = &canvas;
            render_grid(canvas_elem, &viewport.get(), active_cell.get());
        }
    });

    // Handle canvas click
    let on_click = move |ev: MouseEvent| {
        if let Some(canvas) = canvas_ref.get() {
            let x = ev.offset_x() as f64;
            let y = ev.offset_y() as f64;

            if let Some(cell) = viewport.get().get_cell_at_position(x, y) {
                set_active_cell.set(cell);
                leptos::logging::log!("Clicked cell: {:?}", cell);
            }
        }
    };

    // Handle keyboard events
    let on_keydown = move |ev: KeyboardEvent| {
        let current = active_cell.get();
        let new_cell = match ev.key().as_str() {
            "ArrowUp" | "k" => {
                ev.prevent_default();
                if current.row > 0 {
                    Some(CellAddress::new(current.col, current.row - 1))
                } else {
                    None
                }
            }
            "ArrowDown" | "j" => {
                ev.prevent_default();
                Some(CellAddress::new(current.col, current.row + 1))
            }
            "ArrowLeft" | "h" => {
                ev.prevent_default();
                if current.col > 0 {
                    Some(CellAddress::new(current.col - 1, current.row))
                } else {
                    None
                }
            }
            "ArrowRight" | "l" => {
                ev.prevent_default();
                Some(CellAddress::new(current.col + 1, current.row))
            }
            _ => None,
        };

        if let Some(cell) = new_cell {
            set_active_cell.set(cell);
        }
    };

    view! {
        <div
            class="canvas-grid-wrapper"
            tabindex="0"
            on:keydown=on_keydown
            style="width: 100%; height: 100%; outline: none; position: relative;"
        >
            <canvas
                node_ref=canvas_ref
                width="800"
                height="600"
                on:click=on_click
                style="border: 1px solid #e0e0e0; background: white; cursor: cell;"
            />
        </div>
    }
}

fn render_grid(canvas: &HtmlCanvasElement, viewport: &Viewport, active_cell: CellAddress) {
    // Get 2D context
    let ctx = match canvas.get_context("2d") {
        Ok(Some(ctx)) => ctx,
        _ => return,
    };

    let ctx: CanvasRenderingContext2d = match ctx.dyn_into() {
        Ok(ctx) => ctx,
        _ => return,
    };

    let theme = viewport.get_theme();

    // Clear canvas
    ctx.clear_rect(0.0, 0.0, canvas.width() as f64, canvas.height() as f64);

    // Draw background
    ctx.set_fill_style(&theme.background_color.as_str().into());
    ctx.fill_rect(0.0, 0.0, canvas.width() as f64, canvas.height() as f64);

    // Draw grid lines and cells
    let bounds = viewport.get_visible_bounds();

    // Draw vertical lines
    ctx.set_stroke_style(&theme.grid_line_color.as_str().into());
    ctx.set_line_width(1.0);

    for col in bounds.start_col..=bounds.end_col {
        let x = viewport.get_column_x(col) - viewport.get_scroll_position().x;
        ctx.begin_path();
        ctx.move_to(x, 0.0);
        ctx.line_to(x, canvas.height() as f64);
        ctx.stroke();
    }

    // Draw horizontal lines
    for row in bounds.start_row..=bounds.end_row {
        let y = viewport.get_row_y(row) - viewport.get_scroll_position().y;
        ctx.begin_path();
        ctx.move_to(0.0, y);
        ctx.line_to(canvas.width() as f64, y);
        ctx.stroke();
    }

    // Draw column headers
    ctx.set_fill_style(&theme.header_background_color.as_str().into());
    ctx.fill_rect(0.0, 0.0, canvas.width() as f64, theme.column_header_height);

    ctx.set_fill_style(&theme.header_text_color.as_str().into());
    ctx.set_font(&format!(
        "{}px {}",
        theme.header_font_size, theme.header_font_family
    ));

    for col in bounds.start_col..=bounds.end_col {
        let x = viewport.get_column_x(col) - viewport.get_scroll_position().x;
        let width = viewport.get_column_width(col);

        // Draw header background
        ctx.set_fill_style(&theme.header_background_color.as_str().into());
        ctx.fill_rect(x, 0.0, width, theme.column_header_height);

        // Draw column label
        ctx.set_fill_style(&theme.header_text_color.as_str().into());
        let label = get_column_label(col);
        let text_x = x + width / 2.0 - 8.0;
        let text_y = theme.column_header_height / 2.0 + 4.0;
        ctx.fill_text(&label, text_x, text_y).ok();
    }

    // Draw row headers
    for row in bounds.start_row..=bounds.end_row {
        let y = viewport.get_row_y(row) - viewport.get_scroll_position().y;
        let height = viewport.get_row_height(row);

        // Draw header background
        ctx.set_fill_style(&theme.header_background_color.as_str().into());
        ctx.fill_rect(0.0, y, theme.row_header_width, height);

        // Draw row number
        ctx.set_fill_style(&theme.header_text_color.as_str().into());
        let label = (row + 1).to_string();
        let text_x = theme.row_header_width / 2.0 - 8.0;
        let text_y = y + height / 2.0 + 4.0;
        ctx.fill_text(&label, text_x, text_y).ok();
    }

    // Draw corner
    ctx.set_fill_style(&theme.header_background_color.as_str().into());
    ctx.fill_rect(0.0, 0.0, theme.row_header_width, theme.column_header_height);

    // Highlight active cell
    if active_cell.row as usize <= bounds.end_row && active_cell.col as usize <= bounds.end_col {
        let pos = viewport.get_cell_position(&active_cell);

        // Add header offsets
        let cell_x = pos.x + theme.row_header_width;
        let cell_y = pos.y + theme.column_header_height;

        // Draw active cell border
        ctx.set_stroke_style(&theme.active_cell_border_color.as_str().into());
        ctx.set_line_width(2.0);
        ctx.stroke_rect(cell_x, cell_y, pos.width, pos.height);
    }
}

fn get_column_label(col: usize) -> String {
    let mut label = String::new();
    let mut n = col;
    loop {
        label.insert(0, ((n % 26) as u8 + b'A') as char);
        n /= 26;
        if n == 0 {
            break;
        }
        n -= 1;
    }
    label
}
