use gridcore_controller::behaviors::resize::{self, ResizeType};
use gridcore_controller::controller::SpreadsheetController;
use web_sys::MouseEvent;

#[derive(Clone)]
pub struct ResizeHandler {
    resize_threshold: f64,
}

impl Default for ResizeHandler {
    fn default() -> Self {
        Self::new()
    }
}

impl ResizeHandler {
    pub fn new() -> Self {
        Self {
            resize_threshold: 5.0, // pixels from edge to trigger resize
        }
    }

    pub fn check_resize_hover(
        &self,
        x: f64,
        y: f64,
        is_header: bool,
        controller: &SpreadsheetController,
    ) -> Option<(ResizeType, usize)> {
        let viewport_manager = controller.get_viewport_manager();
        let visible_bounds = viewport_manager.get_visible_bounds();

        if is_header {
            // Check column header for resize - only check visible columns
            let mut current_x = 0.0;
            let scroll_x = viewport_manager.get_scroll_position().x;
            
            // Start from first visible column
            for col in 0..visible_bounds.start_col {
                current_x += viewport_manager.get_column_width(col);
            }

            for col in visible_bounds.start_col..=visible_bounds.end_col {
                let width = viewport_manager.get_column_width(col);
                let edge_x = current_x + width - scroll_x;

                // Check if mouse is near column edge
                if (x - edge_x).abs() < self.resize_threshold && x > 0.0 {
                    return Some((ResizeType::Column, col));
                }

                current_x += width;
                // Early exit if we've passed the mouse position
                if current_x - scroll_x > x + self.resize_threshold {
                    break;
                }
            }
        } else {
            // Check row header for resize - only check visible rows
            let mut current_y = 0.0;
            let scroll_y = viewport_manager.get_scroll_position().y;
            
            // Start from first visible row
            for row in 0..visible_bounds.start_row {
                current_y += viewport_manager.get_row_height(row);
            }

            for row in visible_bounds.start_row..=visible_bounds.end_row {
                let height = viewport_manager.get_row_height(row);
                let edge_y = current_y + height - scroll_y;

                // Check if mouse is near row edge
                if (y - edge_y).abs() < self.resize_threshold && y > 0.0 {
                    return Some((ResizeType::Row, row));
                }

                current_y += height;
                // Early exit if we've passed the mouse position
                if current_y - scroll_y > y + self.resize_threshold {
                    break;
                }
            }
        }

        None
    }

    pub fn start_resize(
        &self,
        event: &MouseEvent,
        resize_type: ResizeType,
        index: usize,
        controller: &mut SpreadsheetController,
    ) {
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
        let new_state =
            resize::start_mouse_resize(resize_type, index, start_position, start_size);

        // Update the controller's resize state
        *controller.resize_state_mut() = new_state;
    }

    pub fn handle_resize(&self, event: &MouseEvent, controller: &mut SpreadsheetController) {
        let resize_state = controller.resize_state();

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
            ResizeType::Row => (
                config.default_cell_height.min(20.0),
                config.default_cell_height * 10.0,
            ),
            ResizeType::None => return,
        };

        // Update resize using pure function
        if let Some((resize_type, index, new_size)) =
            resize::update_mouse_resize(resize_state, current_position, min_size, max_size)
        {
            // Update the resize state
            controller.resize_state_mut().current_size = new_size;

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

    pub fn end_resize(&self, controller: &mut SpreadsheetController) {
        let resize_state = controller.resize_state();

        // Use pure function to end resize
        resize::end_mouse_resize(resize_state);

        // Reset the resize state
        *controller.resize_state_mut() = Default::default();
    }

    pub fn is_resizing(&self, controller: &SpreadsheetController) -> bool {
        controller.resize_state().is_resizing
    }

    pub fn get_cursor_style(
        &self,
        x: f64,
        y: f64,
        is_header: bool,
        controller: &SpreadsheetController,
    ) -> &'static str {
        if let Some((resize_type, _)) = self.check_resize_hover(x, y, is_header, controller) {
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
