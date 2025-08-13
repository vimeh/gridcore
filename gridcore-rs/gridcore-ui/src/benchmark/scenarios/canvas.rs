use crate::benchmark::{BenchmarkMetrics, BenchmarkResult, BenchmarkScenario};
use crate::demo::data_generator::DataGenerator;
use gridcore_controller::controller::SpreadsheetController;
use gridcore_controller::state::{Action, Selection, SelectionType, ViewportInfo};
use gridcore_core::types::CellAddress;
use std::cell::RefCell;
use std::rc::Rc;

/// Benchmark canvas draw call performance
pub struct DrawCallBenchmark {
    cell_counts: Vec<(u32, u32, &'static str)>, // (rows, cols, label)
}

impl Default for DrawCallBenchmark {
    fn default() -> Self {
        Self::new()
    }
}

impl DrawCallBenchmark {
    pub fn new() -> Self {
        Self {
            cell_counts: vec![
                (20, 10, "small"),
                (50, 20, "medium"),
                (100, 50, "large"),
                (200, 100, "extra_large"),
            ],
        }
    }
}

impl BenchmarkScenario for DrawCallBenchmark {
    fn name(&self) -> &str {
        "Canvas Draw Call Performance"
    }

    fn description(&self) -> &str {
        "Measures canvas rendering and draw call optimization"
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

        let mut gen = DataGenerator::new();

        for (rows, cols, label) in &self.cell_counts {
            leptos::logging::log!(
                "Testing canvas rendering for {} ({} x {})",
                label,
                rows,
                cols
            );

            // Generate test data
            let data = gen.generate_numeric_grid(*rows, *cols, 0.0, 1000.0);

            // Load data
            let load_start = Self::now();
            let ctrl = controller.borrow();
            let facade = ctrl.get_facade();
            for (addr, value) in &data {
                let _ = facade.set_cell_value(addr, value);
            }
            drop(ctrl);
            let load_time = Self::now() - load_start;

            // Test different rendering scenarios
            let mut ctrl = controller.borrow_mut();

            // 1. Grid lines rendering
            let grid_start = Self::now();
            let _ = ctrl.dispatch_action(Action::UpdateViewport {
                viewport: ViewportInfo {
                    start_row: 0,
                    start_col: 0,
                    rows: *rows,
                    cols: *cols,
                },
            });
            let grid_time = Self::now() - grid_start;

            // 2. Cell content rendering
            let content_start = Self::now();
            // Force re-render by changing viewport slightly
            let _ = ctrl.dispatch_action(Action::UpdateViewport {
                viewport: ViewportInfo {
                    start_row: 1,
                    start_col: 0,
                    rows: *rows - 1,
                    cols: *cols,
                },
            });
            let _ = ctrl.dispatch_action(Action::UpdateViewport {
                viewport: ViewportInfo {
                    start_row: 0,
                    start_col: 0,
                    rows: *rows,
                    cols: *cols,
                },
            });
            let content_time = Self::now() - content_start;

            // 3. Selection overlay rendering
            let selection_start = Self::now();
            let _ = ctrl.dispatch_action(Action::UpdateSelection {
                selection: Selection {
                    selection_type: SelectionType::Range {
                        start: CellAddress::new(0, 0),
                        end: CellAddress::new(cols / 2, rows / 2),
                    },
                    anchor: Some(CellAddress::new(0, 0)),
                },
            });
            let selection_time = Self::now() - selection_start;

            // 4. Highlight rendering (active cell)
            let highlight_start = Self::now();
            for i in 0..10 {
                let _ = ctrl.dispatch_action(Action::UpdateCursor {
                    cursor: CellAddress::new(i % *cols, i % *rows),
                });
            }
            let highlight_time = Self::now() - highlight_start;

            // Store metrics
            metrics
                .custom_metrics
                .insert(format!("{}_load_ms", label), load_time);
            metrics
                .custom_metrics
                .insert(format!("{}_grid_render_ms", label), grid_time);
            metrics
                .custom_metrics
                .insert(format!("{}_content_render_ms", label), content_time);
            metrics
                .custom_metrics
                .insert(format!("{}_selection_render_ms", label), selection_time);
            metrics
                .custom_metrics
                .insert(format!("{}_highlight_render_ms", label), highlight_time);

            // Estimate draw calls (this is approximate)
            let estimated_draw_calls = 1.0 +                      // Clear canvas
                (rows * cols) as f64 +     // Grid lines
                data.len() as f64 +        // Cell content
                1.0 +                      // Selection overlay
                10.0; // Highlight updates

            metrics.custom_metrics.insert(
                format!("{}_estimated_draw_calls", label),
                estimated_draw_calls,
            );
            metrics.canvas_operations += estimated_draw_calls as u32;

            // Clear for next test
            drop(ctrl);
            let ctrl = controller.borrow();
            let facade = ctrl.get_facade();
            let cells = facade.get_all_cells();
            for (addr, _) in cells {
                let _ = facade.delete_cell(&addr);
            }
        }

        // Calculate average draw calls per frame
        if metrics.canvas_operations > 0 && !metrics.custom_metrics.is_empty() {
            let total_frames = self.cell_counts.len() as f64 * 5.0; // Approximate frame count
            metrics.draw_calls_per_frame = metrics.canvas_operations as f64 / total_frames;
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

/// Benchmark canvas state management
pub struct CanvasStateBenchmark;

impl Default for CanvasStateBenchmark {
    fn default() -> Self {
        Self::new()
    }
}

impl CanvasStateBenchmark {
    pub fn new() -> Self {
        Self
    }
}

impl BenchmarkScenario for CanvasStateBenchmark {
    fn name(&self) -> &str {
        "Canvas State Management"
    }

    fn description(&self) -> &str {
        "Measures canvas context state save/restore performance"
    }

    fn warmup(&mut self, controller: Rc<RefCell<SpreadsheetController>>) {
        // Generate some data
        let mut gen = DataGenerator::new();
        let data = gen.generate_numeric_grid(50, 20, 0.0, 100.0);

        let ctrl = controller.borrow();
        let facade = ctrl.get_facade();
        for (addr, value) in data {
            let _ = facade.set_cell_value(&addr, &value);
        }
    }

    fn run(&mut self, controller: Rc<RefCell<SpreadsheetController>>) -> BenchmarkResult {
        let mut metrics = BenchmarkMetrics::new();
        metrics.start_time = Self::now();

        let mut ctrl = controller.borrow_mut();

        // Test transform operations (scrolling simulation)
        let transform_start = Self::now();
        for i in 0..20 {
            let _ = ctrl.dispatch_action(Action::UpdateViewport {
                viewport: ViewportInfo {
                    start_row: i,
                    start_col: 0,
                    rows: 20,
                    cols: 20,
                },
            });
        }
        let transform_time = Self::now() - transform_start;

        // Test clipping region changes
        let clip_start = Self::now();
        for cols in [10, 15, 20, 25, 20, 15, 10] {
            let _ = ctrl.dispatch_action(Action::UpdateViewport {
                viewport: ViewportInfo {
                    start_row: 0,
                    start_col: 0,
                    rows: 20,
                    cols,
                },
            });
        }
        let clip_time = Self::now() - clip_start;

        // Test style changes (selection colors, etc.)
        let style_start = Self::now();
        for i in 0..10 {
            // Alternate between different selection types
            let selection = if i % 2 == 0 {
                Selection {
                    selection_type: SelectionType::Cell {
                        address: CellAddress::new(i, i),
                    },
                    anchor: Some(CellAddress::new(i, i)),
                }
            } else {
                Selection {
                    selection_type: SelectionType::Range {
                        start: CellAddress::new(0, 0),
                        end: CellAddress::new(i, i),
                    },
                    anchor: Some(CellAddress::new(0, 0)),
                }
            };
            let _ = ctrl.dispatch_action(Action::UpdateSelection { selection });
        }
        let style_time = Self::now() - style_start;

        // Store metrics
        metrics
            .custom_metrics
            .insert("transform_operations_ms".to_string(), transform_time);
        metrics
            .custom_metrics
            .insert("clipping_operations_ms".to_string(), clip_time);
        metrics
            .custom_metrics
            .insert("style_changes_ms".to_string(), style_time);

        // Calculate state changes per operation
        let total_state_changes = 20 + 7 + 10; // Transform + clip + style changes
        let total_time = transform_time + clip_time + style_time;
        if total_time > 0.0 {
            let changes_per_ms = total_state_changes as f64 / total_time;
            metrics
                .custom_metrics
                .insert("state_changes_per_ms".to_string(), changes_per_ms);
        }

        metrics.canvas_operations = total_state_changes as u32;
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

        // Reset viewport
        drop(ctrl);
        let mut ctrl = controller.borrow_mut();
        let _ = ctrl.dispatch_action(Action::UpdateViewport {
            viewport: ViewportInfo {
                start_row: 0,
                start_col: 0,
                rows: 20,
                cols: 10,
            },
        });
    }
}

// Helper functions
impl DrawCallBenchmark {
    fn now() -> f64 {
        web_sys::window()
            .and_then(|w| w.performance())
            .map(|p| p.now())
            .unwrap_or(0.0)
    }
}

impl CanvasStateBenchmark {
    fn now() -> f64 {
        web_sys::window()
            .and_then(|w| w.performance())
            .map(|p| p.now())
            .unwrap_or(0.0)
    }
}
