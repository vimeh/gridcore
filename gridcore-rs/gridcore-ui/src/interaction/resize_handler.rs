use gridcore_controller::controller::SpreadsheetController;
use gridcore_controller::managers::resize::ResizeType;
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

        controller.get_resize_manager_mut().start_resize(
            resize_type,
            index,
            start_position,
            start_size,
        );
    }

    pub fn handle_resize(&self, event: &MouseEvent) {
        let mut controller = self.controller.borrow_mut();
        let resize_manager = controller.get_resize_manager_mut();
        
        if !resize_manager.is_resizing() {
            return;
        }

        let current_position = match resize_manager.get_resize_type() {
            ResizeType::Column => event.client_x() as f64,
            ResizeType::Row => event.client_y() as f64,
            ResizeType::None => return,
        };

        resize_manager.update_resize(current_position);
        
        // Apply the resize to the viewport
        let viewport_manager = controller.get_viewport_manager_mut();
        match resize_manager.get_resize_type() {
            ResizeType::Column => {
                let index = resize_manager.get_resize_index();
                let new_size = resize_manager.get_current_size();
                viewport_manager.set_column_width(index, new_size);
            }
            ResizeType::Row => {
                let index = resize_manager.get_resize_index();
                let new_size = resize_manager.get_current_size();
                viewport_manager.set_row_height(index, new_size);
            }
            ResizeType::None => {}
        }
    }

    pub fn end_resize(&self) {
        let mut controller = self.controller.borrow_mut();
        controller.get_resize_manager_mut().end_resize();
    }

    pub fn is_resizing(&self) -> bool {
        self.controller.borrow().get_resize_manager().is_resizing()
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
