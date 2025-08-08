use gridcore_controller::controller::SpreadsheetController;
use gridcore_controller::state::{Action, Direction, SpreadsheetMode};
use gridcore_core::types::CellAddress;
use leptos::html::Canvas;
use leptos::*;
use std::cell::RefCell;
use std::rc::Rc;
use wasm_bindgen::JsCast;
use web_sys::{CanvasRenderingContext2d, HtmlCanvasElement, KeyboardEvent, MouseEvent};

use crate::components::viewport::Viewport;
use crate::rendering::{default_theme, GridTheme};

#[component]
pub fn CanvasGrid(
    active_cell: ReadSignal<CellAddress>,
    set_active_cell: WriteSignal<CellAddress>,
    set_formula_value: WriteSignal<String>,
    set_current_mode: WriteSignal<SpreadsheetMode>,
) -> impl IntoView {
    // Get controller from context
    let controller: Rc<RefCell<SpreadsheetController>> =
        use_context().expect("SpreadsheetController not found in context");

    // Canvas node ref
    let canvas_ref = create_node_ref::<Canvas>();
    let theme = default_theme();

    // State
    let (viewport, set_viewport) = create_signal(Viewport::new(theme.clone(), Some(100), Some(26)));

    // Set up canvas rendering after mount
    create_effect(move |_| {
        if let Some(canvas) = canvas_ref.get() {
            let canvas_elem: &web_sys::HtmlCanvasElement = &canvas;
            let ctrl = controller.clone();
            render_grid(
                canvas_elem,
                &viewport.get(),
                active_cell.get(),
                ctrl.borrow().get_facade(),
            );
        }
    });

    // Update formula bar when cell changes
    create_effect(move |_| {
        let cell = active_cell.get();
        let ctrl = controller.clone();
        let facade = ctrl.borrow().get_facade();

        // Get cell value for formula bar
        if let Some(cell_obj) = facade.get_cell(&cell) {
            if let Some(formula) = cell_obj.get_formula() {
                set_formula_value.set(formula.to_string());
            } else {
                set_formula_value.set(cell_obj.get_value().to_string());
            }
        } else {
            set_formula_value.set(String::new());
        }
    });

    // Handle canvas click
    let on_click = move |ev: MouseEvent| {
        if let Some(canvas) = canvas_ref.get() {
            let x = ev.offset_x() as f64;
            let y = ev.offset_y() as f64;

            if let Some(cell) = viewport.get().get_cell_at_position(x, y) {
                // Update active cell and move cursor in controller
                set_active_cell.set(cell);

                let ctrl = controller.clone();
                let mut ctrl_mut = ctrl.borrow_mut();
                // Dispatch a select action to update controller state
                if let Err(e) = ctrl_mut.dispatch_action(Action::Select(cell)) {
                    leptos::logging::log!("Error selecting cell: {:?}", e);
                }
            }
        }
    };

    // Handle keyboard events through controller
    let on_keydown = move |ev: KeyboardEvent| {
        let key = ev.key();
        let ctrl = controller.clone();
        let mut ctrl_mut = ctrl.borrow_mut();
        let current_mode = ctrl_mut.get_state().spreadsheet_mode();

        // Map key to action based on mode
        let action = match current_mode {
            SpreadsheetMode::Navigation => match key.as_str() {
                "h" | "ArrowLeft" => {
                    ev.prevent_default();
                    Some(Action::Move(Direction::Left))
                }
                "j" | "ArrowDown" => {
                    ev.prevent_default();
                    Some(Action::Move(Direction::Down))
                }
                "k" | "ArrowUp" => {
                    ev.prevent_default();
                    Some(Action::Move(Direction::Up))
                }
                "l" | "ArrowRight" => {
                    ev.prevent_default();
                    Some(Action::Move(Direction::Right))
                }
                "i" => {
                    ev.prevent_default();
                    Some(Action::EnterEditingMode)
                }
                "v" => {
                    ev.prevent_default();
                    Some(Action::EnterVisualMode)
                }
                _ => None,
            },
            SpreadsheetMode::Editing | SpreadsheetMode::Insert => {
                if key == "Escape" {
                    ev.prevent_default();
                    Some(Action::EnterNavigationMode)
                } else {
                    None
                }
            }
            _ => None,
        };

        // Dispatch action if we have one
        if let Some(action) = action {
            if let Err(e) = ctrl_mut.dispatch_action(action) {
                leptos::logging::log!("Error dispatching action: {:?}", e);
            }

            // Update UI state
            let new_mode = ctrl_mut.get_state().spreadsheet_mode();
            set_current_mode.set(new_mode);

            // Update active cell from controller state cursor
            let cursor = *ctrl_mut.get_state().cursor();
            set_active_cell.set(cursor);
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

fn render_grid(
    canvas: &HtmlCanvasElement,
    viewport: &Viewport,
    active_cell: CellAddress,
    facade: &gridcore_core::SpreadsheetFacade,
) {
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

    // Draw cell values
    ctx.set_fill_style(&theme.cell_text_color.as_str().into());
    ctx.set_font(&format!(
        "{}px {}",
        theme.cell_font_size, theme.cell_font_family
    ));

    for row in bounds.start_row..=bounds.end_row {
        for col in bounds.start_col..=bounds.end_col {
            let cell_address = CellAddress::new(col as u32, row as u32);

            // Get cell value from facade
            if let Some(cell) = facade.get_cell(&cell_address) {
                let value_str = cell.get_value().to_string();

                let x = viewport.get_column_x(col) - viewport.get_scroll_position().x
                    + theme.row_header_width;
                let y = viewport.get_row_y(row) - viewport.get_scroll_position().y
                    + theme.column_header_height;
                let height = viewport.get_row_height(row);

                // Draw cell text
                let text_x = x + theme.cell_padding_left;
                let text_y = y + height / 2.0 + 4.0; // Vertical center alignment
                ctx.fill_text(&value_str, text_x, text_y).ok();
            }
        }
    }

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
