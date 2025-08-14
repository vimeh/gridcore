use gridcore_core::types::CellAddress;
use once_cell::sync::Lazy;
use std::collections::HashMap;

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

/// Static list of spreadsheet functions and their signatures
static FUNCTION_DATA: Lazy<HashMap<&'static str, &'static str>> = Lazy::new(|| {
    let mut m = HashMap::new();

    // Math functions
    m.insert("SUM", "(value1, [value2, ...])");
    m.insert("AVERAGE", "(value1, [value2, ...])");
    m.insert("COUNT", "(value1, [value2, ...])");
    m.insert("COUNTA", "(value1, [value2, ...])");
    m.insert("COUNTIF", "(range, criteria)");
    m.insert("MAX", "(value1, [value2, ...])");
    m.insert("MIN", "(value1, [value2, ...])");
    m.insert("ROUND", "(number, num_digits)");
    m.insert("ROUNDUP", "(number, num_digits)");
    m.insert("ROUNDDOWN", "(number, num_digits)");
    m.insert("FLOOR", "(number, significance)");
    m.insert("CEILING", "(number, significance)");
    m.insert("ABS", "(number)");
    m.insert("SQRT", "(number)");
    m.insert("POWER", "(number, power)");
    m.insert("EXP", "(number)");
    m.insert("LOG", "(number, [base])");
    m.insert("LOG10", "(number)");
    m.insert("PI", "()");
    m.insert("RAND", "()");
    m.insert("RANDBETWEEN", "(bottom, top)");

    // Logical functions
    m.insert("IF", "(logical_test, value_if_true, value_if_false)");
    m.insert(
        "IFS",
        "(logical_test1, value_if_true1, [logical_test2, value_if_true2], ...)",
    );
    m.insert("AND", "(logical1, [logical2, ...])");
    m.insert("OR", "(logical1, [logical2, ...])");
    m.insert("NOT", "(logical)");
    m.insert("XOR", "(logical1, [logical2, ...])");

    // Lookup functions
    m.insert(
        "VLOOKUP",
        "(lookup_value, table_array, col_index_num, [range_lookup])",
    );
    m.insert(
        "HLOOKUP",
        "(lookup_value, table_array, row_index_num, [range_lookup])",
    );
    m.insert("INDEX", "(array, row_num, [column_num])");
    m.insert("MATCH", "(lookup_value, lookup_array, [match_type])");

    // Text functions
    m.insert("CONCATENATE", "(text1, [text2, ...])");
    m.insert("CONCAT", "(text1, [text2, ...])");
    m.insert("LEFT", "(text, [num_chars])");
    m.insert("RIGHT", "(text, [num_chars])");
    m.insert("MID", "(text, start_num, num_chars)");
    m.insert("LEN", "(text)");
    m.insert("TRIM", "(text)");
    m.insert("UPPER", "(text)");
    m.insert("LOWER", "(text)");
    m.insert("PROPER", "(text)");

    // Date/Time functions
    m.insert("TODAY", "()");
    m.insert("NOW", "()");
    m.insert("DATE", "(year, month, day)");
    m.insert("TIME", "(hour, minute, second)");
    m.insert("YEAR", "(date)");
    m.insert("MONTH", "(date)");
    m.insert("DAY", "(date)");
    m.insert("HOUR", "(time)");
    m.insert("MINUTE", "(time)");
    m.insert("SECOND", "(time)");
    m.insert("WEEKDAY", "(date, [return_type])");

    // Information functions
    m.insert("ISBLANK", "(value)");
    m.insert("ISERROR", "(value)");
    m.insert("ISNA", "(value)");
    m.insert("ISNUMBER", "(value)");
    m.insert("ISTEXT", "(value)");
    m.insert("ISLOGICAL", "(value)");

    m
});

/// Get function suggestions based on a prefix
pub fn get_function_suggestions(prefix: &str) -> Vec<String> {
    if prefix.is_empty() {
        return Vec::new();
    }

    let prefix_upper = prefix.to_uppercase();
    let mut results: Vec<String> = FUNCTION_DATA
        .keys()
        .filter(|func| func.starts_with(&prefix_upper))
        .map(|s| s.to_string())
        .collect();

    results.sort();
    results
}

/// Get suggestions for the current input
pub fn get_suggestions(input: &str, _cursor_position: usize) -> Vec<AutocompleteSuggestion> {
    if !input.starts_with('=') {
        return Vec::new();
    }

    // Extract the last word being typed for function suggestions
    let parts: Vec<&str> = input
        .rsplitn(2, |c: char| !c.is_alphanumeric() && c != '_')
        .collect();

    if let Some(prefix) = parts.first() {
        if !prefix.is_empty() {
            return get_function_suggestions(prefix)
                .into_iter()
                .map(|func| AutocompleteSuggestion::Function {
                    name: func.clone(),
                    signature: FUNCTION_DATA
                        .get(func.as_str())
                        .unwrap_or(&"()")
                        .to_string(),
                })
                .collect();
        }
    }

    Vec::new()
}

/// Apply a suggestion to the current input
pub fn apply_suggestion(
    input: &str,
    suggestion: &AutocompleteSuggestion,
    cursor_position: usize,
) -> (String, usize) {
    match suggestion {
        AutocompleteSuggestion::Function { name, .. } => {
            // Find where to insert the function
            if let Some(after_equals) = input.strip_prefix('=') {
                // Get everything after the '='
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
                    let new_cursor = new_value.len();
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

/// Get cell reference suggestions based on recent usage or context
pub fn get_cell_suggestions(prefix: &str, _current_cell: &CellAddress) -> Vec<String> {
    // This could be expanded to suggest recently used cells, named ranges, etc.
    // For now, just return empty as cell suggestions require more context
    if prefix.is_empty() {
        return Vec::new();
    }

    Vec::new()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_function_suggestions() {
        let suggestions = get_function_suggestions("SU");
        assert_eq!(suggestions, vec!["SUM"]);

        let suggestions = get_function_suggestions("AV");
        assert_eq!(suggestions, vec!["AVERAGE"]);

        let suggestions = get_function_suggestions("ROUND");
        assert!(suggestions.contains(&"ROUND".to_string()));
        assert!(suggestions.contains(&"ROUNDUP".to_string()));
        assert!(suggestions.contains(&"ROUNDDOWN".to_string()));
    }

    #[test]
    fn test_get_suggestions_for_formula() {
        let suggestions = get_suggestions("=SU", 3);
        assert!(!suggestions.is_empty());
        assert!(matches!(
            &suggestions[0],
            AutocompleteSuggestion::Function { name, .. } if name == "SUM"
        ));
    }

    #[test]
    fn test_no_suggestions_for_non_formula() {
        let suggestions = get_suggestions("Hello", 5);
        assert!(suggestions.is_empty());
    }

    #[test]
    fn test_apply_function_suggestion() {
        let suggestion = AutocompleteSuggestion::Function {
            name: "SUM".to_string(),
            signature: "(value1, [value2, ...])".to_string(),
        };

        let (result, cursor) = apply_suggestion("=SU", &suggestion, 3);
        assert_eq!(result, "=SUM(");
        assert_eq!(cursor, 5); // Cursor is at position 5, right after the '('
    }
}
