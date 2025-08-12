use super::ast::{BinaryOperator, Expr, UnaryOperator};
use crate::types::CellAddress;
use crate::{Result, SpreadsheetError};
use chumsky::pratt::*;
use chumsky::prelude::*;
use once_cell::sync::Lazy;
use regex::Regex;

// Static regex for cell reference validation
static CELL_REF_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"^([A-Z]+)([0-9]+)$").expect("Invalid regex pattern for cell reference")
});

/// Main formula parser that coordinates tokenization and expression building
pub struct FormulaParser;

impl FormulaParser {
    /// Parse a formula string into an AST
    pub fn parse(formula: &str) -> Result<Expr> {
        // Remove leading '=' if present
        let formula = formula.trim_start_matches('=').trim();

        // Parse and handle errors
        match Self::parser().parse(formula).into_result() {
            Ok(expr) => Ok(expr),
            Err(errors) => {
                // Check for specific invalid reference patterns
                // XYZ is a valid column pattern but exceeds Excel's limit
                if formula.len() <= 10 {
                    // Reasonable length for a cell reference
                    // Try to parse as a cell reference directly to check for #REF! errors
                    let upper_formula = formula.to_uppercase();
                    if let Some(caps) = CELL_REF_REGEX.captures(&upper_formula)
                        && let Some(col_str) = caps.get(1).map(|m| m.as_str())
                    {
                        // Check if this column would exceed Excel's limit
                        if let Ok(col_num) = CellAddress::column_label_to_number(col_str) {
                            // Excel's maximum column is 16383 (0-based), so 16384 columns total
                            if col_num >= 16384 {
                                return Err(SpreadsheetError::RefError);
                            }
                        }
                    }
                }

                // Combine error messages
                let msg = errors
                    .iter()
                    .map(|e| format!("{:?}", e))
                    .collect::<Vec<_>>()
                    .join("; ");

                // Check if any error is a #REF! error
                if msg.contains("#REF!") {
                    return Err(SpreadsheetError::RefError);
                }

                Err(SpreadsheetError::Parse(msg))
            }
        }
    }

    /// Build the Chumsky 0.10 parser
    fn parser<'a>() -> impl Parser<'a, &'a str, Expr, extra::Err<Rich<'a, char>>> {
        recursive(|expr| {
            // Import tokenizer functions
            use super::expression_builder::ExpressionBuilder;
            use super::tokenizer::Tokenizer;

            // Build atom parser - the basic units that can appear in expressions
            let atom = choice((
                // Order matters: try more specific patterns first
                // Cell references and ranges must come before function calls
                // because XYZ999 looks like a function name but is actually a cell reference
                Tokenizer::cell_range(),
                Tokenizer::cell_reference(),
                ExpressionBuilder::function_call(expr.clone()),
                Tokenizer::number(),
                Tokenizer::boolean(),
                Tokenizer::string(),
                // Parenthesized expression
                expr.clone()
                    .delimited_by(just('(').padded(), just(')').padded()),
            ));

            // Build the expression parser with operator precedence using pratt
            atom.pratt((
                // Percent postfix operator
                postfix(6, just('%').padded(), |expr, _, _span| Expr::UnaryOp {
                    op: UnaryOperator::Percent,
                    expr: Box::new(expr),
                }),
                // Unary minus prefix operator
                prefix(5, just('-').padded(), |_, expr, _span| Expr::UnaryOp {
                    op: UnaryOperator::Negate,
                    expr: Box::new(expr),
                }),
                // Power operator (right associative, highest precedence for binary ops)
                infix(right(4), just('^').padded(), |left, _, right, _span| {
                    Expr::BinaryOp {
                        op: BinaryOperator::Power,
                        left: Box::new(left),
                        right: Box::new(right),
                    }
                }),
                // Multiplication and division
                infix(left(3), just('*').padded(), |left, _, right, _span| {
                    Expr::BinaryOp {
                        op: BinaryOperator::Multiply,
                        left: Box::new(left),
                        right: Box::new(right),
                    }
                }),
                infix(left(3), just('/').padded(), |left, _, right, _span| {
                    Expr::BinaryOp {
                        op: BinaryOperator::Divide,
                        left: Box::new(left),
                        right: Box::new(right),
                    }
                }),
                // Addition and subtraction
                infix(left(2), just('+').padded(), |left, _, right, _span| {
                    Expr::BinaryOp {
                        op: BinaryOperator::Add,
                        left: Box::new(left),
                        right: Box::new(right),
                    }
                }),
                infix(left(2), just('-').padded(), |left, _, right, _span| {
                    Expr::BinaryOp {
                        op: BinaryOperator::Subtract,
                        left: Box::new(left),
                        right: Box::new(right),
                    }
                }),
                // Comparison operators
                infix(left(1), just("<=").padded(), |left, _, right, _span| {
                    Expr::BinaryOp {
                        op: BinaryOperator::LessThanOrEqual,
                        left: Box::new(left),
                        right: Box::new(right),
                    }
                }),
                infix(left(1), just(">=").padded(), |left, _, right, _span| {
                    Expr::BinaryOp {
                        op: BinaryOperator::GreaterThanOrEqual,
                        left: Box::new(left),
                        right: Box::new(right),
                    }
                }),
                infix(left(1), just("<>").padded(), |left, _, right, _span| {
                    Expr::BinaryOp {
                        op: BinaryOperator::NotEqual,
                        left: Box::new(left),
                        right: Box::new(right),
                    }
                }),
                infix(left(1), just('<').padded(), |left, _, right, _span| {
                    Expr::BinaryOp {
                        op: BinaryOperator::LessThan,
                        left: Box::new(left),
                        right: Box::new(right),
                    }
                }),
                infix(left(1), just('>').padded(), |left, _, right, _span| {
                    Expr::BinaryOp {
                        op: BinaryOperator::GreaterThan,
                        left: Box::new(left),
                        right: Box::new(right),
                    }
                }),
                infix(left(1), just('=').padded(), |left, _, right, _span| {
                    Expr::BinaryOp {
                        op: BinaryOperator::Equal,
                        left: Box::new(left),
                        right: Box::new(right),
                    }
                }),
                // Concatenation operator (lowest precedence)
                infix(left(0), just('&').padded(), |left, _, right, _span| {
                    Expr::BinaryOp {
                        op: BinaryOperator::Concat,
                        left: Box::new(left),
                        right: Box::new(right),
                    }
                }),
            ))
            .padded()
        })
    }
}

#[cfg(test)]
mod tests {
    // Tests have been moved to parser_tests.rs
    // Run with: cargo test -p gridcore-core formula::parser_tests
}
