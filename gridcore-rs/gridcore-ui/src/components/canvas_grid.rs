use gridcore_controller::controller::SpreadsheetController;
use gridcore_controller::state::{Action, InsertMode, SpreadsheetMode};
use gridcore_core::types::CellAddress;
use leptos::html::Canvas;
use leptos::*;
use std::cell::RefCell;
use std::rc::Rc;
use wasm_bindgen::JsCast;
use web_sys::{CanvasRenderingContext2d, HtmlCanvasElement, KeyboardEvent, MouseEvent};

use crate::components::cell_editor::CellEditor;
use crate::components::viewport::Viewport;
use crate::interaction::resize_handler::ResizeHandler;
use crate::rendering::default_theme;

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
    let viewport_rc = Rc::new(RefCell::new(Viewport::new(theme.clone(), Some(100), Some(26))));
    let (viewport, set_viewport) = create_signal(viewport_rc.clone());
    let (editing_mode, set_editing_mode) = create_signal(false);
    let (cell_position, set_cell_position) = create_signal((0.0, 0.0, 100.0, 25.0));
    let (cursor_style, set_cursor_style) = create_signal("cell");
    
    // Create resize handler
    let resize_handler = ResizeHandler::new(viewport_rc.clone());
    let resize_state = resize_handler.get_state();

    // Clone controller references for closures
    let ctrl_render = controller.clone();
    let ctrl_formula = controller.clone();
    let ctrl_keyboard = controller.clone();

    // Set up canvas rendering after mount
    create_effect(move |_| {
        if let Some(canvas) = canvas_ref.get() {
            let canvas_elem: &web_sys::HtmlCanvasElement = &canvas;
            let ctrl = ctrl_render.clone();
            let vp = viewport.get();
            render_grid(
                canvas_elem,
                &*vp.borrow(),
                active_cell.get(),
                ctrl.borrow().get_facade(),
            );
        }
    });

    // Update formula bar when cell changes
    create_effect(move |_| {
        let cell = active_cell.get();
        let ctrl = ctrl_formula.clone();
        let ctrl_borrow = ctrl.borrow();
        let facade = ctrl_borrow.get_facade();

        // Get cell value for formula bar
        if let Some(cell_obj) = facade.get_cell(&cell) {
            // Check if cell has a formula
            if cell_obj.has_formula() {
                // If it has a formula, show the raw value (which contains the formula)
                set_formula_value.set(cell_obj.raw_value.to_string());
            } else {
                // Otherwise show the display value
                set_formula_value.set(cell_obj.get_display_value().to_string());
            }
        } else {
            set_formula_value.set(String::new());
        }
    });

    // Handle canvas click
    let on_click = move |ev: MouseEvent| {
        if let Some(_canvas) = canvas_ref.get() {
            let x = ev.offset_x() as f64;
            let y = ev.offset_y() as f64;

            if let Some(cell) = viewport.get().borrow().get_cell_at_position(x, y) {
                // Update active cell and move cursor in controller
                set_active_cell.set(cell);

                // For now, just update the UI state
                // TODO: Add proper selection action when available in controller
            }
        }
    };
    
    // Handle mouse move for resize cursor
    let resize_handler_move = resize_handler.clone();
    let on_mouse_move = move |ev: MouseEvent| {
        let x = ev.offset_x() as f64;
        let y = ev.offset_y() as f64;
        
        // Check if we're resizing
        if resize_handler_move.is_resizing() {
            resize_handler_move.handle_resize(&ev);
            // Trigger re-render
            set_viewport.update(|_| {});
        } else {
            // Check if we're hovering over a resize handle
            let theme = default_theme();
            let is_col_header = y < theme.column_header_height;
            let is_row_header = x < theme.row_header_width;
            
            if is_col_header || is_row_header {
                let cursor = resize_handler_move.get_cursor_style(
                    if is_col_header { x } else { 0.0 },
                    if is_row_header { y } else { 0.0 },
                    is_col_header
                );
                set_cursor_style.set(cursor);
            } else {
                set_cursor_style.set("cell");
            }
        }
    };
    
    // Handle mouse down for starting resize
    let resize_handler_down = resize_handler.clone();
    let on_mouse_down = move |ev: MouseEvent| {
        let x = ev.offset_x() as f64;
        let y = ev.offset_y() as f64;
        let theme = default_theme();
        
        let is_col_header = y < theme.column_header_height;
        let is_row_header = x < theme.row_header_width;
        
        if is_col_header || is_row_header {
            if let Some((resize_type, index)) = resize_handler_down.check_resize_hover(
                if is_col_header { x } else { 0.0 },
                if is_row_header { y } else { 0.0 },
                is_col_header
            ) {
                ev.prevent_default();
                resize_handler_down.start_resize(&ev, resize_type, index);
            }
        }
    };
    
    // Handle mouse up for ending resize
    let resize_handler_up = resize_handler.clone();
    let on_mouse_up = move |_ev: MouseEvent| {
        if resize_handler_up.is_resizing() {
            resize_handler_up.end_resize();
            // Trigger final re-render
            set_viewport.update(|_| {});
        }
    };

    // Handle keyboard events through controller
    let on_keydown = move |ev: KeyboardEvent| {
        let key = ev.key();
        let ctrl = ctrl_keyboard.clone();
        let mut ctrl_mut = ctrl.borrow_mut();
        let current_mode = ctrl_mut.get_state().spreadsheet_mode();

        // For navigation, handle movement directly since controller doesn't have Move action
        let action = match current_mode {
            SpreadsheetMode::Navigation => {
                let current_cursor = *ctrl_mut.get_state().cursor();
                match key.as_str() {
                    "h" | "ArrowLeft" => {
                        ev.prevent_default();
                        if current_cursor.col > 0 {
                            Some(Action::UpdateCursor {
                                cursor: CellAddress::new(
                                    current_cursor.col - 1,
                                    current_cursor.row,
                                ),
                            })
                        } else {
                            None
                        }
                    }
                    "j" | "ArrowDown" => {
                        ev.prevent_default();
                        Some(Action::UpdateCursor {
                            cursor: CellAddress::new(current_cursor.col, current_cursor.row + 1),
                        })
                    }
                    "k" | "ArrowUp" => {
                        ev.prevent_default();
                        if current_cursor.row > 0 {
                            Some(Action::UpdateCursor {
                                cursor: CellAddress::new(
                                    current_cursor.col,
                                    current_cursor.row - 1,
                                ),
                            })
                        } else {
                            None
                        }
                    }
                    "l" | "ArrowRight" => {
                        ev.prevent_default();
                        Some(Action::UpdateCursor {
                            cursor: CellAddress::new(current_cursor.col + 1, current_cursor.row),
                        })
                    }
                    "i" => {
                        ev.prevent_default();
                        set_editing_mode.set(true);
                        // Calculate cell position for the editor
                        let vp = viewport.get();
                        let pos = vp.borrow().get_cell_position(&current_cursor);
                        let theme = vp.borrow().get_theme().clone();
                        set_cell_position.set((
                            pos.x + theme.row_header_width,
                            pos.y + theme.column_header_height,
                            pos.width,
                            pos.height,
                        ));
                        Some(Action::StartEditing {
                            edit_mode: Some(InsertMode::I),
                            initial_value: None,
                            cursor_position: None,
                        })
                    }
                    "a" => {
                        ev.prevent_default();
                        set_editing_mode.set(true);
                        // Calculate cell position for the editor
                        let vp = viewport.get();
                        let pos = vp.borrow().get_cell_position(&current_cursor);
                        let theme = vp.borrow().get_theme().clone();
                        set_cell_position.set((
                            pos.x + theme.row_header_width,
                            pos.y + theme.column_header_height,
                            pos.width,
                            pos.height,
                        ));
                        Some(Action::StartEditing {
                            edit_mode: Some(InsertMode::A),
                            initial_value: None,
                            cursor_position: None,
                        })
                    }
                    "o" => {
                        ev.prevent_default();
                        // Move to next row and start editing
                        let new_cursor =
                            CellAddress::new(current_cursor.col, current_cursor.row + 1);
                        set_active_cell.set(new_cursor);
                        set_editing_mode.set(true);
                        // Calculate cell position for the editor
                        let vp = viewport.get();
                        let pos = vp.borrow().get_cell_position(&new_cursor);
                        let theme = vp.borrow().get_theme().clone();
                        set_cell_position.set((
                            pos.x + theme.row_header_width,
                            pos.y + theme.column_header_height,
                            pos.width,
                            pos.height,
                        ));
                        Some(Action::UpdateCursor { cursor: new_cursor })
                    }
                    "O" => {
                        ev.prevent_default();
                        // Move to previous row and start editing
                        if current_cursor.row > 0 {
                            let new_cursor =
                                CellAddress::new(current_cursor.col, current_cursor.row - 1);
                            set_active_cell.set(new_cursor);
                            set_editing_mode.set(true);
                            // Calculate cell position for the editor
                            let vp = viewport.get();
                            let pos = vp.borrow().get_cell_position(&new_cursor);
                            let theme = vp.borrow().get_theme().clone();
                            set_cell_position.set((
                                pos.x + theme.row_header_width,
                                pos.y + theme.column_header_height,
                                pos.width,
                                pos.height,
                            ));
                            Some(Action::UpdateCursor { cursor: new_cursor })
                        } else {
                            None
                        }
                    }
                    "v" => {
                        ev.prevent_default();
                        use gridcore_controller::state::{
                            Selection, SelectionType, SpreadsheetVisualMode,
                        };
                        Some(Action::EnterSpreadsheetVisualMode {
                            visual_mode: SpreadsheetVisualMode::Char,
                            selection: Selection {
                                selection_type: SelectionType::Cell {
                                    address: current_cursor,
                                },
                                anchor: Some(current_cursor),
                            },
                        })
                    }
                    _ => None,
                }
            }
            SpreadsheetMode::Editing | SpreadsheetMode::Insert => {
                // Editing is handled by CellEditor component
                None
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
                on:mousedown=on_mouse_down
                on:mousemove=on_mouse_move
                on:mouseup=on_mouse_up
                style=move || format!("border: 1px solid #e0e0e0; background: white; cursor: {};", cursor_style.get())
            />
            <CellEditor
                active_cell=active_cell
                editing_mode=editing_mode
                set_editing_mode=set_editing_mode
                cell_position=cell_position
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
                let value_str = cell.get_display_value().to_string();

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
