use super::types::{CommandRange, ExCommand};
use gridcore_core::{Result, SpreadsheetError};

/// Core command parsing functionality
pub struct CommandParser;

impl CommandParser {
    pub fn new() -> Self {
        Self
    }

    /// Parse an Ex command string into structured command
    pub fn parse_ex_command(&self, command_str: &str) -> Result<ExCommand> {
        let trimmed = command_str.trim();
        
        // Extract range if present
        let (range_str, command_part) = self.split_range_and_command(trimmed);
        
        // Parse range
        let range = if !range_str.is_empty() {
            self.parse_range(range_str)?
        } else {
            None
        };
        
        // Parse command and arguments
        let (command, args, flags) = self.parse_command_part(command_part);
        
        Ok(ExCommand {
            range,
            command,
            args,
            flags,
        })
    }

    /// Split command into range and command parts
    fn split_range_and_command<'a>(&self, input: &'a str) -> (&'a str, &'a str) {
        // Check for line number at start
        if let Some(idx) = input.find(|c: char| c.is_alphabetic() || c == '!' || c == '/') {
            if idx > 0 {
                let range_part = &input[..idx];
                let command_part = &input[idx..];
                
                // Validate range part contains valid range characters
                if range_part.chars().all(|c| c.is_numeric() || c == ',' || c == '%' || c == '.' || c == '$' || c == '\'' || c == '-' || c == '+') {
                    return (range_part, command_part);
                }
            }
        }
        
        // Check for special range prefixes
        if input.starts_with('%') || input.starts_with("'<,'>") {
            if let Some(idx) = input.find(|c: char| c.is_alphabetic()) {
                return (&input[..idx], &input[idx..]);
            }
        }
        
        // No range found
        ("", input)
    }

    /// Parse range specification
    pub fn parse_range(&self, range_str: &str) -> Result<Option<CommandRange>> {
        if range_str.is_empty() {
            return Ok(None);
        }
        
        match range_str {
            "%" => Ok(Some(CommandRange::All)),
            "." => Ok(Some(CommandRange::Current)),
            "'<,'>" => Ok(Some(CommandRange::Visual)),
            _ => {
                // Check for line number(s)
                if let Ok(line) = range_str.parse::<u32>() {
                    Ok(Some(CommandRange::Line(line)))
                } else if range_str.contains(',') {
                    let parts: Vec<&str> = range_str.split(',').collect();
                    if parts.len() == 2 {
                        let start = self.parse_line_spec(parts[0])?;
                        let end = self.parse_line_spec(parts[1])?;
                        Ok(Some(CommandRange::Lines(start, end)))
                    } else {
                        Err(SpreadsheetError::InvalidCommand(format!("Invalid range: {}", range_str)))
                    }
                } else if range_str.starts_with('\'') && range_str.len() >= 2 {
                    // Mark range
                    let marks = range_str.chars().filter(|c| c.is_alphabetic()).collect::<Vec<_>>();
                    if marks.len() == 2 {
                        Ok(Some(CommandRange::Marks(marks[0], marks[1])))
                    } else {
                        Err(SpreadsheetError::InvalidCommand(format!("Invalid mark range: {}", range_str)))
                    }
                } else {
                    Err(SpreadsheetError::InvalidCommand(format!("Invalid range: {}", range_str)))
                }
            }
        }
    }

    /// Parse a line specification (number, ., $, etc.)
    fn parse_line_spec(&self, spec: &str) -> Result<u32> {
        match spec.trim() {
            "." => Ok(0), // Current line, will be resolved by executor
            "$" => Ok(u32::MAX), // Last line, will be resolved by executor
            s => s.parse::<u32>()
                .map_err(|_| SpreadsheetError::InvalidCommand(format!("Invalid line number: {}", s)))
        }
    }

    /// Parse command part into command, args, and flags
    fn parse_command_part(&self, command_part: &str) -> (String, Vec<String>, Vec<String>) {
        let parts: Vec<&str> = command_part.split_whitespace().collect();
        
        if parts.is_empty() {
            return (String::new(), Vec::new(), Vec::new());
        }
        
        let command = parts[0].to_string();
        let mut args = Vec::new();
        let mut flags = Vec::new();
        
        for part in &parts[1..] {
            if part.starts_with('-') || part.starts_with('+') {
                flags.push(part.to_string());
            } else {
                args.push(part.to_string());
            }
        }
        
        (command, args, flags)
    }

    /// Parse substitute command arguments
    pub fn parse_substitute_args(&self, args: &[String]) -> Result<(String, String, Vec<String>)> {
        if args.is_empty() {
            return Err(SpreadsheetError::InvalidCommand("Substitute requires pattern".to_string()));
        }
        
        let arg = args.join(" ");
        let parts: Vec<&str> = arg.splitn(3, '/').collect();
        
        if parts.len() < 2 {
            return Err(SpreadsheetError::InvalidCommand("Invalid substitute pattern".to_string()));
        }
        
        let pattern = parts[0].to_string();
        let replacement = parts.get(1).unwrap_or(&"").to_string();
        let flags = if parts.len() > 2 {
            parts[2].chars().map(|c| c.to_string()).collect()
        } else {
            Vec::new()
        };
        
        Ok((pattern, replacement, flags))
    }
}

impl Default for CommandParser {
    fn default() -> Self {
        Self::new()
    }
}