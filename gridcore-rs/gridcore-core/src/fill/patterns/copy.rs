use crate::fill::{PatternDetector, PatternType};
use crate::types::CellValue;

/// Copy pattern detector - fallback pattern that simply copies values
pub struct CopyPatternDetector;

impl CopyPatternDetector {
    pub fn new() -> Self {
        Self
    }
}

impl PatternDetector for CopyPatternDetector {
    fn detect(&self, values: &[CellValue]) -> Option<PatternType> {
        // Always returns copy pattern as it's the fallback
        if !values.is_empty() {
            Some(PatternType::Copy)
        } else {
            None
        }
    }

    fn priority(&self) -> u32 {
        10 // Lowest priority - fallback pattern
    }

    fn can_handle(&self, values: &[CellValue]) -> bool {
        // Can handle any non-empty values
        !values.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_copy_pattern_always_detected() {
        let detector = CopyPatternDetector::new();
        let values = vec![
            CellValue::String("random".to_string()),
            CellValue::Number(42.0),
            CellValue::Boolean(true),
        ];

        let pattern = detector.detect(&values);
        assert!(matches!(pattern, Some(PatternType::Copy)));
    }

    #[test]
    fn test_copy_pattern_single_value() {
        let detector = CopyPatternDetector::new();
        let values = vec![CellValue::Number(1.0)];

        let pattern = detector.detect(&values);
        assert!(matches!(pattern, Some(PatternType::Copy)));
    }

    #[test]
    fn test_no_pattern_empty_values() {
        let detector = CopyPatternDetector::new();
        let values = vec![];

        let pattern = detector.detect(&values);
        assert!(pattern.is_none());
    }

    #[test]
    fn test_can_handle_any_values() {
        let detector = CopyPatternDetector::new();
        
        assert!(detector.can_handle(&vec![CellValue::Empty]));
        assert!(detector.can_handle(&vec![CellValue::Number(1.0)]));
        assert!(detector.can_handle(&vec![CellValue::String("text".to_string())]));
        assert!(!detector.can_handle(&vec![]));
    }
}