use std::collections::HashSet;
use crate::formula::ast::{Expr, CellRange};
use crate::types::CellAddress;

/// Analyzes formula ASTs to extract cell dependencies
pub struct DependencyAnalyzer;

impl DependencyAnalyzer {
    /// Extract all cell addresses referenced in a formula expression
    pub fn extract_dependencies(expr: &Expr) -> HashSet<CellAddress> {
        let mut dependencies = HashSet::new();
        Self::extract_from_expr(expr, &mut dependencies);
        dependencies
    }
    
    /// Recursively extract dependencies from an expression
    fn extract_from_expr(expr: &Expr, dependencies: &mut HashSet<CellAddress>) {
        match expr {
            Expr::Reference { address, .. } => {
                dependencies.insert(address.clone());
            }
            
            Expr::Range { range, .. } => {
                // Add all cells in the range
                for cell in range.cells() {
                    dependencies.insert(cell);
                }
            }
            
            Expr::FunctionCall { args, .. } => {
                // Recursively check all function arguments
                for arg in args {
                    Self::extract_from_expr(arg, dependencies);
                }
            }
            
            Expr::UnaryOp { expr, .. } => {
                Self::extract_from_expr(expr, dependencies);
            }
            
            Expr::BinaryOp { left, right, .. } => {
                Self::extract_from_expr(left, dependencies);
                Self::extract_from_expr(right, dependencies);
            }
            
            Expr::Literal { .. } => {
                // Literals don't have dependencies
            }
        }
    }
    
    /// Check if an expression contains any cell references
    pub fn has_dependencies(expr: &Expr) -> bool {
        match expr {
            Expr::Reference { .. } | Expr::Range { .. } => true,
            
            Expr::FunctionCall { args, .. } => {
                args.iter().any(Self::has_dependencies)
            }
            
            Expr::UnaryOp { expr, .. } => Self::has_dependencies(expr),
            
            Expr::BinaryOp { left, right, .. } => {
                Self::has_dependencies(left) || Self::has_dependencies(right)
            }
            
            Expr::Literal { .. } => false,
        }
    }
    
    /// Count the number of unique cell references in an expression
    pub fn count_dependencies(expr: &Expr) -> usize {
        Self::extract_dependencies(expr).len()
    }
    
    /// Check if an expression references a specific cell
    pub fn references_cell(expr: &Expr, target: &CellAddress) -> bool {
        match expr {
            Expr::Reference { address, .. } => address == target,
            
            Expr::Range { range, .. } => range.contains(target),
            
            Expr::FunctionCall { args, .. } => {
                args.iter().any(|arg| Self::references_cell(arg, target))
            }
            
            Expr::UnaryOp { expr, .. } => Self::references_cell(expr, target),
            
            Expr::BinaryOp { left, right, .. } => {
                Self::references_cell(left, target) || Self::references_cell(right, target)
            }
            
            Expr::Literal { .. } => false,
        }
    }
    
    /// Check if an expression references any cell in a range
    pub fn references_range(expr: &Expr, range: &CellRange) -> bool {
        let dependencies = Self::extract_dependencies(expr);
        dependencies.iter().any(|addr| range.contains(addr))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::formula::FormulaParser;
    
    #[test]
    fn test_extract_simple_reference() {
        let expr = FormulaParser::parse("A1").unwrap();
        let deps = DependencyAnalyzer::extract_dependencies(&expr);
        
        assert_eq!(deps.len(), 1);
        assert!(deps.contains(&CellAddress::new(0, 0)));
    }
    
    #[test]
    fn test_extract_multiple_references() {
        let expr = FormulaParser::parse("A1 + B2 * C3").unwrap();
        let deps = DependencyAnalyzer::extract_dependencies(&expr);
        
        assert_eq!(deps.len(), 3);
        assert!(deps.contains(&CellAddress::new(0, 0))); // A1
        assert!(deps.contains(&CellAddress::new(1, 1))); // B2
        assert!(deps.contains(&CellAddress::new(2, 2))); // C3
    }
    
    #[test]
    fn test_extract_range_dependencies() {
        let expr = FormulaParser::parse("SUM(A1:B2)").unwrap();
        let deps = DependencyAnalyzer::extract_dependencies(&expr);
        
        assert_eq!(deps.len(), 4);
        assert!(deps.contains(&CellAddress::new(0, 0))); // A1
        assert!(deps.contains(&CellAddress::new(0, 1))); // A2
        assert!(deps.contains(&CellAddress::new(1, 0))); // B1
        assert!(deps.contains(&CellAddress::new(1, 1))); // B2
    }
    
    #[test]
    fn test_no_dependencies_in_literals() {
        let expr = FormulaParser::parse("42 + 10 * 2").unwrap();
        let deps = DependencyAnalyzer::extract_dependencies(&expr);
        
        assert_eq!(deps.len(), 0);
        assert!(!DependencyAnalyzer::has_dependencies(&expr));
    }
    
    #[test]
    fn test_complex_formula_dependencies() {
        let expr = FormulaParser::parse("IF(A1>10, SUM(B1:B10), C1*2)").unwrap();
        let deps = DependencyAnalyzer::extract_dependencies(&expr);
        
        // Should have A1, B1-B10, and C1
        assert_eq!(deps.len(), 12);
        assert!(deps.contains(&CellAddress::new(0, 0))); // A1
        assert!(deps.contains(&CellAddress::new(2, 0))); // C1
        
        // Check B1-B10
        for row in 0..10 {
            assert!(deps.contains(&CellAddress::new(1, row))); // B1-B10
        }
    }
    
    #[test]
    fn test_references_cell() {
        let expr = FormulaParser::parse("A1 + B2").unwrap();
        
        assert!(DependencyAnalyzer::references_cell(&expr, &CellAddress::new(0, 0)));
        assert!(DependencyAnalyzer::references_cell(&expr, &CellAddress::new(1, 1)));
        assert!(!DependencyAnalyzer::references_cell(&expr, &CellAddress::new(2, 2)));
    }
    
    #[test]
    fn test_references_range() {
        let expr = FormulaParser::parse("A1 + C3").unwrap();
        let range = CellRange::new(
            CellAddress::new(0, 0), // A1
            CellAddress::new(1, 1), // B2
        );
        
        // A1 is in the range, so should return true
        assert!(DependencyAnalyzer::references_range(&expr, &range));
        
        let range2 = CellRange::new(
            CellAddress::new(3, 3), // D4
            CellAddress::new(4, 4), // E5
        );
        
        // Neither A1 nor C3 is in this range
        assert!(!DependencyAnalyzer::references_range(&expr, &range2));
    }
}