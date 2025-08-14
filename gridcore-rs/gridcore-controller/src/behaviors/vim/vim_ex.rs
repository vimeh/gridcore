//! Consolidated Ex command execution
//! Handles all colon commands and bulk operations

use super::ex_parser::ExParser;
use super::vim_core::{CommandRange, ExCommand, VimResult};
use super::LegacyVimBehavior;
use crate::state::{Action, ParsedBulkCommand};
use gridcore_core::Result;

impl LegacyVimBehavior {
    /// Execute an Ex command string
    pub fn execute_ex_string(&mut self, command_str: &str) -> Result<Option<Action>> {
        // Parse the Ex command
        let command = ExParser::parse_ex(command_str)?;

        // Execute the parsed command
        match self.execute_ex_command(&command)? {
            VimResult::Action(action) => Ok(Some(action)),
            VimResult::ModeChange(mode) => {
                self.mode = mode;
                Ok(None)
            }
            VimResult::None => Ok(None),
            VimResult::Incomplete => Ok(None), // Command not complete yet
        }
    }

    /// Execute a parsed Ex command
    pub fn execute_ex_command(&mut self, command: &ExCommand) -> Result<VimResult> {
        match command.command.as_str() {
            // File operations
            "write" | "w" => self.execute_write(command),
            "quit" | "q" => self.execute_quit(command),
            "writequit" | "wq" | "x" => self.execute_write_quit(command),
            "edit" | "e" => self.execute_edit(command),

            // Navigation
            "goto" | "go" => self.execute_goto(command),

            // Editing operations
            "delete" | "d" => self.execute_ex_delete(command),
            "yank" | "y" => self.execute_ex_yank(command),
            "put" | "p" => self.execute_ex_put(command),
            "move" | "m" => self.execute_ex_move(command),
            "copy" | "t" => self.execute_ex_copy(command),
            "join" | "j" => self.execute_ex_join(command),

            // Substitution
            "substitute" | "s" => self.execute_substitute(command),
            "global" | "g" => self.execute_global(command),

            // Settings
            "set" => self.execute_set(command),

            // Shell commands
            "shell" | "!" => self.execute_shell(command),

            // Search
            "search_forward" => self.execute_search_forward(command),
            "search_backward" => self.execute_search_backward(command),

            _ => Ok(VimResult::None),
        }
    }

    /// Execute write command
    fn execute_write(&mut self, _command: &ExCommand) -> Result<VimResult> {
        // In spreadsheet context, this might trigger a save
        Ok(VimResult::None)
    }

    /// Execute quit command
    fn execute_quit(&mut self, _command: &ExCommand) -> Result<VimResult> {
        Ok(VimResult::Action(Action::ExitToNavigation))
    }

    /// Execute write and quit
    fn execute_write_quit(&mut self, _command: &ExCommand) -> Result<VimResult> {
        // Save and exit
        Ok(VimResult::Action(Action::ExitToNavigation))
    }

    /// Execute edit (reload/open file)
    fn execute_edit(&mut self, _command: &ExCommand) -> Result<VimResult> {
        // In spreadsheet context, might reload data
        Ok(VimResult::None)
    }

    /// Execute goto line
    fn execute_goto(&mut self, command: &ExCommand) -> Result<VimResult> {
        if let Some(range) = &command.range {
            let line = self.resolve_range_line(range);
            Ok(VimResult::Action(Action::UpdateCursor {
                cursor: gridcore_core::types::CellAddress::new(0, line),
            }))
        } else {
            Ok(VimResult::None)
        }
    }

    /// Execute delete lines
    fn execute_ex_delete(&mut self, command: &ExCommand) -> Result<VimResult> {
        let (start, end) = self.resolve_range(command);
        let rows: Vec<u32> = (start..=end).collect();

        Ok(VimResult::Action(Action::StartDelete {
            targets: rows,
            delete_type: crate::state::DeleteType::Row,
        }))
    }

    /// Execute yank lines
    fn execute_ex_yank(&mut self, command: &ExCommand) -> Result<VimResult> {
        let (start, end) = self.resolve_range(command);

        // Store in register
        let reg = command
            .args
            .first()
            .and_then(|s| s.chars().next())
            .unwrap_or('0');

        self.registers
            .insert(reg, format!("Lines {}-{}", start, end));
        Ok(VimResult::None)
    }

    /// Execute put (paste)
    fn execute_ex_put(&mut self, command: &ExCommand) -> Result<VimResult> {
        let reg = command
            .args
            .first()
            .and_then(|s| s.chars().next())
            .unwrap_or('"');

        if let Some(_content) = self.registers.get(&reg) {
            // TODO: Implement paste at line
        }

        Ok(VimResult::None)
    }

    /// Execute move lines
    fn execute_ex_move(&mut self, command: &ExCommand) -> Result<VimResult> {
        let (_start, _end) = self.resolve_range(command);
        let _target = command
            .args
            .first()
            .and_then(|s| s.parse::<u32>().ok())
            .unwrap_or(0);

        // TODO: Implement move rows
        Ok(VimResult::None)
    }

    /// Execute copy lines
    fn execute_ex_copy(&mut self, command: &ExCommand) -> Result<VimResult> {
        let (_start, _end) = self.resolve_range(command);
        let _target = command
            .args
            .first()
            .and_then(|s| s.parse::<u32>().ok())
            .unwrap_or(0);

        // TODO: Implement copy rows
        Ok(VimResult::None)
    }

    /// Execute join lines
    fn execute_ex_join(&mut self, command: &ExCommand) -> Result<VimResult> {
        let (_start, _end) = self.resolve_range(command);

        // In spreadsheet context, might concatenate cell values
        Ok(VimResult::None)
    }

    /// Execute substitute command
    fn execute_substitute(&mut self, command: &ExCommand) -> Result<VimResult> {
        if command.args.len() < 2 {
            return Ok(VimResult::None);
        }

        let find_pattern = &command.args[0];
        let replace_with = &command.args[1];
        let global = command.flags.contains(&"g".to_string());
        let case_sensitive = !command.flags.contains(&"i".to_string());

        let bulk_command = ParsedBulkCommand::FindReplace {
            pattern: find_pattern.clone(),
            replacement: replace_with.clone(),
            case_sensitive,
            global,
        };

        Ok(VimResult::Action(Action::StartBulkOperation {
            parsed_command: bulk_command,
            affected_cells: None,
        }))
    }

    /// Execute global command
    fn execute_global(&mut self, command: &ExCommand) -> Result<VimResult> {
        // Global command applies an Ex command to all matching lines
        // For spreadsheets, this might apply to matching cells
        if command.args.is_empty() {
            return Ok(VimResult::None);
        }

        let _pattern = &command.args[0];
        // TODO: Implement global command

        Ok(VimResult::None)
    }

    /// Execute set command
    fn execute_set(&mut self, command: &ExCommand) -> Result<VimResult> {
        for arg in &command.args {
            if let Some((key, value)) = arg.split_once('=') {
                self._settings.insert(key.to_string(), value.to_string());
            } else if let Some(stripped) = arg.strip_prefix("no") {
                // Toggle option off
                self._settings
                    .insert(stripped.to_string(), "false".to_string());
            } else {
                // Toggle option on
                self._settings.insert(arg.to_string(), "true".to_string());
            }
        }

        Ok(VimResult::None)
    }

    /// Execute shell command
    fn execute_shell(&mut self, command: &ExCommand) -> Result<VimResult> {
        // Shell commands not supported in spreadsheet context
        let _ = command;
        Ok(VimResult::None)
    }

    /// Execute forward search
    fn execute_search_forward(&mut self, command: &ExCommand) -> Result<VimResult> {
        if let Some(pattern) = command.args.first() {
            // TODO: Implement search
            let _ = pattern;
        }
        Ok(VimResult::None)
    }

    /// Execute backward search
    fn execute_search_backward(&mut self, command: &ExCommand) -> Result<VimResult> {
        if let Some(pattern) = command.args.first() {
            // TODO: Implement backward search
            let _ = pattern;
        }
        Ok(VimResult::None)
    }

    /// Resolve a range to start and end line numbers
    fn resolve_range(&self, command: &ExCommand) -> (u32, u32) {
        if let Some(range) = &command.range {
            match range {
                CommandRange::AllLines => (0, u32::MAX),
                CommandRange::CurrentLine => {
                    let line = 0; // TODO: Get current line
                    (line, line)
                }
                CommandRange::Line(n) => (*n, *n),
                CommandRange::LastLine => (u32::MAX, u32::MAX),
                CommandRange::Range(start, end) => {
                    let start_line = self.resolve_range_line(start);
                    let end_line = self.resolve_range_line(end);
                    (start_line, end_line)
                }
                _ => (0, 0),
            }
        } else {
            // Default to current line
            let line = 0; // TODO: Get current line
            (line, line)
        }
    }

    /// Resolve a single range specifier to a line number
    fn resolve_range_line(&self, range: &CommandRange) -> u32 {
        match range {
            CommandRange::Line(n) => *n,
            CommandRange::CurrentLine => 0, // TODO: Get current line
            CommandRange::LastLine => u32::MAX,
            CommandRange::AllLines => 0,
            _ => 0,
        }
    }
}
