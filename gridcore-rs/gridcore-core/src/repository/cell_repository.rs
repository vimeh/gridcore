use crate::domain::Cell;
use crate::types::CellAddress;
use std::collections::HashMap;
use std::str::FromStr;

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

    /// Iterate over all cells in the repository
    pub fn iter(&self) -> impl Iterator<Item = (CellAddress, &Cell)> + '_ {
        self.cells.iter().filter_map(|(addr_str, cell)| {
            CellAddress::from_str(addr_str)
                .ok()
                .map(|addr| (addr, cell))
        })
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
            (
                CellAddress::new(1, 0),
                Cell::new(CellValue::String("test".to_string())),
            ),
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
