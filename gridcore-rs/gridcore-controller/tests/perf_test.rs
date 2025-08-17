#[cfg(feature = "perf")]
#[test]
fn test_metrics_collection() {
    use gridcore_controller::SpreadsheetController;
    use gridcore_core::types::CellAddress;

    // Metrics work without explicit initialization in tests
    // The default recorder will be used

    let mut controller = SpreadsheetController::new();

    // Move cursor a few times
    for i in 0..5 {
        controller.set_cursor(CellAddress::new(i, i));
    }

    // Verify the controller works with metrics enabled
    assert_eq!(controller.cursor(), CellAddress::new(4, 4));
}

#[cfg(not(feature = "perf"))]
#[test]
fn test_no_metrics_overhead() {
    use gridcore_controller::SpreadsheetController;
    use gridcore_core::types::CellAddress;

    let mut controller = SpreadsheetController::new();

    // Same operations should work without perf feature
    for i in 0..5 {
        controller.set_cursor(CellAddress::new(i, i));
    }

    assert_eq!(controller.cursor(), CellAddress::new(4, 4));
}
