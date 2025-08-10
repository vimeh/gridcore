pub mod command;
pub mod dependency;
pub mod domain;
pub mod error;
pub mod evaluator;
pub mod facade;
pub mod fill;
pub mod formula;
pub mod references;
pub mod repository;
pub mod services;
pub mod traits;
pub mod types;
pub mod workbook;

// Re-export commonly used types
pub use dependency::{DependencyAnalyzer, DependencyGraph};
pub use domain::Cell;
pub use error::{Result, SpreadsheetError};
pub use evaluator::{EvaluationContext, Evaluator};
pub use facade::{EventCallback, SpreadsheetEvent, SpreadsheetFacade};
pub use formula::{BinaryOperator, CellRange, Expr, FormulaParser, UnaryOperator};
pub use repository::CellRepository;
