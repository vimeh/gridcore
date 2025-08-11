use crate::rendering::GridTheme;
use gridcore_controller::controller::{
    CellPosition, ScrollPosition, SpreadsheetController, ViewportBounds,
};
use gridcore_core::types::CellAddress;
use std::cell::RefCell;
use std::rc::Rc;

/// Thin wrapper around controller's ViewportManager for UI rendering
#[derive(Clone)]
pub struct Viewport {
    theme: GridTheme,
    controller: Rc<RefCell<SpreadsheetController>>,
}

impl Viewport {
    pub fn new(theme: GridTheme, controller: Rc<RefCell<SpreadsheetController>>) -> Self {
        Self { theme, controller }
    }

    pub fn get_total_rows(&self) -> usize {
        self.controller.borrow().get_config().total_rows
    }

    pub fn get_total_cols(&self) -> usize {
        self.controller.borrow().get_config().total_cols
    }

    pub fn get_theme(&self) -> &GridTheme {
        &self.theme
    }

    pub fn set_viewport_size(&mut self, width: f64, height: f64) {
        self.controller
            .borrow_mut()
            .get_viewport_manager_mut()
            .set_viewport_size(width, height);
    }

    pub fn set_scroll_position(&mut self, x: f64, y: f64) {
        self.controller
            .borrow_mut()
            .get_viewport_manager_mut()
            .set_scroll_position(x, y);
    }

    pub fn get_scroll_position(&self) -> ScrollPosition {
        self.controller
            .borrow()
            .get_viewport_manager()
            .get_scroll_position()
    }

    pub fn get_viewport_width(&self) -> f64 {
        self.controller
            .borrow()
            .get_viewport_manager()
            .get_viewport_width()
    }

    pub fn get_viewport_height(&self) -> f64 {
        self.controller
            .borrow()
            .get_viewport_manager()
            .get_viewport_height()
    }

    pub fn scroll_by(&mut self, delta_x: f64, delta_y: f64) {
        self.controller
            .borrow_mut()
            .get_viewport_manager_mut()
            .scroll_by(delta_x, delta_y);
    }

    pub fn scroll_to_cell(&mut self, cell: &CellAddress, position: &str) {
        self.controller
            .borrow_mut()
            .get_viewport_manager_mut()
            .scroll_to_cell(cell, position);
    }

    pub fn get_column_width(&self, col: usize) -> f64 {
        self.controller
            .borrow()
            .get_viewport_manager()
            .get_column_width(col)
    }

    pub fn set_column_width(&mut self, col: usize, width: f64) {
        self.controller
            .borrow_mut()
            .get_viewport_manager_mut()
            .set_column_width(col, width);
    }

    pub fn get_row_height(&self, row: usize) -> f64 {
        self.controller
            .borrow()
            .get_viewport_manager()
            .get_row_height(row)
    }

    pub fn set_row_height(&mut self, row: usize, height: f64) {
        self.controller
            .borrow_mut()
            .get_viewport_manager_mut()
            .set_row_height(row, height);
    }

    pub fn get_visible_bounds(&self) -> ViewportBounds {
        self.controller
            .borrow()
            .get_viewport_manager()
            .get_visible_bounds()
    }

    pub fn get_cell_position(&self, address: &CellAddress) -> CellPosition {
        self.controller
            .borrow()
            .get_viewport_manager()
            .get_cell_position(address)
    }

    pub fn get_cell_at_position(&self, x: f64, y: f64) -> Option<CellAddress> {
        self.controller
            .borrow()
            .get_viewport_manager()
            .get_cell_at_position(x, y)
    }

    pub fn get_column_x(&self, col: usize) -> f64 {
        self.controller
            .borrow()
            .get_viewport_manager()
            .get_column_x(col)
    }

    pub fn get_row_y(&self, row: usize) -> f64 {
        self.controller
            .borrow()
            .get_viewport_manager()
            .get_row_y(row)
    }

    pub fn get_total_grid_width(&self) -> f64 {
        let mut width = 0.0;
        let total_cols = self.get_total_cols();
        for col in 0..total_cols {
            width += self.get_column_width(col);
        }
        width
    }

    pub fn get_total_grid_height(&self) -> f64 {
        let mut height = 0.0;
        let total_rows = self.get_total_rows();
        for row in 0..total_rows {
            height += self.get_row_height(row);
        }
        height
    }
}
