use super::context::EvaluationContext;
use super::functions::FunctionLibrary;
use super::operators;
use crate::formula::ast::{CellRange, Expr};
use crate::types::CellValue;
use crate::{Result, SpreadsheetError};

/// Main formula evaluator
pub struct Evaluator<'a> {
    context: &'a mut dyn EvaluationContext,
    function_library: FunctionLibrary,
}

impl<'a> Evaluator<'a> {
    /// Create a new evaluator with the given context
    pub fn new(context: &'a mut dyn EvaluationContext) -> Self {
        Evaluator {
            context,
            function_library: FunctionLibrary::new(),
        }
    }

    /// Evaluate a formula expression
    pub fn evaluate(&mut self, expr: &Expr) -> Result<CellValue> {
        match expr {
            Expr::Literal { value, .. } => Ok(value.clone()),

            Expr::Reference { address, .. } => {
                // Check for circular dependency
                if self.context.check_circular(address) {
                    // Return as CellValue::Error for proper propagation
                    return Ok(CellValue::Error("#CIRC!".to_string()));
                }

                // Get the cell value
                match self.context.get_cell_value(address) {
                    Ok(value) => Ok(value),
                    Err(e) => {
                        // Convert errors to Excel format
                        match e {
                            SpreadsheetError::CircularDependency => {
                                Ok(CellValue::Error("#CIRC!".to_string()))
                            }
                            _ => Err(e)
                        }
                    }
                }
            }

            Expr::Range { .. } => {
                // Ranges by themselves evaluate to an error
                // They should only be used as function arguments
                Err(SpreadsheetError::InvalidFormula(
                    "Range expressions can only be used as function arguments".to_string(),
                ))
            }

            Expr::UnaryOp { op, expr, .. } => {
                let value = self.evaluate(expr)?;
                operators::apply_unary(op, value)
            }

            Expr::BinaryOp {
                op, left, right, ..
            } => {
                let left_val = self.evaluate(left)?;
                let right_val = self.evaluate(right)?;
                operators::apply_binary(op, left_val, right_val)
            }

            Expr::FunctionCall { name, args, .. } => self.evaluate_function(name, args),
        }
    }

    /// Evaluate a function call
    fn evaluate_function(&mut self, name: &str, args: &[Expr]) -> Result<CellValue> {
        // Special handling for functions that take ranges
        let mut evaluated_args = Vec::new();

        for arg in args {
            match arg {
                Expr::Range { range, .. } => {
                    // For ranges, collect all cell values
                    let mut values = Vec::new();
                    for cell_addr in range.cells() {
                        if self.context.check_circular(&cell_addr) {
                            // Return circular reference error as CellValue::Error
                            return Ok(CellValue::Error("#CIRC!".to_string()));
                        }
                        match self.context.get_cell_value(&cell_addr) {
                            Ok(value) => values.push(value),
                            Err(SpreadsheetError::CircularDependency) => {
                                return Ok(CellValue::Error("#CIRC!".to_string()));
                            }
                            Err(e) => return Err(e),
                        }
                    }
                    evaluated_args.push(CellValue::Array(values));
                }
                _ => {
                    // Regular expression evaluation
                    evaluated_args.push(self.evaluate(arg)?);
                }
            }
        }

        // Call the function
        self.function_library.call(name, &evaluated_args)
    }

    /// Evaluate a range of cells and return as array
    pub fn evaluate_range(&mut self, range: &CellRange) -> Result<Vec<CellValue>> {
        let mut values = Vec::new();

        for cell_addr in range.cells() {
            if self.context.check_circular(&cell_addr) {
                // Add circular reference error to the array
                values.push(CellValue::Error("#CIRC!".to_string()));
                continue;
            }
            match self.context.get_cell_value(&cell_addr) {
                Ok(value) => values.push(value),
                Err(SpreadsheetError::CircularDependency) => {
                    values.push(CellValue::Error("#CIRC!".to_string()));
                }
                Err(e) => return Err(e),
            }
        }

        Ok(values)
    }
}

#[cfg(test)]
mod tests {
    use super::super::context::BasicContext;
    use super::*;
    use crate::formula::FormulaParser;

    #[test]
    fn test_evaluate_literal() {
        let mut context = BasicContext::new();
        let mut evaluator = Evaluator::new(&mut context);

        let expr = FormulaParser::parse("42").unwrap();
        let result = evaluator.evaluate(&expr).unwrap();
        assert_eq!(result, CellValue::Number(42.0));

        let expr = FormulaParser::parse("\"hello\"").unwrap();
        let result = evaluator.evaluate(&expr).unwrap();
        assert_eq!(result, CellValue::String("hello".to_string()));

        let expr = FormulaParser::parse("TRUE").unwrap();
        let result = evaluator.evaluate(&expr).unwrap();
        assert_eq!(result, CellValue::Boolean(true));
    }

    #[test]
    fn test_evaluate_arithmetic() {
        let mut context = BasicContext::new();
        let mut evaluator = Evaluator::new(&mut context);

        let expr = FormulaParser::parse("2 + 3").unwrap();
        let result = evaluator.evaluate(&expr).unwrap();
        assert_eq!(result, CellValue::Number(5.0));

        let expr = FormulaParser::parse("10 - 4").unwrap();
        let result = evaluator.evaluate(&expr).unwrap();
        assert_eq!(result, CellValue::Number(6.0));

        let expr = FormulaParser::parse("3 * 4").unwrap();
        let result = evaluator.evaluate(&expr).unwrap();
        assert_eq!(result, CellValue::Number(12.0));

        let expr = FormulaParser::parse("15 / 3").unwrap();
        let result = evaluator.evaluate(&expr).unwrap();
        assert_eq!(result, CellValue::Number(5.0));
    }

    #[test]
    fn test_evaluate_unary() {
        let mut context = BasicContext::new();
        let mut evaluator = Evaluator::new(&mut context);

        let expr = FormulaParser::parse("-5").unwrap();
        let result = evaluator.evaluate(&expr).unwrap();
        assert_eq!(result, CellValue::Number(-5.0));

        let expr = FormulaParser::parse("50%").unwrap();
        let result = evaluator.evaluate(&expr).unwrap();
        assert_eq!(result, CellValue::Number(0.5));
    }
}
