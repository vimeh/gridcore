use crate::state::{Selection, SelectionType};
use gridcore_core::{types::CellAddress, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

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
    #[allow(clippy::only_used_in_recursion)]
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
                let addr_clone = *address;
                let new_end = Self::move_address_static(&addr_clone, direction, amount)?;
                let start_addr = *address;
                self.primary_selection.selection_type = SelectionType::Range {
                    start: start_addr,
                    end: new_end,
                };
                if self.primary_selection.anchor.is_none() {
                    self.primary_selection.anchor = Some(start_addr);
                }
            }
            SelectionType::Range { start, end } => {
                // Expand the range
                let anchor_clone = self.primary_selection.anchor;
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
        } else if let SelectionType::Range { start, end } = &mut self.primary_selection.selection_type
        {
            *start = new_start;
            *end = new_end;
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
            anchor: Some(start),
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
    #[allow(clippy::only_used_in_recursion)]
    pub fn get_bounds(&self, selection: &Selection) -> (CellAddress, CellAddress) {
        match &selection.selection_type {
            SelectionType::Cell { address } => (*address, *address),
            SelectionType::Range { start, end } => (*start, *end),
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
                    cells.insert(*address);
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
                cells.insert(*address);
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
