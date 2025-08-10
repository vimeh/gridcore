use super::ast::{BinaryOperator, Expr, UnaryOperator};
use super::tokenizer::Tokenizer;
use chumsky::pratt::*;
use chumsky::prelude::*;

/// Builds expression trees from parsed tokens
/// Handles operator precedence and expression composition
pub struct ExpressionBuilder;

impl ExpressionBuilder {
    /// Build a function call expression parser
    pub fn function_call<'a>(
        expr_parser: impl Parser<'a, &'a str, Expr, extra::Err<Rich<'a, char>>> + Clone + 'a,
    ) -> impl Parser<'a, &'a str, Expr, extra::Err<Rich<'a, char>>> + Clone {
        Tokenizer::function_name()
            .then(
                expr_parser
                    .separated_by(just(',').padded())
                    .allow_trailing()
                    .collect::<Vec<_>>()
                    .delimited_by(just('('), just(')'))
                    .padded(),
            )
            .map(|(name, args)| Expr::FunctionCall { name, args })
    }

    /// Build the complete expression parser with operator precedence
    pub fn build<'a>() -> impl Parser<'a, &'a str, Expr, extra::Err<Rich<'a, char>>> + Clone {
        recursive(|expr| {
            // Build atom parser - the basic units that can appear in expressions
            let atom = Self::build_atoms(expr.clone());

            // Apply operator precedence rules
            Self::apply_operators(atom)
        })
    }

    /// Build the atom parser for basic expression units
    fn build_atoms<'a>(
        expr: impl Parser<'a, &'a str, Expr, extra::Err<Rich<'a, char>>> + Clone + 'a,
    ) -> impl Parser<'a, &'a str, Expr, extra::Err<Rich<'a, char>>> + Clone {
        choice((
            // Order matters: try more specific patterns first
            Self::function_call(expr.clone()),
            Tokenizer::cell_range(),
            Tokenizer::cell_reference(),
            Tokenizer::number(),
            Tokenizer::boolean(),
            Tokenizer::string(),
            // Parenthesized expression
            expr.delimited_by(just('(').padded(), just(')').padded()),
        ))
    }

    /// Apply operator precedence rules using Pratt parsing
    fn apply_operators<'a>(
        atom: impl Parser<'a, &'a str, Expr, extra::Err<Rich<'a, char>>> + Clone + 'a,
    ) -> impl Parser<'a, &'a str, Expr, extra::Err<Rich<'a, char>>> + Clone {
        atom.pratt((
            // Percent postfix operator (highest precedence for postfix)
            postfix(6, just('%').padded(), |expr, _, _span| Expr::UnaryOp {
                op: UnaryOperator::Percent,
                expr: Box::new(expr),
            }),
            // Unary minus prefix operator
            prefix(5, just('-').padded(), |_, expr, _span| Expr::UnaryOp {
                op: UnaryOperator::Negate,
                expr: Box::new(expr),
            }),
            // Power operator (right associative)
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
    }
}
