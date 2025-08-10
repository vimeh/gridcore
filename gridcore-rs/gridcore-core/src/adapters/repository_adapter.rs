//! Repository adapter implementation
//!
//! Adapts the existing CellRepository to implement the RepositoryPort trait.

use crate::Result;
use crate::domain::Cell;
use crate::ports::RepositoryPort;
use crate::repository::CellRepository;
use crate::types::{CellAddress, CellRange};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// Adapter that wraps CellRepository to implement RepositoryPort
pub struct RepositoryAdapter {
    repository: Arc<Mutex<CellRepository>>,
}

impl RepositoryAdapter {
    /// Create a new repository adapter
    pub fn new(repository: Arc<Mutex<CellRepository>>) -> Self {
        Self { repository }
    }

    /// Create a new repository adapter with a fresh repository
    pub fn new_empty() -> Self {
        Self {
            repository: Arc::new(Mutex::new(CellRepository::new())),
        }
    }
}

impl RepositoryPort for RepositoryAdapter {
    fn get(&self, address: &CellAddress) -> Option<Cell> {
        self.repository
            .lock()
            .ok()
            .and_then(|repo| repo.get(address).cloned())
    }

    fn set(&self, address: &CellAddress, cell: Cell) -> Result<()> {
        let mut repo = self.repository.lock().map_err(|_| {
            crate::SpreadsheetError::LockError("Failed to acquire repository lock".to_string())
        })?;
        repo.set(address, cell);
        Ok(())
    }

    fn delete(&self, address: &CellAddress) -> Result<()> {
        let mut repo = self.repository.lock().map_err(|_| {
            crate::SpreadsheetError::LockError("Failed to acquire repository lock".to_string())
        })?;
        repo.delete(address);
        Ok(())
    }

    fn get_all(&self) -> HashMap<CellAddress, Cell> {
        self.repository
            .lock()
            .ok()
            .map(|repo| {
                let mut map = HashMap::new();
                for (addr, cell) in repo.get_all() {
                    map.insert(addr, cell);
                }
                map
            })
            .unwrap_or_default()
    }

    fn get_range(&self, range: &CellRange) -> Vec<(CellAddress, Cell)> {
        let mut result = Vec::new();
        if let Ok(repo) = self.repository.lock() {
            for row in range.start.row..=range.end.row {
                for col in range.start.col..=range.end.col {
                    let addr = CellAddress::new(col, row);
                    if let Some(cell) = repo.get(&addr) {
                        result.push((addr, cell.clone()));
                    }
                }
            }
        }
        result
    }

    fn clear(&self) -> Result<()> {
        let mut repo = self.repository.lock().map_err(|_| {
            crate::SpreadsheetError::LockError("Failed to acquire repository lock".to_string())
        })?;
        repo.clear();
        Ok(())
    }

    fn count(&self) -> usize {
        self.repository
            .lock()
            .ok()
            .map(|repo| repo.len())
            .unwrap_or(0)
    }

    fn contains(&self, address: &CellAddress) -> bool {
        self.repository
            .lock()
            .ok()
            .map(|repo| repo.get(address).is_some())
            .unwrap_or(false)
    }

    fn insert_row(&self, row_index: u32) -> Result<()> {
        let mut cells_to_move = Vec::new();

        // Collect cells that need to be moved
        if let Ok(repo) = self.repository.lock() {
            for (address, cell) in repo.iter() {
                if address.row >= row_index {
                    cells_to_move.push((address, cell.clone()));
                }
            }
        }

        // Move cells
        if let Ok(mut repo) = self.repository.lock() {
            // Delete old positions
            for (address, _) in &cells_to_move {
                repo.delete(address);
            }

            // Insert at new positions
            for (address, cell) in cells_to_move {
                let new_address = CellAddress::new(address.col, address.row + 1);
                repo.set(&new_address, cell);
            }
        }

        Ok(())
    }

    fn insert_column(&self, col_index: u32) -> Result<()> {
        let mut cells_to_move = Vec::new();

        // Collect cells that need to be moved
        if let Ok(repo) = self.repository.lock() {
            for (address, cell) in repo.iter() {
                if address.col >= col_index {
                    cells_to_move.push((address, cell.clone()));
                }
            }
        }

        // Move cells
        if let Ok(mut repo) = self.repository.lock() {
            // Delete old positions
            for (address, _) in &cells_to_move {
                repo.delete(address);
            }

            // Insert at new positions
            for (address, cell) in cells_to_move {
                let new_address = CellAddress::new(address.col + 1, address.row);
                repo.set(&new_address, cell);
            }
        }

        Ok(())
    }

    fn delete_row(&self, row_index: u32) -> Result<()> {
        let mut cells_to_delete = Vec::new();
        let mut cells_to_move = Vec::new();

        // Collect cells
        if let Ok(repo) = self.repository.lock() {
            for (address, cell) in repo.iter() {
                if address.row == row_index {
                    cells_to_delete.push(address);
                } else if address.row > row_index {
                    cells_to_move.push((address, cell.clone()));
                }
            }
        }

        // Apply changes
        if let Ok(mut repo) = self.repository.lock() {
            // Delete cells in the row
            for address in cells_to_delete {
                repo.delete(&address);
            }

            // Delete old positions of cells to move
            for (address, _) in &cells_to_move {
                repo.delete(address);
            }

            // Insert at new positions
            for (address, cell) in cells_to_move {
                let new_address = CellAddress::new(address.col, address.row - 1);
                repo.set(&new_address, cell);
            }
        }

        Ok(())
    }

    fn delete_column(&self, col_index: u32) -> Result<()> {
        let mut cells_to_delete = Vec::new();
        let mut cells_to_move = Vec::new();

        // Collect cells
        if let Ok(repo) = self.repository.lock() {
            for (address, cell) in repo.iter() {
                if address.col == col_index {
                    cells_to_delete.push(address);
                } else if address.col > col_index {
                    cells_to_move.push((address, cell.clone()));
                }
            }
        }

        // Apply changes
        if let Ok(mut repo) = self.repository.lock() {
            // Delete cells in the column
            for address in cells_to_delete {
                repo.delete(&address);
            }

            // Delete old positions of cells to move
            for (address, _) in &cells_to_move {
                repo.delete(address);
            }

            // Insert at new positions
            for (address, cell) in cells_to_move {
                let new_address = CellAddress::new(address.col - 1, address.row);
                repo.set(&new_address, cell);
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::CellValue;

    #[test]
    fn test_repository_adapter_basic_operations() {
        let mut adapter = RepositoryAdapter::new_empty();
        let address = CellAddress::new(0, 0);
        let cell = Cell::new(CellValue::Number(42.0));

        // Test set and get
        adapter.set(&address, cell.clone());
        assert_eq!(adapter.get(&address), Some(cell.clone()));

        // Test contains
        assert!(adapter.contains(&address));

        // Test count
        assert_eq!(adapter.count(), 1);

        // Test delete
        adapter.delete(&address);
        assert_eq!(adapter.get(&address), None);
        assert!(!adapter.contains(&address));
    }

    #[test]
    fn test_repository_adapter_get_all() {
        let mut adapter = RepositoryAdapter::new_empty();

        adapter.set(&CellAddress::new(0, 0), Cell::new(CellValue::Number(1.0)));
        adapter.set(&CellAddress::new(1, 0), Cell::new(CellValue::Number(2.0)));
        adapter.set(&CellAddress::new(0, 1), Cell::new(CellValue::Number(3.0)));

        let all = adapter.get_all();
        assert_eq!(all.len(), 3);
    }

    #[test]
    fn test_repository_adapter_get_range() {
        let mut adapter = RepositoryAdapter::new_empty();

        adapter.set(&CellAddress::new(0, 0), Cell::new(CellValue::Number(1.0)));
        adapter.set(&CellAddress::new(1, 0), Cell::new(CellValue::Number(2.0)));
        adapter.set(&CellAddress::new(0, 1), Cell::new(CellValue::Number(3.0)));
        adapter.set(&CellAddress::new(1, 1), Cell::new(CellValue::Number(4.0)));
        adapter.set(&CellAddress::new(2, 2), Cell::new(CellValue::Number(5.0))); // Outside range

        let range = CellRange::new(CellAddress::new(0, 0), CellAddress::new(1, 1));
        let cells = adapter.get_range(&range);
        assert_eq!(cells.len(), 4);
    }

    #[test]
    fn test_repository_adapter_insert_row() {
        let mut adapter = RepositoryAdapter::new_empty();

        // Set up initial cells
        adapter.set(&CellAddress::new(0, 0), Cell::new(CellValue::Number(1.0)));
        adapter.set(&CellAddress::new(0, 1), Cell::new(CellValue::Number(2.0)));
        adapter.set(&CellAddress::new(0, 2), Cell::new(CellValue::Number(3.0)));

        // Insert row at index 1
        adapter.insert_row(1).unwrap();

        // Check cells moved correctly
        assert_eq!(
            adapter
                .get(&CellAddress::new(0, 0))
                .unwrap()
                .get_computed_value(),
            CellValue::Number(1.0)
        );
        assert_eq!(adapter.get(&CellAddress::new(0, 1)), None); // Empty row
        assert_eq!(
            adapter
                .get(&CellAddress::new(0, 2))
                .unwrap()
                .get_computed_value(),
            CellValue::Number(2.0)
        );
        assert_eq!(
            adapter
                .get(&CellAddress::new(0, 3))
                .unwrap()
                .get_computed_value(),
            CellValue::Number(3.0)
        );
    }

    #[test]
    fn test_repository_adapter_delete_row() {
        let mut adapter = RepositoryAdapter::new_empty();

        // Set up initial cells
        adapter.set(&CellAddress::new(0, 0), Cell::new(CellValue::Number(1.0)));
        adapter.set(&CellAddress::new(0, 1), Cell::new(CellValue::Number(2.0)));
        adapter.set(&CellAddress::new(0, 2), Cell::new(CellValue::Number(3.0)));

        // Delete row at index 1
        adapter.delete_row(1).unwrap();

        // Check cells moved correctly
        assert_eq!(
            adapter
                .get(&CellAddress::new(0, 0))
                .unwrap()
                .get_computed_value(),
            CellValue::Number(1.0)
        );
        assert_eq!(
            adapter
                .get(&CellAddress::new(0, 1))
                .unwrap()
                .get_computed_value(),
            CellValue::Number(3.0)
        );
        assert_eq!(adapter.get(&CellAddress::new(0, 2)), None);
    }
}
