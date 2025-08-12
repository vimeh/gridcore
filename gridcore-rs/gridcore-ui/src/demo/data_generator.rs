use gridcore_core::types::CellAddress;
use rand::prelude::*;

pub struct DataGenerator {
    rng: StdRng,
}

impl Default for DataGenerator {
    fn default() -> Self {
        Self::new()
    }
}

impl DataGenerator {
    pub fn new() -> Self {
        Self {
            rng: StdRng::from_entropy(),
        }
    }

    pub fn with_seed(seed: u64) -> Self {
        Self {
            rng: StdRng::seed_from_u64(seed),
        }
    }

    /// Generate a simple numeric dataset
    pub fn generate_numeric_grid(
        &mut self,
        rows: u32,
        cols: u32,
        min: f64,
        max: f64,
    ) -> Vec<(CellAddress, String)> {
        let mut data = Vec::new();
        for row in 0..rows {
            for col in 0..cols {
                let value = self.rng.gen_range(min..=max);
                data.push((CellAddress::new(col, row), format!("{:.2}", value)));
            }
        }
        data
    }

    /// Generate a financial dataset (income statement style)
    #[allow(clippy::vec_init_then_push)]
    pub fn generate_financial_data(&mut self) -> Vec<(CellAddress, String)> {
        let mut data = Vec::new();

        // Headers
        data.push((CellAddress::new(0, 0), "Income Statement".to_string()));
        data.push((CellAddress::new(0, 1), "Item".to_string()));
        data.push((CellAddress::new(1, 1), "Q1".to_string()));
        data.push((CellAddress::new(2, 1), "Q2".to_string()));
        data.push((CellAddress::new(3, 1), "Q3".to_string()));
        data.push((CellAddress::new(4, 1), "Q4".to_string()));
        data.push((CellAddress::new(5, 1), "Total".to_string()));

        // Revenue items
        let items = vec![
            ("Revenue", 100000.0, 150000.0),
            ("Cost of Goods Sold", -40000.0, -60000.0),
            ("Operating Expenses", -20000.0, -30000.0),
            ("Marketing", -5000.0, -10000.0),
            ("R&D", -10000.0, -20000.0),
        ];

        let mut row = 2;
        for (name, min, max) in items {
            data.push((CellAddress::new(0, row), name.to_string()));

            // Generate quarterly values
            for quarter in 1..=4 {
                let value = self.rng.gen_range(min..=max);
                data.push((CellAddress::new(quarter, row), format!("{:.2}", value)));
            }

            // Total formula
            data.push((
                CellAddress::new(5, row),
                format!("=SUM(B{}:E{})", row + 1, row + 1),
            ));

            row += 1;
        }

        // Gross Profit row
        data.push((CellAddress::new(0, row), "Gross Profit".to_string()));
        data.push((CellAddress::new(1, row), "=B3+B4".to_string()));
        data.push((CellAddress::new(2, row), "=C3+C4".to_string()));
        data.push((CellAddress::new(3, row), "=D3+D4".to_string()));
        data.push((CellAddress::new(4, row), "=E3+E4".to_string()));
        data.push((
            CellAddress::new(5, row),
            format!("=SUM(B{}:E{})", row + 1, row + 1),
        ));

        data
    }

    /// Generate scientific data with formulas
    #[allow(clippy::vec_init_then_push)]
    pub fn generate_scientific_data(&mut self) -> Vec<(CellAddress, String)> {
        let mut data = Vec::new();

        // Headers
        data.push((CellAddress::new(0, 0), "Experiment Data".to_string()));
        data.push((CellAddress::new(0, 1), "Trial".to_string()));
        data.push((CellAddress::new(1, 1), "X Value".to_string()));
        data.push((CellAddress::new(2, 1), "Y Measured".to_string()));
        data.push((CellAddress::new(3, 1), "Y Predicted".to_string()));
        data.push((CellAddress::new(4, 1), "Error".to_string()));
        data.push((CellAddress::new(5, 1), "Error²".to_string()));

        // Generate experimental data
        for trial in 1..=20 {
            let row = trial + 1;
            data.push((CellAddress::new(0, row), trial.to_string()));

            let x = trial as f64 * 0.5;
            data.push((CellAddress::new(1, row), format!("{:.2}", x)));

            let y_measured = 2.5 * x + self.rng.gen_range(-2.0..=2.0);
            data.push((CellAddress::new(2, row), format!("{:.2}", y_measured)));

            // Predicted value formula (linear regression approximation)
            data.push((CellAddress::new(3, row), format!("=2.5*B{}", row + 1)));

            // Error calculation
            data.push((
                CellAddress::new(4, row),
                format!("=C{}-D{}", row + 1, row + 1),
            ));

            // Squared error
            data.push((CellAddress::new(5, row), format!("=E{}^2", row + 1)));
        }

        // Statistics row
        let stats_row = 23;
        data.push((CellAddress::new(0, stats_row), "Statistics".to_string()));
        data.push((CellAddress::new(1, stats_row), "Mean X:".to_string()));
        data.push((
            CellAddress::new(2, stats_row),
            "=AVERAGE(B3:B22)".to_string(),
        ));
        data.push((CellAddress::new(3, stats_row), "MSE:".to_string()));
        data.push((
            CellAddress::new(4, stats_row),
            "=AVERAGE(F3:F22)".to_string(),
        ));

        data
    }

    /// Generate a large dataset for performance testing
    pub fn generate_large_dataset(&mut self, size: usize) -> Vec<(CellAddress, String)> {
        let mut data = Vec::new();
        let cols = 26; // A-Z columns
        let rows = size / cols + 1;

        for row in 0..rows as u32 {
            for col in 0..cols as u32 {
                if data.len() >= size {
                    break;
                }

                // Mix of different data types
                let value = match self.rng.gen_range(0..4) {
                    0 => format!("{:.2}", self.rng.gen_range(0.0..1000.0)), // Numbers
                    1 => format!("Text-{}", row * cols as u32 + col),       // Text
                    2 if col > 0 => {
                        // Formula referencing previous cell
                        let prev_col = CellAddress::column_number_to_label(col - 1);
                        format!("={}{}*2", prev_col, row + 1)
                    }
                    _ => format!("{}", row * cols as u32 + col), // Simple integers
                };

                data.push((CellAddress::new(col, row), value));
            }
        }

        data
    }

    /// Generate data with complex formulas and dependencies
    pub fn generate_formula_stress_test(&mut self) -> Vec<(CellAddress, String)> {
        let mut data = Vec::new();

        // Create a grid of interdependent formulas
        let size = 50;

        // First, create base values
        for i in 0..size {
            data.push((CellAddress::new(0, i), format!("{}", i + 1)));
            data.push((CellAddress::new(i, 0), format!("{}", i + 1)));
        }

        // Create formulas that reference multiple cells
        for row in 1..size {
            for col in 1..size {
                let formula = match (row + col) % 5 {
                    0 => {
                        // Sum of row and column headers
                        format!(
                            "=A{}+{}1",
                            row + 1,
                            CellAddress::column_number_to_label(col)
                        )
                    }
                    1 => {
                        // Reference to diagonal cell
                        if row > 0 && col > 0 {
                            format!("={}{}*2", CellAddress::column_number_to_label(col - 1), row)
                        } else {
                            "1".to_string()
                        }
                    }
                    2 => {
                        // Conditional formula
                        format!(
                            "=IF(A{}>10, {}1*2, {}1/2)",
                            row + 1,
                            CellAddress::column_number_to_label(col),
                            CellAddress::column_number_to_label(col)
                        )
                    }
                    3 => {
                        // Sum of surrounding cells (if not on edge)
                        if row > 0 && col > 0 && row < size - 1 && col < size - 1 {
                            format!(
                                "=SUM({}{}:{}{})",
                                CellAddress::column_number_to_label(col - 1),
                                row,
                                CellAddress::column_number_to_label(col + 1),
                                row + 2
                            )
                        } else {
                            "0".to_string()
                        }
                    }
                    _ => {
                        // Average of row
                        format!(
                            "=AVERAGE(A{}:{}{})",
                            row + 1,
                            CellAddress::column_number_to_label(col),
                            row + 1
                        )
                    }
                };

                data.push((CellAddress::new(col, row), formula));
            }
        }

        data
    }

    /// Generate date sequence data
    #[allow(clippy::vec_init_then_push)]
    pub fn generate_date_sequence(&mut self) -> Vec<(CellAddress, String)> {
        let mut data = Vec::new();

        // Headers
        data.push((CellAddress::new(0, 0), "Date".to_string()));
        data.push((CellAddress::new(1, 0), "Day of Week".to_string()));
        data.push((CellAddress::new(2, 0), "Sales".to_string()));
        data.push((CellAddress::new(3, 0), "7-Day Average".to_string()));

        // Generate 30 days of data
        let _base_date = "2024-01-01";
        for day in 0..30 {
            let row = day + 1;

            // Date (simplified - just incrementing day)
            data.push((CellAddress::new(0, row), format!("2024-01-{:02}", day + 1)));

            // Day of week (simplified)
            let dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][day as usize % 7];
            data.push((CellAddress::new(1, row), dow.to_string()));

            // Sales data (higher on weekends)
            let base_sales = if day % 7 >= 5 { 1500.0 } else { 1000.0 };
            let sales = base_sales + self.rng.gen_range(-200.0..=200.0);
            data.push((CellAddress::new(2, row), format!("{:.2}", sales)));

            // 7-day moving average
            if row >= 7 {
                data.push((
                    CellAddress::new(3, row),
                    format!("=AVERAGE(C{}:C{})", row - 5, row + 1),
                ));
            }
        }

        data
    }

    /// Generate text pattern data for fill operations testing
    pub fn generate_text_patterns(&mut self) -> Vec<(CellAddress, String)> {
        let mut data = Vec::new();

        // Pattern 1: Item numbers
        for i in 0..10 {
            data.push((CellAddress::new(0, i), format!("Item {}", i + 1)));
        }

        // Pattern 2: Product codes
        for i in 0..10 {
            data.push((CellAddress::new(1, i), format!("PRD-{:04}", i * 10)));
        }

        // Pattern 3: Sequential labels
        for i in 0..10 {
            let label = (b'A' + (i as u8)) as char;
            data.push((CellAddress::new(2, i), format!("Section {}", label)));
        }

        // Pattern 4: Mixed patterns
        for i in 0..10 {
            data.push((
                CellAddress::new(3, i),
                format!("Test-{}-v{}", i + 1, (i + 1) * 2),
            ));
        }

        data
    }

    /// Generate error cases for testing error handling
    pub fn generate_error_cases(&mut self) -> Vec<(CellAddress, String)> {
        vec![
            (CellAddress::new(0, 0), "Error Cases".to_string()),
            (CellAddress::new(0, 1), "=1/0".to_string()), // DIV/0
            (CellAddress::new(0, 2), "=A999999".to_string()), // REF error
            (CellAddress::new(0, 3), "=SUM(\"text\")".to_string()), // VALUE error
            (CellAddress::new(0, 4), "=UNKNOWN()".to_string()), // NAME error
            (CellAddress::new(0, 5), "=A5".to_string()),  // Circular reference
            (
                CellAddress::new(0, 6),
                "=IF(1=1, 1/0, 0)".to_string(), // Error in formula
            ),
        ]
    }
}
