use gridcore_core::types::CellAddress;

/// Manages autocomplete suggestions for formulas and cell references
pub struct AutocompleteManager {
    /// Available spreadsheet functions
    functions: Vec<String>,
}

impl AutocompleteManager {
    pub fn new() -> Self {
        Self {
            functions: Self::get_default_functions(),
        }
    }

    /// Get the default list of spreadsheet functions
    fn get_default_functions() -> Vec<String> {
        vec![
            "SUM".to_string(),
            "AVERAGE".to_string(),
            "COUNT".to_string(),
            "COUNTA".to_string(),
            "COUNTIF".to_string(),
            "MAX".to_string(),
            "MIN".to_string(),
            "IF".to_string(),
            "IFS".to_string(),
            "VLOOKUP".to_string(),
            "HLOOKUP".to_string(),
            "INDEX".to_string(),
            "MATCH".to_string(),
            "CONCATENATE".to_string(),
            "CONCAT".to_string(),
            "LEFT".to_string(),
            "RIGHT".to_string(),
            "MID".to_string(),
            "LEN".to_string(),
            "TRIM".to_string(),
            "UPPER".to_string(),
            "LOWER".to_string(),
            "PROPER".to_string(),
            "TODAY".to_string(),
            "NOW".to_string(),
            "DATE".to_string(),
            "TIME".to_string(),
            "YEAR".to_string(),
            "MONTH".to_string(),
            "DAY".to_string(),
            "HOUR".to_string(),
            "MINUTE".to_string(),
            "SECOND".to_string(),
            "WEEKDAY".to_string(),
            "ROUND".to_string(),
            "ROUNDUP".to_string(),
            "ROUNDDOWN".to_string(),
            "FLOOR".to_string(),
            "CEILING".to_string(),
            "ABS".to_string(),
            "SQRT".to_string(),
            "POWER".to_string(),
            "EXP".to_string(),
            "LOG".to_string(),
            "LOG10".to_string(),
            "PI".to_string(),
            "RAND".to_string(),
            "RANDBETWEEN".to_string(),
            "AND".to_string(),
            "OR".to_string(),
            "NOT".to_string(),
            "XOR".to_string(),
            "ISBLANK".to_string(),
            "ISERROR".to_string(),
            "ISNA".to_string(),
            "ISNUMBER".to_string(),
            "ISTEXT".to_string(),
            "ISLOGICAL".to_string(),
        ]
    }

    /// Get function suggestions based on a prefix
    pub fn get_function_suggestions(&self, prefix: &str) -> Vec<String> {
        if prefix.is_empty() {
            return Vec::new();
        }

        let prefix_upper = prefix.to_uppercase();
        self.functions
            .iter()
            .filter(|func| func.starts_with(&prefix_upper))
            .cloned()
            .collect()
    }

    /// Get suggestions for the current input
    pub fn get_suggestions(
        &self,
        input: &str,
        _cursor_position: usize,
    ) -> Vec<AutocompleteSuggestion> {
        if !input.starts_with('=') {
            return Vec::new();
        }

        // Extract the last word being typed for function suggestions
        let parts: Vec<&str> = input
            .rsplitn(2, |c: char| !c.is_alphanumeric() && c != '_')
            .collect();

        if let Some(prefix) = parts.first() {
            if !prefix.is_empty() {
                return self
                    .get_function_suggestions(prefix)
                    .into_iter()
                    .map(|func| AutocompleteSuggestion::Function {
                        name: func.clone(),
                        signature: self.get_function_signature(&func),
                    })
                    .collect();
            }
        }

        Vec::new()
    }

    /// Get the signature for a function (parameter hints)
    fn get_function_signature(&self, function: &str) -> String {
        match function {
            "SUM" => "(value1, [value2, ...])".to_string(),
            "AVERAGE" => "(value1, [value2, ...])".to_string(),
            "COUNT" => "(value1, [value2, ...])".to_string(),
            "COUNTA" => "(value1, [value2, ...])".to_string(),
            "COUNTIF" => "(range, criteria)".to_string(),
            "MAX" => "(value1, [value2, ...])".to_string(),
            "MIN" => "(value1, [value2, ...])".to_string(),
            "IF" => "(logical_test, value_if_true, value_if_false)".to_string(),
            "IFS" => {
                "(logical_test1, value_if_true1, [logical_test2, value_if_true2], ...)".to_string()
            }
            "VLOOKUP" => "(lookup_value, table_array, col_index_num, [range_lookup])".to_string(),
            "HLOOKUP" => "(lookup_value, table_array, row_index_num, [range_lookup])".to_string(),
            "INDEX" => "(array, row_num, [column_num])".to_string(),
            "MATCH" => "(lookup_value, lookup_array, [match_type])".to_string(),
            "CONCATENATE" => "(text1, [text2, ...])".to_string(),
            "CONCAT" => "(text1, [text2, ...])".to_string(),
            "LEFT" => "(text, [num_chars])".to_string(),
            "RIGHT" => "(text, [num_chars])".to_string(),
            "MID" => "(text, start_num, num_chars)".to_string(),
            "LEN" => "(text)".to_string(),
            "TRIM" => "(text)".to_string(),
            "UPPER" => "(text)".to_string(),
            "LOWER" => "(text)".to_string(),
            "PROPER" => "(text)".to_string(),
            "TODAY" => "()".to_string(),
            "NOW" => "()".to_string(),
            "DATE" => "(year, month, day)".to_string(),
            "TIME" => "(hour, minute, second)".to_string(),
            "YEAR" => "(date)".to_string(),
            "MONTH" => "(date)".to_string(),
            "DAY" => "(date)".to_string(),
            "HOUR" => "(time)".to_string(),
            "MINUTE" => "(time)".to_string(),
            "SECOND" => "(time)".to_string(),
            "WEEKDAY" => "(date, [return_type])".to_string(),
            "ROUND" => "(number, num_digits)".to_string(),
            "ROUNDUP" => "(number, num_digits)".to_string(),
            "ROUNDDOWN" => "(number, num_digits)".to_string(),
            "FLOOR" => "(number, significance)".to_string(),
            "CEILING" => "(number, significance)".to_string(),
            "ABS" => "(number)".to_string(),
            "SQRT" => "(number)".to_string(),
            "POWER" => "(number, power)".to_string(),
            "EXP" => "(number)".to_string(),
            "LOG" => "(number, [base])".to_string(),
            "LOG10" => "(number)".to_string(),
            "PI" => "()".to_string(),
            "RAND" => "()".to_string(),
            "RANDBETWEEN" => "(bottom, top)".to_string(),
            "AND" => "(logical1, [logical2, ...])".to_string(),
            "OR" => "(logical1, [logical2, ...])".to_string(),
            "NOT" => "(logical)".to_string(),
            "XOR" => "(logical1, [logical2, ...])".to_string(),
            "ISBLANK" => "(value)".to_string(),
            "ISERROR" => "(value)".to_string(),
            "ISNA" => "(value)".to_string(),
            "ISNUMBER" => "(value)".to_string(),
            "ISTEXT" => "(value)".to_string(),
            "ISLOGICAL" => "(value)".to_string(),
            _ => "()".to_string(),
        }
    }

    /// Get cell reference suggestions based on recent usage or context
    pub fn get_cell_suggestions(&self, prefix: &str, _current_cell: &CellAddress) -> Vec<String> {
        // This could be expanded to suggest recently used cells, named ranges, etc.
        // For now, just return empty as cell suggestions require more context
        if prefix.is_empty() {
            return Vec::new();
        }

        Vec::new()
    }

    /// Apply a suggestion to the current input
    pub fn apply_suggestion(
        &self,
        input: &str,
        suggestion: &AutocompleteSuggestion,
        cursor_position: usize,
    ) -> (String, usize) {
        match suggestion {
            AutocompleteSuggestion::Function { name, .. } => {
                // Find where to insert the function
                // For input like "=SU", we want to split on non-alphanumeric chars
                // but '=' is at the start, so we need special handling

                if input.starts_with('=') {
                    // Get everything after the '='
                    let after_equals = &input[1..];

                    // Find the last word being typed (the function prefix)
                    let parts: Vec<&str> = after_equals
                        .rsplitn(2, |c: char| !c.is_alphanumeric() && c != '_')
                        .collect();

                    if parts.len() == 2 {
                        // There's a delimiter after '=', like "=A1+SU"
                        let new_value = format!("={}{}(", parts[1], name);
                        let new_cursor = new_value.len();
                        (new_value, new_cursor)
                    } else {
                        // No delimiter after '=', like "=SU"
                        // Replace everything after '=' with the function name
                        let new_value = format!("={}(", name);
                        let new_cursor = new_value.len(); // This will be 5 for "=SUM("
                        (new_value, new_cursor)
                    }
                } else {
                    // No '=' at start, shouldn't happen for function suggestions
                    // but handle it anyway
                    let new_value = format!("{}(", name);
                    let new_cursor = new_value.len();
                    (new_value, new_cursor)
                }
            }
            AutocompleteSuggestion::CellReference { address } => {
                // Insert the cell reference at cursor position
                let mut new_value = input.to_string();
                new_value.insert_str(cursor_position, address);
                let new_cursor = cursor_position + address.len();
                (new_value, new_cursor)
            }
        }
    }
}

impl Default for AutocompleteManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Represents different types of autocomplete suggestions
#[derive(Debug, Clone)]
pub enum AutocompleteSuggestion {
    Function { name: String, signature: String },
    CellReference { address: String },
}

impl AutocompleteSuggestion {
    /// Get the display text for the suggestion
    pub fn display_text(&self) -> String {
        match self {
            Self::Function { name, signature } => format!("{}{}", name, signature),
            Self::CellReference { address } => address.clone(),
        }
    }

    /// Get just the name/value of the suggestion
    pub fn value(&self) -> &str {
        match self {
            Self::Function { name, .. } => name,
            Self::CellReference { address } => address,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_function_suggestions() {
        let manager = AutocompleteManager::new();

        let suggestions = manager.get_function_suggestions("SU");
        assert_eq!(suggestions, vec!["SUM"]);

        let suggestions = manager.get_function_suggestions("AV");
        assert_eq!(suggestions, vec!["AVERAGE"]);

        let suggestions = manager.get_function_suggestions("ROUND");
        assert!(suggestions.contains(&"ROUND".to_string()));
        assert!(suggestions.contains(&"ROUNDUP".to_string()));
        assert!(suggestions.contains(&"ROUNDDOWN".to_string()));
    }

    #[test]
    fn test_get_suggestions_for_formula() {
        let manager = AutocompleteManager::new();

        let suggestions = manager.get_suggestions("=SU", 3);
        assert!(!suggestions.is_empty());
        assert!(matches!(
            &suggestions[0],
            AutocompleteSuggestion::Function { name, .. } if name == "SUM"
        ));
    }

    #[test]
    fn test_no_suggestions_for_non_formula() {
        let manager = AutocompleteManager::new();

        let suggestions = manager.get_suggestions("Hello", 5);
        assert!(suggestions.is_empty());
    }

    #[test]
    fn test_apply_function_suggestion() {
        let manager = AutocompleteManager::new();
        let suggestion = AutocompleteSuggestion::Function {
            name: "SUM".to_string(),
            signature: "(value1, [value2, ...])".to_string(),
        };

        let (result, cursor) = manager.apply_suggestion("=SU", &suggestion, 3);
        assert_eq!(result, "=SUM(");
        assert_eq!(cursor, 5); // Cursor is at position 5, right after the '('
    }
}
