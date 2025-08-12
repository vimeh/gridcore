pub mod canvas;
pub mod formula;
pub mod interaction;
pub mod memory;
pub mod rendering;
pub mod scroll;

use super::{BenchmarkResult, BenchmarkScenario};
use std::collections::HashMap;

/// Registry of available benchmark scenarios
pub struct ScenarioRegistry {
    scenarios: HashMap<String, Box<dyn BenchmarkScenario>>,
}

impl ScenarioRegistry {
    pub fn new() -> Self {
        let mut registry = Self {
            scenarios: HashMap::new(),
        };
        
        // Register all built-in scenarios
        registry.register_defaults();
        
        registry
    }
    
    fn register_defaults(&mut self) {
        // Scroll performance benchmarks
        self.register("scroll_smooth", Box::new(scroll::SmoothScrollBenchmark::new()));
        self.register("scroll_jump", Box::new(scroll::JumpNavigationBenchmark::new()));
        self.register("scroll_large_dataset", Box::new(scroll::LargeDatasetScrollBenchmark::new()));
        
        // Rendering benchmarks
        self.register("render_initial", Box::new(rendering::InitialRenderBenchmark::new()));
        self.register("render_large_grid", Box::new(rendering::LargeGridRenderBenchmark::new()));
        
        // Interaction benchmarks
        self.register("cell_edit", Box::new(interaction::CellEditBenchmark::new()));
        self.register("selection", Box::new(interaction::SelectionBenchmark::new()));
        
        // Formula benchmarks
        self.register("formula_simple", Box::new(formula::SimpleFormulaBenchmark::new()));
        self.register("formula_complex", Box::new(formula::ComplexFormulaBenchmark::new()));
        
        // Memory benchmarks
        self.register("memory_growth", Box::new(memory::MemoryGrowthBenchmark::new()));
        self.register("memory_cleanup", Box::new(memory::MemoryCleanupBenchmark::new()));
        
        // Canvas benchmarks
        self.register("canvas_draw_calls", Box::new(canvas::DrawCallBenchmark::new()));
        self.register("canvas_state", Box::new(canvas::CanvasStateBenchmark::new()));
    }
    
    pub fn register(&mut self, name: &str, scenario: Box<dyn BenchmarkScenario>) {
        self.scenarios.insert(name.to_string(), scenario);
    }
    
    pub fn get(&mut self, name: &str) -> Option<&mut Box<dyn BenchmarkScenario>> {
        self.scenarios.get_mut(name)
    }
    
    pub fn list(&self) -> Vec<String> {
        self.scenarios.keys().cloned().collect()
    }
}