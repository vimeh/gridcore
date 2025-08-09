use crate::types::{CellAddress, CellValue};
use serde::{Deserialize, Serialize};
use std::fmt;

/// Represents a cell range (e.g., A1:B10)
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct CellRange {
    pub start: CellAddress,
    pub end: CellAddress,
}

impl std::fmt::Display for CellRange {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}:{}", self.start.to_a1(), self.end.to_a1())
    }
}

impl CellRange {
    pub fn new(start: CellAddress, end: CellAddress) -> Self {
        CellRange { start, end }
    }

    /// Create a cell range ensuring start <= end
    pub fn create(start: CellAddress, end: CellAddress) -> Result<Self, String> {
        if start.col > end.col || start.row > end.row {
            return Err("Range start must be before or equal to end".to_string());
        }
        Ok(CellRange { start, end })
    }

    /// Parse a range from A1:B2 notation
    pub fn from_string(s: &str) -> Result<Self, String> {
        let parts: Vec<&str> = s.split(':').collect();
        if parts.len() != 2 {
            return Err(format!("Invalid range format: {}", s));
        }

        let start = CellAddress::from_a1(parts[0])
            .map_err(|_| format!("Invalid start address: {}", parts[0]))?;
        let end = CellAddress::from_a1(parts[1])
            .map_err(|_| format!("Invalid end address: {}", parts[1]))?;

        Self::create(start, end)
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

    /// Get the number of rows in this range
    pub fn row_count(&self) -> usize {
        (self.end.row - self.start.row + 1) as usize
    }

    /// Get the number of columns in this range
    pub fn col_count(&self) -> usize {
        (self.end.col - self.start.col + 1) as usize
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
    fn test_cell_range_creation() {
        let range = CellRange::new(CellAddress::new(0, 0), CellAddress::new(2, 2));
        assert_eq!(range.start, CellAddress::new(0, 0));
        assert_eq!(range.end, CellAddress::new(2, 2));
    }

    #[test]
    fn test_cell_range_create_validates() {
        // Valid range
        let result = CellRange::create(CellAddress::new(0, 0), CellAddress::new(5, 5));
        assert!(result.is_ok());

        // Invalid range - start > end
        let result = CellRange::create(CellAddress::new(5, 5), CellAddress::new(0, 0));
        assert!(result.is_err());
        assert!(
            result
                .unwrap_err()
                .contains("start must be before or equal to end")
        );

        // Single cell range is valid
        let result = CellRange::create(CellAddress::new(5, 5), CellAddress::new(5, 5));
        assert!(result.is_ok());
    }

    #[test]
    fn test_cell_range_from_string() {
        // Valid range
        let result = CellRange::from_string("A1:B2");
        assert!(result.is_ok());
        let range = result.unwrap();
        assert_eq!(range.start.col, 0);
        assert_eq!(range.start.row, 0);
        assert_eq!(range.end.col, 1);
        assert_eq!(range.end.row, 1);

        // Single cell range
        let result = CellRange::from_string("A1:A1");
        assert!(result.is_ok());
        let range = result.unwrap();
        assert_eq!(range.start, range.end);

        // Invalid format - wrong separator
        let result = CellRange::from_string("A1-B2");
        assert!(result.is_err());

        // Invalid start address
        let result = CellRange::from_string("1A:B2");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid start address"));

        // Invalid end address
        let result = CellRange::from_string("A1:2B");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid end address"));
    }

    #[test]
    fn test_cell_range_to_string() {
        let range = CellRange::from_string("A1:B2").unwrap();
        assert_eq!(range.to_string(), "A1:B2");

        let range = CellRange::from_string("AA10:ZZ999").unwrap();
        assert_eq!(range.to_string(), "AA10:ZZ999");
    }

    #[test]
    fn test_cell_range_contains() {
        let range = CellRange::new(CellAddress::new(0, 0), CellAddress::new(2, 2));

        // Contains cells within range
        assert!(range.contains(&CellAddress::new(0, 0))); // A1
        assert!(range.contains(&CellAddress::new(1, 1))); // B2
        assert!(range.contains(&CellAddress::new(2, 2))); // C3

        // Does not contain cells outside range
        assert!(!range.contains(&CellAddress::new(3, 3))); // D4
        assert!(!range.contains(&CellAddress::new(0, 3))); // A4
        assert!(!range.contains(&CellAddress::new(3, 0))); // D1

        // Contains corner cells
        let range = CellRange::from_string("A1:C3").unwrap();
        assert!(range.contains(&CellAddress::from_a1("A1").unwrap()));
        assert!(range.contains(&CellAddress::from_a1("A3").unwrap()));
        assert!(range.contains(&CellAddress::from_a1("C1").unwrap()));
        assert!(range.contains(&CellAddress::from_a1("C3").unwrap()));
    }

    #[test]
    fn test_cell_range_cells_iterator() {
        let range = CellRange::from_string("A1:B2").unwrap();
        let cells: Vec<_> = range.cells().collect();
        assert_eq!(cells.len(), 4);

        let cell_strings: Vec<String> = cells.iter().map(|c| c.to_a1()).collect();
        assert_eq!(cell_strings, vec!["A1", "B1", "A2", "B2"]);

        // Single cell range
        let range = CellRange::from_string("B2:B2").unwrap();
        let cells: Vec<_> = range.cells().collect();
        assert_eq!(cells.len(), 1);
        assert_eq!(cells[0].to_a1(), "B2");

        // Larger range
        let range = CellRange::new(CellAddress::new(0, 0), CellAddress::new(2, 2));
        let cells: Vec<_> = range.cells().collect();
        assert_eq!(cells.len(), 9);
        assert_eq!(cells[0], CellAddress::new(0, 0)); // A1
        assert_eq!(cells[8], CellAddress::new(2, 2)); // C3
    }

    #[test]
    fn test_cell_range_dimensions() {
        let range = CellRange::from_string("A1:C4").unwrap();
        assert_eq!(range.row_count(), 4);
        assert_eq!(range.col_count(), 3);
        assert_eq!(range.size(), 12);

        // Single cell dimensions
        let range = CellRange::from_string("B2:B2").unwrap();
        assert_eq!(range.row_count(), 1);
        assert_eq!(range.col_count(), 1);
        assert_eq!(range.size(), 1);

        // Row range
        let range = CellRange::from_string("A1:E1").unwrap();
        assert_eq!(range.row_count(), 1);
        assert_eq!(range.col_count(), 5);
        assert_eq!(range.size(), 5);

        // Column range
        let range = CellRange::from_string("A1:A10").unwrap();
        assert_eq!(range.row_count(), 10);
        assert_eq!(range.col_count(), 1);
        assert_eq!(range.size(), 10);
    }

    #[test]
    fn test_operator_precedence() {
        assert!(BinaryOperator::Power.precedence() > BinaryOperator::Multiply.precedence());
        assert!(BinaryOperator::Multiply.precedence() > BinaryOperator::Add.precedence());
        assert!(BinaryOperator::Add.precedence() > BinaryOperator::Equal.precedence());
        assert!(BinaryOperator::Equal.precedence() > BinaryOperator::Concat.precedence());
    }
}
