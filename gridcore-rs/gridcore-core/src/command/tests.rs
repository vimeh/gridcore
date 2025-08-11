#[cfg(test)]
#[allow(clippy::module_inception)]
mod tests {
    use super::super::*;
    use crate::SpreadsheetError;
    use crate::domain::Cell;
    use crate::types::{CellAddress, CellValue};

    // Mock implementation of CommandExecutor for testing
    struct MockExecutor {
        cells: std::collections::HashMap<CellAddress, Cell>,
    }

    impl MockExecutor {
        fn new() -> Self {
            Self {
                cells: std::collections::HashMap::new(),
            }
        }

        fn parse_value(value: &str) -> CellValue {
            if value.is_empty() {
                CellValue::Empty
            } else if let Ok(n) = value.parse::<f64>() {
                CellValue::Number(n)
            } else if value == "true" || value == "false" {
                CellValue::Boolean(value == "true")
            } else {
                CellValue::from_string(value.to_string())
            }
        }
    }

    impl CommandExecutor for MockExecutor {
        fn set_cell_direct(
            &mut self,
            address: &CellAddress,
            value: &str,
        ) -> Result<Option<Cell>, SpreadsheetError> {
            let old_cell = self.cells.get(address).cloned();

            let parsed_value = Self::parse_value(value);
            let cell = Cell::new(parsed_value);

            self.cells.insert(*address, cell.clone());
            Ok(old_cell)
        }

        fn delete_cell_direct(
            &mut self,
            address: &CellAddress,
        ) -> Result<Option<Cell>, SpreadsheetError> {
            Ok(self.cells.remove(address))
        }

        fn insert_row_direct(
            &mut self,
            index: u32,
        ) -> Result<Vec<(CellAddress, Cell)>, SpreadsheetError> {
            let mut affected = Vec::new();
            let mut updates = Vec::new();

            // Collect cells that need to be moved
            for (addr, cell) in &self.cells {
                if addr.row >= index {
                    let new_addr = CellAddress::new(addr.col, addr.row + 1);
                    affected.push((*addr, cell.clone()));
                    updates.push((new_addr, cell.clone()));
                }
            }

            // Remove old cells
            for (addr, _) in &affected {
                self.cells.remove(addr);
            }

            // Insert at new positions
            for (addr, cell) in updates {
                self.cells.insert(addr, cell);
            }

            Ok(affected)
        }

        fn delete_row_direct(
            &mut self,
            index: u32,
        ) -> Result<Vec<(CellAddress, Cell)>, SpreadsheetError> {
            let mut deleted = Vec::new();
            let mut updates = Vec::new();

            // Collect cells to delete and cells to move
            for (addr, cell) in &self.cells {
                if addr.row == index {
                    deleted.push((*addr, cell.clone()));
                } else if addr.row > index {
                    let new_addr = CellAddress::new(addr.col, addr.row - 1);
                    updates.push((new_addr, cell.clone()));
                }
            }

            // Collect addresses to remove (moved cells)
            let mut to_remove = Vec::new();
            for addr in self.cells.keys() {
                if addr.row > index {
                    to_remove.push(*addr);
                }
            }

            // Remove deleted cells
            for (addr, _) in &deleted {
                self.cells.remove(addr);
            }

            // Remove moved cells
            for addr in to_remove {
                self.cells.remove(&addr);
            }

            // Insert at new positions
            for (addr, cell) in updates {
                self.cells.insert(addr, cell);
            }

            Ok(deleted)
        }

        fn insert_column_direct(
            &mut self,
            index: u32,
        ) -> Result<Vec<(CellAddress, Cell)>, SpreadsheetError> {
            let mut affected = Vec::new();
            let mut updates = Vec::new();

            // Collect cells that need to be moved
            for (addr, cell) in &self.cells {
                if addr.col >= index {
                    let new_addr = CellAddress::new(addr.col + 1, addr.row);
                    affected.push((*addr, cell.clone()));
                    updates.push((new_addr, cell.clone()));
                }
            }

            // Remove old cells
            for (addr, _) in &affected {
                self.cells.remove(addr);
            }

            // Insert at new positions
            for (addr, cell) in updates {
                self.cells.insert(addr, cell);
            }

            Ok(affected)
        }

        fn delete_column_direct(
            &mut self,
            index: u32,
        ) -> Result<Vec<(CellAddress, Cell)>, SpreadsheetError> {
            let mut deleted = Vec::new();
            let mut updates = Vec::new();

            // Collect cells to delete and cells to move
            for (addr, cell) in &self.cells {
                if addr.col == index {
                    deleted.push((*addr, cell.clone()));
                } else if addr.col > index {
                    let new_addr = CellAddress::new(addr.col - 1, addr.row);
                    updates.push((new_addr, cell.clone()));
                }
            }

            // Collect addresses to remove (moved cells)
            let mut to_remove = Vec::new();
            for addr in self.cells.keys() {
                if addr.col > index {
                    to_remove.push(*addr);
                }
            }

            // Remove deleted cells
            for (addr, _) in &deleted {
                self.cells.remove(addr);
            }

            // Remove moved cells
            for addr in to_remove {
                self.cells.remove(&addr);
            }

            // Insert at new positions
            for (addr, cell) in updates {
                self.cells.insert(addr, cell);
            }

            Ok(deleted)
        }

        fn get_cell(&self, address: &CellAddress) -> Option<Cell> {
            self.cells.get(address).cloned()
        }
    }

    #[test]
    fn test_set_cell_command_execute() {
        let mut executor = MockExecutor::new();
        let addr = CellAddress::new(0, 0);

        let cmd = SpreadsheetCommand::set_cell(addr, None, "42".to_string());
        cmd.execute(&mut executor)
            .expect("Command execution should succeed in test");

        let cell = executor.get_cell(&addr).expect("Cell should exist in test");
        assert_eq!(cell.raw_value.to_string(), "42");
    }

    #[test]
    fn test_set_cell_command_undo() {
        let mut executor = MockExecutor::new();
        let addr = CellAddress::new(0, 0);

        // Set initial value
        executor
            .set_cell_direct(&addr, "10")
            .expect("Setting cell should succeed in test");
        let old_cell = executor.get_cell(&addr);

        // Execute command to change value
        let cmd = SpreadsheetCommand::set_cell(addr, old_cell, "42".to_string());
        cmd.execute(&mut executor)
            .expect("Command execution should succeed in test");
        assert_eq!(
            executor
                .get_cell(&addr)
                .expect("Cell should exist in test")
                .raw_value
                .to_string(),
            "42"
        );

        // Undo the command
        cmd.undo(&mut executor)
            .expect("Undo should succeed in test");
        assert_eq!(
            executor
                .get_cell(&addr)
                .expect("Cell should exist in test")
                .raw_value
                .to_string(),
            "10"
        );
    }

    #[test]
    fn test_delete_cell_command() {
        let mut executor = MockExecutor::new();
        let addr = CellAddress::new(0, 0);

        // Set initial value
        executor
            .set_cell_direct(&addr, "42")
            .expect("Setting cell should succeed in test");
        let old_cell = executor.get_cell(&addr);

        // Delete the cell
        let cmd = SpreadsheetCommand::delete_cell(addr, old_cell.clone());
        cmd.execute(&mut executor)
            .expect("Command execution should succeed in test");
        assert!(executor.get_cell(&addr).is_none());

        // Undo the deletion
        cmd.undo(&mut executor)
            .expect("Undo should succeed in test");
        assert_eq!(
            executor
                .get_cell(&addr)
                .expect("Cell should exist in test")
                .raw_value
                .to_string(),
            "42"
        );
    }

    #[test]
    fn test_batch_command() {
        let mut executor = MockExecutor::new();

        let addr1 = CellAddress::new(0, 0);
        let addr2 = CellAddress::new(1, 0);

        let commands = vec![
            SpreadsheetCommand::set_cell(addr1, None, "10".to_string()),
            SpreadsheetCommand::set_cell(addr2, None, "20".to_string()),
        ];

        let batch = SpreadsheetCommand::batch(commands, "Set multiple cells".to_string());

        // Execute batch
        batch
            .execute(&mut executor)
            .expect("Command execution should succeed in test");
        assert_eq!(
            executor
                .get_cell(&addr1)
                .expect("Cell should exist in test")
                .raw_value
                .to_string(),
            "10"
        );
        assert_eq!(
            executor
                .get_cell(&addr2)
                .expect("Cell should exist in test")
                .raw_value
                .to_string(),
            "20"
        );

        // Undo batch (should undo in reverse order)
        batch
            .undo(&mut executor)
            .expect("Undo should succeed in test");
        assert!(executor.get_cell(&addr1).is_none());
        assert!(executor.get_cell(&addr2).is_none());
    }

    #[test]
    fn test_undo_redo_manager_basic() {
        let mut executor = MockExecutor::new();
        let mut manager = UndoRedoManager::new();

        let addr = CellAddress::new(0, 0);
        let cmd = SpreadsheetCommand::set_cell(addr, None, "42".to_string());

        // Execute and track command
        manager
            .execute_command(cmd, &mut executor)
            .expect("Command execution should succeed in test");
        assert!(manager.can_undo());
        assert!(!manager.can_redo());

        // Undo
        manager
            .undo(&mut executor)
            .expect("Undo should succeed in test");
        assert!(!manager.can_undo());
        assert!(manager.can_redo());
        assert!(executor.get_cell(&addr).is_none());

        // Redo
        manager
            .redo(&mut executor)
            .expect("Redo should succeed in test");
        assert!(manager.can_undo());
        assert!(!manager.can_redo());
        assert_eq!(
            executor
                .get_cell(&addr)
                .expect("Cell should exist in test")
                .raw_value
                .to_string(),
            "42"
        );
    }

    #[test]
    fn test_undo_redo_manager_max_undo_levels() {
        let mut executor = MockExecutor::new();
        let mut manager = UndoRedoManager::with_config(UndoRedoConfig {
            max_undo_stack_size: 2,
            ..Default::default()
        });

        // Execute 3 commands (should only keep last 2)
        for i in 0..3 {
            let addr = CellAddress::new(i, 0);
            let cmd = SpreadsheetCommand::set_cell(addr, None, format!("{}", i));
            manager
                .execute_command(cmd, &mut executor)
                .expect("Command execution should succeed in test");
        }

        // Should only be able to undo twice
        assert!(manager.can_undo());
        manager
            .undo(&mut executor)
            .expect("Undo should succeed in test");
        assert!(manager.can_undo());
        manager
            .undo(&mut executor)
            .expect("Undo should succeed in test");
        assert!(!manager.can_undo());

        // First command should still be executed (not in undo stack)
        let addr0 = CellAddress::new(0, 0);
        assert_eq!(
            executor
                .get_cell(&addr0)
                .expect("Cell should exist in test")
                .raw_value
                .to_string(),
            "0"
        );
    }

    #[test]
    fn test_undo_redo_manager_batch_operations() {
        let mut executor = MockExecutor::new();
        let mut manager = UndoRedoManager::new();

        // Start batch
        manager.begin_batch(Some("Test batch".to_string()));

        // Execute multiple commands in batch
        for i in 0..3 {
            let addr = CellAddress::new(i, 0);
            let cmd = SpreadsheetCommand::set_cell(addr, None, format!("{}", i));
            manager
                .execute_command(cmd, &mut executor)
                .expect("Command execution should succeed in test");
        }

        // Commit batch
        manager
            .commit_batch(&mut executor)
            .expect("Batch commit should succeed in test");

        // Should undo all 3 commands as a single operation
        assert!(manager.can_undo());
        manager
            .undo(&mut executor)
            .expect("Undo should succeed in test");

        for i in 0..3 {
            let addr = CellAddress::new(i, 0);
            assert!(executor.get_cell(&addr).is_none());
        }

        // Should redo all 3 commands as a single operation
        assert!(manager.can_redo());
        manager
            .redo(&mut executor)
            .expect("Redo should succeed in test");

        for i in 0..3 {
            let addr = CellAddress::new(i, 0);
            assert_eq!(
                executor
                    .get_cell(&addr)
                    .expect("Cell should exist in test")
                    .raw_value
                    .to_string(),
                format!("{}", i)
            );
        }
    }

    #[test]
    fn test_clear_history() {
        let mut executor = MockExecutor::new();
        let mut manager = UndoRedoManager::new();

        // Execute a command
        let addr = CellAddress::new(0, 0);
        let cmd = SpreadsheetCommand::set_cell(addr, None, "42".to_string());
        manager
            .execute_command(cmd, &mut executor)
            .expect("Command execution should succeed in test");

        // Undo it
        manager
            .undo(&mut executor)
            .expect("Undo should succeed in test");

        assert!(manager.can_redo());
        assert!(!manager.can_undo());

        // Clear history
        manager.clear_history();

        assert!(!manager.can_undo());
        assert!(!manager.can_redo());
    }

    #[test]
    fn test_get_history_descriptions() {
        let mut executor = MockExecutor::new();
        let mut manager = UndoRedoManager::new();

        // Execute some commands
        let addr1 = CellAddress::new(0, 0);
        let cmd1 = SpreadsheetCommand::set_cell(addr1, None, "10".to_string());
        manager
            .execute_command(cmd1, &mut executor)
            .expect("Command execution should succeed in test");

        let addr2 = CellAddress::new(1, 0);
        let cmd2 = SpreadsheetCommand::set_cell(addr2, None, "20".to_string());
        manager
            .execute_command(cmd2, &mut executor)
            .expect("Command execution should succeed in test");

        // Check undo history
        let undo_history = manager.get_undo_history();
        assert_eq!(undo_history.len(), 2);
        assert!(undo_history[0].contains("Set cell"));

        // Undo one command
        manager
            .undo(&mut executor)
            .expect("Undo should succeed in test");

        // Check histories again
        let undo_history = manager.get_undo_history();
        let redo_history = manager.get_redo_history();
        assert_eq!(undo_history.len(), 1);
        assert_eq!(redo_history.len(), 1);
    }
}
