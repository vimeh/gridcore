pub mod bulk;
pub mod command;
pub mod consolidated;
pub mod editing;
pub mod navigation;
#[cfg(test)]
mod navigation_test;
pub mod resize;
pub mod structural;
pub mod universal;
pub mod visual;

use crate::state::{actions::Action, UIState};
use gridcore_core::Result;

/// Trait for handling state transitions
pub trait TransitionHandler: Send + Sync {
    fn can_handle(&self, state: &UIState, action: &Action) -> bool;
    fn handle(&self, state: &UIState, action: &Action) -> Result<UIState>;
}

/// Registry that manages all transition handlers
/// Using the new consolidated approach
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

    // Legacy compatibility method
    pub fn find_handler(
        &self,
        _state: &UIState,
        _action: &Action,
    ) -> Option<&dyn TransitionHandler> {
        // Return None as we're using the consolidated handler directly
        None
    }
}

impl Default for HandlerRegistry {
    fn default() -> Self {
        Self::new()
    }
}
