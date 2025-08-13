use gridcore_core::types::CellAddress;

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

/// Static list of spreadsheet functions
const SPREADSHEET_FUNCTIONS: &[&str] = &[
    "SUM",
    "AVERAGE",
    "COUNT",
    "COUNTA",
    "COUNTIF",
    "MAX",
    "MIN",
    "IF",
    "IFS",
    "VLOOKUP",
    "HLOOKUP",
    "INDEX",
    "MATCH",
    "CONCATENATE",
    "CONCAT",
    "LEFT",
    "RIGHT",
    "MID",
    "LEN",
    "TRIM",
    "UPPER",
    "LOWER",
    "PROPER",
    "TODAY",
    "NOW",
    "DATE",
    "TIME",
    "YEAR",
    "MONTH",
    "DAY",
    "HOUR",
    "MINUTE",
    "SECOND",
    "WEEKDAY",
    "ROUND",
    "ROUNDUP",
    "ROUNDDOWN",
    "FLOOR",
    "CEILING",
    "ABS",
    "SQRT",
    "POWER",
    "EXP",
    "LOG",
    "LOG10",
    "PI",
    "RAND",
    "RANDBETWEEN",
    "AND",
    "OR",
    "NOT",
    "XOR",
    "ISBLANK",
    "ISERROR",
    "ISNA",
    "ISNUMBER",
    "ISTEXT",
    "ISLOGICAL",
];

/// Get function suggestions based on a prefix
pub fn get_function_suggestions(prefix: &str) -> Vec<String> {
    if prefix.is_empty() {
        return Vec::new();
    }

    let prefix_upper = prefix.to_uppercase();
    SPREADSHEET_FUNCTIONS
        .iter()
        .filter(|func| func.starts_with(&prefix_upper))
        .map(|s| s.to_string())
        .collect()
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
                    signature: get_function_signature(&func),
                })
                .collect();
        }
    }

    Vec::new()
}

/// Get the signature for a function (parameter hints)
pub fn get_function_signature(function: &str) -> String {
    match function {
        "SUM" => "(value1, [value2, ...])",
        "AVERAGE" => "(value1, [value2, ...])",
        "COUNT" => "(value1, [value2, ...])",
        "COUNTA" => "(value1, [value2, ...])",
        "COUNTIF" => "(range, criteria)",
        "MAX" => "(value1, [value2, ...])",
        "MIN" => "(value1, [value2, ...])",
        "IF" => "(logical_test, value_if_true, value_if_false)",
        "IFS" => "(logical_test1, value_if_true1, [logical_test2, value_if_true2], ...)",
        "VLOOKUP" => "(lookup_value, table_array, col_index_num, [range_lookup])",
        "HLOOKUP" => "(lookup_value, table_array, row_index_num, [range_lookup])",
        "INDEX" => "(array, row_num, [column_num])",
        "MATCH" => "(lookup_value, lookup_array, [match_type])",
        "CONCATENATE" => "(text1, [text2, ...])",
        "CONCAT" => "(text1, [text2, ...])",
        "LEFT" => "(text, [num_chars])",
        "RIGHT" => "(text, [num_chars])",
        "MID" => "(text, start_num, num_chars)",
        "LEN" => "(text)",
        "TRIM" => "(text)",
        "UPPER" => "(text)",
        "LOWER" => "(text)",
        "PROPER" => "(text)",
        "TODAY" => "()",
        "NOW" => "()",
        "DATE" => "(year, month, day)",
        "TIME" => "(hour, minute, second)",
        "YEAR" => "(date)",
        "MONTH" => "(date)",
        "DAY" => "(date)",
        "HOUR" => "(time)",
        "MINUTE" => "(time)",
        "SECOND" => "(time)",
        "WEEKDAY" => "(date, [return_type])",
        "ROUND" => "(number, num_digits)",
        "ROUNDUP" => "(number, num_digits)",
        "ROUNDDOWN" => "(number, num_digits)",
        "FLOOR" => "(number, significance)",
        "CEILING" => "(number, significance)",
        "ABS" => "(number)",
        "SQRT" => "(number)",
        "POWER" => "(number, power)",
        "EXP" => "(number)",
        "LOG" => "(number, [base])",
        "LOG10" => "(number)",
        "PI" => "()",
        "RAND" => "()",
        "RANDBETWEEN" => "(bottom, top)",
        "AND" => "(logical1, [logical2, ...])",
        "OR" => "(logical1, [logical2, ...])",
        "NOT" => "(logical)",
        "XOR" => "(logical1, [logical2, ...])",
        "ISBLANK" => "(value)",
        "ISERROR" => "(value)",
        "ISNA" => "(value)",
        "ISNUMBER" => "(value)",
        "ISTEXT" => "(value)",
        "ISLOGICAL" => "(value)",
        _ => "()",
    }
    .to_string()
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
            // For input like "=SU", we want to split on non-alphanumeric chars
            // but '=' is at the start, so we need special handling

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
