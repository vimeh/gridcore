use super::types::{Command, CommandExecutor, CommandMetadata, SpreadsheetCommand};
use crate::SpreadsheetError;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

/// Configuration for the undo/redo manager
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UndoRedoConfig {
    /// Maximum number of commands to keep in the undo stack
    pub max_undo_stack_size: usize,
    /// Maximum number of commands to keep in the redo stack
    pub max_redo_stack_size: usize,
    /// Whether to group rapid consecutive commands
    pub group_consecutive_commands: bool,
    /// Time window (in ms) for grouping consecutive commands
    pub group_window_ms: u64,
}

impl Default for UndoRedoConfig {
    fn default() -> Self {
        UndoRedoConfig {
            max_undo_stack_size: 100,
            max_redo_stack_size: 100,
            group_consecutive_commands: false,
            group_window_ms: 500,
        }
    }
}

/// Entry in the undo/redo stack
#[derive(Debug, Clone)]
struct StackEntry {
    command: Box<SpreadsheetCommand>,
    metadata: CommandMetadata,
}

/// Manager for undo/redo operations
pub struct UndoRedoManager {
    /// Stack of commands that can be undone
    undo_stack: VecDeque<StackEntry>,
    /// Stack of commands that can be redone
    redo_stack: VecDeque<StackEntry>,
    /// Configuration
    config: UndoRedoConfig,
    /// Whether we're currently in a batch operation
    in_batch: bool,
    /// Current batch commands
    batch_commands: Vec<SpreadsheetCommand>,
    /// Batch description
    batch_description: Option<String>,
}

impl UndoRedoManager {
    /// Create a new undo/redo manager with default configuration
    pub fn new() -> Self {
        Self::with_config(UndoRedoConfig::default())
    }

    /// Create a new undo/redo manager with custom configuration
    pub fn with_config(config: UndoRedoConfig) -> Self {
        UndoRedoManager {
            undo_stack: VecDeque::with_capacity(config.max_undo_stack_size),
            redo_stack: VecDeque::with_capacity(config.max_redo_stack_size),
            config,
            in_batch: false,
            batch_commands: Vec::new(),
            batch_description: None,
        }
    }

    /// Execute a command and add it to the undo stack
    pub fn execute_command(
        &mut self,
        command: SpreadsheetCommand,
        executor: &mut dyn CommandExecutor,
    ) -> Result<(), SpreadsheetError> {
        // If we're in a batch, just collect the command
        if self.in_batch {
            self.batch_commands.push(command);
            return Ok(());
        }

        // Execute the command
        command.execute(executor)?;

        // Add to undo stack
        self.add_to_undo_stack(command);

        // Clear redo stack when a new command is executed
        self.redo_stack.clear();

        Ok(())
    }

    /// Begin a batch operation
    pub fn begin_batch(&mut self, description: Option<String>) {
        self.in_batch = true;
        self.batch_commands.clear();
        self.batch_description = description;
    }

    /// Commit a batch operation
    pub fn commit_batch(
        &mut self,
        executor: &mut dyn CommandExecutor,
    ) -> Result<(), SpreadsheetError> {
        if !self.in_batch {
            return Ok(());
        }

        self.in_batch = false;

        if self.batch_commands.is_empty() {
            return Ok(());
        }

        // Create batch command
        let description = self
            .batch_description
            .take()
            .unwrap_or_else(|| format!("Batch operation ({} commands)", self.batch_commands.len()));

        let batch_command =
            SpreadsheetCommand::batch(std::mem::take(&mut self.batch_commands), description);

        // Execute the batch
        batch_command.execute(executor)?;

        // Add to undo stack
        self.add_to_undo_stack(batch_command);

        // Clear redo stack
        self.redo_stack.clear();

        Ok(())
    }

    /// Cancel a batch operation
    pub fn cancel_batch(&mut self) {
        self.in_batch = false;
        self.batch_commands.clear();
        self.batch_description = None;
    }

    /// Undo the last command
    pub fn undo(
        &mut self,
        executor: &mut dyn CommandExecutor,
    ) -> Result<Option<String>, SpreadsheetError> {
        if let Some(entry) = self.undo_stack.pop_back() {
            // Undo the command
            entry.command.undo(executor)?;

            let description = entry.command.description();

            // Add to redo stack
            self.redo_stack.push_back(entry);

            // Limit redo stack size
            while self.redo_stack.len() > self.config.max_redo_stack_size {
                self.redo_stack.pop_front();
            }

            Ok(Some(description))
        } else {
            Ok(None)
        }
    }

    /// Redo the last undone command
    pub fn redo(
        &mut self,
        executor: &mut dyn CommandExecutor,
    ) -> Result<Option<String>, SpreadsheetError> {
        if let Some(entry) = self.redo_stack.pop_back() {
            // Execute the command again
            entry.command.execute(executor)?;

            let description = entry.command.description();

            // Add back to undo stack
            self.undo_stack.push_back(entry);

            // Limit undo stack size
            while self.undo_stack.len() > self.config.max_undo_stack_size {
                self.undo_stack.pop_front();
            }

            Ok(Some(description))
        } else {
            Ok(None)
        }
    }

    /// Check if undo is available
    pub fn can_undo(&self) -> bool {
        !self.undo_stack.is_empty()
    }

    /// Check if redo is available
    pub fn can_redo(&self) -> bool {
        !self.redo_stack.is_empty()
    }

    /// Get the description of the next undo operation
    pub fn peek_undo(&self) -> Option<String> {
        self.undo_stack
            .back()
            .map(|entry| entry.command.description())
    }

    /// Get the description of the next redo operation
    pub fn peek_redo(&self) -> Option<String> {
        self.redo_stack
            .back()
            .map(|entry| entry.command.description())
    }

    /// Get undo history descriptions
    pub fn get_undo_history(&self) -> Vec<String> {
        self.undo_stack
            .iter()
            .rev()
            .map(|entry| entry.command.description())
            .collect()
    }

    /// Get redo history descriptions
    pub fn get_redo_history(&self) -> Vec<String> {
        self.redo_stack
            .iter()
            .rev()
            .map(|entry| entry.command.description())
            .collect()
    }

    /// Get undo history with metadata (description and timestamp)
    pub fn get_undo_history_with_metadata(&self) -> Vec<(String, u64)> {
        self.undo_stack
            .iter()
            .rev()
            .map(|entry| (entry.command.description(), entry.metadata.timestamp))
            .collect()
    }

    /// Clear all undo/redo history
    pub fn clear_history(&mut self) {
        self.undo_stack.clear();
        self.redo_stack.clear();
        self.in_batch = false;
        self.batch_commands.clear();
        self.batch_description = None;
    }

    /// Get the number of commands in the undo stack
    pub fn undo_stack_size(&self) -> usize {
        self.undo_stack.len()
    }

    /// Get the number of commands in the redo stack
    pub fn redo_stack_size(&self) -> usize {
        self.redo_stack.len()
    }

    /// Add a command to the undo stack
    fn add_to_undo_stack(&mut self, command: SpreadsheetCommand) {
        let metadata = CommandMetadata {
            timestamp: Self::current_timestamp(),
            description: command.description(),
            user_id: None,
        };

        self.undo_stack.push_back(StackEntry {
            command: Box::new(command),
            metadata,
        });

        // Limit undo stack size
        while self.undo_stack.len() > self.config.max_undo_stack_size {
            self.undo_stack.pop_front();
        }
    }

    /// Get current timestamp in milliseconds
    fn current_timestamp() -> u64 {
        use std::time::{SystemTime, UNIX_EPOCH};
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64
    }
}

impl Default for UndoRedoManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::Cell;
    use crate::types::{CellAddress, CellValue};

    /// Mock executor for testing
    struct MockExecutor {
        cells: std::collections::HashMap<String, Cell>,
    }

    impl MockExecutor {
        fn new() -> Self {
            MockExecutor {
                cells: std::collections::HashMap::new(),
            }
        }
    }

    impl CommandExecutor for MockExecutor {
        fn set_cell_direct(
            &mut self,
            address: &CellAddress,
            value: &str,
        ) -> Result<Option<Cell>, SpreadsheetError> {
            let old = self.cells.get(&address.to_string()).cloned();
            let cell = Cell::new(CellValue::String(value.to_string()));
            self.cells.insert(address.to_string(), cell);
            Ok(old)
        }

        fn delete_cell_direct(
            &mut self,
            address: &CellAddress,
        ) -> Result<Option<Cell>, SpreadsheetError> {
            Ok(self.cells.remove(&address.to_string()))
        }

        fn insert_row_direct(
            &mut self,
            _index: u32,
        ) -> Result<Vec<(CellAddress, Cell)>, SpreadsheetError> {
            Ok(Vec::new())
        }

        fn delete_row_direct(
            &mut self,
            _index: u32,
        ) -> Result<Vec<(CellAddress, Cell)>, SpreadsheetError> {
            Ok(Vec::new())
        }

        fn insert_column_direct(
            &mut self,
            _index: u32,
        ) -> Result<Vec<(CellAddress, Cell)>, SpreadsheetError> {
            Ok(Vec::new())
        }

        fn delete_column_direct(
            &mut self,
            _index: u32,
        ) -> Result<Vec<(CellAddress, Cell)>, SpreadsheetError> {
            Ok(Vec::new())
        }

        fn get_cell(&self, address: &CellAddress) -> Option<Cell> {
            self.cells.get(&address.to_string()).cloned()
        }
    }

    #[test]
    fn test_undo_redo_basic() {
        let mut manager = UndoRedoManager::new();
        let mut executor = MockExecutor::new();

        // Execute a command
        let addr = CellAddress::new(0, 0);
        let command = SpreadsheetCommand::set_cell(addr, None, "test".to_string());
        manager.execute_command(command, &mut executor).unwrap();

        // Check that we can undo
        assert!(manager.can_undo());
        assert!(!manager.can_redo());

        // Undo
        let description = manager.undo(&mut executor).unwrap();
        assert!(description.is_some());
        assert!(!manager.can_undo());
        assert!(manager.can_redo());

        // Redo
        let description = manager.redo(&mut executor).unwrap();
        assert!(description.is_some());
        assert!(manager.can_undo());
        assert!(!manager.can_redo());
    }

    #[test]
    fn test_batch_operations() {
        let mut manager = UndoRedoManager::new();
        let mut executor = MockExecutor::new();

        // Begin batch
        manager.begin_batch(Some("Test batch".to_string()));

        // Add multiple commands
        for i in 0..3 {
            let addr = CellAddress::new(i, 0);
            let command = SpreadsheetCommand::set_cell(addr, None, format!("value{}", i));
            manager.execute_command(command, &mut executor).unwrap();
        }

        // Commit batch
        manager.commit_batch(&mut executor).unwrap();

        // Should have one batch command in undo stack
        assert_eq!(manager.undo_stack_size(), 1);
        assert!(manager.peek_undo().unwrap().contains("Test batch"));

        // Undo should undo all operations
        manager.undo(&mut executor).unwrap();
        assert_eq!(executor.cells.len(), 0);
    }

    #[test]
    fn test_stack_size_limits() {
        let config = UndoRedoConfig {
            max_undo_stack_size: 3,
            max_redo_stack_size: 3,
            ..Default::default()
        };

        let mut manager = UndoRedoManager::with_config(config);
        let mut executor = MockExecutor::new();

        // Add more commands than the limit
        for i in 0..5 {
            let addr = CellAddress::new(i, 0);
            let command = SpreadsheetCommand::set_cell(addr, None, format!("value{}", i));
            manager.execute_command(command, &mut executor).unwrap();
        }

        // Should only have 3 commands in undo stack
        assert_eq!(manager.undo_stack_size(), 3);
    }
}
