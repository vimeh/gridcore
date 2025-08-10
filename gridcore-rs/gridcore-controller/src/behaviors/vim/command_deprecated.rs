// This file is deprecated and will be removed after migration is complete.
// All functionality has been moved to the command/ module.
// Keeping for reference during transition.

#[cfg(test)]
mod tests {
    use crate::behaviors::vim::command::{
        BulkCommandParser, BulkCommandType, types::{
            FillDirection, FormatType, MathOp, SearchScope, TransformType,
        },
    };

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
        fn test_add_operation() {
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
        fn test_subtract_operation() {
            let parser = create_parser();
            let cmd = parser.parse(":sub 5.5").unwrap();

            match cmd {
                BulkCommandType::MathOperation { operation, value } => {
                    assert_eq!(operation, MathOp::Sub);
                    assert_eq!(value, 5.5);
                }
                _ => panic!("Expected MathOperation command"),
            }
        }

        #[test]
        fn test_multiply_operation() {
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
        fn test_divide_operation() {
            let parser = create_parser();
            let cmd = parser.parse(":div 3").unwrap();

            match cmd {
                BulkCommandType::MathOperation { operation, value } => {
                    assert_eq!(operation, MathOp::Div);
                    assert_eq!(value, 3.0);
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
        fn test_fill_series() {
            let parser = create_parser();
            let cmd = parser.parse(":fill series").unwrap();

            match cmd {
                BulkCommandType::Fill { direction } => {
                    assert_eq!(direction, FillDirection::Series);
                }
                _ => panic!("Expected Fill command"),
            }
        }

        #[test]
        fn test_fill_short_notation() {
            let parser = create_parser();
            let cmd = parser.parse(":fill r").unwrap();

            match cmd {
                BulkCommandType::Fill { direction } => {
                    assert_eq!(direction, FillDirection::Right);
                }
                _ => panic!("Expected Fill command"),
            }
        }
    }

    mod transform_tests {
        use super::*;

        #[test]
        fn test_upper_transform() {
            let parser = create_parser();
            let cmd = parser.parse(":upper").unwrap();

            match cmd {
                BulkCommandType::Transform { transformation } => {
                    assert_eq!(transformation, TransformType::Upper);
                }
                _ => panic!("Expected Transform command"),
            }
        }

        #[test]
        fn test_lower_transform() {
            let parser = create_parser();
            let cmd = parser.parse(":lower").unwrap();

            match cmd {
                BulkCommandType::Transform { transformation } => {
                    assert_eq!(transformation, TransformType::Lower);
                }
                _ => panic!("Expected Transform command"),
            }
        }

        #[test]
        fn test_trim_transform() {
            let parser = create_parser();
            let cmd = parser.parse(":trim").unwrap();

            match cmd {
                BulkCommandType::Transform { transformation } => {
                    assert_eq!(transformation, TransformType::Trim);
                }
                _ => panic!("Expected Transform command"),
            }
        }
    }

    mod format_tests {
        use super::*;

        #[test]
        fn test_format_currency() {
            let parser = create_parser();
            let cmd = parser.parse(":format currency").unwrap();

            match cmd {
                BulkCommandType::Format { format_type } => {
                    assert_eq!(format_type, FormatType::Currency);
                }
                _ => panic!("Expected Format command"),
            }
        }

        #[test]
        fn test_format_percent() {
            let parser = create_parser();
            let cmd = parser.parse(":format %").unwrap();

            match cmd {
                BulkCommandType::Format { format_type } => {
                    assert_eq!(format_type, FormatType::Percent);
                }
                _ => panic!("Expected Format command"),
            }
        }

        #[test]
        fn test_format_date() {
            let parser = create_parser();
            let cmd = parser.parse(":format date").unwrap();

            match cmd {
                BulkCommandType::Format { format_type } => {
                    assert_eq!(format_type, FormatType::Date);
                }
                _ => panic!("Expected Format command"),
            }
        }
    }

    mod invalid_command_tests {
        use super::*;

        #[test]
        fn test_invalid_command_without_colon() {
            let parser = create_parser();
            assert!(parser.parse("set value").is_none());
        }

        #[test]
        fn test_unknown_command() {
            let parser = create_parser();
            assert!(parser.parse(":unknown_cmd").is_none());
        }

        #[test]
        fn test_math_op_without_value() {
            let parser = create_parser();
            assert!(parser.parse(":add").is_none());
        }

        #[test]
        fn test_fill_without_direction() {
            let parser = create_parser();
            assert!(parser.parse(":fill").is_none());
        }
    }
}