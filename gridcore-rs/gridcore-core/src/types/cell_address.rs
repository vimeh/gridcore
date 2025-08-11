use crate::utils::string_intern::intern_cell_address;
use crate::{Result, SpreadsheetError};
use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;
use std::sync::Arc;

#[derive(Debug, Clone, Copy, Hash, Eq, PartialEq, Serialize, Deserialize)]
pub struct CellAddress {
    pub col: u32,
    pub row: u32,
}

// Regular Rust implementation
impl CellAddress {
    /// Create a new CellAddress
    pub fn new(col: u32, row: u32) -> Self {
        CellAddress { col, row }
    }

    /// Convert column number to A1 notation (0 -> A, 25 -> Z, 26 -> AA, etc.)
    pub fn column_number_to_label(col: u32) -> String {
        let mut label = String::new();
        let mut n = col;

        loop {
            label.insert(0, ((n % 26) as u8 + b'A') as char);
            if n < 26 {
                break;
            }
            n = n / 26 - 1;
        }

        label
    }

    /// Convert A1 notation to column number (A -> 0, Z -> 25, AA -> 26, etc.)
    pub fn column_label_to_number(label: &str) -> Result<u32> {
        if label.is_empty() {
            return Err(SpreadsheetError::InvalidAddress(
                "Empty column label".to_string(),
            ));
        }

        let mut result = 0u32;
        for c in label.chars() {
            if !c.is_ascii_uppercase() {
                return Err(SpreadsheetError::InvalidAddress(format!(
                    "Invalid character in column label: {}",
                    c
                )));
            }
            result = result * 26 + (c as u32 - 'A' as u32 + 1);
        }

        Ok(result - 1)
    }

    /// Create a CellAddress from A1 notation (e.g., "A1", "B10")
    pub fn from_a1(s: &str) -> Result<CellAddress> {
        Self::parse_a1_notation(s)
    }

    /// Convert to A1 notation (e.g., "A1", "B10")
    pub fn to_a1(&self) -> String {
        format!("{}{}", Self::number_to_column_label(self.col), self.row + 1)
    }

    /// Convert column number to column label (0 -> "A", 25 -> "Z", 26 -> "AA")
    fn number_to_column_label(col: u32) -> String {
        let mut result = String::new();
        let mut n = col + 1; // Convert to 1-based

        while n > 0 {
            n -= 1;
            result = format!("{}{}", (b'A' + (n % 26) as u8) as char, result);
            n /= 26;
        }

        result
    }

    /// Parse A1 notation manually (simplified for now)
    pub fn parse_a1_notation(s: &str) -> Result<CellAddress> {
        // Excel limits: 16,384 columns (XFD) and 1,048,576 rows
        const MAX_COLUMNS: u32 = 16384;
        const MAX_ROWS: u32 = 1048576;

        let mut col_part = String::new();
        let mut row_part = String::new();
        let mut in_row = false;

        for c in s.chars() {
            if c.is_ascii_uppercase() && !in_row {
                col_part.push(c);
            } else if c.is_ascii_digit() {
                in_row = true;
                row_part.push(c);
            } else {
                return Err(SpreadsheetError::InvalidAddress(format!(
                    "Invalid character in address: {}",
                    c
                )));
            }
        }

        if col_part.is_empty() || row_part.is_empty() {
            return Err(SpreadsheetError::InvalidAddress(format!(
                "Invalid address format: {}",
                s
            )));
        }

        let col = Self::column_label_to_number(&col_part)?;
        let row = row_part
            .parse::<u32>()
            .map_err(|e| SpreadsheetError::InvalidAddress(e.to_string()))?;

        if row == 0 {
            return Err(SpreadsheetError::InvalidAddress(
                "Row number must be greater than 0".to_string(),
            ));
        }

        // Check bounds - Excel-compatible limits
        if col >= MAX_COLUMNS {
            return Err(SpreadsheetError::RefError); // Return RefError for invalid references
        }

        if row > MAX_ROWS {
            return Err(SpreadsheetError::RefError); // Return RefError for invalid references
        }

        Ok(CellAddress { col, row: row - 1 })
    }

    /// Offset this address by the given amounts
    pub fn offset(&self, row_offset: i32, col_offset: i32) -> Result<CellAddress> {
        let new_row = self.row as i32 + row_offset;
        let new_col = self.col as i32 + col_offset;

        if new_row < 0 || new_col < 0 {
            return Err(SpreadsheetError::InvalidAddress(format!(
                "Offset results in negative address: ({}, {})",
                new_col, new_row
            )));
        }

        Ok(CellAddress {
            row: new_row as u32,
            col: new_col as u32,
        })
    }

    /// Check if this address is within the given bounds
    pub fn is_within_bounds(&self, max_row: u32, max_col: u32) -> bool {
        self.row <= max_row && self.col <= max_col
    }
    
    /// Get an interned string representation of this address
    /// This is more efficient than to_string() for frequently used addresses
    pub fn to_interned_string(&self) -> Arc<str> {
        let address_str = format!(
            "{}{}",
            Self::column_number_to_label(self.col),
            self.row + 1
        );
        intern_cell_address(&address_str)
    }
}

impl fmt::Display for CellAddress {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "{}{}",
            Self::column_number_to_label(self.col),
            self.row + 1
        )
    }
}

impl FromStr for CellAddress {
    type Err = SpreadsheetError;

    fn from_str(s: &str) -> Result<Self> {
        Self::parse_a1_notation(s)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_column_conversions() {
        assert_eq!(CellAddress::column_number_to_label(0), "A");
        assert_eq!(CellAddress::column_number_to_label(25), "Z");
        assert_eq!(CellAddress::column_number_to_label(26), "AA");
        assert_eq!(CellAddress::column_number_to_label(27), "AB");
        assert_eq!(CellAddress::column_number_to_label(701), "ZZ");
        assert_eq!(CellAddress::column_number_to_label(702), "AAA");

        assert_eq!(CellAddress::column_label_to_number("A").unwrap(), 0);
        assert_eq!(CellAddress::column_label_to_number("Z").unwrap(), 25);
        assert_eq!(CellAddress::column_label_to_number("AA").unwrap(), 26);
        assert_eq!(CellAddress::column_label_to_number("AB").unwrap(), 27);
        assert_eq!(CellAddress::column_label_to_number("ZZ").unwrap(), 701);
        assert_eq!(CellAddress::column_label_to_number("AAA").unwrap(), 702);
    }

    #[test]
    fn test_parse_cell_address() {
        let addr = CellAddress::from_str("A1").unwrap();
        assert_eq!(addr.col, 0);
        assert_eq!(addr.row, 0);

        let addr = CellAddress::from_str("B2").unwrap();
        assert_eq!(addr.col, 1);
        assert_eq!(addr.row, 1);

        let addr = CellAddress::from_str("AA10").unwrap();
        assert_eq!(addr.col, 26);
        assert_eq!(addr.row, 9);

        let addr = CellAddress::from_str("ZZ100").unwrap();
        assert_eq!(addr.col, 701);
        assert_eq!(addr.row, 99);
    }

    #[test]
    fn test_display() {
        let addr = CellAddress::new(0, 0);
        assert_eq!(addr.to_string(), "A1");

        let addr = CellAddress::new(26, 9);
        assert_eq!(addr.to_string(), "AA10");

        let addr = CellAddress::new(701, 99);
        assert_eq!(addr.to_string(), "ZZ100");
    }

    #[test]
    fn test_offset() {
        let addr = CellAddress::new(5, 5);

        let offset = addr.offset(3, 2).unwrap();
        assert_eq!(offset.col, 7);
        assert_eq!(offset.row, 8);

        let offset = addr.offset(-2, -3).unwrap();
        assert_eq!(offset.col, 2);
        assert_eq!(offset.row, 3);

        // Test negative result
        assert!(addr.offset(-10, 0).is_err());
        assert!(addr.offset(0, -10).is_err());
    }
}
