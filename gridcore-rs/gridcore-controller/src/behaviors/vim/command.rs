use super::{VimBehavior, VimMode};
use crate::state::{Action, ParsedBulkCommand, UIState};
use gridcore_core::{Result, SpreadsheetError};

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
    pub fn handle_command_mode(
        &mut self,
        key: &str,
        _current_state: &UIState,
    ) -> Result<Option<Action>> {
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

            _ => Err(SpreadsheetError::InvalidOperation(format!(
                "Unknown command: {}",
                parsed.command
            ))),
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
        let (args, flags): (Vec<_>, Vec<_>) =
            args.into_iter().partition(|arg| !arg.starts_with('-'));

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
                        if let (Ok(start), Ok(end)) =
                            (parts[0].parse::<u32>(), parts[1].parse::<u32>())
                        {
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
            "write",
            "quit",
            "wq",
            "edit",
            "substitute",
            "global",
            "delete",
            "yank",
            "put",
            "copy",
            "move",
            "set",
            "help",
            "format",
            "sort",
            "filter",
            "formula",
            "chart",
        ];

        let prefix = self.command_buffer.clone();
        let matches: Vec<&str> = commands
            .iter()
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
                self.settings
                    .insert(setting.to_string(), "false".to_string());
            } else if arg.contains('=') {
                // Set value
                let parts: Vec<&str> = arg.splitn(2, '=').collect();
                if parts.len() == 2 {
                    self.settings
                        .insert(parts[0].to_string(), parts[1].to_string());
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
            Some(CommandRange::Lines(start, end)) => (*start..=*end).map(|n| n - 1).collect(),
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
        vim.settings
            .insert("number".to_string(), "true".to_string());
        vim.settings
            .insert("relativenumber".to_string(), "false".to_string());
        vim.settings.insert("wrap".to_string(), "true".to_string());
        vim.settings
            .insert("expandtab".to_string(), "true".to_string());
        vim.settings.insert("tabstop".to_string(), "4".to_string());
        vim.settings
            .insert("shiftwidth".to_string(), "4".to_string());

        vim
    }
}

/// Bulk command types for spreadsheet operations
#[derive(Debug, Clone, PartialEq)]
pub enum BulkCommandType {
    FindReplace {
        find_pattern: String,
        replace_with: String,
        options: FindReplaceOptions,
    },
    BulkSet {
        value: String,
        requires_selection: bool,
    },
    MathOperation {
        operation: MathOp,
        value: f64,
    },
    Fill {
        direction: FillDirection,
    },
    Transform {
        transformation: TransformType,
    },
    Format {
        format_type: FormatType,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub struct FindReplaceOptions {
    pub global: bool,
    pub case_sensitive: bool,
    pub scope: SearchScope,
}

#[derive(Debug, Clone, PartialEq)]
pub enum SearchScope {
    Selection,
    Sheet,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum MathOp {
    Add,
    Sub,
    Mul,
    Div,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum FillDirection {
    Down,
    Up,
    Left,
    Right,
    Series,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum TransformType {
    Upper,
    Lower,
    Trim,
    Clean,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum FormatType {
    Currency,
    Percent,
    Date,
    Number,
}

/// Parser for bulk commands in vim command mode
pub struct BulkCommandParser;

impl BulkCommandParser {
    pub fn new() -> Self {
        Self
    }

    /// Parse a command string into a BulkCommandType
    pub fn parse(&self, command: &str) -> Option<BulkCommandType> {
        if !command.starts_with(':') {
            return None;
        }

        let cmd = &command[1..]; // Remove leading colon

        // Check for find/replace pattern
        if cmd.starts_with("s/") || cmd.starts_with("%s/") {
            return self.parse_find_replace(cmd);
        }

        // Parse other commands
        let parts: Vec<&str> = cmd.split_whitespace().collect();
        if parts.is_empty() {
            return None;
        }

        match parts[0] {
            "set" => self.parse_set(&parts[1..]),
            "add" => self.parse_math_op(MathOp::Add, &parts[1..]),
            "sub" => self.parse_math_op(MathOp::Sub, &parts[1..]),
            "mul" => self.parse_math_op(MathOp::Mul, &parts[1..]),
            "div" => self.parse_math_op(MathOp::Div, &parts[1..]),
            "fill" => self.parse_fill(&parts[1..]),
            "upper" => Some(BulkCommandType::Transform {
                transformation: TransformType::Upper,
            }),
            "lower" => Some(BulkCommandType::Transform {
                transformation: TransformType::Lower,
            }),
            "trim" => Some(BulkCommandType::Transform {
                transformation: TransformType::Trim,
            }),
            "clean" => Some(BulkCommandType::Transform {
                transformation: TransformType::Clean,
            }),
            "format" => self.parse_format(&parts[1..]),
            _ => None,
        }
    }

    fn parse_find_replace(&self, cmd: &str) -> Option<BulkCommandType> {
        let (scope, pattern) = if cmd.starts_with("%s/") {
            (SearchScope::Sheet, &cmd[3..])
        } else {
            (SearchScope::Selection, &cmd[2..])
        };

        // Find the delimiter positions
        let mut parts = Vec::new();
        let mut current = String::new();
        let mut escaped = false;

        let mut chars = pattern.chars().peekable();
        while let Some(ch) = chars.next() {
            if escaped {
                current.push(ch);
                escaped = false;
            } else if ch == '\\' {
                current.push(ch);
                escaped = true;
            } else if ch == '/' {
                parts.push(current);
                current = String::new();
                if parts.len() == 2 {
                    // Everything remaining is flags
                    while let Some(ch) = chars.next() {
                        current.push(ch);
                    }
                    break;
                }
            } else {
                current.push(ch);
            }
        }

        // The last part is either the replacement (if no trailing /) or flags
        if parts.len() == 1 {
            // No replacement found
            return None;
        } else if parts.len() == 2 && !current.is_empty() {
            // Current contains flags
        } else if parts.len() < 2 {
            return None;
        }

        let flags = current;
        let global = flags.contains('g');
        let case_sensitive = !flags.contains('i');

        Some(BulkCommandType::FindReplace {
            find_pattern: parts[0].clone(),
            replace_with: parts.get(1).cloned().unwrap_or_default(),
            options: FindReplaceOptions {
                global,
                case_sensitive,
                scope,
            },
        })
    }

    fn parse_set(&self, args: &[&str]) -> Option<BulkCommandType> {
        if args.is_empty() {
            return None;
        }

        let value = args.join(" ");
        Some(BulkCommandType::BulkSet {
            value,
            requires_selection: true,
        })
    }

    fn parse_math_op(&self, op: MathOp, args: &[&str]) -> Option<BulkCommandType> {
        if args.is_empty() {
            return None;
        }

        args[0]
            .parse::<f64>()
            .ok()
            .map(|value| BulkCommandType::MathOperation {
                operation: op,
                value,
            })
    }

    fn parse_fill(&self, args: &[&str]) -> Option<BulkCommandType> {
        if args.is_empty() {
            return None;
        }

        let direction = match args[0] {
            "down" => FillDirection::Down,
            "up" => FillDirection::Up,
            "left" => FillDirection::Left,
            "right" => FillDirection::Right,
            "series" => FillDirection::Series,
            _ => return None,
        };

        Some(BulkCommandType::Fill { direction })
    }

    fn parse_format(&self, args: &[&str]) -> Option<BulkCommandType> {
        if args.is_empty() {
            return None;
        }

        let format_type = match args[0] {
            "currency" => FormatType::Currency,
            "percent" => FormatType::Percent,
            "date" => FormatType::Date,
            "number" => FormatType::Number,
            _ => return None,
        };

        Some(BulkCommandType::Format { format_type })
    }

    /// Get command completions for a partial command
    pub fn get_completions(&self, partial: &str) -> Vec<String> {
        if !partial.starts_with(':') {
            return vec![];
        }

        let cmd = &partial[1..].to_lowercase();
        let mut completions = vec![];

        // All available commands
        let commands = [
            ("set ", "Set value in cells"),
            ("sub ", "Subtract from cells"),
            ("add ", "Add to cells"),
            ("mul ", "Multiply cells"),
            ("div ", "Divide cells"),
            ("fill ", "Fill cells"),
            ("upper", "Convert to uppercase"),
            ("lower", "Convert to lowercase"),
            ("trim", "Trim whitespace"),
            ("clean", "Clean text"),
            ("format ", "Format cells"),
        ];

        for (command, _) in commands {
            if command.starts_with(cmd) {
                completions.push(format!(":{}", command));
            }
        }

        // Special handling for :fill command
        if cmd.starts_with("fill") && !cmd.contains(' ') {
            completions.clear();
            for dir in ["down", "up", "left", "right", "series"] {
                completions.push(format!(":fill {}", dir));
            }
        }

        completions
    }

    /// Validate a parsed command
    pub fn validate_command(
        &self,
        command: &BulkCommandType,
        has_selection: bool,
    ) -> Option<String> {
        match command {
            BulkCommandType::BulkSet {
                requires_selection, ..
            } => {
                if *requires_selection && !has_selection {
                    Some("This operation requires a selection".to_string())
                } else {
                    None
                }
            }
            BulkCommandType::FindReplace { find_pattern, .. } => {
                if find_pattern.is_empty() {
                    Some("Find pattern cannot be empty".to_string())
                } else {
                    // Try to compile as regex to validate
                    match regex::Regex::new(find_pattern) {
                        Ok(_) => None,
                        Err(e) => Some(format!("Invalid regex pattern: {}", e)),
                    }
                }
            }
            BulkCommandType::MathOperation {
                operation: MathOp::Div,
                value,
            } => {
                if *value == 0.0 {
                    Some("Cannot divide by zero".to_string())
                } else {
                    None
                }
            }
            BulkCommandType::Format { format_type } => {
                // Validate format type (already validated in parse)
                match format_type {
                    FormatType::Currency
                    | FormatType::Percent
                    | FormatType::Date
                    | FormatType::Number => None,
                }
            }
            _ => None,
        }
    }

    /// Get help text for bulk commands
    pub fn get_help_text(&self) -> String {
        r#"Bulk Command Help:

Find & Replace:
  :s/pattern/replacement/g    - Replace in selection
  :%s/pattern/replacement/gi  - Replace in entire sheet (case-insensitive)

Math Operations:
  :add 10    - Add 10 to selected cells
  :sub 5     - Subtract 5 from selected cells
  :mul 2     - Multiply selected cells by 2
  :div 4     - Divide selected cells by 4

Fill Operations:
  :fill down   - Fill down from first cell
  :fill up     - Fill up from last cell
  :fill left   - Fill left from rightmost cell
  :fill right  - Fill right from leftmost cell
  :fill series - Fill with incrementing series

Text Transformations:
  :upper  - Convert to uppercase
  :lower  - Convert to lowercase
  :trim   - Remove leading/trailing whitespace
  :clean  - Clean text (remove non-printable characters)

Formatting:
  :format currency  - Format as currency
  :format percent   - Format as percentage
  :format date      - Format as date
  :format number    - Format as number

Set Value:
  :set Hello World  - Set all selected cells to "Hello World"
  :set =A1+B1      - Set formula in selected cells
"#
        .to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_parser() -> BulkCommandParser {
        BulkCommandParser::new()
    }

    mod find_replace_tests {
        use super::*;

        #[test]
        fn test_basic_find_replace() {
            let parser = create_parser();
            let cmd = parser.parse(":s/old/new/g").unwrap();

            match cmd {
                BulkCommandType::FindReplace {
                    find_pattern,
                    replace_with,
                    options,
                } => {
                    assert_eq!(find_pattern, "old");
                    assert_eq!(replace_with, "new");
                    assert!(options.global);
                    assert!(options.case_sensitive);
                    assert_eq!(options.scope, SearchScope::Selection);
                }
                _ => panic!("Expected FindReplace command"),
            }
        }

        #[test]
        fn test_sheet_wide_find_replace() {
            let parser = create_parser();
            let cmd = parser.parse(":%s/old/new/gi").unwrap();

            match cmd {
                BulkCommandType::FindReplace { options, .. } => {
                    assert_eq!(options.scope, SearchScope::Sheet);
                    assert!(options.global);
                    assert!(!options.case_sensitive);
                }
                _ => panic!("Expected FindReplace command"),
            }
        }

        #[test]
        fn test_find_replace_without_flags() {
            let parser = create_parser();
            let cmd = parser.parse(":s/test/result/").unwrap();

            match cmd {
                BulkCommandType::FindReplace {
                    find_pattern,
                    replace_with,
                    options,
                } => {
                    assert_eq!(find_pattern, "test");
                    assert_eq!(replace_with, "result");
                    assert!(!options.global);
                    assert!(options.case_sensitive);
                }
                _ => panic!("Expected FindReplace command"),
            }
        }

        #[test]
        fn test_complex_patterns() {
            let parser = create_parser();
            let cmd = parser.parse(r":s/\d+\.\d+/NUMBER/g").unwrap();

            match cmd {
                BulkCommandType::FindReplace {
                    find_pattern,
                    replace_with,
                    ..
                } => {
                    assert_eq!(find_pattern, r"\d+\.\d+");
                    assert_eq!(replace_with, "NUMBER");
                }
                _ => panic!("Expected FindReplace command"),
            }
        }
    }

    mod bulk_set_tests {
        use super::*;

        #[test]
        fn test_bulk_set_text() {
            let parser = create_parser();
            let cmd = parser.parse(":set Hello World").unwrap();

            match cmd {
                BulkCommandType::BulkSet {
                    value,
                    requires_selection,
                } => {
                    assert_eq!(value, "Hello World");
                    assert!(requires_selection);
                }
                _ => panic!("Expected BulkSet command"),
            }
        }

        #[test]
        fn test_bulk_set_number() {
            let parser = create_parser();
            let cmd = parser.parse(":set 42").unwrap();

            match cmd {
                BulkCommandType::BulkSet { value, .. } => {
                    assert_eq!(value, "42");
                }
                _ => panic!("Expected BulkSet command"),
            }
        }

        #[test]
        fn test_bulk_set_formula() {
            let parser = create_parser();
            let cmd = parser.parse(":set =A1+B1").unwrap();

            match cmd {
                BulkCommandType::BulkSet { value, .. } => {
                    assert_eq!(value, "=A1+B1");
                }
                _ => panic!("Expected BulkSet command"),
            }
        }
    }

    mod math_operation_tests {
        use super::*;

        #[test]
        fn test_add_command() {
            let parser = create_parser();
            let cmd = parser.parse(":add 10").unwrap();

            match cmd {
                BulkCommandType::MathOperation { operation, value } => {
                    assert_eq!(operation, MathOp::Add);
                    assert_eq!(value, 10.0);
                }
                _ => panic!("Expected MathOperation command"),
            }
        }

        #[test]
        fn test_subtract_with_decimal() {
            let parser = create_parser();
            let cmd = parser.parse(":sub 3.14").unwrap();

            match cmd {
                BulkCommandType::MathOperation { operation, value } => {
                    assert_eq!(operation, MathOp::Sub);
                    assert_eq!(value, 3.14);
                }
                _ => panic!("Expected MathOperation command"),
            }
        }

        #[test]
        fn test_multiply_command() {
            let parser = create_parser();
            let cmd = parser.parse(":mul 2").unwrap();

            match cmd {
                BulkCommandType::MathOperation { operation, value } => {
                    assert_eq!(operation, MathOp::Mul);
                    assert_eq!(value, 2.0);
                }
                _ => panic!("Expected MathOperation command"),
            }
        }

        #[test]
        fn test_divide_command() {
            let parser = create_parser();
            let cmd = parser.parse(":div 4").unwrap();

            match cmd {
                BulkCommandType::MathOperation { operation, value } => {
                    assert_eq!(operation, MathOp::Div);
                    assert_eq!(value, 4.0);
                }
                _ => panic!("Expected MathOperation command"),
            }
        }

        #[test]
        fn test_negative_numbers() {
            let parser = create_parser();
            let cmd = parser.parse(":add -5").unwrap();

            match cmd {
                BulkCommandType::MathOperation { value, .. } => {
                    assert_eq!(value, -5.0);
                }
                _ => panic!("Expected MathOperation command"),
            }
        }
    }

    mod fill_tests {
        use super::*;

        #[test]
        fn test_fill_down() {
            let parser = create_parser();
            let cmd = parser.parse(":fill down").unwrap();

            match cmd {
                BulkCommandType::Fill { direction } => {
                    assert_eq!(direction, FillDirection::Down);
                }
                _ => panic!("Expected Fill command"),
            }
        }

        #[test]
        fn test_all_fill_directions() {
            let parser = create_parser();
            let directions = [
                ("down", FillDirection::Down),
                ("up", FillDirection::Up),
                ("left", FillDirection::Left),
                ("right", FillDirection::Right),
                ("series", FillDirection::Series),
            ];

            for (dir_str, expected) in directions {
                let cmd = parser.parse(&format!(":fill {}", dir_str)).unwrap();
                match cmd {
                    BulkCommandType::Fill { direction } => {
                        assert_eq!(direction, expected);
                    }
                    _ => panic!("Expected Fill command"),
                }
            }
        }
    }

    mod transform_tests {
        use super::*;

        #[test]
        fn test_transform_commands() {
            let parser = create_parser();
            let transforms = [
                ("upper", TransformType::Upper),
                ("lower", TransformType::Lower),
                ("trim", TransformType::Trim),
                ("clean", TransformType::Clean),
            ];

            for (cmd_str, expected) in transforms {
                let cmd = parser.parse(&format!(":{}", cmd_str)).unwrap();
                match cmd {
                    BulkCommandType::Transform { transformation } => {
                        assert_eq!(transformation, expected);
                    }
                    _ => panic!("Expected Transform command"),
                }
            }
        }
    }

    mod format_tests {
        use super::*;

        #[test]
        fn test_format_commands() {
            let parser = create_parser();
            let formats = [
                ("currency", FormatType::Currency),
                ("percent", FormatType::Percent),
                ("date", FormatType::Date),
                ("number", FormatType::Number),
            ];

            for (fmt_str, expected) in formats {
                let cmd = parser.parse(&format!(":format {}", fmt_str)).unwrap();
                match cmd {
                    BulkCommandType::Format { format_type } => {
                        assert_eq!(format_type, expected);
                    }
                    _ => panic!("Expected Format command"),
                }
            }
        }
    }

    mod completion_tests {
        use super::*;

        #[test]
        fn test_completions_for_partial() {
            let parser = create_parser();
            let completions = parser.get_completions(":s");
            assert!(completions.contains(&":set ".to_string()));
            assert!(completions.contains(&":sub ".to_string()));
        }

        #[test]
        fn test_completions_for_fill() {
            let parser = create_parser();
            let completions = parser.get_completions(":fill");
            assert!(completions.contains(&":fill down".to_string()));
            assert!(completions.contains(&":fill series".to_string()));
        }

        #[test]
        fn test_empty_completions_for_non_command() {
            let parser = create_parser();
            let completions = parser.get_completions("hello");
            assert!(completions.is_empty());
        }

        #[test]
        fn test_case_insensitive_completions() {
            let parser = create_parser();
            let completions = parser.get_completions(":SET");
            assert!(completions.contains(&":set ".to_string()));
        }
    }

    mod validation_tests {
        use super::*;

        #[test]
        fn test_validate_requires_selection() {
            let parser = create_parser();
            let cmd = BulkCommandType::BulkSet {
                value: "test".to_string(),
                requires_selection: true,
            };

            let error = parser.validate_command(&cmd, false);
            assert_eq!(
                error,
                Some("This operation requires a selection".to_string())
            );

            let no_error = parser.validate_command(&cmd, true);
            assert!(no_error.is_none());
        }

        #[test]
        fn test_validate_empty_find_pattern() {
            let parser = create_parser();
            let cmd = BulkCommandType::FindReplace {
                find_pattern: "".to_string(),
                replace_with: "replacement".to_string(),
                options: FindReplaceOptions {
                    global: true,
                    case_sensitive: true,
                    scope: SearchScope::Selection,
                },
            };

            let error = parser.validate_command(&cmd, false);
            assert_eq!(error, Some("Find pattern cannot be empty".to_string()));
        }

        #[test]
        fn test_validate_division_by_zero() {
            let parser = create_parser();
            let cmd = BulkCommandType::MathOperation {
                operation: MathOp::Div,
                value: 0.0,
            };

            let error = parser.validate_command(&cmd, true);
            assert_eq!(error, Some("Cannot divide by zero".to_string()));
        }
    }

    mod invalid_command_tests {
        use super::*;

        #[test]
        fn test_invalid_commands() {
            let parser = create_parser();
            let invalid_commands = [
                ":invalid",
                ":set",          // missing value
                ":add",          // missing number
                ":add text",     // non-numeric value
                ":fill invalid", // invalid direction
            ];

            for cmd in invalid_commands {
                assert!(parser.parse(cmd).is_none());
            }
        }

        #[test]
        fn test_non_colon_commands() {
            let parser = create_parser();
            assert!(parser.parse("not a command").is_none());
        }
    }

    mod help_tests {
        use super::*;

        #[test]
        fn test_help_text() {
            let parser = create_parser();
            let help = parser.get_help_text();
            assert!(help.contains("Find & Replace"));
            assert!(help.contains("Math Operations"));
            assert!(help.contains(":s/pattern/replacement/g"));
        }
    }
}
