//! Ex command parser using chumsky parser combinators
//! Handles colon commands like :w, :q, :s/foo/bar/, etc.

use super::vim_core::{CommandRange, ExCommand};
use chumsky::prelude::*;
use gridcore_core::{Result, SpreadsheetError};

/// Ex command parser for vim colon commands
pub struct ExParser;

impl ExParser {
    /// Parse an Ex command (without the leading colon)
    pub fn parse_ex(input: &str) -> Result<ExCommand> {
        // Remove leading colon if present
        let input = input.trim_start_matches(':');

        match Self::ex_parser().parse(input).into_result() {
            Ok(cmd) => Ok(cmd),
            Err(errors) => {
                let msg = errors
                    .iter()
                    .map(|e| format!("{:?}", e))
                    .collect::<Vec<_>>()
                    .join("; ");
                Err(SpreadsheetError::InvalidCommand(format!(
                    "Ex parse error: {}",
                    msg
                )))
            }
        }
    }

    /// Build the Ex command parser
    fn ex_parser<'a>() -> impl Parser<'a, &'a str, ExCommand, extra::Err<Rich<'a, char>>> {
        let range = Self::range_parser().or_not();
        let command = Self::command_name_parser();
        let args = Self::args_parser();

        range
            .then(command)
            .then(args)
            .map(|((range, cmd), (args, flags))| ExCommand {
                range,
                command: cmd,
                args,
                flags,
            })
    }

    /// Parse range specifications
    fn range_parser<'a>() -> impl Parser<'a, &'a str, CommandRange, extra::Err<Rich<'a, char>>> {
        recursive(|_range| {
            // Relative ranges (+5, -3)
            let relative = choice((
                just('+')
                    .ignore_then(text::int(10).from_str().unwrapped())
                    .map(|n| CommandRange::RelativeForward(Box::new(CommandRange::CurrentLine), n)),
                just('-')
                    .ignore_then(text::int(10).from_str().unwrapped())
                    .map(|n| {
                        CommandRange::RelativeBackward(Box::new(CommandRange::CurrentLine), n)
                    }),
            ));

            // Single line specifications
            let line_spec = choice((
                just('%').to(CommandRange::AllLines),
                just('.').to(CommandRange::CurrentLine),
                just('$').to(CommandRange::LastLine),
                text::int(10).from_str().unwrapped().map(CommandRange::Line),
                // Visual selection range
                just("'<,'>").to(CommandRange::AllLines), // Simplified for now
                // Mark-based range 'a,'b
                just('\'')
                    .ignore_then(any())
                    .then(just(',').then(just('\'')).then(any()))
                    .map(|(_start, (_, _end))| {
                        // For now, treat mark ranges as all lines
                        CommandRange::AllLines
                    }),
            ));

            // Range element can be a line spec or relative
            let range_element = choice((line_spec.clone(), relative.clone()));

            // Range with comma (e.g., 1,10 or .,$ or .,+5)
            let range_pair = range_element
                .clone()
                .then(just(',').ignore_then(range_element.clone()))
                .map(|(start, end)| CommandRange::Range(Box::new(start), Box::new(end)));

            choice((range_pair, relative, line_spec))
        })
    }

    /// Parse command names
    fn command_name_parser<'a>() -> impl Parser<'a, &'a str, String, extra::Err<Rich<'a, char>>> {
        // Common abbreviated commands - longer patterns first to avoid ambiguity
        let abbreviations = choice((
            just("wq").to("writequit"),
            just("set").to("set"),
            just("w").to("write"),
            just("q").to("quit"),
            just("x").to("exit"),
            just("e").to("edit"),
            just("r").to("read"),
            just("s").to("substitute"),
            just("g").to("global"),
            just("v").to("vglobal"),
            just("d").to("delete"),
            just("y").to("yank"),
            just("p").to("put"),
            just("m").to("move"),
            just("t").to("copy"),
            just("j").to("join"),
            just("!").to("shell"),
        ));

        // Full command names
        let full_command = text::ident();

        // Try abbreviations first, then full commands
        abbreviations.or(full_command).map(String::from)
    }

    /// Parse command arguments and flags
    fn args_parser<'a>(
    ) -> impl Parser<'a, &'a str, (Vec<String>, Vec<String>), extra::Err<Rich<'a, char>>> {
        // Special handling for substitute command
        let substitute_args = just("/")
            .ignore_then(none_of("/").repeated().to_slice())
            .then(
                just("/")
                    .ignore_then(none_of("/").repeated().to_slice())
                    .or_not(),
            )
            .then(
                just("/")
                    .ignore_then(
                        any()
                            .filter(|c: &char| c.is_alphabetic())
                            .repeated()
                            .to_slice(),
                    )
                    .or_not(),
            )
            .map(
                |((pattern, replacement), flags): ((&str, Option<&str>), Option<&str>)| {
                    let mut args = vec![pattern.to_string()];
                    if let Some(repl) = replacement {
                        args.push(repl.to_string());
                    }
                    let flags = flags
                        .map(|f| f.chars().map(|c| c.to_string()).collect())
                        .unwrap_or_default();
                    (args, flags)
                },
            );

        // Regular arguments (space-separated)
        let regular_args = text::whitespace()
            .ignore_then(
                none_of(" \t\n")
                    .repeated()
                    .at_least(1)
                    .to_slice()
                    .separated_by(text::whitespace())
                    .collect::<Vec<_>>(),
            )
            .or_not()
            .map(|args: Option<Vec<&str>>| {
                let args = args.unwrap_or_default();
                // Separate flags from arguments
                let mut regular_args = Vec::new();
                let mut flags = Vec::new();

                for arg in args {
                    if arg.starts_with('-') || arg.starts_with('+') {
                        flags.push(arg.to_string());
                    } else {
                        regular_args.push(arg.to_string());
                    }
                }

                (regular_args, flags)
            });

        // Try substitute pattern first, then regular args
        substitute_args.or(regular_args)
    }

    /// Parse a complete Ex command line (for command mode)
    pub fn parse_command_line(input: &str) -> Result<ExCommand> {
        // Handle search commands specially
        if input.starts_with('/') || input.starts_with('?') {
            let pattern = input[1..].to_string();
            return Ok(ExCommand {
                range: None,
                command: if input.starts_with('/') {
                    "search_forward"
                } else {
                    "search_backward"
                }
                .to_string(),
                args: vec![pattern],
                flags: vec![],
            });
        }

        // Regular Ex commands
        Self::parse_ex(input)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_write() {
        let cmd = ExParser::parse_ex("w").unwrap();
        assert_eq!(cmd.command, "write");
        assert!(cmd.range.is_none());
        assert!(cmd.args.is_empty());
    }

    #[test]
    fn test_write_with_filename() {
        let cmd = ExParser::parse_ex("w file.txt").unwrap();
        assert_eq!(cmd.command, "write");
        assert_eq!(cmd.args, vec!["file.txt"]);
    }

    #[test]
    fn test_quit() {
        let cmd = ExParser::parse_ex("q").unwrap();
        assert_eq!(cmd.command, "quit");
    }

    #[test]
    fn test_write_quit() {
        let cmd = ExParser::parse_ex("wq").unwrap();
        assert_eq!(cmd.command, "writequit");
    }

    #[test]
    fn test_delete_with_range() {
        let cmd = ExParser::parse_ex("1,10d").unwrap();
        assert_eq!(cmd.command, "delete");
        assert!(matches!(cmd.range, Some(CommandRange::Range(_, _))));
    }

    #[test]
    fn test_substitute_command() {
        let cmd = ExParser::parse_ex("s/foo/bar/g").unwrap();
        assert_eq!(cmd.command, "substitute");
        assert_eq!(cmd.args, vec!["foo", "bar"]);
        assert_eq!(cmd.flags, vec!["g"]);
    }

    #[test]
    fn test_substitute_with_range() {
        let cmd = ExParser::parse_ex("%s/old/new/gi").unwrap();
        assert_eq!(cmd.command, "substitute");
        assert_eq!(cmd.range, Some(CommandRange::AllLines));
        assert_eq!(cmd.args, vec!["old", "new"]);
        assert!(cmd.flags.contains(&"g".to_string()));
        assert!(cmd.flags.contains(&"i".to_string()));
    }

    #[test]
    fn test_current_line_range() {
        let cmd = ExParser::parse_ex(".d").unwrap();
        assert_eq!(cmd.command, "delete");
        assert_eq!(cmd.range, Some(CommandRange::CurrentLine));
    }

    #[test]
    fn test_last_line_range() {
        let cmd = ExParser::parse_ex("$d").unwrap();
        assert_eq!(cmd.command, "delete");
        assert_eq!(cmd.range, Some(CommandRange::LastLine));
    }

    #[test]
    fn test_all_lines_range() {
        let cmd = ExParser::parse_ex("%d").unwrap();
        assert_eq!(cmd.command, "delete");
        assert_eq!(cmd.range, Some(CommandRange::AllLines));
    }

    #[test]
    fn test_numeric_range() {
        let cmd = ExParser::parse_ex("5,15d").unwrap();
        assert_eq!(cmd.command, "delete");
        // Check that it's a range
        if let Some(CommandRange::Range(start, end)) = cmd.range {
            assert!(matches!(*start, CommandRange::Line(5)));
            assert!(matches!(*end, CommandRange::Line(15)));
        } else {
            panic!("Expected Range");
        }
    }

    #[test]
    fn test_relative_range_forward() {
        let cmd = ExParser::parse_ex("+5d").unwrap();
        assert_eq!(cmd.command, "delete");
        assert!(matches!(
            cmd.range,
            Some(CommandRange::RelativeForward(_, 5))
        ));
    }

    #[test]
    fn test_relative_range_backward() {
        let cmd = ExParser::parse_ex("-3d").unwrap();
        assert_eq!(cmd.command, "delete");
        assert!(matches!(
            cmd.range,
            Some(CommandRange::RelativeBackward(_, 3))
        ));
    }

    #[test]
    fn test_search_forward() {
        let cmd = ExParser::parse_command_line("/pattern").unwrap();
        assert_eq!(cmd.command, "search_forward");
        assert_eq!(cmd.args, vec!["pattern"]);
    }

    #[test]
    fn test_search_backward() {
        let cmd = ExParser::parse_command_line("?pattern").unwrap();
        assert_eq!(cmd.command, "search_backward");
        assert_eq!(cmd.args, vec!["pattern"]);
    }

    #[test]
    fn test_set_command() {
        let cmd = ExParser::parse_ex("set number").unwrap();
        assert_eq!(cmd.command, "set");
        assert_eq!(cmd.args, vec!["number"]);
    }

    #[test]
    fn test_set_with_value() {
        let cmd = ExParser::parse_ex("set tabstop=4").unwrap();
        assert_eq!(cmd.command, "set");
        assert_eq!(cmd.args, vec!["tabstop=4"]);
    }

    #[test]
    fn test_command_with_flags() {
        let cmd = ExParser::parse_ex("w -f file.txt").unwrap();
        assert_eq!(cmd.command, "write");
        assert_eq!(cmd.args, vec!["file.txt"]);
        assert_eq!(cmd.flags, vec!["-f"]);
    }

    #[test]
    fn test_yank_command() {
        let cmd = ExParser::parse_ex("1,5y").unwrap();
        assert_eq!(cmd.command, "yank");
        assert!(matches!(cmd.range, Some(CommandRange::Range(_, _))));
    }

    #[test]
    fn test_move_command() {
        let cmd = ExParser::parse_ex("1,5m10").unwrap();
        assert_eq!(cmd.command, "move");
        assert_eq!(cmd.args, vec!["10"]);
    }

    #[test]
    fn test_copy_command() {
        let cmd = ExParser::parse_ex("1,5t10").unwrap();
        assert_eq!(cmd.command, "copy");
        assert_eq!(cmd.args, vec!["10"]);
    }

    #[test]
    fn test_join_command() {
        let cmd = ExParser::parse_ex("1,5j").unwrap();
        assert_eq!(cmd.command, "join");
        assert!(matches!(cmd.range, Some(CommandRange::Range(_, _))));
    }

    #[test]
    fn test_shell_command() {
        let cmd = ExParser::parse_ex("!ls -la").unwrap();
        assert_eq!(cmd.command, "shell");
        assert_eq!(cmd.args, vec!["ls"]);
        assert_eq!(cmd.flags, vec!["-la"]);
    }

    #[test]
    fn test_empty_substitute_replacement() {
        let cmd = ExParser::parse_ex("s/foo//g").unwrap();
        assert_eq!(cmd.command, "substitute");
        assert_eq!(cmd.args, vec!["foo", ""]);
        assert_eq!(cmd.flags, vec!["g"]);
    }

    #[test]
    fn test_complex_range() {
        let cmd = ExParser::parse_ex(".,+5d").unwrap();
        assert_eq!(cmd.command, "delete");
        // This would parse as a complex range
        assert!(cmd.range.is_some());
    }
}
