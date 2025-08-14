pub mod consolidated;

use crate::state::{actions::Action, UIState};
use gridcore_core::Result;

/// Registry that manages state transitions using the consolidated handler
pub struct HandlerRegistry {
    handler: consolidated::StateTransitionHandler,
}

impl HandlerRegistry {
    pub fn new() -> Self {
        Self {
            handler: consolidated::StateTransitionHandler::new(),
        }
    }

    pub fn handle(&self, state: &UIState, action: &Action) -> Result<UIState> {
        self.handler.handle(state, action)
    }
}

impl Default for HandlerRegistry {
    fn default() -> Self {
        Self::new()
    }
}
