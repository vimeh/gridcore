pub mod bulk_commands;
pub mod ex_commands;
pub mod factory;
pub mod parser;
pub mod types;

use crate::behaviors::vim::{VimBehavior, VimMode};
use crate::state::{Action, UIState};
use gridcore_core::Result;

pub use bulk_commands::BulkCommandParser;
pub use factory::CommandFactory;
pub use parser::CommandParser;
pub use types::{BulkCommandType, CommandRange, ExCommand};

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
        // First check if it's a bulk command
        let bulk_parser = BulkCommandParser::new();
        if let Some(bulk_cmd) = bulk_parser.parse(&format!(":{}", command_str)) {
            return Ok(Some(bulk_parser.to_action(bulk_cmd)));
        }

        // Parse as regular Ex command
        let parser = CommandParser::new();
        let parsed = parser.parse_ex_command(command_str)?;

        // Use factory to execute
        let factory = CommandFactory::new();
        factory.execute(self, &parsed)
    }

    /// Complete command based on current buffer
    pub fn complete_command(&mut self) -> Result<Option<Action>> {
        let factory = CommandFactory::new();
        let completions = factory.get_completions(&self.command_buffer);

        if completions.is_empty() {
            return Ok(None);
        }

        if completions.len() == 1 {
            // Single match - complete it
            self.command_buffer = completions[0].clone();
            Ok(Some(Action::UpdateCommandValue {
                value: format!(":{}", self.command_buffer),
            }))
        } else {
            // Multiple matches - show them
            // TODO: Implement showing multiple completions
            // For now, complete to common prefix
            let common = self.find_common_prefix(&completions);
            if common.len() > self.command_buffer.len() {
                self.command_buffer = common;
                Ok(Some(Action::UpdateCommandValue {
                    value: format!(":{}", self.command_buffer),
                }))
            } else {
                Ok(None)
            }
        }
    }

    /// Find common prefix among strings
    fn find_common_prefix(&self, strings: &[String]) -> String {
        if strings.is_empty() {
            return String::new();
        }

        let mut prefix = strings[0].clone();
        for s in &strings[1..] {
            while !s.starts_with(&prefix) && !prefix.is_empty() {
                prefix.pop();
            }
        }
        prefix
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_command_parser() {
        let parser = CommandParser::new();

        // Test simple command
        let result = parser.parse_ex_command("w").unwrap();
        assert_eq!(result.command, "w");
        assert!(result.range.is_none());
        assert!(result.args.is_empty());

        // Test command with range
        let result = parser.parse_ex_command("1,10d").unwrap();
        assert_eq!(result.command, "d");
        assert!(matches!(result.range, Some(CommandRange::Lines(1, 10))));

        // Test command with args
        let result = parser.parse_ex_command("set number").unwrap();
        assert_eq!(result.command, "set");
        assert_eq!(result.args, vec!["number"]);
    }

    #[test]
    fn test_bulk_command_parser() {
        let parser = BulkCommandParser::new();

        // Test find/replace
        let result = parser.parse(":s/foo/bar/g");
        assert!(result.is_some());
        if let Some(BulkCommandType::FindReplace {
            find_pattern,
            replace_with,
            options,
        }) = result
        {
            assert_eq!(find_pattern, "foo");
            assert_eq!(replace_with, "bar");
            assert!(options.global);
        }

        // Test math operation
        let result = parser.parse(":add 10");
        assert!(result.is_some());
        if let Some(BulkCommandType::MathOperation { operation, value }) = result {
            assert_eq!(operation, types::MathOp::Add);
            assert_eq!(value, 10.0);
        }
    }

    #[test]
    fn test_command_factory() {
        let factory = CommandFactory::new();

        // Test category lookup
        assert_eq!(
            factory.get_category("write"),
            Some(types::CommandCategory::FileOperations)
        );
        assert_eq!(
            factory.get_category("delete"),
            Some(types::CommandCategory::EditOperations)
        );

        // Test completions
        let completions = factory.get_completions("w");
        assert!(completions.contains(&"write".to_string()));
        assert!(completions.contains(&"wq".to_string()));
    }
}