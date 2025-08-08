use crate::components::viewport::Viewport;
use leptos::*;
use std::cell::RefCell;
use std::rc::Rc;
use web_sys::MouseEvent;

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum ResizeType {
    None,
    Column,
    Row,
}

#[derive(Clone, Debug)]
pub struct ResizeState {
    pub is_resizing: bool,
    pub resize_type: ResizeType,
    pub resize_index: usize,
    pub start_position: f64,
    pub start_size: f64,
}

impl Default for ResizeState {
    fn default() -> Self {
        Self {
            is_resizing: false,
            resize_type: ResizeType::None,
            resize_index: 0,
            start_position: 0.0,
            start_size: 0.0,
        }
    }
}

#[derive(Clone)]
pub struct ResizeHandler {
    viewport: Rc<RefCell<Viewport>>,
    state: Rc<RefCell<ResizeState>>,
    resize_threshold: f64,
}

impl ResizeHandler {
    pub fn new(viewport: Rc<RefCell<Viewport>>) -> Self {
        Self {
            viewport,
            state: Rc::new(RefCell::new(ResizeState::default())),
            resize_threshold: 5.0, // pixels from edge to trigger resize
        }
    }

    pub fn get_state(&self) -> Rc<RefCell<ResizeState>> {
        self.state.clone()
    }

    pub fn check_resize_hover(
        &self,
        x: f64,
        y: f64,
        is_header: bool,
    ) -> Option<(ResizeType, usize)> {
        let viewport = self.viewport.borrow();

        if is_header {
            // Check column header for resize
            let mut current_x = 0.0;
            let scroll_x = viewport.get_scroll_position().x;

            for col in 0..viewport.get_total_cols() {
                let width = viewport.get_column_width(col);
                let edge_x = current_x + width - scroll_x;

                // Check if mouse is near column edge
                if (x - edge_x).abs() < self.resize_threshold && x > 0.0 {
                    return Some((ResizeType::Column, col));
                }

                current_x += width;
                if current_x - scroll_x > x + self.resize_threshold {
                    break;
                }
            }
        } else {
            // Check row header for resize
            let mut current_y = 0.0;
            let scroll_y = viewport.get_scroll_position().y;

            for row in 0..viewport.get_total_rows() {
                let height = viewport.get_row_height(row);
                let edge_y = current_y + height - scroll_y;

                // Check if mouse is near row edge
                if (y - edge_y).abs() < self.resize_threshold && y > 0.0 {
                    return Some((ResizeType::Row, row));
                }

                current_y += height;
                if current_y - scroll_y > y + self.resize_threshold {
                    break;
                }
            }
        }

        None
    }

    pub fn start_resize(&self, event: &MouseEvent, resize_type: ResizeType, index: usize) {
        let mut state = self.state.borrow_mut();
        let viewport = self.viewport.borrow();

        state.is_resizing = true;
        state.resize_type = resize_type;
        state.resize_index = index;

        match resize_type {
            ResizeType::Column => {
                state.start_position = event.client_x() as f64;
                state.start_size = viewport.get_column_width(index);
            }
            ResizeType::Row => {
                state.start_position = event.client_y() as f64;
                state.start_size = viewport.get_row_height(index);
            }
            ResizeType::None => {}
        }
    }

    pub fn handle_resize(&self, event: &MouseEvent) {
        let state = self.state.borrow();
        if !state.is_resizing {
            return;
        }

        let mut viewport = self.viewport.borrow_mut();

        match state.resize_type {
            ResizeType::Column => {
                let delta = event.client_x() as f64 - state.start_position;
                let new_width = (state.start_size + delta).max(30.0); // Min width 30px
                viewport.set_column_width(state.resize_index, new_width);
            }
            ResizeType::Row => {
                let delta = event.client_y() as f64 - state.start_position;
                let new_height = (state.start_size + delta).max(20.0); // Min height 20px
                viewport.set_row_height(state.resize_index, new_height);
            }
            ResizeType::None => {}
        }
    }

    pub fn end_resize(&self) {
        let mut state = self.state.borrow_mut();
        state.is_resizing = false;
        state.resize_type = ResizeType::None;
    }

    pub fn is_resizing(&self) -> bool {
        self.state.borrow().is_resizing
    }

    pub fn get_cursor_style(&self, x: f64, y: f64, is_header: bool) -> &'static str {
        if let Some((resize_type, _)) = self.check_resize_hover(x, y, is_header) {
            match resize_type {
                ResizeType::Column => "col-resize",
                ResizeType::Row => "row-resize",
                ResizeType::None => "default",
            }
        } else {
            "default"
        }
    }
}
