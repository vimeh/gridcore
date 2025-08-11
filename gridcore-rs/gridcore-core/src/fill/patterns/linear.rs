use crate::fill::{PatternDetector, PatternType};
use crate::types::CellValue;

pub struct LinearPatternDetector;

impl Default for LinearPatternDetector {
    fn default() -> Self {
        Self::new()
    }
}

impl LinearPatternDetector {
    pub fn new() -> Self {
        Self
    }

    fn extract_numbers(&self, values: &[CellValue]) -> Vec<f64> {
        values
            .iter()
            .filter_map(|v| match v {
                CellValue::Number(n) => Some(*n),
                _ => None,
            })
            .collect()
    }

    fn detect_linear_pattern(&self, numbers: &[f64]) -> Option<f64> {
        if numbers.len() < 2 {
            return None;
        }

        // Calculate differences between consecutive numbers
        let mut differences = Vec::new();
        for i in 1..numbers.len() {
            differences.push(numbers[i] - numbers[i - 1]);
        }

        // Check if all differences are approximately equal
        let first_diff = differences[0];
        let tolerance = 1e-10;

        let is_linear = differences
            .iter()
            .all(|&diff| (diff - first_diff).abs() < tolerance);

        if is_linear { Some(first_diff) } else { None }
    }
}

impl PatternDetector for LinearPatternDetector {
    fn detect(&self, values: &[CellValue]) -> Option<PatternType> {
        let numbers = self.extract_numbers(values);

        self.detect_linear_pattern(&numbers)
            .map(|slope| PatternType::Linear { slope })
    }

    fn priority(&self) -> u32 {
        80 // High priority for linear patterns
    }

    fn can_handle(&self, values: &[CellValue]) -> bool {
        // Need at least 2 numeric values
        let numeric_count = values
            .iter()
            .filter(|v| matches!(v, CellValue::Number(_)))
            .count();

        numeric_count >= 2
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_linear_pattern_ascending() {
        let detector = LinearPatternDetector::new();
        let values = vec![
            CellValue::Number(1.0),
            CellValue::Number(2.0),
            CellValue::Number(3.0),
        ];

        let pattern = detector.detect(&values);
        assert!(
            matches!(pattern, Some(PatternType::Linear { slope }) if (slope - 1.0).abs() < 1e-10)
        );
    }

    #[test]
    fn test_detect_linear_pattern_descending() {
        let detector = LinearPatternDetector::new();
        let values = vec![
            CellValue::Number(10.0),
            CellValue::Number(8.0),
            CellValue::Number(6.0),
        ];

        let pattern = detector.detect(&values);
        assert!(
            matches!(pattern, Some(PatternType::Linear { slope }) if (slope + 2.0).abs() < 1e-10)
        );
    }

    #[test]
    fn test_detect_linear_pattern_with_step() {
        let detector = LinearPatternDetector::new();
        let values = vec![
            CellValue::Number(5.0),
            CellValue::Number(10.0),
            CellValue::Number(15.0),
            CellValue::Number(20.0),
        ];

        let pattern = detector.detect(&values);
        assert!(
            matches!(pattern, Some(PatternType::Linear { slope }) if (slope - 5.0).abs() < 1e-10)
        );
    }

    #[test]
    fn test_no_pattern_non_linear() {
        let detector = LinearPatternDetector::new();
        let values = vec![
            CellValue::Number(1.0),
            CellValue::Number(2.0),
            CellValue::Number(4.0),
            CellValue::Number(8.0),
        ];

        let pattern = detector.detect(&values);
        assert!(pattern.is_none());
    }

    #[test]
    fn test_no_pattern_insufficient_values() {
        let detector = LinearPatternDetector::new();
        let values = vec![CellValue::Number(1.0)];

        let pattern = detector.detect(&values);
        assert!(pattern.is_none());
    }

    #[test]
    fn test_can_handle_with_mixed_values() {
        let detector = LinearPatternDetector::new();
        let values = vec![
            CellValue::Number(1.0),
            CellValue::from_string("text".to_string()),
            CellValue::Number(3.0),
        ];

        assert!(detector.can_handle(&values));
    }

    #[test]
    fn test_cannot_handle_non_numeric() {
        let detector = LinearPatternDetector::new();
        let values = vec![
            CellValue::from_string("a".to_string()),
            CellValue::from_string("b".to_string()),
        ];

        assert!(!detector.can_handle(&values));
    }
}
