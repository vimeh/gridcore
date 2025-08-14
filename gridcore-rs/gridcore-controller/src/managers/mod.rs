pub mod error;

// Re-export for backwards compatibility during migration
pub use error::ErrorSystem as ErrorManager;
pub use error::ErrorSystem as ErrorFormatter;
pub use error::{ErrorEntry, ErrorSystem};
