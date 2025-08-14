use crate::benchmark::{BenchmarkMetrics, BenchmarkResult, BenchmarkScenario};
use crate::demo::data_generator::DataGenerator;
use gridcore_controller::controller::SpreadsheetController;
use gridcore_controller::state::{Action, Selection, SelectionType};
use gridcore_core::types::CellAddress;
use std::cell::RefCell;
use std::rc::Rc;

/// Benchmark cell editing performance
pub struct CellEditBenchmark {
    test_values: Vec<String>,
    test_positions: Vec<CellAddress>,
}

impl Default for CellEditBenchmark {
    fn default() -> Self {
        Self::new()
    }
}

impl CellEditBenchmark {
    pub fn new() -> Self {
        Self {
            test_values: vec![
                "Hello World".to_string(),
                "123456789".to_string(),
                "=A1+B1".to_string(),
                "Long text that spans multiple cells and tests rendering".to_string(),
                "42.5".to_string(),
            ],
            test_positions: vec![
                CellAddress::new(0, 0),
                CellAddress::new(5, 5),
                CellAddress::new(10, 10),
                CellAddress::new(15, 15),
                CellAddress::new(20, 20),
            ],
        }
    }
}

impl BenchmarkScenario for CellEditBenchmark {
    fn name(&self) -> &str {
        "Cell Edit Latency"
    }

    fn description(&self) -> &str {
        "Measures input latency for cell editing operations"
    }

    fn warmup(&mut self, controller: Rc<RefCell<SpreadsheetController>>) {
        // Generate some background data
        let mut gen = DataGenerator::new();
        let data = gen.generate_numeric_grid(50, 20, 0.0, 100.0);

        let ctrl = controller.borrow();
        let facade = ctrl.facade();
        for (addr, value) in data {
            let _ = facade.set_cell_value(&addr, &value);
        }
    }

    fn run(&mut self, controller: Rc<RefCell<SpreadsheetController>>) -> BenchmarkResult {
        let mut metrics = BenchmarkMetrics::new();
        metrics.start_time = Self::now();

        // Test single cell edits
        for (pos, value) in self.test_positions.iter().zip(&self.test_values) {
            let mut ctrl = controller.borrow_mut();

            // Navigate to cell
            let nav_start = Self::now();
            let _ = ctrl.dispatch_action(Action::UpdateCursor { cursor: *pos });
            let nav_time = Self::now() - nav_start;

            // Enter edit mode
            let edit_start = Self::now();
            let _ = ctrl.dispatch_action(Action::StartEditing {
                edit_mode: None,
                initial_value: None,
                cursor_position: None,
            });
            let enter_edit_time = Self::now() - edit_start;

            // For now, we'll use the facade to set the value directly
            // since the edit buffer API has changed
            drop(ctrl);
            let ctrl_ref = controller.borrow();
            let facade = ctrl_ref.facade();

            let value_start = Self::now();
            let _ = facade.set_cell_value(pos, value);
            let value_time = Self::now() - value_start;

            drop(ctrl_ref);
            let mut ctrl = controller.borrow_mut();

            // Exit to navigation
            let exit_start = Self::now();
            let _ = ctrl.dispatch_action(Action::ExitToNavigation);
            let exit_time = Self::now() - exit_start;

            drop(ctrl);

            let commit_time = 0.0; // Combined with value setting

            // Calculate total edit latency
            let total_latency = nav_time + enter_edit_time + value_time + commit_time + exit_time;
            metrics.interaction_latencies.push(total_latency);

            // Store individual timings
            metrics
                .custom_metrics
                .insert(format!("nav_{}_ms", pos), nav_time);
            metrics
                .custom_metrics
                .insert(format!("enter_edit_{}_ms", pos), enter_edit_time);
            metrics
                .custom_metrics
                .insert(format!("value_{}_ms", pos), value_time);
            metrics
                .custom_metrics
                .insert(format!("commit_{}_ms", pos), commit_time);
        }

        // Test bulk paste operation
        let paste_data = (0..100)
            .map(|i| (CellAddress::new(0, i), format!("Bulk {}", i)))
            .collect::<Vec<_>>();

        let paste_start = Self::now();
        let ctrl = controller.borrow();
        let facade = ctrl.facade();
        for (addr, value) in &paste_data {
            let _ = facade.set_cell_value(addr, value);
        }
        let paste_time = Self::now() - paste_start;

        metrics
            .custom_metrics
            .insert("bulk_paste_100_cells_ms".to_string(), paste_time);
        metrics.cells_updated = paste_data.len() as u32;

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
        let facade = ctrl.facade();
        let cells = facade.get_all_cells();
        for (addr, _) in cells {
            let _ = facade.delete_cell(&addr);
        }
    }
}

/// Benchmark selection performance
pub struct SelectionBenchmark {
    test_ranges: Vec<(CellAddress, CellAddress, &'static str)>,
}

impl Default for SelectionBenchmark {
    fn default() -> Self {
        Self::new()
    }
}

impl SelectionBenchmark {
    pub fn new() -> Self {
        Self {
            test_ranges: vec![
                (
                    CellAddress::new(0, 0),
                    CellAddress::new(0, 0),
                    "single_cell",
                ),
                (
                    CellAddress::new(0, 0),
                    CellAddress::new(9, 9),
                    "10x10_range",
                ),
                (
                    CellAddress::new(0, 0),
                    CellAddress::new(99, 25),
                    "100x26_range",
                ),
                (
                    CellAddress::new(0, 0),
                    CellAddress::new(999, 99),
                    "1000x100_range",
                ),
            ],
        }
    }
}

impl BenchmarkScenario for SelectionBenchmark {
    fn name(&self) -> &str {
        "Selection Performance"
    }

    fn description(&self) -> &str {
        "Measures selection operation performance"
    }

    fn warmup(&mut self, controller: Rc<RefCell<SpreadsheetController>>) {
        // Generate background data
        let mut gen = DataGenerator::new();
        let data = gen.generate_sparse_data(1000, 100, 0.01);

        let ctrl = controller.borrow();
        let facade = ctrl.facade();
        for (addr, value) in data {
            let _ = facade.set_cell_value(&addr, &value);
        }
    }

    fn run(&mut self, controller: Rc<RefCell<SpreadsheetController>>) -> BenchmarkResult {
        let mut metrics = BenchmarkMetrics::new();
        metrics.start_time = Self::now();

        let mut ctrl = controller.borrow_mut();

        // Test different selection sizes
        for (start, end, label) in &self.test_ranges {
            // Single range selection
            let select_start = Self::now();
            let _ = ctrl.dispatch_action(Action::UpdateSelection {
                selection: Selection {
                    selection_type: SelectionType::Range {
                        start: *start,
                        end: *end,
                    },
                    anchor: Some(*start),
                },
            });
            let select_time = Self::now() - select_start;

            metrics.interaction_latencies.push(select_time);
            metrics
                .custom_metrics
                .insert(format!("{}_select_ms", label), select_time);

            // Calculate cells in selection
            let cells_selected = ((end.row - start.row + 1) * (end.col - start.col + 1)) as f64;
            metrics
                .custom_metrics
                .insert(format!("{}_cells", label), cells_selected);

            // Clear selection
            let clear_start = Self::now();
            let _ = ctrl.dispatch_action(Action::UpdateSelection {
                selection: Selection {
                    selection_type: SelectionType::Cell { address: *start },
                    anchor: Some(*start),
                },
            });
            let clear_time = Self::now() - clear_start;
            metrics
                .custom_metrics
                .insert(format!("{}_clear_ms", label), clear_time);
        }

        // Test multi-range selection (Ctrl+Click simulation)
        let multi_ranges = vec![
            CellAddress::new(0, 0),
            CellAddress::new(10, 10),
            CellAddress::new(20, 20),
            CellAddress::new(30, 30),
            CellAddress::new(40, 40),
        ];

        let multi_start = Self::now();
        for addr in &multi_ranges {
            let _ = ctrl.dispatch_action(Action::UpdateCursor { cursor: *addr });
        }
        let multi_time = Self::now() - multi_start;

        metrics
            .custom_metrics
            .insert("multi_select_5_cells_ms".to_string(), multi_time);

        // Test Select All (Ctrl+A) simulation
        let select_all_start = Self::now();
        let _ = ctrl.dispatch_action(Action::UpdateSelection {
            selection: Selection {
                selection_type: SelectionType::Range {
                    start: CellAddress::new(0, 0),
                    end: CellAddress::new(999, 99), // Large selection
                },
                anchor: Some(CellAddress::new(0, 0)),
            },
        });
        let select_all_time = Self::now() - select_all_start;

        metrics
            .custom_metrics
            .insert("select_all_ms".to_string(), select_all_time);

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
        let facade = ctrl.facade();
        let cells = facade.get_all_cells();
        for (addr, _) in cells {
            let _ = facade.delete_cell(&addr);
        }

        // Reset selection
        drop(ctrl);
        let mut ctrl = controller.borrow_mut();
        let _ = ctrl.dispatch_action(Action::UpdateSelection {
            selection: Selection {
                selection_type: SelectionType::Cell {
                    address: CellAddress::new(0, 0),
                },
                anchor: Some(CellAddress::new(0, 0)),
            },
        });
    }
}

// Helper functions
impl CellEditBenchmark {
    fn now() -> f64 {
        web_sys::window()
            .and_then(|w| w.performance())
            .map(|p| p.now())
            .unwrap_or(0.0)
    }
}

impl SelectionBenchmark {
    fn now() -> f64 {
        web_sys::window()
            .and_then(|w| w.performance())
            .map(|p| p.now())
            .unwrap_or(0.0)
    }
}
