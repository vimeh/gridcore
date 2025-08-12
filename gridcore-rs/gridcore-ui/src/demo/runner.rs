use super::scenarios::{self, DemoScenario, StepResult};
use gridcore_controller::controller::SpreadsheetController;
use std::cell::RefCell;
use std::rc::Rc;

#[derive(Debug, Clone, PartialEq)]
pub enum RunnerState {
    Idle,
    Running,
    Paused,
    Complete,
    Error(String),
}

pub struct DemoRunner {
    current_scenario: Option<Box<dyn DemoScenario>>,
    state: RunnerState,
    playback_speed: f32,
    step_delay_ms: u32,
    auto_repeat: bool,
}

impl Default for DemoRunner {
    fn default() -> Self {
        Self::new()
    }
}

impl DemoRunner {
    pub fn new() -> Self {
        Self {
            current_scenario: None,
            state: RunnerState::Idle,
            playback_speed: 1.0,
            step_delay_ms: 500, // Default 500ms between steps
            auto_repeat: false,
        }
    }

    pub fn load_scenario(&mut self, name: &str) -> Result<(), String> {
        match scenarios::create_scenario(name) {
            Ok(scenario) => {
                self.current_scenario = Some(scenario);
                self.state = RunnerState::Idle;
                Ok(())
            }
            Err(e) => Err(e),
        }
    }

    pub fn start(&mut self, controller: Rc<RefCell<SpreadsheetController>>) -> Result<(), String> {
        if self.current_scenario.is_none() {
            return Err("No scenario loaded".to_string());
        }

        // Setup the scenario
        if let Some(scenario) = &mut self.current_scenario {
            scenario.setup(controller.clone());
        }

        self.state = RunnerState::Running;
        self.run_loop(controller);
        Ok(())
    }

    pub fn stop(&mut self) {
        self.state = RunnerState::Idle;
        self.current_scenario = None;
    }

    pub fn pause(&mut self) {
        if self.state == RunnerState::Running {
            self.state = RunnerState::Paused;
        }
    }

    pub fn resume(&mut self) {
        if self.state == RunnerState::Paused {
            self.state = RunnerState::Running;
        }
    }

    pub fn step(&mut self, controller: Rc<RefCell<SpreadsheetController>>) {
        if let Some(scenario) = &mut self.current_scenario {
            match scenario.run_step(controller.clone()) {
                StepResult::Continue => {
                    leptos::logging::log!(
                        "Demo step {}/{}",
                        scenario.current_step(),
                        scenario.total_steps()
                    );
                }
                StepResult::Complete => {
                    leptos::logging::log!("Demo scenario complete");
                    self.state = RunnerState::Complete;
                    scenario.cleanup(controller.clone());

                    if self.auto_repeat {
                        // Restart the scenario
                        scenario.setup(controller.clone());
                        self.state = RunnerState::Running;
                    }
                }
                StepResult::Error(e) => {
                    leptos::logging::log!("Demo error: {}", e);
                    self.state = RunnerState::Error(e);
                }
            }
        }
    }

    fn run_loop(&mut self, controller: Rc<RefCell<SpreadsheetController>>) {
        if self.state != RunnerState::Running {
            return;
        }

        // Execute the current step
        self.step(controller.clone());

        // If still running after the step, schedule the next iteration
        if self.state == RunnerState::Running {
            let _delay = (self.step_delay_ms as f32 / self.playback_speed) as u32;
            
            // Note: The continuous execution is now handled by the UI layer using set_interval.
            // This allows proper integration with Leptos's reactive system.
        }
    }

    pub fn set_speed(&mut self, speed: f32) {
        self.playback_speed = speed.clamp(0.1, 10.0);
    }

    pub fn set_auto_repeat(&mut self, repeat: bool) {
        self.auto_repeat = repeat;
    }

    pub fn is_running(&self) -> bool {
        self.state == RunnerState::Running
    }

    pub fn is_paused(&self) -> bool {
        self.state == RunnerState::Paused
    }

    pub fn get_state(&self) -> &RunnerState {
        &self.state
    }

    pub fn get_current_scenario(&self) -> Option<String> {
        self.current_scenario.as_ref().map(|s| s.name().to_string())
    }

    pub fn get_progress(&self) -> f32 {
        if let Some(scenario) = &self.current_scenario {
            let current = scenario.current_step() as f32;
            let total = scenario.total_steps() as f32;
            if total > 0.0 {
                (current / total) * 100.0
            } else {
                0.0
            }
        } else {
            0.0
        }
    }

    pub fn get_current_step(&self) -> usize {
        self.current_scenario
            .as_ref()
            .map(|s| s.current_step())
            .unwrap_or(0)
    }

    pub fn get_total_steps(&self) -> usize {
        self.current_scenario
            .as_ref()
            .map(|s| s.total_steps())
            .unwrap_or(0)
    }
}
