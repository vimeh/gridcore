use crate::Result;
use crate::dependency::DependencyGraph;
use crate::domain::Cell;
use crate::ports::RepositoryPort;
use crate::types::CellAddress;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// Properties for a spreadsheet sheet
#[derive(Debug, Clone)]
pub struct SheetProperties {
    /// Whether the sheet is visible
    pub visible: bool,
    /// Whether the sheet is protected from editing
    pub protected: bool,
    /// Custom column widths (column index -> width in pixels)
    pub column_widths: HashMap<u32, f64>,
    /// Custom row heights (row index -> height in pixels)
    pub row_heights: HashMap<u32, f64>,
    /// Default column width
    pub default_column_width: f64,
    /// Default row height
    pub default_row_height: f64,
    /// Sheet color (for tab)
    pub tab_color: Option<String>,
}

impl Default for SheetProperties {
    fn default() -> Self {
        Self {
            visible: true,
            protected: false,
            column_widths: HashMap::new(),
            row_heights: HashMap::new(),
            default_column_width: 100.0,
            default_row_height: 20.0,
            tab_color: None,
        }
    }
}

/// Represents a single sheet in a workbook
pub struct Sheet {
    /// Unique name of the sheet
    name: String,
    /// Cell repository for this sheet
    cells: Arc<dyn RepositoryPort>,
    /// Dependency graph for this sheet
    dependencies: Arc<Mutex<DependencyGraph>>,
    /// Sheet properties
    properties: SheetProperties,
    /// Named ranges in this sheet
    named_ranges: HashMap<String, Vec<CellAddress>>,
}

impl Sheet {
    /// Create a new sheet with the given name
    pub fn new(name: impl Into<String>) -> Self {
        use crate::adapters::RepositoryAdapter;
        Self {
            name: name.into(),
            cells: Arc::new(RepositoryAdapter::new_empty()),
            dependencies: Arc::new(Mutex::new(DependencyGraph::new())),
            properties: SheetProperties::default(),
            named_ranges: HashMap::new(),
        }
    }

    /// Create a new sheet with custom properties
    pub fn with_properties(name: impl Into<String>, properties: SheetProperties) -> Self {
        use crate::adapters::RepositoryAdapter;
        Self {
            name: name.into(),
            cells: Arc::new(RepositoryAdapter::new_empty()),
            dependencies: Arc::new(Mutex::new(DependencyGraph::new())),
            properties,
            named_ranges: HashMap::new(),
        }
    }

    /// Create a new sheet with a specific repository
    pub fn with_repository(name: impl Into<String>, repository: Arc<dyn RepositoryPort>) -> Self {
        Self {
            name: name.into(),
            cells: repository,
            dependencies: Arc::new(Mutex::new(DependencyGraph::new())),
            properties: SheetProperties::default(),
            named_ranges: HashMap::new(),
        }
    }

    /// Get the sheet name
    pub fn name(&self) -> &str {
        &self.name
    }

    /// Rename the sheet
    pub fn rename(&mut self, new_name: impl Into<String>) -> Result<()> {
        self.name = new_name.into();
        Ok(())
    }

    /// Get sheet properties
    pub fn properties(&self) -> &SheetProperties {
        &self.properties
    }

    /// Get mutable sheet properties
    pub fn properties_mut(&mut self) -> &mut SheetProperties {
        &mut self.properties
    }

    /// Set the visibility of the sheet
    pub fn set_visible(&mut self, visible: bool) {
        self.properties.visible = visible;
    }

    /// Set the protection status of the sheet
    pub fn set_protected(&mut self, is_protected: bool) {
        self.properties.protected = is_protected;
    }

    /// Get a cell from the sheet
    pub fn get_cell(&self, address: &CellAddress) -> Option<Cell> {
        self.cells.get(address)
    }

    /// Set a cell in the sheet
    pub fn set_cell(&self, address: &CellAddress, cell: Cell) -> Result<()> {
        self.cells.set(address, cell)
    }

    /// Get the cell repository
    pub fn cells(&self) -> Arc<dyn RepositoryPort> {
        self.cells.clone()
    }

    /// Get the dependency graph
    pub fn dependencies(&self) -> Arc<Mutex<DependencyGraph>> {
        self.dependencies.clone()
    }

    /// Set column width
    pub fn set_column_width(&mut self, column: u32, width: f64) {
        self.properties.column_widths.insert(column, width);
    }

    /// Get column width
    pub fn get_column_width(&self, column: u32) -> f64 {
        self.properties
            .column_widths
            .get(&column)
            .copied()
            .unwrap_or(self.properties.default_column_width)
    }

    /// Set row height
    pub fn set_row_height(&mut self, row: u32, height: f64) {
        self.properties.row_heights.insert(row, height);
    }

    /// Get row height
    pub fn get_row_height(&self, row: u32) -> f64 {
        self.properties
            .row_heights
            .get(&row)
            .copied()
            .unwrap_or(self.properties.default_row_height)
    }

    /// Add a named range
    pub fn add_named_range(&mut self, name: impl Into<String>, addresses: Vec<CellAddress>) {
        self.named_ranges.insert(name.into(), addresses);
    }

    /// Get a named range
    pub fn get_named_range(&self, name: &str) -> Option<&Vec<CellAddress>> {
        self.named_ranges.get(name)
    }

    /// Remove a named range
    pub fn remove_named_range(&mut self, name: &str) -> Option<Vec<CellAddress>> {
        self.named_ranges.remove(name)
    }

    /// Clear all cells in the sheet
    pub fn clear(&self) {
        // Clear the repository
        let _ = self.cells.clear();

        // Clear dependencies
        if let Ok(mut deps) = self.dependencies.lock() {
            deps.clear();
        }
    }

    /// Get the number of cells in the sheet
    pub fn cell_count(&self) -> usize {
        self.cells.count()
    }

    /// Clone the sheet with a new name
    pub fn clone_with_name(&self, new_name: impl Into<String>) -> Self {
        use crate::adapters::RepositoryAdapter;

        // Create a new repository and copy all cells
        let new_repo = Arc::new(RepositoryAdapter::new_empty());

        // Copy all cells from the current sheet to the new one
        let all_cells = self.cells.get_all();
        for (address, cell) in all_cells {
            let _ = new_repo.set(&address, cell);
        }

        Self {
            name: new_name.into(),
            cells: new_repo as Arc<dyn RepositoryPort>,
            dependencies: Arc::new(Mutex::new(
                self.dependencies
                    .lock()
                    .expect("Failed to acquire dependencies lock for cloning")
                    .clone(),
            )),
            properties: self.properties.clone(),
            named_ranges: self.named_ranges.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sheet_creation() {
        let sheet = Sheet::new("Sheet1");
        assert_eq!(sheet.name(), "Sheet1");
        assert!(sheet.properties().visible);
        assert!(!sheet.properties().protected);
    }

    #[test]
    fn test_sheet_rename() {
        let mut sheet = Sheet::new("OldName");
        sheet.rename("NewName").unwrap();
        assert_eq!(sheet.name(), "NewName");
    }

    #[test]
    fn test_column_width() {
        let mut sheet = Sheet::new("Sheet1");
        sheet.set_column_width(0, 150.0);
        assert_eq!(sheet.get_column_width(0), 150.0);
        assert_eq!(sheet.get_column_width(1), 100.0); // default
    }

    #[test]
    fn test_named_ranges() {
        let mut sheet = Sheet::new("Sheet1");
        let range = vec![
            CellAddress::new(0, 0),
            CellAddress::new(1, 0),
            CellAddress::new(2, 0),
        ];
        sheet.add_named_range("MyRange", range.clone());

        assert_eq!(sheet.get_named_range("MyRange"), Some(&range));

        let removed = sheet.remove_named_range("MyRange");
        assert_eq!(removed, Some(range));
        assert_eq!(sheet.get_named_range("MyRange"), None);
    }
}
