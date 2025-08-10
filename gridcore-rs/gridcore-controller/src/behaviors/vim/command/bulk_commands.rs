use super::types::{
    BulkCommandType, FillDirection, FindReplaceOptions, FormatType, MathOp, SearchScope,
    TransformType,
};
use crate::state::{Action, ParsedBulkCommand};

/// Parser for bulk commands in vim command mode
pub struct BulkCommandParser;

impl Default for BulkCommandParser {
    fn default() -> Self {
        Self::new()
    }
}

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
            "add" | "+" => self.parse_math_op(MathOp::Add, &parts[1..]),
            "sub" | "-" => self.parse_math_op(MathOp::Sub, &parts[1..]),
            "mul" | "*" => self.parse_math_op(MathOp::Mul, &parts[1..]),
            "div" | "/" => self.parse_math_op(MathOp::Div, &parts[1..]),
            "fill" => self.parse_fill(&parts[1..]),
            "format" => self.parse_format(&parts[1..]),
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
            _ => None,
        }
    }

    fn parse_find_replace(&self, cmd: &str) -> Option<BulkCommandType> {
        // Remove %s/ or s/ prefix
        let content = if let Some(stripped) = cmd.strip_prefix("%s/") {
            stripped
        } else if let Some(stripped) = cmd.strip_prefix("s/") {
            stripped
        } else {
            return None;
        };

        // Split by unescaped forward slashes
        let mut parts = Vec::new();
        let mut current = String::new();
        let mut escaped = false;

        for ch in content.chars() {
            if escaped {
                current.push(ch);
                escaped = false;
            } else if ch == '\\' {
                escaped = true;
                current.push(ch);
            } else if ch == '/' {
                parts.push(current.clone());
                current.clear();
            } else {
                current.push(ch);
            }
        }

        if !current.is_empty() || parts.len() == 2 {
            parts.push(current);
        }

        if parts.len() < 2 {
            return None;
        }

        let find_pattern = parts[0].clone();
        let replace_with = parts[1].clone();
        let flags = parts.get(2).unwrap_or(&String::new()).clone();

        let options = FindReplaceOptions {
            global: flags.contains('g'),
            case_sensitive: !flags.contains('i'),
            scope: if cmd.starts_with("%") {
                SearchScope::Sheet
            } else {
                SearchScope::Selection
            },
        };

        Some(BulkCommandType::FindReplace {
            find_pattern,
            replace_with,
            options,
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
            "down" | "d" => FillDirection::Down,
            "up" | "u" => FillDirection::Up,
            "left" | "l" => FillDirection::Left,
            "right" | "r" => FillDirection::Right,
            "series" | "s" => FillDirection::Series,
            _ => return None,
        };

        Some(BulkCommandType::Fill { direction })
    }

    fn parse_format(&self, args: &[&str]) -> Option<BulkCommandType> {
        if args.is_empty() {
            return None;
        }

        let format_type = match args[0] {
            "currency" | "c" | "$" => FormatType::Currency,
            "percent" | "p" | "%" => FormatType::Percent,
            "date" | "d" => FormatType::Date,
            "number" | "n" => FormatType::Number,
            _ => return None,
        };

        Some(BulkCommandType::Format { format_type })
    }

    /// Convert BulkCommandType to Action
    pub fn to_action(&self, command: BulkCommandType) -> Action {
        match command {
            BulkCommandType::FindReplace {
                find_pattern,
                replace_with,
                options,
            } => Action::BulkCommand {
                command: ParsedBulkCommand::FindReplace {
                    pattern: find_pattern,
                    replacement: replace_with,
                    global: options.global,
                    case_sensitive: options.case_sensitive,
                },
            },
            BulkCommandType::BulkSet { value, .. } => Action::BulkCommand {
                command: ParsedBulkCommand::SetValue { value },
            },
            BulkCommandType::MathOperation { operation, value } => {
                let op = match operation {
                    MathOp::Add => "add",
                    MathOp::Sub => "sub",
                    MathOp::Mul => "mul",
                    MathOp::Div => "div",
                };
                Action::BulkCommand {
                    command: ParsedBulkCommand::MathOperation {
                        operation: op.to_string(),
                        value,
                    },
                }
            }
            BulkCommandType::Fill { direction } => {
                let dir = match direction {
                    FillDirection::Down => "down",
                    FillDirection::Up => "up",
                    FillDirection::Left => "left",
                    FillDirection::Right => "right",
                    FillDirection::Series => "series",
                };
                Action::BulkCommand {
                    command: ParsedBulkCommand::Fill {
                        direction: dir.to_string(),
                    },
                }
            }
            BulkCommandType::Transform { transformation } => {
                let transform = match transformation {
                    TransformType::Upper => "upper",
                    TransformType::Lower => "lower",
                    TransformType::Trim => "trim",
                    TransformType::Clean => "clean",
                };
                Action::BulkCommand {
                    command: ParsedBulkCommand::Transform {
                        transformation: transform.to_string(),
                    },
                }
            }
            BulkCommandType::Format { format_type } => {
                let fmt = match format_type {
                    FormatType::Currency => "currency",
                    FormatType::Percent => "percent",
                    FormatType::Date => "date",
                    FormatType::Number => "number",
                };
                Action::BulkCommand {
                    command: ParsedBulkCommand::Format {
                        format_type: fmt.to_string(),
                    },
                }
            }
        }
    }
}
