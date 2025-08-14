use super::{KeyMeta, VimExtension};
use crate::state::{Action, UIState};
use gridcore_core::Result;

/// Extension for toggling cell reference types in formulas (F4 key)
pub struct ReferenceToggleExtension;

impl ReferenceToggleExtension {
    pub fn new() -> Self {
        Self
    }

    /// Find the reference at the current cursor position in a formula
    fn find_reference_at_cursor(&self, formula: &str, cursor_pos: usize) -> Option<ReferenceMatch> {
        // Regular expression for cell references
        // Use [0-9] instead of \d to avoid needing unicode-perl feature
        let pattern = r"(\$?)([A-Z]+)(\$?)([0-9]+)";
        let regex = regex::Regex::new(pattern).ok()?;

        // Find all matches in the formula
        for captures in regex.captures_iter(formula) {
            let mat = captures.get(0)?;
            let start = mat.start();
            let end = mat.end();

            // Check if cursor is within this reference (end is exclusive, so use < instead of <=)
            if cursor_pos >= start && cursor_pos < end {
                return Some(ReferenceMatch {
                    start,
                    end,
                    col_absolute: captures.get(1).is_some_and(|m| m.as_str() == "$"),
                    col_letters: captures.get(2)?.as_str().to_string(),
                    row_absolute: captures.get(3).is_some_and(|m| m.as_str() == "$"),
                    row_number: captures.get(4)?.as_str().to_string(),
                });
            }
        }

        None
    }

    /// Cycle through reference types: A1 -> $A$1 -> A$1 -> $A1 -> A1
    fn cycle_reference_type(&self, reference: &ReferenceMatch) -> String {
        let current_type = (reference.col_absolute, reference.row_absolute);

        let next_type = match current_type {
            (false, false) => (true, true),  // A1 -> $A$1
            (true, true) => (false, true),   // $A$1 -> A$1
            (false, true) => (true, false),  // A$1 -> $A1
            (true, false) => (false, false), // $A1 -> A1
        };

        format!(
            "{}{}{}{}",
            if next_type.0 { "$" } else { "" },
            reference.col_letters,
            if next_type.1 { "$" } else { "" },
            reference.row_number
        )
    }

    /// Replace the reference in the formula
    fn replace_reference(
        &self,
        formula: &str,
        reference: &ReferenceMatch,
        new_ref: &str,
    ) -> String {
        let mut result = String::with_capacity(formula.len());
        result.push_str(&formula[..reference.start]);
        result.push_str(new_ref);
        result.push_str(&formula[reference.end..]);
        result
    }
}

impl VimExtension for ReferenceToggleExtension {
    fn handle_key_press(
        &mut self,
        key: &str,
        _meta: &KeyMeta,
        state: &UIState,
    ) -> Result<Option<Action>> {
        // Only handle F4 key
        if key.to_uppercase() != "F4" {
            return Ok(None);
        }

        // Only work in editing mode
        if !matches!(state, UIState::Editing { .. }) {
            return Ok(None);
        }

        // Get the editing value and cursor position
        if let UIState::Editing {
            value, cursor_pos, ..
        } = state
        {
            // Only work with formulas
            if !value.starts_with('=') {
                return Ok(None);
            }

            // Find reference at cursor
            if let Some(reference) = self.find_reference_at_cursor(value, *cursor_pos) {
                // Cycle to next reference type
                let new_reference = self.cycle_reference_type(&reference);

                // Replace in formula
                let new_formula = self.replace_reference(value, &reference, &new_reference);

                // Calculate new cursor position (after the replaced reference)
                let new_cursor_pos = reference.start + new_reference.len();

                return Ok(Some(Action::UpdateEditingValue {
                    value: new_formula,
                    cursor_position: new_cursor_pos,
                }));
            }
        }

        Ok(None)
    }

    fn name(&self) -> &str {
        "ReferenceToggleExtension"
    }
}

/// Information about a matched cell reference
#[derive(Debug)]
struct ReferenceMatch {
    start: usize,
    end: usize,
    col_absolute: bool,
    col_letters: String,
    row_absolute: bool,
    row_number: String,
}

impl Default for ReferenceToggleExtension {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::{CoreState, EditMode, ViewportInfo};
    use gridcore_core::types::CellAddress;

    fn create_test_state(formula: &str, cursor_pos: usize) -> UIState {
        UIState::Editing {
            core: CoreState::new(
                CellAddress::new(0, 0),
                ViewportInfo {
                    start_row: 0,
                    start_col: 0,
                    rows: 10,
                    cols: 10,
                },
            ),
            value: formula.to_string(),
            cursor_pos,
            mode: EditMode::Normal,
            visual_selection: None,
            insert_variant: None,
        }
    }

    #[test]
    fn test_handles_f4_key() {
        let mut ext = ReferenceToggleExtension::new();
        let state = create_test_state("=SUM(A1:B2)", 5); // Position 5 is on 'A' of A1
        let meta = KeyMeta::new("F4");

        let result = ext.handle_key_press("F4", &meta, &state).unwrap();
        assert!(result.is_some(), "Should handle F4 key on reference");

        match result {
            Some(Action::UpdateEditingValue { value, .. }) => {
                assert!(value.contains("$A$1"));
            }
            _ => panic!("Expected UpdateEditingValue action"),
        }
    }

    #[test]
    fn test_handles_lowercase_f4() {
        let mut ext = ReferenceToggleExtension::new();
        let state = create_test_state("=SUM(A1:B2)", 5); // Position 5 is on 'A' of A1
        let meta = KeyMeta::new("f4");

        let result = ext.handle_key_press("f4", &meta, &state).unwrap();
        assert!(result.is_some());
    }

    #[test]
    fn test_ignores_non_f4_keys() {
        let mut ext = ReferenceToggleExtension::new();
        let state = create_test_state("=SUM(A1:B2)", 7);
        let meta = KeyMeta::new("a");

        let result = ext.handle_key_press("a", &meta, &state).unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_ignores_in_non_editing_mode() {
        let mut ext = ReferenceToggleExtension::new();
        let state = UIState::Navigation {
            core: CoreState::new(
                CellAddress::new(0, 0),
                ViewportInfo {
                    start_row: 0,
                    start_col: 0,
                    rows: 10,
                    cols: 10,
                },
            ),
            selection: None,
            modal: None,
        };
        let meta = KeyMeta::new("F4");

        let result = ext.handle_key_press("F4", &meta, &state).unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_reference_cycling() {
        let ext = ReferenceToggleExtension::new();

        // Test A1 -> $A$1
        let ref1 = ReferenceMatch {
            start: 0,
            end: 2,
            col_absolute: false,
            col_letters: "A".to_string(),
            row_absolute: false,
            row_number: "1".to_string(),
        };
        assert_eq!(ext.cycle_reference_type(&ref1), "$A$1");

        // Test $A$1 -> A$1
        let ref2 = ReferenceMatch {
            start: 0,
            end: 4,
            col_absolute: true,
            col_letters: "A".to_string(),
            row_absolute: true,
            row_number: "1".to_string(),
        };
        assert_eq!(ext.cycle_reference_type(&ref2), "A$1");

        // Test A$1 -> $A1
        let ref3 = ReferenceMatch {
            start: 0,
            end: 3,
            col_absolute: false,
            col_letters: "A".to_string(),
            row_absolute: true,
            row_number: "1".to_string(),
        };
        assert_eq!(ext.cycle_reference_type(&ref3), "$A1");

        // Test $A1 -> A1
        let ref4 = ReferenceMatch {
            start: 0,
            end: 3,
            col_absolute: true,
            col_letters: "A".to_string(),
            row_absolute: false,
            row_number: "1".to_string(),
        };
        assert_eq!(ext.cycle_reference_type(&ref4), "A1");
    }

    #[test]
    fn test_find_reference_at_cursor() {
        let ext = ReferenceToggleExtension::new();

        // Test finding A1
        let formula = "=SUM(A1:B2)";
        // Position 5 is 'A', position 6 is '1', so cursor on A1 is at position 5 or 6
        let reference = ext.find_reference_at_cursor(formula, 5); // Cursor on 'A' of A1
        assert!(reference.is_some(), "Should find reference at position 5");
        let reference = reference.unwrap();
        assert_eq!(reference.col_letters, "A");
        assert_eq!(reference.row_number, "1");
        assert!(!reference.col_absolute);
        assert!(!reference.row_absolute);

        // Test finding $B$2
        let formula2 = "=SUM(A1:$B$2)";
        let reference2 = ext.find_reference_at_cursor(formula2, 9); // Cursor on 'B' of $B$2
        assert!(reference2.is_some(), "Should find reference at position 9");
        let reference2 = reference2.unwrap();
        assert_eq!(reference2.col_letters, "B");
        assert_eq!(reference2.row_number, "2");
        assert!(reference2.col_absolute);
        assert!(reference2.row_absolute);
    }

    #[test]
    fn test_replace_reference() {
        let ext = ReferenceToggleExtension::new();

        let formula = "=SUM(A1:B2)";
        let reference = ReferenceMatch {
            start: 5,
            end: 7,
            col_absolute: false,
            col_letters: "A".to_string(),
            row_absolute: false,
            row_number: "1".to_string(),
        };

        let result = ext.replace_reference(formula, &reference, "$A$1");
        assert_eq!(result, "=SUM($A$1:B2)");
    }

    #[test]
    fn test_multiple_references() {
        let mut ext = ReferenceToggleExtension::new();

        // Formula with multiple references
        let state = create_test_state("=A1+B2*C3", 1); // Cursor on A1
        let meta = KeyMeta::new("F4");

        let result = ext.handle_key_press("F4", &meta, &state).unwrap();
        match result {
            Some(Action::UpdateEditingValue { value, .. }) => {
                assert_eq!(value, "=$A$1+B2*C3"); // Only A1 should change
            }
            _ => panic!("Expected UpdateEditingValue action"),
        }
    }

    #[test]
    fn test_complex_references() {
        let ext = ReferenceToggleExtension::new();

        // Test with multi-letter columns
        let formula = "=AA1+ZZ99";
        // Position 0='=', 1='A', 2='A', 3='1', so AA1 is at positions 1..4
        let reference = ext.find_reference_at_cursor(formula, 1); // Cursor on first 'A' of AA1
        assert!(reference.is_some(), "Should find reference AA1");
        let reference = reference.unwrap();
        assert_eq!(reference.col_letters, "AA");
        assert_eq!(reference.row_number, "1");
    }

    #[test]
    fn test_non_formula_ignored() {
        let mut ext = ReferenceToggleExtension::new();
        let state = create_test_state("Hello World", 5); // Not a formula
        let meta = KeyMeta::new("F4");

        let result = ext.handle_key_press("F4", &meta, &state).unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_cursor_not_on_reference() {
        let mut ext = ReferenceToggleExtension::new();
        let state = create_test_state("=SUM(A1:B2)", 4); // Cursor on '('
        let meta = KeyMeta::new("F4");

        let result = ext.handle_key_press("F4", &meta, &state).unwrap();
        assert!(result.is_none());
    }
}
