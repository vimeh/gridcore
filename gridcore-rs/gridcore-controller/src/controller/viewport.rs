use crate::state::ViewportInfo;
use gridcore_core::types::CellAddress;

/// Manages the visible viewport of the spreadsheet
pub trait ViewportManager: Send + Sync {
    /// Get the current viewport information
    fn get_viewport(&self) -> ViewportInfo;

    /// Set the viewport to a specific position
    fn set_viewport(&mut self, viewport: ViewportInfo);

    /// Scroll the viewport by a delta
    fn scroll(&mut self, delta_rows: i32, delta_cols: i32);

    /// Ensure a cell is visible in the viewport
    fn ensure_visible(&mut self, address: &CellAddress);

    /// Get the total dimensions of the spreadsheet
    fn get_dimensions(&self) -> (u32, u32);

    /// Convert viewport coordinates to cell address
    fn viewport_to_cell(&self, x: f64, y: f64) -> Option<CellAddress>;

    /// Convert cell address to viewport coordinates
    fn cell_to_viewport(&self, address: &CellAddress) -> Option<(f64, f64)>;

    /// Check if a cell is currently visible
    fn is_visible(&self, address: &CellAddress) -> bool;
}

/// Default implementation of ViewportManager
pub struct DefaultViewportManager {
    viewport: ViewportInfo,
    total_rows: u32,
    total_cols: u32,
    row_height: f64,
    col_width: f64,
    header_height: f64,
    header_width: f64,
}

impl DefaultViewportManager {
    pub fn new(rows: u32, cols: u32) -> Self {
        Self {
            viewport: ViewportInfo {
                start_row: 0,
                start_col: 0,
                rows: 20,
                cols: 10,
            },
            total_rows: rows,
            total_cols: cols,
            row_height: 25.0,
            col_width: 100.0,
            header_height: 30.0,
            header_width: 50.0,
        }
    }

    pub fn with_cell_dimensions(mut self, row_height: f64, col_width: f64) -> Self {
        self.row_height = row_height;
        self.col_width = col_width;
        self
    }

    pub fn with_header_dimensions(mut self, header_height: f64, header_width: f64) -> Self {
        self.header_height = header_height;
        self.header_width = header_width;
        self
    }
}

impl ViewportManager for DefaultViewportManager {
    fn get_viewport(&self) -> ViewportInfo {
        self.viewport.clone()
    }

    fn set_viewport(&mut self, viewport: ViewportInfo) {
        // Clamp to valid ranges
        let start_row = viewport.start_row.min(self.total_rows.saturating_sub(1));
        let start_col = viewport.start_col.min(self.total_cols.saturating_sub(1));
        let rows = viewport.rows.min(self.total_rows - start_row);
        let cols = viewport.cols.min(self.total_cols - start_col);

        self.viewport = ViewportInfo {
            start_row,
            start_col,
            rows,
            cols,
        };
    }

    fn scroll(&mut self, delta_rows: i32, delta_cols: i32) {
        let new_start_row = (self.viewport.start_row as i32 + delta_rows)
            .max(0)
            .min(self.total_rows.saturating_sub(self.viewport.rows) as i32)
            as u32;

        let new_start_col = (self.viewport.start_col as i32 + delta_cols)
            .max(0)
            .min(self.total_cols.saturating_sub(self.viewport.cols) as i32)
            as u32;

        self.viewport.start_row = new_start_row;
        self.viewport.start_col = new_start_col;
    }

    fn ensure_visible(&mut self, address: &CellAddress) {
        let row = address.row;
        let col = address.col;

        // Adjust viewport if cell is not visible
        if row < self.viewport.start_row {
            self.viewport.start_row = row;
        } else if row >= self.viewport.start_row + self.viewport.rows {
            self.viewport.start_row = row.saturating_sub(self.viewport.rows - 1);
        }

        if col < self.viewport.start_col {
            self.viewport.start_col = col;
        } else if col >= self.viewport.start_col + self.viewport.cols {
            self.viewport.start_col = col.saturating_sub(self.viewport.cols - 1);
        }
    }

    fn get_dimensions(&self) -> (u32, u32) {
        (self.total_rows, self.total_cols)
    }

    fn viewport_to_cell(&self, x: f64, y: f64) -> Option<CellAddress> {
        // Account for headers
        if x < self.header_width || y < self.header_height {
            return None;
        }

        let col = ((x - self.header_width) / self.col_width) as u32 + self.viewport.start_col;
        let row = ((y - self.header_height) / self.row_height) as u32 + self.viewport.start_row;

        if row < self.total_rows && col < self.total_cols {
            Some(CellAddress::new(col, row))
        } else {
            None
        }
    }

    fn cell_to_viewport(&self, address: &CellAddress) -> Option<(f64, f64)> {
        if !self.is_visible(address) {
            return None;
        }

        let row = address.row;
        let col = address.col;

        let x = self.header_width + ((col - self.viewport.start_col) as f64 * self.col_width);
        let y = self.header_height + ((row - self.viewport.start_row) as f64 * self.row_height);

        Some((x, y))
    }

    fn is_visible(&self, address: &CellAddress) -> bool {
        let row = address.row;
        let col = address.col;

        row >= self.viewport.start_row
            && row < self.viewport.start_row + self.viewport.rows
            && col >= self.viewport.start_col
            && col < self.viewport.start_col + self.viewport.cols
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_viewport_manager() {
        let mut manager = DefaultViewportManager::new(100, 50);

        // Test initial viewport
        let viewport = manager.get_viewport();
        assert_eq!(viewport.start_row, 0);
        assert_eq!(viewport.start_col, 0);
        assert_eq!(viewport.rows, 20);
        assert_eq!(viewport.cols, 10);

        // Test scrolling
        manager.scroll(5, 3);
        let viewport = manager.get_viewport();
        assert_eq!(viewport.start_row, 5);
        assert_eq!(viewport.start_col, 3);

        // Test ensure visible
        let cell = CellAddress::new(15, 30);
        manager.ensure_visible(&cell);
        let viewport = manager.get_viewport();
        assert!(viewport.start_row <= 30);
        assert!(viewport.start_row + viewport.rows > 30);
        assert!(viewport.start_col <= 15);
        assert!(viewport.start_col + viewport.cols > 15);
    }

    #[test]
    fn test_coordinate_conversion() {
        let manager = DefaultViewportManager::new(100, 50)
            .with_cell_dimensions(25.0, 100.0)
            .with_header_dimensions(30.0, 50.0);

        // Test viewport to cell
        let cell = manager.viewport_to_cell(150.0, 80.0);
        assert!(cell.is_some());
        let cell = cell.unwrap();
        assert_eq!(cell.col, 1); // (150 - 50) / 100 = 1
        assert_eq!(cell.row, 2); // (80 - 30) / 25 = 2

        // Test cell to viewport
        let coords = manager.cell_to_viewport(&CellAddress::new(1, 2));
        assert!(coords.is_some());
        let (x, y) = coords.unwrap();
        assert_eq!(x, 150.0); // 50 + 1 * 100
        assert_eq!(y, 80.0); // 30 + 2 * 25
    }

    #[test]
    fn test_visibility() {
        let manager = DefaultViewportManager::new(100, 50);

        assert!(manager.is_visible(&CellAddress::new(0, 0)));
        assert!(manager.is_visible(&CellAddress::new(9, 19)));
        assert!(!manager.is_visible(&CellAddress::new(10, 20)));
        assert!(!manager.is_visible(&CellAddress::new(0, 20)));
        assert!(!manager.is_visible(&CellAddress::new(10, 0)));
    }
}
