//! Common traits for dependency injection and abstraction
//!
//! This module defines traits that allow for better testability and
//! reduced coupling between components through dependency injection.

use crate::domain::Cell;
use crate::types::{CellAddress, CellValue};
use crate::error::Result;
use std::collections::HashSet;

/// Repository trait for cell storage operations
pub trait CellRepositoryTrait: Send + Sync {
    /// Get a cell by address
    fn get(&self, address: &CellAddress) -> Option<Cell>;
    
    /// Set a cell at address
    fn set(&mut self, address: &CellAddress, cell: Cell);
    
    /// Delete a cell at address
    fn delete(&mut self, address: &CellAddress) -> Option<Cell>;
    
    /// Clear all cells
    fn clear(&mut self);
    
    /// Get the count of cells
    fn len(&self) -> usize;
    
    /// Check if repository is empty
    fn is_empty(&self) -> bool {
        self.len() == 0
    }
    
    /// Get all cell addresses
    fn get_all_addresses(&self) -> HashSet<CellAddress>;
}

/// Service trait for cell operations
pub trait CellOperationsService: Send + Sync {
    /// Set a cell value (formula or direct value)
    fn set_cell(&self, address: &CellAddress, value: &str) -> Result<Cell>;
    
    /// Get a cell
    fn get_cell(&self, address: &CellAddress) -> Option<Cell>;
    
    /// Delete a cell
    fn delete_cell(&self, address: &CellAddress) -> Result<()>;
    
    /// Get cell value
    fn get_cell_value(&self, address: &CellAddress) -> Option<CellValue>;
}

/// Service trait for structural operations (rows/columns)
pub trait StructuralOperationsService: Send + Sync {
    /// Insert rows at the specified index
    fn insert_rows(&self, start: u32, count: u32) -> Result<Vec<CellAddress>>;
    
    /// Delete rows at the specified index
    fn delete_rows(&self, start: u32, count: u32) -> Result<Vec<Cell>>;
    
    /// Insert columns at the specified index
    fn insert_columns(&self, start: u32, count: u32) -> Result<Vec<CellAddress>>;
    
    /// Delete columns at the specified index
    fn delete_columns(&self, start: u32, count: u32) -> Result<Vec<Cell>>;
    
    /// Get the bounds of the spreadsheet
    fn get_bounds(&self) -> (u32, u32);
}

/// Service trait for calculation operations
pub trait CalculationService: Send + Sync {
    /// Recalculate all cells
    fn recalculate(&self) -> Result<()>;
    
    /// Recalculate specific cells
    fn recalculate_cells(&self, addresses: &[CellAddress]) -> Result<()>;
    
    /// Get calculation order for all cells
    fn get_calculation_order(&self) -> Result<Vec<CellAddress>>;
    
    /// Check if recalculation is needed
    fn needs_recalculation(&self) -> bool;
}

/// Service trait for batch operations
pub trait BatchOperationsService: Send + Sync {
    /// Start a new batch
    fn start_batch(&self, description: Option<String>) -> String;
    
    /// Commit a batch
    fn commit_batch(&self, batch_id: &str) -> Result<()>;
    
    /// Rollback a batch
    fn rollback_batch(&self, batch_id: &str) -> Result<()>;
    
    /// Check if a batch is active
    fn has_active_batch(&self) -> bool;
}

/// Service trait for event management
pub trait EventService: Send + Sync {
    /// Subscribe to events with a boxed callback
    fn subscribe(&self, callback: Box<dyn Fn(&str) + Send + Sync>) -> usize;
    
    /// Unsubscribe from events
    fn unsubscribe(&self, id: usize);
    
    /// Emit an event
    fn emit(&self, event: &str);
}

/// Factory trait for creating services
pub trait ServiceFactory {
    /// Create a new cell operations service
    fn create_cell_operations(&self) -> Box<dyn CellOperationsService>;
    
    /// Create a new structural operations service
    fn create_structural_operations(&self) -> Box<dyn StructuralOperationsService>;
    
    /// Create a new calculation service
    fn create_calculation_service(&self) -> Box<dyn CalculationService>;
    
    /// Create a new batch operations service
    fn create_batch_operations(&self) -> Box<dyn BatchOperationsService>;
    
    /// Create a new event service
    fn create_event_service(&self) -> Box<dyn EventService>;
}