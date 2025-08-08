pub mod cell_address;
pub mod cell_value;

#[cfg(feature = "wasm")]
pub mod js_conversion;

pub use cell_address::CellAddress;
pub use cell_value::CellValue;

#[cfg(feature = "wasm")]
pub use js_conversion::ToJs;
// Re-export CellRange from formula module
pub use crate::formula::ast::CellRange;

/// Convert a column index to a label (e.g., 0 -> "A", 26 -> "AA")
pub fn column_index_to_label(index: u32) -> String {
    let mut label = String::new();
    let mut n = index;

    loop {
        label.insert(0, ((n % 26) as u8 + b'A') as char);
        if n < 26 {
            break;
        }
        n = n / 26 - 1;
    }

    label
}

#[cfg(feature = "wasm")]
pub mod wasm {
    pub use super::cell_address::wasm::*;
    pub use super::cell_value::wasm::*;
}
