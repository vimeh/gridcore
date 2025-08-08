#[cfg(test)]
mod workbook_integration_tests {
    use crate::domain::Cell;
    use crate::formula::FormulaParser;
    use crate::types::{CellAddress, CellValue};
    use crate::workbook::{Sheet, SheetManager, SheetProperties, Workbook};

    #[test]
    fn test_cross_sheet_references() {
        let mut workbook = Workbook::new();

        // Create two sheets
        workbook.create_sheet("Sheet1").unwrap();
        workbook.create_sheet("Sheet2").unwrap();

        // Add data to Sheet1
        let sheet1 = workbook.get_sheet_mut("Sheet1").unwrap();
        sheet1
            .set_cell(&CellAddress::new(0, 0), Cell::new(CellValue::Number(10.0)))
            .unwrap();
        sheet1
            .set_cell(&CellAddress::new(1, 0), Cell::new(CellValue::Number(20.0)))
            .unwrap();

        // Test parsing cross-sheet references
        let (sheet_name, address) = workbook.parse_sheet_reference("Sheet1!A1").unwrap();
        assert_eq!(sheet_name, "Sheet1");
        assert_eq!(address, CellAddress::new(0, 0));

        // Test getting values from other sheets
        let value = workbook.get_cell_value("Sheet1", &CellAddress::new(0, 0));
        assert_eq!(value, Some(CellValue::Number(10.0)));
    }

    #[test]
    fn test_sheet_hiding_and_protection() {
        let mut sheet = Sheet::new("TestSheet");

        // Test visibility
        assert!(sheet.properties().visible);
        sheet.set_visible(false);
        assert!(!sheet.properties().visible);

        // Test protection
        assert!(!sheet.properties().protected);
        sheet.set_protected(true);
        assert!(sheet.properties().protected);
    }

    #[test]
    fn test_multiple_sheet_operations() {
        let mut manager = SheetManager::new();
        let workbook = manager.workbook_mut();

        // Create multiple sheets (Sheet2 through Sheet6 since Sheet1 already exists)
        for i in 2..=6 {
            workbook.create_sheet(format!("Sheet{}", i)).unwrap();
        }

        assert_eq!(workbook.sheet_count(), 6); // Including default Sheet1

        // Test sheet ordering
        let names = workbook.sheet_names();
        assert_eq!(names[0], "Sheet1");
        assert_eq!(names[1], "Sheet2");

        // Move sheet to different position
        workbook.move_sheet("Sheet2", 0).unwrap();
        assert_eq!(workbook.sheet_names()[0], "Sheet2");
    }

    #[test]
    fn test_workbook_metadata() {
        let mut workbook = Workbook::new();

        // Set metadata
        let metadata = workbook.metadata_mut();
        metadata.title = "My Spreadsheet".to_string();
        metadata.author = Some("Test Author".to_string());
        metadata
            .custom_properties
            .insert("Department".to_string(), "Engineering".to_string());

        // Verify metadata
        let metadata = workbook.metadata();
        assert_eq!(metadata.title, "My Spreadsheet");
        assert_eq!(metadata.author, Some("Test Author".to_string()));
        assert_eq!(
            metadata.custom_properties.get("Department"),
            Some(&"Engineering".to_string())
        );
    }

    #[test]
    fn test_sheet_column_row_dimensions() {
        let mut sheet = Sheet::new("DimensionTest");

        // Set custom dimensions
        sheet.set_column_width(0, 150.0);
        sheet.set_column_width(1, 200.0);
        sheet.set_row_height(0, 30.0);
        sheet.set_row_height(5, 50.0);

        // Check dimensions
        assert_eq!(sheet.get_column_width(0), 150.0);
        assert_eq!(sheet.get_column_width(1), 200.0);
        assert_eq!(sheet.get_column_width(2), 100.0); // default

        assert_eq!(sheet.get_row_height(0), 30.0);
        assert_eq!(sheet.get_row_height(5), 50.0);
        assert_eq!(sheet.get_row_height(1), 20.0); // default
    }

    #[test]
    fn test_named_ranges() {
        let mut workbook = Workbook::with_sheet("Sheet1");

        // Add sheet-level named range
        let sheet = workbook.get_sheet_mut("Sheet1").unwrap();
        let range = vec![
            CellAddress::new(0, 0),
            CellAddress::new(0, 1),
            CellAddress::new(0, 2),
        ];
        sheet.add_named_range("HeaderRow", range.clone());

        // Add global named range
        workbook
            .add_global_named_range("GlobalData", "Sheet1", range.clone())
            .unwrap();

        // Verify ranges
        let sheet = workbook.get_sheet("Sheet1").unwrap();
        assert_eq!(sheet.get_named_range("HeaderRow"), Some(&range));

        let (sheet_name, global_range) = workbook.get_global_named_range("GlobalData").unwrap();
        assert_eq!(sheet_name, "Sheet1");
        assert_eq!(global_range, &range);
    }

    #[test]
    fn test_sheet_cloning() {
        let mut original = Sheet::new("Original");

        // Add some data
        original
            .set_cell(&CellAddress::new(0, 0), Cell::new(CellValue::Number(42.0)))
            .unwrap();
        original.set_column_width(0, 200.0);
        original.add_named_range("TestRange", vec![CellAddress::new(0, 0)]);

        // Clone the sheet
        let cloned = original.clone_with_name("Cloned");

        // Verify cloned data
        assert_eq!(cloned.name(), "Cloned");
        assert_eq!(
            cloned
                .get_cell(&CellAddress::new(0, 0))
                .unwrap()
                .get_computed_value(),
            CellValue::Number(42.0)
        );
        assert_eq!(cloned.get_column_width(0), 200.0);
        assert!(cloned.get_named_range("TestRange").is_some());
    }

    #[test]
    fn test_sheet_manager_statistics() {
        let mut manager = SheetManager::new();

        // Add sheets with data
        for i in 0..3 {
            let sheet_name = format!("Sheet{}", i + 2);
            manager.workbook_mut().create_sheet(&sheet_name).unwrap();

            if let Some(sheet) = manager.workbook_mut().get_sheet_mut(&sheet_name) {
                // Add some cells
                for j in 0..5 {
                    sheet
                        .set_cell(
                            &CellAddress::new(j, i),
                            Cell::new(CellValue::Number((i * 5 + j) as f64)),
                        )
                        .unwrap();
                }
            }
        }

        let stats = manager.get_statistics();
        assert_eq!(stats.sheet_count, 4); // Default + 3 created
        assert_eq!(stats.total_cells, 15); // 5 cells × 3 sheets
        assert_eq!(stats.formula_cells, 0);
        assert_eq!(stats.error_cells, 0);
    }
}
