use crate::managers::{AutocompleteManager, ErrorManager};

/// Manager access trait for SpreadsheetController
pub trait ManagerAccess {
    fn get_autocomplete_manager(&self) -> &AutocompleteManager;
    fn get_autocomplete_manager_mut(&mut self) -> &mut AutocompleteManager;
    fn get_error_manager(&self) -> &ErrorManager;
    fn get_error_manager_mut(&mut self) -> &mut ErrorManager;
}
