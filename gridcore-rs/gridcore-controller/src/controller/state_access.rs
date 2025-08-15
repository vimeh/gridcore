use crate::state::{Action, UIState};
use gridcore_core::Result;

/// Direct state machine access module
/// DEPRECATED: This module is being removed as part of the hybrid refactor
/// The UIStateMachine has been replaced with direct state fields
pub struct DirectStateAccess<'a> {
    _phantom: std::marker::PhantomData<&'a ()>,
}

impl<'a> DirectStateAccess<'a> {
    pub(super) fn new<T>(_state: &'a mut T) -> Self {
        Self { _phantom: std::marker::PhantomData }
    }

    /// Get the current state directly
    pub fn current(&self) -> &UIState {
        panic!("DirectStateAccess is deprecated - use controller's direct state accessors")
    }

    /// Execute an action directly on the state machine
    pub fn execute(&mut self, _action: Action) -> Result<()> {
        panic!("DirectStateAccess is deprecated - use controller's direct state setters")
    }

    /// Batch execute multiple actions
    pub fn execute_batch(&mut self, _actions: Vec<Action>) -> Result<()> {
        panic!("DirectStateAccess is deprecated - use controller's direct state setters")
    }

    /// Get state history
    pub fn history(&self) -> Vec<(Action, UIState)> {
        Vec::new() // Return empty history for now
    }

    /// Register a direct state change listener
    pub fn on_state_change<F>(&mut self, _callback: F)
    where
        F: Fn(&UIState, &Action) + Send + 'static,
    {
        // No-op for now
    }
}

pub mod actions {
    use crate::state::Action;
    
    /// Create an action directly
    pub fn create(action: Action) -> Action {
        action
    }
    
    /// Actions that trigger undo operations
    pub mod undo {
        use crate::state::Action;
        
        pub fn undo() -> Action {
            Action::Undo
        }
        
        pub fn redo() -> Action {
            Action::Redo
        }
    }
}