use crate::fill::{PatternDetector, PatternType};
use crate::types::CellValue;

pub struct ExponentialPatternDetector;

impl Default for ExponentialPatternDetector {
    fn default() -> Self {
        Self::new()
    }
}

impl ExponentialPatternDetector {
    pub fn new() -> Self {
        Self
    }

    fn extract_numbers(&self, values: &[CellValue]) -> Vec<f64> {
        values
            .iter()
            .filter_map(|v| match v {
                CellValue::Number(n) if *n != 0.0 => Some(*n),
                _ => None,
            })
            .collect()
    }

    fn detect_exponential_pattern(&self, numbers: &[f64]) -> Option<f64> {
        if numbers.len() < 2 {
            return None;
        }

        // Calculate ratios between consecutive numbers
        let mut ratios = Vec::new();
        for i in 1..numbers.len() {
            if numbers[i - 1] != 0.0 {
                ratios.push(numbers[i] / numbers[i - 1]);
            } else {
                return None; // Can't have exponential pattern with zero
            }
        }

        // Check if all ratios are approximately equal
        let first_ratio = ratios[0];
        let tolerance = 1e-10;

        let is_exponential = ratios
            .iter()
            .all(|&ratio| (ratio - first_ratio).abs() < tolerance);

        if is_exponential && (first_ratio - 1.0).abs() > tolerance {
            Some(first_ratio)
        } else {
            None
        }
    }
}

impl PatternDetector for ExponentialPatternDetector {
    fn detect(&self, values: &[CellValue]) -> Option<PatternType> {
        let numbers = self.extract_numbers(values);

        self.detect_exponential_pattern(&numbers).map(|rate| PatternType::Exponential { rate })
    }

    fn priority(&self) -> u32 {
        70 // Lower priority than linear
    }

    fn can_handle(&self, values: &[CellValue]) -> bool {
        // Need at least 2 numeric values and none can be zero (can't have exponential with zero)
        let numbers: Vec<f64> = values
            .iter()
            .filter_map(|v| match v {
                CellValue::Number(n) => Some(*n),
                _ => None,
            })
            .collect();

        numbers.len() >= 2 && !numbers.contains(&0.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_exponential_pattern_doubling() {
        let detector = ExponentialPatternDetector::new();
        let values = vec![
            CellValue::Number(1.0),
            CellValue::Number(2.0),
            CellValue::Number(4.0),
            CellValue::Number(8.0),
        ];

        let pattern = detector.detect(&values);
        assert!(
            matches!(pattern, Some(PatternType::Exponential { rate }) if (rate - 2.0).abs() < 1e-10)
        );
    }

    #[test]
    fn test_detect_exponential_pattern_halving() {
        let detector = ExponentialPatternDetector::new();
        let values = vec![
            CellValue::Number(16.0),
            CellValue::Number(8.0),
            CellValue::Number(4.0),
            CellValue::Number(2.0),
        ];

        let pattern = detector.detect(&values);
        assert!(
            matches!(pattern, Some(PatternType::Exponential { rate }) if (rate - 0.5).abs() < 1e-10)
        );
    }

    #[test]
    fn test_detect_exponential_pattern_tripling() {
        let detector = ExponentialPatternDetector::new();
        let values = vec![
            CellValue::Number(1.0),
            CellValue::Number(3.0),
            CellValue::Number(9.0),
            CellValue::Number(27.0),
        ];

        let pattern = detector.detect(&values);
        assert!(
            matches!(pattern, Some(PatternType::Exponential { rate }) if (rate - 3.0).abs() < 1e-10)
        );
    }

    #[test]
    fn test_no_pattern_linear() {
        let detector = ExponentialPatternDetector::new();
        let values = vec![
            CellValue::Number(1.0),
            CellValue::Number(2.0),
            CellValue::Number(3.0),
            CellValue::Number(4.0),
        ];

        let pattern = detector.detect(&values);
        assert!(pattern.is_none());
    }

    #[test]
    fn test_no_pattern_with_zero() {
        let detector = ExponentialPatternDetector::new();
        let values = vec![
            CellValue::Number(0.0),
            CellValue::Number(2.0),
            CellValue::Number(4.0),
        ];

        assert!(!detector.can_handle(&values));
    }

    #[test]
    fn test_can_handle_with_mixed_values() {
        let detector = ExponentialPatternDetector::new();
        let values = vec![
            CellValue::Number(2.0),
            CellValue::String("text".to_string()),
            CellValue::Number(4.0),
            CellValue::Number(8.0),
        ];

        assert!(detector.can_handle(&values));
    }
}
