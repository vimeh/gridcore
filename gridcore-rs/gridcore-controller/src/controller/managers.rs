use crate::managers::{AutocompleteManager, ErrorManager, ResizeManager, SelectionStatsManager};

/// Manager access trait for SpreadsheetController
pub trait ManagerAccess {
    fn get_resize_manager(&self) -> &ResizeManager;
    fn get_resize_manager_mut(&mut self) -> &mut ResizeManager;
    fn get_autocomplete_manager(&self) -> &AutocompleteManager;
    fn get_autocomplete_manager_mut(&mut self) -> &mut AutocompleteManager;
    fn get_selection_stats_manager(&self) -> &SelectionStatsManager;
    fn get_error_manager(&self) -> &ErrorManager;
    fn get_error_manager_mut(&mut self) -> &mut ErrorManager;
}
