use gridcore_core::types::CellAddress;
use crate::rendering::GridTheme;
use std::collections::HashMap;

#[derive(Clone, Debug)]
pub struct ViewportBounds {
    pub start_row: usize,
    pub end_row: usize,
    pub start_col: usize,
    pub end_col: usize,
}

#[derive(Clone, Debug, Default)]
pub struct ScrollPosition {
    pub x: f64,
    pub y: f64,
}

#[derive(Clone, Debug)]
pub struct CellPosition {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Clone)]
pub struct Viewport {
    theme: GridTheme,
    total_rows: usize,
    total_cols: usize,
    scroll_position: ScrollPosition,
    viewport_width: f64,
    viewport_height: f64,
    column_widths: HashMap<usize, f64>,
    row_heights: HashMap<usize, f64>,
}

impl Viewport {
    pub fn new(theme: GridTheme, total_rows: Option<usize>, total_cols: Option<usize>) -> Self {
        Self {
            theme,
            total_rows: total_rows.unwrap_or(1000),
            total_cols: total_cols.unwrap_or(26),
            scroll_position: ScrollPosition::default(),
            viewport_width: 800.0,
            viewport_height: 600.0,
            column_widths: HashMap::new(),
            row_heights: HashMap::new(),
        }
    }
    
    pub fn get_total_rows(&self) -> usize {
        self.total_rows
    }
    
    pub fn get_total_cols(&self) -> usize {
        self.total_cols
    }
    
    pub fn get_theme(&self) -> &GridTheme {
        &self.theme
    }
    
    pub fn set_viewport_size(&mut self, width: f64, height: f64) {
        self.viewport_width = width;
        self.viewport_height = height;
    }
    
    pub fn set_scroll_position(&mut self, x: f64, y: f64) {
        self.scroll_position = ScrollPosition { x, y };
    }
    
    pub fn get_scroll_position(&self) -> ScrollPosition {
        self.scroll_position.clone()
    }
    
    pub fn scroll_by(&mut self, delta_x: f64, delta_y: f64) {
        let new_x = (self.scroll_position.x + delta_x).max(0.0);
        let new_y = (self.scroll_position.y + delta_y).max(0.0);
        
        let max_x = (self.get_total_grid_width() - self.viewport_width).max(0.0);
        let max_y = (self.get_total_grid_height() - self.viewport_height).max(0.0);
        
        self.scroll_position = ScrollPosition {
            x: new_x.min(max_x),
            y: new_y.min(max_y),
        };
    }
    
    pub fn scroll_to_cell(&mut self, cell: &CellAddress, position: &str) {
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
    
    pub fn get_column_width(&self, col: usize) -> f64 {
        *self.column_widths.get(&col).unwrap_or(&self.theme.default_cell_width)
    }
    
    pub fn set_column_width(&mut self, col: usize, width: f64) {
        let clamped_width = width
            .max(self.theme.min_cell_width)
            .min(self.theme.max_cell_width);
        self.column_widths.insert(col, clamped_width);
    }
    
    pub fn get_row_height(&self, row: usize) -> f64 {
        *self.row_heights.get(&row).unwrap_or(&self.theme.default_cell_height)
    }
    
    pub fn set_row_height(&mut self, row: usize, height: f64) {
        self.row_heights.insert(row, height.max(16.0));
    }
    
    pub fn get_visible_bounds(&self) -> ViewportBounds {
        let mut start_row = 0;
        let mut end_row = self.total_rows;
        let mut start_col = 0;
        let mut end_col = self.total_cols;
        
        // Calculate visible rows
        let mut y = 0.0;
        let scroll_y = self.scroll_position.y;
        for row in 0..self.total_rows {
            let height = self.get_row_height(row);
            if y + height > scroll_y && start_row == 0 {
                start_row = row;
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
        for col in 0..self.total_cols {
            let width = self.get_column_width(col);
            if x + width > scroll_x && start_col == 0 {
                start_col = col;
            }
            if x >= scroll_x + self.viewport_width {
                end_col = col;
                break;
            }
            x += width;
        }
        
        ViewportBounds {
            start_row,
            end_row: end_row.min(self.total_rows - 1),
            start_col,
            end_col: end_col.min(self.total_cols - 1),
        }
    }
    
    pub fn get_cell_position(&self, address: &CellAddress) -> CellPosition {
        let mut x = 0.0;
        let mut y = 0.0;
        
        for col in 0..address.col {
            x += self.get_column_width(col);
        }
        
        for row in 0..address.row {
            y += self.get_row_height(row);
        }
        
        CellPosition {
            x: x - self.scroll_position.x,
            y: y - self.scroll_position.y,
            width: self.get_column_width(address.col),
            height: self.get_row_height(address.row),
        }
    }
    
    pub fn get_cell_at_position(&self, x: f64, y: f64) -> Option<CellAddress> {
        let absolute_x = x + self.scroll_position.x;
        let absolute_y = y + self.scroll_position.y;
        
        let mut current_x = 0.0;
        let mut col = None;
        
        for c in 0..self.total_cols {
            let width = self.get_column_width(c);
            if absolute_x >= current_x && absolute_x < current_x + width {
                col = Some(c);
                break;
            }
            current_x += width;
        }
        
        let mut current_y = 0.0;
        let mut row = None;
        
        for r in 0..self.total_rows {
            let height = self.get_row_height(r);
            if absolute_y >= current_y && absolute_y < current_y + height {
                row = Some(r);
                break;
            }
            current_y += height;
        }
        
        match (row, col) {
            (Some(r), Some(c)) => Some(CellAddress::new(r, c)),
            _ => None,
        }
    }
    
    pub fn get_column_x(&self, col: usize) -> f64 {
        let mut x = 0.0;
        for c in 0..col {
            x += self.get_column_width(c);
        }
        x
    }
    
    pub fn get_row_y(&self, row: usize) -> f64 {
        let mut y = 0.0;
        for r in 0..row {
            y += self.get_row_height(r);
        }
        y
    }
    
    pub fn get_total_grid_width(&self) -> f64 {
        let mut width = 0.0;
        for col in 0..self.total_cols {
            width += self.get_column_width(col);
        }
        width
    }
    
    pub fn get_total_grid_height(&self) -> f64 {
        let mut height = 0.0;
        for row in 0..self.total_rows {
            height += self.get_row_height(row);
        }
        height
    }
    
    pub fn get_column_widths(&self) -> HashMap<usize, f64> {
        self.column_widths.clone()
    }
    
    pub fn get_row_heights(&self) -> HashMap<usize, f64> {
        self.row_heights.clone()
    }
    
    pub fn set_column_widths(&mut self, widths: HashMap<usize, f64>) {
        for (col, width) in widths {
            self.set_column_width(col, width);
        }
    }
    
    pub fn set_row_heights(&mut self, heights: HashMap<usize, f64>) {
        for (row, height) in heights {
            self.set_row_height(row, height);
        }
    }
}