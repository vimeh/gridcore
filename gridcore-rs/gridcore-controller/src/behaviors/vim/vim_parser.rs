//! Vim command parser using chumsky parser combinators
//! Provides type-safe parsing of vim normal mode commands

use super::vim_core::{Direction, Motion, Operator, OperatorTarget, TextObject, VimCommand};
use chumsky::prelude::*;
use gridcore_core::{Result, SpreadsheetError};

/// Main vim command parser
pub struct VimParser;

impl VimParser {
    /// Parse a vim normal mode command
    pub fn parse_command(input: &str) -> Result<VimCommand> {
        match Self::command_parser().parse(input).into_result() {
            Ok(cmd) => Ok(cmd),
            Err(errors) => {
                let msg = errors
                    .iter()
                    .map(|e| format!("{:?}", e))
                    .collect::<Vec<_>>()
                    .join("; ");
                Err(SpreadsheetError::InvalidCommand(format!(
                    "Parse error: {}",
                    msg
                )))
            }
        }
    }

    /// Build the main command parser
    fn command_parser<'a>(
    ) -> impl Parser<'a, &'a str, VimCommand, extra::Err<Rich<'a, char>>> + Clone {
        recursive(|_cmd| {
            // For now, keep it simple - we'll handle counts and registers in the implementation

            // Double operators (dd, yy, cc, >>, <<)
            let double_ops = choice((
                just("dd").to(VimCommand {
                    count: None,
                    register: None,
                    operator: Some(Operator::Delete),
                    target: Some(OperatorTarget::CurrentLine),
                }),
                just("yy").to(VimCommand {
                    count: None,
                    register: None,
                    operator: Some(Operator::Yank),
                    target: Some(OperatorTarget::CurrentLine),
                }),
                just("cc").to(VimCommand {
                    count: None,
                    register: None,
                    operator: Some(Operator::Change),
                    target: Some(OperatorTarget::CurrentLine),
                }),
                just(">>").to(VimCommand {
                    count: None,
                    register: None,
                    operator: Some(Operator::Indent),
                    target: Some(OperatorTarget::CurrentLine),
                }),
                just("<<").to(VimCommand {
                    count: None,
                    register: None,
                    operator: Some(Operator::Outdent),
                    target: Some(OperatorTarget::CurrentLine),
                }),
            ));

            // Simple motions
            let simple_motion = choice((
                just('h').to(Motion::Char(Direction::Left, 1)),
                just('j').to(Motion::Char(Direction::Down, 1)),
                just('k').to(Motion::Char(Direction::Up, 1)),
                just('l').to(Motion::Char(Direction::Right, 1)),
                just('w').to(Motion::WordForward(1)),
                just('b').to(Motion::WordBackward(1)),
                just('e').to(Motion::WordEnd(1)),
                just('W').to(Motion::BigWordForward(1)),
                just('B').to(Motion::BigWordBackward(1)),
                just('E').to(Motion::BigWordEnd(1)),
                just('0').to(Motion::LineStart),
                just('$').to(Motion::LineEnd),
                just('^').to(Motion::FirstNonBlank),
                just('G').to(Motion::DocumentEnd),
                just('{').to(Motion::ParagraphBackward(1)),
                just('}').to(Motion::ParagraphForward(1)),
                just('%').to(Motion::MatchingBracket),
                just('n').to(Motion::NextMatch),
                just('N').to(Motion::PreviousMatch),
                just('*').to(Motion::NextMatch),
                just('#').to(Motion::PreviousMatch),
            ));

            // Two-char motions
            let two_char_motion = choice((
                just("gg").to(Motion::DocumentStart),
                just("[[").to(Motion::SectionBackward(1)),
                just("]]").to(Motion::SectionForward(1)),
            ));

            // Operators
            let operator = choice((
                just('d').to(Operator::Delete),
                just('c').to(Operator::Change),
                just('y').to(Operator::Yank),
                just('>').to(Operator::Indent),
                just('<').to(Operator::Outdent),
                just('=').to(Operator::Format),
                just('~').to(Operator::ToggleCase),
            ));

            // Text objects - split into smaller groups to avoid chumsky limits
            let text_object_word = choice((
                just("iw").to(TextObject::InnerWord),
                just("aw").to(TextObject::Word),
                just("iW").to(TextObject::InnerBigWord),
                just("aW").to(TextObject::BigWord),
                just("is").to(TextObject::InnerSentence),
                just("as").to(TextObject::Sentence),
                just("ip").to(TextObject::InnerParagraph),
                just("ap").to(TextObject::Paragraph),
            ));

            let text_object_parens = choice((
                just("i(").to(TextObject::InnerBlock('(', ')')),
                just("a(").to(TextObject::Block('(', ')')),
                just("i)").to(TextObject::InnerBlock('(', ')')),
                just("a)").to(TextObject::Block('(', ')')),
                just("i[").to(TextObject::InnerBlock('[', ']')),
                just("a[").to(TextObject::Block('[', ']')),
                just("i]").to(TextObject::InnerBlock('[', ']')),
                just("a]").to(TextObject::Block('[', ']')),
            ));

            let text_object_braces = choice((
                just("i{").to(TextObject::InnerBlock('{', '}')),
                just("a{").to(TextObject::Block('{', '}')),
                just("i}").to(TextObject::InnerBlock('{', '}')),
                just("a}").to(TextObject::Block('{', '}')),
                just("i<").to(TextObject::InnerBlock('<', '>')),
                just("a<").to(TextObject::Block('<', '>')),
                just("i>").to(TextObject::InnerBlock('<', '>')),
                just("a>").to(TextObject::Block('<', '>')),
            ));

            let text_object_quotes = choice((
                just("i\"").to(TextObject::InnerQuote('"')),
                just("a\"").to(TextObject::Quote('"')),
                just("i'").to(TextObject::InnerQuote('\'')),
                just("a'").to(TextObject::Quote('\'')),
                just("i`").to(TextObject::InnerQuote('`')),
                just("a`").to(TextObject::Quote('`')),
            ));

            let text_object = choice((
                text_object_word,
                text_object_parens,
                text_object_braces,
                text_object_quotes,
            ));

            // Operator + text object
            let op_text_obj = operator.then(text_object).map(|(op, obj)| VimCommand {
                count: None,
                register: None,
                operator: Some(op),
                target: Some(OperatorTarget::TextObject(obj)),
            });

            // Operator + motion combinations
            let op_motion = operator
                .then(simple_motion.clone())
                .map(|(op, mot)| VimCommand {
                    count: None,
                    register: None,
                    operator: Some(op),
                    target: Some(OperatorTarget::Motion(mot)),
                });

            // Operator + two-char motion
            let op_two_char = operator
                .then(two_char_motion.clone())
                .map(|(op, mot)| VimCommand {
                    count: None,
                    register: None,
                    operator: Some(op),
                    target: Some(OperatorTarget::Motion(mot)),
                });

            // Just motions
            let just_motion = simple_motion.map(|mot| VimCommand {
                count: None,
                register: None,
                operator: None,
                target: Some(OperatorTarget::Motion(mot)),
            });

            // Just two-char motions
            let just_two_char = two_char_motion.map(|mot| VimCommand {
                count: None,
                register: None,
                operator: None,
                target: Some(OperatorTarget::Motion(mot)),
            });

            // Just operator (enters operator-pending mode)
            let just_op = operator.map(|op| VimCommand {
                count: None,
                register: None,
                operator: Some(op),
                target: None,
            });

            // Combine all parsers
            choice((
                double_ops,
                op_text_obj,
                op_two_char,
                op_motion,
                just_two_char,
                just_motion,
                just_op,
            ))
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_motion() {
        let cmd = VimParser::parse_command("j").unwrap();
        assert!(cmd.operator.is_none());
        assert!(matches!(
            cmd.target,
            Some(OperatorTarget::Motion(Motion::Char(Direction::Down, 1)))
        ));
    }

    #[test]
    fn test_operator_with_motion() {
        let cmd = VimParser::parse_command("d$").unwrap();
        assert_eq!(cmd.operator, Some(Operator::Delete));
        assert!(matches!(
            cmd.target,
            Some(OperatorTarget::Motion(Motion::LineEnd))
        ));
    }

    #[test]
    fn test_double_operator() {
        let cmd = VimParser::parse_command("dd").unwrap();
        assert_eq!(cmd.operator, Some(Operator::Delete));
        assert_eq!(cmd.target, Some(OperatorTarget::CurrentLine));
    }

    #[test]
    fn test_yank_line() {
        let cmd = VimParser::parse_command("yy").unwrap();
        assert_eq!(cmd.operator, Some(Operator::Yank));
        assert_eq!(cmd.target, Some(OperatorTarget::CurrentLine));
    }

    #[test]
    fn test_change_line() {
        let cmd = VimParser::parse_command("cc").unwrap();
        assert_eq!(cmd.operator, Some(Operator::Change));
        assert_eq!(cmd.target, Some(OperatorTarget::CurrentLine));
    }

    #[test]
    fn test_document_start() {
        let cmd = VimParser::parse_command("gg").unwrap();
        assert!(matches!(
            cmd.target,
            Some(OperatorTarget::Motion(Motion::DocumentStart))
        ));
    }

    #[test]
    fn test_document_end() {
        let cmd = VimParser::parse_command("G").unwrap();
        assert!(matches!(
            cmd.target,
            Some(OperatorTarget::Motion(Motion::DocumentEnd))
        ));
    }

    #[test]
    fn test_paragraph_motion() {
        let cmd = VimParser::parse_command("{").unwrap();
        assert!(matches!(
            cmd.target,
            Some(OperatorTarget::Motion(Motion::ParagraphBackward(1)))
        ));

        let cmd = VimParser::parse_command("}").unwrap();
        assert!(matches!(
            cmd.target,
            Some(OperatorTarget::Motion(Motion::ParagraphForward(1)))
        ));
    }

    #[test]
    fn test_word_motions() {
        let cmd = VimParser::parse_command("w").unwrap();
        assert!(matches!(
            cmd.target,
            Some(OperatorTarget::Motion(Motion::WordForward(1)))
        ));

        let cmd = VimParser::parse_command("b").unwrap();
        assert!(matches!(
            cmd.target,
            Some(OperatorTarget::Motion(Motion::WordBackward(1)))
        ));

        let cmd = VimParser::parse_command("e").unwrap();
        assert!(matches!(
            cmd.target,
            Some(OperatorTarget::Motion(Motion::WordEnd(1)))
        ));
    }

    #[test]
    fn test_line_motions() {
        let cmd = VimParser::parse_command("0").unwrap();
        assert!(matches!(
            cmd.target,
            Some(OperatorTarget::Motion(Motion::LineStart))
        ));

        let cmd = VimParser::parse_command("$").unwrap();
        assert!(matches!(
            cmd.target,
            Some(OperatorTarget::Motion(Motion::LineEnd))
        ));

        let cmd = VimParser::parse_command("^").unwrap();
        assert!(matches!(
            cmd.target,
            Some(OperatorTarget::Motion(Motion::FirstNonBlank))
        ));
    }

    #[test]
    fn test_operator_only() {
        // Operator without motion enters operator-pending mode
        let cmd = VimParser::parse_command("d").unwrap();
        assert_eq!(cmd.operator, Some(Operator::Delete));
        assert_eq!(cmd.target, None);
    }

    #[test]
    fn test_operator_with_word() {
        let cmd = VimParser::parse_command("dw").unwrap();
        assert_eq!(cmd.operator, Some(Operator::Delete));
        assert!(matches!(
            cmd.target,
            Some(OperatorTarget::Motion(Motion::WordForward(1)))
        ));
    }

    #[test]
    fn test_operator_with_document_start() {
        let cmd = VimParser::parse_command("dgg").unwrap();
        assert_eq!(cmd.operator, Some(Operator::Delete));
        assert!(matches!(
            cmd.target,
            Some(OperatorTarget::Motion(Motion::DocumentStart))
        ));
    }

    #[test]
    fn test_indent_operator() {
        let cmd = VimParser::parse_command(">>").unwrap();
        assert_eq!(cmd.operator, Some(Operator::Indent));
        assert_eq!(cmd.target, Some(OperatorTarget::CurrentLine));
    }

    #[test]
    fn test_outdent_operator() {
        let cmd = VimParser::parse_command("<<").unwrap();
        assert_eq!(cmd.operator, Some(Operator::Outdent));
        assert_eq!(cmd.target, Some(OperatorTarget::CurrentLine));
    }

    #[test]
    fn test_text_object_word() {
        let cmd = VimParser::parse_command("diw").unwrap();
        assert_eq!(cmd.operator, Some(Operator::Delete));
        assert_eq!(
            cmd.target,
            Some(OperatorTarget::TextObject(TextObject::InnerWord))
        );
    }

    #[test]
    fn test_text_object_block() {
        let cmd = VimParser::parse_command("ci{").unwrap();
        assert_eq!(cmd.operator, Some(Operator::Change));
        assert_eq!(
            cmd.target,
            Some(OperatorTarget::TextObject(TextObject::InnerBlock('{', '}')))
        );
    }

    #[test]
    fn test_text_object_quote() {
        let cmd = VimParser::parse_command("ya\"").unwrap();
        assert_eq!(cmd.operator, Some(Operator::Yank));
        assert_eq!(
            cmd.target,
            Some(OperatorTarget::TextObject(TextObject::Quote('"')))
        );
    }
}
