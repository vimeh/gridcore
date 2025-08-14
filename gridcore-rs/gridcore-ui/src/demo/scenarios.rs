use super::data_generator::DataGenerator;
use gridcore_controller::controller::SpreadsheetController;
use gridcore_controller::state::Action;
use gridcore_core::types::CellAddress;
use std::cell::RefCell;
use std::rc::Rc;

pub trait DemoScenario {
    fn name(&self) -> &str;
    fn description(&self) -> &str;
    fn setup(&mut self, controller: Rc<RefCell<SpreadsheetController>>);
    fn run_step(&mut self, controller: Rc<RefCell<SpreadsheetController>>) -> StepResult;
    fn cleanup(&mut self, controller: Rc<RefCell<SpreadsheetController>>);
    fn total_steps(&self) -> usize;
    fn current_step(&self) -> usize;
}

#[derive(Debug, Clone)]
pub enum StepResult {
    Continue,
    Complete,
    Error(String),
}

pub fn get_available_scenarios() -> Vec<String> {
    vec![
        "Basic Operations".to_string(),
        "Formula Engine".to_string(),
        "Large Dataset".to_string(),
        "Financial Dashboard".to_string(),
        "Scientific Data".to_string(),
        "Fill Operations".to_string(),
        "Performance Stress Test".to_string(),
        "Error Handling".to_string(),
    ]
}

pub fn create_scenario(name: &str) -> Result<Box<dyn DemoScenario>, String> {
    match name {
        "Basic Operations" => Ok(Box::new(BasicOperationsScenario::new())),
        "Formula Engine" => Ok(Box::new(FormulaEngineScenario::new())),
        "Large Dataset" => Ok(Box::new(LargeDatasetScenario::new())),
        "Financial Dashboard" => Ok(Box::new(FinancialDashboardScenario::new())),
        "Scientific Data" => Ok(Box::new(ScientificDataScenario::new())),
        "Fill Operations" => Ok(Box::new(FillOperationsScenario::new())),
        "Performance Stress Test" => Ok(Box::new(PerformanceStressScenario::new())),
        "Error Handling" => Ok(Box::new(ErrorHandlingScenario::new())),
        _ => Err(format!("Unknown scenario: {}", name)),
    }
}

// Basic Operations Scenario
pub struct BasicOperationsScenario {
    step: usize,
    total_steps: usize,
    _data_generator: DataGenerator,
}

impl Default for BasicOperationsScenario {
    fn default() -> Self {
        Self::new()
    }
}

impl BasicOperationsScenario {
    pub fn new() -> Self {
        Self {
            step: 0,
            total_steps: 20,
            _data_generator: DataGenerator::new(),
        }
    }
}

impl DemoScenario for BasicOperationsScenario {
    fn name(&self) -> &str {
        "Basic Operations"
    }

    fn description(&self) -> &str {
        "Demonstrates basic spreadsheet operations: navigation, editing, selection"
    }

    fn setup(&mut self, controller: Rc<RefCell<SpreadsheetController>>) {
        let ctrl = controller.borrow_mut();
        let facade = ctrl.facade();

        // Clear existing data
        // Add some initial data
        let initial_data = vec![
            (CellAddress::new(0, 0), "Name"),
            (CellAddress::new(1, 0), "Age"),
            (CellAddress::new(2, 0), "Score"),
            (CellAddress::new(0, 1), "Alice"),
            (CellAddress::new(1, 1), "25"),
            (CellAddress::new(2, 1), "95"),
            (CellAddress::new(0, 2), "Bob"),
            (CellAddress::new(1, 2), "30"),
            (CellAddress::new(2, 2), "87"),
        ];

        for (addr, value) in initial_data {
            let _ = facade.set_cell_value(&addr, value);
        }

        self.step = 0;
    }

    fn run_step(&mut self, controller: Rc<RefCell<SpreadsheetController>>) -> StepResult {
        if self.step >= self.total_steps {
            return StepResult::Complete;
        }

        let mut ctrl = controller.borrow_mut();

        match self.step {
            0..=4 => {
                // Navigate around cells
                let moves = [
                    (1, 0),  // Right
                    (0, 1),  // Down
                    (-1, 0), // Left
                    (0, -1), // Up
                    (1, 1),  // Diagonal
                ];

                if self.step < moves.len() {
                    let (dx, dy) = moves[self.step];
                    let current = ctrl.cursor();
                    let new_cursor = CellAddress::new(
                        (current.col as i32 + dx).max(0) as u32,
                        (current.row as i32 + dy).max(0) as u32,
                    );
                    let _ = ctrl.dispatch_action(Action::UpdateCursor { cursor: new_cursor });
                }
            }
            5..=9 => {
                // Edit some cells
                let edits = [
                    (CellAddress::new(0, 3), "Charlie"),
                    (CellAddress::new(1, 3), "28"),
                    (CellAddress::new(2, 3), "92"),
                    (CellAddress::new(3, 0), "Total"),
                    (CellAddress::new(3, 1), "=SUM(C2:C4)"),
                ];

                let idx = self.step - 5;
                if idx < edits.len() {
                    let (addr, value) = edits[idx];
                    let _ = ctrl.dispatch_action(Action::UpdateCursor { cursor: addr });
                    let _ = ctrl.facade().set_cell_value(&addr, value);
                }
            }
            _ => {
                // Additional operations
            }
        }

        self.step += 1;
        StepResult::Continue
    }

    fn cleanup(&mut self, _controller: Rc<RefCell<SpreadsheetController>>) {
        self.step = 0;
    }

    fn total_steps(&self) -> usize {
        self.total_steps
    }

    fn current_step(&self) -> usize {
        self.step
    }
}

// Formula Engine Scenario
pub struct FormulaEngineScenario {
    step: usize,
    total_steps: usize,
    _data_generator: DataGenerator,
}

impl Default for FormulaEngineScenario {
    fn default() -> Self {
        Self::new()
    }
}

impl FormulaEngineScenario {
    pub fn new() -> Self {
        Self {
            step: 0,
            total_steps: 30,
            _data_generator: DataGenerator::new(),
        }
    }
}

impl DemoScenario for FormulaEngineScenario {
    fn name(&self) -> &str {
        "Formula Engine"
    }

    fn description(&self) -> &str {
        "Showcases formula capabilities: functions, references, error handling"
    }

    fn setup(&mut self, controller: Rc<RefCell<SpreadsheetController>>) {
        let ctrl = controller.borrow_mut();
        let facade = ctrl.facade();

        // Setup initial data for formula demonstrations
        let data = vec![
            (CellAddress::new(0, 0), "Values"),
            (CellAddress::new(0, 1), "10"),
            (CellAddress::new(0, 2), "20"),
            (CellAddress::new(0, 3), "30"),
            (CellAddress::new(0, 4), "40"),
            (CellAddress::new(0, 5), "50"),
            (CellAddress::new(2, 0), "Formulas"),
            (CellAddress::new(2, 1), "=A2+A3"),
            (CellAddress::new(2, 2), "=SUM(A2:A6)"),
            (CellAddress::new(2, 3), "=AVERAGE(A2:A6)"),
            (CellAddress::new(2, 4), "=MAX(A2:A6)"),
            (CellAddress::new(2, 5), "=MIN(A2:A6)"),
        ];

        for (addr, value) in data {
            let _ = facade.set_cell_value(&addr, value);
        }

        self.step = 0;
    }

    fn run_step(&mut self, controller: Rc<RefCell<SpreadsheetController>>) -> StepResult {
        if self.step >= self.total_steps {
            return StepResult::Complete;
        }

        let ctrl = controller.borrow_mut();
        let facade = ctrl.facade();

        // Add more complex formulas progressively
        match self.step {
            0..=5 => {
                // Basic arithmetic
                let formulas = [
                    (CellAddress::new(4, 1), "=A2*2"),
                    (CellAddress::new(4, 2), "=A3/2"),
                    (CellAddress::new(4, 3), "=A4^2"),
                    (CellAddress::new(4, 4), "=SQRT(A5)"),
                    (CellAddress::new(4, 5), "=ABS(-A6)"),
                ];

                if self.step < formulas.len() {
                    let (addr, formula) = formulas[self.step];
                    let _ = facade.set_cell_value(&addr, formula);
                }
            }
            6..=10 => {
                // Conditional formulas
                let formulas = [
                    (CellAddress::new(6, 1), "=IF(A2>15, \"High\", \"Low\")"),
                    (CellAddress::new(6, 2), "=IF(A3>25, A3*2, A3/2)"),
                    (CellAddress::new(6, 3), "=COUNT(A2:A6)"),
                    (CellAddress::new(6, 4), "=COUNTA(A2:A6)"),
                ];

                let idx = self.step - 6;
                if idx < formulas.len() {
                    let (addr, formula) = formulas[idx];
                    let _ = facade.set_cell_value(&addr, formula);
                }
            }
            _ => {
                // More complex scenarios
            }
        }

        self.step += 1;
        StepResult::Continue
    }

    fn cleanup(&mut self, _controller: Rc<RefCell<SpreadsheetController>>) {
        self.step = 0;
    }

    fn total_steps(&self) -> usize {
        self.total_steps
    }

    fn current_step(&self) -> usize {
        self.step
    }
}

// Large Dataset Scenario
pub struct LargeDatasetScenario {
    step: usize,
    total_steps: usize,
    data_generator: DataGenerator,
    data_loaded: bool,
}

impl Default for LargeDatasetScenario {
    fn default() -> Self {
        Self::new()
    }
}

impl LargeDatasetScenario {
    pub fn new() -> Self {
        Self {
            step: 0,
            total_steps: 10,
            data_generator: DataGenerator::with_seed(42),
            data_loaded: false,
        }
    }
}

impl DemoScenario for LargeDatasetScenario {
    fn name(&self) -> &str {
        "Large Dataset"
    }

    fn description(&self) -> &str {
        "Tests performance with 100,000+ cells"
    }

    fn setup(&mut self, controller: Rc<RefCell<SpreadsheetController>>) {
        if !self.data_loaded {
            let ctrl = controller.borrow_mut();
            let facade = ctrl.facade();

            // Generate and load large dataset
            leptos::logging::log!("Generating large dataset...");
            let data = self.data_generator.generate_large_dataset(10000); // Start with 10K for demo

            leptos::logging::log!("Loading {} cells...", data.len());
            for (addr, value) in data.iter().take(1000) {
                // Load first 1000 for initial demo
                let _ = facade.set_cell_value(addr, value);
            }

            self.data_loaded = true;
        }
        self.step = 0;
    }

    fn run_step(&mut self, controller: Rc<RefCell<SpreadsheetController>>) -> StepResult {
        if self.step >= self.total_steps {
            return StepResult::Complete;
        }

        let mut ctrl = controller.borrow_mut();

        // Simulate navigation through large dataset
        match self.step {
            0..=4 => {
                // Jump to different sections
                let positions = [
                    CellAddress::new(0, 0),
                    CellAddress::new(10, 100),
                    CellAddress::new(20, 200),
                    CellAddress::new(5, 50),
                    CellAddress::new(0, 0),
                ];

                if self.step < positions.len() {
                    let cursor = positions[self.step];
                    let _ = ctrl.dispatch_action(Action::UpdateCursor { cursor });
                }
            }
            _ => {
                // Scroll simulation
            }
        }

        self.step += 1;
        StepResult::Continue
    }

    fn cleanup(&mut self, _controller: Rc<RefCell<SpreadsheetController>>) {
        self.step = 0;
        self.data_loaded = false;
    }

    fn total_steps(&self) -> usize {
        self.total_steps
    }

    fn current_step(&self) -> usize {
        self.step
    }
}

// Financial Dashboard Scenario
pub struct FinancialDashboardScenario {
    step: usize,
    total_steps: usize,
    data_generator: DataGenerator,
}

impl Default for FinancialDashboardScenario {
    fn default() -> Self {
        Self::new()
    }
}

impl FinancialDashboardScenario {
    pub fn new() -> Self {
        Self {
            step: 0,
            total_steps: 15,
            data_generator: DataGenerator::new(),
        }
    }
}

impl DemoScenario for FinancialDashboardScenario {
    fn name(&self) -> &str {
        "Financial Dashboard"
    }

    fn description(&self) -> &str {
        "Creates a financial dashboard with income statements and calculations"
    }

    fn setup(&mut self, controller: Rc<RefCell<SpreadsheetController>>) {
        let ctrl = controller.borrow_mut();
        let facade = ctrl.facade();

        // Generate financial data
        let data = self.data_generator.generate_financial_data();

        for (addr, value) in data {
            let _ = facade.set_cell_value(&addr, &value);
        }

        self.step = 0;
    }

    fn run_step(&mut self, controller: Rc<RefCell<SpreadsheetController>>) -> StepResult {
        if self.step >= self.total_steps {
            return StepResult::Complete;
        }

        let mut ctrl = controller.borrow_mut();

        // Navigate through the financial data
        let positions = [
            CellAddress::new(0, 0), // Title
            CellAddress::new(1, 3), // Q1 Revenue
            CellAddress::new(5, 3), // Total Revenue
            CellAddress::new(1, 7), // Gross Profit Q1
            CellAddress::new(5, 7), // Total Gross Profit
        ];

        if self.step < positions.len() {
            let cursor = positions[self.step];
            let _ = ctrl.dispatch_action(Action::UpdateCursor { cursor });
        }

        self.step += 1;
        StepResult::Continue
    }

    fn cleanup(&mut self, _controller: Rc<RefCell<SpreadsheetController>>) {
        self.step = 0;
    }

    fn total_steps(&self) -> usize {
        self.total_steps
    }

    fn current_step(&self) -> usize {
        self.step
    }
}

// Scientific Data Scenario
pub struct ScientificDataScenario {
    step: usize,
    total_steps: usize,
    data_generator: DataGenerator,
}

impl Default for ScientificDataScenario {
    fn default() -> Self {
        Self::new()
    }
}

impl ScientificDataScenario {
    pub fn new() -> Self {
        Self {
            step: 0,
            total_steps: 20,
            data_generator: DataGenerator::with_seed(123),
        }
    }
}

impl DemoScenario for ScientificDataScenario {
    fn name(&self) -> &str {
        "Scientific Data"
    }

    fn description(&self) -> &str {
        "Demonstrates scientific calculations and data analysis"
    }

    fn setup(&mut self, controller: Rc<RefCell<SpreadsheetController>>) {
        let ctrl = controller.borrow_mut();
        let facade = ctrl.facade();

        // Generate scientific data
        let data = self.data_generator.generate_scientific_data();

        for (addr, value) in data {
            let _ = facade.set_cell_value(&addr, &value);
        }

        self.step = 0;
    }

    fn run_step(&mut self, _controller: Rc<RefCell<SpreadsheetController>>) -> StepResult {
        if self.step >= self.total_steps {
            return StepResult::Complete;
        }

        // Navigate through data and show calculations
        self.step += 1;
        StepResult::Continue
    }

    fn cleanup(&mut self, _controller: Rc<RefCell<SpreadsheetController>>) {
        self.step = 0;
    }

    fn total_steps(&self) -> usize {
        self.total_steps
    }

    fn current_step(&self) -> usize {
        self.step
    }
}

// Fill Operations Scenario
pub struct FillOperationsScenario {
    step: usize,
    total_steps: usize,
    data_generator: DataGenerator,
}

impl Default for FillOperationsScenario {
    fn default() -> Self {
        Self::new()
    }
}

impl FillOperationsScenario {
    pub fn new() -> Self {
        Self {
            step: 0,
            total_steps: 15,
            data_generator: DataGenerator::new(),
        }
    }
}

impl DemoScenario for FillOperationsScenario {
    fn name(&self) -> &str {
        "Fill Operations"
    }

    fn description(&self) -> &str {
        "Demonstrates auto-fill patterns and smart fill detection"
    }

    fn setup(&mut self, controller: Rc<RefCell<SpreadsheetController>>) {
        let ctrl = controller.borrow_mut();
        let facade = ctrl.facade();

        // Setup pattern data
        let data = self.data_generator.generate_text_patterns();

        for (addr, value) in data {
            let _ = facade.set_cell_value(&addr, &value);
        }

        self.step = 0;
    }

    fn run_step(&mut self, _controller: Rc<RefCell<SpreadsheetController>>) -> StepResult {
        if self.step >= self.total_steps {
            return StepResult::Complete;
        }

        // Demonstrate fill operations
        self.step += 1;
        StepResult::Continue
    }

    fn cleanup(&mut self, _controller: Rc<RefCell<SpreadsheetController>>) {
        self.step = 0;
    }

    fn total_steps(&self) -> usize {
        self.total_steps
    }

    fn current_step(&self) -> usize {
        self.step
    }
}

// Performance Stress Test Scenario
pub struct PerformanceStressScenario {
    step: usize,
    total_steps: usize,
    data_generator: DataGenerator,
}

impl Default for PerformanceStressScenario {
    fn default() -> Self {
        Self::new()
    }
}

impl PerformanceStressScenario {
    pub fn new() -> Self {
        Self {
            step: 0,
            total_steps: 25,
            data_generator: DataGenerator::with_seed(999),
        }
    }
}

impl DemoScenario for PerformanceStressScenario {
    fn name(&self) -> &str {
        "Performance Stress Test"
    }

    fn description(&self) -> &str {
        "Stress tests with complex formulas and large dependency chains"
    }

    fn setup(&mut self, controller: Rc<RefCell<SpreadsheetController>>) {
        let ctrl = controller.borrow_mut();
        let facade = ctrl.facade();

        // Generate complex formula network
        let data = self.data_generator.generate_formula_stress_test();

        leptos::logging::log!("Loading {} cells with complex formulas...", data.len());
        for (addr, value) in data.iter().take(500) {
            // Load subset for demo
            let _ = facade.set_cell_value(addr, value);
        }

        self.step = 0;
    }

    fn run_step(&mut self, _controller: Rc<RefCell<SpreadsheetController>>) -> StepResult {
        if self.step >= self.total_steps {
            return StepResult::Complete;
        }

        // Perform stress operations
        self.step += 1;
        StepResult::Continue
    }

    fn cleanup(&mut self, _controller: Rc<RefCell<SpreadsheetController>>) {
        self.step = 0;
    }

    fn total_steps(&self) -> usize {
        self.total_steps
    }

    fn current_step(&self) -> usize {
        self.step
    }
}

// Error Handling Scenario
pub struct ErrorHandlingScenario {
    step: usize,
    total_steps: usize,
    data_generator: DataGenerator,
}

impl Default for ErrorHandlingScenario {
    fn default() -> Self {
        Self::new()
    }
}

impl ErrorHandlingScenario {
    pub fn new() -> Self {
        Self {
            step: 0,
            total_steps: 10,
            data_generator: DataGenerator::new(),
        }
    }
}

impl DemoScenario for ErrorHandlingScenario {
    fn name(&self) -> &str {
        "Error Handling"
    }

    fn description(&self) -> &str {
        "Demonstrates error detection and handling capabilities"
    }

    fn setup(&mut self, controller: Rc<RefCell<SpreadsheetController>>) {
        let ctrl = controller.borrow_mut();
        let facade = ctrl.facade();

        // Generate error cases
        let data = self.data_generator.generate_error_cases();

        for (addr, value) in data {
            let _ = facade.set_cell_value(&addr, &value);
        }

        self.step = 0;
    }

    fn run_step(&mut self, controller: Rc<RefCell<SpreadsheetController>>) -> StepResult {
        if self.step >= self.total_steps {
            return StepResult::Complete;
        }

        let mut ctrl = controller.borrow_mut();

        // Navigate through error cells
        if self.step < 7 {
            let cursor = CellAddress::new(0, self.step as u32);
            let _ = ctrl.dispatch_action(Action::UpdateCursor { cursor });
        }

        self.step += 1;
        StepResult::Continue
    }

    fn cleanup(&mut self, _controller: Rc<RefCell<SpreadsheetController>>) {
        self.step = 0;
    }

    fn total_steps(&self) -> usize {
        self.total_steps
    }

    fn current_step(&self) -> usize {
        self.step
    }
}
