use std::collections::VecDeque;
use gridcore_core::{Result, SpreadsheetError, types::CellAddress};
use crate::state::{
    UIState, CellMode, VisualMode, SpreadsheetVisualMode,
    InsertMode, ViewportInfo, Selection, ParsedBulkCommand,
    ResizeTarget, InsertType, InsertPosition, DeleteType,
    create_navigation_state, create_editing_state, create_command_state, create_visual_state,
};

#[derive(Debug, Clone)]
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
        new_position: f64,
    },
    CompleteResize,
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

#[derive(Debug, Clone)]
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
        let new_state = self.apply_transition(&self.state.clone(), &action)?;
        
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
            (UIState::Navigation { cursor, viewport, .. }, Action::StartEditing { edit_mode, initial_value, cursor_position }) => {
                let mut new_state = create_editing_state(
                    cursor.clone(),
                    viewport.clone(),
                    if edit_mode.is_some() { CellMode::Insert } else { CellMode::Normal },
                );
                
                if let UIState::Editing { 
                    editing_value, 
                    cursor_position: pos, 
                    edit_variant, 
                    .. 
                } = &mut new_state {
                    if let Some(val) = initial_value {
                        *editing_value = val.clone();
                    }
                    if let Some(cp) = cursor_position {
                        *pos = *cp;
                    }
                    *edit_variant = edit_mode.clone();
                }
                
                Ok(new_state)
            },
            
            (UIState::Navigation { cursor, viewport, .. }, Action::EnterCommandMode) => {
                Ok(create_command_state(cursor.clone(), viewport.clone()))
            },
            
            (UIState::Navigation { cursor, viewport, .. }, Action::EnterSpreadsheetVisualMode { visual_mode, selection }) => {
                Ok(create_visual_state(
                    cursor.clone(),
                    viewport.clone(),
                    *visual_mode,
                    cursor.clone(),
                    selection.clone(),
                ))
            },
            
            // Editing mode transitions
            (UIState::Editing { cursor, viewport, .. }, Action::ExitToNavigation) => {
                Ok(create_navigation_state(cursor.clone(), viewport.clone(), None))
            },
            
            (UIState::Editing { cell_mode: CellMode::Normal, .. }, Action::EnterInsertMode { mode }) => {
                let mut new_state = state.clone();
                if let UIState::Editing { cell_mode, edit_variant, .. } = &mut new_state {
                    *cell_mode = CellMode::Insert;
                    *edit_variant = *mode;
                }
                Ok(new_state)
            },
            
            (UIState::Editing { cell_mode: CellMode::Insert, .. }, Action::ExitInsertMode) => {
                let mut new_state = state.clone();
                if let UIState::Editing { cell_mode, edit_variant, .. } = &mut new_state {
                    *cell_mode = CellMode::Normal;
                    *edit_variant = None;
                }
                Ok(new_state)
            },
            
            (UIState::Editing { cell_mode: CellMode::Normal, .. }, Action::EnterVisualMode { visual_type, anchor }) => {
                let mut new_state = state.clone();
                if let UIState::Editing { 
                    cell_mode, 
                    visual_type: vt, 
                    visual_start, 
                    cursor_position,
                    .. 
                } = &mut new_state {
                    *cell_mode = CellMode::Visual;
                    *vt = Some(*visual_type);
                    *visual_start = Some(anchor.unwrap_or(*cursor_position));
                }
                Ok(new_state)
            },
            
            (UIState::Editing { cell_mode: CellMode::Visual, .. }, Action::ExitVisualMode) => {
                let mut new_state = state.clone();
                if let UIState::Editing { 
                    cell_mode, 
                    visual_type, 
                    visual_start, 
                    .. 
                } = &mut new_state {
                    *cell_mode = CellMode::Normal;
                    *visual_type = None;
                    *visual_start = None;
                }
                Ok(new_state)
            },
            
            (UIState::Editing { .. }, Action::UpdateEditingValue { value, cursor_position }) => {
                let mut new_state = state.clone();
                if let UIState::Editing { 
                    editing_value, 
                    cursor_position: pos, 
                    .. 
                } = &mut new_state {
                    *editing_value = value.clone();
                    *pos = *cursor_position;
                }
                Ok(new_state)
            },
            
            // Command mode transitions
            (UIState::Command { cursor, viewport, .. }, Action::ExitCommandMode) => {
                Ok(create_navigation_state(cursor.clone(), viewport.clone(), None))
            },
            
            (UIState::Command { .. }, Action::UpdateCommandValue { value }) => {
                let mut new_state = state.clone();
                if let UIState::Command { command_value, .. } = &mut new_state {
                    *command_value = value.clone();
                }
                Ok(new_state)
            },
            
            // Visual mode transitions
            (UIState::Visual { cursor, viewport, .. }, Action::ExitSpreadsheetVisualMode) => {
                Ok(create_navigation_state(cursor.clone(), viewport.clone(), None))
            },
            
            (UIState::Visual { .. }, Action::UpdateSelection { selection }) => {
                let mut new_state = state.clone();
                if let UIState::Visual { selection: sel, .. } = &mut new_state {
                    *sel = selection.clone();
                }
                Ok(new_state)
            },
            
            // Universal transitions (work in any mode)
            (_, Action::UpdateCursor { cursor }) => {
                let mut new_state = state.clone();
                match &mut new_state {
                    UIState::Navigation { cursor: c, .. } |
                    UIState::Visual { cursor: c, .. } |
                    UIState::Editing { cursor: c, .. } |
                    UIState::Command { cursor: c, .. } |
                    UIState::Resize { cursor: c, .. } |
                    UIState::Insert { cursor: c, .. } |
                    UIState::Delete { cursor: c, .. } |
                    UIState::BulkOperation { cursor: c, .. } => {
                        *c = cursor.clone();
                    }
                }
                Ok(new_state)
            },
            
            (_, Action::UpdateViewport { viewport }) => {
                let mut new_state = state.clone();
                match &mut new_state {
                    UIState::Navigation { viewport: v, .. } |
                    UIState::Visual { viewport: v, .. } |
                    UIState::Editing { viewport: v, .. } |
                    UIState::Command { viewport: v, .. } |
                    UIState::Resize { viewport: v, .. } |
                    UIState::Insert { viewport: v, .. } |
                    UIState::Delete { viewport: v, .. } |
                    UIState::BulkOperation { viewport: v, .. } => {
                        *v = viewport.clone();
                    }
                }
                Ok(new_state)
            },
            
            // Escape handling
            (_, Action::Escape) => {
                self.handle_escape(state)
            },
            
            _ => Err(SpreadsheetError::InvalidOperation(
                format!("Invalid transition from {:?} with action {:?}", 
                    state.spreadsheet_mode(), action)
            )),
        }
    }
    
    fn handle_escape(&self, state: &UIState) -> Result<UIState> {
        match state {
            UIState::Editing { cursor, viewport, cell_mode, .. } => {
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
                        } = &mut new_state {
                            *cell_mode = CellMode::Normal;
                            *visual_type = None;
                            *visual_start = None;
                            *edit_variant = None;
                        }
                        Ok(new_state)
                    },
                    CellMode::Normal => {
                        // Exit editing mode entirely
                        Ok(create_navigation_state(cursor.clone(), viewport.clone(), None))
                    }
                }
            },
            UIState::Visual { cursor, viewport, .. } |
            UIState::Command { cursor, viewport, .. } |
            UIState::Resize { cursor, viewport, .. } => {
                // Exit to navigation
                Ok(create_navigation_state(cursor.clone(), viewport.clone(), None))
            },
            UIState::Navigation { .. } => {
                // Already in navigation, nothing to do
                Ok(state.clone())
            },
            _ => Ok(state.clone()),
        }
    }

    pub fn get_state(&self) -> &UIState {
        &self.state
    }

    pub fn subscribe<F>(&mut self, listener: F) -> usize 
    where
        F: Fn(&UIState, &Action) + Send + 'static
    {
        self.listeners.push(Box::new(listener));
        self.listeners.len() - 1
    }

    pub fn unsubscribe(&mut self, index: usize) {
        if index < self.listeners.len() {
            self.listeners.remove(index);
        }
    }

    pub fn get_history(&self) -> Vec<HistoryEntry> {
        self.history.iter().cloned().collect()
    }
    
    pub fn clear_history(&mut self) {
        self.history.clear();
    }

    fn add_to_history(&mut self, state: UIState, action: Action) {
        let entry = HistoryEntry {
            state,
            action,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
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