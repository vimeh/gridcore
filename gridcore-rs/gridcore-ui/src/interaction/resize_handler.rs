use gridcore_controller::behaviors::resize::{self, ResizeType};
use gridcore_controller::controller::SpreadsheetController;
use std::cell::RefCell;
use std::rc::Rc;
use web_sys::MouseEvent;

#[derive(Clone)]
pub struct ResizeHandler {
    controller: Rc<RefCell<SpreadsheetController>>,
    resize_threshold: f64,
}

impl ResizeHandler {
    pub fn new(controller: Rc<RefCell<SpreadsheetController>>) -> Self {
        Self {
            controller,
            resize_threshold: 5.0, // pixels from edge to trigger resize
        }
    }

    pub fn check_resize_hover(
        &self,
        x: f64,
        y: f64,
        is_header: bool,
    ) -> Option<(ResizeType, usize)> {
        let controller = self.controller.borrow();
        let viewport_manager = controller.get_viewport_manager();
        let config = controller.get_config();

        if is_header {
            // Check column header for resize
            let mut current_x = 0.0;
            let scroll_x = viewport_manager.get_scroll_position().x;

            for col in 0..config.total_cols {
                let width = viewport_manager.get_column_width(col);
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
            let scroll_y = viewport_manager.get_scroll_position().y;

            for row in 0..config.total_rows {
                let height = viewport_manager.get_row_height(row);
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
        let mut controller = self.controller.borrow_mut();
        let viewport_manager = controller.get_viewport_manager();

        let start_position = match resize_type {
            ResizeType::Column => event.client_x() as f64,
            ResizeType::Row => event.client_y() as f64,
            ResizeType::None => 0.0,
        };

        let start_size = match resize_type {
            ResizeType::Column => viewport_manager.get_column_width(index),
            ResizeType::Row => viewport_manager.get_row_height(index),
            ResizeType::None => 0.0,
        };

        // Use pure function to create resize state
        let new_state = resize::start_mouse_resize(
            resize_type,
            index,
            start_position,
            start_size,
        );
        
        // Update the controller's resize state
        *controller.get_resize_state_mut() = new_state;
    }

    pub fn handle_resize(&self, event: &MouseEvent) {
        let mut controller = self.controller.borrow_mut();
        let resize_state = controller.get_resize_state();

        if !resize_state.is_resizing {
            return;
        }

        let current_position = match resize_state.resize_type {
            ResizeType::Column => event.client_x() as f64,
            ResizeType::Row => event.client_y() as f64,
            ResizeType::None => return,
        };

        // Get config for min/max sizes
        let config = controller.get_config();
        let (min_size, max_size) = match resize_state.resize_type {
            ResizeType::Column => (config.min_cell_width, config.max_cell_width),
            ResizeType::Row => (config.default_cell_height.min(20.0), config.default_cell_height * 10.0),
            ResizeType::None => return,
        };

        // Update resize using pure function
        if let Some((resize_type, index, new_size)) = resize::update_mouse_resize(
            resize_state,
            current_position,
            min_size,
            max_size,
        ) {
            // Update the resize state
            controller.get_resize_state_mut().current_size = new_size;
            
            // Apply the resize to the viewport
            let viewport_manager = controller.get_viewport_manager_mut();
            match resize_type {
                ResizeType::Column => {
                    viewport_manager.set_column_width(index, new_size);
                }
                ResizeType::Row => {
                    viewport_manager.set_row_height(index, new_size);
                }
                ResizeType::None => {}
            }
        }
    }

    pub fn end_resize(&self) {
        let mut controller = self.controller.borrow_mut();
        let resize_state = controller.get_resize_state();
        
        // Use pure function to end resize
        resize::end_mouse_resize(resize_state);
        
        // Reset the resize state
        *controller.get_resize_state_mut() = Default::default();
    }

    pub fn is_resizing(&self) -> bool {
        self.controller.borrow().get_resize_state().is_resizing
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
