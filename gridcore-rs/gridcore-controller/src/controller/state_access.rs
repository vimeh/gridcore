use crate::state::{Action, UIState, UIStateMachine};
use gridcore_core::Result;

/// Direct state machine access module
/// Provides simplified, direct access to the state machine without unnecessary abstractions
pub struct DirectStateAccess<'a> {
    state_machine: &'a mut UIStateMachine,
}

impl<'a> DirectStateAccess<'a> {
    pub(super) fn new(state_machine: &'a mut UIStateMachine) -> Self {
        Self { state_machine }
    }

    /// Get the current state directly
    pub fn current(&self) -> &UIState {
        self.state_machine.get_state()
    }

    /// Execute an action directly on the state machine
    pub fn execute(&mut self, action: Action) -> Result<()> {
        self.state_machine.transition(action)
    }

    /// Batch execute multiple actions
    pub fn execute_batch(&mut self, actions: Vec<Action>) -> Result<()> {
        for action in actions {
            self.state_machine.transition(action)?;
        }
        Ok(())
    }

    /// Get state history
    pub fn history(&self) -> Vec<(Action, UIState)> {
        self.state_machine
            .get_history()
            .iter()
            .map(|entry| (entry.action.clone(), self.state_machine.get_state().clone()))
            .collect()
    }

    /// Register a direct state change listener
    pub fn on_state_change<F>(&mut self, callback: F)
    where
        F: Fn(&UIState, &Action) + Send + 'static,
    {
        self.state_machine.add_listener(Box::new(callback));
    }

    /// Get specific state fields efficiently
    pub fn cursor(&self) -> gridcore_core::types::CellAddress {
        *self.current().cursor()
    }

    pub fn mode(&self) -> crate::state::SpreadsheetMode {
        self.current().spreadsheet_mode()
    }

    pub fn selection(&self) -> Option<&crate::state::Selection> {
        self.current().selection()
    }
}

/// Simplified action builders for common operations
pub mod actions {
    use crate::state::{Action, InsertMode, VisualMode};
    use gridcore_core::types::CellAddress;

    /// Navigation actions
    pub fn move_cursor(to: CellAddress) -> Action {
        Action::UpdateCursor { cursor: to }
    }

    // Note: Direct movement actions don't exist in the current Action enum
    // Movement is handled through UpdateCursor action
    // For proper keyboard navigation, use the controller's handle_keyboard_event

    /// Editing actions
    pub fn start_edit(mode: Option<InsertMode>) -> Action {
        Action::StartEditing {
            edit_mode: mode,
            initial_value: None,
            cursor_position: None,
        }
    }

    pub fn cancel_edit() -> Action {
        Action::ExitToNavigation
    }

    pub fn submit_edit(value: String) -> Action {
        Action::SubmitCellEdit { value }
    }

    /// Visual mode actions
    pub fn enter_visual(mode: VisualMode) -> Action {
        Action::EnterVisualMode {
            visual_type: mode,
            anchor: None,
        }
    }

    pub fn exit_visual() -> Action {
        Action::ExitVisualMode
    }

    /// Sheet operations
    pub fn add_sheet(name: String) -> Action {
        Action::AddSheet { name }
    }

    pub fn remove_sheet(name: String) -> Action {
        Action::RemoveSheet { name }
    }

    pub fn rename_sheet(old: String, new: String) -> Action {
        Action::RenameSheet {
            old_name: old,
            new_name: new,
        }
    }
}
