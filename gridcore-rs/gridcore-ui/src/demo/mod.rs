pub mod data_generator;
pub mod performance;
pub mod runner;
pub mod scenarios;

use gridcore_controller::controller::SpreadsheetController;
use std::cell::RefCell;
use std::rc::Rc;

#[derive(Debug, Clone, PartialEq)]
pub enum DemoMode {
    Off,
    Manual,
    Automated,
}

#[derive(Debug, Clone)]
pub struct DemoConfig {
    pub mode: DemoMode,
    pub playback_speed: f32,
    pub show_performance: bool,
    pub auto_repeat: bool,
}

impl Default for DemoConfig {
    fn default() -> Self {
        Self {
            mode: DemoMode::Off,
            playback_speed: 1.0,
            show_performance: true,
            auto_repeat: false,
        }
    }
}

pub struct DemoController {
    config: DemoConfig,
    runner: runner::DemoRunner,
    performance_monitor: performance::PerformanceMonitor,
}

impl Default for DemoController {
    fn default() -> Self {
        Self::new()
    }
}

impl DemoController {
    pub fn new() -> Self {
        Self {
            config: DemoConfig::default(),
            runner: runner::DemoRunner::new(),
            performance_monitor: performance::PerformanceMonitor::new(),
        }
    }

    pub fn start_demo(
        &mut self,
        scenario_name: &str,
        controller: Rc<RefCell<SpreadsheetController>>,
    ) -> Result<(), String> {
        self.config.mode = DemoMode::Automated;
        self.runner.load_scenario(scenario_name)?;
        self.runner.start(controller)?;
        self.performance_monitor.start_monitoring();
        Ok(())
    }

    pub fn stop_demo(&mut self) {
        self.config.mode = DemoMode::Off;
        self.runner.stop();
        self.performance_monitor.stop_monitoring();
    }

    pub fn pause_demo(&mut self) {
        self.runner.pause();
    }

    pub fn resume_demo(&mut self) {
        self.runner.resume();
    }

    pub fn step_forward(&mut self, controller: Rc<RefCell<SpreadsheetController>>) {
        self.runner.step(controller);
    }

    pub fn set_playback_speed(&mut self, speed: f32) {
        self.config.playback_speed = speed.clamp(0.1, 10.0);
        self.runner.set_speed(self.config.playback_speed);
    }

    pub fn toggle_performance_overlay(&mut self) {
        self.config.show_performance = !self.config.show_performance;
    }

    pub fn get_performance_metrics(&self) -> performance::Metrics {
        self.performance_monitor.get_current_metrics()
    }

    pub fn get_available_scenarios(&self) -> Vec<String> {
        scenarios::get_available_scenarios()
    }

    pub fn is_running(&self) -> bool {
        self.runner.is_running()
    }

    pub fn get_current_scenario(&self) -> Option<String> {
        self.runner.get_current_scenario()
    }

    pub fn get_progress(&self) -> f32 {
        self.runner.get_progress()
    }

    pub fn get_current_step(&self) -> usize {
        self.runner.get_current_step()
    }

    pub fn get_total_steps(&self) -> usize {
        self.runner.get_total_steps()
    }
}
