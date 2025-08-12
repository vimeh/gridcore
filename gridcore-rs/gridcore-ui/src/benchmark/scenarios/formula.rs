use crate::benchmark::{BenchmarkMetrics, BenchmarkResult, BenchmarkScenario};
use gridcore_controller::controller::SpreadsheetController;
use gridcore_core::types::CellAddress;
use std::cell::RefCell;
use std::rc::Rc;

/// Benchmark simple formula calculations
pub struct SimpleFormulaBenchmark {
    formula_count: u32,
}

impl SimpleFormulaBenchmark {
    pub fn new() -> Self {
        Self {
            formula_count: 100,
        }
    }
}

impl BenchmarkScenario for SimpleFormulaBenchmark {
    fn name(&self) -> &str {
        "Simple Formula Performance"
    }
    
    fn description(&self) -> &str {
        "Measures performance of simple formula calculations"
    }
    
    fn warmup(&mut self, controller: Rc<RefCell<SpreadsheetController>>) {
        // Clear any existing data
        let ctrl = controller.borrow();
        let facade = ctrl.get_facade();
        let cells = facade.get_all_cells();
        for (addr, _) in cells {
            let _ = facade.delete_cell(&addr);
        }
    }
    
    fn run(&mut self, controller: Rc<RefCell<SpreadsheetController>>) -> BenchmarkResult {
        let mut metrics = BenchmarkMetrics::new();
        metrics.start_time = Self::now();
        
        let ctrl = controller.borrow();
        let facade = ctrl.get_facade();
        
        // Create base data
        let data_start = Self::now();
        for i in 0..self.formula_count {
            let addr = CellAddress::new(0, i);
            let _ = facade.set_cell_value(&addr, &format!("{}", i + 1));
        }
        let data_time = Self::now() - data_start;
        
        // Test arithmetic formulas
        let arithmetic_start = Self::now();
        for i in 0..self.formula_count {
            let addr = CellAddress::new(1, i);
            let formula = format!("=A{}*2+1", i + 1);
            let _ = facade.set_cell_value(&addr, &formula);
        }
        let arithmetic_time = Self::now() - arithmetic_start;
        
        // Test SUM formulas
        let sum_start = Self::now();
        for i in 0..10 {
            let addr = CellAddress::new(2, i);
            let formula = format!("=SUM(A{}:A{})", i * 10 + 1, (i + 1) * 10);
            let _ = facade.set_cell_value(&addr, &formula);
        }
        let sum_time = Self::now() - sum_start;
        
        // Test references
        let ref_start = Self::now();
        for i in 0..self.formula_count {
            let addr = CellAddress::new(3, i);
            let formula = format!("=B{}", i + 1);
            let _ = facade.set_cell_value(&addr, &formula);
        }
        let ref_time = Self::now() - ref_start;
        
        // Force recalculation
        let recalc_start = Self::now();
        let _ = facade.recalculate();
        let recalc_time = Self::now() - recalc_start;
        
        // Update a base cell to trigger dependency recalc
        let update_start = Self::now();
        let _ = facade.set_cell_value(&CellAddress::new(0, 0), "100");
        let update_time = Self::now() - update_start;
        
        // Store metrics
        metrics.custom_metrics.insert("data_setup_ms".to_string(), data_time);
        metrics.custom_metrics.insert("arithmetic_formulas_ms".to_string(), arithmetic_time);
        metrics.custom_metrics.insert("sum_formulas_ms".to_string(), sum_time);
        metrics.custom_metrics.insert("reference_formulas_ms".to_string(), ref_time);
        metrics.custom_metrics.insert("recalculation_ms".to_string(), recalc_time);
        metrics.custom_metrics.insert("dependency_update_ms".to_string(), update_time);
        
        metrics.formulas_calculated = (self.formula_count * 2 + 10) as u32;
        metrics.cells_updated = self.formula_count;
        
        metrics.end_time = Self::now();
        metrics.finalize();
        
        BenchmarkResult {
            scenario_name: self.name().to_string(),
            iteration: 1,
            metrics,
            success: true,
            error_message: None,
        }
    }
    
    fn cleanup(&mut self, controller: Rc<RefCell<SpreadsheetController>>) {
        let ctrl = controller.borrow();
        let facade = ctrl.get_facade();
        let cells = facade.get_all_cells();
        for (addr, _) in cells {
            let _ = facade.delete_cell(&addr);
        }
    }
}

/// Benchmark complex formula calculations with dependencies
pub struct ComplexFormulaBenchmark {
    chain_length: u32,
    #[allow(dead_code)]
    branch_factor: u32,
}

impl ComplexFormulaBenchmark {
    pub fn new() -> Self {
        Self {
            chain_length: 10,
            branch_factor: 3,
        }
    }
}

impl BenchmarkScenario for ComplexFormulaBenchmark {
    fn name(&self) -> &str {
        "Complex Formula Performance"
    }
    
    fn description(&self) -> &str {
        "Measures performance of complex formula dependency chains"
    }
    
    fn warmup(&mut self, controller: Rc<RefCell<SpreadsheetController>>) {
        let ctrl = controller.borrow();
        let facade = ctrl.get_facade();
        let cells = facade.get_all_cells();
        for (addr, _) in cells {
            let _ = facade.delete_cell(&addr);
        }
    }
    
    fn run(&mut self, controller: Rc<RefCell<SpreadsheetController>>) -> BenchmarkResult {
        let mut metrics = BenchmarkMetrics::new();
        metrics.start_time = Self::now();
        
        let ctrl = controller.borrow();
        let facade = ctrl.get_facade();
        
        // Create base data grid
        let base_start = Self::now();
        for row in 0..20 {
            for col in 0..10 {
                let addr = CellAddress::new(col, row);
                let value = (row * 10 + col + 1) as f64;
                let _ = facade.set_cell_value(&addr, &value.to_string());
            }
        }
        let base_time = Self::now() - base_start;
        
        // Create dependency chain
        let chain_start = Self::now();
        let mut formula_count = 0;
        
        // Level 1: Direct references
        for i in 0..self.chain_length {
            let addr = CellAddress::new(11, i);
            let formula = format!("=SUM(A{}:J{})", i + 1, i + 1);
            let _ = facade.set_cell_value(&addr, &formula);
            formula_count += 1;
        }
        
        // Level 2: References to level 1
        for i in 0..self.chain_length {
            let addr = CellAddress::new(12, i);
            let formula = format!("=L{}*2", i + 1);
            let _ = facade.set_cell_value(&addr, &formula);
            formula_count += 1;
        }
        
        // Level 3: Complex combinations
        for i in 0..self.chain_length {
            let addr = CellAddress::new(13, i);
            let formula = if i > 0 {
                format!("=M{}+M{}", i, i + 1)
            } else {
                "=M1".to_string()
            };
            let _ = facade.set_cell_value(&addr, &formula);
            formula_count += 1;
        }
        
        let chain_time = Self::now() - chain_start;
        
        // Create nested formulas
        let nested_start = Self::now();
        for i in 0..5 {
            let addr = CellAddress::new(14, i);
            let formula = format!(
                "=IF(A{}>5,SUM(B{}:D{}),AVERAGE(E{}:G{}))",
                i + 1, i + 1, i + 1, i + 1, i + 1
            );
            let _ = facade.set_cell_value(&addr, &formula);
            formula_count += 1;
        }
        let nested_time = Self::now() - nested_start;
        
        // Force full recalculation
        let recalc_start = Self::now();
        let _ = facade.recalculate();
        let recalc_time = Self::now() - recalc_start;
        
        // Update root cell to trigger cascade
        let cascade_start = Self::now();
        let _ = facade.set_cell_value(&CellAddress::new(0, 0), "999");
        let cascade_time = Self::now() - cascade_start;
        
        // Test circular reference detection
        let circular_start = Self::now();
        let _ = facade.set_cell_value(&CellAddress::new(15, 0), "=P2");
        let _ = facade.set_cell_value(&CellAddress::new(15, 1), "=P1");
        let circular_time = Self::now() - circular_start;
        
        // Store metrics
        metrics.custom_metrics.insert("base_data_ms".to_string(), base_time);
        metrics.custom_metrics.insert("dependency_chain_ms".to_string(), chain_time);
        metrics.custom_metrics.insert("nested_formulas_ms".to_string(), nested_time);
        metrics.custom_metrics.insert("full_recalc_ms".to_string(), recalc_time);
        metrics.custom_metrics.insert("cascade_update_ms".to_string(), cascade_time);
        metrics.custom_metrics.insert("circular_detection_ms".to_string(), circular_time);
        
        metrics.formulas_calculated = formula_count;
        metrics.cells_updated = 200; // Base grid
        
        metrics.end_time = Self::now();
        metrics.finalize();
        
        BenchmarkResult {
            scenario_name: self.name().to_string(),
            iteration: 1,
            metrics,
            success: true,
            error_message: None,
        }
    }
    
    fn cleanup(&mut self, controller: Rc<RefCell<SpreadsheetController>>) {
        let ctrl = controller.borrow();
        let facade = ctrl.get_facade();
        let cells = facade.get_all_cells();
        for (addr, _) in cells {
            let _ = facade.delete_cell(&addr);
        }
    }
}

// Helper functions
impl SimpleFormulaBenchmark {
    fn now() -> f64 {
        web_sys::window()
            .and_then(|w| w.performance())
            .map(|p| p.now())
            .unwrap_or(0.0)
    }
}

impl ComplexFormulaBenchmark {
    fn now() -> f64 {
        web_sys::window()
            .and_then(|w| w.performance())
            .map(|p| p.now())
            .unwrap_or(0.0)
    }
}