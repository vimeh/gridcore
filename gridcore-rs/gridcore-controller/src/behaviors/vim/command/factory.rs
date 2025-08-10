use super::ex_commands::ExCommandExecutor;
use super::types::{CommandCategory, CommandResult, ExCommand};
use crate::behaviors::vim::VimBehavior;
use gridcore_core::SpreadsheetError;
use std::collections::HashMap;

/// Factory for creating and dispatching commands
pub struct CommandFactory {
    /// Map of command names to their categories
    command_map: HashMap<String, CommandCategory>,
}

impl CommandFactory {
    pub fn new() -> Self {
        let mut command_map = HashMap::new();
        
        // File operations
        command_map.insert("w".to_string(), CommandCategory::FileOperations);
        command_map.insert("write".to_string(), CommandCategory::FileOperations);
        command_map.insert("q".to_string(), CommandCategory::FileOperations);
        command_map.insert("quit".to_string(), CommandCategory::FileOperations);
        command_map.insert("wq".to_string(), CommandCategory::FileOperations);
        command_map.insert("x".to_string(), CommandCategory::FileOperations);
        command_map.insert("e".to_string(), CommandCategory::FileOperations);
        command_map.insert("edit".to_string(), CommandCategory::FileOperations);
        
        // Navigation
        command_map.insert("goto".to_string(), CommandCategory::Navigation);
        
        // Search and replace
        command_map.insert("s".to_string(), CommandCategory::SearchReplace);
        command_map.insert("substitute".to_string(), CommandCategory::SearchReplace);
        command_map.insert("g".to_string(), CommandCategory::SearchReplace);
        command_map.insert("global".to_string(), CommandCategory::SearchReplace);
        
        // Edit operations
        command_map.insert("d".to_string(), CommandCategory::EditOperations);
        command_map.insert("delete".to_string(), CommandCategory::EditOperations);
        command_map.insert("y".to_string(), CommandCategory::EditOperations);
        command_map.insert("yank".to_string(), CommandCategory::EditOperations);
        command_map.insert("put".to_string(), CommandCategory::EditOperations);
        
        // Copy/move
        command_map.insert("t".to_string(), CommandCategory::CopyMove);
        command_map.insert("copy".to_string(), CommandCategory::CopyMove);
        command_map.insert("m".to_string(), CommandCategory::CopyMove);
        command_map.insert("move".to_string(), CommandCategory::CopyMove);
        
        // Formatting
        command_map.insert(">".to_string(), CommandCategory::Formatting);
        command_map.insert("<".to_string(), CommandCategory::Formatting);
        command_map.insert("center".to_string(), CommandCategory::Formatting);
        command_map.insert("left".to_string(), CommandCategory::Formatting);
        command_map.insert("right".to_string(), CommandCategory::Formatting);
        command_map.insert("format".to_string(), CommandCategory::Formatting);
        command_map.insert("sort".to_string(), CommandCategory::Formatting);
        command_map.insert("filter".to_string(), CommandCategory::Formatting);
        
        // Settings
        command_map.insert("set".to_string(), CommandCategory::Settings);
        command_map.insert("setlocal".to_string(), CommandCategory::Settings);
        
        // Marks
        command_map.insert("marks".to_string(), CommandCategory::Marks);
        command_map.insert("delmarks".to_string(), CommandCategory::Marks);
        
        // Registers
        command_map.insert("registers".to_string(), CommandCategory::Registers);
        command_map.insert("normal".to_string(), CommandCategory::Registers);
        
        // Formula
        command_map.insert("formula".to_string(), CommandCategory::Formula);
        
        // Chart
        command_map.insert("chart".to_string(), CommandCategory::Chart);
        
        // Help
        command_map.insert("help".to_string(), CommandCategory::Help);
        command_map.insert("h".to_string(), CommandCategory::Help);
        
        Self { command_map }
    }
    
    /// Get the category for a command
    pub fn get_category(&self, command: &str) -> Option<CommandCategory> {
        self.command_map.get(command).copied()
    }
    
    /// Execute a command based on its category
    pub fn execute(&self, vim: &mut VimBehavior, parsed: &ExCommand) -> CommandResult {
        // Special case for empty command (just line number)
        if parsed.command.is_empty() && parsed.range.is_some() {
            return vim.execute_goto(parsed);
        }
        
        let category = self.get_category(&parsed.command);
        
        match category {
            Some(CommandCategory::FileOperations) => {
                match parsed.command.as_str() {
                    "w" | "write" => vim.execute_write(parsed),
                    "q" | "quit" => vim.execute_quit(parsed),
                    "wq" | "x" => vim.execute_write_quit(parsed),
                    "e" | "edit" => vim.execute_edit(parsed),
                    _ => Err(SpreadsheetError::InvalidCommand(
                        format!("Unknown file operation: {}", parsed.command)
                    )),
                }
            }
            Some(CommandCategory::Navigation) => vim.execute_goto(parsed),
            Some(CommandCategory::SearchReplace) => {
                match parsed.command.as_str() {
                    "s" | "substitute" => vim.execute_substitute(parsed),
                    "g" | "global" => vim.execute_global(parsed),
                    _ => Err(SpreadsheetError::InvalidCommand(
                        format!("Unknown search command: {}", parsed.command)
                    )),
                }
            }
            Some(CommandCategory::EditOperations) => {
                match parsed.command.as_str() {
                    "d" | "delete" => vim.execute_delete(parsed),
                    "y" | "yank" => vim.execute_yank(parsed),
                    "put" => vim.execute_put(parsed),
                    _ => Err(SpreadsheetError::InvalidCommand(
                        format!("Unknown edit operation: {}", parsed.command)
                    )),
                }
            }
            Some(CommandCategory::CopyMove) => {
                match parsed.command.as_str() {
                    "t" | "copy" => vim.execute_copy(parsed),
                    "m" | "move" => vim.execute_move(parsed),
                    _ => Err(SpreadsheetError::InvalidCommand(
                        format!("Unknown copy/move command: {}", parsed.command)
                    )),
                }
            }
            Some(CommandCategory::Formatting) => {
                match parsed.command.as_str() {
                    ">" => vim.execute_indent(parsed),
                    "<" => vim.execute_outdent(parsed),
                    "center" => vim.execute_center(parsed),
                    "left" => vim.execute_left(parsed),
                    "right" => vim.execute_right(parsed),
                    "format" => vim.execute_format(parsed),
                    "sort" => vim.execute_sort(parsed),
                    "filter" => vim.execute_filter(parsed),
                    _ => Err(SpreadsheetError::InvalidCommand(
                        format!("Unknown formatting command: {}", parsed.command)
                    )),
                }
            }
            Some(CommandCategory::Settings) => {
                match parsed.command.as_str() {
                    "set" => vim.execute_set(parsed),
                    "setlocal" => vim.execute_setlocal(parsed),
                    _ => Err(SpreadsheetError::InvalidCommand(
                        format!("Unknown settings command: {}", parsed.command)
                    )),
                }
            }
            Some(CommandCategory::Marks) => {
                match parsed.command.as_str() {
                    "marks" => vim.execute_marks(parsed),
                    "delmarks" => vim.execute_delmarks(parsed),
                    _ => Err(SpreadsheetError::InvalidCommand(
                        format!("Unknown marks command: {}", parsed.command)
                    )),
                }
            }
            Some(CommandCategory::Registers) => {
                match parsed.command.as_str() {
                    "registers" => vim.execute_registers(parsed),
                    "normal" => vim.execute_normal(parsed),
                    _ => Err(SpreadsheetError::InvalidCommand(
                        format!("Unknown register command: {}", parsed.command)
                    )),
                }
            }
            Some(CommandCategory::Formula) => vim.execute_formula(parsed),
            Some(CommandCategory::Chart) => vim.execute_chart(parsed),
            Some(CommandCategory::Help) => vim.execute_help(parsed),
            Some(CommandCategory::Bulk) => {
                // Bulk commands are handled separately
                Err(SpreadsheetError::InvalidCommand(
                    "Bulk command should be handled by BulkCommandParser".to_string()
                ))
            }
            None => Err(SpreadsheetError::InvalidCommand(
                format!("Unknown command: {}", parsed.command)
            )),
        }
    }
    
    /// Get list of available commands for completion
    pub fn get_available_commands(&self) -> Vec<String> {
        let mut commands: Vec<String> = self.command_map.keys().cloned().collect();
        commands.sort();
        commands
    }
    
    /// Get commands starting with a prefix (for tab completion)
    pub fn get_completions(&self, prefix: &str) -> Vec<String> {
        self.command_map
            .keys()
            .filter(|cmd| cmd.starts_with(prefix))
            .cloned()
            .collect()
    }
}

impl Default for CommandFactory {
    fn default() -> Self {
        Self::new()
    }
}