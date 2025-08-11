use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Type of resize operation
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum ResizeType {
    None,
    Column,
    Row,
}

/// State of an ongoing resize operation
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ResizeState {
    pub is_resizing: bool,
    pub resize_type: ResizeType,
    pub resize_index: usize,
    pub start_position: f64,
    pub start_size: f64,
    pub current_size: f64,
}

impl Default for ResizeState {
    fn default() -> Self {
        Self {
            is_resizing: false,
            resize_type: ResizeType::None,
            resize_index: 0,
            start_position: 0.0,
            start_size: 0.0,
            current_size: 0.0,
        }
    }
}

/// Manages column and row resizing operations
pub struct ResizeManager {
    state: ResizeState,
    column_widths: HashMap<usize, f64>,
    row_heights: HashMap<usize, f64>,
    min_column_width: f64,
    max_column_width: f64,
    min_row_height: f64,
    max_row_height: f64,
    resize_threshold: f64,
}

impl ResizeManager {
    pub fn new() -> Self {
        Self {
            state: ResizeState::default(),
            column_widths: HashMap::new(),
            row_heights: HashMap::new(),
            min_column_width: 40.0,
            max_column_width: 500.0,
            min_row_height: 16.0,
            max_row_height: 200.0,
            resize_threshold: 5.0,
        }
    }

    pub fn with_limits(
        mut self,
        min_col_width: f64,
        max_col_width: f64,
        min_row_height: f64,
        max_row_height: f64,
    ) -> Self {
        self.min_column_width = min_col_width;
        self.max_column_width = max_col_width;
        self.min_row_height = min_row_height;
        self.max_row_height = max_row_height;
        self
    }

    pub fn with_threshold(mut self, threshold: f64) -> Self {
        self.resize_threshold = threshold;
        self
    }

    /// Check if a position is near a resize handle
    pub fn check_resize_hover(
        &self,
        x: f64,
        y: f64,
        is_column_header: bool,
        column_positions: &[(usize, f64)], // (index, x_position)
        row_positions: &[(usize, f64)],    // (index, y_position)
    ) -> Option<(ResizeType, usize)> {
        if is_column_header {
            // Check column edges
            for &(col_index, edge_x) in column_positions {
                if (x - edge_x).abs() < self.resize_threshold {
                    return Some((ResizeType::Column, col_index));
                }
            }
        } else {
            // Check row edges
            for &(row_index, edge_y) in row_positions {
                if (y - edge_y).abs() < self.resize_threshold {
                    return Some((ResizeType::Row, row_index));
                }
            }
        }
        None
    }

    /// Start a resize operation
    pub fn start_resize(
        &mut self,
        resize_type: ResizeType,
        index: usize,
        start_position: f64,
        current_size: f64,
    ) {
        self.state = ResizeState {
            is_resizing: true,
            resize_type,
            resize_index: index,
            start_position,
            start_size: current_size,
            current_size,
        };
    }

    /// Update resize based on mouse position
    pub fn update_resize(&mut self, current_position: f64) -> Option<(ResizeType, usize, f64)> {
        if !self.state.is_resizing {
            return None;
        }

        let delta = current_position - self.state.start_position;
        let new_size = match self.state.resize_type {
            ResizeType::Column => (self.state.start_size + delta)
                .max(self.min_column_width)
                .min(self.max_column_width),
            ResizeType::Row => (self.state.start_size + delta)
                .max(self.min_row_height)
                .min(self.max_row_height),
            ResizeType::None => return None,
        };

        self.state.current_size = new_size;

        // Store the new size
        match self.state.resize_type {
            ResizeType::Column => {
                self.column_widths.insert(self.state.resize_index, new_size);
            }
            ResizeType::Row => {
                self.row_heights.insert(self.state.resize_index, new_size);
            }
            ResizeType::None => {}
        }

        Some((self.state.resize_type, self.state.resize_index, new_size))
    }

    /// End the resize operation
    pub fn end_resize(&mut self) -> Option<(ResizeType, usize, f64)> {
        if !self.state.is_resizing {
            return None;
        }

        let result = Some((
            self.state.resize_type,
            self.state.resize_index,
            self.state.current_size,
        ));

        self.state = ResizeState::default();
        result
    }

    /// Cancel the resize operation
    pub fn cancel_resize(&mut self) {
        self.state = ResizeState::default();
    }

    /// Check if currently resizing
    pub fn is_resizing(&self) -> bool {
        self.state.is_resizing
    }

    /// Get the current resize state
    pub fn get_state(&self) -> &ResizeState {
        &self.state
    }

    /// Get stored column width
    pub fn get_column_width(&self, col: usize) -> Option<f64> {
        self.column_widths.get(&col).copied()
    }

    /// Get stored row height
    pub fn get_row_height(&self, row: usize) -> Option<f64> {
        self.row_heights.get(&row).copied()
    }

    /// Get the resize type
    pub fn get_resize_type(&self) -> ResizeType {
        self.state.resize_type
    }

    /// Get the resize index
    pub fn get_resize_index(&self) -> usize {
        self.state.resize_index
    }

    /// Get the current size being resized to
    pub fn get_current_size(&self) -> f64 {
        self.state.current_size
    }

    /// Set column width directly
    pub fn set_column_width(&mut self, col: usize, width: f64) {
        let clamped = width.max(self.min_column_width).min(self.max_column_width);
        self.column_widths.insert(col, clamped);
    }

    /// Set row height directly
    pub fn set_row_height(&mut self, row: usize, height: f64) {
        let clamped = height.max(self.min_row_height).min(self.max_row_height);
        self.row_heights.insert(row, clamped);
    }

    /// Get all custom column widths
    pub fn get_column_widths(&self) -> &HashMap<usize, f64> {
        &self.column_widths
    }

    /// Get all custom row heights
    pub fn get_row_heights(&self) -> &HashMap<usize, f64> {
        &self.row_heights
    }

    /// Clear all custom dimensions
    pub fn reset_dimensions(&mut self) {
        self.column_widths.clear();
        self.row_heights.clear();
    }

    /// Get cursor style for a given position
    pub fn get_cursor_style(&self, resize_type: Option<ResizeType>) -> &'static str {
        match resize_type {
            Some(ResizeType::Column) => "col-resize",
            Some(ResizeType::Row) => "row-resize",
            _ => "default",
        }
    }
}

impl Default for ResizeManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resize_manager() {
        let mut manager = ResizeManager::new();

        // Test column resize
        manager.start_resize(ResizeType::Column, 5, 100.0, 80.0);
        assert!(manager.is_resizing());

        let result = manager.update_resize(150.0);
        assert!(result.is_some());
        let (resize_type, index, size) = result.unwrap();
        assert_eq!(resize_type, ResizeType::Column);
        assert_eq!(index, 5);
        assert_eq!(size, 130.0); // 80 + (150 - 100)

        let end_result = manager.end_resize();
        assert!(end_result.is_some());
        assert!(!manager.is_resizing());

        // Verify the width was stored
        assert_eq!(manager.get_column_width(5), Some(130.0));
    }

    #[test]
    fn test_resize_limits() {
        let mut manager = ResizeManager::new().with_limits(50.0, 200.0, 20.0, 100.0);

        // Test column resize with limits
        manager.start_resize(ResizeType::Column, 0, 100.0, 100.0);

        // Try to resize below minimum
        let result = manager.update_resize(0.0);
        let (_, _, size) = result.unwrap();
        assert_eq!(size, 50.0); // Should be clamped to minimum

        // Try to resize above maximum
        manager.start_resize(ResizeType::Column, 0, 100.0, 100.0);
        let result = manager.update_resize(300.0);
        let (_, _, size) = result.unwrap();
        assert_eq!(size, 200.0); // Should be clamped to maximum
    }
}
