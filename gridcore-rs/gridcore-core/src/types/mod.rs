pub mod cell_value;
pub mod cell_address;

pub use cell_value::CellValue;
pub use cell_address::CellAddress;
// Re-export CellRange from formula module
pub use crate::formula::ast::CellRange;

#[cfg(feature = "wasm")]
pub mod wasm {
    pub use super::cell_value::wasm::*;
    pub use super::cell_address::wasm::*;
}