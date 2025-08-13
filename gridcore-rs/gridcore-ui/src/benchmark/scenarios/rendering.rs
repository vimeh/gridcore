use crate::benchmark::{BenchmarkMetrics, BenchmarkResult, BenchmarkScenario};
use crate::demo::data_generator::DataGenerator;
use gridcore_controller::controller::SpreadsheetController;
use gridcore_controller::state::{Action, ViewportInfo};
use std::cell::RefCell;
use std::rc::Rc;

/// Benchmark initial render performance
pub struct InitialRenderBenchmark {
    data_generator: DataGenerator,
    grid_size: (u32, u32), // (rows, cols)
}

impl Default for InitialRenderBenchmark {
    fn default() -> Self {
        Self::new()
    }
}

impl InitialRenderBenchmark {
    pub fn new() -> Self {
        Self {
            data_generator: DataGenerator::new(),
            grid_size: (100, 26), // 100 rows, 26 columns
        }
    }
}

impl BenchmarkScenario for InitialRenderBenchmark {
    fn name(&self) -> &str {
        "Initial Render"
    }

    fn description(&self) -> &str {
        "Measures time to first paint and initial grid rendering"
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

        // Mark start of initial render
        let start_time = Self::now();
        metrics.start_time = start_time;

        // Generate initial data
        let data_start = Self::now();
        let data = self.data_generator.generate_numeric_grid(
            self.grid_size.0,
            self.grid_size.1,
            0.0,
            1000.0,
        );
        let data_gen_time = Self::now() - data_start;

        // Load data into spreadsheet
        let load_start = Self::now();
        let ctrl = controller.borrow();
        let facade = ctrl.get_facade();
        for (addr, value) in &data {
            let _ = facade.set_cell_value(addr, value);
        }
        let load_time = Self::now() - load_start;

        // Force viewport update to trigger render
        drop(ctrl);
        let render_start = Self::now();
        let mut ctrl = controller.borrow_mut();
        let _ = ctrl.dispatch_action(Action::UpdateViewport {
            viewport: ViewportInfo {
                start_row: 0,
                start_col: 0,
                rows: 20,
                cols: self.grid_size.1,
            },
        });
        let render_time = Self::now() - render_start;

        // Calculate total time
        metrics.end_time = Self::now();

        // Store timing metrics
        metrics
            .custom_metrics
            .insert("data_generation_ms".to_string(), data_gen_time);
        metrics
            .custom_metrics
            .insert("data_load_ms".to_string(), load_time);
        metrics
            .custom_metrics
            .insert("viewport_render_ms".to_string(), render_time);
        metrics.custom_metrics.insert(
            "time_to_interactive_ms".to_string(),
            metrics.end_time - metrics.start_time,
        );

        // Record cell count
        metrics.cells_rendered = data.len() as u32;

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

/// Benchmark large grid rendering performance
pub struct LargeGridRenderBenchmark {
    data_generator: DataGenerator,
    test_sizes: Vec<(u32, u32, &'static str)>, // (rows, cols, label)
}

impl Default for LargeGridRenderBenchmark {
    fn default() -> Self {
        Self::new()
    }
}

impl LargeGridRenderBenchmark {
    pub fn new() -> Self {
        Self {
            data_generator: DataGenerator::new(),
            test_sizes: vec![
                (1000, 100, "1K_x_100"),
                (10000, 100, "10K_x_100"),
                (100000, 26, "100K_x_26"),
            ],
        }
    }
}

impl BenchmarkScenario for LargeGridRenderBenchmark {
    fn name(&self) -> &str {
        "Large Grid Render"
    }

    fn description(&self) -> &str {
        "Measures rendering performance with large datasets"
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

        for (rows, cols, label) in &self.test_sizes {
            leptos::logging::log!("Testing grid size: {} ({} x {})", label, rows, cols);

            // Generate sparse data to avoid memory issues
            let density = (1000.0 / (*rows as f64 * *cols as f64)).clamp(0.001, 0.1);
            let data_start = Self::now();
            let data = self
                .data_generator
                .generate_sparse_data(*rows, *cols, density);
            let data_gen_time = Self::now() - data_start;

            // Load data
            let load_start = Self::now();
            let ctrl = controller.borrow();
            let facade = ctrl.get_facade();
            for (addr, value) in &data {
                let _ = facade.set_cell_value(addr, value);
            }
            drop(ctrl);
            let load_time = Self::now() - load_start;

            // Test viewport updates at different positions
            let positions = vec![
                (0, 0, "top_left"),
                (*rows / 2, *cols / 2, "center"),
                (*rows - 20, *cols - 10, "bottom_right"),
            ];

            let mut ctrl = controller.borrow_mut();
            for (row, col, pos_label) in positions {
                let viewport_start = Self::now();
                let _ = ctrl.dispatch_action(Action::UpdateViewport {
                    viewport: ViewportInfo {
                        start_row: row,
                        start_col: col,
                        rows: 20.min(*rows - row),
                        cols: 10.min(*cols - col),
                    },
                });
                let viewport_time = Self::now() - viewport_start;

                metrics.frame_times.push(viewport_time);
                metrics.custom_metrics.insert(
                    format!("{}_{}_{}_ms", label, pos_label, "viewport"),
                    viewport_time,
                );
            }

            // Store metrics for this size
            metrics
                .custom_metrics
                .insert(format!("{}_data_gen_ms", label), data_gen_time);
            metrics
                .custom_metrics
                .insert(format!("{}_load_ms", label), load_time);
            metrics
                .custom_metrics
                .insert(format!("{}_cells", label), data.len() as f64);

            // Clear for next test
            drop(ctrl);
            let ctrl = controller.borrow();
            let facade = ctrl.get_facade();
            let cells = facade.get_all_cells();
            for (addr, _) in cells {
                let _ = facade.delete_cell(&addr);
            }
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
        let ctrl = controller.borrow();
        let facade = ctrl.get_facade();
        let cells = facade.get_all_cells();
        for (addr, _) in cells {
            let _ = facade.delete_cell(&addr);
        }
    }
}

// Helper function for getting current time
impl InitialRenderBenchmark {
    fn now() -> f64 {
        web_sys::window()
            .and_then(|w| w.performance())
            .map(|p| p.now())
            .unwrap_or(0.0)
    }
}

impl LargeGridRenderBenchmark {
    fn now() -> f64 {
        web_sys::window()
            .and_then(|w| w.performance())
            .map(|p| p.now())
            .unwrap_or(0.0)
    }
}
