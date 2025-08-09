use crate::state::{
    create_command_state, create_editing_state, create_navigation_state, create_visual_state,
    BulkOperationStatus, CellMode, DeleteType, InsertMode, InsertPosition, InsertType,
    ParsedBulkCommand, ResizeMoveDirection, ResizeTarget, Selection, SpreadsheetVisualMode,
    UIState, ViewportInfo, VisualMode,
};
use gridcore_core::{types::CellAddress, Result, SpreadsheetError};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

#[cfg(all(target_arch = "wasm32", feature = "wasm"))]
use web_sys;

// Debug mode flag - can be set via environment or at runtime
#[cfg(all(target_arch = "wasm32", feature = "wasm"))]
fn is_debug_enabled() -> bool {
    // Enable debug mode for testing
    true
}

#[cfg(not(all(target_arch = "wasm32", feature = "wasm")))]
fn is_debug_enabled() -> bool {
    std::env::var("DEBUG_MODE").unwrap_or_default() == "true"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Action {
    StartEditing {
        edit_mode: Option<InsertMode>,
        initial_value: Option<String>,
        cursor_position: Option<usize>,
    },
    ExitToNavigation,
    EnterInsertMode {
        mode: Option<InsertMode>,
    },
    ExitInsertMode,
    EnterVisualMode {
        visual_type: VisualMode,
        anchor: Option<usize>,
    },
    ExitVisualMode,
    EnterSpreadsheetVisualMode {
        visual_mode: SpreadsheetVisualMode,
        selection: Selection,
    },
    ExitSpreadsheetVisualMode,
    UpdateSelection {
        selection: Selection,
    },
    EnterCommandMode,
    ExitCommandMode,
    EnterResizeMode {
        target: ResizeTarget,
        index: u32,
        size: u32,
    },
    ExitResizeMode,
    EnterStructuralInsertMode {
        insert_type: InsertType,
        insert_position: InsertPosition,
    },
    StartInsert {
        insert_type: InsertType,
        position: InsertPosition,
        reference: u32,
    },
    ExitStructuralInsertMode,
    UpdateInsertCount {
        count: u32,
    },
    ConfirmInsert,
    CancelInsert,
    StartResize {
        target: ResizeTarget,
        initial_position: f64,
    },
    UpdateResize {
        delta: f64,
    },
    MoveResizeTarget {
        direction: ResizeMoveDirection,
    },
    AutoFitResize,
    ConfirmResize,
    CancelResize,
    EnterDeleteMode {
        delete_type: DeleteType,
        selection: Vec<u32>,
    },
    ExitDeleteMode,
    ConfirmDelete,
    CancelDelete,
    StartDelete {
        targets: Vec<u32>,
        delete_type: DeleteType,
    },
    ChangeVisualMode {
        new_mode: SpreadsheetVisualMode,
    },
    UpdateEditingValue {
        value: String,
        cursor_position: usize,
    },
    UpdateCommandValue {
        value: String,
    },
    UpdateResizeSize {
        size: u32,
    },
    UpdateCursor {
        cursor: CellAddress,
    },
    UpdateViewport {
        viewport: ViewportInfo,
    },
    Escape,
    StartBulkOperation {
        parsed_command: ParsedBulkCommand,
        affected_cells: Option<u32>,
    },
    ShowBulkPreview,
    GeneratePreview,
    ExecuteBulkOperation,
    CancelBulkOperation,
    CompleteBulkOperation,
    BulkOperationError {
        error: String,
    },
}

type StateListener = Box<dyn Fn(&UIState, &Action) + Send>;

pub struct UIStateMachine {
    state: UIState,
    listeners: Vec<StateListener>,
    history: VecDeque<HistoryEntry>,
    max_history_size: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub state: UIState,
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
            state: default_state,
            listeners: Vec::new(),
            history: VecDeque::new(),
            max_history_size: 100,
        }
    }

    pub fn transition(&mut self, action: Action) -> Result<()> {
        // Log the incoming action and current state
        #[cfg(all(target_arch = "wasm32", feature = "wasm"))]
        if is_debug_enabled() {
            web_sys::console::log_1(&format!(
                "[STATE MACHINE] Transition requested - action: {:?}, current_mode: {:?}",
                action,
                self.state.spreadsheet_mode()
            ).into());
        }
        
        let new_state = self.apply_transition(&self.state.clone(), &action)?;

        // Log the resulting state
        #[cfg(all(target_arch = "wasm32", feature = "wasm"))]
        if is_debug_enabled() {
            web_sys::console::log_1(&format!(
                "[STATE MACHINE] Transition completed - new_mode: {:?}",
                new_state.spreadsheet_mode()
            ).into());
        }

        // Add to history
        self.add_to_history(self.state.clone(), action.clone());

        // Update state
        self.state = new_state;

        // Notify listeners
        self.notify_listeners(&action);

        Ok(())
    }

    fn apply_transition(&self, state: &UIState, action: &Action) -> Result<UIState> {
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
                #[cfg(all(target_arch = "wasm32", feature = "wasm"))]
                if is_debug_enabled() {
                    web_sys::console::log_1(&format!(
                        "[STATE MACHINE] Navigation->StartEditing matched! cursor: {:?}, edit_mode: {:?}",
                        cursor,
                        edit_mode
                    ).into());
                }
                
                let mut new_state = create_editing_state(
                    cursor.clone(),
                    viewport.clone(),
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
                    *edit_variant = edit_mode.clone();
                }

                #[cfg(all(target_arch = "wasm32", feature = "wasm"))]
                if is_debug_enabled() {
                    web_sys::console::log_1(&format!(
                        "[STATE MACHINE] Created editing state with mode: {:?}",
                        new_state.spreadsheet_mode()
                    ).into());
                }

                Ok(new_state)
            }

            (
                UIState::Navigation {
                    cursor, viewport, ..
                },
                Action::EnterCommandMode,
            ) => Ok(create_command_state(cursor.clone(), viewport.clone())),

            (
                UIState::Navigation {
                    cursor, viewport, ..
                },
                Action::EnterSpreadsheetVisualMode {
                    visual_mode,
                    selection,
                },
            ) => Ok(create_visual_state(
                cursor.clone(),
                viewport.clone(),
                *visual_mode,
                cursor.clone(),
                selection.clone(),
            )),

            // Editing mode transitions
            (
                UIState::Editing {
                    cursor, viewport, ..
                },
                Action::ExitToNavigation,
            ) => Ok(create_navigation_state(
                cursor.clone(),
                viewport.clone(),
                None,
            )),

            (
                UIState::Editing { .. },
                Action::EnterVisualMode {
                    visual_type,
                    anchor,
                },
            ) => {
                // Allow entering visual mode from editing (handles both Normal and other modes)
                let mut new_state = state.clone();
                if let UIState::Editing {
                    cell_mode: mode,
                    visual_type: v_type,
                    visual_start,
                    cursor_position,
                    ..
                } = &mut new_state
                {
                    *mode = CellMode::Visual;
                    *v_type = Some(*visual_type);
                    *visual_start = Some(anchor.unwrap_or(*cursor_position));
                }
                Ok(new_state)
            }

            (
                UIState::Editing {
                    cell_mode: CellMode::Normal,
                    ..
                },
                Action::EnterInsertMode { mode },
            ) => {
                let mut new_state = state.clone();
                if let UIState::Editing {
                    cell_mode,
                    edit_variant,
                    ..
                } = &mut new_state
                {
                    *cell_mode = CellMode::Insert;
                    *edit_variant = *mode;
                }
                Ok(new_state)
            }

            (
                UIState::Editing {
                    cell_mode: CellMode::Insert,
                    ..
                },
                Action::ExitInsertMode,
            ) => {
                let mut new_state = state.clone();
                if let UIState::Editing {
                    cell_mode,
                    edit_variant,
                    ..
                } = &mut new_state
                {
                    *cell_mode = CellMode::Normal;
                    *edit_variant = None;
                }
                Ok(new_state)
            }

            (
                UIState::Editing {
                    cell_mode: CellMode::Visual,
                    ..
                },
                Action::ExitVisualMode,
            ) => {
                let mut new_state = state.clone();
                if let UIState::Editing {
                    cell_mode,
                    visual_type,
                    visual_start,
                    ..
                } = &mut new_state
                {
                    *cell_mode = CellMode::Normal;
                    *visual_type = None;
                    *visual_start = None;
                }
                Ok(new_state)
            }

            (
                UIState::Editing { .. },
                Action::UpdateEditingValue {
                    value,
                    cursor_position,
                },
            ) => {
                let mut new_state = state.clone();
                if let UIState::Editing {
                    editing_value,
                    cursor_position: pos,
                    ..
                } = &mut new_state
                {
                    *editing_value = value.clone();
                    *pos = *cursor_position;
                }
                Ok(new_state)
            }

            // Command mode transitions
            (
                UIState::Command {
                    cursor, viewport, ..
                },
                Action::ExitCommandMode,
            ) => Ok(create_navigation_state(
                cursor.clone(),
                viewport.clone(),
                None,
            )),

            (UIState::Command { .. }, Action::UpdateCommandValue { value }) => {
                let mut new_state = state.clone();
                if let UIState::Command { command_value, .. } = &mut new_state {
                    *command_value = value.clone();
                }
                Ok(new_state)
            }

            // Visual mode transitions
            (
                UIState::Visual {
                    cursor, viewport, ..
                },
                Action::ExitSpreadsheetVisualMode,
            ) => Ok(create_navigation_state(
                cursor.clone(),
                viewport.clone(),
                None,
            )),

            (UIState::Visual { .. }, Action::UpdateSelection { selection }) => {
                let mut new_state = state.clone();
                if let UIState::Visual { selection: sel, .. } = &mut new_state {
                    *sel = selection.clone();
                }
                Ok(new_state)
            }

            (UIState::Visual { .. }, Action::ChangeVisualMode { new_mode }) => {
                let mut new_state = state.clone();
                if let UIState::Visual { visual_mode, .. } = &mut new_state {
                    *visual_mode = *new_mode;
                }
                Ok(new_state)
            }

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
                    cursor: cursor.clone(),
                    viewport: viewport.clone(),
                    target: target.clone(),
                    resize_target: target.clone(),
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
                    *target = new_target.clone();
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
            ) => Ok(create_navigation_state(
                cursor.clone(),
                viewport.clone(),
                None,
            )),

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
                cursor: cursor.clone(),
                viewport: viewport.clone(),
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
            ) => Ok(create_navigation_state(
                cursor.clone(),
                viewport.clone(),
                None,
            )),

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
                cursor: cursor.clone(),
                viewport: viewport.clone(),
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
                Ok(create_navigation_state(
                    cursor.clone(),
                    viewport.clone(),
                    None,
                ))
            }

            (
                UIState::Delete {
                    cursor, viewport, ..
                },
                Action::CancelDelete,
            ) => Ok(create_navigation_state(
                cursor.clone(),
                viewport.clone(),
                None,
            )),

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
                cursor: cursor.clone(),
                viewport: viewport.clone(),
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
            ) => Ok(create_navigation_state(
                cursor.clone(),
                viewport.clone(),
                None,
            )),

            (
                UIState::BulkOperation {
                    cursor, viewport, ..
                },
                Action::CancelBulkOperation,
            ) => Ok(create_navigation_state(
                cursor.clone(),
                viewport.clone(),
                None,
            )),

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
                Ok(create_navigation_state(
                    cursor.clone(),
                    viewport.clone(),
                    None,
                ))
            }

            // Universal transitions (work in any mode)
            (_, Action::UpdateCursor { cursor }) => {
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
                        *c = cursor.clone();
                    }
                }
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
                        *v = viewport.clone();
                    }
                }
                Ok(new_state)
            }

            // Escape handling
            (_, Action::Escape) => self.handle_escape(state),

            _ => {
                #[cfg(all(target_arch = "wasm32", feature = "wasm"))]
                if is_debug_enabled() {
                    web_sys::console::error_1(&format!(
                        "[STATE MACHINE] INVALID TRANSITION - state: {:?}, action: {:?}",
                        state,
                        action
                    ).into());
                }
                Err(SpreadsheetError::InvalidOperation(format!(
                    "Invalid transition from {:?} with action {:?}",
                    state.spreadsheet_mode(),
                    action
                )))
            }
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
                        Ok(create_navigation_state(
                            cursor.clone(),
                            viewport.clone(),
                            None,
                        ))
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
                Ok(create_navigation_state(
                    cursor.clone(),
                    viewport.clone(),
                    None,
                ))
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

    pub fn clear_history(&mut self) {
        self.history.clear();
    }

    fn add_to_history(&mut self, state: UIState, action: Action) {
        #[cfg(not(target_arch = "wasm32"))]
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        #[cfg(target_arch = "wasm32")]
        let timestamp = 0u64; // Placeholder for WASM

        let entry = HistoryEntry {
            state,
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
