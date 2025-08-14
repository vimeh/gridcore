use crate::behaviors::selection_stats::SelectionStats;
use crate::controller::events::ErrorSeverity;
use crate::managers::{ErrorEntry, ErrorManager};
use crate::state::{Action, UIState};
use gridcore_core::error::Result;
use gridcore_core::types::CellAddress;

/// Facade for all cell-related operations
pub struct CellOperations<'a> {
    controller: &'a mut super::SpreadsheetController,
}

impl<'a> CellOperations<'a> {
    pub(super) fn new(controller: &'a mut super::SpreadsheetController) -> Self {
        Self { controller }
    }

    /// Get display value for a cell
    pub fn display_value(&self, address: &CellAddress) -> String {
        if let Some(cell) = self.controller.facade().get_cell(address) {
            if cell.has_formula() {
                // Show the formula for editing
                cell.raw_value.to_string()
            } else {
                // Show the display value
                cell.get_display_value().to_string()
            }
        } else {
            String::new()
        }
    }

    /// Set cell value through facade
    pub fn set_value(&mut self, address: &CellAddress, value: &str) -> Result<()> {
        self.controller.facade_mut().set_cell_value(address, value)
    }

    /// Get cell value through facade  
    pub fn get_value(&self, address: &CellAddress) -> Option<gridcore_core::Cell> {
        self.controller.facade().get_cell(address)
    }

    /// Get current cursor position
    pub fn cursor(&self) -> CellAddress {
        self.controller.cursor()
    }

    /// Update cursor position
    pub fn set_cursor(&mut self, address: CellAddress) -> Result<()> {
        self.controller
            .dispatch_action(Action::UpdateCursor { cursor: address })
    }
}

/// Facade for all sheet-related operations
pub struct SheetOperations<'a> {
    controller: &'a mut super::SpreadsheetController,
}

impl<'a> SheetOperations<'a> {
    pub(super) fn new(controller: &'a mut super::SpreadsheetController) -> Self {
        Self { controller }
    }

    /// Get all sheets
    pub fn list(&self) -> Vec<(String, usize)> {
        self.controller.sheets()
    }

    /// Get active sheet name
    pub fn active(&self) -> String {
        self.controller.active_sheet()
    }

    /// Set active sheet
    pub fn set_active(&mut self, name: &str) -> Result<()> {
        self.controller.set_active_sheet(name)
    }

    /// Add a new sheet
    pub fn add(&mut self, name: &str) -> Result<()> {
        self.controller.add_sheet(name)
    }

    /// Remove a sheet
    pub fn remove(&mut self, name: &str) -> Result<()> {
        self.controller.remove_sheet(name)
    }

    /// Rename a sheet
    pub fn rename(&mut self, old_name: &str, new_name: &str) -> Result<()> {
        self.controller.rename_sheet(old_name, new_name)
    }

    /// Get sheet count
    pub fn count(&self) -> usize {
        self.controller.sheet_count()
    }
}

/// Facade for all error-related operations
pub struct ErrorOperations<'a> {
    controller: &'a mut super::SpreadsheetController,
}

impl<'a> ErrorOperations<'a> {
    pub(super) fn new(controller: &'a mut super::SpreadsheetController) -> Self {
        Self { controller }
    }

    /// Emit an error
    pub fn emit(&mut self, message: String, severity: ErrorSeverity) {
        // Use the non-deprecated internal method
        self.controller
            .get_error_manager_mut()
            .add_error(message.clone(), severity);

        // Dispatch event for UI updates
        self.controller.dispatch_event(
            crate::controller::events::SpreadsheetEvent::ErrorOccurred { message, severity },
        );
    }

    /// Get active errors
    pub fn active(&self) -> Vec<ErrorEntry> {
        self.controller.get_error_manager().get_active_errors()
    }

    /// Clear all errors
    pub fn clear_all(&mut self) {
        self.controller.get_error_manager_mut().clear_all();
    }

    /// Remove specific error
    pub fn remove(&mut self, id: usize) -> bool {
        self.controller.get_error_manager_mut().remove_error(id)
    }

    /// Get error manager directly (for advanced use)
    pub fn manager(&self) -> &ErrorManager {
        self.controller.get_error_manager()
    }

    /// Get mutable error manager (for advanced use)
    pub fn manager_mut(&mut self) -> &mut ErrorManager {
        self.controller.get_error_manager_mut()
    }
}

/// Facade for selection operations
pub struct SelectionOperations<'a> {
    controller: &'a super::SpreadsheetController,
}

impl<'a> SelectionOperations<'a> {
    pub(super) fn new(controller: &'a super::SpreadsheetController) -> Self {
        Self { controller }
    }

    /// Get current selection statistics
    pub fn stats(&self) -> SelectionStats {
        use crate::state::SelectionType;

        // Get the current selection from the state
        let selection = self.controller.state().selection();

        if let Some(sel) = selection {
            // Calculate stats based on selection type
            match &sel.selection_type {
                SelectionType::Range { start, end } => {
                    crate::behaviors::selection_stats::calculate_range(
                        self.controller.facade(),
                        start,
                        end,
                    )
                }
                SelectionType::Column { columns } => {
                    // For now, calculate stats for the first column
                    if let Some(first_col) = columns.first() {
                        // Calculate stats for a column by using a range from top to bottom
                        let start = gridcore_core::types::CellAddress::new(*first_col, 0);
                        let end = gridcore_core::types::CellAddress::new(*first_col, 1000); // Arbitrary large row
                        crate::behaviors::selection_stats::calculate_range(
                            self.controller.facade(),
                            &start,
                            &end,
                        )
                    } else {
                        SelectionStats::default()
                    }
                }
                SelectionType::Row { rows } => {
                    // For now, calculate stats for the first row
                    if let Some(first_row) = rows.first() {
                        // Calculate stats for a row by using a range from left to right
                        let start = gridcore_core::types::CellAddress::new(0, *first_row);
                        let end = gridcore_core::types::CellAddress::new(100, *first_row); // Arbitrary large column
                        crate::behaviors::selection_stats::calculate_range(
                            self.controller.facade(),
                            &start,
                            &end,
                        )
                    } else {
                        SelectionStats::default()
                    }
                }
                SelectionType::Cell { address } => {
                    crate::behaviors::selection_stats::calculate_single_cell(
                        self.controller.facade(),
                        address,
                    )
                }
                SelectionType::Multi { selections } => {
                    // For multi-selection, calculate stats for all ranges
                    let ranges: Vec<_> = selections
                        .iter()
                        .filter_map(|s| {
                            if let SelectionType::Range { start, end } = &s.selection_type {
                                Some((*start, *end))
                            } else {
                                None
                            }
                        })
                        .collect();
                    crate::behaviors::selection_stats::calculate_multi_range(
                        self.controller.facade(),
                        &ranges,
                    )
                }
            }
        } else {
            // No selection, calculate stats for current cursor position
            let cursor = self.controller.state().cursor();
            crate::behaviors::selection_stats::calculate_single_cell(
                self.controller.facade(),
                cursor,
            )
        }
    }

    /// Get current selection from state
    pub fn current(&self) -> Option<crate::state::Selection> {
        match self.controller.state() {
            UIState::Navigation { selection, .. } => selection.clone(),
            _ => None,
        }
    }
}
