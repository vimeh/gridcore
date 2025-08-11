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

/// Manager for calculating statistics on cell selections
pub struct SelectionStatsManager;

impl SelectionStatsManager {
    pub fn new() -> Self {
        Self
    }

    /// Calculate statistics for a single cell
    pub fn calculate_single_cell(
        &self,
        facade: &SpreadsheetFacade,
        cell: &CellAddress,
    ) -> SelectionStats {
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
        &self,
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
                } else {
                    // Cell doesn't exist, treat as empty
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

    /// Calculate statistics for multiple non-contiguous selections
    pub fn calculate_multiple_selections(
        &self,
        facade: &SpreadsheetFacade,
        selections: &[(CellAddress, CellAddress)],
    ) -> SelectionStats {
        let mut all_numbers = Vec::new();
        let mut total_count = 0;

        for (start, end) in selections {
            let range_stats = self.calculate_range(facade, start, end);
            total_count += range_stats.count;

            // Collect numbers from this range for overall statistics
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

        let mut stats = SelectionStats {
            count: total_count,
            ..Default::default()
        };

        // Calculate overall numeric statistics
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
}

impl Default for SelectionStatsManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_facade() -> SpreadsheetFacade {
        SpreadsheetFacade::new()
    }

    #[test]
    fn test_single_cell_with_number() {
        let facade = create_test_facade();
        let cell = CellAddress::new(0, 0);
        facade.set_cell_value(&cell, "42").unwrap();

        let manager = SelectionStatsManager::new();
        let stats = manager.calculate_single_cell(&facade, &cell);

        assert_eq!(stats.count, 1);
        assert_eq!(stats.sum, Some(42.0));
        assert_eq!(stats.average, Some(42.0));
        assert_eq!(stats.min, Some(42.0));
        assert_eq!(stats.max, Some(42.0));
    }

    #[test]
    fn test_single_cell_with_text() {
        let facade = create_test_facade();
        let cell = CellAddress::new(0, 0);
        facade.set_cell_value(&cell, "Hello").unwrap();

        let manager = SelectionStatsManager::new();
        let stats = manager.calculate_single_cell(&facade, &cell);

        assert_eq!(stats.count, 1);
        assert_eq!(stats.sum, None);
        assert_eq!(stats.average, None);
        assert_eq!(stats.min, None);
        assert_eq!(stats.max, None);
    }

    #[test]
    fn test_empty_cell() {
        let facade = create_test_facade();
        let cell = CellAddress::new(0, 0);

        let manager = SelectionStatsManager::new();
        let stats = manager.calculate_single_cell(&facade, &cell);

        assert_eq!(stats.count, 0);
        assert_eq!(stats.sum, None);
    }

    #[test]
    fn test_range_with_mixed_values() {
        let facade = create_test_facade();
        facade
            .set_cell_value(&CellAddress::new(0, 0), "10")
            .unwrap();
        facade
            .set_cell_value(&CellAddress::new(1, 0), "20")
            .unwrap();
        facade
            .set_cell_value(&CellAddress::new(0, 1), "Text")
            .unwrap();
        facade
            .set_cell_value(&CellAddress::new(1, 1), "30")
            .unwrap();

        let manager = SelectionStatsManager::new();
        let stats =
            manager.calculate_range(&facade, &CellAddress::new(0, 0), &CellAddress::new(1, 1));

        assert_eq!(stats.count, 4); // 3 numbers + 1 text
        assert_eq!(stats.sum, Some(60.0));
        assert_eq!(stats.average, Some(20.0)); // Average of numbers only
        assert_eq!(stats.min, Some(10.0));
        assert_eq!(stats.max, Some(30.0));
    }

    #[test]
    fn test_range_with_only_numbers() {
        let facade = create_test_facade();
        facade.set_cell_value(&CellAddress::new(0, 0), "5").unwrap();
        facade
            .set_cell_value(&CellAddress::new(1, 0), "10")
            .unwrap();
        facade
            .set_cell_value(&CellAddress::new(2, 0), "15")
            .unwrap();

        let manager = SelectionStatsManager::new();
        let stats =
            manager.calculate_range(&facade, &CellAddress::new(0, 0), &CellAddress::new(2, 0));

        assert_eq!(stats.count, 3);
        assert_eq!(stats.sum, Some(30.0));
        assert_eq!(stats.average, Some(10.0));
        assert_eq!(stats.min, Some(5.0));
        assert_eq!(stats.max, Some(15.0));
    }

    #[test]
    fn test_multiple_selections() {
        let facade = create_test_facade();
        // First range: A1:A2 with values 10, 20
        facade
            .set_cell_value(&CellAddress::new(0, 0), "10")
            .unwrap();
        facade
            .set_cell_value(&CellAddress::new(0, 1), "20")
            .unwrap();
        // Second range: C1:C2 with values 30, 40
        facade
            .set_cell_value(&CellAddress::new(2, 0), "30")
            .unwrap();
        facade
            .set_cell_value(&CellAddress::new(2, 1), "40")
            .unwrap();

        let manager = SelectionStatsManager::new();
        let selections = vec![
            (CellAddress::new(0, 0), CellAddress::new(0, 1)), // A1:A2
            (CellAddress::new(2, 0), CellAddress::new(2, 1)), // C1:C2
        ];
        let stats = manager.calculate_multiple_selections(&facade, &selections);

        assert_eq!(stats.count, 4);
        assert_eq!(stats.sum, Some(100.0));
        assert_eq!(stats.average, Some(25.0));
        assert_eq!(stats.min, Some(10.0));
        assert_eq!(stats.max, Some(40.0));
    }
}
