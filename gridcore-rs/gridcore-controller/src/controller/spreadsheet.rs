use crate::behaviors::{resize::ResizeState, selection_stats};
use crate::controller::{
    DefaultViewportManager, EventDispatcher, GridConfiguration, KeyboardEvent, MouseEvent,
    SpreadsheetEvent, ViewportManager,
};
use crate::managers::{ErrorFormatter, ErrorManager};
use crate::state::{Action, CellMode, InsertMode, SpreadsheetMode, UIState, UIStateMachine};
use gridcore_core::{types::CellAddress, Result, SpreadsheetFacade};

pub struct SpreadsheetController {
    state_machine: UIStateMachine,
    facade: SpreadsheetFacade,
    event_dispatcher: EventDispatcher,
    viewport_manager: Box<dyn ViewportManager>,
    resize_state: ResizeState,
    error_manager: ErrorManager,
    config: GridConfiguration,
    formula_bar_value: String,
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
        let mut controller = Self {
            state_machine: UIStateMachine::new(None),
            facade: SpreadsheetFacade::new(),
            event_dispatcher: EventDispatcher::new(),
            viewport_manager,
            resize_state: ResizeState::default(),
            error_manager: ErrorManager::new(),
            config,
            formula_bar_value: String::new(),
        };

        // Subscribe to state changes
        controller.setup_state_listener();

        // Initialize formula bar with current cell value
        controller.update_formula_bar_from_cursor();

        controller
    }

    pub fn with_state(initial_state: UIState) -> Self {
        let config = GridConfiguration::default();

        let mut controller = Self {
            state_machine: UIStateMachine::new(Some(initial_state)),
            facade: SpreadsheetFacade::new(),
            event_dispatcher: EventDispatcher::new(),
            viewport_manager: Box::new(
                DefaultViewportManager::new(1000, 100).with_config(config.clone()),
            ),
            resize_state: ResizeState::default(),
            error_manager: ErrorManager::new(),
            config,
            formula_bar_value: String::new(),
        };

        controller.setup_state_listener();

        // Initialize formula bar with current cell value
        controller.update_formula_bar_from_cursor();

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

        // Handle formula bar actions
        if let Action::UpdateFormulaBar { value } = &action {
            self.set_formula_bar_value(value.clone());
            return Ok(());
        }

        // Handle sheet actions
        if let Action::AddSheet { name } = &action {
            return self.add_sheet(name);
        }

        if let Action::RemoveSheet { name } = &action {
            return self.remove_sheet(name);
        }

        if let Action::RenameSheet { old_name, new_name } = &action {
            return self.rename_sheet(old_name, new_name);
        }

        if let Action::SetActiveSheet { name } = &action {
            return self.set_active_sheet(name);
        }

        if matches!(action, Action::SubmitFormulaBar) {
            // Submit the formula bar value to the current cell
            let value = self.formula_bar_value.clone();
            let cursor = self.get_cursor();

            // Set cell value through facade
            match self.facade.set_cell_value(&cursor, &value) {
                Ok(_) => {
                    // Check if the cell now contains an error value
                    if let Some(gridcore_core::types::CellValue::Error(error_type)) =
                        self.facade.get_cell_raw_value(&cursor)
                    {
                        let enhanced_message =
                            format!("Formula error: {}", error_type.full_display());
                        self.emit_error(
                            enhanced_message,
                            crate::controller::events::ErrorSeverity::Error,
                        );
                    }

                    self.event_dispatcher
                        .dispatch(&SpreadsheetEvent::CellEditCompleted {
                            address: cursor,
                            value: value.clone(),
                        });

                    // Clear formula bar after successful submission
                    if value.is_empty()
                        || !matches!(
                            self.facade.get_cell_raw_value(&cursor),
                            Some(gridcore_core::types::CellValue::Error(_))
                        )
                    {
                        self.set_formula_bar_value(String::new());
                    }
                }
                Err(e) => {
                    let message = ErrorFormatter::format_error(&e);
                    self.emit_error(message, crate::controller::events::ErrorSeverity::Error);
                }
            }
            return Ok(());
        }

        if let Action::SubmitCellEdit { value } = &action {
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
                            self.emit_error(
                                enhanced_message,
                                crate::controller::events::ErrorSeverity::Error,
                            );
                        }

                        self.event_dispatcher
                            .dispatch(&SpreadsheetEvent::CellEditCompleted {
                                address,
                                value: value.clone(),
                            });

                        // Update formula bar to show the new value
                        self.update_formula_bar_from_cursor();
                    }
                    Err(e) => {
                        let message = ErrorFormatter::format_error(&e);
                        log::error!("Parse/Set error in cell {}: {}", address, message);
                        self.emit_error(message, crate::controller::events::ErrorSeverity::Error);
                    }
                }

                // Exit editing mode
                return self.dispatch_action(Action::ExitToNavigation);
            }
            return Ok(());
        }

        let old_mode = self.state_machine.get_state().spreadsheet_mode();
        let old_cursor = *self.state_machine.get_state().cursor();

        log::debug!(
            "dispatch_action: about to transition with action {:?}",
            action
        );

        // Store the action type for later event emission
        let action_clone = action.clone();

        self.state_machine.transition(action)?;
        log::debug!("dispatch_action: transition succeeded");
        let new_mode = self.state_machine.get_state().spreadsheet_mode();
        let _new_cursor = *self.state_machine.get_state().cursor();

        log::debug!(
            "dispatch_action: old_mode={:?}, new_mode={:?}",
            old_mode,
            new_mode
        );

        // Emit CursorMoved event if the cursor changed
        if let Action::UpdateCursor { cursor } = action_clone {
            if old_cursor != cursor {
                self.event_dispatcher
                    .dispatch(&SpreadsheetEvent::CursorMoved {
                        from: old_cursor,
                        to: cursor,
                    });
                log::debug!("dispatch_action: CursorMoved event dispatched");
            }
        }

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

    /// Get the display value for a cell in the UI
    /// Returns the formula if the cell has one, otherwise the display value
    pub fn get_cell_display_for_ui(&self, address: &CellAddress) -> String {
        if let Some(cell) = self.facade.get_cell(address) {
            if cell.has_formula() {
                // Show the formula for editing
                cell.raw_value.to_string()
            } else {
                // Show the display value
                cell.get_display_value().to_string()
            }
        } else {
            String::new()
        }
    }

    /// Emit an error event and add to error manager
    pub fn emit_error(
        &mut self,
        message: String,
        severity: crate::controller::events::ErrorSeverity,
    ) {
        // Add to error manager
        self.error_manager.add_error(message.clone(), severity);

        // Dispatch event for UI updates
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

    pub fn get_resize_state(&self) -> &ResizeState {
        &self.resize_state
    }

    pub fn get_resize_state_mut(&mut self) -> &mut ResizeState {
        &mut self.resize_state
    }

    pub fn get_current_selection_stats(&self) -> selection_stats::SelectionStats {
        use crate::state::SelectionType;

        // Get the current selection from the state
        let selection = self.state_machine.get_state().selection();

        if let Some(sel) = selection {
            // Calculate stats based on selection type
            match &sel.selection_type {
                SelectionType::Range { start, end } => {
                    selection_stats::calculate_range(&self.facade, start, end)
                }
                SelectionType::Cell { address } => {
                    selection_stats::calculate_single_cell(&self.facade, address)
                }
                SelectionType::Column { columns: _ } => {
                    // For column selections, calculate stats for all cells in those columns
                    // For now, just return default stats
                    // TODO: Implement column selection stats
                    selection_stats::SelectionStats::default()
                }
                SelectionType::Row { rows: _ } => {
                    // For row selections, calculate stats for all cells in those rows
                    // For now, just return default stats
                    // TODO: Implement row selection stats
                    selection_stats::SelectionStats::default()
                }
                SelectionType::Multi { selections: _ } => {
                    // For multi selections, we would need to handle multiple ranges
                    // For now, just return default stats
                    // TODO: Implement multi selection stats
                    selection_stats::SelectionStats::default()
                }
            }
        } else {
            // No selection, calculate for current cursor position
            let cursor = self.state_machine.get_state().cursor();
            selection_stats::calculate_single_cell(&self.facade, cursor)
        }
    }

    /// Get the error manager
    pub fn get_error_manager(&self) -> &ErrorManager {
        &self.error_manager
    }

    /// Get mutable reference to error manager
    pub fn get_error_manager_mut(&mut self) -> &mut ErrorManager {
        &mut self.error_manager
    }

    /// Get active errors from the error manager
    pub fn get_active_errors(&self) -> Vec<crate::managers::ErrorEntry> {
        self.error_manager.get_active_errors()
    }

    /// Clear all errors
    pub fn clear_all_errors(&mut self) {
        self.error_manager.clear_all();
    }

    /// Remove a specific error by ID
    pub fn remove_error(&mut self, id: usize) -> bool {
        self.error_manager.remove_error(id)
    }

    /// Dispatch an event to all listeners
    pub fn dispatch_event(&mut self, event: SpreadsheetEvent) {
        self.event_dispatcher.dispatch(&event);
    }

    /// Get the current formula bar value
    pub fn get_formula_bar_value(&self) -> &str {
        &self.formula_bar_value
    }

    /// Set the formula bar value and dispatch event
    pub fn set_formula_bar_value(&mut self, value: String) {
        self.formula_bar_value = value.clone();
        self.event_dispatcher
            .dispatch(&SpreadsheetEvent::FormulaBarUpdated { value });
    }

    /// Update formula bar based on current cursor position
    pub fn update_formula_bar_from_cursor(&mut self) {
        let cursor = self.get_cursor();
        let value = self.get_cell_display_for_ui(&cursor);
        self.set_formula_bar_value(value);
    }

    // Sheet management methods

    /// Get list of all sheets
    pub fn get_sheets(&self) -> Vec<(String, usize)> {
        self.facade.get_sheets()
    }

    /// Get the active sheet name
    pub fn get_active_sheet(&self) -> String {
        self.facade.get_active_sheet()
    }

    /// Set the active sheet
    pub fn set_active_sheet(&mut self, sheet_name: &str) -> Result<()> {
        self.facade.set_active_sheet(sheet_name)?;
        self.event_dispatcher
            .dispatch(&SpreadsheetEvent::SheetChanged {
                from: self.get_active_sheet(),
                to: sheet_name.to_string(),
            });
        Ok(())
    }

    /// Add a new sheet
    pub fn add_sheet(&mut self, name: &str) -> Result<()> {
        self.facade.add_sheet(name)?;
        self.event_dispatcher
            .dispatch(&SpreadsheetEvent::SheetAdded {
                name: name.to_string(),
            });
        Ok(())
    }

    /// Remove a sheet
    pub fn remove_sheet(&mut self, name: &str) -> Result<()> {
        self.facade.remove_sheet(name)?;
        self.event_dispatcher
            .dispatch(&SpreadsheetEvent::SheetRemoved {
                name: name.to_string(),
            });
        Ok(())
    }

    /// Rename a sheet
    pub fn rename_sheet(&mut self, old_name: &str, new_name: &str) -> Result<()> {
        self.facade.rename_sheet(old_name, new_name)?;
        self.event_dispatcher
            .dispatch(&SpreadsheetEvent::SheetRenamed {
                old_name: old_name.to_string(),
                new_name: new_name.to_string(),
            });
        Ok(())
    }

    /// Get the number of sheets
    pub fn sheet_count(&self) -> usize {
        self.facade.sheet_count()
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
                let existing_value = self.get_cell_display_for_ui(&current_cursor);
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
                let existing_value = self.get_cell_display_for_ui(&current_cursor);
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
                // Enter key starts editing in Insert mode with empty content
                log::debug!("Enter key pressed, starting edit in Insert mode with empty value");

                let action = Action::StartEditing {
                    edit_mode: Some(InsertMode::I), // Use Insert mode for immediate typing
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

                // Update formula bar to show empty value
                self.update_formula_bar_from_cursor();
                Ok(())
            }

            // Escape does nothing in navigation mode
            "Escape" => Ok(()),

            _ => {
                // Check if this is a vim mode command that should be handled specially
                match event.key.as_str() {
                    // Vim mode commands for entering insert mode
                    "i" => {
                        // Get existing value for the current cell
                        let existing_value = self.get_cell_display_for_ui(&current_cursor);
                        log::debug!("'i' key pressed, entering insert mode at beginning");
                        self.dispatch_action(Action::StartEditing {
                            edit_mode: Some(InsertMode::I),
                            initial_value: Some(existing_value),
                            cursor_position: Some(0), // Cursor at beginning for 'i'
                        })
                    }
                    "a" => {
                        // Get existing value for the current cell
                        let existing_value = self.get_cell_display_for_ui(&current_cursor);
                        let cursor_pos = if existing_value.is_empty() { 0 } else { 1 };
                        log::debug!("'a' key pressed, entering insert mode after first char");
                        self.dispatch_action(Action::StartEditing {
                            edit_mode: Some(InsertMode::A),
                            initial_value: Some(existing_value),
                            cursor_position: Some(cursor_pos),
                        })
                    }
                    "I" => {
                        // Get existing value for the current cell
                        let existing_value = self.get_cell_display_for_ui(&current_cursor);
                        log::debug!("'I' key pressed, entering insert mode at start of line");
                        self.dispatch_action(Action::StartEditing {
                            edit_mode: Some(InsertMode::CapitalI),
                            initial_value: Some(existing_value),
                            cursor_position: Some(0),
                        })
                    }
                    "A" => {
                        // Get existing value for the current cell
                        let existing_value = self.get_cell_display_for_ui(&current_cursor);
                        let cursor_pos = existing_value.len();
                        log::debug!("'A' key pressed, entering insert mode at end of line");
                        self.dispatch_action(Action::StartEditing {
                            edit_mode: Some(InsertMode::CapitalA),
                            initial_value: Some(existing_value),
                            cursor_position: Some(cursor_pos),
                        })
                    }
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
                                log::error!(
                                    "Failed to start editing with typed character: {:?}",
                                    e
                                );
                            }
                            result
                        } else {
                            log::debug!("Unhandled navigation key: '{}'", event.key);
                            Ok(())
                        }
                    }
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

        self.dispatch_action(Action::UpdateCursor { cursor: new_cursor })?;

        // Update formula bar to show new cell's content
        self.update_formula_bar_from_cursor();

        Ok(())
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
                        self.emit_error(
                            enhanced_message,
                            crate::controller::events::ErrorSeverity::Error,
                        );
                    }

                    self.event_dispatcher
                        .dispatch(&SpreadsheetEvent::CellEditCompleted { address, value });
                }
                Err(e) => {
                    // Use ErrorFormatter to get consistent error messages
                    let message = ErrorFormatter::format_error(&e);
                    log::error!("Parse/Set error in cell {}: {}", address, message);

                    // Emit error event for setting errors
                    self.emit_error(message, crate::controller::events::ErrorSeverity::Error);
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

#[cfg(test)]
mod sheet_tests {
    use super::*;
    use crate::controller::events::ErrorSeverity;
    use std::sync::{Arc, Mutex};

    #[test]
    fn test_get_sheets() {
        let controller = SpreadsheetController::new();
        let sheets = controller.get_sheets();

        // Should have at least one default sheet
        assert!(!sheets.is_empty());
        assert_eq!(sheets[0].0, "Sheet1");
    }

    #[test]
    fn test_add_sheet() {
        let mut controller = SpreadsheetController::new();

        // Add a new sheet
        let result = controller.add_sheet("TestSheet");
        assert!(result.is_ok());

        // Verify sheet was added
        let sheets = controller.get_sheets();
        assert!(sheets.iter().any(|(name, _)| name == "TestSheet"));
    }

    #[test]
    fn test_remove_sheet() {
        let mut controller = SpreadsheetController::new();

        // Add sheets
        controller.add_sheet("Sheet2").unwrap();
        controller.add_sheet("Sheet3").unwrap();

        // Remove a sheet
        let result = controller.remove_sheet("Sheet2");
        assert!(result.is_ok());

        // Verify sheet was removed
        let sheets = controller.get_sheets();
        assert!(!sheets.iter().any(|(name, _)| name == "Sheet2"));
        assert!(sheets.iter().any(|(name, _)| name == "Sheet3"));
    }

    #[test]
    fn test_rename_sheet() {
        let mut controller = SpreadsheetController::new();

        // Add a sheet
        controller.add_sheet("OldName").unwrap();

        // Rename it
        let result = controller.rename_sheet("OldName", "NewName");
        assert!(result.is_ok());

        // Verify rename
        let sheets = controller.get_sheets();
        assert!(!sheets.iter().any(|(name, _)| name == "OldName"));
        assert!(sheets.iter().any(|(name, _)| name == "NewName"));
    }

    #[test]
    fn test_set_active_sheet() {
        let mut controller = SpreadsheetController::new();

        // Add multiple sheets
        controller.add_sheet("Sheet2").unwrap();
        controller.add_sheet("Sheet3").unwrap();

        // Set active sheet
        let result = controller.set_active_sheet("Sheet2");
        assert!(result.is_ok());

        // Verify active sheet
        let active = controller.get_active_sheet();
        assert_eq!(active, "Sheet2");
    }

    #[test]
    fn test_sheet_count() {
        let mut controller = SpreadsheetController::new();

        let initial_count = controller.sheet_count();
        assert!(initial_count > 0);

        // Add sheets
        controller.add_sheet("Sheet2").unwrap();
        controller.add_sheet("Sheet3").unwrap();

        // Verify count increased
        assert_eq!(controller.sheet_count(), initial_count + 2);
    }

    #[test]
    fn test_sheet_events() {
        let mut controller = SpreadsheetController::new();
        let events = Arc::new(Mutex::new(Vec::new()));
        let events_clone = events.clone();

        // Subscribe to events
        controller.subscribe_to_events(move |event| {
            let mut e = events_clone.lock().unwrap();
            e.push(format!("{:?}", event));
        });

        // Add a sheet
        controller.add_sheet("TestSheet").unwrap();

        // Check that SheetAdded event was dispatched
        let e = events.lock().unwrap();
        assert!(e.iter().any(|s| s.contains("SheetAdded")));
        assert!(e.iter().any(|s| s.contains("TestSheet")));
    }

    #[test]
    fn test_sheet_actions() {
        let mut controller = SpreadsheetController::new();
        let events = Arc::new(Mutex::new(Vec::new()));
        let events_clone = events.clone();

        // Subscribe to events
        controller.subscribe_to_events(move |event| {
            let mut e = events_clone.lock().unwrap();
            e.push(format!("{:?}", event));
        });

        // Test AddSheet action
        controller
            .dispatch_action(Action::AddSheet {
                name: "NewSheet".to_string(),
            })
            .unwrap();

        let sheets = controller.get_sheets();
        assert!(sheets.iter().any(|(name, _)| name == "NewSheet"));

        // Test RenameSheet action
        controller
            .dispatch_action(Action::RenameSheet {
                old_name: "NewSheet".to_string(),
                new_name: "RenamedSheet".to_string(),
            })
            .unwrap();

        let sheets = controller.get_sheets();
        assert!(sheets.iter().any(|(name, _)| name == "RenamedSheet"));

        // Test SetActiveSheet action
        controller
            .dispatch_action(Action::SetActiveSheet {
                name: "RenamedSheet".to_string(),
            })
            .unwrap();

        assert_eq!(controller.get_active_sheet(), "RenamedSheet");

        // Verify events were dispatched
        let e = events.lock().unwrap();
        assert!(e.iter().any(|s| s.contains("SheetAdded")));
        assert!(e.iter().any(|s| s.contains("SheetRenamed")));
        assert!(e.iter().any(|s| s.contains("SheetChanged")));
    }

    #[test]
    fn test_remove_last_sheet_fails() {
        let mut controller = SpreadsheetController::new();

        // Get initial sheets
        let sheets = controller.get_sheets();
        if sheets.len() == 1 {
            // Try to remove the last sheet - should fail
            let result = controller.remove_sheet(&sheets[0].0);
            assert!(result.is_err());
        }
    }

    #[test]
    fn test_error_manager_integration() {
        let mut controller = SpreadsheetController::new();

        // Add an error
        controller.emit_error("Test error".to_string(), ErrorSeverity::Error);

        // Check that error was added
        let errors = controller.get_active_errors();
        assert_eq!(errors.len(), 1);
        assert_eq!(errors[0].message, "Test error");

        // Add warning
        controller.emit_error("Test warning".to_string(), ErrorSeverity::Warning);

        // Check both are present
        let errors = controller.get_active_errors();
        assert_eq!(errors.len(), 2);

        // Clear all errors
        controller.clear_all_errors();
        let errors = controller.get_active_errors();
        assert_eq!(errors.len(), 0);
    }

    #[test]
    fn test_error_removal() {
        let mut controller = SpreadsheetController::new();

        // Add multiple errors
        controller.emit_error("Error 1".to_string(), ErrorSeverity::Error);
        controller.emit_error("Error 2".to_string(), ErrorSeverity::Warning);
        controller.emit_error("Error 3".to_string(), ErrorSeverity::Info);

        let errors = controller.get_active_errors();
        assert_eq!(errors.len(), 3);

        // Remove middle error
        let error_id = errors[1].id;
        assert!(controller.remove_error(error_id));

        // Check that only 2 remain
        let errors = controller.get_active_errors();
        assert_eq!(errors.len(), 2);
        assert_eq!(errors[0].message, "Error 1");
        assert_eq!(errors[1].message, "Error 3");

        // Try to remove non-existent error
        assert!(!controller.remove_error(999));
    }

    #[test]
    fn test_error_events() {
        let mut controller = SpreadsheetController::new();
        let events = Arc::new(Mutex::new(Vec::new()));
        let events_clone = events.clone();

        // Subscribe to events
        controller.subscribe_to_events(move |event| {
            let mut e = events_clone.lock().unwrap();
            e.push(format!("{:?}", event));
        });

        // Emit an error
        controller.emit_error("Test error".to_string(), ErrorSeverity::Error);

        // Check that ErrorOccurred event was dispatched
        let e = events.lock().unwrap();
        assert!(e.iter().any(|s| s.contains("ErrorOccurred")));
        assert!(e.iter().any(|s| s.contains("Test error")));
    }
}
