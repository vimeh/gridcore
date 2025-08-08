use crate::domain::Cell;
use crate::facade::wasm::WasmSpreadsheetFacade;
use crate::types::{CellAddress, CellValue, ToJs};
use crate::workbook::{Sheet, SheetManager, Workbook};
use std::cell::RefCell;
use std::rc::Rc;
use wasm_bindgen::prelude::*;

/// WASM wrapper for Sheet
#[wasm_bindgen]
pub struct WasmSheet {
    #[wasm_bindgen(skip)]
    pub inner: Rc<RefCell<Sheet>>,
    name: String,
}

#[wasm_bindgen]
impl WasmSheet {
    /// Get the sheet name
    #[wasm_bindgen(js_name = "getName")]
    pub fn get_name(&self) -> String {
        self.name.clone()
    }

    /// Get cell count
    #[wasm_bindgen(js_name = "getCellCount")]
    pub fn get_cell_count(&self) -> usize {
        self.inner.borrow().cell_count()
    }

    /// Set visibility
    #[wasm_bindgen(js_name = "setVisible")]
    pub fn set_visible(&mut self, visible: bool) {
        self.inner.borrow_mut().set_visible(visible);
    }

    /// Set protection
    #[wasm_bindgen(js_name = "setProtected")]
    pub fn set_protected(&mut self, is_protected: bool) {
        self.inner.borrow_mut().set_protected(is_protected);
    }

    /// Get column width
    #[wasm_bindgen(js_name = "getColumnWidth")]
    pub fn get_column_width(&self, column: u32) -> f64 {
        self.inner.borrow().get_column_width(column)
    }

    /// Set column width
    #[wasm_bindgen(js_name = "setColumnWidth")]
    pub fn set_column_width(&mut self, column: u32, width: f64) {
        self.inner.borrow_mut().set_column_width(column, width);
    }

    /// Get row height
    #[wasm_bindgen(js_name = "getRowHeight")]
    pub fn get_row_height(&self, row: u32) -> f64 {
        self.inner.borrow().get_row_height(row)
    }

    /// Set row height
    #[wasm_bindgen(js_name = "setRowHeight")]
    pub fn set_row_height(&mut self, row: u32, height: f64) {
        self.inner.borrow_mut().set_row_height(row, height);
    }

    /// Clear all cells
    #[wasm_bindgen]
    pub fn clear(&self) {
        self.inner.borrow().clear();
    }
}

/// WASM wrapper for Workbook
#[wasm_bindgen]
pub struct WasmWorkbook {
    inner: Rc<RefCell<Workbook>>,
}

#[wasm_bindgen]
impl WasmWorkbook {
    /// Create a new workbook with default sheet
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: Rc::new(RefCell::new(Workbook::with_sheet("Sheet1"))),
        }
    }

    /// Create a new workbook with a named sheet
    #[wasm_bindgen(js_name = "withSheet")]
    pub fn with_sheet(sheet_name: &str) -> Self {
        Self {
            inner: Rc::new(RefCell::new(Workbook::with_sheet(sheet_name))),
        }
    }

    /// Get the number of sheets
    #[wasm_bindgen(js_name = "getSheetCount")]
    pub fn get_sheet_count(&self) -> usize {
        self.inner.borrow().sheet_count()
    }

    /// Get all sheet names
    #[wasm_bindgen(js_name = "getSheetNames")]
    pub fn get_sheet_names(&self) -> js_sys::Array {
        let names = {
            let workbook = self.inner.borrow();
            workbook.sheet_names().to_vec()
        };
        let array = js_sys::Array::new();
        for name in names {
            array.push(&JsValue::from_str(&name));
        }
        array
    }

    /// Create a new sheet
    #[wasm_bindgen(js_name = "createSheet")]
    pub fn create_sheet(&mut self, name: &str) -> Result<(), JsValue> {
        self.inner
            .borrow_mut()
            .create_sheet(name)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Delete a sheet
    #[wasm_bindgen(js_name = "deleteSheet")]
    pub fn delete_sheet(&mut self, name: &str) -> Result<(), JsValue> {
        self.inner
            .borrow_mut()
            .delete_sheet(name)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Rename a sheet
    #[wasm_bindgen(js_name = "renameSheet")]
    pub fn rename_sheet(&mut self, old_name: &str, new_name: &str) -> Result<(), JsValue> {
        self.inner
            .borrow_mut()
            .rename_sheet(old_name, new_name)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Get the active sheet name
    #[wasm_bindgen(js_name = "getActiveSheetName")]
    pub fn get_active_sheet_name(&self) -> JsValue {
        match self.inner.borrow().active_sheet_name() {
            Some(name) => JsValue::from_str(name),
            None => JsValue::NULL,
        }
    }

    /// Set the active sheet
    #[wasm_bindgen(js_name = "setActiveSheet")]
    pub fn set_active_sheet(&mut self, name: &str) -> Result<(), JsValue> {
        self.inner
            .borrow_mut()
            .set_active_sheet(name)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Get a facade for a specific sheet
    #[wasm_bindgen(js_name = "getSheetFacade")]
    pub fn get_sheet_facade(&self, sheet_name: &str) -> Result<WasmSpreadsheetFacade, JsValue> {
        // Get the sheet's repositories
        let (cells, deps) = {
            let workbook = self.inner.borrow();
            let sheet = workbook
                .get_sheet(sheet_name)
                .ok_or_else(|| JsValue::from_str(&format!("Sheet '{}' not found", sheet_name)))?;
            (sheet.cells(), sheet.dependencies())
        };

        // Create a facade using the sheet's cell repository and dependencies
        let facade = crate::facade::SpreadsheetFacade::with_repositories(cells, deps);

        Ok(WasmSpreadsheetFacade::from_facade(Rc::new(facade)))
    }

    /// Get the active sheet's facade
    #[wasm_bindgen(js_name = "getActiveFacade")]
    pub fn get_active_facade(&self) -> Result<WasmSpreadsheetFacade, JsValue> {
        let active_name = {
            let workbook = self.inner.borrow();
            workbook
                .active_sheet_name()
                .ok_or_else(|| JsValue::from_str("No active sheet"))?
                .to_string()
        };

        self.get_sheet_facade(&active_name)
    }

    /// Copy a sheet
    #[wasm_bindgen(js_name = "copySheet")]
    pub fn copy_sheet(&mut self, source_name: &str, new_name: &str) -> Result<(), JsValue> {
        self.inner
            .borrow_mut()
            .copy_sheet(source_name, new_name)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Move a sheet to a different position
    #[wasm_bindgen(js_name = "moveSheet")]
    pub fn move_sheet(&mut self, sheet_name: &str, new_index: usize) -> Result<(), JsValue> {
        self.inner
            .borrow_mut()
            .move_sheet(sheet_name, new_index)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Get a cell value from a specific sheet
    #[wasm_bindgen(js_name = "getCellValue")]
    pub fn get_cell_value(&self, sheet_name: &str, address: &CellAddress) -> JsValue {
        match self.inner.borrow().get_cell_value(sheet_name, address) {
            Some(value) => value.to_js(),
            None => JsValue::UNDEFINED,
        }
    }

    /// Set a cell value in a specific sheet
    #[wasm_bindgen(js_name = "setCellValue")]
    pub fn set_cell_value(
        &mut self,
        sheet_name: &str,
        address: &CellAddress,
        value: &str,
    ) -> Result<(), JsValue> {
        // Parse the value string
        let cell_value = if value.starts_with('=') {
            // It's a formula
            CellValue::String(value.to_string())
        } else if let Ok(num) = value.parse::<f64>() {
            CellValue::Number(num)
        } else if value == "true" || value == "false" {
            CellValue::Boolean(value == "true")
        } else {
            CellValue::String(value.to_string())
        };

        let cell = Cell::new(cell_value);

        // Set the cell using the workbook's method
        self.inner
            .borrow_mut()
            .set_cell_value(sheet_name, address, cell)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
}

impl Default for WasmWorkbook {
    fn default() -> Self {
        Self::new()
    }
}

/// WASM wrapper for SheetManager (for advanced cross-sheet operations)
#[wasm_bindgen]
pub struct WasmSheetManager {
    inner: SheetManager,
}

#[wasm_bindgen]
impl WasmSheetManager {
    /// Create a new sheet manager
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: SheetManager::new(),
        }
    }

    /// Get workbook statistics
    #[wasm_bindgen(js_name = "getStatistics")]
    pub fn get_statistics(&self) -> JsValue {
        let stats = self.inner.get_statistics();
        let obj = js_sys::Object::new();

        let _ = js_sys::Reflect::set(
            &obj,
            &JsValue::from_str("sheetCount"),
            &JsValue::from_f64(stats.sheet_count as f64),
        );
        let _ = js_sys::Reflect::set(
            &obj,
            &JsValue::from_str("totalCells"),
            &JsValue::from_f64(stats.total_cells as f64),
        );
        let _ = js_sys::Reflect::set(
            &obj,
            &JsValue::from_str("formulaCells"),
            &JsValue::from_f64(stats.formula_cells as f64),
        );
        let _ = js_sys::Reflect::set(
            &obj,
            &JsValue::from_str("errorCells"),
            &JsValue::from_f64(stats.error_cells as f64),
        );

        obj.into()
    }
}

impl Default for WasmSheetManager {
    fn default() -> Self {
        Self::new()
    }
}
