#[cfg(test)]
mod fill_integration_tests {
    use crate::fill::{
        CellRange, FillDirection, FillEngine, FillOperation, FormulaAdjuster, PatternType,
        adjuster::DefaultFormulaAdjuster,
    };
    use crate::repository::CellRepository;
    use crate::types::{CellAddress, CellValue};
    use std::rc::Rc;

    fn setup_repo_with_values(values: Vec<(CellAddress, CellValue)>) -> Rc<CellRepository> {
        let repo = CellRepository::new();
        let repo_rc = Rc::new(repo);

        // We can't modify through Rc, so we need to use unsafe or change the design
        // For now, we'll create a test-friendly version
        repo_rc
    }

    #[test]
    fn test_linear_pattern_fill_down() {
        use crate::domain::Cell;

        // Test filling down with linear pattern: 1, 2, 3 -> 4, 5, 6
        let mut repo = CellRepository::new();

        // Add source values: 1, 2, 3
        repo.set(&CellAddress::new(0, 0), Cell::new(CellValue::Number(1.0)));
        repo.set(&CellAddress::new(0, 1), Cell::new(CellValue::Number(2.0)));
        repo.set(&CellAddress::new(0, 2), Cell::new(CellValue::Number(3.0)));

        let repo = Rc::new(repo);
        let engine = FillEngine::new(repo.clone());

        let source_range = CellRange::new(CellAddress::new(0, 0), CellAddress::new(0, 2));
        let target_range = CellRange::new(CellAddress::new(0, 3), CellAddress::new(0, 5));

        let operation = FillOperation {
            source_range,
            target_range,
            direction: FillDirection::Down,
            pattern: Some(PatternType::Linear(1.0)),
        };

        let result = engine.fill(&operation).unwrap();
        assert_eq!(result.affected_cells.len(), 3);

        // Check the generated values
        assert_eq!(result.affected_cells[0].1, CellValue::Number(4.0));
        assert_eq!(result.affected_cells[1].1, CellValue::Number(5.0));
        assert_eq!(result.affected_cells[2].1, CellValue::Number(6.0));
    }

    #[test]
    fn test_exponential_pattern_fill_right() {
        use crate::domain::Cell;

        // Test filling right with exponential pattern: 2, 4, 8 -> 16, 32, 64
        let mut repo = CellRepository::new();

        // Add source values: 2, 4, 8 (in a horizontal row)
        repo.set(&CellAddress::new(0, 0), Cell::new(CellValue::Number(2.0)));
        repo.set(&CellAddress::new(1, 0), Cell::new(CellValue::Number(4.0)));
        repo.set(&CellAddress::new(2, 0), Cell::new(CellValue::Number(8.0)));

        let repo = Rc::new(repo);
        let engine = FillEngine::new(repo.clone());

        let source_range = CellRange::new(CellAddress::new(0, 0), CellAddress::new(2, 0));
        let target_range = CellRange::new(CellAddress::new(3, 0), CellAddress::new(5, 0));

        let operation = FillOperation {
            source_range,
            target_range,
            direction: FillDirection::Right,
            pattern: Some(PatternType::Exponential(2.0)),
        };

        let result = engine.fill(&operation).unwrap();
        assert_eq!(result.affected_cells.len(), 3);

        // Check the generated values
        assert_eq!(result.affected_cells[0].1, CellValue::Number(16.0));
        assert_eq!(result.affected_cells[1].1, CellValue::Number(32.0));
        assert_eq!(result.affected_cells[2].1, CellValue::Number(64.0));
    }

    #[test]
    fn test_copy_pattern_fill() {
        // Test copy pattern: A, B, C -> A, B, C, A, B, C
        let repo = Rc::new(CellRepository::new());
        let engine = FillEngine::new(repo.clone());

        let source_range = CellRange::new(CellAddress::new(0, 0), CellAddress::new(0, 2));
        let target_range = CellRange::new(CellAddress::new(0, 3), CellAddress::new(0, 8));

        let operation = FillOperation {
            source_range,
            target_range,
            direction: FillDirection::Down,
            pattern: Some(PatternType::Copy),
        };

        let result = engine.preview(&operation).unwrap();
        assert_eq!(result.len(), 6);
    }

    #[test]
    fn test_formula_adjustment_relative_refs() {
        let adjuster = DefaultFormulaAdjuster::new();

        // Test relative reference adjustment
        let formula = "=A1+B1";
        let from = CellAddress::new(0, 0);
        let to = CellAddress::new(0, 1);

        let adjusted = adjuster
            .adjust_formula(formula, &from, &to, FillDirection::Down)
            .unwrap();
        assert_eq!(adjusted, "=A2+B2");
    }

    #[test]
    fn test_formula_adjustment_absolute_refs() {
        let adjuster = DefaultFormulaAdjuster::new();

        // Test absolute reference preservation
        let formula = "=$A$1+B1";
        let from = CellAddress::new(0, 0);
        let to = CellAddress::new(1, 1);

        let adjusted = adjuster
            .adjust_formula(formula, &from, &to, FillDirection::Down)
            .unwrap();
        assert_eq!(adjusted, "=$A$1+C2");
    }

    #[test]
    fn test_formula_adjustment_mixed_refs() {
        let adjuster = DefaultFormulaAdjuster::new();

        // Test mixed references
        let formula = "=$A1+A$1";
        let from = CellAddress::new(0, 0);
        let to = CellAddress::new(1, 1);

        let adjusted = adjuster
            .adjust_formula(formula, &from, &to, FillDirection::Right)
            .unwrap();
        assert_eq!(adjusted, "=$A2+B$1");
    }

    #[test]
    fn test_formula_adjustment_in_functions() {
        let adjuster = DefaultFormulaAdjuster::new();

        // Test references within functions
        let formula = "=SUM(A1:A10)+AVERAGE(B1:B10)";
        let from = CellAddress::new(0, 0);
        let to = CellAddress::new(0, 1);

        let adjusted = adjuster
            .adjust_formula(formula, &from, &to, FillDirection::Down)
            .unwrap();
        assert_eq!(adjusted, "=SUM(A2:A11)+AVERAGE(B2:B11)");
    }

    #[test]
    fn test_pattern_detection_with_empty_cells() {
        let repo = Rc::new(CellRepository::new());
        let engine = FillEngine::new(repo.clone());

        let source_range = CellRange::new(CellAddress::new(0, 0), CellAddress::new(0, 2));
        let target_range = CellRange::new(CellAddress::new(0, 3), CellAddress::new(0, 5));

        let operation = FillOperation {
            source_range,
            target_range,
            direction: FillDirection::Down,
            pattern: None, // Let engine detect pattern
        };

        // With empty cells, should default to copy pattern
        let result = engine.fill(&operation);
        assert!(result.is_ok());
    }

    #[test]
    fn test_fill_with_large_range() {
        use crate::domain::Cell;

        let mut repo = CellRepository::new();

        // Add source values: 1, 2
        repo.set(&CellAddress::new(0, 0), Cell::new(CellValue::Number(1.0)));
        repo.set(&CellAddress::new(0, 1), Cell::new(CellValue::Number(2.0)));

        let repo = Rc::new(repo);
        let engine = FillEngine::new(repo.clone());

        // Test with a large range (100 cells)
        let source_range = CellRange::new(CellAddress::new(0, 0), CellAddress::new(0, 1));
        let target_range = CellRange::new(CellAddress::new(0, 2), CellAddress::new(0, 101));

        let operation = FillOperation {
            source_range,
            target_range,
            direction: FillDirection::Down,
            pattern: Some(PatternType::Linear(1.0)),
        };

        let result = engine.fill(&operation).unwrap();
        assert_eq!(result.affected_cells.len(), 100);

        // Check some values
        assert_eq!(result.affected_cells[0].1, CellValue::Number(3.0)); // First target cell
        assert_eq!(result.affected_cells[99].1, CellValue::Number(102.0)); // Last target cell
    }

    #[test]
    fn test_cell_range_iteration() {
        let range = CellRange::new(CellAddress::new(0, 0), CellAddress::new(2, 2));
        let cells: Vec<_> = range.iter_cells().collect();

        assert_eq!(cells.len(), 9);
        assert_eq!(cells[0], CellAddress::new(0, 0));
        assert_eq!(cells[4], CellAddress::new(1, 1));
        assert_eq!(cells[8], CellAddress::new(2, 2));
    }

    #[test]
    fn test_cell_range_contains() {
        let range = CellRange::new(CellAddress::new(1, 1), CellAddress::new(3, 3));

        assert!(range.contains(&CellAddress::new(2, 2)));
        assert!(range.contains(&CellAddress::new(1, 1)));
        assert!(range.contains(&CellAddress::new(3, 3)));
        assert!(!range.contains(&CellAddress::new(0, 0)));
        assert!(!range.contains(&CellAddress::new(4, 4)));
    }
}
