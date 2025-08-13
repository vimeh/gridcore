use gridcore_core::types::{CellAddress, CellValue};
use gridcore_core::SpreadsheetFacade;
use serde::{Deserialize, Serialize};

/// Statistics for a selection of cells
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct SelectionStats {
    pub count: usize,
    pub sum: Option<f64>,
    pub average: Option<f64>,
    pub min: Option<f64>,
    pub max: Option<f64>,
}

/// Calculate statistics for a single cell
pub fn calculate_single_cell(facade: &SpreadsheetFacade, cell: &CellAddress) -> SelectionStats {
    let mut stats = SelectionStats::default();

    if let Some(cell_obj) = facade.get_cell(cell) {
        let value = cell_obj.get_display_value();
        if let CellValue::Number(n) = value {
            stats.count = 1;
            stats.sum = Some(*n);
            stats.average = Some(*n);
            stats.min = Some(*n);
            stats.max = Some(*n);
        } else if !matches!(value, CellValue::Empty) {
            stats.count = 1;
        }
    }

    stats
}

/// Calculate statistics for a range of cells
pub fn calculate_range(
    facade: &SpreadsheetFacade,
    start: &CellAddress,
    end: &CellAddress,
) -> SelectionStats {
    let mut stats = SelectionStats::default();
    let mut numbers = Vec::new();
    let mut count = 0;

    // Calculate the bounds of the range
    let min_col = start.col.min(end.col);
    let max_col = start.col.max(end.col);
    let min_row = start.row.min(end.row);
    let max_row = start.row.max(end.row);

    // Iterate through the range
    for row in min_row..=max_row {
        for col in min_col..=max_col {
            let cell_addr = CellAddress::new(col, row);
            if let Some(cell) = facade.get_cell(&cell_addr) {
                let value = cell.get_display_value();
                match value {
                    CellValue::Number(n) => {
                        numbers.push(*n);
                        count += 1;
                    }
                    CellValue::Empty => {
                        // Don't count empty cells
                    }
                    _ => {
                        // Count non-empty, non-numeric cells
                        count += 1;
                    }
                }
            }
        }
    }

    stats.count = count;

    // Calculate numeric statistics if we have numbers
    if !numbers.is_empty() {
        let sum: f64 = numbers.iter().sum();
        let avg = sum / numbers.len() as f64;
        let min = numbers.iter().fold(f64::INFINITY, |a, &b| a.min(b));
        let max = numbers.iter().fold(f64::NEG_INFINITY, |a, &b| a.max(b));

        stats.sum = Some(sum);
        stats.average = Some(avg);
        stats.min = Some(min);
        stats.max = Some(max);
    }

    stats
}

/// Calculate statistics for multiple ranges
pub fn calculate_multi_range(
    facade: &SpreadsheetFacade,
    ranges: &[(CellAddress, CellAddress)],
) -> SelectionStats {
    let mut all_numbers = Vec::new();
    let mut total_count = 0;

    for (start, end) in ranges {
        let range_stats = calculate_range(facade, start, end);
        total_count += range_stats.count;

        // Collect numbers for overall statistics
        if range_stats.sum.is_some() {
            // Re-calculate to get individual numbers (not ideal but works)
            let min_col = start.col.min(end.col);
            let max_col = start.col.max(end.col);
            let min_row = start.row.min(end.row);
            let max_row = start.row.max(end.row);

            for row in min_row..=max_row {
                for col in min_col..=max_col {
                    let cell_addr = CellAddress::new(col, row);
                    if let Some(cell) = facade.get_cell(&cell_addr) {
                        if let CellValue::Number(n) = cell.get_display_value() {
                            all_numbers.push(*n);
                        }
                    }
                }
            }
        }
    }

    let mut stats = SelectionStats {
        count: total_count,
        ..Default::default()
    };

    if !all_numbers.is_empty() {
        let sum: f64 = all_numbers.iter().sum();
        let avg = sum / all_numbers.len() as f64;
        let min = all_numbers.iter().fold(f64::INFINITY, |a, &b| a.min(b));
        let max = all_numbers.iter().fold(f64::NEG_INFINITY, |a, &b| a.max(b));

        stats.sum = Some(sum);
        stats.average = Some(avg);
        stats.min = Some(min);
        stats.max = Some(max);
    }

    stats
}

#[cfg(test)]
mod tests {
    use super::*;
    use gridcore_core::SpreadsheetFacade;

    #[test]
    fn test_single_cell_stats() {
        let facade = SpreadsheetFacade::new();
        let _ = facade.set_cell_value(&CellAddress::new(0, 0), "42");

        let stats = calculate_single_cell(&facade, &CellAddress::new(0, 0));
        assert_eq!(stats.count, 1);
        assert_eq!(stats.sum, Some(42.0));
        assert_eq!(stats.average, Some(42.0));
        assert_eq!(stats.min, Some(42.0));
        assert_eq!(stats.max, Some(42.0));
    }

    #[test]
    fn test_range_stats() {
        let facade = SpreadsheetFacade::new();
        let _ = facade.set_cell_value(&CellAddress::new(0, 0), "10");
        let _ = facade.set_cell_value(&CellAddress::new(0, 1), "20");
        let _ = facade.set_cell_value(&CellAddress::new(0, 2), "30");
        let _ = facade.set_cell_value(&CellAddress::new(1, 0), "Hello"); // Non-numeric

        let stats = calculate_range(&facade, &CellAddress::new(0, 0), &CellAddress::new(1, 2));

        assert_eq!(stats.count, 4); // 3 numbers + 1 text
        assert_eq!(stats.sum, Some(60.0));
        assert_eq!(stats.average, Some(20.0));
        assert_eq!(stats.min, Some(10.0));
        assert_eq!(stats.max, Some(30.0));
    }

    #[test]
    fn test_empty_range() {
        let facade = SpreadsheetFacade::new();

        let stats = calculate_range(&facade, &CellAddress::new(0, 0), &CellAddress::new(2, 2));

        assert_eq!(stats.count, 0);
        assert_eq!(stats.sum, None);
        assert_eq!(stats.average, None);
    }
}
