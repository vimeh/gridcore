use crate::state::{Selection, SelectionType};
use gridcore_core::{types::CellAddress, Result};
use std::collections::HashSet;
use serde::{Deserialize, Serialize};

#[cfg(feature = "wasm")]
use wasm_bindgen::prelude::*;
#[cfg(feature = "wasm")]
use serde_wasm_bindgen;

/// Manages spreadsheet selections and multi-cursor operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelectionManager {
    primary_selection: Selection,
    secondary_selections: Vec<Selection>,
    selection_history: Vec<Selection>,
    max_history_size: usize,
    clipboard: Option<ClipboardContent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipboardContent {
    pub cells: Vec<CellContent>,
    pub source_selection: Selection,
    pub is_cut: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CellContent {
    pub address: CellAddress,
    pub value: String,
    pub formula: Option<String>,
    pub format: Option<String>,
}

impl SelectionManager {
    pub fn new() -> Self {
        Self {
            primary_selection: Selection {
                selection_type: SelectionType::Cell {
                    address: CellAddress::new(0, 0),
                },
                anchor: None,
            },
            secondary_selections: Vec::new(),
            selection_history: Vec::new(),
            max_history_size: 50,
            clipboard: None,
        }
    }

    /// Get the current primary selection
    pub fn get_primary(&self) -> &Selection {
        &self.primary_selection
    }

    /// Set the primary selection
    pub fn set_primary(&mut self, selection: Selection) {
        // Add current selection to history
        if self.selection_history.len() >= self.max_history_size {
            self.selection_history.remove(0);
        }
        self.selection_history.push(self.primary_selection.clone());

        self.primary_selection = selection;
    }

    /// Get all secondary selections
    pub fn get_secondary(&self) -> &[Selection] {
        &self.secondary_selections
    }

    /// Add a secondary selection (for multi-cursor)
    pub fn add_secondary(&mut self, selection: Selection) {
        self.secondary_selections.push(selection);
    }

    /// Clear all secondary selections
    pub fn clear_secondary(&mut self) {
        self.secondary_selections.clear();
    }

    /// Get all selections (primary and secondary)
    pub fn get_all(&self) -> Vec<&Selection> {
        let mut all = vec![&self.primary_selection];
        all.extend(self.secondary_selections.iter());
        all
    }

    /// Check if a cell is selected
    pub fn is_selected(&self, address: &CellAddress) -> bool {
        self.get_all()
            .iter()
            .any(|sel| self.selection_contains(sel, address))
    }

    /// Check if a selection contains a cell
    fn selection_contains(&self, selection: &Selection, address: &CellAddress) -> bool {
        match &selection.selection_type {
            SelectionType::Cell { address: sel_addr } => sel_addr == address,
            SelectionType::Range { start, end } => {
                address.col >= start.col
                    && address.col <= end.col
                    && address.row >= start.row
                    && address.row <= end.row
            }
            SelectionType::Column { columns } => columns.contains(&address.col),
            SelectionType::Row { rows } => rows.contains(&address.row),
            SelectionType::Multi { selections } => selections
                .iter()
                .any(|sel| self.selection_contains(sel, address)),
        }
    }

    /// Expand selection in a direction
    pub fn expand_selection(&mut self, direction: Direction, amount: u32) -> Result<()> {
        match &mut self.primary_selection.selection_type {
            SelectionType::Cell { address } => {
                // Convert to range
                let addr_clone = address.clone();
                let new_end = Self::move_address_static(&addr_clone, direction, amount)?;
                let start_addr = address.clone();
                self.primary_selection.selection_type = SelectionType::Range {
                    start: start_addr.clone(),
                    end: new_end,
                };
                if self.primary_selection.anchor.is_none() {
                    self.primary_selection.anchor = Some(start_addr);
                }
            }
            SelectionType::Range { start, end } => {
                // Expand the range
                let anchor_clone = self.primary_selection.anchor.clone();
                if let Some(anchor) = &anchor_clone {
                    if end == anchor {
                        // Moving start
                        *start = Self::move_address_static(start, direction, amount)?;
                    } else {
                        // Moving end
                        *end = Self::move_address_static(end, direction, amount)?;
                    }
                } else {
                    *end = Self::move_address_static(end, direction, amount)?;
                }
            }
            SelectionType::Row { rows } => {
                // Add more rows
                let new_rows = match direction {
                    Direction::Up => {
                        if let Some(min_row) = rows.iter().min().copied() {
                            (1..=amount).map(|i| min_row.saturating_sub(i)).collect()
                        } else {
                            vec![]
                        }
                    }
                    Direction::Down => {
                        if let Some(max_row) = rows.iter().max().copied() {
                            (1..=amount).map(|i| max_row + i).collect()
                        } else {
                            vec![]
                        }
                    }
                    _ => vec![],
                };

                for new_row in new_rows {
                    if !rows.contains(&new_row) {
                        rows.push(new_row);
                    }
                }
                rows.sort();
            }
            SelectionType::Column { columns } => {
                // Add more columns
                let new_cols = match direction {
                    Direction::Left => {
                        if let Some(min_col) = columns.iter().min().copied() {
                            (1..=amount).map(|i| min_col.saturating_sub(i)).collect()
                        } else {
                            vec![]
                        }
                    }
                    Direction::Right => {
                        if let Some(max_col) = columns.iter().max().copied() {
                            (1..=amount).map(|i| max_col + i).collect()
                        } else {
                            vec![]
                        }
                    }
                    _ => vec![],
                };

                for new_col in new_cols {
                    if !columns.contains(&new_col) {
                        columns.push(new_col);
                    }
                }
                columns.sort();
            }
            SelectionType::Multi { .. } => {
                // Complex case - expand all selections
                // TODO: Implement
            }
        }

        Ok(())
    }

    /// Contract selection in a direction
    pub fn contract_selection(&mut self, direction: Direction, amount: u32) -> Result<()> {
        let (new_start, new_end) = match &self.primary_selection.selection_type {
            SelectionType::Range { start, end } => {
                // Contract the range
                let new_start = Self::move_address_static(start, direction.opposite(), amount)?;
                let new_end = Self::move_address_static(end, direction, amount)?;
                (new_start, new_end)
            }
            _ => return Ok(()), // No contraction for other types
        };

        // Check if range collapses to a single cell
        if new_start == new_end {
            self.primary_selection.selection_type = SelectionType::Cell { address: new_start };
        } else {
            if let SelectionType::Range { start, end } = &mut self.primary_selection.selection_type
            {
                *start = new_start;
                *end = new_end;
            }
        }

        Ok(())
    }

    /// Move an address in a direction
    #[allow(dead_code)]
    fn move_address(
        &self,
        address: &CellAddress,
        direction: Direction,
        amount: u32,
    ) -> Result<CellAddress> {
        Self::move_address_static(address, direction, amount)
    }

    /// Static version of move_address for use when self is already borrowed
    fn move_address_static(
        address: &CellAddress,
        direction: Direction,
        amount: u32,
    ) -> Result<CellAddress> {
        match direction {
            Direction::Up => Ok(CellAddress::new(
                address.col,
                address.row.saturating_sub(amount),
            )),
            Direction::Down => Ok(CellAddress::new(address.col, address.row + amount)),
            Direction::Left => Ok(CellAddress::new(
                address.col.saturating_sub(amount),
                address.row,
            )),
            Direction::Right => Ok(CellAddress::new(address.col + amount, address.row)),
        }
    }

    /// Select all cells in a range
    pub fn select_range(&mut self, start: CellAddress, end: CellAddress) {
        self.set_primary(Selection {
            selection_type: SelectionType::Range { start, end },
            anchor: Some(start.clone()),
        });
    }

    /// Select entire rows
    pub fn select_rows(&mut self, rows: Vec<u32>) {
        self.set_primary(Selection {
            selection_type: SelectionType::Row { rows },
            anchor: None,
        });
    }

    /// Select entire columns
    pub fn select_columns(&mut self, columns: Vec<u32>) {
        self.set_primary(Selection {
            selection_type: SelectionType::Column { columns },
            anchor: None,
        });
    }

    /// Select all cells
    pub fn select_all(&mut self) {
        self.set_primary(Selection {
            selection_type: SelectionType::Range {
                start: CellAddress::new(0, 0),
                end: CellAddress::new(u32::MAX, u32::MAX),
            },
            anchor: Some(CellAddress::new(0, 0)),
        });
    }

    /// Clear all selections
    pub fn clear_all(&mut self) {
        self.primary_selection = Selection {
            selection_type: SelectionType::Cell {
                address: CellAddress::new(0, 0),
            },
            anchor: None,
        };
        self.secondary_selections.clear();
    }

    /// Get the bounding box of a selection
    pub fn get_bounds(&self, selection: &Selection) -> (CellAddress, CellAddress) {
        match &selection.selection_type {
            SelectionType::Cell { address } => (address.clone(), address.clone()),
            SelectionType::Range { start, end } => (start.clone(), end.clone()),
            SelectionType::Row { rows } => {
                let min_row = rows.iter().min().copied().unwrap_or(0);
                let max_row = rows.iter().max().copied().unwrap_or(0);
                (
                    CellAddress::new(0, min_row),
                    CellAddress::new(u32::MAX, max_row),
                )
            }
            SelectionType::Column { columns } => {
                let min_col = columns.iter().min().copied().unwrap_or(0);
                let max_col = columns.iter().max().copied().unwrap_or(0);
                (
                    CellAddress::new(min_col, 0),
                    CellAddress::new(max_col, u32::MAX),
                )
            }
            SelectionType::Multi { selections } => {
                let bounds: Vec<_> = selections.iter().map(|sel| self.get_bounds(sel)).collect();

                let min_col = bounds.iter().map(|(start, _)| start.col).min().unwrap_or(0);
                let min_row = bounds.iter().map(|(start, _)| start.row).min().unwrap_or(0);
                let max_col = bounds.iter().map(|(_, end)| end.col).max().unwrap_or(0);
                let max_row = bounds.iter().map(|(_, end)| end.row).max().unwrap_or(0);

                (
                    CellAddress::new(min_col, min_row),
                    CellAddress::new(max_col, max_row),
                )
            }
        }
    }

    /// Get all selected cells
    pub fn get_selected_cells(&self) -> HashSet<CellAddress> {
        let mut cells = HashSet::new();

        for selection in self.get_all() {
            match &selection.selection_type {
                SelectionType::Cell { address } => {
                    cells.insert(address.clone());
                }
                SelectionType::Range { start, end } => {
                    for row in start.row..=end.row {
                        for col in start.col..=end.col {
                            cells.insert(CellAddress::new(col, row));
                        }
                    }
                }
                SelectionType::Row { rows } => {
                    for &row in rows {
                        // Add a reasonable range of columns
                        for col in 0..1000 {
                            cells.insert(CellAddress::new(col, row));
                        }
                    }
                }
                SelectionType::Column { columns } => {
                    for &col in columns {
                        // Add a reasonable range of rows
                        for row in 0..10000 {
                            cells.insert(CellAddress::new(col, row));
                        }
                    }
                }
                SelectionType::Multi { selections } => {
                    for sub_selection in selections {
                        // Recursively get cells from multi-selection
                        let sub_manager = SelectionManager::new();
                        for cell in sub_manager.get_selected_cells_for_selection(sub_selection) {
                            cells.insert(cell);
                        }
                    }
                }
            }
        }

        cells
    }

    fn get_selected_cells_for_selection(&self, selection: &Selection) -> HashSet<CellAddress> {
        let mut cells = HashSet::new();

        match &selection.selection_type {
            SelectionType::Cell { address } => {
                cells.insert(address.clone());
            }
            SelectionType::Range { start, end } => {
                for row in start.row..=end.row {
                    for col in start.col..=end.col {
                        cells.insert(CellAddress::new(col, row));
                    }
                }
            }
            _ => {} // Simplified for internal use
        }

        cells
    }

    /// Copy selection to clipboard
    pub fn copy_selection(&mut self, contents: Vec<CellContent>) {
        self.clipboard = Some(ClipboardContent {
            cells: contents,
            source_selection: self.primary_selection.clone(),
            is_cut: false,
        });
    }

    /// Cut selection to clipboard
    pub fn cut_selection(&mut self, contents: Vec<CellContent>) {
        self.clipboard = Some(ClipboardContent {
            cells: contents,
            source_selection: self.primary_selection.clone(),
            is_cut: true,
        });
    }

    /// Get clipboard content
    pub fn get_clipboard(&self) -> Option<&ClipboardContent> {
        self.clipboard.as_ref()
    }

    /// Clear clipboard
    pub fn clear_clipboard(&mut self) {
        self.clipboard = None;
    }

    /// Navigate to previous selection in history
    pub fn previous_selection(&mut self) -> Option<Selection> {
        self.selection_history.pop()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "wasm", wasm_bindgen)]
pub enum Direction {
    Up,
    Down,
    Left,
    Right,
}

impl Direction {
    pub fn opposite(&self) -> Direction {
        match self {
            Direction::Up => Direction::Down,
            Direction::Down => Direction::Up,
            Direction::Left => Direction::Right,
            Direction::Right => Direction::Left,
        }
    }
}

impl Default for SelectionManager {
    fn default() -> Self {
        Self::new()
    }
}

// WASM wrapper for SelectionManager
#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub struct WasmSelectionManager {
    inner: SelectionManager,
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
impl WasmSelectionManager {
    /// Create a new SelectionManager (WASM constructor)
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: SelectionManager::new(),
        }
    }

    /// Get the primary selection as JSON
    #[wasm_bindgen(js_name = "getPrimary")]
    pub fn get_primary(&self) -> JsValue {
        serde_wasm_bindgen::to_value(&self.inner.primary_selection).unwrap_or(JsValue::NULL)
    }

    /// Set the primary selection from JSON
    #[wasm_bindgen(js_name = "setPrimary")]
    pub fn set_primary(&mut self, selection_js: JsValue) -> std::result::Result<(), JsValue> {
        let selection: Selection = serde_wasm_bindgen::from_value(selection_js)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        self.inner.set_primary(selection);
        Ok(())
    }

    /// Get all secondary selections as JSON array
    #[wasm_bindgen(js_name = "getSecondary")]
    pub fn get_secondary(&self) -> JsValue {
        serde_wasm_bindgen::to_value(&self.inner.secondary_selections).unwrap_or(JsValue::NULL)
    }

    /// Add a secondary selection from JSON
    #[wasm_bindgen(js_name = "addSecondary")]
    pub fn add_secondary(&mut self, selection_js: JsValue) -> std::result::Result<(), JsValue> {
        let selection: Selection = serde_wasm_bindgen::from_value(selection_js)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        self.inner.add_secondary(selection);
        Ok(())
    }

    /// Clear all secondary selections
    #[wasm_bindgen(js_name = "clearSecondary")]
    pub fn clear_secondary(&mut self) {
        self.inner.clear_secondary();
    }

    /// Check if a cell is selected
    #[wasm_bindgen(js_name = "isSelected")]
    pub fn is_selected(&self, col: u32, row: u32) -> bool {
        let address = CellAddress::new(col, row);
        self.inner.is_selected(&address)
    }

    /// Expand selection in a direction
    #[wasm_bindgen(js_name = "expandSelection")]
    pub fn expand_selection(&mut self, direction: Direction, amount: u32) -> std::result::Result<(), JsValue> {
        self.inner.expand_selection(direction, amount)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Contract selection in a direction
    #[wasm_bindgen(js_name = "contractSelection")]
    pub fn contract_selection(&mut self, direction: Direction, amount: u32) -> std::result::Result<(), JsValue> {
        self.inner.contract_selection(direction, amount)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Select a range of cells
    #[wasm_bindgen(js_name = "selectRange")]
    pub fn select_range(&mut self, start_col: u32, start_row: u32, end_col: u32, end_row: u32) {
        let start = CellAddress::new(start_col, start_row);
        let end = CellAddress::new(end_col, end_row);
        self.inner.select_range(start, end);
    }

    /// Select entire rows
    #[wasm_bindgen(js_name = "selectRows")]
    pub fn select_rows(&mut self, rows: Vec<u32>) {
        self.inner.select_rows(rows);
    }

    /// Select entire columns  
    #[wasm_bindgen(js_name = "selectColumns")]
    pub fn select_columns(&mut self, columns: Vec<u32>) {
        self.inner.select_columns(columns);
    }

    /// Select all cells
    #[wasm_bindgen(js_name = "selectAll")]
    pub fn select_all(&mut self) {
        self.inner.select_all();
    }

    /// Clear all selections
    #[wasm_bindgen(js_name = "clearAll")]
    pub fn clear_all(&mut self) {
        self.inner.clear_all();
    }

    /// Get all selected cells as an array of [col, row] pairs
    #[wasm_bindgen(js_name = "getSelectedCells")]
    pub fn get_selected_cells(&self) -> js_sys::Array {
        let arr = js_sys::Array::new();
        for addr in self.inner.get_selected_cells() {
            let cell_arr = js_sys::Array::new();
            cell_arr.push(&JsValue::from(addr.col));
            cell_arr.push(&JsValue::from(addr.row));
            arr.push(&cell_arr);
        }
        arr
    }

    /// Get clipboard content as JSON
    #[wasm_bindgen(js_name = "getClipboard")]
    pub fn get_clipboard(&self) -> JsValue {
        match &self.inner.clipboard {
            Some(content) => serde_wasm_bindgen::to_value(content).unwrap_or(JsValue::NULL),
            None => JsValue::NULL,
        }
    }

    /// Clear clipboard
    #[wasm_bindgen(js_name = "clearClipboard")]  
    pub fn clear_clipboard(&mut self) {
        self.inner.clear_clipboard();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_selection_contains() {
        let manager = SelectionManager::new();

        // Test cell selection
        let selection = Selection {
            selection_type: SelectionType::Cell {
                address: CellAddress::new(5, 5),
            },
            anchor: None,
        };
        assert!(manager.selection_contains(&selection, &CellAddress::new(5, 5)));
        assert!(!manager.selection_contains(&selection, &CellAddress::new(5, 6)));

        // Test range selection
        let selection = Selection {
            selection_type: SelectionType::Range {
                start: CellAddress::new(2, 2),
                end: CellAddress::new(5, 5),
            },
            anchor: None,
        };
        assert!(manager.selection_contains(&selection, &CellAddress::new(3, 3)));
        assert!(manager.selection_contains(&selection, &CellAddress::new(2, 2)));
        assert!(manager.selection_contains(&selection, &CellAddress::new(5, 5)));
        assert!(!manager.selection_contains(&selection, &CellAddress::new(6, 6)));
        assert!(!manager.selection_contains(&selection, &CellAddress::new(1, 1)));
    }

    #[test]
    fn test_expand_selection() {
        let mut manager = SelectionManager::new();

        // Start with a single cell
        manager.set_primary(Selection {
            selection_type: SelectionType::Cell {
                address: CellAddress::new(5, 5),
            },
            anchor: None,
        });

        // Expand right
        manager.expand_selection(Direction::Right, 2).unwrap();

        match &manager.get_primary().selection_type {
            SelectionType::Range { start, end } => {
                assert_eq!(*start, CellAddress::new(5, 5));
                assert_eq!(*end, CellAddress::new(7, 5));
            }
            _ => panic!("Expected range selection"),
        }

        // Expand down
        manager.expand_selection(Direction::Down, 3).unwrap();

        match &manager.get_primary().selection_type {
            SelectionType::Range { start, end } => {
                assert_eq!(*start, CellAddress::new(5, 5));
                assert_eq!(*end, CellAddress::new(7, 8));
            }
            _ => panic!("Expected range selection"),
        }
    }

    #[test]
    fn test_selected_cells() {
        let mut manager = SelectionManager::new();

        // Select a range
        manager.select_range(CellAddress::new(1, 1), CellAddress::new(3, 3));

        let cells = manager.get_selected_cells();
        assert_eq!(cells.len(), 9); // 3x3 grid
        assert!(cells.contains(&CellAddress::new(1, 1)));
        assert!(cells.contains(&CellAddress::new(2, 2)));
        assert!(cells.contains(&CellAddress::new(3, 3)));
        assert!(!cells.contains(&CellAddress::new(4, 4)));
    }

    #[test]
    fn test_selection_history() {
        let mut manager = SelectionManager::new();

        // Make several selections
        manager.set_primary(Selection {
            selection_type: SelectionType::Cell {
                address: CellAddress::new(1, 1),
            },
            anchor: None,
        });

        manager.set_primary(Selection {
            selection_type: SelectionType::Cell {
                address: CellAddress::new(2, 2),
            },
            anchor: None,
        });

        manager.set_primary(Selection {
            selection_type: SelectionType::Cell {
                address: CellAddress::new(3, 3),
            },
            anchor: None,
        });

        // Go back through history
        let prev = manager.previous_selection().unwrap();
        match prev.selection_type {
            SelectionType::Cell { address } => assert_eq!(address, CellAddress::new(2, 2)),
            _ => panic!("Expected cell selection"),
        }

        let prev = manager.previous_selection().unwrap();
        match prev.selection_type {
            SelectionType::Cell { address } => assert_eq!(address, CellAddress::new(1, 1)),
            _ => panic!("Expected cell selection"),
        }
    }
}
