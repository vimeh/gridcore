use super::Workbook;
use crate::types::{CellAddress, CellValue};
use crate::domain::Cell;
use crate::formula::FormulaParser;
use crate::references::{ReferenceAdjuster, StructuralOperation};
use crate::{Result, SpreadsheetError};

/// Manages operations across multiple sheets
pub struct SheetManager {
    workbook: Workbook,
}

impl SheetManager {
    /// Create a new sheet manager with an empty workbook
    pub fn new() -> Self {
        Self {
            workbook: Workbook::default(),
        }
    }

    /// Create a sheet manager with an existing workbook
    pub fn with_workbook(workbook: Workbook) -> Self {
        Self { workbook }
    }

    /// Get the workbook
    pub fn workbook(&self) -> &Workbook {
        &self.workbook
    }

    /// Get the workbook mutably
    pub fn workbook_mut(&mut self) -> &mut Workbook {
        &mut self.workbook
    }

    /// Evaluate a cross-sheet formula
    pub fn evaluate_cross_sheet_formula(&self, formula: &str) -> Result<CellValue> {
        // Parse the formula
        let expr = FormulaParser::parse(formula)?;
        
        // This would need to be extended to handle cross-sheet references
        // For now, return a placeholder
        Ok(CellValue::Empty)
    }

    /// Copy cells from one sheet to another
    pub fn copy_cells(
        &mut self,
        source_sheet: &str,
        source_range: &[(CellAddress, CellAddress)],
        target_sheet: &str,
        target_start: &CellAddress,
    ) -> Result<()> {
        // Get source cells
        let mut cells_to_copy = Vec::new();
        
        let source = self.workbook.get_sheet(source_sheet)
            .ok_or_else(|| SpreadsheetError::InvalidOperation(format!("Source sheet '{}' not found", source_sheet)))?;
        
        for (start, end) in source_range {
            for row in start.row..=end.row {
                for col in start.col..=end.col {
                    let addr = CellAddress::new(col, row);
                    if let Some(cell) = source.get_cell(&addr) {
                        let offset_row = row - start.row;
                        let offset_col = col - start.col;
                        cells_to_copy.push((offset_row, offset_col, cell));
                    }
                }
            }
        }
        
        // Set cells in target sheet
        let target = self.workbook.get_sheet(target_sheet)
            .ok_or_else(|| SpreadsheetError::InvalidOperation(format!("Target sheet '{}' not found", target_sheet)))?;
        
        for (offset_row, offset_col, cell) in cells_to_copy {
            let target_addr = CellAddress::new(
                target_start.col + offset_col,
                target_start.row + offset_row,
            );
            target.set_cell(&target_addr, cell)?;
        }
        
        Ok(())
    }

    /// Move cells from one sheet to another
    pub fn move_cells(
        &mut self,
        source_sheet: &str,
        source_range: &[(CellAddress, CellAddress)],
        target_sheet: &str,
        target_start: &CellAddress,
    ) -> Result<()> {
        // Copy cells first
        self.copy_cells(source_sheet, source_range, target_sheet, target_start)?;
        
        // Then clear source cells
        let source = self.workbook.get_sheet(source_sheet)
            .ok_or_else(|| SpreadsheetError::InvalidOperation(format!("Source sheet '{}' not found", source_sheet)))?;
        
        for (start, end) in source_range {
            for row in start.row..=end.row {
                for col in start.col..=end.col {
                    let addr = CellAddress::new(col, row);
                    source.set_cell(&addr, Cell::empty())?;
                }
            }
        }
        
        Ok(())
    }

    /// Apply a structural operation to all sheets
    pub fn apply_structural_operation_to_all(&mut self, operation: StructuralOperation) -> Result<()> {
        let adjuster = ReferenceAdjuster::new();
        
        for sheet_name in self.workbook.sheet_names().to_vec() {
            if let Some(sheet) = self.workbook.get_sheet(&sheet_name) {
                let cells = sheet.cells();
                let mut adjusted_cells = Vec::new();
                
                // Collect cells that need adjustment
                for (address, cell) in cells.borrow().iter() {
                    if cell.has_formula() {
                        if let CellValue::String(formula_str) = &cell.raw_value {
                            if formula_str.starts_with('=') {
                                if let Ok(adjusted) = adjuster.adjust_formula(formula_str, &operation) {
                                    if adjusted != *formula_str {
                                        adjusted_cells.push((address.clone(), adjusted));
                                    }
                                }
                            }
                        }
                    }
                }
                
                // Apply adjustments
                drop(cells); // Release borrow
                for (address, adjusted_formula) in adjusted_cells {
                    let parsed = FormulaParser::parse(&adjusted_formula[1..])?;
                    let mut new_cell = Cell::with_formula(
                        CellValue::String(adjusted_formula),
                        parsed,
                    );
                    
                    if let Some(sheet) = self.workbook.get_sheet(&sheet_name) {
                        sheet.set_cell(&address, new_cell)?;
                    }
                }
            }
        }
        
        Ok(())
    }

    /// Find all cells that reference a specific cell across all sheets
    pub fn find_references_to(&self, target_sheet: &str, target_address: &CellAddress) -> Vec<(String, CellAddress)> {
        let mut references = Vec::new();
        
        for sheet_name in self.workbook.sheet_names() {
            if let Some(sheet) = self.workbook.get_sheet(sheet_name) {
                let cells = sheet.cells();
                for (address, cell) in cells.borrow().iter() {
                    if cell.has_formula() {
                        // Check if this formula references the target
                        // This would need proper formula parsing and analysis
                        // For now, this is a placeholder
                        if let CellValue::String(formula) = &cell.raw_value {
                            let target_ref = format!("{}!{}", target_sheet, target_address.to_a1());
                            if formula.contains(&target_ref) {
                                references.push((sheet_name.clone(), address.clone()));
                            }
                        }
                    }
                }
            }
        }
        
        references
    }

    /// Validate all formulas across all sheets
    pub fn validate_all_formulas(&self) -> Vec<(String, CellAddress, String)> {
        let mut errors = Vec::new();
        
        for sheet_name in self.workbook.sheet_names() {
            if let Some(sheet) = self.workbook.get_sheet(sheet_name) {
                let cells = sheet.cells();
                for (address, cell) in cells.borrow().iter() {
                    if cell.has_formula() {
                        if let CellValue::String(formula) = &cell.raw_value {
                            if formula.starts_with('=') {
                                if let Err(e) = FormulaParser::parse(&formula[1..]) {
                                    errors.push((
                                        sheet_name.clone(),
                                        address.clone(),
                                        format!("Parse error: {:?}", e),
                                    ));
                                }
                            }
                        }
                    }
                }
            }
        }
        
        errors
    }

    /// Get statistics about the workbook
    pub fn get_statistics(&self) -> WorkbookStatistics {
        let mut stats = WorkbookStatistics::default();
        
        stats.sheet_count = self.workbook.sheet_count();
        
        for sheet_name in self.workbook.sheet_names() {
            if let Some(sheet) = self.workbook.get_sheet(sheet_name) {
                let cell_count = sheet.cell_count();
                stats.total_cells += cell_count;
                
                let cells = sheet.cells();
                for (_, cell) in cells.borrow().iter() {
                    if cell.has_formula() {
                        stats.formula_cells += 1;
                    }
                    if cell.has_error() {
                        stats.error_cells += 1;
                    }
                }
            }
        }
        
        stats
    }
}

/// Statistics about a workbook
#[derive(Debug, Default, Clone)]
pub struct WorkbookStatistics {
    pub sheet_count: usize,
    pub total_cells: usize,
    pub formula_cells: usize,
    pub error_cells: usize,
}

impl Default for SheetManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sheet_manager_creation() {
        let manager = SheetManager::new();
        assert_eq!(manager.workbook().sheet_count(), 1);
    }

    #[test]
    fn test_copy_cells() {
        let mut manager = SheetManager::new();
        
        // Set up source sheet
        manager.workbook_mut().create_sheet("Source").unwrap();
        let source = manager.workbook_mut().get_sheet_mut("Source").unwrap();
        source.set_cell(&CellAddress::new(0, 0), Cell::new(CellValue::Number(1.0))).unwrap();
        source.set_cell(&CellAddress::new(1, 0), Cell::new(CellValue::Number(2.0))).unwrap();
        
        // Create target sheet
        manager.workbook_mut().create_sheet("Target").unwrap();
        
        // Copy cells
        let range = vec![(CellAddress::new(0, 0), CellAddress::new(1, 0))];
        manager.copy_cells("Source", &range, "Target", &CellAddress::new(2, 2)).unwrap();
        
        // Verify copy
        let target = manager.workbook().get_sheet("Target").unwrap();
        assert_eq!(
            target.get_cell(&CellAddress::new(2, 2)).unwrap().get_computed_value(),
            CellValue::Number(1.0)
        );
        assert_eq!(
            target.get_cell(&CellAddress::new(3, 2)).unwrap().get_computed_value(),
            CellValue::Number(2.0)
        );
    }

    #[test]
    fn test_workbook_statistics() {
        let mut manager = SheetManager::new();
        
        // Add some data
        let sheet = manager.workbook_mut().active_sheet_mut().unwrap();
        sheet.set_cell(&CellAddress::new(0, 0), Cell::new(CellValue::Number(1.0))).unwrap();
        sheet.set_cell(&CellAddress::new(1, 0), Cell::new(CellValue::String("=A1+1".to_string()))).unwrap();
        
        let stats = manager.get_statistics();
        assert_eq!(stats.sheet_count, 1);
        assert_eq!(stats.total_cells, 2);
    }
}