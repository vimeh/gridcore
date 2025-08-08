use leptos::*;
use leptos::html::Canvas;
use web_sys::{HtmlCanvasElement, CanvasRenderingContext2d, MouseEvent, KeyboardEvent};
use wasm_bindgen::JsCast;
use gridcore_core::facade::SpreadsheetFacade;
use gridcore_core::types::CellAddress;
use gridcore_controller::controller::SpreadsheetController;
use gridcore_controller::managers::selection::SelectionManager;

use crate::components::viewport::Viewport;
use crate::components::cell_editor::CellEditor;
use crate::rendering::{CanvasRenderer, HeaderRenderer, SelectionRenderer, GridTheme, default_theme};
use crate::interaction::{MouseHandler, KeyboardHandler, ResizeHandler};

#[component]
pub fn CanvasGrid(
    facade: SpreadsheetFacade,
    controller: SpreadsheetController,
    #[prop(optional)] on_cell_change: Option<Box<dyn Fn(String, String)>>,
) -> impl IntoView {
    // Canvas node refs
    let main_canvas_ref = create_node_ref::<Canvas>();
    let row_header_canvas_ref = create_node_ref::<Canvas>();
    let col_header_canvas_ref = create_node_ref::<Canvas>();
    let corner_canvas_ref = create_node_ref::<Canvas>();
    
    // Reactive state
    let (viewport, set_viewport) = create_signal(Viewport::new(default_theme(), None, None));
    let (selection_manager, set_selection_manager) = create_signal(SelectionManager::new());
    let (is_editing, set_is_editing) = create_signal(false);
    let (active_cell, set_active_cell) = create_signal(CellAddress::new(0, 0));
    
    // Theme configuration
    let theme = default_theme();
    
    // Set up canvas rendering on mount
    create_effect(move |_| {
        if let Some(canvas) = main_canvas_ref.get() {
            let canvas_element: HtmlCanvasElement = canvas.clone().into();
            render_grid(&canvas_element, &facade, viewport.get(), active_cell.get(), is_editing.get());
        }
        
        if let (Some(row_canvas), Some(col_canvas), Some(corner_canvas)) = 
            (row_header_canvas_ref.get(), col_header_canvas_ref.get(), corner_canvas_ref.get()) {
            render_headers(
                &row_canvas.clone().into(),
                &col_canvas.clone().into(),
                &corner_canvas.clone().into(),
                viewport.get(),
                &theme,
            );
        }
    });
    
    // Handle window resize
    window_event_listener(ev::resize, move |_| {
        resize_canvases(
            main_canvas_ref.get().as_ref(),
            row_header_canvas_ref.get().as_ref(),
            col_header_canvas_ref.get().as_ref(),
            corner_canvas_ref.get().as_ref(),
            &theme,
        );
    });
    
    // Mouse event handlers
    let on_canvas_click = move |ev: MouseEvent| {
        if let Some(canvas) = main_canvas_ref.get() {
            let canvas_element: HtmlCanvasElement = canvas.clone().into();
            if let Some(cell) = get_cell_at_position(&canvas_element, ev.offset_x() as f64, ev.offset_y() as f64, viewport.get()) {
                set_active_cell(cell);
                controller.move_cursor_to(cell);
                
                if let Some(on_change) = &on_cell_change {
                    on_change(cell.to_string(), String::new());
                }
            }
        }
    };
    
    let on_canvas_double_click = move |ev: MouseEvent| {
        if let Some(canvas) = main_canvas_ref.get() {
            let canvas_element: HtmlCanvasElement = canvas.clone().into();
            if let Some(cell) = get_cell_at_position(&canvas_element, ev.offset_x() as f64, ev.offset_y() as f64, viewport.get()) {
                set_is_editing(true);
                controller.start_editing();
            }
        }
    };
    
    // Keyboard event handler
    let on_key_down = move |ev: KeyboardEvent| {
        let key = ev.key();
        
        if !is_editing.get() {
            match key.as_str() {
                "ArrowUp" | "k" => {
                    ev.prevent_default();
                    controller.move_cursor_up();
                }
                "ArrowDown" | "j" => {
                    ev.prevent_default();
                    controller.move_cursor_down();
                }
                "ArrowLeft" | "h" => {
                    ev.prevent_default();
                    controller.move_cursor_left();
                }
                "ArrowRight" | "l" => {
                    ev.prevent_default();
                    controller.move_cursor_right();
                }
                "Enter" => {
                    ev.prevent_default();
                    set_is_editing(true);
                    controller.start_editing();
                }
                "Delete" | "Backspace" => {
                    ev.prevent_default();
                    controller.clear_cell(active_cell.get());
                }
                _ => {}
            }
        } else if key == "Escape" {
            ev.prevent_default();
            set_is_editing(false);
            controller.cancel_editing();
        }
    };
    
    view! {
        <div 
            class="canvas-grid-container"
            tabindex="0"
            on:keydown=on_key_down
        >
            // Corner canvas
            <canvas
                node_ref=corner_canvas_ref
                class="grid-corner-canvas"
                style="position: absolute; top: 0; left: 0; z-index: 3;"
            />
            
            // Column header canvas
            <canvas
                node_ref=col_header_canvas_ref
                class="grid-col-header-canvas"
                style="position: absolute; top: 0; z-index: 2;"
            />
            
            // Row header canvas
            <canvas
                node_ref=row_header_canvas_ref
                class="grid-row-header-canvas"
                style="position: absolute; left: 0; z-index: 2;"
            />
            
            // Main grid canvas with scroll container
            <div class="grid-scroll-container" style="position: absolute; overflow: auto;">
                <canvas
                    node_ref=main_canvas_ref
                    class="grid-canvas"
                    on:click=on_canvas_click
                    on:dblclick=on_canvas_double_click
                    style="position: sticky; top: 0; left: 0;"
                />
                
                // Spacer for scrolling
                <div class="grid-spacer" style="position: absolute; pointer-events: none;"/>
            </div>
            
            // Cell editor overlay
            <Show when=move || is_editing.get()>
                <CellEditor
                    cell=active_cell
                    facade=facade.clone()
                    on_commit=move |value| {
                        facade.set_cell_value(active_cell.get(), value.clone());
                        set_is_editing(false);
                        controller.commit_editing(value);
                    }
                    on_cancel=move || {
                        set_is_editing(false);
                        controller.cancel_editing();
                    }
                />
            </Show>
        </div>
    }
}

// Helper functions

fn render_grid(
    canvas: &HtmlCanvasElement,
    facade: &SpreadsheetFacade,
    viewport: Viewport,
    active_cell: CellAddress,
    is_editing: bool,
) {
    if let Ok(ctx) = canvas.get_context("2d") {
        if let Some(ctx) = ctx {
            let ctx: CanvasRenderingContext2d = ctx.dyn_into().unwrap();
            
            // Clear canvas
            ctx.clear_rect(0.0, 0.0, canvas.width() as f64, canvas.height() as f64);
            
            // Render visible cells
            let bounds = viewport.get_visible_bounds();
            for row in bounds.start_row..=bounds.end_row {
                for col in bounds.start_col..=bounds.end_col {
                    let address = CellAddress::new(row, col);
                    let position = viewport.get_cell_position(&address);
                    
                    // Draw cell border
                    ctx.set_stroke_style(&"#e0e0e0".into());
                    ctx.stroke_rect(position.x, position.y, position.width, position.height);
                    
                    // Draw cell content if not editing this cell
                    if !(is_editing && address == active_cell) {
                        if let Some(cell) = facade.get_cell(&address) {
                            if let Some(value) = cell.get_computed_value() {
                                ctx.set_fill_style(&"#333".into());
                                ctx.set_font("13px sans-serif");
                                ctx.fill_text(&value.to_string(), position.x + 4.0, position.y + 16.0).ok();
                            }
                        }
                    }
                    
                    // Highlight active cell
                    if address == active_cell {
                        ctx.set_stroke_style(&"#0066cc".into());
                        ctx.set_line_width(2.0);
                        ctx.stroke_rect(position.x, position.y, position.width, position.height);
                        ctx.set_line_width(1.0);
                    }
                }
            }
        }
    }
}

fn render_headers(
    row_canvas: &HtmlCanvasElement,
    col_canvas: &HtmlCanvasElement,
    corner_canvas: &HtmlCanvasElement,
    viewport: Viewport,
    theme: &GridTheme,
) {
    // Render column headers
    if let Ok(ctx) = col_canvas.get_context("2d") {
        if let Some(ctx) = ctx {
            let ctx: CanvasRenderingContext2d = ctx.dyn_into().unwrap();
            ctx.clear_rect(0.0, 0.0, col_canvas.width() as f64, col_canvas.height() as f64);
            
            let bounds = viewport.get_visible_bounds();
            for col in bounds.start_col..=bounds.end_col {
                let x = viewport.get_column_x(col) - viewport.get_scroll_position().x;
                let width = viewport.get_column_width(col);
                
                // Draw header background
                ctx.set_fill_style(&theme.header_background_color.into());
                ctx.fill_rect(x, 0.0, width, theme.column_header_height);
                
                // Draw header border
                ctx.set_stroke_style(&theme.grid_line_color.into());
                ctx.stroke_rect(x, 0.0, width, theme.column_header_height);
                
                // Draw column label (A, B, C, etc.)
                ctx.set_fill_style(&theme.header_text_color.into());
                ctx.set_font(&format!("{}px {}", theme.header_font_size, theme.header_font_family));
                let label = get_column_label(col);
                ctx.fill_text(&label, x + width / 2.0 - 5.0, theme.column_header_height / 2.0 + 4.0).ok();
            }
        }
    }
    
    // Render row headers
    if let Ok(ctx) = row_canvas.get_context("2d") {
        if let Some(ctx) = ctx {
            let ctx: CanvasRenderingContext2d = ctx.dyn_into().unwrap();
            ctx.clear_rect(0.0, 0.0, row_canvas.width() as f64, row_canvas.height() as f64);
            
            let bounds = viewport.get_visible_bounds();
            for row in bounds.start_row..=bounds.end_row {
                let y = viewport.get_row_y(row) - viewport.get_scroll_position().y;
                let height = viewport.get_row_height(row);
                
                // Draw header background
                ctx.set_fill_style(&theme.header_background_color.into());
                ctx.fill_rect(0.0, y, theme.row_header_width, height);
                
                // Draw header border
                ctx.set_stroke_style(&theme.grid_line_color.into());
                ctx.stroke_rect(0.0, y, theme.row_header_width, height);
                
                // Draw row number
                ctx.set_fill_style(&theme.header_text_color.into());
                ctx.set_font(&format!("{}px {}", theme.header_font_size, theme.header_font_family));
                let label = (row + 1).to_string();
                ctx.fill_text(&label, theme.row_header_width / 2.0 - 8.0, y + height / 2.0 + 4.0).ok();
            }
        }
    }
    
    // Render corner
    if let Ok(ctx) = corner_canvas.get_context("2d") {
        if let Some(ctx) = ctx {
            let ctx: CanvasRenderingContext2d = ctx.dyn_into().unwrap();
            ctx.set_fill_style(&theme.header_background_color.into());
            ctx.fill_rect(0.0, 0.0, theme.row_header_width, theme.column_header_height);
            ctx.set_stroke_style(&theme.grid_line_color.into());
            ctx.stroke_rect(0.0, 0.0, theme.row_header_width, theme.column_header_height);
        }
    }
}

fn get_cell_at_position(
    canvas: &HtmlCanvasElement,
    x: f64,
    y: f64,
    viewport: Viewport,
) -> Option<CellAddress> {
    viewport.get_cell_at_position(x, y)
}

fn resize_canvases(
    main_canvas: Option<&Canvas>,
    row_header: Option<&Canvas>,
    col_header: Option<&Canvas>,
    corner: Option<&Canvas>,
    theme: &GridTheme,
) {
    // Implementation for resizing canvases based on container size
    // This would measure the container and update canvas dimensions
}

fn get_column_label(col: usize) -> String {
    // Convert column index to letter (0 -> A, 1 -> B, etc.)
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