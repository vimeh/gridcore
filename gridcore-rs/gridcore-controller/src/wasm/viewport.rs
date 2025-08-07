use gridcore_core::types::CellAddress;
use wasm_bindgen::prelude::*;

/// WASM wrapper for ViewportManager
/// This is a simplified version for JavaScript interop
#[wasm_bindgen]
pub struct WasmViewportManager {
    column_widths: Vec<f64>,
    row_heights: Vec<f64>,
    total_rows: u32,
    total_cols: u32,
    scroll_callback: Option<js_sys::Function>,
}

#[wasm_bindgen]
impl WasmViewportManager {
    #[wasm_bindgen(constructor)]
    pub fn new(total_rows: u32, total_cols: u32) -> Self {
        Self {
            column_widths: vec![100.0; total_cols as usize],
            row_heights: vec![30.0; total_rows as usize],
            total_rows,
            total_cols,
            scroll_callback: None,
        }
    }

    #[wasm_bindgen(js_name = "getColumnWidth")]
    pub fn get_column_width(&self, index: u32) -> f64 {
        self.column_widths
            .get(index as usize)
            .copied()
            .unwrap_or(100.0)
    }

    #[wasm_bindgen(js_name = "setColumnWidth")]
    pub fn set_column_width(&mut self, index: u32, width: f64) {
        if (index as usize) < self.column_widths.len() {
            self.column_widths[index as usize] = width;
        }
    }

    #[wasm_bindgen(js_name = "getRowHeight")]
    pub fn get_row_height(&self, index: u32) -> f64 {
        self.row_heights
            .get(index as usize)
            .copied()
            .unwrap_or(30.0)
    }

    #[wasm_bindgen(js_name = "setRowHeight")]
    pub fn set_row_height(&mut self, index: u32, height: f64) {
        if (index as usize) < self.row_heights.len() {
            self.row_heights[index as usize] = height;
        }
    }

    #[wasm_bindgen(js_name = "getTotalRows")]
    pub fn get_total_rows(&self) -> u32 {
        self.total_rows
    }

    #[wasm_bindgen(js_name = "getTotalCols")]
    pub fn get_total_cols(&self) -> u32 {
        self.total_cols
    }

    #[wasm_bindgen(js_name = "scrollTo")]
    pub fn scroll_to(&self, row: u32, col: u32) {
        if let Some(callback) = &self.scroll_callback {
            let _ = callback.call2(&JsValue::NULL, &JsValue::from(row), &JsValue::from(col));
        }
    }

    #[wasm_bindgen(js_name = "setScrollCallback")]
    pub fn set_scroll_callback(&mut self, callback: js_sys::Function) {
        self.scroll_callback = Some(callback);
    }

    #[wasm_bindgen(js_name = "ensureVisible")]
    pub fn ensure_visible(&self, col: u32, row: u32) {
        // Calculate if we need to scroll to make this cell visible
        // This is a simplified implementation
        self.scroll_to(row, col);
    }

    #[wasm_bindgen(js_name = "viewportToCell")]
    pub fn viewport_to_cell(&self, x: f64, y: f64) -> JsValue {
        // Convert viewport coordinates to cell address
        let mut col = 0u32;
        let mut row = 0u32;
        let mut x_pos = 0.0;
        let mut y_pos = 0.0;

        // Find column
        for i in 0..self.total_cols {
            let width = self.get_column_width(i);
            if x_pos + width > x {
                col = i;
                break;
            }
            x_pos += width;
        }

        // Find row
        for i in 0..self.total_rows {
            let height = self.get_row_height(i);
            if y_pos + height > y {
                row = i;
                break;
            }
            y_pos += height;
        }

        // Return as JavaScript object
        let obj = js_sys::Object::new();
        js_sys::Reflect::set(&obj, &"col".into(), &col.into()).unwrap();
        js_sys::Reflect::set(&obj, &"row".into(), &row.into()).unwrap();
        obj.into()
    }
}
