use web_sys::{HtmlCanvasElement, MouseEvent};
use gridcore_core::types::CellAddress;
use crate::components::viewport::Viewport;

pub struct MouseHandler {
    _canvas: HtmlCanvasElement,
    viewport: Viewport,
}

impl MouseHandler {
    pub fn new(canvas: HtmlCanvasElement, viewport: Viewport) -> Self {
        Self { _canvas: canvas, viewport }
    }
    
    pub fn handle_click(&mut self, event: MouseEvent) -> Option<CellAddress> {
        let x = event.offset_x() as f64;
        let y = event.offset_y() as f64;
        self.viewport.get_cell_at_position(x, y)
    }
    
    pub fn handle_double_click(&mut self, event: MouseEvent) -> Option<CellAddress> {
        self.handle_click(event)
    }
    
    pub fn handle_drag(&mut self, start: MouseEvent, end: MouseEvent) -> Option<(CellAddress, CellAddress)> {
        let start_cell = self.handle_click(start)?;
        let end_cell = self.handle_click(end)?;
        Some((start_cell, end_cell))
    }
}