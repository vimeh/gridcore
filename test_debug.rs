use gridcore_core::references::{ReferenceAdjuster, StructuralOperation};

fn main() {
    let adjuster = ReferenceAdjuster::new();
    let operation = StructuralOperation::InsertRows {
        before_row: 5,
        count: 2,
    };
    
    let formula = "=$A$5+$B$10+C3";
    let adjusted = adjuster.adjust_formula(formula, &operation).unwrap();
    
    println\!("Original: {}", formula);
    println\!("Adjusted: {}", adjusted);
    println\!("Contains $A$7: {}", adjusted.contains("$A$7"));
    println\!("Contains $B$12: {}", adjusted.contains("$B$12"));
}
