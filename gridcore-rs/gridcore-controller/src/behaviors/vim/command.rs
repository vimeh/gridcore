use gridcore_core::{Result, SpreadsheetError};
use crate::state::{Action, UIState, ParsedBulkCommand};
use super::{VimBehavior, VimMode};

/// Represents a parsed Ex command
#[derive(Debug, Clone)]
pub struct ExCommand {
    pub range: Option<CommandRange>,
    pub command: String,
    pub args: Vec<String>,
    pub flags: Vec<String>,
}

/// Represents a range specification in Ex commands
#[derive(Debug, Clone)]
pub enum CommandRange {
    Line(u32),
    Lines(u32, u32),
    Current,
    All,
    Visual,
    Marks(char, char),
    Pattern(String, String),
}

impl VimBehavior {
    /// Handle command mode key presses
    pub fn handle_command_mode(&mut self, key: &str, _current_state: &UIState) -> Result<Option<Action>> {
        match key {
            "Escape" => {
                self.mode = VimMode::Normal;
                self.command_buffer.clear();
                Ok(Some(Action::ExitCommandMode))
            }
            
            "Enter" | "Return" => {
                let command = self.command_buffer.clone();
                let result = self.execute_ex_command(&command);
                self.mode = VimMode::Normal;
                self.command_buffer.clear();
                result
            }
            
            "Backspace" | "Delete" => {
                self.command_buffer.pop();
                Ok(Some(Action::UpdateCommandValue {
                    value: format!(":{}", self.command_buffer),
                }))
            }
            
            "Tab" => {
                // Command completion
                self.complete_command()
            }
            
            _ => {
                self.command_buffer.push_str(key);
                Ok(Some(Action::UpdateCommandValue {
                    value: format!(":{}", self.command_buffer),
                }))
            }
        }
    }
    
    /// Execute an Ex command
    pub fn execute_ex_command(&mut self, command_str: &str) -> Result<Option<Action>> {
        let parsed = self.parse_ex_command(command_str)?;
        
        match parsed.command.as_str() {
            // File operations
            "w" | "write" => self.execute_write(&parsed),
            "q" | "quit" => self.execute_quit(&parsed),
            "wq" | "x" => self.execute_write_quit(&parsed),
            "e" | "edit" => self.execute_edit(&parsed),
            
            // Navigation
            "" => self.execute_goto(&parsed), // Just a line number
            
            // Search and replace
            "s" | "substitute" => self.execute_substitute(&parsed),
            "g" | "global" => self.execute_global(&parsed),
            
            // Delete/yank/put
            "d" | "delete" => self.execute_delete(&parsed),
            "y" | "yank" => self.execute_yank(&parsed),
            "put" => self.execute_put(&parsed),
            
            // Copy/move
            "t" | "copy" => self.execute_copy(&parsed),
            "m" | "move" => self.execute_move(&parsed),
            
            // Formatting
            ">" => self.execute_indent(&parsed),
            "<" => self.execute_outdent(&parsed),
            "center" => self.execute_center(&parsed),
            "left" => self.execute_left(&parsed),
            "right" => self.execute_right(&parsed),
            
            // Settings
            "set" => self.execute_set(&parsed),
            "setlocal" => self.execute_setlocal(&parsed),
            
            // Marks
            "marks" => self.execute_marks(&parsed),
            "delmarks" => self.execute_delmarks(&parsed),
            
            // Registers
            "registers" | "reg" => self.execute_registers(&parsed),
            
            // Macros
            "normal" | "norm" => self.execute_normal(&parsed),
            
            // Spreadsheet-specific commands
            "format" => self.execute_format(&parsed),
            "sort" => self.execute_sort(&parsed),
            "filter" => self.execute_filter(&parsed),
            "formula" => self.execute_formula(&parsed),
            "chart" => self.execute_chart(&parsed),
            
            // Help
            "help" | "h" => self.execute_help(&parsed),
            
            _ => Err(SpreadsheetError::InvalidOperation(
                format!("Unknown command: {}", parsed.command)
            )),
        }
    }
    
    /// Parse an Ex command string
    fn parse_ex_command(&self, command_str: &str) -> Result<ExCommand> {
        let mut range = None;
        let mut remaining = command_str;
        
        // Parse range if present
        if let Some(range_end) = self.find_range_end(remaining) {
            let range_str = &remaining[..range_end];
            range = self.parse_range(range_str)?;
            remaining = &remaining[range_end..];
        }
        
        // Parse command and arguments
        let parts: Vec<&str> = remaining.split_whitespace().collect();
        let command = if parts.is_empty() {
            String::new()
        } else {
            parts[0].to_string()
        };
        
        let args = if parts.len() > 1 {
            parts[1..].iter().map(|s| s.to_string()).collect()
        } else {
            Vec::new()
        };
        
        // Extract flags (arguments starting with -)
        let (args, flags): (Vec<_>, Vec<_>) = args.into_iter()
            .partition(|arg| !arg.starts_with('-'));
        
        Ok(ExCommand {
            range,
            command,
            args,
            flags,
        })
    }
    
    fn find_range_end(&self, s: &str) -> Option<usize> {
        // Find where the range specification ends
        // This is simplified - real Vim parsing is more complex
        for (i, ch) in s.chars().enumerate() {
            if ch.is_ascii_alphabetic() && ch != ',' && ch != ';' {
                return Some(i);
            }
        }
        None
    }
    
    fn parse_range(&self, range_str: &str) -> Result<Option<CommandRange>> {
        if range_str.is_empty() {
            return Ok(None);
        }
        
        match range_str {
            "." => Ok(Some(CommandRange::Current)),
            "%" => Ok(Some(CommandRange::All)),
            "'<,'>" => Ok(Some(CommandRange::Visual)),
            _ => {
                // Try to parse as line number(s)
                if let Ok(line) = range_str.parse::<u32>() {
                    Ok(Some(CommandRange::Line(line)))
                } else if range_str.contains(',') {
                    let parts: Vec<&str> = range_str.split(',').collect();
                    if parts.len() == 2 {
                        if let (Ok(start), Ok(end)) = (parts[0].parse::<u32>(), parts[1].parse::<u32>()) {
                            Ok(Some(CommandRange::Lines(start, end)))
                        } else {
                            Ok(None)
                        }
                    } else {
                        Ok(None)
                    }
                } else {
                    Ok(None)
                }
            }
        }
    }
    
    fn complete_command(&mut self) -> Result<Option<Action>> {
        // Simple command completion
        let commands = vec![
            "write", "quit", "wq", "edit", "substitute", "global",
            "delete", "yank", "put", "copy", "move", "set", "help",
            "format", "sort", "filter", "formula", "chart",
        ];
        
        let prefix = self.command_buffer.clone();
        let matches: Vec<&str> = commands.iter()
            .filter(|cmd| cmd.starts_with(&prefix))
            .copied()
            .collect();
        
        if matches.len() == 1 {
            self.command_buffer = matches[0].to_string();
            Ok(Some(Action::UpdateCommandValue {
                value: format!(":{}", self.command_buffer),
            }))
        } else {
            // Show matches or do nothing
            Ok(None)
        }
    }
    
    // Command implementations
    fn execute_write(&self, _parsed: &ExCommand) -> Result<Option<Action>> {
        // TODO: Implement save
        Ok(None)
    }
    
    fn execute_quit(&self, _parsed: &ExCommand) -> Result<Option<Action>> {
        // TODO: Implement quit
        Ok(None)
    }
    
    fn execute_write_quit(&self, _parsed: &ExCommand) -> Result<Option<Action>> {
        // TODO: Implement save and quit
        Ok(None)
    }
    
    fn execute_edit(&self, _parsed: &ExCommand) -> Result<Option<Action>> {
        // TODO: Implement file open
        Ok(None)
    }
    
    fn execute_goto(&self, parsed: &ExCommand) -> Result<Option<Action>> {
        if let Some(CommandRange::Line(line)) = &parsed.range {
            Ok(Some(Action::UpdateCursor {
                cursor: gridcore_core::types::CellAddress::new(0, *line - 1),
            }))
        } else {
            Ok(None)
        }
    }
    
    fn execute_substitute(&self, parsed: &ExCommand) -> Result<Option<Action>> {
        // Parse s/pattern/replacement/flags
        if parsed.args.is_empty() {
            return Ok(None);
        }
        
        // TODO: Implement search and replace
        // For now, create a bulk operation
        let command = ParsedBulkCommand {
            command: format!(":s {}", parsed.args.join(" ")),
            operation: "substitute".to_string(),
            range_spec: self.range_to_string(&parsed.range),
            parameters: parsed.args.clone(),
        };
        
        Ok(Some(Action::StartBulkOperation {
            parsed_command: command,
            affected_cells: None,
        }))
    }
    
    fn execute_global(&self, _parsed: &ExCommand) -> Result<Option<Action>> {
        // TODO: Implement global command
        Ok(None)
    }
    
    fn execute_delete(&self, parsed: &ExCommand) -> Result<Option<Action>> {
        // Determine what to delete based on range
        let targets = self.range_to_indices(&parsed.range);
        
        Ok(Some(Action::StartDelete {
            targets,
            delete_type: crate::state::DeleteType::Row,
        }))
    }
    
    fn execute_yank(&self, _parsed: &ExCommand) -> Result<Option<Action>> {
        // TODO: Implement yank to register
        Ok(None)
    }
    
    fn execute_put(&self, _parsed: &ExCommand) -> Result<Option<Action>> {
        // TODO: Implement put from register
        Ok(None)
    }
    
    fn execute_copy(&self, _parsed: &ExCommand) -> Result<Option<Action>> {
        // TODO: Implement copy lines
        Ok(None)
    }
    
    fn execute_move(&self, _parsed: &ExCommand) -> Result<Option<Action>> {
        // TODO: Implement move lines
        Ok(None)
    }
    
    fn execute_indent(&self, _parsed: &ExCommand) -> Result<Option<Action>> {
        // TODO: Implement indent
        Ok(None)
    }
    
    fn execute_outdent(&self, _parsed: &ExCommand) -> Result<Option<Action>> {
        // TODO: Implement outdent
        Ok(None)
    }
    
    fn execute_center(&self, _parsed: &ExCommand) -> Result<Option<Action>> {
        // TODO: Implement center text
        Ok(None)
    }
    
    fn execute_left(&self, _parsed: &ExCommand) -> Result<Option<Action>> {
        // TODO: Implement left align
        Ok(None)
    }
    
    fn execute_right(&self, _parsed: &ExCommand) -> Result<Option<Action>> {
        // TODO: Implement right align
        Ok(None)
    }
    
    fn execute_set(&mut self, parsed: &ExCommand) -> Result<Option<Action>> {
        // Handle settings
        for arg in &parsed.args {
            if arg.starts_with("no") {
                // Disable setting
                let setting = &arg[2..];
                self.settings.insert(setting.to_string(), "false".to_string());
            } else if arg.contains('=') {
                // Set value
                let parts: Vec<&str> = arg.splitn(2, '=').collect();
                if parts.len() == 2 {
                    self.settings.insert(parts[0].to_string(), parts[1].to_string());
                }
            } else {
                // Enable setting
                self.settings.insert(arg.to_string(), "true".to_string());
            }
        }
        Ok(None)
    }
    
    fn execute_setlocal(&mut self, parsed: &ExCommand) -> Result<Option<Action>> {
        // Same as set for now
        self.execute_set(parsed)
    }
    
    fn execute_marks(&self, _parsed: &ExCommand) -> Result<Option<Action>> {
        // TODO: Show marks
        Ok(None)
    }
    
    fn execute_delmarks(&mut self, parsed: &ExCommand) -> Result<Option<Action>> {
        // Delete specified marks
        for arg in &parsed.args {
            for ch in arg.chars() {
                self.marks.remove(&ch);
            }
        }
        Ok(None)
    }
    
    fn execute_registers(&self, _parsed: &ExCommand) -> Result<Option<Action>> {
        // TODO: Show registers
        Ok(None)
    }
    
    fn execute_normal(&self, _parsed: &ExCommand) -> Result<Option<Action>> {
        // TODO: Execute normal mode commands
        Ok(None)
    }
    
    fn execute_format(&self, parsed: &ExCommand) -> Result<Option<Action>> {
        // Spreadsheet formatting command
        let command = ParsedBulkCommand {
            command: format!(":format {}", parsed.args.join(" ")),
            operation: "format".to_string(),
            range_spec: self.range_to_string(&parsed.range),
            parameters: parsed.args.clone(),
        };
        
        Ok(Some(Action::StartBulkOperation {
            parsed_command: command,
            affected_cells: None,
        }))
    }
    
    fn execute_sort(&self, parsed: &ExCommand) -> Result<Option<Action>> {
        // Spreadsheet sort command
        let command = ParsedBulkCommand {
            command: format!(":sort {}", parsed.args.join(" ")),
            operation: "sort".to_string(),
            range_spec: self.range_to_string(&parsed.range),
            parameters: parsed.args.clone(),
        };
        
        Ok(Some(Action::StartBulkOperation {
            parsed_command: command,
            affected_cells: None,
        }))
    }
    
    fn execute_filter(&self, parsed: &ExCommand) -> Result<Option<Action>> {
        // Spreadsheet filter command
        let command = ParsedBulkCommand {
            command: format!(":filter {}", parsed.args.join(" ")),
            operation: "filter".to_string(),
            range_spec: self.range_to_string(&parsed.range),
            parameters: parsed.args.clone(),
        };
        
        Ok(Some(Action::StartBulkOperation {
            parsed_command: command,
            affected_cells: None,
        }))
    }
    
    fn execute_formula(&self, parsed: &ExCommand) -> Result<Option<Action>> {
        // Apply formula to range
        let command = ParsedBulkCommand {
            command: format!(":formula {}", parsed.args.join(" ")),
            operation: "formula".to_string(),
            range_spec: self.range_to_string(&parsed.range),
            parameters: parsed.args.clone(),
        };
        
        Ok(Some(Action::StartBulkOperation {
            parsed_command: command,
            affected_cells: None,
        }))
    }
    
    fn execute_chart(&self, parsed: &ExCommand) -> Result<Option<Action>> {
        // Create chart from range
        let command = ParsedBulkCommand {
            command: format!(":chart {}", parsed.args.join(" ")),
            operation: "chart".to_string(),
            range_spec: self.range_to_string(&parsed.range),
            parameters: parsed.args.clone(),
        };
        
        Ok(Some(Action::StartBulkOperation {
            parsed_command: command,
            affected_cells: None,
        }))
    }
    
    fn execute_help(&self, _parsed: &ExCommand) -> Result<Option<Action>> {
        // TODO: Show help
        Ok(None)
    }
    
    // Helper methods
    fn range_to_string(&self, range: &Option<CommandRange>) -> String {
        match range {
            Some(CommandRange::Line(n)) => n.to_string(),
            Some(CommandRange::Lines(start, end)) => format!("{},{}", start, end),
            Some(CommandRange::Current) => ".".to_string(),
            Some(CommandRange::All) => "%".to_string(),
            Some(CommandRange::Visual) => "'<,'>".to_string(),
            _ => String::new(),
        }
    }
    
    fn range_to_indices(&self, range: &Option<CommandRange>) -> Vec<u32> {
        match range {
            Some(CommandRange::Line(n)) => vec![*n - 1],
            Some(CommandRange::Lines(start, end)) => {
                (*start..=*end).map(|n| n - 1).collect()
            }
            Some(CommandRange::All) => {
                // Return a reasonable range
                (0..100).collect()
            }
            _ => vec![],
        }
    }
}

impl VimBehavior {
    pub fn new_with_settings() -> Self {
        let mut vim = Self::new();
        
        // Default settings
        vim.settings.insert("number".to_string(), "true".to_string());
        vim.settings.insert("relativenumber".to_string(), "false".to_string());
        vim.settings.insert("wrap".to_string(), "true".to_string());
        vim.settings.insert("expandtab".to_string(), "true".to_string());
        vim.settings.insert("tabstop".to_string(), "4".to_string());
        vim.settings.insert("shiftwidth".to_string(), "4".to_string());
        
        vim
    }
}