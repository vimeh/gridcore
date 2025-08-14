pub mod events;
#[cfg(test)]
mod events_test;
pub mod operations;
pub mod spreadsheet;
#[cfg(test)]
mod spreadsheet_test;
pub mod state_access;
pub mod viewport;

// New modular organization
pub mod event_handling;
pub mod managers;
pub mod sheet_management;

#[cfg(test)]
mod tests;

pub use event_handling::EventHandling;
pub use events::{EventDispatcher, KeyboardEvent, MouseEvent, SpreadsheetEvent};
pub use managers::ManagerAccess;
pub use operations::{CellOperations, ErrorOperations, SelectionOperations, SheetOperations};
pub use sheet_management::SheetManagement;
pub use spreadsheet::SpreadsheetController;
pub use state_access::{actions, DirectStateAccess};
pub use viewport::{
    CellPosition, GridConfiguration, ScrollPosition, ViewportBounds, ViewportManager,
};

// Column label utility functions (previously in utils.rs)

/// Convert a column index to a column label (0 -> A, 1 -> B, 26 -> AA, etc.)
pub fn get_column_label(col: usize) -> String {
    let mut label = String::new();
    let mut n = col;
    loop {
        label.insert(0, ((n % 26) as u8 + b'A') as char);
        n /= 26;
        if n == 0 {
            break;
        }
        n -= 1;
    }
    label
}

/// Convert a column label to a column index (A -> 0, B -> 1, AA -> 26, etc.)
pub fn parse_column_label(label: &str) -> Option<usize> {
    if label.is_empty() {
        return None;
    }

    let mut col = 0;
    let label = label.to_uppercase();

    for c in label.chars() {
        if !c.is_ascii_uppercase() {
            return None;
        }
        col = col * 26 + (c as usize - 'A' as usize + 1);
    }

    Some(col - 1)
}

#[cfg(test)]
mod column_label_tests {
    use super::*;

    #[test]
    fn test_column_labels() {
        assert_eq!(get_column_label(0), "A");
        assert_eq!(get_column_label(1), "B");
        assert_eq!(get_column_label(25), "Z");
        assert_eq!(get_column_label(26), "AA");
        assert_eq!(get_column_label(27), "AB");
        assert_eq!(get_column_label(51), "AZ");
        assert_eq!(get_column_label(52), "BA");
        assert_eq!(get_column_label(701), "ZZ");
        assert_eq!(get_column_label(702), "AAA");
    }

    #[test]
    fn test_parse_column_labels() {
        assert_eq!(parse_column_label("A"), Some(0));
        assert_eq!(parse_column_label("B"), Some(1));
        assert_eq!(parse_column_label("Z"), Some(25));
        assert_eq!(parse_column_label("AA"), Some(26));
        assert_eq!(parse_column_label("AB"), Some(27));
        assert_eq!(parse_column_label("AZ"), Some(51));
        assert_eq!(parse_column_label("BA"), Some(52));
        assert_eq!(parse_column_label("ZZ"), Some(701));
        assert_eq!(parse_column_label("AAA"), Some(702));
        assert_eq!(parse_column_label(""), None);
        assert_eq!(parse_column_label("123"), None);
    }
}
