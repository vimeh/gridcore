use crate::managers::ErrorManager;

/// Manager access trait for SpreadsheetController
pub trait ManagerAccess {
    fn get_error_manager(&self) -> &ErrorManager;
    fn get_error_manager_mut(&mut self) -> &mut ErrorManager;
}
