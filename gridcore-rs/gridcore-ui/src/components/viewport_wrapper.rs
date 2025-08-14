use crate::rendering::GridTheme;
use gridcore_controller::controller::{GridConfiguration, ViewportManager};
use gridcore_core::types::CellAddress;
use std::cell::RefCell;
use std::rc::Rc;

/// A thin wrapper around the controller's ViewportManager for UI use
pub struct ViewportWrapper {
    viewport_manager: Rc<RefCell<ViewportManager>>,
    theme: GridTheme,
}

impl ViewportWrapper {
    pub fn new(viewport_manager: Rc<RefCell<ViewportManager>>, theme: GridTheme) -> Self {
        Self {
            viewport_manager,
            theme,
        }
    }

    pub fn get_theme(&self) -> &GridTheme {
        &self.theme
    }

    pub fn get_config(&self) -> GridConfiguration {
        // For now, return a default config
        // In the future, this should come from the controller
        GridConfiguration::default()
    }

    // Delegate all viewport operations to the controller
    pub fn get_visible_bounds(&self) -> gridcore_controller::controller::ViewportBounds {
        self.viewport_manager.borrow().get_visible_bounds()
    }

    pub fn get_cell_position(
        &self,
        address: &CellAddress,
    ) -> gridcore_controller::controller::CellPosition {
        self.viewport_manager.borrow().get_cell_position(address)
    }

    pub fn get_cell_at_position(&self, x: f64, y: f64) -> Option<CellAddress> {
        self.viewport_manager.borrow().get_cell_at_position(x, y)
    }

    pub fn scroll_by(&mut self, delta_x: f64, delta_y: f64) {
        self.viewport_manager
            .borrow_mut()
            .scroll_by(delta_x, delta_y);
    }

    pub fn get_scroll_position(&self) -> gridcore_controller::controller::ScrollPosition {
        self.viewport_manager.borrow().get_scroll_position()
    }

    pub fn set_viewport_size(&mut self, width: f64, height: f64) {
        self.viewport_manager
            .borrow_mut()
            .set_viewport_size(width, height);
    }

    pub fn get_column_width(&self, col: usize) -> f64 {
        self.viewport_manager.borrow().get_column_width(col)
    }

    pub fn set_column_width(&mut self, col: usize, width: f64) {
        self.viewport_manager
            .borrow_mut()
            .set_column_width(col, width);
    }

    pub fn get_row_height(&self, row: usize) -> f64 {
        self.viewport_manager.borrow().get_row_height(row)
    }

    pub fn set_row_height(&mut self, row: usize, height: f64) {
        self.viewport_manager
            .borrow_mut()
            .set_row_height(row, height);
    }

    pub fn get_column_x(&self, col: usize) -> f64 {
        self.viewport_manager.borrow().get_column_x(col)
    }

    pub fn get_row_y(&self, row: usize) -> f64 {
        self.viewport_manager.borrow().get_row_y(row)
    }

    pub fn get_viewport_width(&self) -> f64 {
        self.viewport_manager.borrow().get_viewport_width()
    }

    pub fn get_viewport_height(&self) -> f64 {
        self.viewport_manager.borrow().get_viewport_height()
    }

    pub fn get_total_rows(&self) -> usize {
        let (rows, _) = self.viewport_manager.borrow().get_dimensions();
        rows as usize
    }

    pub fn get_total_cols(&self) -> usize {
        let (_, cols) = self.viewport_manager.borrow().get_dimensions();
        cols as usize
    }
}
