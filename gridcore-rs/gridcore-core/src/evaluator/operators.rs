use crate::formula::ast::{BinaryOperator, UnaryOperator};
use crate::types::{CellValue, ErrorType};
use crate::{Result, SpreadsheetError};

/// Apply a unary operator to a value
pub fn apply_unary(op: &UnaryOperator, value: CellValue) -> Result<CellValue> {
    // Check for errors first and propagate them
    if let CellValue::Error(e) = value {
        return Ok(CellValue::Error(e));
    }

    match op {
        UnaryOperator::Negate => match coerce_to_number(&value) {
            Ok(n) => Ok(CellValue::Number(-n)),
            Err(_) => Ok(CellValue::from_error(ErrorType::ValueError {
                expected: "number".to_string(),
                actual: value.type_name().to_string(),
            })),
        },
        UnaryOperator::Percent => match coerce_to_number(&value) {
            Ok(n) => Ok(CellValue::Number(n / 100.0)),
            Err(_) => Ok(CellValue::from_error(ErrorType::ValueError {
                expected: "number".to_string(),
                actual: value.type_name().to_string(),
            })),
        },
    }
}

/// Apply a binary operator to two values
pub fn apply_binary(op: &BinaryOperator, left: CellValue, right: CellValue) -> Result<CellValue> {
    match op {
        // Arithmetic operators
        BinaryOperator::Add => add_values(left, right),
        BinaryOperator::Subtract => subtract_values(left, right),
        BinaryOperator::Multiply => multiply_values(left, right),
        BinaryOperator::Divide => divide_values(left, right),
        BinaryOperator::Power => power_values(left, right),

        // Comparison operators
        BinaryOperator::Equal => Ok(CellValue::Boolean(values_equal(&left, &right))),
        BinaryOperator::NotEqual => Ok(CellValue::Boolean(!values_equal(&left, &right))),
        BinaryOperator::LessThan => compare_values(left, right, |cmp| cmp < 0),
        BinaryOperator::LessThanOrEqual => compare_values(left, right, |cmp| cmp <= 0),
        BinaryOperator::GreaterThan => compare_values(left, right, |cmp| cmp > 0),
        BinaryOperator::GreaterThanOrEqual => compare_values(left, right, |cmp| cmp >= 0),

        // String concatenation
        BinaryOperator::Concat => concatenate_values(left, right),
    }
}

/// Add two values (with type coercion)
fn add_values(left: CellValue, right: CellValue) -> Result<CellValue> {
    // Check for errors first and propagate them
    if let CellValue::Error(e) = left {
        return Ok(CellValue::Error(e));
    }
    if let CellValue::Error(e) = right {
        return Ok(CellValue::Error(e));
    }

    // Try numeric addition first
    if let (Ok(l), Ok(r)) = (coerce_to_number(&left), coerce_to_number(&right)) {
        return Ok(CellValue::Number(l + r));
    }

    // If either is a string, concatenate
    if matches!(left, CellValue::String(_)) || matches!(right, CellValue::String(_)) {
        return concatenate_values(left, right);
    }

    // Return #VALUE! error for type mismatch
    Ok(CellValue::from_error(ErrorType::ValueError {
        expected: "compatible types".to_string(),
        actual: "incompatible types".to_string(),
    }))
}

/// Subtract two values
fn subtract_values(left: CellValue, right: CellValue) -> Result<CellValue> {
    // Check for errors first and propagate them
    if let CellValue::Error(e) = left {
        return Ok(CellValue::Error(e));
    }
    if let CellValue::Error(e) = right {
        return Ok(CellValue::Error(e));
    }

    let l = match coerce_to_number(&left) {
        Ok(n) => n,
        Err(_) => {
            return Ok(CellValue::from_error(ErrorType::ValueError {
                expected: "compatible types".to_string(),
                actual: "incompatible types".to_string(),
            }));
        }
    };

    let r = match coerce_to_number(&right) {
        Ok(n) => n,
        Err(_) => {
            return Ok(CellValue::from_error(ErrorType::ValueError {
                expected: "compatible types".to_string(),
                actual: "incompatible types".to_string(),
            }));
        }
    };

    Ok(CellValue::Number(l - r))
}

/// Multiply two values
fn multiply_values(left: CellValue, right: CellValue) -> Result<CellValue> {
    // Check for errors first and propagate them
    if let CellValue::Error(e) = left {
        return Ok(CellValue::Error(e));
    }
    if let CellValue::Error(e) = right {
        return Ok(CellValue::Error(e));
    }

    let l = match coerce_to_number(&left) {
        Ok(n) => n,
        Err(_) => {
            return Ok(CellValue::from_error(ErrorType::ValueError {
                expected: "compatible types".to_string(),
                actual: "incompatible types".to_string(),
            }));
        }
    };

    let r = match coerce_to_number(&right) {
        Ok(n) => n,
        Err(_) => {
            return Ok(CellValue::from_error(ErrorType::ValueError {
                expected: "compatible types".to_string(),
                actual: "incompatible types".to_string(),
            }));
        }
    };

    Ok(CellValue::Number(l * r))
}

/// Divide two values
fn divide_values(left: CellValue, right: CellValue) -> Result<CellValue> {
    // Check for errors first
    if matches!(left, CellValue::Error(_)) {
        return Ok(left);
    }
    if matches!(right, CellValue::Error(_)) {
        return Ok(right.clone());
    }

    // Handle array division - check for zeros and errors in the array
    if let CellValue::Array(arr) = &right {
        // Check if any value in the array is zero or would cause an error
        for val in arr.iter() {
            if let CellValue::Error(e) = val {
                return Ok(CellValue::Error(e.clone()));
            }
            match coerce_to_number(val) {
                Ok(0.0) => {
                    // Division by zero found in array
                    return Ok(CellValue::from_error(ErrorType::DivideByZero));
                }
                Err(_) => {
                    // Type error in array
                    return Ok(CellValue::from_error(ErrorType::ValueError {
                        expected: "compatible types".to_string(),
                        actual: "incompatible types".to_string(),
                    }));
                }
                _ => {}
            }
        }
        // If we have an array on the right, we can't perform scalar division
        // But we should return a VALUE error, not throw
        return Ok(CellValue::from_error(ErrorType::ValueError {
            expected: "compatible types".to_string(),
            actual: "incompatible types".to_string(),
        }));
    }

    let l = match coerce_to_number(&left) {
        Ok(n) => n,
        Err(_) => {
            return Ok(CellValue::from_error(ErrorType::ValueError {
                expected: "compatible types".to_string(),
                actual: "incompatible types".to_string(),
            }));
        }
    };

    let r = match coerce_to_number(&right) {
        Ok(n) => n,
        Err(_) => {
            return Ok(CellValue::from_error(ErrorType::ValueError {
                expected: "compatible types".to_string(),
                actual: "incompatible types".to_string(),
            }));
        }
    };

    if r == 0.0 {
        return Ok(CellValue::from_error(ErrorType::DivideByZero));
    }

    Ok(CellValue::Number(l / r))
}

/// Raise left to the power of right
fn power_values(left: CellValue, right: CellValue) -> Result<CellValue> {
    // Check for errors first and propagate them
    if let CellValue::Error(e) = left {
        return Ok(CellValue::Error(e));
    }
    if let CellValue::Error(e) = right {
        return Ok(CellValue::Error(e));
    }

    let l = match coerce_to_number(&left) {
        Ok(n) => n,
        Err(_) => {
            return Ok(CellValue::from_error(ErrorType::ValueError {
                expected: "compatible types".to_string(),
                actual: "incompatible types".to_string(),
            }));
        }
    };

    let r = match coerce_to_number(&right) {
        Ok(n) => n,
        Err(_) => {
            return Ok(CellValue::from_error(ErrorType::ValueError {
                expected: "compatible types".to_string(),
                actual: "incompatible types".to_string(),
            }));
        }
    };

    // Check for invalid power operations that result in NaN or infinite
    let result = l.powf(r);
    if result.is_nan() || result.is_infinite() {
        return Ok(CellValue::from_error(ErrorType::NumError));
    }

    Ok(CellValue::Number(result))
}

/// Concatenate two values as strings
fn concatenate_values(left: CellValue, right: CellValue) -> Result<CellValue> {
    let l = coerce_to_string(&left);
    let r = coerce_to_string(&right);
    Ok(CellValue::from_string(format!("{}{}", l, r)))
}

/// Compare two values
fn compare_values<F>(left: CellValue, right: CellValue, op: F) -> Result<CellValue>
where
    F: FnOnce(i32) -> bool,
{
    let cmp = compare_cell_values(&left, &right);
    Ok(CellValue::Boolean(op(cmp)))
}

/// Check if two values are equal
fn values_equal(left: &CellValue, right: &CellValue) -> bool {
    match (left, right) {
        (CellValue::Empty, CellValue::Empty) => true,
        (CellValue::Number(l), CellValue::Number(r)) => (l - r).abs() < f64::EPSILON,
        (CellValue::String(l), CellValue::String(r)) => l == r,
        (CellValue::Boolean(l), CellValue::Boolean(r)) => l == r,
        (CellValue::Error(l), CellValue::Error(r)) => l == r,
        _ => false,
    }
}

/// Compare two cell values, returning -1, 0, or 1
fn compare_cell_values(left: &CellValue, right: &CellValue) -> i32 {
    match (left, right) {
        // Numbers
        (CellValue::Number(l), CellValue::Number(r)) => {
            if l < r {
                -1
            } else if l > r {
                1
            } else {
                0
            }
        }

        // Strings
        (CellValue::String(l), CellValue::String(r)) => {
            if l < r {
                -1
            } else if l > r {
                1
            } else {
                0
            }
        }

        // Booleans (false < true)
        (CellValue::Boolean(l), CellValue::Boolean(r)) => {
            if !l && *r {
                -1
            } else if *l && !r {
                1
            } else {
                0
            }
        }

        // Empty is less than everything except empty
        (CellValue::Empty, CellValue::Empty) => 0,
        (CellValue::Empty, _) => -1,
        (_, CellValue::Empty) => 1,

        // Try to coerce to numbers for comparison
        _ => {
            if let (Ok(l), Ok(r)) = (coerce_to_number(left), coerce_to_number(right)) {
                if l < r {
                    -1
                } else if l > r {
                    1
                } else {
                    0
                }
            } else {
                // Fall back to string comparison
                let l = coerce_to_string(left);
                let r = coerce_to_string(right);
                if l < r {
                    -1
                } else if l > r {
                    1
                } else {
                    0
                }
            }
        }
    }
}

/// Try to coerce a value to a number
pub fn coerce_to_number(value: &CellValue) -> Result<f64> {
    match value {
        CellValue::Number(n) => Ok(*n),
        CellValue::Boolean(b) => Ok(if *b { 1.0 } else { 0.0 }),
        CellValue::String(s) => s
            .parse::<f64>()
            .map_err(|_| SpreadsheetError::TypeError(format!("Cannot convert '{}' to number", s))),
        CellValue::Empty => Ok(0.0),
        CellValue::Error(e) => Err(SpreadsheetError::FormulaError(e.to_string())),
        CellValue::Array(_) => Err(SpreadsheetError::TypeError(
            "Cannot convert array to number".to_string(),
        )),
    }
}

/// Coerce a value to a string
pub fn coerce_to_string(value: &CellValue) -> String {
    match value {
        CellValue::String(s) => s.as_ref().clone(),
        CellValue::Number(n) => {
            // Format number nicely (remove unnecessary decimals)
            if n.fract() == 0.0 && n.abs() < 1e10 {
                format!("{:.0}", n)
            } else {
                format!("{}", n)
            }
        }
        CellValue::Boolean(b) => {
            if *b {
                "TRUE".to_string()
            } else {
                "FALSE".to_string()
            }
        }
        CellValue::Empty => String::new(),
        CellValue::Error(e) => format!("#{}!", e),
        CellValue::Array(arr) => format!("{:?}", arr), // For debugging
    }
}

/// Coerce a value to a boolean
pub fn coerce_to_boolean(value: &CellValue) -> Result<bool> {
    match value {
        CellValue::Boolean(b) => Ok(*b),
        CellValue::Number(n) => Ok(*n != 0.0),
        CellValue::String(s) => {
            let s = s.to_uppercase();
            if s == "TRUE" {
                Ok(true)
            } else if s == "FALSE" {
                Ok(false)
            } else {
                Err(SpreadsheetError::TypeError(format!(
                    "Cannot convert '{}' to boolean",
                    s
                )))
            }
        }
        CellValue::Empty => Ok(false),
        CellValue::Error(e) => Err(SpreadsheetError::FormulaError(e.to_string())),
        CellValue::Array(_) => Err(SpreadsheetError::TypeError(
            "Cannot convert array to boolean".to_string(),
        )),
    }
}
