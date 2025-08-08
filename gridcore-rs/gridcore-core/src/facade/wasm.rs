use crate::domain::cell::wasm_bindings::WasmCell;
use crate::facade::spreadsheet_facade::SpreadsheetFacade;
use crate::fill::wasm::{JsFillOperation, convert_fill_result, parse_fill_operation};
use crate::types::{CellAddress, CellValue, ToJs};
use js_sys::Function;
use std::cell::RefCell;
use std::rc::Rc;
use std::str::FromStr;
use wasm_bindgen::prelude::*;

/// WASM wrapper for SpreadsheetFacade
#[wasm_bindgen]
pub struct WasmSpreadsheetFacade {
    inner: Rc<SpreadsheetFacade>,
    #[wasm_bindgen(skip)]
    on_cell_update: RefCell<Option<Function>>,
    #[wasm_bindgen(skip)]
    on_batch_complete: RefCell<Option<Function>>,
    #[wasm_bindgen(skip)]
    on_calculation_complete: RefCell<Option<Function>>,
}

impl WasmSpreadsheetFacade {
    /// Create from an existing facade (used internally)
    pub fn from_facade(facade: Rc<SpreadsheetFacade>) -> Self {
        let on_cell_update = RefCell::new(None);
        let on_batch_complete = RefCell::new(None);
        let on_calculation_complete = RefCell::new(None);

        // Add event callback that bridges to JS
        let js_callback = JsEventBridge {
            on_cell_update: on_cell_update.clone(),
            on_batch_complete: on_batch_complete.clone(),
            on_calculation_complete: on_calculation_complete.clone(),
        };

        facade.add_event_callback(Box::new(js_callback));

        WasmSpreadsheetFacade {
            inner: facade,
            on_cell_update,
            on_batch_complete,
            on_calculation_complete,
        }
    }
}

#[wasm_bindgen]
impl WasmSpreadsheetFacade {
    /// Create a new spreadsheet facade
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        let facade = Rc::new(SpreadsheetFacade::new());

        // Create a wrapper for JS callbacks
        let _facade_clone = Rc::clone(&facade);
        let on_cell_update = RefCell::new(None);
        let on_batch_complete = RefCell::new(None);
        let on_calculation_complete = RefCell::new(None);

        // Add event callback that bridges to JS
        let js_callback = JsEventBridge {
            on_cell_update: on_cell_update.clone(),
            on_batch_complete: on_batch_complete.clone(),
            on_calculation_complete: on_calculation_complete.clone(),
        };

        facade.add_event_callback(Box::new(js_callback));

        WasmSpreadsheetFacade {
            inner: facade,
            on_cell_update,
            on_batch_complete,
            on_calculation_complete,
        }
    }

    /// Set the callback for cell update events
    #[wasm_bindgen(js_name = "onCellUpdate")]
    pub fn set_on_cell_update(&self, callback: Function) {
        *self.on_cell_update.borrow_mut() = Some(callback);
    }

    /// Set the callback for batch complete events
    #[wasm_bindgen(js_name = "onBatchComplete")]
    pub fn set_on_batch_complete(&self, callback: Function) {
        *self.on_batch_complete.borrow_mut() = Some(callback);
    }

    /// Set the callback for calculation complete events
    #[wasm_bindgen(js_name = "onCalculationComplete")]
    pub fn set_on_calculation_complete(&self, callback: Function) {
        *self.on_calculation_complete.borrow_mut() = Some(callback);
    }

    /// Set a cell value
    #[wasm_bindgen(js_name = "setCellValue")]
    pub fn set_cell_value(&self, address: &CellAddress, value: &str) -> Result<WasmCell, JsValue> {
        let cell = self
            .inner
            .set_cell_value(address, value)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        // Convert to WasmCell
        let wasm_cell = WasmCell::new(cell.get_computed_value().to_js())
            .map_err(|_| JsValue::from_str("Failed to create WasmCell"))?;

        Ok(wasm_cell)
    }

    /// Get a cell value
    #[wasm_bindgen(js_name = "getCellValue")]
    pub fn get_cell_value(&self, address: &CellAddress) -> Result<JsValue, JsValue> {
        let value = self
            .inner
            .get_cell_value(address)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        Ok(value.to_js())
    }

    /// Get a cell
    #[wasm_bindgen(js_name = "getCell")]
    pub fn get_cell(&self, address: &CellAddress) -> Option<WasmCell> {
        self.inner
            .get_cell(address)
            .and_then(|cell| WasmCell::new(cell.get_computed_value().to_js()).ok())
    }

    /// Get a cell formula
    #[wasm_bindgen(js_name = "getCellFormula")]
    pub fn get_cell_formula(&self, address: &CellAddress) -> Option<String> {
        self.inner.get_cell(address).and_then(|cell| {
            // Check if raw_value is a string starting with "="
            if let CellValue::String(s) = &cell.raw_value {
                if s.starts_with('=') {
                    return Some(s.clone());
                }
            }
            None
        })
    }

    /// Delete a cell
    #[wasm_bindgen(js_name = "deleteCell")]
    pub fn delete_cell(&self, address: &CellAddress) -> Result<(), JsValue> {
        self.inner
            .delete_cell(address)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Clear a cell (sets it to empty but keeps the cell)
    #[wasm_bindgen(js_name = "clearCell")]
    pub fn clear_cell(&self, address: &CellAddress) -> Result<(), JsValue> {
        // Set the cell to an empty value
        self.inner
            .set_cell_value(address, "")
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        Ok(())
    }

    /// Recalculate all cells
    #[wasm_bindgen(js_name = "recalculate")]
    pub fn recalculate(&self) -> Result<(), JsValue> {
        self.inner
            .recalculate()
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Recalculate a specific cell
    #[wasm_bindgen(js_name = "recalculateCell")]
    pub fn recalculate_cell(&self, address: &CellAddress) -> Result<WasmCell, JsValue> {
        let cell = self
            .inner
            .recalculate_cell(address)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        WasmCell::new(cell.get_computed_value().to_js())
            .map_err(|_| JsValue::from_str("Failed to create WasmCell"))
    }

    /// Begin a batch operation
    #[wasm_bindgen(js_name = "beginBatch")]
    pub fn begin_batch(&self, batch_id: Option<String>) -> String {
        self.inner.begin_batch(batch_id)
    }

    /// Commit a batch operation
    #[wasm_bindgen(js_name = "commitBatch")]
    pub fn commit_batch(&self, batch_id: &str) -> Result<(), JsValue> {
        self.inner
            .commit_batch(batch_id)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Rollback a batch operation
    #[wasm_bindgen(js_name = "rollbackBatch")]
    pub fn rollback_batch(&self, batch_id: &str) -> Result<(), JsValue> {
        self.inner
            .rollback_batch(batch_id)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Clear all cells
    #[wasm_bindgen]
    pub fn clear(&self) {
        self.inner.clear();
    }

    /// Get the number of cells
    #[wasm_bindgen(js_name = "getCellCount")]
    pub fn get_cell_count(&self) -> usize {
        self.inner.get_cell_count()
    }

    /// Perform a fill operation
    #[wasm_bindgen(js_name = "fill")]
    pub fn fill(&self, operation_js: JsValue) -> Result<JsValue, JsValue> {
        // Parse the fill operation from JS
        let operation: JsFillOperation = serde_wasm_bindgen::from_value(operation_js)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse fill operation: {}", e)))?;

        // Convert to internal fill operation
        let fill_operation = parse_fill_operation(operation).map_err(|e| JsValue::from_str(&e))?;

        // Perform the fill
        let result = self
            .inner
            .fill(&fill_operation)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        // Convert result to JS
        let js_result = convert_fill_result(result);
        serde_wasm_bindgen::to_value(&js_result)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize result: {}", e)))
    }

    /// Preview a fill operation without applying it
    #[wasm_bindgen(js_name = "previewFill")]
    pub fn preview_fill(&self, operation_js: JsValue) -> Result<JsValue, JsValue> {
        // Parse the fill operation from JS
        let operation: JsFillOperation = serde_wasm_bindgen::from_value(operation_js)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse fill operation: {}", e)))?;

        // Convert to internal fill operation
        let fill_operation = parse_fill_operation(operation).map_err(|e| JsValue::from_str(&e))?;

        // Preview the fill
        let preview = self
            .inner
            .preview_fill(&fill_operation)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        // Convert preview to JS
        use crate::fill::wasm::JsAffectedCell;
        let js_preview: Vec<JsAffectedCell> = preview
            .into_iter()
            .map(|(addr, value)| JsAffectedCell {
                col: addr.col,
                row: addr.row,
                value: value.into(),
            })
            .collect();

        serde_wasm_bindgen::to_value(&js_preview)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize preview: {}", e)))
    }

    /// Set multiple cell values in a batch
    #[wasm_bindgen(js_name = "setCellValues")]
    pub fn set_cell_values(&self, updates: JsValue) -> Result<(), JsValue> {
        // Parse the JS object containing cell updates
        let updates_obj = js_sys::Object::from(updates);
        let entries = js_sys::Object::entries(&updates_obj);

        // Begin a batch
        let batch_id = self.inner.begin_batch(None);

        // Process each update
        for i in 0..entries.length() {
            let entry = entries.get(i);
            if let Some(entry_array) = entry.dyn_ref::<js_sys::Array>() {
                if entry_array.length() >= 2 {
                    let address_str = entry_array
                        .get(0)
                        .as_string()
                        .ok_or_else(|| JsValue::from_str("Invalid address in updates"))?;
                    let value = entry_array
                        .get(1)
                        .as_string()
                        .unwrap_or_else(|| String::new());

                    // Parse address
                    let address = crate::types::CellAddress::from_str(&address_str)
                        .map_err(|e| JsValue::from_str(&e.to_string()))?;

                    // Set the cell value (will be queued in batch)
                    self.inner
                        .set_cell_value(&address, &value)
                        .map_err(|e| JsValue::from_str(&e.to_string()))?;
                }
            }
        }

        // Commit the batch
        self.inner
            .commit_batch(&batch_id)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Insert a row at the specified index
    #[wasm_bindgen(js_name = "insertRow")]
    pub fn insert_row(&self, row_index: u32) -> Result<(), JsValue> {
        self.inner
            .insert_row(row_index)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Delete a row at the specified index
    #[wasm_bindgen(js_name = "deleteRow")]
    pub fn delete_row(&self, row_index: u32) -> Result<(), JsValue> {
        self.inner
            .delete_row(row_index)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Insert a column at the specified index
    #[wasm_bindgen(js_name = "insertColumn")]
    pub fn insert_column(&self, col_index: u32) -> Result<(), JsValue> {
        self.inner
            .insert_column(col_index)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Delete a column at the specified index
    #[wasm_bindgen(js_name = "deleteColumn")]
    pub fn delete_column(&self, col_index: u32) -> Result<(), JsValue> {
        self.inner
            .delete_column(col_index)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Undo the last operation
    #[wasm_bindgen(js_name = "undo")]
    pub fn undo(&self) -> Result<(), JsValue> {
        self.inner
            .undo()
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Redo the last undone operation
    #[wasm_bindgen(js_name = "redo")]
    pub fn redo(&self) -> Result<(), JsValue> {
        self.inner
            .redo()
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Check if undo is available
    #[wasm_bindgen(js_name = "canUndo")]
    pub fn can_undo(&self) -> bool {
        self.inner.can_undo()
    }

    /// Check if redo is available
    #[wasm_bindgen(js_name = "canRedo")]
    pub fn can_redo(&self) -> bool {
        self.inner.can_redo()
    }

    /// Get undo history descriptions
    #[wasm_bindgen(js_name = "getUndoHistory")]
    pub fn get_undo_history(&self) -> Result<js_sys::Array, JsValue> {
        let history = self.inner.get_undo_history();
        let array = js_sys::Array::new();
        for desc in history {
            array.push(&JsValue::from_str(&desc));
        }
        Ok(array)
    }

    /// Get redo history descriptions
    #[wasm_bindgen(js_name = "getRedoHistory")]
    pub fn get_redo_history(&self) -> Result<js_sys::Array, JsValue> {
        let history = self.inner.get_redo_history();
        let array = js_sys::Array::new();
        for desc in history {
            array.push(&JsValue::from_str(&desc));
        }
        Ok(array)
    }

    /// Clear undo/redo history
    #[wasm_bindgen(js_name = "clearHistory")]
    pub fn clear_history(&self) {
        self.inner.clear_history();
    }
}

impl Default for WasmSpreadsheetFacade {
    fn default() -> Self {
        Self::new()
    }
}

/// Bridge between Rust events and JavaScript callbacks
struct JsEventBridge {
    on_cell_update: RefCell<Option<Function>>,
    on_batch_complete: RefCell<Option<Function>>,
    on_calculation_complete: RefCell<Option<Function>>,
}

impl crate::facade::EventCallback for JsEventBridge {
    fn on_event(&self, event: &crate::facade::SpreadsheetEvent) {
        // Convert event to JS object
        let js_event = serde_wasm_bindgen::to_value(event).unwrap_or(JsValue::NULL);

        // Call appropriate callback based on event type
        match event.event_type {
            crate::facade::EventType::CellUpdated | crate::facade::EventType::CellsUpdated => {
                if let Some(callback) = self.on_cell_update.borrow().as_ref() {
                    let _ = callback.call1(&JsValue::NULL, &js_event);
                }
            }
            crate::facade::EventType::BatchCompleted => {
                if let Some(callback) = self.on_batch_complete.borrow().as_ref() {
                    let _ = callback.call1(&JsValue::NULL, &js_event);
                }
            }
            crate::facade::EventType::CalculationCompleted => {
                if let Some(callback) = self.on_calculation_complete.borrow().as_ref() {
                    let _ = callback.call1(&JsValue::NULL, &js_event);
                }
            }
            _ => {
                // Call cell update for other events as a fallback
                if let Some(callback) = self.on_cell_update.borrow().as_ref() {
                    let _ = callback.call1(&JsValue::NULL, &js_event);
                }
            }
        }
    }
}
