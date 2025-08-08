use web_sys::{HtmlCanvasElement, MouseEvent};
use crate::components::viewport::Viewport;

pub struct ResizeHandler {
    row_header_canvas: HtmlCanvasElement,
    col_header_canvas: HtmlCanvasElement,
    viewport: Viewport,
    is_resizing: bool,
    resize_type: ResizeType,
    resize_index: usize,
}

#[derive(Clone, Copy)]
enum ResizeType {
    None,
    Column,
    Row,
}

impl ResizeHandler {
    pub fn new(
        row_header_canvas: HtmlCanvasElement,
        col_header_canvas: HtmlCanvasElement,
        viewport: Viewport,
    ) -> Self {
        Self {
            row_header_canvas,
            col_header_canvas,
            viewport,
            is_resizing: false,
            resize_type: ResizeType::None,
            resize_index: 0,
        }
    }
    
    pub fn handle_mouse_down(&mut self, event: MouseEvent, is_column: bool) -> bool {
        // Check if mouse is on a resize handle
        // Return true if resize started
        false
    }
    
    pub fn handle_mouse_move(&mut self, event: MouseEvent) {
        if self.is_resizing {
            // Update column or row size
        }
    }
    
    pub fn handle_mouse_up(&mut self) {
        self.is_resizing = false;
        self.resize_type = ResizeType::None;
    }
}