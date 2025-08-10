//! Repository port interface for data access
//!
//! This trait defines the contract for data persistence operations,
//! allowing the domain and application layers to work with data
//! without depending on concrete repository implementations.

use crate::Result;
use crate::domain::Cell;
use crate::types::{CellAddress, CellRange};
use std::collections::HashMap;

/// Port interface for repository operations
/// 
/// Uses interior mutability to allow shared access while supporting mutations
pub trait RepositoryPort: Send + Sync {
    /// Get a cell by address
    fn get(&self, address: &CellAddress) -> Option<Cell>;

    /// Set a cell at address
    fn set(&self, address: &CellAddress, cell: Cell) -> Result<()>;

    /// Delete a cell at address
    fn delete(&self, address: &CellAddress) -> Result<()>;

    /// Get all cells
    fn get_all(&self) -> HashMap<CellAddress, Cell>;

    /// Get cells in a range
    fn get_range(&self, range: &CellRange) -> Vec<(CellAddress, Cell)>;

    /// Clear all cells
    fn clear(&self) -> Result<()>;

    /// Get count of non-empty cells
    fn count(&self) -> usize;

    /// Check if a cell exists
    fn contains(&self, address: &CellAddress) -> bool;

    /// Insert a row at the specified index
    fn insert_row(&self, row_index: u32) -> Result<()>;

    /// Insert a column at the specified index
    fn insert_column(&self, col_index: u32) -> Result<()>;

    /// Delete a row at the specified index
    fn delete_row(&self, row_index: u32) -> Result<()>;

    /// Delete a column at the specified index
    fn delete_column(&self, col_index: u32) -> Result<()>;
}
