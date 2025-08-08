use crate::facade::{BatchOperation, SpreadsheetFacade};
use crate::fill::FillOperation;
use crate::types::{CellAddress, CellValue};
use js_sys::Function;
use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;
use std::sync::atomic::{AtomicU32, Ordering};
use wasm_bindgen::prelude::*;

// Global storage for facade instances
thread_local! {
    pub(super) static FACADE_STORAGE: RefCell<HashMap<u32, Rc<SpreadsheetFacade>>> = RefCell::new(HashMap::new());
    pub(super) static EVENT_CALLBACKS: RefCell<HashMap<u32, EventCallbacks>> = RefCell::new(HashMap::new());
}

// ID generator for facade instances
pub(super) static NEXT_FACADE_ID: AtomicU32 = AtomicU32::new(1);

// Event callback storage
pub(super) struct EventCallbacks {
    pub(super) on_cell_update: Option<Function>,
    pub(super) on_batch_complete: Option<Function>,
    pub(super) on_calculation_complete: Option<Function>,
}

/// Create a new spreadsheet facade instance
#[wasm_bindgen(js_name = "createFacade")]
pub fn create_facade() -> u32 {
    let facade = Rc::new(SpreadsheetFacade::new());
    let id = NEXT_FACADE_ID.fetch_add(1, Ordering::SeqCst);

    // Store the facade
    FACADE_STORAGE.with(|storage| {
        storage.borrow_mut().insert(id, facade.clone());
    });

    // Initialize empty callbacks
    EVENT_CALLBACKS.with(|callbacks| {
        callbacks.borrow_mut().insert(
            id,
            EventCallbacks {
                on_cell_update: None,
                on_batch_complete: None,
                on_calculation_complete: None,
            },
        );
    });

    // Set up event bridge
    let facade_id = id;

    struct JsEventBridge {
        facade_id: u32,
    }

    impl crate::facade::EventCallback for JsEventBridge {
        fn on_event(&self, event: &crate::facade::SpreadsheetEvent) {
            EVENT_CALLBACKS.with(|callbacks| {
                if let Some(cbs) = callbacks.borrow().get(&self.facade_id) {
                    let js_event = serde_wasm_bindgen::to_value(event).unwrap_or(JsValue::NULL);

                    match event.event_type {
                        crate::facade::EventType::CellUpdated
                        | crate::facade::EventType::CellsUpdated => {
                            if let Some(ref callback) = cbs.on_cell_update {
                                let _ = callback.call1(&JsValue::NULL, &js_event);
                            }
                        }
                        crate::facade::EventType::BatchCompleted => {
                            if let Some(ref callback) = cbs.on_batch_complete {
                                let _ = callback.call1(&JsValue::NULL, &js_event);
                            }
                        }
                        crate::facade::EventType::CalculationCompleted => {
                            if let Some(ref callback) = cbs.on_calculation_complete {
                                let _ = callback.call1(&JsValue::NULL, &js_event);
                            }
                        }
                        _ => {
                            if let Some(ref callback) = cbs.on_cell_update {
                                let _ = callback.call1(&JsValue::NULL, &js_event);
                            }
                        }
                    }
                }
            });
        }
    }

    facade.add_event_callback(Box::new(JsEventBridge { facade_id }));

    id
}

/// Destroy a facade instance and free its resources
#[wasm_bindgen(js_name = "destroyFacade")]
pub fn destroy_facade(facade_id: u32) {
    FACADE_STORAGE.with(|storage| {
        storage.borrow_mut().remove(&facade_id);
    });
    EVENT_CALLBACKS.with(|callbacks| {
        callbacks.borrow_mut().remove(&facade_id);
    });
}

/// Set the cell update callback
#[wasm_bindgen(js_name = "facadeSetOnCellUpdate")]
pub fn facade_set_on_cell_update(facade_id: u32, callback: Function) {
    EVENT_CALLBACKS.with(|callbacks| {
        if let Some(cbs) = callbacks.borrow_mut().get_mut(&facade_id) {
            cbs.on_cell_update = Some(callback);
        }
    });
}

/// Set the batch complete callback
#[wasm_bindgen(js_name = "facadeSetOnBatchComplete")]
pub fn facade_set_on_batch_complete(facade_id: u32, callback: Function) {
    EVENT_CALLBACKS.with(|callbacks| {
        if let Some(cbs) = callbacks.borrow_mut().get_mut(&facade_id) {
            cbs.on_batch_complete = Some(callback);
        }
    });
}

/// Set the calculation complete callback
#[wasm_bindgen(js_name = "facadeSetOnCalculationComplete")]
pub fn facade_set_on_calculation_complete(facade_id: u32, callback: Function) {
    EVENT_CALLBACKS.with(|callbacks| {
        if let Some(cbs) = callbacks.borrow_mut().get_mut(&facade_id) {
            cbs.on_calculation_complete = Some(callback);
        }
    });
}

/// Set a cell value
#[wasm_bindgen(js_name = "facadeSetCellValue")]
pub fn facade_set_cell_value(
    facade_id: u32,
    address: &CellAddress,
    value: &str,
) -> Result<JsValue, JsValue> {
    FACADE_STORAGE.with(|storage| {
        let facades = storage.borrow();
        let facade = facades
            .get(&facade_id)
            .ok_or_else(|| JsValue::from_str("Invalid facade ID"))?;

        let cell = facade
            .set_cell_value(address, value)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        // Convert cell to JS using serde
        serde_wasm_bindgen::to_value(&cell)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize cell: {}", e)))
    })
}

/// Get a cell value
#[wasm_bindgen(js_name = "facadeGetCellValue")]
pub fn facade_get_cell_value(facade_id: u32, address: &CellAddress) -> Result<JsValue, JsValue> {
    FACADE_STORAGE.with(|storage| {
        let facades = storage.borrow();
        let facade = facades
            .get(&facade_id)
            .ok_or_else(|| JsValue::from_str("Invalid facade ID"))?;

        let value = facade
            .get_cell_value(address)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        Ok(value.to_js())
    })
}

/// Get a cell
#[wasm_bindgen(js_name = "facadeGetCell")]
pub fn facade_get_cell(facade_id: u32, address: &CellAddress) -> Result<JsValue, JsValue> {
    FACADE_STORAGE.with(|storage| {
        let facades = storage.borrow();
        let facade = facades
            .get(&facade_id)
            .ok_or_else(|| JsValue::from_str("Invalid facade ID"))?;

        match facade.get_cell(address) {
            Some(cell) => serde_wasm_bindgen::to_value(&cell)
                .map_err(|e| JsValue::from_str(&format!("Failed to serialize cell: {}", e))),
            None => Ok(JsValue::NULL),
        }
    })
}

/// Get a cell formula
#[wasm_bindgen(js_name = "facadeGetCellFormula")]
pub fn facade_get_cell_formula(facade_id: u32, address: &CellAddress) -> Result<JsValue, JsValue> {
    FACADE_STORAGE.with(|storage| {
        let facades = storage.borrow();
        let facade = facades
            .get(&facade_id)
            .ok_or_else(|| JsValue::from_str("Invalid facade ID"))?;

        let formula = facade.get_cell(address).and_then(|cell| {
            if let CellValue::String(s) = &cell.raw_value {
                if s.starts_with('=') {
                    return Some(s.clone());
                }
            }
            None
        });

        match formula {
            Some(f) => Ok(JsValue::from_str(&f)),
            None => Ok(JsValue::NULL),
        }
    })
}

/// Delete a cell
#[wasm_bindgen(js_name = "facadeDeleteCell")]
pub fn facade_delete_cell(facade_id: u32, address: &CellAddress) -> Result<(), JsValue> {
    FACADE_STORAGE.with(|storage| {
        let facades = storage.borrow();
        let facade = facades
            .get(&facade_id)
            .ok_or_else(|| JsValue::from_str("Invalid facade ID"))?;

        facade
            .delete_cell(address)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    })
}

/// Clear a cell
#[wasm_bindgen(js_name = "facadeClearCell")]
pub fn facade_clear_cell(facade_id: u32, address: &CellAddress) -> Result<(), JsValue> {
    FACADE_STORAGE.with(|storage| {
        let facades = storage.borrow();
        let facade = facades
            .get(&facade_id)
            .ok_or_else(|| JsValue::from_str("Invalid facade ID"))?;

        facade
            .set_cell_value(address, "")
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        Ok(())
    })
}

/// Recalculate all cells
#[wasm_bindgen(js_name = "facadeRecalculate")]
pub fn facade_recalculate(facade_id: u32) -> Result<(), JsValue> {
    FACADE_STORAGE.with(|storage| {
        let facades = storage.borrow();
        let facade = facades
            .get(&facade_id)
            .ok_or_else(|| JsValue::from_str("Invalid facade ID"))?;

        facade
            .recalculate()
            .map_err(|e| JsValue::from_str(&e.to_string()))
    })
}

/// Recalculate a specific cell
#[wasm_bindgen(js_name = "facadeRecalculateCell")]
pub fn facade_recalculate_cell(facade_id: u32, address: &CellAddress) -> Result<JsValue, JsValue> {
    FACADE_STORAGE.with(|storage| {
        let facades = storage.borrow();
        let facade = facades
            .get(&facade_id)
            .ok_or_else(|| JsValue::from_str("Invalid facade ID"))?;

        let cell = facade
            .recalculate_cell(address)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        serde_wasm_bindgen::to_value(&cell)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize cell: {}", e)))
    })
}

/// Begin a batch operation
#[wasm_bindgen(js_name = "facadeBeginBatch")]
pub fn facade_begin_batch(facade_id: u32, batch_id: Option<String>) -> Result<String, JsValue> {
    FACADE_STORAGE.with(|storage| {
        let facades = storage.borrow();
        let facade = facades
            .get(&facade_id)
            .ok_or_else(|| JsValue::from_str("Invalid facade ID"))?;

        Ok(facade.begin_batch(batch_id))
    })
}

/// Commit a batch operation
#[wasm_bindgen(js_name = "facadeCommitBatch")]
pub fn facade_commit_batch(facade_id: u32, batch_id: &str) -> Result<(), JsValue> {
    FACADE_STORAGE.with(|storage| {
        let facades = storage.borrow();
        let facade = facades
            .get(&facade_id)
            .ok_or_else(|| JsValue::from_str("Invalid facade ID"))?;

        facade
            .commit_batch(batch_id)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    })
}

/// Rollback a batch operation
#[wasm_bindgen(js_name = "facadeRollbackBatch")]
pub fn facade_rollback_batch(facade_id: u32, batch_id: &str) -> Result<(), JsValue> {
    FACADE_STORAGE.with(|storage| {
        let facades = storage.borrow();
        let facade = facades
            .get(&facade_id)
            .ok_or_else(|| JsValue::from_str("Invalid facade ID"))?;

        facade
            .rollback_batch(batch_id)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    })
}

/// Clear all cells
#[wasm_bindgen(js_name = "facadeClear")]
pub fn facade_clear(facade_id: u32) -> Result<(), JsValue> {
    FACADE_STORAGE.with(|storage| {
        let facades = storage.borrow();
        let facade = facades
            .get(&facade_id)
            .ok_or_else(|| JsValue::from_str("Invalid facade ID"))?;

        facade.clear();
        Ok(())
    })
}

/// Get the number of cells
#[wasm_bindgen(js_name = "facadeGetCellCount")]
pub fn facade_get_cell_count(facade_id: u32) -> Result<usize, JsValue> {
    FACADE_STORAGE.with(|storage| {
        let facades = storage.borrow();
        let facade = facades
            .get(&facade_id)
            .ok_or_else(|| JsValue::from_str("Invalid facade ID"))?;

        Ok(facade.get_cell_count())
    })
}

/// Perform a fill operation
#[wasm_bindgen(js_name = "facadeFill")]
pub fn facade_fill(facade_id: u32, operation_js: JsValue) -> Result<JsValue, JsValue> {
    FACADE_STORAGE.with(|storage| {
        let facades = storage.borrow();
        let facade = facades
            .get(&facade_id)
            .ok_or_else(|| JsValue::from_str("Invalid facade ID"))?;

        // Parse the fill operation from JS
        let fill_operation: FillOperation = serde_wasm_bindgen::from_value(operation_js)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse fill operation: {}", e)))?;

        // Perform the fill
        let result = facade
            .fill(&fill_operation)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        // Convert result to JS
        serde_wasm_bindgen::to_value(&result)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize result: {}", e)))
    })
}

/// Preview a fill operation
#[wasm_bindgen(js_name = "facadePreviewFill")]
pub fn facade_preview_fill(facade_id: u32, operation_js: JsValue) -> Result<JsValue, JsValue> {
    FACADE_STORAGE.with(|storage| {
        let facades = storage.borrow();
        let facade = facades
            .get(&facade_id)
            .ok_or_else(|| JsValue::from_str("Invalid facade ID"))?;

        // Parse the fill operation from JS
        let fill_operation: FillOperation = serde_wasm_bindgen::from_value(operation_js)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse fill operation: {}", e)))?;

        // Preview the fill
        let preview = facade
            .preview_fill(&fill_operation)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        // Convert preview to JS
        serde_wasm_bindgen::to_value(&preview)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize preview: {}", e)))
    })
}

/// Execute batch operations
#[wasm_bindgen(js_name = "facadeExecuteBatchOperations")]
pub fn facade_execute_batch_operations(
    facade_id: u32,
    operations: JsValue,
) -> Result<JsValue, JsValue> {
    FACADE_STORAGE.with(|storage| {
        let facades = storage.borrow();
        let facade = facades
            .get(&facade_id)
            .ok_or_else(|| JsValue::from_str("Invalid facade ID"))?;

        // Deserialize batch operations from JS
        let operations: Vec<BatchOperation> = serde_wasm_bindgen::from_value(operations)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse batch operations: {}", e)))?;

        // Begin a batch
        let batch_id = facade.begin_batch(None);
        let mut results = Vec::new();

        // Execute each operation
        for op in operations {
            let result = match op {
                BatchOperation::SetCell {
                    address,
                    value,
                    formula: _,
                } => {
                    let value_str = value.to_display_string();
                    facade
                        .set_cell_value(&address, &value_str)
                        .map(|_| ("set_cell", address.to_a1()))
                }
                BatchOperation::DeleteCell { address } => facade
                    .delete_cell(&address)
                    .map(|_| ("delete_cell", address.to_a1())),
                BatchOperation::SetRange { start, end, values } => {
                    let mut count = 0;
                    for (row_idx, row) in values.iter().enumerate() {
                        for (col_idx, value) in row.iter().enumerate() {
                            let addr = CellAddress::new(
                                start.col + col_idx as u32,
                                start.row + row_idx as u32,
                            );
                            if addr.col <= end.col && addr.row <= end.row {
                                let value_str = value.to_display_string();
                                facade.set_cell_value(&addr, &value_str).ok();
                                count += 1;
                            }
                        }
                    }
                    Ok((
                        "set_range",
                        format!("{}:{} ({} cells)", start.to_a1(), end.to_a1(), count),
                    ))
                }
                BatchOperation::DeleteRange { start, end } => {
                    let mut count = 0;
                    for row in start.row..=end.row {
                        for col in start.col..=end.col {
                            let addr = CellAddress::new(col, row);
                            facade.delete_cell(&addr).ok();
                            count += 1;
                        }
                    }
                    Ok((
                        "delete_range",
                        format!("{}:{} ({} cells)", start.to_a1(), end.to_a1(), count),
                    ))
                }
            };

            match result {
                Ok((op_type, detail)) => results.push(serde_json::json!({
                    "success": true,
                    "operation": op_type,
                    "detail": detail
                })),
                Err(e) => results.push(serde_json::json!({
                    "success": false,
                    "error": e.to_string()
                })),
            }
        }

        // Commit the batch
        facade
            .commit_batch(&batch_id)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        // Return results
        serde_wasm_bindgen::to_value(&results)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize results: {}", e)))
    })
}

/// Structural operations
#[wasm_bindgen(js_name = "facadeInsertRow")]
pub fn facade_insert_row(facade_id: u32, row_index: u32) -> Result<(), JsValue> {
    FACADE_STORAGE.with(|storage| {
        let facades = storage.borrow();
        let facade = facades
            .get(&facade_id)
            .ok_or_else(|| JsValue::from_str("Invalid facade ID"))?;

        facade
            .insert_row(row_index)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    })
}

#[wasm_bindgen(js_name = "facadeDeleteRow")]
pub fn facade_delete_row(facade_id: u32, row_index: u32) -> Result<(), JsValue> {
    FACADE_STORAGE.with(|storage| {
        let facades = storage.borrow();
        let facade = facades
            .get(&facade_id)
            .ok_or_else(|| JsValue::from_str("Invalid facade ID"))?;

        facade
            .delete_row(row_index)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    })
}

#[wasm_bindgen(js_name = "facadeInsertColumn")]
pub fn facade_insert_column(facade_id: u32, col_index: u32) -> Result<(), JsValue> {
    FACADE_STORAGE.with(|storage| {
        let facades = storage.borrow();
        let facade = facades
            .get(&facade_id)
            .ok_or_else(|| JsValue::from_str("Invalid facade ID"))?;

        facade
            .insert_column(col_index)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    })
}

#[wasm_bindgen(js_name = "facadeDeleteColumn")]
pub fn facade_delete_column(facade_id: u32, col_index: u32) -> Result<(), JsValue> {
    FACADE_STORAGE.with(|storage| {
        let facades = storage.borrow();
        let facade = facades
            .get(&facade_id)
            .ok_or_else(|| JsValue::from_str("Invalid facade ID"))?;

        facade
            .delete_column(col_index)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    })
}

/// Undo/Redo operations
#[wasm_bindgen(js_name = "facadeUndo")]
pub fn facade_undo(facade_id: u32) -> Result<(), JsValue> {
    FACADE_STORAGE.with(|storage| {
        let facades = storage.borrow();
        let facade = facades
            .get(&facade_id)
            .ok_or_else(|| JsValue::from_str("Invalid facade ID"))?;

        facade.undo().map_err(|e| JsValue::from_str(&e.to_string()))
    })
}

#[wasm_bindgen(js_name = "facadeRedo")]
pub fn facade_redo(facade_id: u32) -> Result<(), JsValue> {
    FACADE_STORAGE.with(|storage| {
        let facades = storage.borrow();
        let facade = facades
            .get(&facade_id)
            .ok_or_else(|| JsValue::from_str("Invalid facade ID"))?;

        facade.redo().map_err(|e| JsValue::from_str(&e.to_string()))
    })
}

#[wasm_bindgen(js_name = "facadeCanUndo")]
pub fn facade_can_undo(facade_id: u32) -> Result<bool, JsValue> {
    FACADE_STORAGE.with(|storage| {
        let facades = storage.borrow();
        let facade = facades
            .get(&facade_id)
            .ok_or_else(|| JsValue::from_str("Invalid facade ID"))?;

        Ok(facade.can_undo())
    })
}

#[wasm_bindgen(js_name = "facadeCanRedo")]
pub fn facade_can_redo(facade_id: u32) -> Result<bool, JsValue> {
    FACADE_STORAGE.with(|storage| {
        let facades = storage.borrow();
        let facade = facades
            .get(&facade_id)
            .ok_or_else(|| JsValue::from_str("Invalid facade ID"))?;

        Ok(facade.can_redo())
    })
}

#[wasm_bindgen(js_name = "facadeGetUndoHistory")]
pub fn facade_get_undo_history(facade_id: u32) -> Result<js_sys::Array, JsValue> {
    FACADE_STORAGE.with(|storage| {
        let facades = storage.borrow();
        let facade = facades
            .get(&facade_id)
            .ok_or_else(|| JsValue::from_str("Invalid facade ID"))?;

        let history = facade.get_undo_history();
        let array = js_sys::Array::new();
        for desc in history {
            array.push(&JsValue::from_str(&desc));
        }
        Ok(array)
    })
}

#[wasm_bindgen(js_name = "facadeGetRedoHistory")]
pub fn facade_get_redo_history(facade_id: u32) -> Result<js_sys::Array, JsValue> {
    FACADE_STORAGE.with(|storage| {
        let facades = storage.borrow();
        let facade = facades
            .get(&facade_id)
            .ok_or_else(|| JsValue::from_str("Invalid facade ID"))?;

        let history = facade.get_redo_history();
        let array = js_sys::Array::new();
        for desc in history {
            array.push(&JsValue::from_str(&desc));
        }
        Ok(array)
    })
}

#[wasm_bindgen(js_name = "facadeClearHistory")]
pub fn facade_clear_history(facade_id: u32) -> Result<(), JsValue> {
    FACADE_STORAGE.with(|storage| {
        let facades = storage.borrow();
        let facade = facades
            .get(&facade_id)
            .ok_or_else(|| JsValue::from_str("Invalid facade ID"))?;

        facade.clear_history();
        Ok(())
    })
}
