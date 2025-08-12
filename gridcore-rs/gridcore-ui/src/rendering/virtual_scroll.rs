use gridcore_core::types::CellAddress;

/// Virtual scrolling manager for efficient rendering of large grids
pub struct VirtualScrollManager {
    viewport_rows: u32,
    viewport_cols: u32,
    buffer_rows: u32,
    buffer_cols: u32,
    total_rows: u32,
    total_cols: u32,
    scroll_top: f64,
    scroll_left: f64,
    row_height: f64,
    default_col_width: f64,
}

impl VirtualScrollManager {
    pub fn new(total_rows: u32, total_cols: u32) -> Self {
        Self {
            viewport_rows: 20,
            viewport_cols: 10,
            buffer_rows: 5,
            buffer_cols: 3,
            total_rows,
            total_cols,
            scroll_top: 0.0,
            scroll_left: 0.0,
            row_height: 25.0,
            default_col_width: 100.0,
        }
    }
    
    /// Update viewport dimensions
    pub fn set_viewport(&mut self, rows: u32, cols: u32) {
        self.viewport_rows = rows;
        self.viewport_cols = cols;
    }
    
    /// Update scroll position
    pub fn set_scroll(&mut self, top: f64, left: f64) {
        self.scroll_top = top.max(0.0);
        self.scroll_left = left.max(0.0);
    }
    
    /// Get the range of cells that should be rendered
    pub fn get_visible_range(&self) -> (CellRange, CellRange) {
        let start_row = (self.scroll_top / self.row_height) as u32;
        let start_col = (self.scroll_left / self.default_col_width) as u32;
        
        // Add buffer for smooth scrolling
        let render_start_row = start_row.saturating_sub(self.buffer_rows);
        let render_start_col = start_col.saturating_sub(self.buffer_cols);
        
        let render_end_row = (start_row + self.viewport_rows + self.buffer_rows)
            .min(self.total_rows);
        let render_end_col = (start_col + self.viewport_cols + self.buffer_cols)
            .min(self.total_cols);
        
        let visible_range = CellRange {
            start_row,
            start_col,
            end_row: start_row + self.viewport_rows,
            end_col: start_col + self.viewport_cols,
        };
        
        let render_range = CellRange {
            start_row: render_start_row,
            start_col: render_start_col,
            end_row: render_end_row,
            end_col: render_end_col,
        };
        
        (visible_range, render_range)
    }
    
    /// Check if a cell is in the visible viewport
    pub fn is_visible(&self, row: u32, col: u32) -> bool {
        let (visible, _) = self.get_visible_range();
        row >= visible.start_row && row < visible.end_row &&
        col >= visible.start_col && col < visible.end_col
    }
    
    /// Calculate the pixel position of a cell
    pub fn get_cell_position(&self, row: u32, col: u32) -> (f64, f64) {
        let x = col as f64 * self.default_col_width - self.scroll_left;
        let y = row as f64 * self.row_height - self.scroll_top;
        (x, y)
    }
}

#[derive(Debug, Clone)]
pub struct CellRange {
    pub start_row: u32,
    pub start_col: u32,
    pub end_row: u32,
    pub end_col: u32,
}

impl CellRange {
    /// Iterate over all cells in the range
    pub fn iter_cells(&self) -> impl Iterator<Item = CellAddress> + '_ {
        (self.start_row..self.end_row)
            .flat_map(move |row| {
                (self.start_col..self.end_col)
                    .map(move |col| CellAddress::new(row, col))
            })
    }
    
    /// Check if a cell is within this range
    pub fn contains(&self, row: u32, col: u32) -> bool {
        row >= self.start_row && row < self.end_row &&
        col >= self.start_col && col < self.end_col
    }
}