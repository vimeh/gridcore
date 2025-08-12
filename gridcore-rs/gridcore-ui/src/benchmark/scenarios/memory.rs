use crate::benchmark::{BenchmarkMetrics, BenchmarkResult, BenchmarkScenario};
use crate::benchmark::profiler::memory_tracker::MemoryTracker;
use crate::demo::data_generator::DataGenerator;
use gridcore_controller::controller::SpreadsheetController;
use gridcore_controller::state::Action;
use gridcore_core::types::CellAddress;
use std::cell::RefCell;
use std::rc::Rc;

/// Benchmark memory growth during operations
pub struct MemoryGrowthBenchmark {
    operations_per_cycle: u32,
    cycles: u32,
}

impl MemoryGrowthBenchmark {
    pub fn new() -> Self {
        Self {
            operations_per_cycle: 100,
            cycles: 10,
        }
    }
    
    fn get_memory_usage() -> f64 {
        // Try to get memory usage from performance.memory (Chrome only)
        if let Some(window) = web_sys::window() {
            if let Some(performance) = window.performance() {
                if let Ok(memory) = js_sys::Reflect::get(&performance, &"memory".into()) {
                    if let Ok(used) = js_sys::Reflect::get(&memory, &"usedJSHeapSize".into()) {
                        if let Some(bytes) = used.as_f64() {
                            return bytes / (1024.0 * 1024.0); // Convert to MB
                        }
                    }
                }
            }
        }
        0.0
    }
}

impl BenchmarkScenario for MemoryGrowthBenchmark {
    fn name(&self) -> &str {
        "Memory Growth Test"
    }
    
    fn description(&self) -> &str {
        "Measures memory growth during repeated operations"
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
        
        // Record initial memory
        metrics.heap_used_start = Self::get_memory_usage();
        let mut memory_samples = Vec::new();
        memory_samples.push(metrics.heap_used_start);
        
        let mut gen = DataGenerator::new();
        
        // Run multiple cycles of operations
        for cycle in 0..self.cycles {
            leptos::logging::log!("Memory test cycle {}/{}", cycle + 1, self.cycles);
            
            let cycle_start = Self::now();
            let mem_before = Self::get_memory_usage();
            
            // Add cells
            let ctrl = controller.borrow();
            let facade = ctrl.get_facade();
            
            for i in 0..self.operations_per_cycle {
                let row = cycle * self.operations_per_cycle + i;
                let addr = CellAddress::new(0, row);
                let value = format!("Cell {}", row);
                let _ = facade.set_cell_value(&addr, &value);
                
                // Add some formulas
                if i % 10 == 0 {
                    let formula_addr = CellAddress::new(1, row);
                    let formula = format!("=A{}", row + 1u32);
                    let _ = facade.set_cell_value(&formula_addr, &formula);
                }
            }
            
            let mem_after = Self::get_memory_usage();
            memory_samples.push(mem_after);
            
            let cycle_time = Self::now() - cycle_start;
            let mem_growth = mem_after - mem_before;
            
            metrics.custom_metrics.insert(
                format!("cycle_{}_time_ms", cycle),
                cycle_time
            );
            metrics.custom_metrics.insert(
                format!("cycle_{}_memory_growth_mb", cycle),
                mem_growth
            );
        }
        
        // Perform undo/redo operations to test memory patterns
        let undo_start = Self::now();
        let mem_before_undo = Self::get_memory_usage();
        
        let mut ctrl = controller.borrow_mut();
        for _ in 0..20 {
            let _ = ctrl.dispatch_action(Action::Undo);
        }
        for _ in 0..20 {
            let _ = ctrl.dispatch_action(Action::Redo);
        }
        
        let mem_after_undo = Self::get_memory_usage();
        let undo_time = Self::now() - undo_start;
        
        metrics.custom_metrics.insert("undo_redo_time_ms".to_string(), undo_time);
        metrics.custom_metrics.insert(
            "undo_redo_memory_change_mb".to_string(),
            mem_after_undo - mem_before_undo
        );
        
        // Record final memory
        metrics.heap_used_end = Self::get_memory_usage();
        metrics.heap_peak = memory_samples.iter().fold(0.0, |a, &b| a.max(b));
        metrics.memory_growth = metrics.heap_used_end - metrics.heap_used_start;
        
        // Calculate average memory per cell
        drop(ctrl);
        let ctrl = controller.borrow();
        let cell_count = ctrl.get_facade().cell_count();
        if cell_count > 0 {
            let bytes_per_cell = (metrics.memory_growth * 1024.0 * 1024.0) / cell_count as f64;
            metrics.custom_metrics.insert("bytes_per_cell".to_string(), bytes_per_cell);
        }
        
        metrics.cells_updated = (self.operations_per_cycle * self.cycles) as u32;
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
        
        // Try to force garbage collection if available
        MemoryTracker::force_gc();
    }
}

/// Benchmark memory cleanup effectiveness
pub struct MemoryCleanupBenchmark {
    data_size: u32,
}

impl MemoryCleanupBenchmark {
    pub fn new() -> Self {
        Self {
            data_size: 1000,
        }
    }
    
    fn get_memory_usage() -> f64 {
        MemoryGrowthBenchmark::get_memory_usage()
    }
}

impl BenchmarkScenario for MemoryCleanupBenchmark {
    fn name(&self) -> &str {
        "Memory Cleanup Test"
    }
    
    fn description(&self) -> &str {
        "Measures memory cleanup effectiveness after operations"
    }
    
    fn warmup(&mut self, controller: Rc<RefCell<SpreadsheetController>>) {
        let ctrl = controller.borrow();
        let facade = ctrl.get_facade();
        let cells = facade.get_all_cells();
        for (addr, _) in cells {
            let _ = facade.delete_cell(&addr);
        }
        
        // Force GC if available
        MemoryTracker::force_gc();
    }
    
    fn run(&mut self, controller: Rc<RefCell<SpreadsheetController>>) -> BenchmarkResult {
        let mut metrics = BenchmarkMetrics::new();
        metrics.start_time = Self::now();
        
        // Record baseline memory
        MemoryTracker::force_gc();
        let baseline_memory = Self::get_memory_usage();
        metrics.heap_used_start = baseline_memory;
        
        // Phase 1: Create large dataset
        let phase1_start = Self::now();
        let mut gen = DataGenerator::new();
        let data = gen.generate_numeric_grid(self.data_size, 50, 0.0, 1000.0);
        
        let ctrl = controller.borrow();
        let facade = ctrl.get_facade();
        for (addr, value) in &data {
            let _ = facade.set_cell_value(addr, value);
        }
        
        let phase1_memory = Self::get_memory_usage();
        let phase1_time = Self::now() - phase1_start;
        let phase1_growth = phase1_memory - baseline_memory;
        
        metrics.custom_metrics.insert("phase1_load_time_ms".to_string(), phase1_time);
        metrics.custom_metrics.insert("phase1_memory_growth_mb".to_string(), phase1_growth);
        metrics.custom_metrics.insert("phase1_cells".to_string(), data.len() as f64);
        
        // Phase 2: Clear all data
        let phase2_start = Self::now();
        let cells = facade.get_all_cells();
        for (addr, _) in cells {
            let _ = facade.delete_cell(&addr);
        }
        
        let phase2_memory_before_gc = Self::get_memory_usage();
        
        // Force GC and measure again
        MemoryTracker::force_gc();
        let phase2_memory_after_gc = Self::get_memory_usage();
        let phase2_time = Self::now() - phase2_start;
        
        metrics.custom_metrics.insert("phase2_clear_time_ms".to_string(), phase2_time);
        metrics.custom_metrics.insert(
            "phase2_memory_before_gc_mb".to_string(),
            phase2_memory_before_gc - baseline_memory
        );
        metrics.custom_metrics.insert(
            "phase2_memory_after_gc_mb".to_string(),
            phase2_memory_after_gc - baseline_memory
        );
        
        // Phase 3: Reload and switch sheets
        let phase3_start = Self::now();
        
        // Reload data
        for (addr, value) in &data[..data.len() / 2] {
            let _ = facade.set_cell_value(addr, value);
        }
        
        // Simulate sheet switch (clear and reload)
        let cells = facade.get_all_cells();
        for (addr, _) in cells {
            let _ = facade.delete_cell(&addr);
        }
        
        for (addr, value) in &data[data.len() / 2..] {
            let _ = facade.set_cell_value(addr, value);
        }
        
        let phase3_memory = Self::get_memory_usage();
        let phase3_time = Self::now() - phase3_start;
        
        metrics.custom_metrics.insert("phase3_switch_time_ms".to_string(), phase3_time);
        metrics.custom_metrics.insert(
            "phase3_memory_mb".to_string(),
            phase3_memory - baseline_memory
        );
        
        // Final cleanup and measurement
        let cells = facade.get_all_cells();
        for (addr, _) in cells {
            let _ = facade.delete_cell(&addr);
        }
        
        MemoryTracker::force_gc();
        let final_memory = Self::get_memory_usage();
        
        metrics.heap_used_end = final_memory;
        metrics.heap_peak = phase1_memory.max(phase2_memory_before_gc).max(phase3_memory);
        metrics.memory_growth = final_memory - baseline_memory;
        
        // Calculate cleanup effectiveness
        let cleanup_ratio = if phase1_growth > 0.0 {
            ((phase1_growth - (final_memory - baseline_memory)) / phase1_growth * 100.0).max(0.0)
        } else {
            100.0
        };
        metrics.custom_metrics.insert("cleanup_effectiveness_percent".to_string(), cleanup_ratio);
        
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
        
        MemoryTracker::force_gc();
    }
}

// Helper functions
impl MemoryGrowthBenchmark {
    fn now() -> f64 {
        web_sys::window()
            .and_then(|w| w.performance())
            .map(|p| p.now())
            .unwrap_or(0.0)
    }
}

impl MemoryCleanupBenchmark {
    fn now() -> f64 {
        web_sys::window()
            .and_then(|w| w.performance())
            .map(|p| p.now())
            .unwrap_or(0.0)
    }
}