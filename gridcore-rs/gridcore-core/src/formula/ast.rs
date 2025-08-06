use crate::types::{CellAddress, CellValue};
use serde::{Deserialize, Serialize};

/// Represents a cell range (e.g., A1:B10)
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct CellRange {
    pub start: CellAddress,
    pub end: CellAddress,
}

impl CellRange {
    pub fn new(start: CellAddress, end: CellAddress) -> Self {
        CellRange { start, end }
    }

    /// Check if a cell address is within this range
    pub fn contains(&self, addr: &CellAddress) -> bool {
        addr.col >= self.start.col
            && addr.col <= self.end.col
            && addr.row >= self.start.row
            && addr.row <= self.end.row
    }

    /// Iterator over all cells in the range
    pub fn cells(&self) -> impl Iterator<Item = CellAddress> + '_ {
        let start_col = self.start.col;
        let end_col = self.end.col;
        let start_row = self.start.row;
        let end_row = self.end.row;

        (start_row..=end_row)
            .flat_map(move |row| (start_col..=end_col).map(move |col| CellAddress::new(col, row)))
    }

    /// Get the number of cells in this range
    pub fn size(&self) -> usize {
        let cols = (self.end.col - self.start.col + 1) as usize;
        let rows = (self.end.row - self.start.row + 1) as usize;
        cols * rows
    }
}

/// Represents a parsed formula expression
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Expr {
    /// A literal value (number, string, boolean, etc.)
    Literal { value: CellValue },

    /// A reference to a single cell (e.g., A1)
    Reference {
        address: CellAddress,
        #[serde(default)]
        absolute_col: bool,
        #[serde(default)]
        absolute_row: bool,
    },

    /// A range of cells (e.g., A1:B10)
    Range {
        range: CellRange,
        #[serde(default)]
        absolute_start_col: bool,
        #[serde(default)]
        absolute_start_row: bool,
        #[serde(default)]
        absolute_end_col: bool,
        #[serde(default)]
        absolute_end_row: bool,
    },

    /// A function call (e.g., SUM(A1:A10))
    FunctionCall { name: String, args: Vec<Expr> },

    /// A unary operation (e.g., -A1)
    UnaryOp { op: UnaryOperator, expr: Box<Expr> },

    /// A binary operation (e.g., A1 + B1)
    BinaryOp {
        op: BinaryOperator,
        left: Box<Expr>,
        right: Box<Expr>,
    },
}

/// Unary operators
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum UnaryOperator {
    Negate,  // -expr
    Percent, // expr%
}

/// Binary operators
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BinaryOperator {
    // Arithmetic
    Add,      // +
    Subtract, // -
    Multiply, // *
    Divide,   // /
    Power,    // ^

    // Comparison
    Equal,              // =
    NotEqual,           // <>
    LessThan,           // <
    LessThanOrEqual,    // <=
    GreaterThan,        // >
    GreaterThanOrEqual, // >=

    // Text
    Concat, // &
}

impl BinaryOperator {
    /// Get the precedence of this operator (higher number = higher precedence)
    pub fn precedence(&self) -> u8 {
        match self {
            // Lowest precedence
            BinaryOperator::Concat => 1,

            // Comparison operators
            BinaryOperator::Equal
            | BinaryOperator::NotEqual
            | BinaryOperator::LessThan
            | BinaryOperator::LessThanOrEqual
            | BinaryOperator::GreaterThan
            | BinaryOperator::GreaterThanOrEqual => 2,

            // Addition and subtraction
            BinaryOperator::Add | BinaryOperator::Subtract => 3,

            // Multiplication and division
            BinaryOperator::Multiply | BinaryOperator::Divide => 4,

            // Highest precedence
            BinaryOperator::Power => 5,
        }
    }

    /// Check if this operator is left-associative
    pub fn is_left_associative(&self) -> bool {
        // Power is right-associative, all others are left-associative
        !matches!(self, BinaryOperator::Power)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cell_range() {
        let start = CellAddress::new(0, 0); // A1
        let end = CellAddress::new(2, 2); // C3
        let range = CellRange::new(start, end);

        assert_eq!(range.size(), 9);
        assert!(range.contains(&CellAddress::new(1, 1))); // B2
        assert!(!range.contains(&CellAddress::new(3, 3))); // D4

        let cells: Vec<_> = range.cells().collect();
        assert_eq!(cells.len(), 9);
        assert_eq!(cells[0], CellAddress::new(0, 0)); // A1
        assert_eq!(cells[8], CellAddress::new(2, 2)); // C3
    }

    #[test]
    fn test_operator_precedence() {
        assert!(BinaryOperator::Power.precedence() > BinaryOperator::Multiply.precedence());
        assert!(BinaryOperator::Multiply.precedence() > BinaryOperator::Add.precedence());
        assert!(BinaryOperator::Add.precedence() > BinaryOperator::Equal.precedence());
        assert!(BinaryOperator::Equal.precedence() > BinaryOperator::Concat.precedence());
    }
}
