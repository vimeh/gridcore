use crate::state::{
    actions::Action, create_command_state, create_editing_state, create_navigation_state,
    create_visual_state, diff::StateDiff, BulkOperationStatus, CellMode, InsertMode,
    ResizeMoveDirection, ResizeTarget, Selection, SpreadsheetVisualMode, UIState, ViewportInfo,
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
        match (state, action) {
            // Navigation mode transitions
            (
                UIState::Navigation {
                    cursor, viewport, ..
                },
                Action::StartEditing {
                    edit_mode,
                    initial_value,
                    cursor_position,
                },
            ) => {
                log::debug!("apply_transition: handling StartEditing from Navigation");
                let mut new_state = create_editing_state(
                    *cursor,
                    *viewport,
                    if edit_mode.is_some() {
                        CellMode::Insert
                    } else {
                        CellMode::Normal
                    },
                );

                if let UIState::Editing {
                    editing_value,
                    cursor_position: pos,
                    edit_variant,
                    ..
                } = &mut new_state
                {
                    // Handle initial_value:
                    // - Some(value): Use the provided value (can be empty string for Enter key)
                    // - None: Keep empty string (shouldn't happen with the new controller logic)
                    if let Some(val) = initial_value {
                        *editing_value = val.clone();
                    }
                    if let Some(cp) = cursor_position {
                        *pos = *cp;
                    }
                    *edit_variant = *edit_mode;
                }

                Ok(new_state)
            }

            (
                UIState::Navigation {
                    cursor, viewport, ..
                },
                Action::EnterCommandMode,
            ) => Ok(create_command_state(*cursor, *viewport)),

            (
                UIState::Navigation {
                    cursor, viewport, ..
                },
                Action::EnterSpreadsheetVisualMode {
                    visual_mode,
                    selection,
                },
            ) => Ok(create_visual_state(
                *cursor,
                *viewport,
                *visual_mode,
                *cursor,
                selection.clone(),
            )),

            // Editing mode transitions
            (
                UIState::Editing {
                    cursor, viewport, ..
                },
                Action::ExitToNavigation,
            ) => Ok(create_navigation_state(*cursor, *viewport, None)),

            (
                UIState::Editing {
                    cursor,
                    viewport,
                    editing_value,
                    cursor_position,
                    edit_variant,
                    ..
                },
                Action::EnterVisualMode {
                    visual_type,
                    anchor,
                },
            ) => {
                // Reconstruct state without cloning unchanged fields
                Ok(UIState::Editing {
                    cursor: *cursor,
                    viewport: *viewport,
                    cell_mode: CellMode::Visual,
                    editing_value: editing_value.clone(),
                    cursor_position: *cursor_position,
                    visual_start: Some(anchor.unwrap_or(*cursor_position)),
                    visual_type: Some(*visual_type),
                    edit_variant: *edit_variant,
                })
            }

            (
                UIState::Editing {
                    cell_mode: CellMode::Normal,
                    cursor,
                    viewport,
                    editing_value,
                    cursor_position,
                    visual_start,
                    visual_type,
                    ..
                },
                Action::EnterInsertMode { mode },
            ) => Ok(UIState::Editing {
                cursor: *cursor,
                viewport: *viewport,
                cell_mode: CellMode::Insert,
                editing_value: editing_value.clone(),
                cursor_position: *cursor_position,
                visual_start: *visual_start,
                visual_type: *visual_type,
                edit_variant: *mode,
            }),

            (
                UIState::Editing {
                    cell_mode: CellMode::Insert,
                    cursor,
                    viewport,
                    editing_value,
                    cursor_position,
                    visual_start,
                    visual_type,
                    ..
                },
                Action::ExitInsertMode,
            ) => Ok(UIState::Editing {
                cursor: *cursor,
                viewport: *viewport,
                cell_mode: CellMode::Normal,
                editing_value: editing_value.clone(),
                cursor_position: *cursor_position,
                visual_start: *visual_start,
                visual_type: *visual_type,
                edit_variant: None,
            }),

            (
                UIState::Editing {
                    cell_mode: CellMode::Visual,
                    cursor,
                    viewport,
                    editing_value,
                    cursor_position,
                    edit_variant,
                    ..
                },
                Action::ExitVisualMode,
            ) => {
                log::debug!(
                    "State machine: ExitVisualMode from CellMode::Visual to CellMode::Normal"
                );
                Ok(UIState::Editing {
                    cursor: *cursor,
                    viewport: *viewport,
                    cell_mode: CellMode::Normal,
                    editing_value: editing_value.clone(),
                    cursor_position: *cursor_position,
                    visual_start: None,
                    visual_type: None,
                    edit_variant: *edit_variant,
                })
            }

            (
                UIState::Editing {
                    cursor,
                    viewport,
                    cell_mode,
                    visual_start,
                    visual_type,
                    edit_variant,
                    ..
                },
                Action::UpdateEditingValue {
                    value,
                    cursor_position,
                },
            ) => Ok(UIState::Editing {
                cursor: *cursor,
                viewport: *viewport,
                cell_mode: *cell_mode,
                editing_value: value.clone(),
                cursor_position: *cursor_position,
                visual_start: *visual_start,
                visual_type: *visual_type,
                edit_variant: *edit_variant,
            }),

            // Command mode transitions
            (
                UIState::Command {
                    cursor, viewport, ..
                },
                Action::ExitCommandMode,
            ) => Ok(create_navigation_state(*cursor, *viewport, None)),

            (
                UIState::Command {
                    cursor, viewport, ..
                },
                Action::UpdateCommandValue { value },
            ) => Ok(UIState::Command {
                cursor: *cursor,
                viewport: *viewport,
                command_value: value.clone(),
            }),

            // Visual mode transitions
            (
                UIState::Visual {
                    cursor, viewport, ..
                },
                Action::ExitSpreadsheetVisualMode,
            ) => Ok(create_navigation_state(*cursor, *viewport, None)),

            (
                UIState::Visual {
                    cursor,
                    viewport,
                    anchor,
                    visual_mode,
                    ..
                },
                Action::UpdateSelection { selection },
            ) => {
                Ok(UIState::Visual {
                    cursor: *cursor,
                    viewport: *viewport,
                    selection: selection.clone(),
                    visual_mode: *visual_mode, // Keep current mode
                    anchor: *anchor,
                })
            }

            (
                UIState::Visual {
                    cursor,
                    viewport,
                    selection,
                    anchor,
                    ..
                },
                Action::ChangeVisualMode { new_mode },
            ) => Ok(UIState::Visual {
                cursor: *cursor,
                viewport: *viewport,
                selection: selection.clone(),
                visual_mode: *new_mode,
                anchor: *anchor,
            }),

            // Resize mode transitions
            (
                UIState::Navigation {
                    cursor, viewport, ..
                },
                Action::StartResize {
                    target,
                    initial_position,
                },
            ) => {
                Ok(UIState::Resize {
                    cursor: *cursor,
                    viewport: *viewport,
                    target: *target,
                    resize_target: *target,
                    resize_index: match target {
                        ResizeTarget::Column { index } => *index,
                        ResizeTarget::Row { index } => *index,
                    },
                    original_size: 100, // Default size, should be fetched from actual data
                    current_size: 100,
                    initial_position: *initial_position,
                    current_position: *initial_position,
                })
            }

            (UIState::Resize { .. }, Action::UpdateResize { delta }) => {
                let mut new_state = state.clone();
                if let UIState::Resize {
                    current_size: size,
                    current_position: pos,
                    ..
                } = &mut new_state
                {
                    *size = (*size as i32 + *delta as i32).max(20) as u32; // Minimum size of 20
                    *pos += delta;
                }
                Ok(new_state)
            }

            (UIState::Resize { resize_target, .. }, Action::MoveResizeTarget { direction }) => {
                let mut new_state = state.clone();
                if let UIState::Resize {
                    resize_index: index,
                    target,
                    resize_target: r_target,
                    ..
                } = &mut new_state
                {
                    match direction {
                        ResizeMoveDirection::Previous => {
                            *index = index.saturating_sub(1);
                        }
                        ResizeMoveDirection::Next => {
                            *index = index.saturating_add(1);
                        }
                    }
                    // Update both target and resize_target
                    let new_target = match resize_target {
                        ResizeTarget::Column { .. } => ResizeTarget::Column { index: *index },
                        ResizeTarget::Row { .. } => ResizeTarget::Row { index: *index },
                    };
                    *target = new_target;
                    *r_target = new_target;
                }
                Ok(new_state)
            }

            (UIState::Resize { .. }, Action::AutoFitResize) => {
                // For now, just set a default size
                let mut new_state = state.clone();
                if let UIState::Resize { current_size, .. } = &mut new_state {
                    *current_size = 120; // Default auto-fit size
                }
                Ok(new_state)
            }

            (
                UIState::Resize {
                    cursor, viewport, ..
                },
                Action::ConfirmResize | Action::CancelResize,
            ) => Ok(create_navigation_state(*cursor, *viewport, None)),

            // Insert mode transitions
            (
                UIState::Navigation {
                    cursor, viewport, ..
                },
                Action::StartInsert {
                    insert_type,
                    position,
                    reference,
                },
            ) => Ok(UIState::Insert {
                cursor: *cursor,
                viewport: *viewport,
                insert_type: *insert_type,
                position: *position,
                insert_position: *position,
                reference: *reference,
                count: 1,
                target_index: *reference,
            }),

            (UIState::Insert { .. }, Action::UpdateInsertCount { count }) => {
                let mut new_state = state.clone();
                if let UIState::Insert { count: c, .. } = &mut new_state {
                    *c = *count;
                }
                Ok(new_state)
            }

            (
                UIState::Insert {
                    cursor, viewport, ..
                },
                Action::ConfirmInsert | Action::CancelInsert,
            ) => Ok(create_navigation_state(*cursor, *viewport, None)),

            // Delete mode transitions
            (
                UIState::Navigation {
                    cursor, viewport, ..
                },
                Action::StartDelete {
                    targets,
                    delete_type,
                },
            ) => Ok(UIState::Delete {
                cursor: *cursor,
                viewport: *viewport,
                delete_type: *delete_type,
                targets: targets.clone(),
                selection: targets.clone(),
                confirmation_pending: false,
            }),

            (
                UIState::Delete {
                    cursor, viewport, ..
                },
                Action::ConfirmDelete,
            ) => {
                // In real implementation, this would execute the delete
                Ok(create_navigation_state(*cursor, *viewport, None))
            }

            (
                UIState::Delete {
                    cursor, viewport, ..
                },
                Action::CancelDelete,
            ) => Ok(create_navigation_state(*cursor, *viewport, None)),

            // Bulk operation transitions
            (
                UIState::Navigation {
                    cursor, viewport, ..
                },
                Action::StartBulkOperation {
                    parsed_command,
                    affected_cells,
                },
            ) => Ok(UIState::BulkOperation {
                cursor: *cursor,
                viewport: *viewport,
                parsed_command: parsed_command.clone(),
                preview_available: false,
                preview_visible: false,
                affected_cells: affected_cells.unwrap_or(0),
                status: BulkOperationStatus::Preparing,
                error_message: None,
            }),

            (
                UIState::BulkOperation {
                    cursor, viewport, ..
                },
                Action::CompleteBulkOperation,
            ) => Ok(create_navigation_state(*cursor, *viewport, None)),

            (
                UIState::BulkOperation {
                    cursor, viewport, ..
                },
                Action::CancelBulkOperation,
            ) => Ok(create_navigation_state(*cursor, *viewport, None)),

            (UIState::BulkOperation { .. }, Action::GeneratePreview) => {
                // For now, just update the status to Previewing
                let mut new_state = state.clone();
                if let UIState::BulkOperation {
                    status,
                    preview_available,
                    ..
                } = &mut new_state
                {
                    *status = BulkOperationStatus::Previewing;
                    *preview_available = true;
                }
                Ok(new_state)
            }

            (
                UIState::BulkOperation {
                    cursor, viewport, ..
                },
                Action::ExecuteBulkOperation,
            ) => {
                // For testing, execute completes immediately and returns to navigation
                // In a real implementation, this would update status and handle async execution
                Ok(create_navigation_state(*cursor, *viewport, None))
            }

            // Universal transitions (work in any mode)
            (_, Action::UpdateCursor { cursor }) => {
                log::debug!("State machine: UpdateCursor action to {:?}", cursor);
                let mut new_state = state.clone();
                match &mut new_state {
                    UIState::Navigation { cursor: c, .. }
                    | UIState::Visual { cursor: c, .. }
                    | UIState::Editing { cursor: c, .. }
                    | UIState::Command { cursor: c, .. }
                    | UIState::Resize { cursor: c, .. }
                    | UIState::Insert { cursor: c, .. }
                    | UIState::Delete { cursor: c, .. }
                    | UIState::BulkOperation { cursor: c, .. } => {
                        log::debug!(
                            "State machine: Updating cursor from {:?} to {:?}",
                            c,
                            cursor
                        );
                        *c = *cursor;
                    }
                }
                log::debug!(
                    "State machine: New state after UpdateCursor: {:?}",
                    new_state
                );
                Ok(new_state)
            }

            (_, Action::UpdateViewport { viewport }) => {
                let mut new_state = state.clone();
                match &mut new_state {
                    UIState::Navigation { viewport: v, .. }
                    | UIState::Visual { viewport: v, .. }
                    | UIState::Editing { viewport: v, .. }
                    | UIState::Command { viewport: v, .. }
                    | UIState::Resize { viewport: v, .. }
                    | UIState::Insert { viewport: v, .. }
                    | UIState::Delete { viewport: v, .. }
                    | UIState::BulkOperation { viewport: v, .. } => {
                        *v = *viewport;
                    }
                }
                Ok(new_state)
            }

            // Escape handling
            (_, Action::Escape) => self.handle_escape(state),

            // Undo/Redo handling - these actions maintain the current state
            // The actual undo/redo logic should be handled at a higher level
            (_, Action::Undo) | (_, Action::UndoLine) | (_, Action::Redo) => Ok(state.clone()),

            _ => Err(SpreadsheetError::InvalidOperation(format!(
                "Invalid transition from {:?} with action {:?}",
                state.spreadsheet_mode(),
                action
            ))),
        }
    }

    fn handle_escape(&self, state: &UIState) -> Result<UIState> {
        match state {
            UIState::Editing {
                cursor,
                viewport,
                cell_mode,
                ..
            } => {
                match cell_mode {
                    CellMode::Insert | CellMode::Visual => {
                        // Exit to normal mode within editing
                        let mut new_state = state.clone();
                        if let UIState::Editing {
                            cell_mode,
                            visual_type,
                            visual_start,
                            edit_variant,
                            ..
                        } = &mut new_state
                        {
                            *cell_mode = CellMode::Normal;
                            *visual_type = None;
                            *visual_start = None;
                            *edit_variant = None;
                        }
                        Ok(new_state)
                    }
                    CellMode::Normal => {
                        // Exit editing mode entirely
                        Ok(create_navigation_state(*cursor, *viewport, None))
                    }
                }
            }
            UIState::Visual {
                cursor, viewport, ..
            }
            | UIState::Command {
                cursor, viewport, ..
            }
            | UIState::Resize {
                cursor, viewport, ..
            } => {
                // Exit to navigation
                Ok(create_navigation_state(*cursor, *viewport, None))
            }
            UIState::Navigation { .. } => {
                // Already in navigation, nothing to do
                Ok(state.clone())
            }
            _ => Ok(state.clone()),
        }
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
