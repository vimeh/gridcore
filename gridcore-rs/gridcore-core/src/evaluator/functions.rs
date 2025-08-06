use crate::types::CellValue;
use crate::{Result, SpreadsheetError};
use super::operators::{coerce_to_number, coerce_to_string, coerce_to_boolean};
use std::collections::HashMap;

type FunctionImpl = Box<dyn Fn(&[CellValue]) -> Result<CellValue>>;

/// Library of spreadsheet functions
pub struct FunctionLibrary {
    functions: HashMap<String, FunctionImpl>,
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
        self.register("SUM", Box::new(|args| {
            let mut sum = 0.0;
            for arg in args {
                sum += extract_numbers(arg)?
                    .into_iter()
                    .sum::<f64>();
            }
            Ok(CellValue::Number(sum))
        }));
        
        // AVERAGE function
        self.register("AVERAGE", Box::new(|args| {
            let numbers = args.iter()
                .flat_map(|arg| extract_numbers(arg).unwrap_or_default())
                .collect::<Vec<_>>();
            
            if numbers.is_empty() {
                return Err(SpreadsheetError::InvalidArguments(
                    "AVERAGE requires at least one number".to_string()
                ));
            }
            
            let sum: f64 = numbers.iter().sum();
            Ok(CellValue::Number(sum / numbers.len() as f64))
        }));
        
        // MIN function
        self.register("MIN", Box::new(|args| {
            let numbers = args.iter()
                .flat_map(|arg| extract_numbers(arg).unwrap_or_default())
                .collect::<Vec<_>>();
            
            if numbers.is_empty() {
                return Err(SpreadsheetError::InvalidArguments(
                    "MIN requires at least one number".to_string()
                ));
            }
            
            Ok(CellValue::Number(
                numbers.into_iter().fold(f64::INFINITY, f64::min)
            ))
        }));
        
        // MAX function
        self.register("MAX", Box::new(|args| {
            let numbers = args.iter()
                .flat_map(|arg| extract_numbers(arg).unwrap_or_default())
                .collect::<Vec<_>>();
            
            if numbers.is_empty() {
                return Err(SpreadsheetError::InvalidArguments(
                    "MAX requires at least one number".to_string()
                ));
            }
            
            Ok(CellValue::Number(
                numbers.into_iter().fold(f64::NEG_INFINITY, f64::max)
            ))
        }));
        
        // COUNT function
        self.register("COUNT", Box::new(|args| {
            let count = args.iter()
                .flat_map(|arg| extract_numbers(arg).unwrap_or_default())
                .count();
            
            Ok(CellValue::Number(count as f64))
        }));
        
        // ROUND function
        self.register("ROUND", Box::new(|args| {
            if args.len() != 2 {
                return Err(SpreadsheetError::InvalidArguments(
                    "ROUND requires exactly 2 arguments".to_string()
                ));
            }
            
            let number = coerce_to_number(&args[0])?;
            let digits = coerce_to_number(&args[1])? as i32;
            
            let multiplier = 10_f64.powi(digits);
            Ok(CellValue::Number((number * multiplier).round() / multiplier))
        }));
        
        // ABS function
        self.register("ABS", Box::new(|args| {
            if args.len() != 1 {
                return Err(SpreadsheetError::InvalidArguments(
                    "ABS requires exactly 1 argument".to_string()
                ));
            }
            
            let number = coerce_to_number(&args[0])?;
            Ok(CellValue::Number(number.abs()))
        }));
        
        // SQRT function
        self.register("SQRT", Box::new(|args| {
            if args.len() != 1 {
                return Err(SpreadsheetError::InvalidArguments(
                    "SQRT requires exactly 1 argument".to_string()
                ));
            }
            
            let number = coerce_to_number(&args[0])?;
            if number < 0.0 {
                return Err(SpreadsheetError::InvalidArguments(
                    "SQRT of negative number".to_string()
                ));
            }
            Ok(CellValue::Number(number.sqrt()))
        }));
    }
    
    /// Register text functions
    fn register_text_functions(&mut self) {
        // CONCATENATE function
        self.register("CONCATENATE", Box::new(|args| {
            let mut result = String::new();
            for arg in args {
                result.push_str(&coerce_to_string(arg));
            }
            Ok(CellValue::String(result))
        }));
        
        // LEN function
        self.register("LEN", Box::new(|args| {
            if args.len() != 1 {
                return Err(SpreadsheetError::InvalidArguments(
                    "LEN requires exactly 1 argument".to_string()
                ));
            }
            
            let text = coerce_to_string(&args[0]);
            Ok(CellValue::Number(text.len() as f64))
        }));
        
        // UPPER function
        self.register("UPPER", Box::new(|args| {
            if args.len() != 1 {
                return Err(SpreadsheetError::InvalidArguments(
                    "UPPER requires exactly 1 argument".to_string()
                ));
            }
            
            let text = coerce_to_string(&args[0]);
            Ok(CellValue::String(text.to_uppercase()))
        }));
        
        // LOWER function
        self.register("LOWER", Box::new(|args| {
            if args.len() != 1 {
                return Err(SpreadsheetError::InvalidArguments(
                    "LOWER requires exactly 1 argument".to_string()
                ));
            }
            
            let text = coerce_to_string(&args[0]);
            Ok(CellValue::String(text.to_lowercase()))
        }));
        
        // TRIM function
        self.register("TRIM", Box::new(|args| {
            if args.len() != 1 {
                return Err(SpreadsheetError::InvalidArguments(
                    "TRIM requires exactly 1 argument".to_string()
                ));
            }
            
            let text = coerce_to_string(&args[0]);
            Ok(CellValue::String(text.trim().to_string()))
        }));
    }
    
    /// Register logical functions
    fn register_logical_functions(&mut self) {
        // IF function
        self.register("IF", Box::new(|args| {
            if args.len() != 3 {
                return Err(SpreadsheetError::InvalidArguments(
                    "IF requires exactly 3 arguments".to_string()
                ));
            }
            
            let condition = coerce_to_boolean(&args[0])?;
            Ok(if condition {
                args[1].clone()
            } else {
                args[2].clone()
            })
        }));
        
        // AND function
        self.register("AND", Box::new(|args| {
            if args.is_empty() {
                return Err(SpreadsheetError::InvalidArguments(
                    "AND requires at least 1 argument".to_string()
                ));
            }
            
            for arg in args {
                if !coerce_to_boolean(arg)? {
                    return Ok(CellValue::Boolean(false));
                }
            }
            Ok(CellValue::Boolean(true))
        }));
        
        // OR function
        self.register("OR", Box::new(|args| {
            if args.is_empty() {
                return Err(SpreadsheetError::InvalidArguments(
                    "OR requires at least 1 argument".to_string()
                ));
            }
            
            for arg in args {
                if coerce_to_boolean(arg)? {
                    return Ok(CellValue::Boolean(true));
                }
            }
            Ok(CellValue::Boolean(false))
        }));
        
        // NOT function
        self.register("NOT", Box::new(|args| {
            if args.len() != 1 {
                return Err(SpreadsheetError::InvalidArguments(
                    "NOT requires exactly 1 argument".to_string()
                ));
            }
            
            let value = coerce_to_boolean(&args[0])?;
            Ok(CellValue::Boolean(!value))
        }));
    }
}

/// Extract numbers from a cell value (including arrays)
fn extract_numbers(value: &CellValue) -> Result<Vec<f64>> {
    match value {
        CellValue::Number(n) => Ok(vec![*n]),
        CellValue::Array(arr) => {
            let mut numbers = Vec::new();
            for val in arr {
                if let Ok(n) = coerce_to_number(val) {
                    numbers.push(n);
                }
                // Skip non-numeric values
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