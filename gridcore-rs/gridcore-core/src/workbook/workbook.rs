use super::sheet::Sheet;
use crate::domain::Cell;
use crate::formula::Expr;
use crate::types::{CellAddress, CellValue};
use crate::{Result, SpreadsheetError};
use chrono::{DateTime, Utc};
use std::collections::HashMap;

/// Metadata for a workbook
#[derive(Debug, Clone)]
pub struct WorkbookMetadata {
    /// Title of the workbook
    pub title: String,
    /// Author of the workbook
    pub author: Option<String>,
    /// Description of the workbook
    pub description: Option<String>,
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    /// Last modified timestamp
    pub modified_at: DateTime<Utc>,
    /// Version number
    pub version: String,
    /// Custom properties
    pub custom_properties: HashMap<String, String>,
}

impl Default for WorkbookMetadata {
    fn default() -> Self {
        let now = Utc::now();
        Self {
            title: "Untitled".to_string(),
            author: None,
            description: None,
            created_at: now,
            modified_at: now,
            version: "1.0.0".to_string(),
            custom_properties: HashMap::new(),
        }
    }
}

/// Represents a workbook containing multiple sheets
pub struct Workbook {
    /// Sheets in the workbook (sheet name -> sheet)
    sheets: HashMap<String, Sheet>,
    /// Order of sheets
    sheet_order: Vec<String>,
    /// Currently active sheet
    active_sheet: Option<String>,
    /// Workbook metadata
    metadata: WorkbookMetadata,
    /// Shared formulas (for optimization)
    #[allow(dead_code)]
    shared_formulas: HashMap<String, Expr>,
    /// Global named ranges (accessible from all sheets)
    global_named_ranges: HashMap<String, (String, Vec<CellAddress>)>, // name -> (sheet, addresses)
}

impl Workbook {
    /// Create a new empty workbook
    pub fn new() -> Self {
        Self {
            sheets: HashMap::new(),
            sheet_order: Vec::new(),
            active_sheet: None,
            metadata: WorkbookMetadata::default(),
            shared_formulas: HashMap::new(),
            global_named_ranges: HashMap::new(),
        }
    }

    /// Create a new workbook with an initial sheet
    pub fn with_sheet(sheet_name: impl Into<String>) -> Self {
        let mut workbook = Self::new();
        let name = sheet_name.into();
        workbook.add_sheet(Sheet::new(name.clone())).unwrap();
        workbook.active_sheet = Some(name);
        workbook
    }

    /// Add a new sheet to the workbook
    pub fn add_sheet(&mut self, sheet: Sheet) -> Result<()> {
        let name = sheet.name().to_string();

        if self.sheets.contains_key(&name) {
            return Err(SpreadsheetError::InvalidOperation(format!(
                "Sheet '{}' already exists",
                name
            )));
        }

        self.sheets.insert(name.clone(), sheet);
        self.sheet_order.push(name.clone());

        // Set as active if it's the first sheet
        if self.active_sheet.is_none() {
            self.active_sheet = Some(name);
        }

        self.metadata.modified_at = Utc::now();
        Ok(())
    }

    /// Create and add a new sheet with the given name
    pub fn create_sheet(&mut self, name: impl Into<String>) -> Result<()> {
        let sheet = Sheet::new(name);
        self.add_sheet(sheet)
    }

    /// Remove a sheet from the workbook
    pub fn remove_sheet(&mut self, name: &str) -> Result<Sheet> {
        if self.sheets.len() <= 1 {
            return Err(SpreadsheetError::InvalidOperation(
                "Cannot remove the last sheet".to_string(),
            ));
        }

        let sheet = self.sheets.remove(name).ok_or_else(|| {
            SpreadsheetError::InvalidOperation(format!("Sheet '{}' not found", name))
        })?;

        self.sheet_order.retain(|n| n != name);

        // Update active sheet if necessary
        if self.active_sheet.as_deref() == Some(name) {
            self.active_sheet = self.sheet_order.first().cloned();
        }

        // Remove global named ranges from this sheet
        self.global_named_ranges
            .retain(|_, (sheet_name, _)| sheet_name != name);

        self.metadata.modified_at = Utc::now();
        Ok(sheet)
    }

    /// Rename a sheet
    pub fn rename_sheet(&mut self, old_name: &str, new_name: impl Into<String>) -> Result<()> {
        let new_name = new_name.into();

        if self.sheets.contains_key(&new_name) {
            return Err(SpreadsheetError::InvalidOperation(format!(
                "Sheet '{}' already exists",
                new_name
            )));
        }

        let mut sheet = self.sheets.remove(old_name).ok_or_else(|| {
            SpreadsheetError::InvalidOperation(format!("Sheet '{}' not found", old_name))
        })?;

        sheet.rename(new_name.clone())?;

        // Update sheet order
        for name in &mut self.sheet_order {
            if name == old_name {
                *name = new_name.clone();
            }
        }

        // Update active sheet if necessary
        if self.active_sheet.as_deref() == Some(old_name) {
            self.active_sheet = Some(new_name.clone());
        }

        // Update global named ranges
        for (sheet_name, _) in self.global_named_ranges.values_mut() {
            if sheet_name == old_name {
                *sheet_name = new_name.clone();
            }
        }

        self.sheets.insert(new_name, sheet);
        self.metadata.modified_at = Utc::now();
        Ok(())
    }

    /// Copy a sheet
    pub fn copy_sheet(&mut self, source_name: &str, target_name: impl Into<String>) -> Result<()> {
        let target_name = target_name.into();

        if self.sheets.contains_key(&target_name) {
            return Err(SpreadsheetError::InvalidOperation(format!(
                "Sheet '{}' already exists",
                target_name
            )));
        }

        let source_sheet = self.sheets.get(source_name).ok_or_else(|| {
            SpreadsheetError::InvalidOperation(format!("Sheet '{}' not found", source_name))
        })?;

        let new_sheet = source_sheet.clone_with_name(target_name.clone());

        self.sheets.insert(target_name.clone(), new_sheet);
        self.sheet_order.push(target_name);

        self.metadata.modified_at = Utc::now();
        Ok(())
    }

    /// Move a sheet to a new position
    pub fn move_sheet(&mut self, name: &str, new_index: usize) -> Result<()> {
        if !self.sheets.contains_key(name) {
            return Err(SpreadsheetError::InvalidOperation(format!(
                "Sheet '{}' not found",
                name
            )));
        }

        let current_index = self
            .sheet_order
            .iter()
            .position(|n| n == name)
            .ok_or_else(|| {
                SpreadsheetError::InvalidOperation("Sheet not in order list".to_string())
            })?;

        if new_index >= self.sheet_order.len() {
            return Err(SpreadsheetError::InvalidOperation(
                "Invalid sheet index".to_string(),
            ));
        }

        let sheet_name = self.sheet_order.remove(current_index);
        self.sheet_order.insert(new_index, sheet_name);

        self.metadata.modified_at = Utc::now();
        Ok(())
    }

    /// Get a sheet by name
    pub fn get_sheet(&self, name: &str) -> Option<&Sheet> {
        self.sheets.get(name)
    }

    /// Get a mutable sheet by name
    pub fn get_sheet_mut(&mut self, name: &str) -> Option<&mut Sheet> {
        self.metadata.modified_at = Utc::now();
        self.sheets.get_mut(name)
    }

    /// Get the active sheet
    pub fn active_sheet(&self) -> Option<&Sheet> {
        self.active_sheet
            .as_ref()
            .and_then(|name| self.sheets.get(name))
    }

    /// Get the active sheet mutably
    pub fn active_sheet_mut(&mut self) -> Option<&mut Sheet> {
        self.metadata.modified_at = Utc::now();
        self.active_sheet
            .as_ref()
            .and_then(|name| self.sheets.get_mut(name))
    }

    /// Set the active sheet
    pub fn set_active_sheet(&mut self, name: impl Into<String>) -> Result<()> {
        let name = name.into();
        if !self.sheets.contains_key(&name) {
            return Err(SpreadsheetError::InvalidOperation(format!(
                "Sheet '{}' not found",
                name
            )));
        }
        self.active_sheet = Some(name);
        self.metadata.modified_at = Utc::now();
        Ok(())
    }

    /// Get all sheet names in order
    pub fn sheet_names(&self) -> &[String] {
        &self.sheet_order
    }

    /// Get the number of sheets
    pub fn sheet_count(&self) -> usize {
        self.sheets.len()
    }

    /// Get workbook metadata
    pub fn metadata(&self) -> &WorkbookMetadata {
        &self.metadata
    }

    /// Get mutable workbook metadata
    pub fn metadata_mut(&mut self) -> &mut WorkbookMetadata {
        self.metadata.modified_at = Utc::now();
        &mut self.metadata
    }

    /// Add a global named range
    pub fn add_global_named_range(
        &mut self,
        name: impl Into<String>,
        sheet_name: impl Into<String>,
        addresses: Vec<CellAddress>,
    ) -> Result<()> {
        let sheet_name = sheet_name.into();
        if !self.sheets.contains_key(&sheet_name) {
            return Err(SpreadsheetError::InvalidOperation(format!(
                "Sheet '{}' not found",
                sheet_name
            )));
        }

        self.global_named_ranges
            .insert(name.into(), (sheet_name, addresses));
        self.metadata.modified_at = Utc::now();
        Ok(())
    }

    /// Get a global named range
    pub fn get_global_named_range(&self, name: &str) -> Option<(&str, &Vec<CellAddress>)> {
        self.global_named_ranges
            .get(name)
            .map(|(sheet, addresses)| (sheet.as_str(), addresses))
    }

    /// Remove a global named range
    pub fn remove_global_named_range(&mut self, name: &str) -> Option<(String, Vec<CellAddress>)> {
        self.metadata.modified_at = Utc::now();
        self.global_named_ranges.remove(name)
    }

    /// Parse a cross-sheet reference (e.g., "Sheet1!A1")
    pub fn parse_sheet_reference(&self, reference: &str) -> Result<(String, CellAddress)> {
        let parts: Vec<&str> = reference.split('!').collect();
        if parts.len() != 2 {
            return Err(SpreadsheetError::InvalidOperation(format!(
                "Invalid sheet reference: {}",
                reference
            )));
        }

        let sheet_name = parts[0].to_string();
        if !self.sheets.contains_key(&sheet_name) {
            return Err(SpreadsheetError::InvalidOperation(format!(
                "Sheet '{}' not found",
                sheet_name
            )));
        }

        // Parse the cell address
        let address = CellAddress::from_a1(parts[1]).map_err(|_| {
            SpreadsheetError::InvalidOperation(format!("Invalid cell address: {}", parts[1]))
        })?;

        Ok((sheet_name, address))
    }

    /// Get a cell value from any sheet
    pub fn get_cell_value(&self, sheet_name: &str, address: &CellAddress) -> Option<CellValue> {
        self.sheets
            .get(sheet_name)
            .and_then(|sheet| sheet.get_cell(address))
            .map(|cell| cell.get_computed_value())
    }

    /// Set a cell value in any sheet
    pub fn set_cell_value(
        &mut self,
        sheet_name: &str,
        address: &CellAddress,
        cell: Cell,
    ) -> Result<()> {
        let sheet = self.sheets.get(sheet_name).ok_or_else(|| {
            SpreadsheetError::InvalidOperation(format!("Sheet '{}' not found", sheet_name))
        })?;

        sheet.set_cell(address, cell)?;
        self.metadata.modified_at = Utc::now();
        Ok(())
    }

    /// Delete a sheet (alias for remove_sheet)
    pub fn delete_sheet(&mut self, name: &str) -> Result<()> {
        self.remove_sheet(name)?;
        Ok(())
    }

    /// Get the active sheet name
    pub fn active_sheet_name(&self) -> Option<&str> {
        self.active_sheet.as_deref()
    }
}

impl Default for Workbook {
    fn default() -> Self {
        Self::with_sheet("Sheet1")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_workbook_creation() {
        let workbook = Workbook::with_sheet("Sheet1");
        assert_eq!(workbook.sheet_count(), 1);
        assert_eq!(workbook.sheet_names(), &["Sheet1"]);
        assert_eq!(workbook.active_sheet().unwrap().name(), "Sheet1");
    }

    #[test]
    fn test_add_remove_sheets() {
        let mut workbook = Workbook::with_sheet("Sheet1");

        workbook.create_sheet("Sheet2").unwrap();
        assert_eq!(workbook.sheet_count(), 2);

        workbook.create_sheet("Sheet3").unwrap();
        assert_eq!(workbook.sheet_count(), 3);

        let removed = workbook.remove_sheet("Sheet2").unwrap();
        assert_eq!(removed.name(), "Sheet2");
        assert_eq!(workbook.sheet_count(), 2);

        // Cannot remove last sheet
        workbook.remove_sheet("Sheet1").unwrap();
        assert!(workbook.remove_sheet("Sheet3").is_err());
    }

    #[test]
    fn test_rename_sheet() {
        let mut workbook = Workbook::with_sheet("OldName");

        workbook.rename_sheet("OldName", "NewName").unwrap();
        assert!(workbook.get_sheet("OldName").is_none());
        assert!(workbook.get_sheet("NewName").is_some());

        // Cannot rename to existing name
        workbook.create_sheet("Sheet2").unwrap();
        assert!(workbook.rename_sheet("Sheet2", "NewName").is_err());
    }

    #[test]
    fn test_copy_sheet() {
        let mut workbook = Workbook::with_sheet("Original");

        // Add some data to the original sheet
        let sheet = workbook.get_sheet_mut("Original").unwrap();
        sheet
            .set_cell(&CellAddress::new(0, 0), Cell::new(CellValue::Number(42.0)))
            .unwrap();

        // Copy the sheet
        workbook.copy_sheet("Original", "Copy").unwrap();

        // Check that the copy has the same data
        let copy = workbook.get_sheet("Copy").unwrap();
        let cell = copy.get_cell(&CellAddress::new(0, 0)).unwrap();
        assert_eq!(cell.get_computed_value(), CellValue::Number(42.0));
    }

    #[test]
    fn test_move_sheet() {
        let mut workbook = Workbook::new();
        workbook.create_sheet("Sheet1").unwrap();
        workbook.create_sheet("Sheet2").unwrap();
        workbook.create_sheet("Sheet3").unwrap();

        assert_eq!(workbook.sheet_names(), &["Sheet1", "Sheet2", "Sheet3"]);

        workbook.move_sheet("Sheet3", 0).unwrap();
        assert_eq!(workbook.sheet_names(), &["Sheet3", "Sheet1", "Sheet2"]);

        workbook.move_sheet("Sheet1", 2).unwrap();
        assert_eq!(workbook.sheet_names(), &["Sheet3", "Sheet2", "Sheet1"]);
    }

    #[test]
    fn test_global_named_ranges() {
        let mut workbook = Workbook::with_sheet("Sheet1");

        let range = vec![CellAddress::new(0, 0), CellAddress::new(1, 0)];
        workbook
            .add_global_named_range("MyRange", "Sheet1", range.clone())
            .unwrap();

        let (sheet, addresses) = workbook.get_global_named_range("MyRange").unwrap();
        assert_eq!(sheet, "Sheet1");
        assert_eq!(addresses, &range);
    }

    #[test]
    fn test_parse_sheet_reference() {
        let workbook = Workbook::with_sheet("Sheet1");

        let (sheet, address) = workbook.parse_sheet_reference("Sheet1!A1").unwrap();
        assert_eq!(sheet, "Sheet1");
        assert_eq!(address, CellAddress::new(0, 0));

        // Invalid references
        assert!(workbook.parse_sheet_reference("InvalidSheet!A1").is_err());
        assert!(workbook.parse_sheet_reference("Sheet1").is_err());
    }
}
