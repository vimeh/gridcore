use super::types::CommandExecutor as CommandExecutorTrait;
use crate::SpreadsheetError;
use crate::domain::Cell;
use crate::facade::SpreadsheetFacade;
use crate::types::CellAddress;
use std::sync::{Arc, Mutex};

/// Command executor implementation that wraps SpreadsheetFacade
pub struct CommandExecutorImpl {
    facade: Arc<Mutex<SpreadsheetFacade>>,
}

impl CommandExecutorImpl {
    /// Create a new command executor
    pub fn new(facade: Arc<Mutex<SpreadsheetFacade>>) -> Self {
        CommandExecutorImpl { facade }
    }
}

impl CommandExecutorTrait for CommandExecutorImpl {
    fn set_cell_direct(
        &mut self,
        address: &CellAddress,
        value: &str,
    ) -> Result<Option<Cell>, SpreadsheetError> {
        let facade = self.facade.lock().map_err(|_| {
            SpreadsheetError::LockError("Failed to acquire facade lock".to_string())
        })?;
        let old_cell = facade.get_cell(address);
        drop(facade);

        self.facade
            .lock()
            .map_err(|_| SpreadsheetError::LockError("Failed to acquire facade lock".to_string()))?
            .set_cell_value_without_command(address, value)?;
        Ok(old_cell)
    }

    fn delete_cell_direct(
        &mut self,
        address: &CellAddress,
    ) -> Result<Option<Cell>, SpreadsheetError> {
        let facade = self.facade.lock().map_err(|_| {
            SpreadsheetError::LockError("Failed to acquire facade lock".to_string())
        })?;
        let old_cell = facade.get_cell(address);
        drop(facade);

        self.facade
            .lock()
            .map_err(|_| SpreadsheetError::LockError("Failed to acquire facade lock".to_string()))?
            .delete_cell_without_command(address)?;
        Ok(old_cell)
    }

    fn insert_row_direct(
        &mut self,
        index: u32,
    ) -> Result<Vec<(CellAddress, Cell)>, SpreadsheetError> {
        // Collect affected cells before the operation
        let mut affected = Vec::new();
        let facade = self.facade.lock().map_err(|_| {
            SpreadsheetError::LockError("Failed to acquire facade lock".to_string())
        })?;

        // Get all cells that will be affected
        for (addr, cell) in facade.get_all_cells() {
            if addr.row >= index {
                affected.push((addr, cell.clone()));
            }
        }
        drop(facade);

        self.facade
            .lock()
            .map_err(|_| SpreadsheetError::LockError("Failed to acquire facade lock".to_string()))?
            .insert_row_without_command(index)?;
        Ok(affected)
    }

    fn delete_row_direct(
        &mut self,
        index: u32,
    ) -> Result<Vec<(CellAddress, Cell)>, SpreadsheetError> {
        // Collect cells that will be deleted
        let mut deleted = Vec::new();
        let facade = self.facade.lock().map_err(|_| {
            SpreadsheetError::LockError("Failed to acquire facade lock".to_string())
        })?;

        for (addr, cell) in facade.get_all_cells() {
            if addr.row == index {
                deleted.push((addr, cell.clone()));
            }
        }
        drop(facade);

        self.facade
            .lock()
            .map_err(|_| SpreadsheetError::LockError("Failed to acquire facade lock".to_string()))?
            .delete_row_without_command(index)?;
        Ok(deleted)
    }

    fn insert_column_direct(
        &mut self,
        index: u32,
    ) -> Result<Vec<(CellAddress, Cell)>, SpreadsheetError> {
        // Collect affected cells before the operation
        let mut affected = Vec::new();
        let facade = self.facade.lock().map_err(|_| {
            SpreadsheetError::LockError("Failed to acquire facade lock".to_string())
        })?;

        for (addr, cell) in facade.get_all_cells() {
            if addr.col >= index {
                affected.push((addr, cell.clone()));
            }
        }
        drop(facade);

        self.facade
            .lock()
            .map_err(|_| SpreadsheetError::LockError("Failed to acquire facade lock".to_string()))?
            .insert_column_without_command(index)?;
        Ok(affected)
    }

    fn delete_column_direct(
        &mut self,
        index: u32,
    ) -> Result<Vec<(CellAddress, Cell)>, SpreadsheetError> {
        // Collect cells that will be deleted
        let mut deleted = Vec::new();
        let facade = self.facade.lock().map_err(|_| {
            SpreadsheetError::LockError("Failed to acquire facade lock".to_string())
        })?;

        for (addr, cell) in facade.get_all_cells() {
            if addr.col == index {
                deleted.push((addr, cell.clone()));
            }
        }
        drop(facade);

        self.facade
            .lock()
            .map_err(|_| SpreadsheetError::LockError("Failed to acquire facade lock".to_string()))?
            .delete_column_without_command(index)?;
        Ok(deleted)
    }

    fn get_cell(&self, address: &CellAddress) -> Option<Cell> {
        self.facade.lock().ok()?.get_cell(address)
    }
}
