pub mod adapters;
pub mod command;
pub mod constants;
pub mod dependency;
pub mod domain;
pub mod error;
pub mod evaluator;
pub mod facade;
pub mod fill;
pub mod formula;
pub mod ports;
pub mod references;
pub mod repository;
pub mod services;
pub mod traits;
pub mod types;
pub mod utils;
pub mod workbook;

#[cfg(feature = "perf")]
pub mod perf;

#[cfg(test)]
pub mod test_utils;

// Re-export commonly used types
pub use dependency::{DependencyAnalyzer, DependencyGraph};
pub use domain::Cell;
pub use error::{Result, SpreadsheetError};
pub use evaluator::{EvaluationContext, Evaluator};
pub use facade::SpreadsheetFacade;
pub use formula::{BinaryOperator, CellRange, Expr, FormulaParser, UnaryOperator};
pub use repository::CellRepository;
pub use services::{EventCallback, SpreadsheetEvent};
