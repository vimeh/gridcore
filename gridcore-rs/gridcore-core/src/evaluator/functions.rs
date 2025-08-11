use super::operators::{coerce_to_boolean, coerce_to_number, coerce_to_string};
use crate::types::CellValue;
use crate::types::ErrorType;
use crate::{Result, SpreadsheetError};
use std::collections::HashMap;

type FunctionImpl = Box<dyn Fn(&[CellValue]) -> Result<CellValue>>;

/// Library of spreadsheet functions
pub struct FunctionLibrary {
    functions: HashMap<String, FunctionImpl>,
}

impl Default for FunctionLibrary {
    fn default() -> Self {
        Self::new()
    }
}

impl FunctionLibrary {
    /// Create a new function library with all built-in functions
    pub fn new() -> Self {
        let mut lib = FunctionLibrary {
            functions: HashMap::new(),
        };

        // Register all functions
        lib.register_math_functions();
        lib.register_text_functions();
        lib.register_logical_functions();

        lib
    }

    /// Call a function by name with arguments
    pub fn call(&self, name: &str, args: &[CellValue]) -> Result<CellValue> {
        let func_name = name.to_uppercase();

        if let Some(func) = self.functions.get(&func_name) {
            func(args)
        } else {
            Err(SpreadsheetError::UnknownFunction(name.to_string()))
        }
    }

    /// Register a function
    fn register(&mut self, name: &str, func: FunctionImpl) {
        self.functions.insert(name.to_uppercase(), func);
    }

    /// Register math functions
    fn register_math_functions(&mut self) {
        // SUM function
        self.register(
            "SUM",
            Box::new(|args| {
                let mut sum = 0.0;
                let mut has_error = false;
                let mut error_value = None;

                for arg in args {
                    // Check for errors first and propagate them
                    if let CellValue::Error(e) = arg {
                        has_error = true;
                        error_value = Some(e.clone());
                        break;
                    }

                    // Try to extract numbers, catching any errors
                    match extract_numbers(arg) {
                        Ok(numbers) => {
                            sum += numbers.into_iter().sum::<f64>();
                        }
                        Err(e) => {
                            // Convert error to Excel format and return as CellValue::Error
                            return match e {
                                SpreadsheetError::DivisionByZero
                                | SpreadsheetError::DivideByZero => {
                                    Ok(CellValue::from_error(ErrorType::DivideByZero))
                                }
                                SpreadsheetError::ValueError | SpreadsheetError::TypeError(_) => {
                                    Ok(CellValue::from_error(ErrorType::ValueError {
                                        expected: "numeric".to_string(),
                                        actual: "non-numeric".to_string(),
                                    }))
                                }
                                SpreadsheetError::NumError => {
                                    Ok(CellValue::from_error(ErrorType::NumError))
                                }
                                SpreadsheetError::FormulaError(err_str) => {
                                    Ok(CellValue::from_error(ErrorType::ParseError {
                                        message: err_str,
                                    }))
                                }
                                _ => Ok(CellValue::from_error(ErrorType::ValueError {
                                    expected: "numeric".to_string(),
                                    actual: "non-numeric".to_string(),
                                })),
                            };
                        }
                    }
                }

                if has_error {
                    // Safe to unwrap because has_error is only true when error_value is Some
                    Ok(CellValue::Error(error_value.expect(
                        "error_value should be set when has_error is true",
                    )))
                } else {
                    Ok(CellValue::Number(sum))
                }
            }),
        );

        // AVERAGE function
        self.register(
            "AVERAGE",
            Box::new(|args| {
                let mut all_numbers = Vec::new();
                for arg in args {
                    // Check for errors first and propagate them
                    if let CellValue::Error(e) = arg {
                        return Ok(CellValue::Error(e.clone()));
                    }

                    // Try to extract numbers, catching any errors
                    match extract_numbers(arg) {
                        Ok(numbers) => {
                            all_numbers.extend(numbers);
                        }
                        Err(e) => {
                            // Convert error to Excel format and return as CellValue::Error
                            return match e {
                                SpreadsheetError::DivisionByZero
                                | SpreadsheetError::DivideByZero => {
                                    Ok(CellValue::from_error(ErrorType::DivideByZero))
                                }
                                SpreadsheetError::ValueError | SpreadsheetError::TypeError(_) => {
                                    Ok(CellValue::from_error(ErrorType::ValueError {
                                        expected: "numeric".to_string(),
                                        actual: "non-numeric".to_string(),
                                    }))
                                }
                                SpreadsheetError::NumError => {
                                    Ok(CellValue::from_error(ErrorType::NumError))
                                }
                                SpreadsheetError::FormulaError(err_str) => {
                                    Ok(CellValue::from_error(ErrorType::ParseError {
                                        message: err_str,
                                    }))
                                }
                                _ => Ok(CellValue::from_error(ErrorType::ValueError {
                                    expected: "numeric".to_string(),
                                    actual: "non-numeric".to_string(),
                                })),
                            };
                        }
                    }
                }

                if all_numbers.is_empty() {
                    return Err(SpreadsheetError::InvalidArguments(
                        "AVERAGE requires at least one number".to_string(),
                    ));
                }

                let sum: f64 = all_numbers.iter().sum();
                Ok(CellValue::Number(sum / all_numbers.len() as f64))
            }),
        );

        // MIN function
        self.register(
            "MIN",
            Box::new(|args| {
                let mut all_numbers = Vec::new();
                for arg in args {
                    // Check for errors first and propagate them
                    if let CellValue::Error(e) = arg {
                        return Ok(CellValue::Error(e.clone()));
                    }

                    // Try to extract numbers, catching any errors
                    match extract_numbers(arg) {
                        Ok(numbers) => {
                            all_numbers.extend(numbers);
                        }
                        Err(e) => {
                            // Convert error to Excel format and return as CellValue::Error
                            return match e {
                                SpreadsheetError::DivisionByZero
                                | SpreadsheetError::DivideByZero => {
                                    Ok(CellValue::from_error(ErrorType::DivideByZero))
                                }
                                SpreadsheetError::ValueError | SpreadsheetError::TypeError(_) => {
                                    Ok(CellValue::from_error(ErrorType::ValueError {
                                        expected: "numeric".to_string(),
                                        actual: "non-numeric".to_string(),
                                    }))
                                }
                                SpreadsheetError::NumError => {
                                    Ok(CellValue::from_error(ErrorType::NumError))
                                }
                                SpreadsheetError::FormulaError(err_str) => {
                                    Ok(CellValue::from_error(ErrorType::ParseError {
                                        message: err_str,
                                    }))
                                }
                                _ => Ok(CellValue::from_error(ErrorType::ValueError {
                                    expected: "numeric".to_string(),
                                    actual: "non-numeric".to_string(),
                                })),
                            };
                        }
                    }
                }

                if all_numbers.is_empty() {
                    return Err(SpreadsheetError::InvalidArguments(
                        "MIN requires at least one number".to_string(),
                    ));
                }

                Ok(CellValue::Number(
                    all_numbers.into_iter().fold(f64::INFINITY, f64::min),
                ))
            }),
        );

        // MAX function
        self.register(
            "MAX",
            Box::new(|args| {
                let mut all_numbers = Vec::new();
                for arg in args {
                    // Check for errors first and propagate them
                    if let CellValue::Error(e) = arg {
                        return Ok(CellValue::Error(e.clone()));
                    }

                    // Try to extract numbers, catching any errors
                    match extract_numbers(arg) {
                        Ok(numbers) => {
                            all_numbers.extend(numbers);
                        }
                        Err(e) => {
                            // Convert error to Excel format and return as CellValue::Error
                            return match e {
                                SpreadsheetError::DivisionByZero
                                | SpreadsheetError::DivideByZero => {
                                    Ok(CellValue::from_error(ErrorType::DivideByZero))
                                }
                                SpreadsheetError::ValueError | SpreadsheetError::TypeError(_) => {
                                    Ok(CellValue::from_error(ErrorType::ValueError {
                                        expected: "numeric".to_string(),
                                        actual: "non-numeric".to_string(),
                                    }))
                                }
                                SpreadsheetError::NumError => {
                                    Ok(CellValue::from_error(ErrorType::NumError))
                                }
                                SpreadsheetError::FormulaError(err_str) => {
                                    Ok(CellValue::from_error(ErrorType::ParseError {
                                        message: err_str,
                                    }))
                                }
                                _ => Ok(CellValue::from_error(ErrorType::ValueError {
                                    expected: "numeric".to_string(),
                                    actual: "non-numeric".to_string(),
                                })),
                            };
                        }
                    }
                }

                if all_numbers.is_empty() {
                    return Err(SpreadsheetError::InvalidArguments(
                        "MAX requires at least one number".to_string(),
                    ));
                }

                Ok(CellValue::Number(
                    all_numbers.into_iter().fold(f64::NEG_INFINITY, f64::max),
                ))
            }),
        );

        // COUNT function
        self.register(
            "COUNT",
            Box::new(|args| {
                let mut count = 0;
                for arg in args {
                    // Check for errors first and propagate them
                    if let CellValue::Error(e) = arg {
                        return Ok(CellValue::Error(e.clone()));
                    }

                    // Try to extract numbers, catching any errors
                    match extract_numbers(arg) {
                        Ok(numbers) => {
                            count += numbers.len();
                        }
                        Err(e) => {
                            // Convert error to Excel format and return as CellValue::Error
                            return match e {
                                SpreadsheetError::DivisionByZero
                                | SpreadsheetError::DivideByZero => {
                                    Ok(CellValue::from_error(ErrorType::DivideByZero))
                                }
                                SpreadsheetError::ValueError | SpreadsheetError::TypeError(_) => {
                                    Ok(CellValue::from_error(ErrorType::ValueError {
                                        expected: "numeric".to_string(),
                                        actual: "non-numeric".to_string(),
                                    }))
                                }
                                SpreadsheetError::NumError => {
                                    Ok(CellValue::from_error(ErrorType::NumError))
                                }
                                SpreadsheetError::FormulaError(err_str) => {
                                    Ok(CellValue::from_error(ErrorType::ParseError {
                                        message: err_str,
                                    }))
                                }
                                _ => Ok(CellValue::from_error(ErrorType::ValueError {
                                    expected: "numeric".to_string(),
                                    actual: "non-numeric".to_string(),
                                })),
                            };
                        }
                    }
                }

                Ok(CellValue::Number(count as f64))
            }),
        );

        // ROUND function
        self.register(
            "ROUND",
            Box::new(|args| {
                if args.len() != 2 {
                    return Err(SpreadsheetError::InvalidArguments(
                        "ROUND requires exactly 2 arguments".to_string(),
                    ));
                }

                let number = coerce_to_number(&args[0])?;
                let digits = coerce_to_number(&args[1])? as i32;

                let multiplier = 10_f64.powi(digits);
                Ok(CellValue::Number(
                    (number * multiplier).round() / multiplier,
                ))
            }),
        );

        // ABS function
        self.register(
            "ABS",
            Box::new(|args| {
                if args.len() != 1 {
                    return Err(SpreadsheetError::InvalidArguments(
                        "ABS requires exactly 1 argument".to_string(),
                    ));
                }

                let number = coerce_to_number(&args[0])?;
                Ok(CellValue::Number(number.abs()))
            }),
        );

        // SQRT function
        self.register(
            "SQRT",
            Box::new(|args| {
                if args.len() != 1 {
                    return Err(SpreadsheetError::InvalidArguments(
                        "SQRT requires exactly 1 argument".to_string(),
                    ));
                }

                // Check for error values first
                if let CellValue::Error(e) = &args[0] {
                    return Ok(CellValue::Error(e.clone()));
                }

                let number = coerce_to_number(&args[0])?;
                if number < 0.0 {
                    return Err(SpreadsheetError::NumError);
                }
                Ok(CellValue::Number(number.sqrt()))
            }),
        );
    }

    /// Register text functions
    fn register_text_functions(&mut self) {
        // CONCATENATE function
        self.register(
            "CONCATENATE",
            Box::new(|args| {
                let mut result = String::new();
                for arg in args {
                    result.push_str(&coerce_to_string(arg));
                }
                Ok(CellValue::from_string(result))
            }),
        );

        // LEN function
        self.register(
            "LEN",
            Box::new(|args| {
                if args.len() != 1 {
                    return Err(SpreadsheetError::InvalidArguments(
                        "LEN requires exactly 1 argument".to_string(),
                    ));
                }

                let text = coerce_to_string(&args[0]);
                Ok(CellValue::Number(text.len() as f64))
            }),
        );

        // UPPER function
        self.register(
            "UPPER",
            Box::new(|args| {
                if args.len() != 1 {
                    return Err(SpreadsheetError::InvalidArguments(
                        "UPPER requires exactly 1 argument".to_string(),
                    ));
                }

                let text = coerce_to_string(&args[0]);
                Ok(CellValue::from_string(text.to_uppercase()))
            }),
        );

        // LOWER function
        self.register(
            "LOWER",
            Box::new(|args| {
                if args.len() != 1 {
                    return Err(SpreadsheetError::InvalidArguments(
                        "LOWER requires exactly 1 argument".to_string(),
                    ));
                }

                let text = coerce_to_string(&args[0]);
                Ok(CellValue::from_string(text.to_lowercase()))
            }),
        );

        // TRIM function
        self.register(
            "TRIM",
            Box::new(|args| {
                if args.len() != 1 {
                    return Err(SpreadsheetError::InvalidArguments(
                        "TRIM requires exactly 1 argument".to_string(),
                    ));
                }

                let text = coerce_to_string(&args[0]);
                Ok(CellValue::from_string(text.trim().to_string()))
            }),
        );
    }

    /// Register logical functions
    fn register_logical_functions(&mut self) {
        // IF function
        self.register(
            "IF",
            Box::new(|args| {
                if args.len() != 3 {
                    return Err(SpreadsheetError::InvalidArguments(
                        "IF requires exactly 3 arguments".to_string(),
                    ));
                }

                let condition = coerce_to_boolean(&args[0])?;
                Ok(if condition {
                    args[1].clone()
                } else {
                    args[2].clone()
                })
            }),
        );

        // AND function
        self.register(
            "AND",
            Box::new(|args| {
                if args.is_empty() {
                    return Err(SpreadsheetError::InvalidArguments(
                        "AND requires at least 1 argument".to_string(),
                    ));
                }

                for arg in args {
                    if !coerce_to_boolean(arg)? {
                        return Ok(CellValue::Boolean(false));
                    }
                }
                Ok(CellValue::Boolean(true))
            }),
        );

        // OR function
        self.register(
            "OR",
            Box::new(|args| {
                if args.is_empty() {
                    return Err(SpreadsheetError::InvalidArguments(
                        "OR requires at least 1 argument".to_string(),
                    ));
                }

                for arg in args {
                    if coerce_to_boolean(arg)? {
                        return Ok(CellValue::Boolean(true));
                    }
                }
                Ok(CellValue::Boolean(false))
            }),
        );

        // NOT function
        self.register(
            "NOT",
            Box::new(|args| {
                if args.len() != 1 {
                    return Err(SpreadsheetError::InvalidArguments(
                        "NOT requires exactly 1 argument".to_string(),
                    ));
                }

                let value = coerce_to_boolean(&args[0])?;
                Ok(CellValue::Boolean(!value))
            }),
        );
    }
}

/// Extract numbers from a cell value (including arrays)
fn extract_numbers(value: &CellValue) -> Result<Vec<f64>> {
    match value {
        CellValue::Number(n) => Ok(vec![*n]),
        CellValue::Error(e) => Err(SpreadsheetError::FormulaError(e.to_string())),
        CellValue::Array(arr) => {
            let mut numbers = Vec::new();
            for val in arr.iter() {
                match val {
                    CellValue::Error(e) => {
                        return Err(SpreadsheetError::FormulaError(e.to_string()));
                    }
                    _ => {
                        if let Ok(n) = coerce_to_number(val) {
                            numbers.push(n);
                        }
                        // Skip non-numeric values
                    }
                }
            }
            Ok(numbers)
        }
        CellValue::Empty => Ok(vec![]),
        _ => {
            // Try to coerce single value
            Ok(vec![coerce_to_number(value)?])
        }
    }
}
