use crate::state::{
    actions::Action, create_navigation_state, diff::StateDiff,
    transition_handlers::HandlerRegistry, InsertMode, Selection, SpreadsheetVisualMode, UIState,
    ViewportInfo,
};
use gridcore_core::{types::CellAddress, Result, SpreadsheetError};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

type StateListener = Box<dyn Fn(&UIState, &Action) + Send>;

pub struct UIStateMachine {
    state: UIState,
    initial_state: UIState, // Store the initial state for history reconstruction
    listeners: Vec<StateListener>,
    history: VecDeque<HistoryEntry>,
    max_history_size: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    /// The state diff from the previous state
    pub diff: StateDiff,
    pub action: Action,
    pub timestamp: u64,
}

impl UIStateMachine {
    pub fn new(initial_state: Option<UIState>) -> Self {
        let default_cursor = CellAddress::new(0, 0);

        let default_state = initial_state.unwrap_or_else(|| {
            create_navigation_state(
                default_cursor,
                ViewportInfo {
                    start_row: 0,
                    start_col: 0,
                    rows: 20,
                    cols: 10,
                },
                None,
            )
        });

        Self {
            state: default_state.clone(),
            initial_state: default_state,
            listeners: Vec::new(),
            history: VecDeque::new(),
            max_history_size: 100,
        }
    }

    pub fn transition(&mut self, action: Action) -> Result<()> {
        log::debug!(
            "UIStateMachine::transition called with action: {:?}",
            action
        );

        // Store old state for history before applying transition
        log::debug!("UIStateMachine::transition - storing old state");
        let old_state = self.state.clone();

        // Apply transition and update state
        let new_state = self.apply_transition(&self.state, &action)?;
        log::debug!("UIStateMachine::transition - apply_transition succeeded");

        // Update state
        log::debug!("UIStateMachine::transition - updating state");
        self.state = new_state;

        // Add to history with the diff between old and new state
        log::debug!("UIStateMachine::transition - adding to history");
        self.add_to_history(old_state, action.clone());
        log::debug!("UIStateMachine::transition - history added");
        log::debug!("UIStateMachine::transition - state updated");

        // Notify listeners
        log::debug!("UIStateMachine::transition - notifying listeners");
        self.notify_listeners(&action);
        log::debug!("UIStateMachine::transition - listeners notified");

        log::debug!("UIStateMachine::transition - returning Ok");
        Ok(())
    }

    fn apply_transition(&self, state: &UIState, action: &Action) -> Result<UIState> {
        log::debug!(
            "apply_transition: state={:?}, action={:?}",
            state.spreadsheet_mode(),
            action
        );

        // Create handler registry and find appropriate handler
        let registry = HandlerRegistry::new();

        if let Some(handler) = registry.find_handler(state, action) {
            return handler.handle(state, action);
        }

        // If no handler found, return an error
        Err(SpreadsheetError::InvalidOperation(format!(
            "Invalid transition from {:?} with action {:?}",
            state.spreadsheet_mode(),
            action
        )))
    }

    pub fn get_state(&self) -> &UIState {
        &self.state
    }

    pub fn subscribe<F>(&mut self, listener: F) -> usize
    where
        F: Fn(&UIState, &Action) + Send + 'static,
    {
        self.listeners.push(Box::new(listener));
        self.listeners.len() - 1
    }

    pub fn unsubscribe(&mut self, index: usize) {
        if index < self.listeners.len() {
            let _ = self.listeners.remove(index);
        }
    }

    pub fn get_history(&self) -> Vec<HistoryEntry> {
        self.history.iter().cloned().collect()
    }

    /// Reconstruct a state from history at a given index
    pub fn reconstruct_state_at(&self, index: usize) -> Option<UIState> {
        if index >= self.history.len() {
            return None;
        }

        // Start with the stored initial state
        let mut state = self.initial_state.clone();

        // Apply diffs up to the requested index
        for i in 0..=index {
            if let Some(entry) = self.history.get(i) {
                state = entry.diff.apply(&state);
            }
        }

        Some(state)
    }

    pub fn clear_history(&mut self) {
        self.history.clear();
    }

    fn add_to_history(&mut self, old_state: UIState, action: Action) {
        // Use a WASM-compatible timestamp
        #[cfg(target_arch = "wasm32")]
        let timestamp = {
            // In WASM, use performance.now() or Date.now() via web_sys
            // For now, just use a simple counter or fixed value
            // This is non-critical for the app functionality
            0u64
        };

        #[cfg(not(target_arch = "wasm32"))]
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        // Create a diff between the old state and the current state
        let diff = StateDiff::create(&old_state, &self.state);

        let entry = HistoryEntry {
            diff,
            action,
            timestamp,
        };

        self.history.push_back(entry);

        if self.history.len() > self.max_history_size {
            self.history.pop_front();
        }
    }

    fn notify_listeners(&self, action: &Action) {
        for listener in &self.listeners {
            listener(&self.state, action);
        }
    }

    // Helper methods for common transitions
    pub fn start_editing_mode(
        &mut self,
        edit_mode: Option<InsertMode>,
        initial_value: Option<String>,
        cursor_position: Option<usize>,
    ) -> Result<()> {
        self.transition(Action::StartEditing {
            edit_mode,
            initial_value,
            cursor_position,
        })
    }

    pub fn exit_editing_mode(&mut self) -> Result<()> {
        self.transition(Action::ExitToNavigation)
    }

    pub fn enter_spreadsheet_visual_mode(
        &mut self,
        visual_mode: SpreadsheetVisualMode,
        selection: Selection,
    ) -> Result<()> {
        self.transition(Action::EnterSpreadsheetVisualMode {
            visual_mode,
            selection,
        })
    }

    pub fn exit_spreadsheet_visual_mode(&mut self) -> Result<()> {
        self.transition(Action::ExitSpreadsheetVisualMode)
    }
}
