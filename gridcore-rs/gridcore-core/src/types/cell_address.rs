use crate::{Result, SpreadsheetError};
use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;

#[derive(Debug, Clone, Hash, Eq, PartialEq, Serialize, Deserialize)]
pub struct CellAddress {
    pub col: u32,
    pub row: u32,
}

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
            return Err(SpreadsheetError::InvalidAddress("Empty column label".to_string()));
        }
        
        let mut result = 0u32;
        for c in label.chars() {
            if !c.is_ascii_uppercase() {
                return Err(SpreadsheetError::InvalidAddress(
                    format!("Invalid character in column label: {}", c)
                ));
            }
            result = result * 26 + (c as u32 - 'A' as u32 + 1);
        }
        
        Ok(result - 1)
    }
    
    /// Parse A1 notation manually (simplified for now)
    pub fn parse_a1_notation(s: &str) -> Result<CellAddress> {
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
                return Err(SpreadsheetError::InvalidAddress(
                    format!("Invalid character in address: {}", c)
                ));
            }
        }
        
        if col_part.is_empty() || row_part.is_empty() {
            return Err(SpreadsheetError::InvalidAddress(
                format!("Invalid address format: {}", s)
            ));
        }
        
        let col = Self::column_label_to_number(&col_part)?;
        let row = row_part.parse::<u32>()
            .map_err(|e| SpreadsheetError::InvalidAddress(e.to_string()))?;
        
        if row == 0 {
            return Err(SpreadsheetError::InvalidAddress(
                "Row number must be greater than 0".to_string()
            ));
        }
        
        Ok(CellAddress { col, row: row - 1 })
    }
    
    /// Offset this address by the given amounts
    pub fn offset(&self, row_offset: i32, col_offset: i32) -> Result<CellAddress> {
        let new_row = self.row as i32 + row_offset;
        let new_col = self.col as i32 + col_offset;
        
        if new_row < 0 || new_col < 0 {
            return Err(SpreadsheetError::InvalidAddress(
                format!("Offset results in negative address: ({}, {})", new_col, new_row)
            ));
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
}

impl fmt::Display for CellAddress {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}{}", Self::column_number_to_label(self.col), self.row + 1)
    }
}

impl FromStr for CellAddress {
    type Err = SpreadsheetError;
    
    fn from_str(s: &str) -> Result<Self> {
        Self::parse_a1_notation(s)
    }
}

#[cfg(feature = "wasm")]
pub mod wasm {
    use super::*;
    use wasm_bindgen::prelude::*;
    
    #[wasm_bindgen]
    pub struct WasmCellAddress {
        inner: CellAddress,
    }
    
    #[wasm_bindgen]
    impl WasmCellAddress {
        #[wasm_bindgen(constructor)]
        pub fn new(col: u32, row: u32) -> Self {
            WasmCellAddress {
                inner: CellAddress::new(col, row),
            }
        }
        
        #[wasm_bindgen(js_name = "fromString")]
        pub fn from_string(s: &str) -> std::result::Result<WasmCellAddress, JsValue> {
            CellAddress::from_str(s)
                .map(|addr| WasmCellAddress { inner: addr })
                .map_err(|e| JsValue::from_str(&e.to_string()))
        }
        
        #[wasm_bindgen(js_name = "toString")]
        pub fn to_string(&self) -> String {
            self.inner.to_string()
        }
        
        #[wasm_bindgen(getter)]
        pub fn col(&self) -> u32 {
            self.inner.col
        }
        
        #[wasm_bindgen(getter)]
        pub fn row(&self) -> u32 {
            self.inner.row
        }
        
        #[wasm_bindgen(js_name = "offset")]
        pub fn offset(&self, row_offset: i32, col_offset: i32) -> std::result::Result<WasmCellAddress, JsValue> {
            self.inner
                .offset(row_offset, col_offset)
                .map(|addr| WasmCellAddress { inner: addr })
                .map_err(|e| JsValue::from_str(&e.to_string()))
        }
        
        #[wasm_bindgen(js_name = "equals")]
        pub fn equals(&self, other: &WasmCellAddress) -> bool {
            self.inner == other.inner
        }
        
        #[wasm_bindgen(js_name = "columnLabel")]
        pub fn column_label(&self) -> String {
            CellAddress::column_number_to_label(self.inner.col)
        }
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