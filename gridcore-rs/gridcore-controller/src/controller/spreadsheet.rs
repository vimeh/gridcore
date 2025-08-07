use gridcore_core::{Result, SpreadsheetFacade};
use crate::state::{UIStateMachine, UIState, Action};

pub struct SpreadsheetController {
    state_machine: UIStateMachine,
    facade: SpreadsheetFacade,
}

impl SpreadsheetController {
    pub fn new() -> Self {
        Self {
            state_machine: UIStateMachine::new(None),
            facade: SpreadsheetFacade::new(),
        }
    }
    
    pub fn with_state(initial_state: UIState) -> Self {
        Self {
            state_machine: UIStateMachine::new(Some(initial_state)),
            facade: SpreadsheetFacade::new(),
        }
    }
    
    pub fn get_state(&self) -> &UIState {
        self.state_machine.get_state()
    }
    
    pub fn dispatch_action(&mut self, action: Action) -> Result<()> {
        self.state_machine.transition(action)
    }
    
    pub fn get_facade(&self) -> &SpreadsheetFacade {
        &self.facade
    }
    
    pub fn get_facade_mut(&mut self) -> &mut SpreadsheetFacade {
        &mut self.facade
    }
}

impl Default for SpreadsheetController {
    fn default() -> Self {
        Self::new()
    }
}