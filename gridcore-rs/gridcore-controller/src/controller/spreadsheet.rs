use crate::behaviors::{resize::ResizeState, selection_stats};
use crate::controller::{
    EditorMode, EventDispatcher, GridConfiguration, KeyboardEvent, MouseEvent, SpreadsheetEvent,
    ViewportManager,
};
use crate::managers::ErrorSystem;
use crate::state::{Action, Selection, UIState};
use gridcore_core::{types::CellAddress, Result, SpreadsheetFacade};

use super::cell_editor::{CellEditResult, CellEditor};
use super::formula_bar::FormulaBarManager;

pub struct SpreadsheetController {
    // pub(super) state_machine: UIStateMachine, // Removed in hybrid refactor
    pub(super) facade: SpreadsheetFacade,
    pub(super) event_dispatcher: EventDispatcher,
    pub(super) viewport_manager: ViewportManager,
    pub(super) resize_state: ResizeState,
    pub(super) error_system: ErrorSystem,
    pub(super) config: GridConfiguration,
    pub(super) formula_bar_manager: FormulaBarManager,

    // NEW: Direct state fields for hybrid approach
    cursor: CellAddress,
    selection: Option<Selection>,
    mode: EditorMode,
    formula_bar: String,
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
        let viewport_manager =
            ViewportManager::new(config.total_rows as u32, config.total_cols as u32)
                .with_config(config.clone());
        Self::with_viewport(viewport_manager, config)
    }

    pub fn with_viewport(viewport_manager: ViewportManager, config: GridConfiguration) -> Self {
        let mut controller = Self {
            // state_machine: UIStateMachine::new(None), // Removed in hybrid refactor
            facade: SpreadsheetFacade::new(),
            event_dispatcher: EventDispatcher::new(),
            viewport_manager,
            resize_state: ResizeState::default(),
            error_system: ErrorSystem::new(),
            config,
            formula_bar_manager: FormulaBarManager::new(),
            // Initialize direct state fields
            cursor: CellAddress::new(0, 0),
            selection: None,
            mode: EditorMode::Navigation,
            formula_bar: String::new(),
        };

        // Subscribe to state changes
        controller.setup_state_listener();

        // Initialize formula bar with current cell value
        controller.update_formula_bar_from_cursor();

        controller
    }

    pub fn with_state(initial_state: UIState) -> Self {
        let config = GridConfiguration::default();

        // Extract cursor from initial state
        let cursor = *initial_state.cursor();

        let mut controller = Self {
            // state_machine: UIStateMachine::new(Some(initial_state)), // Removed in hybrid refactor
            facade: SpreadsheetFacade::new(),
            event_dispatcher: EventDispatcher::new(),
            viewport_manager: ViewportManager::new(1000, 100).with_config(config.clone()),
            resize_state: ResizeState::default(),
            error_system: ErrorSystem::new(),
            config,
            formula_bar_manager: FormulaBarManager::new(),
            // Initialize direct state fields
            cursor,
            selection: None,
            mode: EditorMode::Navigation,
            formula_bar: String::new(),
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

    /// Get the current UI state
    pub fn state(&self) -> UIState {
        // Temporary: construct UIState from direct fields
        UIState::Navigation {
            core: crate::state::CoreState {
                cursor: self.cursor,
                viewport: crate::state::ViewportInfo {
                    start_row: 0,
                    start_col: 0,
                    rows: 50,
                    cols: 20,
                },
            },
            selection: self.selection.clone(),
            modal: None,
        }
    }

    /// Get the current cursor position
    pub fn cursor(&self) -> CellAddress {
        self.cursor
    }

    // NEW: Direct state accessors for hybrid approach

    /// Get the current cursor position (direct)
    pub fn get_cursor(&self) -> CellAddress {
        self.cursor
    }

    /// Get the current selection
    pub fn get_selection(&self) -> Option<&Selection> {
        self.selection.as_ref()
    }

    /// Get the current editor mode
    pub fn get_mode(&self) -> &EditorMode {
        &self.mode
    }

    /// Get the formula bar content
    pub fn get_formula_bar(&self) -> &str {
        &self.formula_bar
    }

    /// Set the cursor position directly
    pub fn set_cursor(&mut self, cursor: CellAddress) {
        let old = self.cursor;
        self.cursor = cursor;

        // Emit event for cursor movement
        self.event_dispatcher
            .dispatch(&SpreadsheetEvent::CursorMoved {
                from: old,
                to: cursor,
            });

        // Update formula bar to reflect new cell
        self.update_formula_bar_from_cursor();
    }

    /// Set the selection directly  
    pub fn set_selection(&mut self, selection: Option<Selection>) {
        self.selection = selection;

        // Emit state changed event for UI update
        self.event_dispatcher
            .dispatch(&SpreadsheetEvent::StateChanged);
    }

    /// Set the editor mode directly
    pub fn set_mode(&mut self, mode: EditorMode) {
        self.mode = mode;

        // Emit state changed event
        self.event_dispatcher
            .dispatch(&SpreadsheetEvent::StateChanged);
    }

    /// Set the formula bar content directly
    pub fn set_formula_bar(&mut self, value: String) {
        self.formula_bar = value.clone();
        self.event_dispatcher
            .dispatch(&SpreadsheetEvent::FormulaBarUpdated { value });
    }

    /// Get direct access to the state machine
    pub fn state_machine(&mut self) -> super::state_access::DirectStateAccess<'_> {
        // Temporarily return a dummy accessor
        super::state_access::DirectStateAccess::new(&mut self.formula_bar)
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
            let value = self.formula_bar_manager.value().to_string();
            let cursor = self.cursor();

            // Use CellEditor to handle submission
            let result = CellEditor::submit_formula_bar(&mut self.facade, cursor, value)?;

            // Process events from result
            for (event, error_info) in result.create_events() {
                self.event_dispatcher.dispatch(&event);
                if let Some((msg, severity)) = error_info {
                    self.error_system.add_error(msg, severity);
                }
            }

            // Clear formula bar if needed
            if let CellEditResult::Success {
                should_clear_formula_bar: true,
                ..
            } = result
            {
                self.formula_bar_manager.clear();
                let event = self.formula_bar_manager.create_update_event();
                self.event_dispatcher.dispatch(&event);
            }

            return Ok(());
        }

        if let Action::SubmitCellEdit { value } = &action {
            // Update the editing value and complete editing
            if let UIState::Editing { core, .. } = &self.state() {
                let address = core.cursor;

                // Use CellEditor to handle submission
                let result =
                    CellEditor::submit_formula_bar(&mut self.facade, address, value.clone())?;

                // Process events from result
                for (event, error_info) in result.create_events() {
                    self.event_dispatcher.dispatch(&event);
                    if let Some((msg, severity)) = error_info {
                        self.error_system.add_error(msg, severity);
                    }
                }

                // Update formula bar to show the new value
                self.update_formula_bar_from_cursor();

                // Exit editing mode
                return self.dispatch_action(Action::ExitToNavigation);
            }
            return Ok(());
        }

        let state = self.state();
        let old_mode = state.spreadsheet_mode();
        let old_cursor = *state.cursor();

        log::debug!(
            "dispatch_action: about to transition with action {:?}",
            action
        );

        // Store the action type for later event emission
        let action_clone = action.clone();

        // TODO: Handle action directly without state machine
        // self.state_machine.transition(action)?;
        log::debug!("dispatch_action: transition succeeded");
        let new_state = self.state();
        let new_mode = new_state.spreadsheet_mode();
        let _new_cursor = *new_state.cursor();

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
                .dispatch(&SpreadsheetEvent::StateChanged);
            log::debug!("dispatch_action: event dispatched");
        }

        log::debug!("dispatch_action: returning Ok");
        Ok(())
    }

    /// Get the spreadsheet facade for data operations
    pub fn facade(&self) -> &SpreadsheetFacade {
        &self.facade
    }

    /// Get mutable access to the spreadsheet facade
    pub fn facade_mut(&mut self) -> &mut SpreadsheetFacade {
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

    // Operation facades have been removed in hybrid refactor
    // Use direct methods on SpreadsheetController instead
    
    /// Add an error to the error system
    pub fn add_error(&mut self, msg: String, severity: crate::controller::events::ErrorSeverity) {
        self.error_system.add_error(msg, severity);
    }
    
    /// Remove an error from the error system
    pub fn remove_error(&mut self, error_id: usize) {
        self.error_system.remove_error(error_id);
    }
    
    /// Clear all errors
    pub fn clear_errors(&mut self) {
        self.error_system.clear_all();
    }
    
    /// Get current errors
    pub fn get_errors(&self) -> Vec<crate::managers::ErrorEntry> {
        self.error_system.get_errors()
    }

    pub fn get_viewport_manager(&self) -> &ViewportManager {
        &self.viewport_manager
    }

    pub fn get_viewport_manager_mut(&mut self) -> &mut ViewportManager {
        &mut self.viewport_manager
    }

    pub fn get_config(&self) -> &GridConfiguration {
        &self.config
    }

    /// Get the resize state
    pub fn resize_state(&self) -> &ResizeState {
        &self.resize_state
    }

    /// Get mutable access to the resize state
    pub fn resize_state_mut(&mut self) -> &mut ResizeState {
        &mut self.resize_state
    }

    pub fn get_current_selection_stats(&self) -> selection_stats::SelectionStats {
        use crate::state::SelectionType;

        // Get the current selection from the state
        let state = self.state();
        let selection = state.selection();

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
            let state = self.state();
            let cursor = state.cursor();
            selection_stats::calculate_single_cell(&self.facade, cursor)
        }
    }

    /// Get the error manager
    pub fn get_error_manager(&self) -> &ErrorSystem {
        &self.error_system
    }

    /// Get mutable reference to error manager
    pub fn get_error_manager_mut(&mut self) -> &mut ErrorSystem {
        &mut self.error_system
    }

    /// Get active errors from the error manager
    pub fn get_active_errors(&self) -> Vec<crate::managers::ErrorEntry> {
        self.error_system.get_active_errors()
    }

    /// Clear all errors
    pub fn clear_all_errors(&mut self) {
        self.error_system.clear_all();
    }


    /// Dispatch an event to all listeners
    pub fn dispatch_event(&mut self, event: SpreadsheetEvent) {
        self.event_dispatcher.dispatch(&event);
    }

    /// Get the current formula bar value
    pub fn get_formula_bar_value(&self) -> &str {
        self.formula_bar_manager.value()
    }

    /// Set the formula bar value and dispatch event
    pub fn set_formula_bar_value(&mut self, value: String) {
        let event = {
            self.formula_bar_manager.set_value(value);
            self.formula_bar_manager.create_update_event()
        };
        self.event_dispatcher.dispatch(&event);
    }

    /// Update formula bar based on current cursor position
    pub fn update_formula_bar_from_cursor(&mut self) {
        let cursor = self.cursor();
        let value = self.get_cell_display_for_ui(&cursor);
        let event = {
            self.formula_bar_manager.set_value(value);
            self.formula_bar_manager.create_update_event()
        };
        self.event_dispatcher.dispatch(&event);
    }

    /// Sync direct state fields with the state machine
    /// This is useful during the transition period
    pub fn sync_from_state_machine(&mut self) {
        let state = self.state();

        // Sync cursor
        self.cursor = *state.cursor();

        // Sync mode based on state type
        self.mode = match &state {
            UIState::Navigation { modal, .. } => {
                if let Some(modal) = modal {
                    match modal {
                        crate::state::NavigationModal::Visual { mode, anchor, .. } => {
                            EditorMode::Visual {
                                mode: mode.clone(),
                                anchor: anchor.clone(),
                            }
                        }
                        crate::state::NavigationModal::Command { value } => EditorMode::Command {
                            value: value.clone(),
                        },
                        crate::state::NavigationModal::Resize { .. } => EditorMode::Resizing,
                        crate::state::NavigationModal::Insert { .. }
                        | crate::state::NavigationModal::Delete { .. }
                        | crate::state::NavigationModal::BulkOperation { .. } => {
                            // These modals stay in navigation mode for now
                            EditorMode::Navigation
                        }
                    }
                } else {
                    EditorMode::Navigation
                }
            }
            UIState::Editing {
                value,
                cursor_pos,
                mode: edit_mode,
                ..
            } => EditorMode::Editing {
                value: value.clone(),
                cursor_pos: cursor_pos.clone(),
                insert_mode: if matches!(edit_mode, crate::state::EditMode::Insert) {
                    Some(crate::state::InsertMode::I)
                } else {
                    None
                },
            },
        };

        // Sync selection based on visual mode
        if let UIState::Navigation {
            modal: Some(crate::state::NavigationModal::Visual { selection, .. }),
            ..
        } = &state
        {
            self.selection = Some(selection.clone());
        } else {
            self.selection = None;
        }

        // Sync formula bar
        self.formula_bar = self.formula_bar_manager.value().to_string();
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
        super::input_handler::InputHandler::new(self).handle_keyboard_event(event)
    }

    pub(super) fn complete_editing(&mut self) -> Result<()> {
        // Use CellEditor to complete editing
        if let Some(result) =
            CellEditor::complete_editing(&self.state(), &mut self.facade)
        {
            // Process events from result
            for (event, error_info) in result.create_events() {
                self.event_dispatcher.dispatch(&event);
                if let Some((msg, severity)) = error_info {
                    self.error_system.add_error(msg, severity);
                }
            }

            // Take next action if any
            if let Some(action) = result.next_action() {
                return self.dispatch_action(action);
            }
        }
        Ok(())
    }

    // Mouse event handling
    pub fn handle_mouse_event(&mut self, event: MouseEvent) -> Result<()> {
        super::input_handler::InputHandler::new(self).handle_mouse_event(event)
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
        controller
            .errors()
            .emit("Test error".to_string(), ErrorSeverity::Error);

        // Check that error was added
        let errors = controller.get_active_errors();
        assert_eq!(errors.len(), 1);
        assert_eq!(errors[0].message, "Test error");

        // Add warning
        controller
            .errors()
            .emit("Test warning".to_string(), ErrorSeverity::Warning);

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
        controller
            .errors()
            .emit("Error 1".to_string(), ErrorSeverity::Error);
        controller
            .errors()
            .emit("Error 2".to_string(), ErrorSeverity::Warning);
        controller
            .errors()
            .emit("Error 3".to_string(), ErrorSeverity::Info);

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
        controller
            .errors()
            .emit("Test error".to_string(), ErrorSeverity::Error);

        // Check that ErrorOccurred event was dispatched
        let e = events.lock().unwrap();
        assert!(e.iter().any(|s| s.contains("ErrorOccurred")));
        assert!(e.iter().any(|s| s.contains("Test error")));
    }
}
