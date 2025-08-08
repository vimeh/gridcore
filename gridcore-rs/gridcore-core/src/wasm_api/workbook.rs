use crate::facade::SpreadsheetFacade;
use crate::types::{CellAddress, CellValue};
use crate::workbook::Workbook;
use crate::domain::Cell;
use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;
use std::sync::atomic::{AtomicU32, Ordering};
use wasm_bindgen::prelude::*;

// Global storage for workbook instances
thread_local! {
    static WORKBOOK_STORAGE: RefCell<HashMap<u32, RefCell<Workbook>>> = RefCell::new(HashMap::new());
}

// ID generator for workbook instances
static NEXT_WORKBOOK_ID: AtomicU32 = AtomicU32::new(1);

/// Create a new workbook with default sheet
#[wasm_bindgen(js_name = "createWorkbook")]
pub fn create_workbook() -> u32 {
    let workbook = RefCell::new(Workbook::with_sheet("Sheet1"));
    let id = NEXT_WORKBOOK_ID.fetch_add(1, Ordering::SeqCst);
    
    WORKBOOK_STORAGE.with(|storage| {
        storage.borrow_mut().insert(id, workbook);
    });
    
    id
}

/// Create a new workbook with a named sheet
#[wasm_bindgen(js_name = "createWorkbookWithSheet")]
pub fn create_workbook_with_sheet(sheet_name: &str) -> u32 {
    let workbook = RefCell::new(Workbook::with_sheet(sheet_name));
    let id = NEXT_WORKBOOK_ID.fetch_add(1, Ordering::SeqCst);
    
    WORKBOOK_STORAGE.with(|storage| {
        storage.borrow_mut().insert(id, workbook);
    });
    
    id
}

/// Destroy a workbook instance and free its resources
#[wasm_bindgen(js_name = "destroyWorkbook")]
pub fn destroy_workbook(workbook_id: u32) {
    WORKBOOK_STORAGE.with(|storage| {
        storage.borrow_mut().remove(&workbook_id);
    });
}

/// Get the number of sheets
#[wasm_bindgen(js_name = "workbookGetSheetCount")]
pub fn workbook_get_sheet_count(workbook_id: u32) -> Result<usize, JsValue> {
    WORKBOOK_STORAGE.with(|storage| {
        let workbooks = storage.borrow();
        let workbook = workbooks.get(&workbook_id)
            .ok_or_else(|| JsValue::from_str("Invalid workbook ID"))?;
        
        Ok(workbook.borrow().sheet_count())
    })
}

/// Get all sheet names
#[wasm_bindgen(js_name = "workbookGetSheetNames")]
pub fn workbook_get_sheet_names(workbook_id: u32) -> Result<js_sys::Array, JsValue> {
    WORKBOOK_STORAGE.with(|storage| {
        let workbooks = storage.borrow();
        let workbook = workbooks.get(&workbook_id)
            .ok_or_else(|| JsValue::from_str("Invalid workbook ID"))?;
        
        let names = workbook.borrow().sheet_names().to_vec();
        let array = js_sys::Array::new();
        for name in names {
            array.push(&JsValue::from_str(&name));
        }
        Ok(array)
    })
}

/// Create a new sheet
#[wasm_bindgen(js_name = "workbookCreateSheet")]
pub fn workbook_create_sheet(workbook_id: u32, name: &str) -> Result<(), JsValue> {
    WORKBOOK_STORAGE.with(|storage| {
        let workbooks = storage.borrow();
        let workbook = workbooks.get(&workbook_id)
            .ok_or_else(|| JsValue::from_str("Invalid workbook ID"))?;
        
        workbook.borrow_mut().create_sheet(name)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    })
}

/// Delete a sheet
#[wasm_bindgen(js_name = "workbookDeleteSheet")]
pub fn workbook_delete_sheet(workbook_id: u32, name: &str) -> Result<(), JsValue> {
    WORKBOOK_STORAGE.with(|storage| {
        let workbooks = storage.borrow();
        let workbook = workbooks.get(&workbook_id)
            .ok_or_else(|| JsValue::from_str("Invalid workbook ID"))?;
        
        workbook.borrow_mut().delete_sheet(name)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    })
}

/// Rename a sheet
#[wasm_bindgen(js_name = "workbookRenameSheet")]
pub fn workbook_rename_sheet(workbook_id: u32, old_name: &str, new_name: &str) -> Result<(), JsValue> {
    WORKBOOK_STORAGE.with(|storage| {
        let workbooks = storage.borrow();
        let workbook = workbooks.get(&workbook_id)
            .ok_or_else(|| JsValue::from_str("Invalid workbook ID"))?;
        
        workbook.borrow_mut().rename_sheet(old_name, new_name)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    })
}

/// Get the active sheet name
#[wasm_bindgen(js_name = "workbookGetActiveSheetName")]
pub fn workbook_get_active_sheet_name(workbook_id: u32) -> Result<JsValue, JsValue> {
    WORKBOOK_STORAGE.with(|storage| {
        let workbooks = storage.borrow();
        let workbook = workbooks.get(&workbook_id)
            .ok_or_else(|| JsValue::from_str("Invalid workbook ID"))?;
        
        match workbook.borrow().active_sheet_name() {
            Some(name) => Ok(JsValue::from_str(name)),
            None => Ok(JsValue::NULL),
        }
    })
}

/// Set the active sheet
#[wasm_bindgen(js_name = "workbookSetActiveSheet")]
pub fn workbook_set_active_sheet(workbook_id: u32, name: &str) -> Result<(), JsValue> {
    WORKBOOK_STORAGE.with(|storage| {
        let workbooks = storage.borrow();
        let workbook = workbooks.get(&workbook_id)
            .ok_or_else(|| JsValue::from_str("Invalid workbook ID"))?;
        
        workbook.borrow_mut().set_active_sheet(name)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    })
}

/// Get a facade for a specific sheet
#[wasm_bindgen(js_name = "workbookGetSheetFacade")]
pub fn workbook_get_sheet_facade(workbook_id: u32, sheet_name: &str) -> Result<u32, JsValue> {
    WORKBOOK_STORAGE.with(|storage| {
        let workbooks = storage.borrow();
        let workbook = workbooks.get(&workbook_id)
            .ok_or_else(|| JsValue::from_str("Invalid workbook ID"))?;
        
        // Get the sheet's repositories
        let (cells, deps) = {
            let wb = workbook.borrow();
            let sheet = wb.get_sheet(sheet_name)
                .ok_or_else(|| JsValue::from_str(&format!("Sheet '{}' not found", sheet_name)))?;
            (sheet.cells(), sheet.dependencies())
        };
        
        // Create a facade using the sheet's cell repository and dependencies
        let facade = Rc::new(SpreadsheetFacade::with_repositories(cells, deps));
        
        // Store the facade using the facade API's storage
        let facade_id = super::facade::NEXT_FACADE_ID.fetch_add(1, Ordering::SeqCst);
        
        super::facade::FACADE_STORAGE.with(|storage| {
            storage.borrow_mut().insert(facade_id, facade.clone());
        });
        
        // Initialize empty callbacks for this facade
        super::facade::EVENT_CALLBACKS.with(|callbacks| {
            callbacks.borrow_mut().insert(facade_id, super::facade::EventCallbacks {
                on_cell_update: None,
                on_batch_complete: None,
                on_calculation_complete: None,
            });
        });
        
        // Set up event bridge
        struct SheetEventBridge {
            facade_id: u32,
        }
        
        impl crate::facade::EventCallback for SheetEventBridge {
            fn on_event(&self, event: &crate::facade::SpreadsheetEvent) {
                super::facade::EVENT_CALLBACKS.with(|callbacks| {
                    if let Some(cbs) = callbacks.borrow().get(&self.facade_id) {
                        let js_event = serde_wasm_bindgen::to_value(event).unwrap_or(JsValue::NULL);
                        
                        match event.event_type {
                            crate::facade::EventType::CellUpdated | crate::facade::EventType::CellsUpdated => {
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
        
        facade.add_event_callback(Box::new(SheetEventBridge { facade_id }));
        
        Ok(facade_id)
    })
}

/// Get the active sheet's facade
#[wasm_bindgen(js_name = "workbookGetActiveFacade")]
pub fn workbook_get_active_facade(workbook_id: u32) -> Result<u32, JsValue> {
    WORKBOOK_STORAGE.with(|storage| {
        let workbooks = storage.borrow();
        let workbook = workbooks.get(&workbook_id)
            .ok_or_else(|| JsValue::from_str("Invalid workbook ID"))?;
        
        let active_name = workbook.borrow().active_sheet_name()
            .ok_or_else(|| JsValue::from_str("No active sheet"))?
            .to_string();
        
        workbook_get_sheet_facade(workbook_id, &active_name)
    })
}

/// Copy a sheet
#[wasm_bindgen(js_name = "workbookCopySheet")]
pub fn workbook_copy_sheet(workbook_id: u32, source_name: &str, new_name: &str) -> Result<(), JsValue> {
    WORKBOOK_STORAGE.with(|storage| {
        let workbooks = storage.borrow();
        let workbook = workbooks.get(&workbook_id)
            .ok_or_else(|| JsValue::from_str("Invalid workbook ID"))?;
        
        workbook.borrow_mut().copy_sheet(source_name, new_name)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    })
}

/// Move a sheet to a different position
#[wasm_bindgen(js_name = "workbookMoveSheet")]
pub fn workbook_move_sheet(workbook_id: u32, sheet_name: &str, new_index: usize) -> Result<(), JsValue> {
    WORKBOOK_STORAGE.with(|storage| {
        let workbooks = storage.borrow();
        let workbook = workbooks.get(&workbook_id)
            .ok_or_else(|| JsValue::from_str("Invalid workbook ID"))?;
        
        workbook.borrow_mut().move_sheet(sheet_name, new_index)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    })
}

/// Get a cell value from a specific sheet
#[wasm_bindgen(js_name = "workbookGetCellValue")]
pub fn workbook_get_cell_value(workbook_id: u32, sheet_name: &str, address: &CellAddress) -> Result<JsValue, JsValue> {
    WORKBOOK_STORAGE.with(|storage| {
        let workbooks = storage.borrow();
        let workbook = workbooks.get(&workbook_id)
            .ok_or_else(|| JsValue::from_str("Invalid workbook ID"))?;
        
        match workbook.borrow().get_cell_value(sheet_name, address) {
            Some(value) => Ok(value.to_js()),
            None => Ok(JsValue::UNDEFINED),
        }
    })
}

/// Set a cell value in a specific sheet
#[wasm_bindgen(js_name = "workbookSetCellValue")]
pub fn workbook_set_cell_value(
    workbook_id: u32, 
    sheet_name: &str, 
    address: &CellAddress, 
    value: &str
) -> Result<(), JsValue> {
    WORKBOOK_STORAGE.with(|storage| {
        let workbooks = storage.borrow();
        let workbook = workbooks.get(&workbook_id)
            .ok_or_else(|| JsValue::from_str("Invalid workbook ID"))?;
        
        // Parse the value string
        let cell_value = if value.starts_with('=') {
            CellValue::String(value.to_string())
        } else if let Ok(num) = value.parse::<f64>() {
            CellValue::Number(num)
        } else if value == "true" || value == "false" {
            CellValue::Boolean(value == "true")
        } else {
            CellValue::String(value.to_string())
        };
        
        let cell = Cell::new(cell_value);
        
        workbook.borrow_mut().set_cell_value(sheet_name, address, cell)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    })
}