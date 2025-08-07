#[cfg(test)]
mod references_integration_tests {
    use crate::references::{
        parser::ReferenceParser, 
        detector::ReferenceDetector,
        adjuster::ReferenceAdjuster,
        tracker::ReferenceTracker,
        Reference, ReferenceType, StructuralOperation,
    };
    use crate::types::CellAddress;

    #[test]
    fn test_parse_complex_formula() {
        let parser = ReferenceParser::new();
        let formula = "=SUM(A1:B10)+Sheet1!C5+$D$10*E2";
        let refs = parser.parse_formula(formula);
        
        assert!(refs.len() >= 3);
        
        // Check for range reference
        let has_range = refs.iter().any(|r| matches!(r.ref_type, ReferenceType::Range(_, _)));
        assert!(has_range);
        
        // Check for sheet reference
        let has_sheet = refs.iter().any(|r| matches!(r.ref_type, ReferenceType::Sheet(_, _)));
        assert!(has_sheet);
    }

    #[test]
    fn test_detect_affected_by_insert() {
        let detector = ReferenceDetector::new();
        
        // Absolute reference should be affected if row >= insert point
        let abs_ref = Reference::new(
            ReferenceType::Absolute(0, 5),
            "$A$6".to_string(),
        );
        assert!(detector.is_affected_by_insert_rows(&abs_ref, 3));
        assert!(!detector.is_affected_by_insert_rows(&abs_ref, 7));
        
        // Relative references are always affected
        let rel_ref = Reference::new(
            ReferenceType::Relative(0, 5),
            "A6".to_string(),
        );
        assert!(detector.is_affected_by_insert_rows(&rel_ref, 3));
        assert!(detector.is_affected_by_insert_rows(&rel_ref, 10));
    }

    #[test]
    fn test_adjust_formula_with_insert() {
        let adjuster = ReferenceAdjuster::new();
        // The operation uses 0-based row indices
        // To insert before row 5 (1-based), we use row 4 (0-based)
        let operation = StructuralOperation::InsertRows {
            before_row: 4,  // Insert before row 5 in 1-based terms
            count: 2,
        };
        
        let formula = "=$A$5+$B$10+C3";
        let adjusted = adjuster.adjust_formula(formula, &operation).unwrap();
        
        // $A$5 (row 4 in 0-based) should become $A$7 (affected by insert at row 4)
        // $B$10 (row 9 in 0-based) should become $B$12 (affected by insert)
        // C3 (row 2 in 0-based) shouldn't change (before insert point)
        assert!(adjusted.contains("$A$7"));
        assert!(adjusted.contains("$B$12"));
    }

    #[test]
    fn test_tracker_dependency_management() {
        use crate::formula::{Expr, BinaryOperator};
        
        let mut tracker = ReferenceTracker::new();
        
        // Add dependency: A1 depends on B1 and C1
        let a1 = CellAddress::new(0, 0);
        let expr = Expr::BinaryOp {
            op: BinaryOperator::Add,
            left: Box::new(Expr::Reference { 
                address: CellAddress::new(1, 0),
                absolute_col: false,
                absolute_row: false,
            }),
            right: Box::new(Expr::Reference { 
                address: CellAddress::new(2, 0),
                absolute_col: false,
                absolute_row: false,
            }),
        };
        
        tracker.update_dependencies(&a1, &expr);
        
        // Check forward dependencies
        let deps = tracker.get_dependencies(&a1);
        assert_eq!(deps.len(), 2);
        assert!(deps.contains(&CellAddress::new(1, 0)));
        assert!(deps.contains(&CellAddress::new(2, 0)));
        
        // Check reverse dependencies
        let dependents = tracker.get_dependents(&CellAddress::new(1, 0));
        assert_eq!(dependents.len(), 1);
        assert!(dependents.contains(&a1));
    }

    #[test]
    fn test_circular_reference_detection() {
        let detector = ReferenceDetector::new();
        
        // Self-reference
        let self_ref = Reference::new(
            ReferenceType::Relative(0, 0),
            "A1".to_string(),
        );
        assert!(detector.is_circular(&CellAddress::new(0, 0), &self_ref));
        
        // Non-circular reference
        let other_ref = Reference::new(
            ReferenceType::Relative(1, 0),
            "B1".to_string(),
        );
        assert!(!detector.is_circular(&CellAddress::new(0, 0), &other_ref));
    }

    #[test]
    fn test_range_reference_parsing() {
        let parser = ReferenceParser::new();
        let formula = "=SUM(A1:B10)+AVERAGE($C$1:$D$5)";
        let refs = parser.parse_formula(formula);
        
        let range_refs: Vec<_> = refs.iter()
            .filter(|r| matches!(r.ref_type, ReferenceType::Range(_, _)))
            .collect();
        
        assert_eq!(range_refs.len(), 2);
    }

    #[test]
    fn test_sheet_reference_adjustment() {
        let adjuster = ReferenceAdjuster::new();
        let operation = StructuralOperation::InsertColumns {
            before_col: 2,
            count: 1,
        };
        
        let formula = "=Sheet1!$C$1+Sheet2!D5";
        let adjusted = adjuster.adjust_formula(formula, &operation).unwrap();
        
        // Sheet1!$C$1 should become Sheet1!$D$1
        assert!(adjusted.contains("$D$1"));
    }

    #[test]
    fn test_delete_reference_becomes_error() {
        let adjuster = ReferenceAdjuster::new();
        let operation = StructuralOperation::DeleteRows {
            start_row: 5,
            count: 3,
        };
        
        let formula = "=$A$6+$B$10";
        let adjusted = adjuster.adjust_formula(formula, &operation).unwrap();
        
        // $A$6 should become #REF! (deleted)
        assert!(adjusted.contains("#REF!"));
        // $B$10 should become $B$7 (shifted up by 3)
        assert!(adjusted.contains("$B$7"));
    }

    #[test]
    fn test_column_letter_conversion() {
        let parser = ReferenceParser::new();
        
        assert_eq!(parser.number_to_column(0), "A");
        assert_eq!(parser.number_to_column(25), "Z");
        assert_eq!(parser.number_to_column(26), "AA");
        assert_eq!(parser.number_to_column(51), "AZ");
        assert_eq!(parser.number_to_column(52), "BA");
        assert_eq!(parser.number_to_column(701), "ZZ");
        assert_eq!(parser.number_to_column(702), "AAA");
    }

    #[test]
    fn test_affected_cells_cascade() {
        let mut tracker = ReferenceTracker::new();
        
        // Create dependency chain: A1 -> B1 -> C1 -> D1
        let a1 = CellAddress::new(0, 0);
        let b1 = CellAddress::new(1, 0);
        let c1 = CellAddress::new(2, 0);
        let d1 = CellAddress::new(3, 0);
        
        // B1 depends on A1
        tracker.forward_dependencies.insert(b1.clone(), vec![a1.clone()].into_iter().collect());
        tracker.reverse_dependencies.insert(a1.clone(), vec![b1.clone()].into_iter().collect());
        
        // C1 depends on B1
        tracker.forward_dependencies.insert(c1.clone(), vec![b1.clone()].into_iter().collect());
        tracker.reverse_dependencies.insert(b1.clone(), vec![c1.clone()].into_iter().collect());
        
        // D1 depends on C1
        tracker.forward_dependencies.insert(d1.clone(), vec![c1.clone()].into_iter().collect());
        tracker.reverse_dependencies.insert(c1.clone(), vec![d1.clone()].into_iter().collect());
        
        // Changing A1 should affect B1, C1, and D1
        let changed = vec![a1.clone()].into_iter().collect();
        let affected = tracker.get_affected_cells(&changed);
        
        assert_eq!(affected.len(), 4);
        
        // Check topological order (A1 should come before B1, B1 before C1, etc.)
        let a1_pos = affected.iter().position(|c| *c == a1).unwrap();
        let b1_pos = affected.iter().position(|c| *c == b1).unwrap();
        let c1_pos = affected.iter().position(|c| *c == c1).unwrap();
        let d1_pos = affected.iter().position(|c| *c == d1).unwrap();
        
        assert!(a1_pos < b1_pos);
        assert!(b1_pos < c1_pos);
        assert!(c1_pos < d1_pos);
    }
}