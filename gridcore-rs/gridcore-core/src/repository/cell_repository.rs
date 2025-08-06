use std::collections::HashMap;
use std::str::FromStr;
use crate::domain::Cell;
use crate::types::CellAddress;

/// Repository for storing and managing spreadsheet cells
#[derive(Debug, Clone, Default)]
pub struct CellRepository {
    /// HashMap storing cells by their string address (e.g., "A1", "B2")
    cells: HashMap<String, Cell>,
}

impl CellRepository {
    /// Create a new empty repository
    pub fn new() -> Self {
        CellRepository {
            cells: HashMap::new(),
        }
    }
    
    /// Get a cell by its address
    pub fn get(&self, address: &CellAddress) -> Option<&Cell> {
        self.cells.get(&address.to_string())
    }
    
    /// Get a mutable reference to a cell
    pub fn get_mut(&mut self, address: &CellAddress) -> Option<&mut Cell> {
        self.cells.get_mut(&address.to_string())
    }
    
    /// Set a cell at the given address
    pub fn set(&mut self, address: &CellAddress, cell: Cell) {
        self.cells.insert(address.to_string(), cell);
    }
    
    /// Delete a cell at the given address
    pub fn delete(&mut self, address: &CellAddress) -> Option<Cell> {
        self.cells.remove(&address.to_string())
    }
    
    /// Clear all cells from the repository
    pub fn clear(&mut self) {
        self.cells.clear();
    }
    
    /// Get all cells as a vector of (address, cell) pairs
    pub fn get_all(&self) -> Vec<(CellAddress, Cell)> {
        self.cells
            .iter()
            .filter_map(|(addr_str, cell)| {
                CellAddress::from_str(addr_str)
                    .ok()
                    .map(|addr| (addr, cell.clone()))
            })
            .collect()
    }
    
    /// Get all non-empty cells
    pub fn get_non_empty(&self) -> Vec<(CellAddress, Cell)> {
        self.cells
            .iter()
            .filter(|(_, cell)| !cell.is_empty())
            .filter_map(|(addr_str, cell)| {
                CellAddress::from_str(addr_str)
                    .ok()
                    .map(|addr| (addr, cell.clone()))
            })
            .collect()
    }
    
    /// Check if a cell exists at the given address
    pub fn contains(&self, address: &CellAddress) -> bool {
        self.cells.contains_key(&address.to_string())
    }
    
    /// Get the number of cells in the repository
    pub fn len(&self) -> usize {
        self.cells.len()
    }
    
    /// Check if the repository is empty
    pub fn is_empty(&self) -> bool {
        self.cells.is_empty()
    }
    
    /// Get all cell addresses
    pub fn get_addresses(&self) -> Vec<CellAddress> {
        self.cells
            .keys()
            .filter_map(|addr_str| CellAddress::from_str(addr_str).ok())
            .collect()
    }
}

#[cfg(feature = "wasm")]
pub mod wasm_bindings {
    use super::*;
    use wasm_bindgen::prelude::*;
    use crate::domain::cell::wasm_bindings::WasmCell;
    use crate::types::wasm::WasmCellAddress;
    use std::str::FromStr;
    
    #[wasm_bindgen]
    pub struct WasmCellRepository {
        inner: CellRepository,
    }
    
    #[wasm_bindgen]
    impl WasmCellRepository {
        #[wasm_bindgen(constructor)]
        pub fn new() -> Self {
            WasmCellRepository {
                inner: CellRepository::new(),
            }
        }
        
        #[wasm_bindgen(js_name = "get")]
        pub fn get(&self, address: &WasmCellAddress) -> Option<WasmCell> {
            let address = &address.inner;
            self.inner.get(address).map(|cell| {
                // Create a WasmCell from the Cell
                // This is a bit hacky but works for now
                let value = cell.get_display_value().to_js();
                WasmCell::new(value).ok()
            }).flatten()
        }
        
        #[wasm_bindgen(js_name = "set")]
        pub fn set(&mut self, address: &WasmCellAddress, cell: &WasmCell) -> Result<(), JsValue> {
            let address = &address.inner;
            // Convert WasmCell to Cell
            // For now, we'll use JSON serialization as a bridge
            let json = cell.to_json()?;
            let cell: Cell = serde_wasm_bindgen::from_value(json)
                .map_err(|e| JsValue::from_str(&e.to_string()))?;
            self.inner.set(address, cell);
            Ok(())
        }
        
        #[wasm_bindgen(js_name = "delete")]
        pub fn delete(&mut self, address: &WasmCellAddress) -> bool {
            let address = &address.inner;
            self.inner.delete(address).is_some()
        }
        
        #[wasm_bindgen(js_name = "clear")]
        pub fn clear(&mut self) {
            self.inner.clear();
        }
        
        #[wasm_bindgen(js_name = "contains")]
        pub fn contains(&self, address: &WasmCellAddress) -> bool {
            let address = &address.inner;
            self.inner.contains(address)
        }
        
        #[wasm_bindgen(js_name = "isEmpty")]
        pub fn is_empty(&self) -> bool {
            self.inner.is_empty()
        }
        
        #[wasm_bindgen(js_name = "getCount")]
        pub fn get_count(&self) -> usize {
            self.inner.len()
        }
        
        #[wasm_bindgen(js_name = "getAllAddresses")]
        pub fn get_all_addresses(&self) -> Vec<WasmCellAddress> {
            self.inner.get_addresses()
                .into_iter()
                .map(|addr| WasmCellAddress { inner: addr })
                .collect()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::CellValue;
    
    #[test]
    fn test_repository_basic_operations() {
        let mut repo = CellRepository::new();
        let addr = CellAddress::new(0, 0); // A1
        let cell = Cell::new(CellValue::Number(42.0));
        
        // Test set and get
        repo.set(&addr, cell.clone());
        assert!(repo.contains(&addr));
        assert_eq!(repo.get(&addr), Some(&cell));
        
        // Test len
        assert_eq!(repo.len(), 1);
        assert!(!repo.is_empty());
        
        // Test delete
        let deleted = repo.delete(&addr);
        assert_eq!(deleted, Some(cell));
        assert!(!repo.contains(&addr));
        assert!(repo.is_empty());
    }
    
    #[test]
    fn test_repository_clear() {
        let mut repo = CellRepository::new();
        
        // Add multiple cells
        for i in 0..5 {
            let addr = CellAddress::new(i, 0);
            let cell = Cell::new(CellValue::Number(i as f64));
            repo.set(&addr, cell);
        }
        
        assert_eq!(repo.len(), 5);
        
        // Clear all cells
        repo.clear();
        assert_eq!(repo.len(), 0);
        assert!(repo.is_empty());
    }
    
    #[test]
    fn test_repository_get_all() {
        let mut repo = CellRepository::new();
        
        // Add some cells
        let cells = vec![
            (CellAddress::new(0, 0), Cell::new(CellValue::Number(1.0))),
            (CellAddress::new(1, 0), Cell::new(CellValue::String("test".to_string()))),
            (CellAddress::new(2, 0), Cell::new(CellValue::Boolean(true))),
        ];
        
        for (addr, cell) in &cells {
            repo.set(addr, cell.clone());
        }
        
        let all_cells = repo.get_all();
        assert_eq!(all_cells.len(), 3);
        
        // Check that all cells are present
        for (addr, cell) in cells {
            assert!(all_cells.iter().any(|(a, c)| a == &addr && c == &cell));
        }
    }
}