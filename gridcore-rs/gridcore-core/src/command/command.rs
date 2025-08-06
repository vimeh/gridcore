use crate::SpreadsheetError;
use crate::domain::Cell;
use crate::types::CellAddress;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;

/// Trait for undoable commands
pub trait Command: Debug + Send + Sync {
    /// Execute the command
    fn execute(&self, executor: &mut dyn CommandExecutor) -> Result<(), SpreadsheetError>;

    /// Undo the command
    fn undo(&self, executor: &mut dyn CommandExecutor) -> Result<(), SpreadsheetError>;

    /// Get a human-readable description of the command
    fn description(&self) -> String;

    /// Check if this command can be merged with another command
    fn can_merge(&self, _other: &dyn Command) -> bool {
        false
    }

    /// Clone the command as a boxed trait object
    fn clone_box(&self) -> Box<dyn Command>;
}

/// Executor trait for commands to interact with the spreadsheet
pub trait CommandExecutor {
    /// Set a cell value without creating a command
    fn set_cell_direct(
        &mut self,
        address: &CellAddress,
        value: &str,
    ) -> Result<Option<Cell>, SpreadsheetError>;

    /// Delete a cell without creating a command
    fn delete_cell_direct(
        &mut self,
        address: &CellAddress,
    ) -> Result<Option<Cell>, SpreadsheetError>;

    /// Insert a row without creating a command
    fn insert_row_direct(
        &mut self,
        index: u32,
    ) -> Result<Vec<(CellAddress, Cell)>, SpreadsheetError>;

    /// Delete a row without creating a command
    fn delete_row_direct(
        &mut self,
        index: u32,
    ) -> Result<Vec<(CellAddress, Cell)>, SpreadsheetError>;

    /// Insert a column without creating a command
    fn insert_column_direct(
        &mut self,
        index: u32,
    ) -> Result<Vec<(CellAddress, Cell)>, SpreadsheetError>;

    /// Delete a column without creating a command
    fn delete_column_direct(
        &mut self,
        index: u32,
    ) -> Result<Vec<(CellAddress, Cell)>, SpreadsheetError>;

    /// Get a cell without creating a command
    fn get_cell(&self, address: &CellAddress) -> Option<Cell>;
}

/// Metadata for a command
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandMetadata {
    /// Timestamp when the command was executed
    pub timestamp: u64,
    /// Human-readable description
    pub description: String,
    /// Optional user identifier
    pub user_id: Option<String>,
}

/// Concrete command types for spreadsheet operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SpreadsheetCommand {
    /// Set a cell value
    SetCell {
        address: CellAddress,
        old_value: Option<Cell>,
        new_value: String,
    },

    /// Delete a cell
    DeleteCell {
        address: CellAddress,
        old_cell: Option<Cell>,
    },

    /// Insert a row
    InsertRow {
        index: u32,
        affected_cells: Vec<(CellAddress, Cell)>,
    },

    /// Delete a row
    DeleteRow {
        index: u32,
        deleted_cells: Vec<(CellAddress, Cell)>,
    },

    /// Insert a column
    InsertColumn {
        index: u32,
        affected_cells: Vec<(CellAddress, Cell)>,
    },

    /// Delete a column
    DeleteColumn {
        index: u32,
        deleted_cells: Vec<(CellAddress, Cell)>,
    },

    /// Batch command containing multiple commands
    BatchCommand {
        commands: Vec<SpreadsheetCommand>,
        description: String,
    },
}

impl Command for SpreadsheetCommand {
    fn execute(&self, executor: &mut dyn CommandExecutor) -> Result<(), SpreadsheetError> {
        match self {
            SpreadsheetCommand::SetCell {
                address, new_value, ..
            } => {
                executor.set_cell_direct(address, new_value)?;
                Ok(())
            }

            SpreadsheetCommand::DeleteCell { address, .. } => {
                executor.delete_cell_direct(address)?;
                Ok(())
            }

            SpreadsheetCommand::InsertRow { index, .. } => {
                executor.insert_row_direct(*index)?;
                Ok(())
            }

            SpreadsheetCommand::DeleteRow {
                index,
                deleted_cells,
            } => {
                // First delete the row
                executor.delete_row_direct(*index)?;
                // Then restore any cells that were deleted
                for (addr, _cell) in deleted_cells {
                    executor.delete_cell_direct(addr)?;
                }
                Ok(())
            }

            SpreadsheetCommand::InsertColumn { index, .. } => {
                executor.insert_column_direct(*index)?;
                Ok(())
            }

            SpreadsheetCommand::DeleteColumn {
                index,
                deleted_cells,
            } => {
                // First delete the column
                executor.delete_column_direct(*index)?;
                // Then restore any cells that were deleted
                for (addr, _cell) in deleted_cells {
                    executor.delete_cell_direct(addr)?;
                }
                Ok(())
            }

            SpreadsheetCommand::BatchCommand { commands, .. } => {
                for command in commands {
                    command.execute(executor)?;
                }
                Ok(())
            }
        }
    }

    fn undo(&self, executor: &mut dyn CommandExecutor) -> Result<(), SpreadsheetError> {
        match self {
            SpreadsheetCommand::SetCell {
                address, old_value, ..
            } => {
                if let Some(old_cell) = old_value {
                    // Restore the old value
                    executor.set_cell_direct(address, &old_cell.raw_value.to_string())?;
                } else {
                    // Cell didn't exist before, delete it
                    executor.delete_cell_direct(address)?;
                }
                Ok(())
            }

            SpreadsheetCommand::DeleteCell { address, old_cell } => {
                if let Some(cell) = old_cell {
                    // Restore the deleted cell
                    executor.set_cell_direct(address, &cell.raw_value.to_string())?;
                }
                Ok(())
            }

            SpreadsheetCommand::InsertRow { index, .. } => {
                // Undo row insertion by deleting it
                executor.delete_row_direct(*index)?;
                Ok(())
            }

            SpreadsheetCommand::DeleteRow {
                index,
                deleted_cells,
            } => {
                // Undo row deletion by inserting it back
                executor.insert_row_direct(*index)?;
                // Restore all deleted cells
                for (addr, cell) in deleted_cells {
                    executor.set_cell_direct(addr, &cell.raw_value.to_string())?;
                }
                Ok(())
            }

            SpreadsheetCommand::InsertColumn { index, .. } => {
                // Undo column insertion by deleting it
                executor.delete_column_direct(*index)?;
                Ok(())
            }

            SpreadsheetCommand::DeleteColumn {
                index,
                deleted_cells,
            } => {
                // Undo column deletion by inserting it back
                executor.insert_column_direct(*index)?;
                // Restore all deleted cells
                for (addr, cell) in deleted_cells {
                    executor.set_cell_direct(addr, &cell.raw_value.to_string())?;
                }
                Ok(())
            }

            SpreadsheetCommand::BatchCommand { commands, .. } => {
                // Undo in reverse order
                for command in commands.iter().rev() {
                    command.undo(executor)?;
                }
                Ok(())
            }
        }
    }

    fn description(&self) -> String {
        match self {
            SpreadsheetCommand::SetCell { address, .. } => {
                format!("Set cell {}", address.to_string())
            }
            SpreadsheetCommand::DeleteCell { address, .. } => {
                format!("Delete cell {}", address.to_string())
            }
            SpreadsheetCommand::InsertRow { index, .. } => {
                format!("Insert row {}", index + 1)
            }
            SpreadsheetCommand::DeleteRow { index, .. } => {
                format!("Delete row {}", index + 1)
            }
            SpreadsheetCommand::InsertColumn { index, .. } => {
                format!(
                    "Insert column {}",
                    crate::types::column_index_to_label(*index)
                )
            }
            SpreadsheetCommand::DeleteColumn { index, .. } => {
                format!(
                    "Delete column {}",
                    crate::types::column_index_to_label(*index)
                )
            }
            SpreadsheetCommand::BatchCommand { description, .. } => description.clone(),
        }
    }

    fn can_merge(&self, _other: &dyn Command) -> bool {
        // For now, we don't merge commands
        // This could be enhanced to merge consecutive cell edits to the same cell
        false
    }

    fn clone_box(&self) -> Box<dyn Command> {
        Box::new(self.clone())
    }
}

impl SpreadsheetCommand {
    /// Create a SetCell command with proper state capture
    pub fn set_cell(address: CellAddress, old_value: Option<Cell>, new_value: String) -> Self {
        SpreadsheetCommand::SetCell {
            address,
            old_value,
            new_value,
        }
    }

    /// Create a DeleteCell command with proper state capture
    pub fn delete_cell(address: CellAddress, old_cell: Option<Cell>) -> Self {
        SpreadsheetCommand::DeleteCell { address, old_cell }
    }

    /// Create an InsertRow command
    pub fn insert_row(index: u32) -> Self {
        SpreadsheetCommand::InsertRow {
            index,
            affected_cells: Vec::new(),
        }
    }

    /// Create a DeleteRow command with cells that will be deleted
    pub fn delete_row(index: u32, deleted_cells: Vec<(CellAddress, Cell)>) -> Self {
        SpreadsheetCommand::DeleteRow {
            index,
            deleted_cells,
        }
    }

    /// Create an InsertColumn command
    pub fn insert_column(index: u32) -> Self {
        SpreadsheetCommand::InsertColumn {
            index,
            affected_cells: Vec::new(),
        }
    }

    /// Create a DeleteColumn command with cells that will be deleted
    pub fn delete_column(index: u32, deleted_cells: Vec<(CellAddress, Cell)>) -> Self {
        SpreadsheetCommand::DeleteColumn {
            index,
            deleted_cells,
        }
    }

    /// Create a batch command from multiple commands
    pub fn batch(commands: Vec<SpreadsheetCommand>, description: String) -> Self {
        SpreadsheetCommand::BatchCommand {
            commands,
            description,
        }
    }
}
