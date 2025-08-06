use gridcore_core::formula::FormulaParser;

fn main() {
    let formulas = vec!["A1", "A10", "A1:A10", "SUM(A1:A10)", "SUM(A1, B2, 10)"];

    for formula in formulas {
        println!("Parsing: {}", formula);
        match FormulaParser::parse(formula) {
            Ok(expr) => println!("  Success: {:?}\n", expr),
            Err(e) => println!("  Error: {}\n", e),
        }
    }
}
