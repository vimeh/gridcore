use crate::controller::{
    DefaultViewportManager, EventDispatcher, GridConfiguration, KeyboardEvent, MouseEvent,
    SpreadsheetEvent, ViewportManager,
};
use crate::state::{Action, CellMode, InsertMode, SpreadsheetMode, UIState, UIStateMachine};
use gridcore_core::{types::CellAddress, Result, SpreadsheetFacade};

pub struct SpreadsheetController {
    state_machine: UIStateMachine,
    facade: SpreadsheetFacade,
    event_dispatcher: EventDispatcher,
    viewport_manager: Box<dyn ViewportManager>,
    config: GridConfiguration,
}

impl SpreadsheetController {
    pub fn new() -> Self {
        let mut config = GridConfiguration::default();
        config.total_rows = 1000;
        config.total_cols = 100;
        Self::with_config(config)
    }
    
    pub fn with_config(config: GridConfiguration) -> Self {
        let viewport_manager = Box::new(
            DefaultViewportManager::new(config.total_rows as u32, config.total_cols as u32)
                .with_config(config.clone())
        );
        Self::with_viewport(viewport_manager, config)
    }

    pub fn with_viewport(viewport_manager: Box<dyn ViewportManager>, config: GridConfiguration) -> Self {
        let mut controller = Self {
            state_machine: UIStateMachine::new(None),
            facade: SpreadsheetFacade::new(),
            event_dispatcher: EventDispatcher::new(),
            viewport_manager,
            config,
        };

        // Subscribe to state changes
        controller.setup_state_listener();
        controller
    }

    pub fn with_state(initial_state: UIState) -> Self {
        let config = GridConfiguration::default();
        let mut controller = Self {
            state_machine: UIStateMachine::new(Some(initial_state)),
            facade: SpreadsheetFacade::new(),
            event_dispatcher: EventDispatcher::new(),
            viewport_manager: Box::new(DefaultViewportManager::new(1000, 100).with_config(config.clone())),
            config,
        };

        controller.setup_state_listener();
        controller
    }

    fn setup_state_listener(&mut self) {
        // This would connect state changes to events
        // For now, we'll leave it as a placeholder
    }

    pub fn get_state(&self) -> &UIState {
        self.state_machine.get_state()
    }

    pub fn dispatch_action(&mut self, action: Action) -> Result<()> {
        let old_mode = self.state_machine.get_state().spreadsheet_mode();
        self.state_machine.transition(action)?;
        let new_mode = self.state_machine.get_state().spreadsheet_mode();

        if old_mode != new_mode {
            self.event_dispatcher
                .dispatch(&SpreadsheetEvent::ModeChanged {
                    from: old_mode,
                    to: new_mode,
                });
        }

        Ok(())
    }

    pub fn get_facade(&self) -> &SpreadsheetFacade {
        &self.facade
    }

    pub fn get_facade_mut(&mut self) -> &mut SpreadsheetFacade {
        &mut self.facade
    }

    /// Emit an error event
    pub fn emit_error(
        &mut self,
        message: String,
        severity: crate::controller::events::ErrorSeverity,
    ) {
        self.event_dispatcher
            .dispatch(&SpreadsheetEvent::ErrorOccurred { message, severity });
    }

    pub fn get_viewport_manager(&self) -> &dyn ViewportManager {
        self.viewport_manager.as_ref()
    }

    pub fn get_viewport_manager_mut(&mut self) -> &mut dyn ViewportManager {
        self.viewport_manager.as_mut()
    }
    
    pub fn get_config(&self) -> &GridConfiguration {
        &self.config
    }

    pub fn subscribe_to_events<F>(&mut self, listener: F) -> usize
    where
        F: Fn(&SpreadsheetEvent) + Send + 'static,
    {
        self.event_dispatcher.subscribe(listener)
    }

    pub fn unsubscribe_from_events(&mut self, index: usize) {
        self.event_dispatcher.unsubscribe(index)
    }

    // High-level keyboard handling
    pub fn handle_keyboard_event(&mut self, event: KeyboardEvent) -> Result<()> {
        // Clone the mode to avoid borrowing issues
        let mode = self.state_machine.get_state().spreadsheet_mode();

        match mode {
            SpreadsheetMode::Navigation => self.handle_navigation_key(event),
            SpreadsheetMode::Editing => self.handle_editing_key(event),
            SpreadsheetMode::Command => self.handle_command_key(event),
            SpreadsheetMode::Visual => self.handle_visual_key(event),
            _ => Ok(()),
        }
    }

    fn handle_navigation_key(&mut self, event: KeyboardEvent) -> Result<()> {
        match event.key.as_str() {
            "i" | "a" => {
                // Let the UI handle these keys - it will send the appropriate StartEditing action
                // The UI canvas_grid component handles 'i' and 'a' keys and includes the existing cell value
                Ok(())
            }
            ":" => self.dispatch_action(Action::EnterCommandMode),
            "Escape" => self.dispatch_action(Action::Escape),
            // Arrow keys for navigation
            "ArrowUp" | "k" => self.move_cursor(0, -1),
            "ArrowDown" | "j" => self.move_cursor(0, 1),
            "ArrowLeft" | "h" => self.move_cursor(-1, 0),
            "ArrowRight" | "l" => self.move_cursor(1, 0),
            "Delete" => {
                // Clear the current cell
                let state = self.state_machine.get_state();
                if let UIState::Navigation { cursor, .. } = state {
                    let address = cursor.clone();
                    // Delete the cell (actually removes it from repository)
                    self.facade.delete_cell(&address)?;
                    self.event_dispatcher
                        .dispatch(&SpreadsheetEvent::CellEditCompleted {
                            address: address.clone(),
                            value: String::new(),
                        });
                }
                Ok(())
            }
            _ => Ok(()),
        }
    }

    fn handle_editing_key(&mut self, event: KeyboardEvent) -> Result<()> {
        if event.key == "Escape" {
            return self.dispatch_action(Action::Escape);
        }

        // Clone the state to avoid borrowing issues
        let state = self.state_machine.get_state().clone();

        if let UIState::Editing {
            cell_mode,
            editing_value,
            cursor_position,
            ..
        } = state
        {
            match cell_mode {
                CellMode::Normal => match event.key.as_str() {
                    "i" => self.dispatch_action(Action::EnterInsertMode {
                        mode: Some(InsertMode::I),
                    }),
                    "a" => self.dispatch_action(Action::EnterInsertMode {
                        mode: Some(InsertMode::A),
                    }),
                    "Escape" => self.dispatch_action(Action::ExitToNavigation),
                    _ => Ok(()),
                },
                CellMode::Insert => {
                    if event.is_printable() {
                        // Add character to editing value
                        let mut new_value = editing_value.clone();
                        let pos = cursor_position;
                        new_value.insert_str(pos, &event.key);
                        self.dispatch_action(Action::UpdateEditingValue {
                            value: new_value,
                            cursor_position: pos + 1,
                        })
                    } else {
                        match event.key.as_str() {
                            "Backspace" => {
                                let mut new_value = editing_value.clone();
                                let pos = cursor_position;
                                if pos > 0 {
                                    new_value.remove(pos - 1);
                                    self.dispatch_action(Action::UpdateEditingValue {
                                        value: new_value,
                                        cursor_position: pos - 1,
                                    })
                                } else {
                                    Ok(())
                                }
                            }
                            "Enter" => {
                                // Complete editing and move down
                                self.complete_editing()?;
                                self.move_cursor(0, 1)
                            }
                            _ => Ok(()),
                        }
                    }
                }
                CellMode::Visual => {
                    // Visual mode handling would go here
                    Ok(())
                }
            }
        } else {
            Ok(())
        }
    }

    fn handle_command_key(&mut self, event: KeyboardEvent) -> Result<()> {
        if event.key == "Escape" {
            return self.dispatch_action(Action::ExitCommandMode);
        }

        if let UIState::Command { command_value, .. } = self.state_machine.get_state() {
            if event.is_printable() {
                let mut new_value = command_value.clone();
                new_value.push_str(&event.key);
                self.dispatch_action(Action::UpdateCommandValue { value: new_value })
            } else if event.key == "Enter" {
                // Execute command
                self.event_dispatcher
                    .dispatch(&SpreadsheetEvent::CommandExecuted {
                        command: command_value.clone(),
                    });
                self.dispatch_action(Action::ExitCommandMode)
            } else if event.key == "Backspace" && !command_value.is_empty() {
                let mut new_value = command_value.clone();
                new_value.pop();
                self.dispatch_action(Action::UpdateCommandValue { value: new_value })
            } else {
                Ok(())
            }
        } else {
            Ok(())
        }
    }

    fn handle_visual_key(&mut self, event: KeyboardEvent) -> Result<()> {
        match event.key.as_str() {
            "Escape" => self.dispatch_action(Action::ExitSpreadsheetVisualMode),
            // Visual mode navigation would go here
            _ => Ok(()),
        }
    }

    fn move_cursor(&mut self, delta_col: i32, delta_row: i32) -> Result<()> {
        let current = self.state_machine.get_state().cursor();
        let new_col = (current.col as i32 + delta_col).max(0) as u32;
        let new_row = (current.row as i32 + delta_row).max(0) as u32;
        let new_cursor = CellAddress::new(new_col, new_row);

        self.viewport_manager.ensure_visible(&new_cursor);

        self.event_dispatcher
            .dispatch(&SpreadsheetEvent::CursorMoved {
                from: current.clone(),
                to: new_cursor.clone(),
            });

        self.dispatch_action(Action::UpdateCursor { cursor: new_cursor })
    }

    fn complete_editing(&mut self) -> Result<()> {
        if let UIState::Editing {
            cursor,
            editing_value,
            ..
        } = self.state_machine.get_state()
        {
            let address = cursor.clone();
            let value = editing_value.clone();

            // Update the cell value in the facade and handle errors
            match self.facade.set_cell_value(&address, &value) {
                Ok(_) => {
                    // Check if the cell now contains an error value (e.g., from formula evaluation)
                    if let Ok(cell_value) = self.facade.get_cell_value(&address) {
                        // Check if the cell value is an error
                        if let gridcore_core::types::CellValue::Error(error_msg) = cell_value {
                            // Emit error event for formula evaluation errors
                            self.event_dispatcher
                                .dispatch(&SpreadsheetEvent::ErrorOccurred {
                                    message: format!("Formula error: {}", error_msg),
                                    severity: crate::controller::events::ErrorSeverity::Error,
                                });
                        }
                    }

                    self.event_dispatcher
                        .dispatch(&SpreadsheetEvent::CellEditCompleted {
                            address: address.clone(),
                            value,
                        });
                }
                Err(e) => {
                    // Emit error event for setting errors
                    self.event_dispatcher
                        .dispatch(&SpreadsheetEvent::ErrorOccurred {
                            message: format!("Failed to set cell value: {}", e),
                            severity: crate::controller::events::ErrorSeverity::Error,
                        });
                    // Still exit editing mode even if the value couldn't be set
                }
            }

            self.dispatch_action(Action::ExitToNavigation)
        } else {
            Ok(())
        }
    }

    // Mouse event handling
    pub fn handle_mouse_event(&mut self, event: MouseEvent) -> Result<()> {
        if let Some(cell) = self.viewport_manager.viewport_to_cell(event.x, event.y) {
            match event.event_type {
                crate::controller::events::MouseEventType::Click => {
                    self.event_dispatcher
                        .dispatch(&SpreadsheetEvent::CursorMoved {
                            from: self.state_machine.get_state().cursor().clone(),
                            to: cell.clone(),
                        });
                    self.dispatch_action(Action::UpdateCursor { cursor: cell })
                }
                crate::controller::events::MouseEventType::DoubleClick => {
                    self.dispatch_action(Action::UpdateCursor { cursor: cell })?;
                    self.dispatch_action(Action::StartEditing {
                        edit_mode: Some(InsertMode::I),
                        initial_value: None,
                        cursor_position: None,
                    })
                }
                _ => Ok(()),
            }
        } else {
            Ok(())
        }
    }
}

impl Default for SpreadsheetController {
    fn default() -> Self {
        Self::new()
    }
}
