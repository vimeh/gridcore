use crate::controller::{
    DefaultViewportManager, EventDispatcher, GridConfiguration, KeyboardEvent, MouseEvent,
    SpreadsheetEvent, ViewportManager,
};
use crate::managers::{AutocompleteManager, ErrorFormatter, ResizeManager};
use crate::state::{Action, CellMode, InsertMode, SpreadsheetMode, UIState, UIStateMachine};
use gridcore_core::{types::CellAddress, Result, SpreadsheetFacade};

pub struct SpreadsheetController {
    state_machine: UIStateMachine,
    facade: SpreadsheetFacade,
    event_dispatcher: EventDispatcher,
    viewport_manager: Box<dyn ViewportManager>,
    resize_manager: ResizeManager,
    autocomplete_manager: AutocompleteManager,
    config: GridConfiguration,
}

impl SpreadsheetController {
    pub fn new() -> Self {
        let config = GridConfiguration {
            total_rows: 1000,
            total_cols: 100,
            ..Default::default()
        };
        Self::with_config(config)
    }

    pub fn with_config(config: GridConfiguration) -> Self {
        let viewport_manager = Box::new(
            DefaultViewportManager::new(config.total_rows as u32, config.total_cols as u32)
                .with_config(config.clone()),
        );
        Self::with_viewport(viewport_manager, config)
    }

    pub fn with_viewport(
        viewport_manager: Box<dyn ViewportManager>,
        config: GridConfiguration,
    ) -> Self {
        let resize_manager = ResizeManager::new().with_limits(
            config.min_cell_width,
            config.max_cell_width,
            config.default_cell_height.min(20.0),
            config.default_cell_height * 10.0,
        );

        let mut controller = Self {
            state_machine: UIStateMachine::new(None),
            facade: SpreadsheetFacade::new(),
            event_dispatcher: EventDispatcher::new(),
            viewport_manager,
            resize_manager,
            autocomplete_manager: AutocompleteManager::new(),
            config,
        };

        // Subscribe to state changes
        controller.setup_state_listener();
        controller
    }

    pub fn with_state(initial_state: UIState) -> Self {
        let config = GridConfiguration::default();
        let resize_manager = ResizeManager::new().with_limits(
            config.min_cell_width,
            config.max_cell_width,
            config.default_cell_height.min(20.0),
            config.default_cell_height * 10.0,
        );

        let mut controller = Self {
            state_machine: UIStateMachine::new(Some(initial_state)),
            facade: SpreadsheetFacade::new(),
            event_dispatcher: EventDispatcher::new(),
            viewport_manager: Box::new(
                DefaultViewportManager::new(1000, 100).with_config(config.clone()),
            ),
            resize_manager,
            autocomplete_manager: AutocompleteManager::new(),
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

    pub fn get_cursor(&self) -> CellAddress {
        *self.state_machine.get_state().cursor()
    }

    pub fn dispatch_action(&mut self, action: Action) -> Result<()> {
        // Handle special actions that need controller logic
        match &action {
            Action::SubmitCellEdit { value } => {
                // Update the editing value and complete editing
                if let UIState::Editing { cursor, .. } = self.state_machine.get_state() {
                    let address = *cursor;

                    // Update the cell value in the facade and handle errors
                    match self.facade.set_cell_value(&address, value) {
                        Ok(_) => {
                            // Check if the cell now contains an error value
                            if let Some(gridcore_core::types::CellValue::Error(error_type)) =
                                self.facade.get_cell_raw_value(&address)
                            {
                                let enhanced_message =
                                    format!("Formula error: {}", error_type.full_display());
                                log::error!("Error in cell {}: {}", address, enhanced_message);
                                self.event_dispatcher
                                    .dispatch(&SpreadsheetEvent::ErrorOccurred {
                                        message: enhanced_message,
                                        severity: crate::controller::events::ErrorSeverity::Error,
                                    });
                            }

                            self.event_dispatcher
                                .dispatch(&SpreadsheetEvent::CellEditCompleted {
                                    address,
                                    value: value.clone(),
                                });
                        }
                        Err(e) => {
                            let message = ErrorFormatter::format_error(&e);
                            log::error!("Parse/Set error in cell {}: {}", address, message);
                            self.event_dispatcher
                                .dispatch(&SpreadsheetEvent::ErrorOccurred {
                                    message,
                                    severity: crate::controller::events::ErrorSeverity::Error,
                                });
                        }
                    }

                    // Exit editing mode
                    return self.dispatch_action(Action::ExitToNavigation);
                }
                return Ok(());
            }
            _ => {}
        }

        let old_mode = self.state_machine.get_state().spreadsheet_mode();
        log::debug!(
            "dispatch_action: about to transition with action {:?}",
            action
        );
        self.state_machine.transition(action)?;
        log::debug!("dispatch_action: transition succeeded");
        let new_mode = self.state_machine.get_state().spreadsheet_mode();
        log::debug!(
            "dispatch_action: old_mode={:?}, new_mode={:?}",
            old_mode,
            new_mode
        );

        if old_mode != new_mode {
            log::debug!("dispatch_action: mode changed, dispatching event");
            self.event_dispatcher
                .dispatch(&SpreadsheetEvent::ModeChanged {
                    from: old_mode,
                    to: new_mode,
                });
            log::debug!("dispatch_action: event dispatched");
        }

        log::debug!("dispatch_action: returning Ok");
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

    pub fn get_resize_manager(&self) -> &ResizeManager {
        &self.resize_manager
    }

    pub fn get_resize_manager_mut(&mut self) -> &mut ResizeManager {
        &mut self.resize_manager
    }

    pub fn get_autocomplete_manager(&self) -> &AutocompleteManager {
        &self.autocomplete_manager
    }

    pub fn get_autocomplete_manager_mut(&mut self) -> &mut AutocompleteManager {
        &mut self.autocomplete_manager
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
        log::debug!(
            "Handling keyboard event: key='{}', mode={:?}",
            event.key,
            mode
        );

        match mode {
            SpreadsheetMode::Navigation => self.handle_navigation_key(event),
            SpreadsheetMode::Editing => self.handle_editing_key(event),
            SpreadsheetMode::Insert => self.handle_insert_key(event),
            SpreadsheetMode::Command => self.handle_command_key(event),
            SpreadsheetMode::Visual => self.handle_visual_key(event),
            _ => Ok(()),
        }
    }

    fn handle_navigation_key(&mut self, event: KeyboardEvent) -> Result<()> {
        let current_cursor = *self.state_machine.get_state().cursor();
        log::debug!(
            "Navigation mode key: '{}', current cursor: {:?}",
            event.key,
            current_cursor
        );

        match event.key.as_str() {
            // Edit mode triggers
            "i" => {
                // Get existing cell value for insert mode
                let existing_value = match self.facade.get_cell(&current_cursor) {
                    Some(cell) => {
                        if cell.has_formula() {
                            cell.raw_value.to_string()
                        } else {
                            cell.get_display_value().to_string()
                        }
                    }
                    None => String::new(),
                };
                log::debug!(
                    "'i' key pressed, starting insert mode with existing value: '{}', cursor at 0",
                    existing_value
                );
                let result = self.dispatch_action(Action::StartEditing {
                    edit_mode: Some(InsertMode::I),
                    initial_value: Some(existing_value),
                    cursor_position: Some(0),
                });
                if let Err(ref e) = result {
                    log::error!("Failed to start editing with 'i' key: {:?}", e);
                }
                result
            }
            "a" => {
                // Get existing cell value for append mode
                let existing_value = match self.facade.get_cell(&current_cursor) {
                    Some(cell) => {
                        if cell.has_formula() {
                            cell.raw_value.to_string()
                        } else {
                            cell.get_display_value().to_string()
                        }
                    }
                    None => String::new(),
                };
                let cursor_pos = existing_value.len();
                log::debug!(
                    "'a' key pressed, starting append mode with existing value: '{}', cursor at {}",
                    existing_value,
                    cursor_pos
                );
                let result = self.dispatch_action(Action::StartEditing {
                    edit_mode: Some(InsertMode::A),
                    initial_value: Some(existing_value),
                    cursor_position: Some(cursor_pos),
                });
                if let Err(ref e) = result {
                    log::error!("Failed to start editing with 'a' key: {:?}", e);
                }
                result
            }
            "Enter" => {
                // Enter key starts editing with empty content (replace mode)
                log::debug!("Enter key pressed, starting edit with empty value");

                let action = Action::StartEditing {
                    edit_mode: Some(InsertMode::I),     // Use insert mode
                    initial_value: Some(String::new()), // Start with empty value to replace content
                    cursor_position: Some(0),
                };

                let result = self.dispatch_action(action);

                if let Err(ref e) = result {
                    log::error!("Failed to start editing with Enter key: {:?}", e);
                }
                result
            }

            // Command mode
            ":" => self.dispatch_action(Action::EnterCommandMode),

            // Visual mode
            "v" => {
                use crate::state::{Selection, SelectionType, SpreadsheetVisualMode};
                self.dispatch_action(Action::EnterSpreadsheetVisualMode {
                    visual_mode: SpreadsheetVisualMode::Char,
                    selection: Selection {
                        selection_type: SelectionType::Cell {
                            address: current_cursor,
                        },
                        anchor: Some(current_cursor),
                    },
                })
            }

            // Navigation
            "ArrowUp" | "k" => {
                log::debug!("Moving cursor up");
                self.move_cursor(0, -1)
            }
            "ArrowDown" | "j" => {
                log::debug!("Moving cursor down");
                self.move_cursor(0, 1)
            }
            "ArrowLeft" | "h" => {
                log::debug!("Moving cursor left");
                self.move_cursor(-1, 0)
            }
            "ArrowRight" | "l" => {
                log::debug!("Moving cursor right");
                self.move_cursor(1, 0)
            }

            // Tab navigation
            "Tab" => {
                if event.shift {
                    // Shift+Tab moves left, then wraps to previous row
                    if current_cursor.col > 0 {
                        self.dispatch_action(Action::UpdateCursor {
                            cursor: CellAddress::new(current_cursor.col - 1, current_cursor.row),
                        })
                    } else if current_cursor.row > 0 {
                        // Wrap to end of previous row (assuming max 256 columns)
                        self.dispatch_action(Action::UpdateCursor {
                            cursor: CellAddress::new(255, current_cursor.row - 1),
                        })
                    } else {
                        Ok(())
                    }
                } else {
                    // Tab moves right, then wraps to next row
                    if current_cursor.col < 255 {
                        self.dispatch_action(Action::UpdateCursor {
                            cursor: CellAddress::new(current_cursor.col + 1, current_cursor.row),
                        })
                    } else if current_cursor.row < 9999 {
                        // Wrap to start of next row
                        self.dispatch_action(Action::UpdateCursor {
                            cursor: CellAddress::new(0, current_cursor.row + 1),
                        })
                    } else {
                        Ok(())
                    }
                }
            }

            // Cell operations
            "Delete" | "Backspace" => {
                // Clear the current cell
                log::debug!(
                    "{} key pressed, clearing cell at {:?}",
                    event.key,
                    current_cursor
                );
                self.facade.set_cell_value(&current_cursor, "")?;
                self.event_dispatcher
                    .dispatch(&SpreadsheetEvent::CellEditCompleted {
                        address: current_cursor,
                        value: String::new(),
                    });
                Ok(())
            }

            // Escape does nothing in navigation mode
            "Escape" => Ok(()),

            _ => {
                // Check if this is a single printable character that should start editing
                if event.key.len() == 1 && !event.ctrl && !event.alt && !event.meta {
                    // Single character typed - start editing with this character
                    log::debug!("Starting edit mode with typed character: '{}'", event.key);
                    let result = self.dispatch_action(Action::StartEditing {
                        edit_mode: Some(InsertMode::I),
                        initial_value: Some(event.key.clone()),
                        cursor_position: Some(1), // Position cursor after the typed character
                    });
                    if let Err(ref e) = result {
                        log::error!("Failed to start editing with typed character: {:?}", e);
                    }
                    result
                } else {
                    log::debug!("Unhandled navigation key: '{}'", event.key);
                    Ok(())
                }
            }
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

    fn handle_insert_key(&mut self, event: KeyboardEvent) -> Result<()> {
        if event.key == "Escape" {
            return self.dispatch_action(Action::Escape);
        }

        // In Insert mode, handle character input
        // The UI typically handles the actual text editing
        Ok(())
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

        log::debug!(
            "move_cursor: delta=({}, {}), current=({}, {}), new=({}, {})",
            delta_col,
            delta_row,
            current.col,
            current.row,
            new_col,
            new_row
        );

        self.viewport_manager.ensure_visible(&new_cursor);

        self.event_dispatcher
            .dispatch(&SpreadsheetEvent::CursorMoved {
                from: *current,
                to: new_cursor,
            });

        let result = self.dispatch_action(Action::UpdateCursor { cursor: new_cursor });
        log::debug!("UpdateCursor action dispatched, result: {:?}", result);
        result
    }

    fn complete_editing(&mut self) -> Result<()> {
        if let UIState::Editing {
            cursor,
            editing_value,
            ..
        } = self.state_machine.get_state()
        {
            let address = *cursor;
            let value = editing_value.clone();

            // Update the cell value in the facade and handle errors
            match self.facade.set_cell_value(&address, &value) {
                Ok(_) => {
                    // Check if the cell now contains an error value (e.g., from formula evaluation)
                    if let Some(gridcore_core::types::CellValue::Error(error_type)) =
                        self.facade.get_cell_raw_value(&address)
                    {
                        // Use the ErrorType's built-in full_display method
                        let enhanced_message =
                            format!("Formula error: {}", error_type.full_display());

                        log::error!("Error in cell {}: {}", address, enhanced_message);

                        // Emit error event for formula evaluation errors
                        self.event_dispatcher
                            .dispatch(&SpreadsheetEvent::ErrorOccurred {
                                message: enhanced_message,
                                severity: crate::controller::events::ErrorSeverity::Error,
                            });
                    }

                    self.event_dispatcher
                        .dispatch(&SpreadsheetEvent::CellEditCompleted { address, value });
                }
                Err(e) => {
                    // Use ErrorFormatter to get consistent error messages
                    let message = ErrorFormatter::format_error(&e);
                    log::error!("Parse/Set error in cell {}: {}", address, message);

                    // Emit error event for setting errors
                    self.event_dispatcher
                        .dispatch(&SpreadsheetEvent::ErrorOccurred {
                            message,
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
                            from: *self.state_machine.get_state().cursor(),
                            to: cell,
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
