use crate::benchmark::{BenchmarkMetrics, BenchmarkResult, BenchmarkScenario};
use crate::demo::data_generator::DataGenerator;
use gridcore_controller::controller::SpreadsheetController;
use gridcore_controller::state::{Action, ViewportInfo};
use gridcore_core::types::CellAddress;
use std::cell::RefCell;
use std::rc::Rc;

/// Benchmark smooth scrolling performance
pub struct SmoothScrollBenchmark {
    data_generator: DataGenerator,
    scroll_distance: u32,
    scroll_steps: usize,
}

impl SmoothScrollBenchmark {
    pub fn new() -> Self {
        Self {
            data_generator: DataGenerator::new(),
            scroll_distance: 100, // Scroll 100 rows
            scroll_steps: 20,     // In 20 steps
        }
    }
}

impl BenchmarkScenario for SmoothScrollBenchmark {
    fn name(&self) -> &str {
        "Smooth Scroll Performance"
    }
    
    fn description(&self) -> &str {
        "Measures FPS and latency during smooth vertical scrolling"
    }
    
    fn warmup(&mut self, controller: Rc<RefCell<SpreadsheetController>>) {
        let mut ctrl = controller.borrow_mut();
        let facade = ctrl.get_facade();
        
        // Generate test data
        let data = self.data_generator.generate_numeric_grid(100, 50, 0.0, 1000.0);
        for (addr, value) in data {
            let _ = facade.set_cell_value(&addr, &value.to_string());
        }
        
        // Reset viewport to top
        let _ = ctrl.dispatch_action(Action::UpdateViewport { 
            viewport: ViewportInfo {
                start_row: 0,
                start_col: 0,
                rows: 20,
                cols: 10,
            }
        });
    }
    
    fn run(&mut self, controller: Rc<RefCell<SpreadsheetController>>) -> BenchmarkResult {
        let mut metrics = BenchmarkMetrics::new();
        metrics.start_time = Self::now();
        
        let step_size = self.scroll_distance / self.scroll_steps as u32;
        let mut ctrl = controller.borrow_mut();
        
        // Perform smooth scroll
        for i in 0..self.scroll_steps {
            let frame_start = Self::now();
            
            // Update viewport
            let new_top = (i as u32 + 1) * step_size;
            let _ = ctrl.dispatch_action(Action::UpdateViewport { 
                viewport: ViewportInfo {
                    start_row: new_top,
                    start_col: 0,
                    rows: 20,
                    cols: 10,
                }
            });
            
            // Simulate frame render time
            let frame_end = Self::now();
            let frame_time = frame_end - frame_start;
            metrics.frame_times.push(frame_time);
            
            // Custom metric: rows scrolled per second
            metrics.custom_metrics.insert(
                "rows_per_second".to_string(),
                (step_size as f64 * 1000.0) / frame_time
            );
        }
        
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
        let mut ctrl = controller.borrow_mut();
        // Clear all cells
        let facade = ctrl.get_facade();
        // TODO: Implement clear_sheet or clear all cells individually
        // For now, just get all cells and delete them
        let cells = facade.get_all_cells();
        for (addr, _) in cells {
            let _ = facade.delete_cell(&addr);
        }
        
        // Reset viewport
        let _ = ctrl.dispatch_action(Action::UpdateViewport { 
            viewport: ViewportInfo {
                start_row: 0,
                start_col: 0,
                rows: 20,
                cols: 10,
            }
        });
    }
}

/// Benchmark jump navigation performance
pub struct JumpNavigationBenchmark {
    data_generator: DataGenerator,
    jump_positions: Vec<(u32, u32)>,
}

impl JumpNavigationBenchmark {
    pub fn new() -> Self {
        Self {
            data_generator: DataGenerator::new(),
            jump_positions: vec![
                (0, 0),       // Home
                (1000, 100),  // Far position
                (500, 50),    // Middle
                (9999, 255),  // Near max
                (0, 0),       // Back to home
            ],
        }
    }
}

impl BenchmarkScenario for JumpNavigationBenchmark {
    fn name(&self) -> &str {
        "Jump Navigation Performance"
    }
    
    fn description(&self) -> &str {
        "Measures viewport update time for large position jumps"
    }
    
    fn warmup(&mut self, controller: Rc<RefCell<SpreadsheetController>>) {
        let mut ctrl = controller.borrow_mut();
        let facade = ctrl.get_facade();
        
        // Generate sparse data across large area
        let data = self.data_generator.generate_sparse_data(10000, 256, 0.01); // 1% density
        for (addr, value) in data {
            let _ = facade.set_cell_value(&addr, &value);
        }
    }
    
    fn run(&mut self, controller: Rc<RefCell<SpreadsheetController>>) -> BenchmarkResult {
        let mut metrics = BenchmarkMetrics::new();
        metrics.start_time = Self::now();
        
        let mut ctrl = controller.borrow_mut();
        
        // Perform jumps
        for (row, col) in &self.jump_positions {
            let jump_start = Self::now();
            
            // Jump to position
            let _ = ctrl.dispatch_action(Action::UpdateViewport { 
                viewport: ViewportInfo {
                    start_row: *row,
                    start_col: *col,
                    rows: 20,
                    cols: 10,
                }
            });
            
            // Also update cursor to ensure cell is in view
            let _ = ctrl.dispatch_action(Action::UpdateCursor {
                cursor: CellAddress::new(*col, *row),
            });
            
            let jump_end = Self::now();
            let jump_time = jump_end - jump_start;
            
            metrics.interaction_latencies.push(jump_time);
            
            // Track jump distance as custom metric
            if !metrics.frame_times.is_empty() {
                let prev_pos = metrics.custom_metrics.get("last_row").unwrap_or(&0.0);
                let distance = (*row as f64 - prev_pos).abs();
                metrics.custom_metrics.insert("max_jump_distance".to_string(), distance);
            }
            metrics.custom_metrics.insert("last_row".to_string(), *row as f64);
        }
        
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
        let mut ctrl = controller.borrow_mut();
        let facade = ctrl.get_facade();
        // TODO: Implement clear_sheet or clear all cells individually
        let cells = facade.get_all_cells();
        for (addr, _) in cells {
            let _ = facade.delete_cell(&addr);
        }
        
        let _ = ctrl.dispatch_action(Action::UpdateViewport { 
            viewport: ViewportInfo {
                start_row: 0,
                start_col: 0,
                rows: 20,
                cols: 10,
            }
        });
    }
}

/// Benchmark scrolling with large dataset
pub struct LargeDatasetScrollBenchmark {
    data_generator: DataGenerator,
    dataset_size: (u32, u32), // (rows, cols)
}

impl LargeDatasetScrollBenchmark {
    pub fn new() -> Self {
        Self {
            data_generator: DataGenerator::new(),
            dataset_size: (100_000, 100),
        }
    }
}

impl BenchmarkScenario for LargeDatasetScrollBenchmark {
    fn name(&self) -> &str {
        "Large Dataset Scroll"
    }
    
    fn description(&self) -> &str {
        "Measures scrolling performance with 100K rows of data"
    }
    
    fn warmup(&mut self, controller: Rc<RefCell<SpreadsheetController>>) {
        let mut ctrl = controller.borrow_mut();
        let facade = ctrl.get_facade();
        
        // Generate large dataset (sparse to avoid memory issues)
        leptos::logging::log!("Generating large dataset: {}x{}", self.dataset_size.0, self.dataset_size.1);
        let data = self.data_generator.generate_sparse_data(
            self.dataset_size.0, 
            self.dataset_size.1, 
            0.001 // 0.1% density
        );
        
        for (addr, value) in data {
            let _ = facade.set_cell_value(&addr, &value);
        }
        
        leptos::logging::log!("Large dataset generated, {} cells", facade.cell_count());
    }
    
    fn run(&mut self, controller: Rc<RefCell<SpreadsheetController>>) -> BenchmarkResult {
        let mut metrics = BenchmarkMetrics::new();
        metrics.start_time = Self::now();
        
        let mut ctrl = controller.borrow_mut();
        
        // Test different scroll patterns
        let scroll_patterns = vec![
            ("sequential", vec![100, 200, 300, 400, 500]),
            ("random", vec![5000, 100, 8000, 2000, 50000]),
            ("page_down", vec![20, 40, 60, 80, 100]),
        ];
        
        for (pattern_name, positions) in scroll_patterns {
            for row in positions {
                let scroll_start = Self::now();
                
                let _ = ctrl.dispatch_action(Action::UpdateViewport { 
                    viewport: ViewportInfo {
                        start_row: row,
                        start_col: 0,
                        rows: 20,
                        cols: 10,
                    }
                });
                
                let scroll_end = Self::now();
                let scroll_time = scroll_end - scroll_start;
                
                metrics.frame_times.push(scroll_time);
                metrics.custom_metrics.insert(
                    format!("{}_avg_ms", pattern_name),
                    scroll_time
                );
            }
        }
        
        // Get cell count for reference
        let facade = ctrl.get_facade();
        metrics.cells_rendered = facade.cell_count() as u32;
        
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
        let mut ctrl = controller.borrow_mut();
        let facade = ctrl.get_facade();
        // TODO: Implement clear_sheet or clear all cells individually
        let cells = facade.get_all_cells();
        for (addr, _) in cells {
            let _ = facade.delete_cell(&addr);
        }
        
        let _ = ctrl.dispatch_action(Action::UpdateViewport { 
            viewport: ViewportInfo {
                start_row: 0,
                start_col: 0,
                rows: 20,
                cols: 10,
            }
        });
    }
}

impl SmoothScrollBenchmark {
    fn now() -> f64 {
        web_sys::window()
            .and_then(|w| w.performance())
            .map(|p| p.now())
            .unwrap_or(0.0)
    }
}

impl JumpNavigationBenchmark {
    fn now() -> f64 {
        web_sys::window()
            .and_then(|w| w.performance())
            .map(|p| p.now())
            .unwrap_or(0.0)
    }
}

impl LargeDatasetScrollBenchmark {
    fn now() -> f64 {
        web_sys::window()
            .and_then(|w| w.performance())
            .map(|p| p.now())
            .unwrap_or(0.0)
    }
}