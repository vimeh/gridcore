use gridcore_core::Result;

/// Sheet management trait for SpreadsheetController
pub trait SheetManagement {
    fn add_sheet(&mut self, name: &str) -> Result<()>;
    fn remove_sheet(&mut self, name: &str) -> Result<()>;
    fn rename_sheet(&mut self, old_name: &str, new_name: &str) -> Result<()>;
    fn set_active_sheet(&mut self, name: &str) -> Result<()>;
    fn get_active_sheet(&self) -> String;
    fn get_sheet_names(&self) -> Vec<String>;
    fn get_sheet_count(&self) -> usize;
}