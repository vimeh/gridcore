use gridcore_core::SpreadsheetError;

/// UI-specific Result type for better error handling
pub type UiResult<T> = Result<T, UiError>;

#[derive(Debug, Clone)]
pub enum UiError {
    /// Error from the core spreadsheet logic
    Spreadsheet(SpreadsheetError),
    /// UI-specific errors
    InvalidInput(String),
    RenderError(String),
    StateError(String),
    /// Generic error with message
    Generic(String),
}

impl UiError {
    /// Convert to user-friendly error message
    pub fn to_user_message(&self) -> String {
        match self {
            UiError::Spreadsheet(e) => match e {
                SpreadsheetError::CircularDependency => {
                    "Circular reference detected in formula".to_string()
                }
                SpreadsheetError::DivideByZero | SpreadsheetError::DivisionByZero => {
                    "#DIV/0! - Division by zero".to_string()
                }
                SpreadsheetError::ValueError => "#VALUE! - Invalid value type".to_string(),
                SpreadsheetError::RefError => "#REF! - Invalid cell reference".to_string(),
                SpreadsheetError::NameError => "#NAME? - Unknown function or name".to_string(),
                SpreadsheetError::NumError => "#NUM! - Invalid numeric value".to_string(),
                SpreadsheetError::InvalidFormula(msg) => format!("Formula error: {}", msg),
                SpreadsheetError::UnknownFunction(name) => {
                    format!("Unknown function: {}", name)
                }
                SpreadsheetError::InvalidArguments(msg) => {
                    format!("Invalid arguments: {}", msg)
                }
                _ => format!("Spreadsheet error: {}", e),
            },
            UiError::InvalidInput(msg) => format!("Invalid input: {}", msg),
            UiError::RenderError(msg) => format!("Display error: {}", msg),
            UiError::StateError(msg) => format!("State error: {}", msg),
            UiError::Generic(msg) => msg.clone(),
        }
    }

    /// Get severity level for error display
    pub fn severity(&self) -> crate::components::error_display::ErrorSeverity {
        use crate::components::error_display::ErrorSeverity;
        
        match self {
            UiError::Spreadsheet(e) => match e {
                SpreadsheetError::CircularDependency
                | SpreadsheetError::DivideByZero
                | SpreadsheetError::DivisionByZero
                | SpreadsheetError::ValueError
                | SpreadsheetError::RefError
                | SpreadsheetError::NameError
                | SpreadsheetError::NumError => ErrorSeverity::Error,
                _ => ErrorSeverity::Warning,
            },
            UiError::InvalidInput(_) => ErrorSeverity::Warning,
            UiError::RenderError(_) | UiError::StateError(_) => ErrorSeverity::Error,
            UiError::Generic(_) => ErrorSeverity::Info,
        }
    }
}

impl From<SpreadsheetError> for UiError {
    fn from(err: SpreadsheetError) -> Self {
        UiError::Spreadsheet(err)
    }
}

impl From<String> for UiError {
    fn from(msg: String) -> Self {
        UiError::Generic(msg)
    }
}

impl From<&str> for UiError {
    fn from(msg: &str) -> Self {
        UiError::Generic(msg.to_string())
    }
}

impl std::fmt::Display for UiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.to_user_message())
    }
}

impl std::error::Error for UiError {}

/// Helper functions for Result handling
pub fn handle_result_with_error_display<T>(
    result: Result<T, impl Into<UiError>>,
    error_ctx: Option<&crate::components::error_display::ErrorContext>,
) -> Option<T> {
    match result {
        Ok(value) => Some(value),
        Err(err) => {
            let ui_error: UiError = err.into();
            if let Some(ctx) = error_ctx {
                use crate::components::error_display::ErrorSeverity;
                match ui_error.severity() {
                    ErrorSeverity::Error => ctx.show_error(ui_error.to_user_message()),
                    ErrorSeverity::Warning => ctx.show_warning(ui_error.to_user_message()),
                    ErrorSeverity::Info => ctx.show_info(ui_error.to_user_message()),
                }
            } else {
                leptos::logging::error!("Error: {}", ui_error.to_user_message());
            }
            None
        }
    }
}