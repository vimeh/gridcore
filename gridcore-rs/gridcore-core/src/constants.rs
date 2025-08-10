//! Common string constants to avoid repeated allocations

// Error messages
pub const ERROR_VALID_VALUE: &str = "valid value";
pub const ERROR_INVALID: &str = "invalid";
pub const ERROR_UNKNOWN: &str = "unknown";
pub const ERROR_UNKNOWN_FUNCTION: &str = "unknown";

// Common strings
pub const UNTITLED: &str = "Untitled";
pub const VERSION_DEFAULT: &str = "1.0.0";

// Error type prefixes
pub const ERROR_DIV_ZERO: &str = "#DIV/0!";
pub const ERROR_REF: &str = "#REF!";
pub const ERROR_NAME: &str = "#NAME?";
pub const ERROR_VALUE: &str = "#VALUE!";
pub const ERROR_CIRC: &str = "#CIRC!";
pub const ERROR_NUM: &str = "#NUM!";

// Error descriptions
pub const DESC_DIVISION_BY_ZERO: &str = "Division by zero";
pub const DESC_INVALID_REFERENCE: &str = "Invalid reference";
pub const DESC_UNKNOWN_FUNCTION: &str = "Unknown function";
pub const DESC_TYPE_MISMATCH: &str = "Type mismatch";
pub const DESC_CIRCULAR_REFERENCE: &str = "Circular";

// Type names for error messages
pub const TYPE_NUMBER: &str = "number";
pub const TYPE_STRING: &str = "string";
pub const TYPE_BOOLEAN: &str = "boolean";