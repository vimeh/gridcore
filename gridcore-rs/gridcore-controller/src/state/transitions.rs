use gridcore_core::Result;
use crate::state::{UIState, Action};

/// Represents a state transition rule
pub struct Transition {
    pub from_state: fn(&UIState) -> bool,
    pub action_type: fn(&Action) -> bool,
    pub handler: fn(&UIState, &Action) -> Result<UIState>,
}

impl Transition {
    pub fn new(
        from_state: fn(&UIState) -> bool,
        action_type: fn(&Action) -> bool,
        handler: fn(&UIState, &Action) -> Result<UIState>,
    ) -> Self {
        Self {
            from_state,
            action_type,
            handler,
        }
    }
    
    pub fn can_apply(&self, state: &UIState, action: &Action) -> bool {
        (self.from_state)(state) && (self.action_type)(action)
    }
    
    pub fn apply(&self, state: &UIState, action: &Action) -> Result<UIState> {
        (self.handler)(state, action)
    }
}

/// Registry of all valid state transitions
pub struct TransitionRegistry {
    transitions: Vec<Transition>,
}

impl TransitionRegistry {
    pub fn new() -> Self {
        Self {
            transitions: Vec::new(),
        }
    }
    
    pub fn register(&mut self, transition: Transition) {
        self.transitions.push(transition);
    }
    
    pub fn find_transition(&self, state: &UIState, action: &Action) -> Option<&Transition> {
        self.transitions
            .iter()
            .find(|t| t.can_apply(state, action))
    }
}

impl Default for TransitionRegistry {
    fn default() -> Self {
        Self::new()
    }
}