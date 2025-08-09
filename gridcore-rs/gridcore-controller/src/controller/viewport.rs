use crate::state::ViewportInfo;
use gridcore_core::types::CellAddress;
use std::collections::HashMap;
use serde::{Deserialize, Serialize};

/// Represents the visible bounds of the viewport
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ViewportBounds {
    pub start_row: usize,
    pub end_row: usize,
    pub start_col: usize,
    pub end_col: usize,
}

/// Represents the scroll position of the viewport
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct ScrollPosition {
    pub x: f64,
    pub y: f64,
}

/// Represents the position and dimensions of a cell in the viewport
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CellPosition {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// Grid configuration for structural properties
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GridConfiguration {
    pub default_cell_width: f64,
    pub default_cell_height: f64,
    pub min_cell_width: f64,
    pub max_cell_width: f64,
    pub row_header_width: f64,
    pub column_header_height: f64,
    pub total_rows: usize,
    pub total_cols: usize,
}

impl Default for GridConfiguration {
    fn default() -> Self {
        Self {
            default_cell_width: 100.0,
            default_cell_height: 24.0,
            min_cell_width: 40.0,
            max_cell_width: 500.0,
            row_header_width: 50.0,
            column_header_height: 24.0,
            total_rows: 10000,
            total_cols: 256,
        }
    }
}

/// Manages the visible viewport of the spreadsheet
pub trait ViewportManager: Send + Sync {
    /// Get the current viewport information
    fn get_viewport(&self) -> ViewportInfo;

    /// Set the viewport to a specific position
    fn set_viewport(&mut self, viewport: ViewportInfo);

    /// Scroll the viewport by a delta
    fn scroll(&mut self, delta_rows: i32, delta_cols: i32);
    
    /// Scroll the viewport by pixel deltas
    fn scroll_by(&mut self, delta_x: f64, delta_y: f64);
    
    /// Scroll to make a specific cell visible
    fn scroll_to_cell(&mut self, cell: &CellAddress, position: &str);

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
    
    /// Get the visible bounds of the viewport
    fn get_visible_bounds(&self) -> ViewportBounds;
    
    /// Get the position of a cell in viewport coordinates
    fn get_cell_position(&self, address: &CellAddress) -> CellPosition;
    
    /// Get cell at a specific position
    fn get_cell_at_position(&self, x: f64, y: f64) -> Option<CellAddress>;
    
    /// Column/row dimension management
    fn get_column_width(&self, col: usize) -> f64;
    fn set_column_width(&mut self, col: usize, width: f64);
    fn get_row_height(&self, row: usize) -> f64;
    fn set_row_height(&mut self, row: usize, height: f64);
    
    /// Get the x coordinate of a column
    fn get_column_x(&self, col: usize) -> f64;
    
    /// Get the y coordinate of a row
    fn get_row_y(&self, row: usize) -> f64;
    
    /// Get scroll position
    fn get_scroll_position(&self) -> ScrollPosition;
    
    /// Set scroll position
    fn set_scroll_position(&mut self, x: f64, y: f64);
    
    /// Get viewport dimensions
    fn get_viewport_width(&self) -> f64;
    fn get_viewport_height(&self) -> f64;
    fn set_viewport_size(&mut self, width: f64, height: f64);
}

/// Default implementation of ViewportManager
pub struct DefaultViewportManager {
    viewport: ViewportInfo,
    config: GridConfiguration,
    scroll_position: ScrollPosition,
    viewport_width: f64,
    viewport_height: f64,
    column_widths: HashMap<usize, f64>,
    row_heights: HashMap<usize, f64>,
}

impl DefaultViewportManager {
    pub fn new(rows: u32, cols: u32) -> Self {
        let mut config = GridConfiguration::default();
        config.total_rows = rows as usize;
        config.total_cols = cols as usize;
        
        Self {
            viewport: ViewportInfo {
                start_row: 0,
                start_col: 0,
                rows: 20,
                cols: 10,
            },
            config,
            scroll_position: ScrollPosition::default(),
            viewport_width: 800.0,
            viewport_height: 600.0,
            column_widths: HashMap::new(),
            row_heights: HashMap::new(),
        }
    }
    
    pub fn with_config(mut self, config: GridConfiguration) -> Self {
        self.config = config;
        self
    }

    pub fn with_cell_dimensions(mut self, row_height: f64, col_width: f64) -> Self {
        self.config.default_cell_height = row_height;
        self.config.default_cell_width = col_width;
        self
    }

    pub fn with_header_dimensions(mut self, header_height: f64, header_width: f64) -> Self {
        self.config.column_header_height = header_height;
        self.config.row_header_width = header_width;
        self
    }
    
    fn get_total_grid_width(&self) -> f64 {
        let mut width = 0.0;
        for col in 0..self.config.total_cols {
            width += self.get_column_width(col);
        }
        width
    }
    
    fn get_total_grid_height(&self) -> f64 {
        let mut height = 0.0;
        for row in 0..self.config.total_rows {
            height += self.get_row_height(row);
        }
        height
    }
}

impl ViewportManager for DefaultViewportManager {
    fn get_viewport(&self) -> ViewportInfo {
        self.viewport.clone()
    }

    fn set_viewport(&mut self, viewport: ViewportInfo) {
        // Clamp to valid ranges
        let start_row = viewport.start_row.min(self.config.total_rows.saturating_sub(1) as u32);
        let start_col = viewport.start_col.min(self.config.total_cols.saturating_sub(1) as u32);
        let rows = viewport.rows.min((self.config.total_rows as u32) - start_row);
        let cols = viewport.cols.min((self.config.total_cols as u32) - start_col);

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
            .min((self.config.total_rows as u32).saturating_sub(self.viewport.rows) as i32)
            as u32;

        let new_start_col = (self.viewport.start_col as i32 + delta_cols)
            .max(0)
            .min((self.config.total_cols as u32).saturating_sub(self.viewport.cols) as i32)
            as u32;

        self.viewport.start_row = new_start_row;
        self.viewport.start_col = new_start_col;
    }
    
    fn scroll_by(&mut self, delta_x: f64, delta_y: f64) {
        let new_x = (self.scroll_position.x + delta_x).max(0.0);
        let new_y = (self.scroll_position.y + delta_y).max(0.0);
        
        let max_x = (self.get_total_grid_width() - self.viewport_width).max(0.0);
        let max_y = (self.get_total_grid_height() - self.viewport_height).max(0.0);
        
        self.scroll_position = ScrollPosition {
            x: new_x.min(max_x),
            y: new_y.min(max_y),
        };
    }
    
    fn scroll_to_cell(&mut self, cell: &CellAddress, position: &str) {
        let cell_pos = self.get_cell_position(cell);
        let absolute_x = cell_pos.x + self.scroll_position.x;
        let absolute_y = cell_pos.y + self.scroll_position.y;
        
        let new_y = match position {
            "center" => absolute_y - self.viewport_height / 2.0 + cell_pos.height / 2.0,
            "top" => absolute_y,
            "bottom" => absolute_y - self.viewport_height + cell_pos.height,
            _ => self.scroll_position.y,
        };
        
        // Ensure cell is horizontally visible
        let mut new_x = self.scroll_position.x;
        if absolute_x < self.scroll_position.x {
            new_x = absolute_x;
        } else if absolute_x + cell_pos.width > self.scroll_position.x + self.viewport_width {
            new_x = absolute_x + cell_pos.width - self.viewport_width;
        }
        
        self.set_scroll_position(
            new_x.max(0.0).min(self.get_total_grid_width() - self.viewport_width),
            new_y.max(0.0).min(self.get_total_grid_height() - self.viewport_height),
        );
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
        (self.config.total_rows as u32, self.config.total_cols as u32)
    }

    fn viewport_to_cell(&self, x: f64, y: f64) -> Option<CellAddress> {
        // Account for headers
        if x < self.config.row_header_width || y < self.config.column_header_height {
            return None;
        }

        let absolute_x = x - self.config.row_header_width + self.scroll_position.x;
        let absolute_y = y - self.config.column_header_height + self.scroll_position.y;
        
        self.get_cell_at_position(absolute_x, absolute_y)
    }

    fn cell_to_viewport(&self, address: &CellAddress) -> Option<(f64, f64)> {
        if !self.is_visible(address) {
            return None;
        }

        let pos = self.get_cell_position(address);
        Some((
            pos.x + self.config.row_header_width,
            pos.y + self.config.column_header_height,
        ))
    }

    fn is_visible(&self, address: &CellAddress) -> bool {
        let bounds = self.get_visible_bounds();
        address.row as usize >= bounds.start_row
            && address.row as usize <= bounds.end_row
            && address.col as usize >= bounds.start_col
            && address.col as usize <= bounds.end_col
    }
    
    fn get_visible_bounds(&self) -> ViewportBounds {
        let mut start_row = None;
        let mut end_row = self.config.total_rows;
        let mut start_col = None;
        let mut end_col = self.config.total_cols;
        
        // Calculate visible rows
        let mut y = 0.0;
        let scroll_y = self.scroll_position.y;
        for row in 0..self.config.total_rows {
            let height = self.get_row_height(row);
            if y + height > scroll_y && start_row.is_none() {
                start_row = Some(row);
            }
            if y >= scroll_y + self.viewport_height {
                end_row = row;
                break;
            }
            y += height;
        }
        
        // Calculate visible columns  
        let mut x = 0.0;
        let scroll_x = self.scroll_position.x;
        for col in 0..self.config.total_cols {
            let width = self.get_column_width(col);
            if x + width > scroll_x && start_col.is_none() {
                start_col = Some(col);
            }
            if x >= scroll_x + self.viewport_width {
                end_col = col;
                break;
            }
            x += width;
        }
        
        ViewportBounds {
            start_row: start_row.unwrap_or(0),
            end_row: end_row.min(self.config.total_rows - 1),
            start_col: start_col.unwrap_or(0),
            end_col: end_col.min(self.config.total_cols - 1),
        }
    }
    
    fn get_cell_position(&self, address: &CellAddress) -> CellPosition {
        let mut x = 0.0;
        let mut y = 0.0;
        
        for col in 0..address.col as usize {
            x += self.get_column_width(col);
        }
        
        for row in 0..address.row as usize {
            y += self.get_row_height(row);
        }
        
        CellPosition {
            x: x - self.scroll_position.x,
            y: y - self.scroll_position.y,
            width: self.get_column_width(address.col as usize),
            height: self.get_row_height(address.row as usize),
        }
    }
    
    fn get_cell_at_position(&self, x: f64, y: f64) -> Option<CellAddress> {
        let mut current_x = 0.0;
        let mut col = None;
        
        for c in 0..self.config.total_cols {
            let width = self.get_column_width(c);
            if x >= current_x && x < current_x + width {
                col = Some(c);
                break;
            }
            current_x += width;
        }
        
        let mut current_y = 0.0;
        let mut row = None;
        
        for r in 0..self.config.total_rows {
            let height = self.get_row_height(r);
            if y >= current_y && y < current_y + height {
                row = Some(r);
                break;
            }
            current_y += height;
        }
        
        match (row, col) {
            (Some(r), Some(c)) => Some(CellAddress::new(c as u32, r as u32)),
            _ => None,
        }
    }
    
    fn get_column_width(&self, col: usize) -> f64 {
        *self.column_widths.get(&col).unwrap_or(&self.config.default_cell_width)
    }
    
    fn set_column_width(&mut self, col: usize, width: f64) {
        let clamped_width = width
            .max(self.config.min_cell_width)
            .min(self.config.max_cell_width);
        self.column_widths.insert(col, clamped_width);
    }
    
    fn get_row_height(&self, row: usize) -> f64 {
        *self.row_heights.get(&row).unwrap_or(&self.config.default_cell_height)
    }
    
    fn set_row_height(&mut self, row: usize, height: f64) {
        self.row_heights.insert(row, height.max(16.0));
    }
    
    fn get_column_x(&self, col: usize) -> f64 {
        let mut x = 0.0;
        for c in 0..col {
            x += self.get_column_width(c);
        }
        x
    }
    
    fn get_row_y(&self, row: usize) -> f64 {
        let mut y = 0.0;
        for r in 0..row {
            y += self.get_row_height(r);
        }
        y
    }
    
    fn get_scroll_position(&self) -> ScrollPosition {
        self.scroll_position.clone()
    }
    
    fn set_scroll_position(&mut self, x: f64, y: f64) {
        self.scroll_position = ScrollPosition { x, y };
    }
    
    fn get_viewport_width(&self) -> f64 {
        self.viewport_width
    }
    
    fn get_viewport_height(&self) -> f64 {
        self.viewport_height
    }
    
    fn set_viewport_size(&mut self, width: f64, height: f64) {
        self.viewport_width = width;
        self.viewport_height = height;
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
        let mut manager = DefaultViewportManager::new(100, 50);
        // Set viewport size so we have a proper visible area
        manager.set_viewport_size(1000.0, 500.0);
        
        // Get the visible bounds to understand what should be visible
        let bounds = manager.get_visible_bounds();
        
        // Test cells within bounds
        assert!(manager.is_visible(&CellAddress::new(bounds.start_col as u32, bounds.start_row as u32)));
        assert!(manager.is_visible(&CellAddress::new(bounds.end_col as u32, bounds.end_row as u32)));
        
        // Test cells outside bounds
        if bounds.end_col < 49 {
            assert!(!manager.is_visible(&CellAddress::new((bounds.end_col + 1) as u32, bounds.start_row as u32)));
        }
        if bounds.end_row < 99 {
            assert!(!manager.is_visible(&CellAddress::new(bounds.start_col as u32, (bounds.end_row + 1) as u32)));
        }
    }
}
