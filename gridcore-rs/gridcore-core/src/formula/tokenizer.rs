use super::ast::{CellRange, Expr};
use crate::SpreadsheetError;
use crate::types::{CellAddress, CellValue};
use chumsky::prelude::*;

/// Tokenizer for formula expressions
/// Handles parsing of individual tokens like numbers, strings, cell references, etc.
pub struct Tokenizer;

impl Tokenizer {
    /// Parse a number (integer or decimal)
    pub fn number<'a>() -> impl Parser<'a, &'a str, Expr, extra::Err<Rich<'a, char>>> + Clone {
        text::int(10)
            .then(just('.').then(text::digits(10)).or_not())
            .to_slice()
            .map(|s: &str| {
                let num = s.parse::<f64>().unwrap_or(0.0);
                Expr::Literal {
                    value: CellValue::Number(num),
                }
            })
            .padded()
    }

    /// Parse a boolean value (TRUE or FALSE)
    pub fn boolean<'a>() -> impl Parser<'a, &'a str, Expr, extra::Err<Rich<'a, char>>> + Clone {
        choice((
            text::keyword("TRUE").to(Expr::Literal {
                value: CellValue::Boolean(true),
            }),
            text::keyword("FALSE").to(Expr::Literal {
                value: CellValue::Boolean(false),
            }),
        ))
        .padded()
    }

    /// Parse a string literal
    pub fn string<'a>() -> impl Parser<'a, &'a str, Expr, extra::Err<Rich<'a, char>>> + Clone {
        just('"')
            .ignore_then(none_of('"').repeated().to_slice())
            .then_ignore(just('"'))
            .map(|s: &str| Expr::Literal {
                value: CellValue::String(s.to_string()),
            })
            .padded()
    }

    /// Parse a cell reference (e.g., A1, $B$2)
    /// Returns (address, absolute_col, absolute_row)
    pub fn cell_reference_parts<'a>()
    -> impl Parser<'a, &'a str, (CellAddress, bool, bool), extra::Err<Rich<'a, char>>> + Clone {
        let dollar = just('$').or_not().map(|d| d.is_some());
        // Parse column letters (A-Z or a-z repeated, case insensitive)
        let col_letters = one_of('A'..='Z')
            .or(one_of('a'..='z'))
            .repeated()
            .at_least(1)
            .to_slice()
            .map(|s: &str| s.to_uppercase());
        let row_num = text::int(10);

        dollar.then(col_letters).then(dollar).then(row_num).try_map(
            |(((abs_col, col_str), abs_row), row_str): (((bool, String), bool), &str), span| {
                // Build the A1 notation string and use validated parsing
                let a1_notation = format!("{}{}", col_str, row_str);

                // Use parse_a1_notation which includes bounds checking
                match CellAddress::parse_a1_notation(&a1_notation) {
                    Ok(address) => Ok((address, abs_col, abs_row)),
                    Err(SpreadsheetError::RefError) => {
                        // Convert RefError to a Rich error
                        Err(Rich::custom(span, "#REF!"))
                    }
                    Err(e) => {
                        // Other errors
                        Err(Rich::custom(span, e.to_string()))
                    }
                }
            },
        )
    }

    /// Parse a single cell reference as an expression
    pub fn cell_reference<'a>() -> impl Parser<'a, &'a str, Expr, extra::Err<Rich<'a, char>>> + Clone {
        Self::cell_reference_parts()
            .map(|(addr, abs_col, abs_row)| Expr::Reference {
                address: addr,
                absolute_col: abs_col,
                absolute_row: abs_row,
            })
            .padded()
    }

    /// Parse a cell range (e.g., A1:B10)
    pub fn cell_range<'a>() -> impl Parser<'a, &'a str, Expr, extra::Err<Rich<'a, char>>> + Clone {
        Self::cell_reference_parts()
            .clone()
            .then_ignore(just(':'))
            .then(Self::cell_reference_parts())
            .map(
                |(
                    (start_addr, abs_start_col, abs_start_row),
                    (end_addr, abs_end_col, abs_end_row),
                )| {
                    Expr::Range {
                        range: CellRange::new(start_addr, end_addr),
                        absolute_start_col: abs_start_col,
                        absolute_start_row: abs_start_row,
                        absolute_end_col: abs_end_col,
                        absolute_end_row: abs_end_row,
                    }
                },
            )
            .padded()
    }

    /// Parse a function name (case insensitive)
    pub fn function_name<'a>() -> impl Parser<'a, &'a str, String, extra::Err<Rich<'a, char>>> + Clone {
        text::ascii::ident()
            .map(|s: &str| s.to_uppercase())
            .padded()
    }
}
