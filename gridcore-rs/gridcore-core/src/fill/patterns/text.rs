use crate::fill::{PatternDetector, PatternType};
use crate::types::CellValue;
use regex::Regex;

pub struct TextPatternDetector;

impl TextPatternDetector {
    pub fn new() -> Self {
        Self
    }

    fn extract_text_with_number(&self, text: &str) -> Option<(String, i32, String)> {
        // Match patterns like "Item 1", "Product-001", "A1", etc.
        let re = Regex::new(r"^(.*?)(\d+)(.*)$").ok()?;
        
        if let Some(captures) = re.captures(text) {
            let prefix = captures.get(1)?.as_str().to_string();
            let number = captures.get(2)?.as_str().parse::<i32>().ok()?;
            let suffix = captures.get(3)?.as_str().to_string();
            Some((prefix, number, suffix))
        } else {
            None
        }
    }

    fn detect_text_pattern(&self, values: &[&str]) -> bool {
        if values.len() < 2 {
            return false;
        }

        // Check if all values have the same prefix/suffix pattern with incrementing numbers
        let mut parsed_values = Vec::new();
        
        for value in values {
            if let Some(parsed) = self.extract_text_with_number(value) {
                parsed_values.push(parsed);
            } else {
                return false;
            }
        }

        // Check if prefixes and suffixes are consistent
        let first_prefix = &parsed_values[0].0;
        let first_suffix = &parsed_values[0].2;
        
        let consistent_format = parsed_values.iter().all(|(prefix, _, suffix)| {
            prefix == first_prefix && suffix == first_suffix
        });

        if !consistent_format {
            return false;
        }

        // Check if numbers are incrementing
        for i in 1..parsed_values.len() {
            let expected = parsed_values[i - 1].1 + 1;
            if parsed_values[i].1 != expected {
                return false;
            }
        }

        true
    }
}

impl PatternDetector for TextPatternDetector {
    fn detect(&self, values: &[CellValue]) -> Option<PatternType> {
        let text_values: Vec<_> = values
            .iter()
            .filter_map(|v| match v {
                CellValue::String(s) => Some(s.as_str()),
                _ => None,
            })
            .collect();

        if self.detect_text_pattern(&text_values) {
            Some(PatternType::Text)
        } else {
            None
        }
    }

    fn priority(&self) -> u32 {
        50 // Lower priority
    }

    fn can_handle(&self, values: &[CellValue]) -> bool {
        // Need at least 2 text values
        let text_count = values
            .iter()
            .filter(|v| matches!(v, CellValue::String(_)))
            .count();
        
        text_count >= 2
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_text_pattern_with_prefix() {
        let detector = TextPatternDetector::new();
        let values = vec![
            CellValue::String("Item 1".to_string()),
            CellValue::String("Item 2".to_string()),
            CellValue::String("Item 3".to_string()),
        ];

        let pattern = detector.detect(&values);
        assert!(matches!(pattern, Some(PatternType::Text)));
    }

    #[test]
    fn test_detect_text_pattern_with_zeros() {
        let detector = TextPatternDetector::new();
        let values = vec![
            CellValue::String("Product-001".to_string()),
            CellValue::String("Product-002".to_string()),
            CellValue::String("Product-003".to_string()),
        ];

        let pattern = detector.detect(&values);
        assert!(matches!(pattern, Some(PatternType::Text)));
    }

    #[test]
    fn test_detect_text_pattern_alphanumeric() {
        let detector = TextPatternDetector::new();
        let values = vec![
            CellValue::String("A1".to_string()),
            CellValue::String("A2".to_string()),
            CellValue::String("A3".to_string()),
        ];

        let pattern = detector.detect(&values);
        assert!(matches!(pattern, Some(PatternType::Text)));
    }

    #[test]
    fn test_no_pattern_inconsistent_prefix() {
        let detector = TextPatternDetector::new();
        let values = vec![
            CellValue::String("Item 1".to_string()),
            CellValue::String("Product 2".to_string()),
            CellValue::String("Item 3".to_string()),
        ];

        let pattern = detector.detect(&values);
        assert!(pattern.is_none());
    }

    #[test]
    fn test_no_pattern_non_incrementing() {
        let detector = TextPatternDetector::new();
        let values = vec![
            CellValue::String("Item 1".to_string()),
            CellValue::String("Item 3".to_string()),
            CellValue::String("Item 5".to_string()),
        ];

        let pattern = detector.detect(&values);
        assert!(pattern.is_none());
    }

    #[test]
    fn test_can_handle_mixed_values() {
        let detector = TextPatternDetector::new();
        let values = vec![
            CellValue::String("Item 1".to_string()),
            CellValue::Number(42.0),
            CellValue::String("Item 2".to_string()),
        ];

        assert!(detector.can_handle(&values));
    }
}