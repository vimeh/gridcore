use crate::fill::{PatternDetector, PatternType};
use crate::types::CellValue;
use chrono::{Duration as ChronoDuration, NaiveDate};
use std::time::Duration;

pub struct DatePatternDetector;

impl DatePatternDetector {
    pub fn new() -> Self {
        Self
    }

    fn parse_date(&self, value: &CellValue) -> Option<NaiveDate> {
        match value {
            CellValue::String(s) => {
                // Try common date formats
                NaiveDate::parse_from_str(s, "%Y-%m-%d")
                    .ok()
                    .or_else(|| NaiveDate::parse_from_str(s, "%m/%d/%Y").ok())
                    .or_else(|| NaiveDate::parse_from_str(s, "%d/%m/%Y").ok())
                    .or_else(|| NaiveDate::parse_from_str(s, "%Y/%m/%d").ok())
            }
            CellValue::Number(days) => {
                // Excel date serial number (days since 1900-01-01, but with quirks)
                // For simplicity, we'll use a base date
                let base_date = NaiveDate::from_ymd_opt(1900, 1, 1)?;
                base_date.checked_add_signed(ChronoDuration::days(*days as i64))
            }
            _ => None,
        }
    }

    fn detect_date_pattern(&self, dates: &[NaiveDate]) -> Option<Duration> {
        if dates.len() < 2 {
            return None;
        }

        // Calculate differences between consecutive dates
        let mut intervals = Vec::new();
        for i in 1..dates.len() {
            let diff = dates[i].signed_duration_since(dates[i - 1]);
            intervals.push(diff.num_days());
        }

        // Check if all intervals are equal
        let first_interval = intervals[0];
        let is_regular = intervals.iter().all(|&interval| interval == first_interval);

        if is_regular && first_interval != 0 {
            Some(Duration::from_secs((first_interval * 24 * 3600) as u64))
        } else {
            None
        }
    }
}

impl PatternDetector for DatePatternDetector {
    fn detect(&self, values: &[CellValue]) -> Option<PatternType> {
        let dates: Vec<_> = values.iter().filter_map(|v| self.parse_date(v)).collect();

        if let Some(duration) = self.detect_date_pattern(&dates) {
            Some(PatternType::Date {
                increment_days: duration.as_secs() as f64 / 86400.0,
            })
        } else {
            None
        }
    }

    fn priority(&self) -> u32 {
        60 // Medium priority
    }

    fn can_handle(&self, values: &[CellValue]) -> bool {
        // Need at least 2 parseable dates
        let date_count = values
            .iter()
            .filter(|v| self.parse_date(v).is_some())
            .count();

        date_count >= 2
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_daily_pattern() {
        let detector = DatePatternDetector::new();
        let values = vec![
            CellValue::String("2024-01-01".to_string()),
            CellValue::String("2024-01-02".to_string()),
            CellValue::String("2024-01-03".to_string()),
        ];

        let pattern = detector.detect(&values);
        assert!(matches!(pattern, Some(PatternType::Date(d)) if d.as_secs() == 86400));
    }

    #[test]
    fn test_detect_weekly_pattern() {
        let detector = DatePatternDetector::new();
        let values = vec![
            CellValue::String("2024-01-01".to_string()),
            CellValue::String("2024-01-08".to_string()),
            CellValue::String("2024-01-15".to_string()),
        ];

        let pattern = detector.detect(&values);
        assert!(matches!(pattern, Some(PatternType::Date(d)) if d.as_secs() == 7 * 86400));
    }

    #[test]
    fn test_detect_pattern_with_different_formats() {
        let detector = DatePatternDetector::new();
        let values = vec![
            CellValue::String("01/01/2024".to_string()),
            CellValue::String("01/02/2024".to_string()),
            CellValue::String("01/03/2024".to_string()),
        ];

        let pattern = detector.detect(&values);
        assert!(matches!(pattern, Some(PatternType::Date(_))));
    }

    #[test]
    fn test_no_pattern_irregular_dates() {
        let detector = DatePatternDetector::new();
        let values = vec![
            CellValue::String("2024-01-01".to_string()),
            CellValue::String("2024-01-03".to_string()),
            CellValue::String("2024-01-07".to_string()),
        ];

        let pattern = detector.detect(&values);
        assert!(pattern.is_none());
    }

    #[test]
    fn test_can_handle_mixed_values() {
        let detector = DatePatternDetector::new();
        let values = vec![
            CellValue::String("2024-01-01".to_string()),
            CellValue::Number(42.0),
            CellValue::String("2024-01-02".to_string()),
        ];

        assert!(detector.can_handle(&values));
    }

    #[test]
    fn test_cannot_handle_non_dates() {
        let detector = DatePatternDetector::new();
        let values = vec![
            CellValue::String("not a date".to_string()),
            CellValue::Number(42.0),
        ];

        assert!(!detector.can_handle(&values));
    }
}
