use crate::controller::{KeyboardEvent, MouseEvent, SpreadsheetEvent};
use crate::state::{
    Action, EditMode, InsertMode, NavigationModal, Selection, SelectionType, UIState,
};
use gridcore_core::{types::CellAddress, Result};

/// Handles all input events for the spreadsheet controller
pub struct InputHandler<'a> {
    controller: &'a mut super::SpreadsheetController,
}

impl<'a> InputHandler<'a> {
    pub fn new(controller: &'a mut super::SpreadsheetController) -> Self {
        Self { controller }
    }

    /// Main keyboard event handler that delegates to mode-specific handlers
    pub fn handle_keyboard_event(&mut self, event: KeyboardEvent) -> Result<()> {
        // First sync direct state with state machine during transition
        self.controller.sync_from_state_machine();

        // Use direct mode field for routing
        let mode = self.controller.get_mode().clone();
        log::debug!(
            "Handling keyboard event: key='{}', mode={:?}",
            event.key,
            mode
        );

        use super::mode::EditorMode;
        match mode {
            EditorMode::Navigation => self.handle_navigation_key(event),
            EditorMode::Editing { .. } => self.handle_editing_key(event),
            EditorMode::Command { .. } => self.handle_command_key(event),
            EditorMode::Visual { .. } => self.handle_visual_key(event),
            EditorMode::Resizing => Ok(()),
        }
    }

    fn handle_navigation_key(&mut self, event: KeyboardEvent) -> Result<()> {
        let current_cursor = self.controller.cursor();
        log::debug!(
            "Navigation mode key: '{}', current cursor: {:?}",
            event.key,
            current_cursor
        );

        match event.key.as_str() {
            // Edit mode triggers
            "i" => {
                let existing_value = self.controller.get_cell_display_for_ui(&current_cursor);
                log::debug!(
                    "'i' key pressed, starting insert mode with existing value: '{}', cursor at 0",
                    existing_value
                );
                self.controller.dispatch_action(Action::StartEditing {
                    edit_mode: Some(InsertMode::I),
                    initial_value: Some(existing_value),
                    cursor_position: Some(0),
                })
            }
            "a" => {
                let existing_value = self.controller.get_cell_display_for_ui(&current_cursor);
                let cursor_pos = existing_value.len();
                log::debug!(
                    "'a' key pressed, starting append mode with existing value: '{}', cursor at {}",
                    existing_value,
                    cursor_pos
                );
                self.controller.dispatch_action(Action::StartEditing {
                    edit_mode: Some(InsertMode::A),
                    initial_value: Some(existing_value),
                    cursor_position: Some(cursor_pos),
                })
            }
            "Enter" => {
                log::debug!("Enter key pressed, starting edit in Insert mode with empty value");
                self.controller.dispatch_action(Action::StartEditing {
                    edit_mode: Some(InsertMode::I),
                    initial_value: Some(String::new()),
                    cursor_position: Some(0),
                })
            }

            // Command mode
            ":" => self.controller.dispatch_action(Action::EnterCommandMode),

            // Visual mode
            "v" => {
                use super::mode::EditorMode;
                use crate::state::VisualMode;

                // Enter visual mode with current cursor as anchor
                self.controller.set_mode(EditorMode::Visual {
                    mode: VisualMode::Character,
                    anchor: current_cursor,
                });

                // Set initial selection to just the current cell
                self.controller.set_selection(Some(Selection {
                    selection_type: SelectionType::Cell {
                        address: current_cursor,
                    },
                    anchor: Some(current_cursor),
                }));

                // Also update state machine for compatibility
                self.controller
                    .dispatch_action(Action::EnterSpreadsheetVisualMode {
                        visual_mode: VisualMode::Character,
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
            "Tab" => self.handle_tab_navigation(event.shift, current_cursor),

            // Cell operations
            "Delete" | "Backspace" => self.handle_delete_cell(current_cursor),

            // Escape does nothing in navigation mode
            "Escape" => Ok(()),

            // Vim mode commands
            "I" => {
                let existing_value = self.controller.get_cell_display_for_ui(&current_cursor);
                log::debug!("'I' key pressed, entering insert mode at start of line");
                self.controller.dispatch_action(Action::StartEditing {
                    edit_mode: Some(InsertMode::CapitalI),
                    initial_value: Some(existing_value),
                    cursor_position: Some(0),
                })
            }
            "A" => {
                let existing_value = self.controller.get_cell_display_for_ui(&current_cursor);
                let cursor_pos = existing_value.len();
                log::debug!("'A' key pressed, entering insert mode at end of line");
                self.controller.dispatch_action(Action::StartEditing {
                    edit_mode: Some(InsertMode::CapitalA),
                    initial_value: Some(existing_value),
                    cursor_position: Some(cursor_pos),
                })
            }

            _ => {
                // Check if this is a single printable character that should start editing
                if event.key.len() == 1 && !event.ctrl && !event.alt && !event.meta {
                    log::debug!("Starting edit mode with typed character: '{}'", event.key);
                    self.controller.dispatch_action(Action::StartEditing {
                        edit_mode: Some(InsertMode::I),
                        initial_value: Some(event.key.clone()),
                        cursor_position: Some(1),
                    })
                } else {
                    log::debug!("Unhandled navigation key: '{}'", event.key);
                    Ok(())
                }
            }
        }
    }

    fn handle_tab_navigation(&mut self, shift: bool, current_cursor: CellAddress) -> Result<()> {
        if shift {
            // Shift+Tab moves left, then wraps to previous row
            if current_cursor.col > 0 {
                self.controller.dispatch_action(Action::UpdateCursor {
                    cursor: CellAddress::new(current_cursor.col - 1, current_cursor.row),
                })
            } else if current_cursor.row > 0 {
                // Wrap to end of previous row (assuming max 256 columns)
                self.controller.dispatch_action(Action::UpdateCursor {
                    cursor: CellAddress::new(255, current_cursor.row - 1),
                })
            } else {
                Ok(())
            }
        } else {
            // Tab moves right, then wraps to next row
            if current_cursor.col < 255 {
                self.controller.dispatch_action(Action::UpdateCursor {
                    cursor: CellAddress::new(current_cursor.col + 1, current_cursor.row),
                })
            } else if current_cursor.row < 9999 {
                // Wrap to start of next row
                self.controller.dispatch_action(Action::UpdateCursor {
                    cursor: CellAddress::new(0, current_cursor.row + 1),
                })
            } else {
                Ok(())
            }
        }
    }

    fn handle_delete_cell(&mut self, current_cursor: CellAddress) -> Result<()> {
        log::debug!(
            "Delete/Backspace key pressed, clearing cell at {:?}",
            current_cursor
        );
        self.controller.facade.set_cell_value(&current_cursor, "")?;
        self.controller
            .event_dispatcher
            .dispatch(&SpreadsheetEvent::CellEditCompleted {
                address: current_cursor,
                value: String::new(),
            });
        self.controller.update_formula_bar_from_cursor();
        Ok(())
    }

    fn handle_editing_key(&mut self, event: KeyboardEvent) -> Result<()> {
        if event.key == "Escape" {
            return self.controller.dispatch_action(Action::Escape);
        }

        let state = self.controller.state();

        if let UIState::Editing {
            mode,
            value,
            cursor_pos,
            ..
        } = state
        {
            match mode {
                EditMode::Normal => match event.key.as_str() {
                    "i" => self.controller.dispatch_action(Action::EnterInsertMode {
                        mode: Some(InsertMode::I),
                    }),
                    "a" => self.controller.dispatch_action(Action::EnterInsertMode {
                        mode: Some(InsertMode::A),
                    }),
                    "Escape" => self.controller.dispatch_action(Action::ExitToNavigation),
                    _ => Ok(()),
                },
                EditMode::Insert => {
                    if event.is_printable() {
                        let mut new_value = value.clone();
                        let pos = cursor_pos;
                        new_value.insert_str(pos, &event.key);
                        self.controller.dispatch_action(Action::UpdateEditingValue {
                            value: new_value,
                            cursor_position: pos + 1,
                        })
                    } else {
                        match event.key.as_str() {
                            "Backspace" => {
                                let mut new_value = value.clone();
                                let pos = cursor_pos;
                                if pos > 0 {
                                    new_value.remove(pos - 1);
                                    self.controller.dispatch_action(Action::UpdateEditingValue {
                                        value: new_value,
                                        cursor_position: pos - 1,
                                    })
                                } else {
                                    Ok(())
                                }
                            }
                            "Enter" => {
                                self.controller.complete_editing()?;
                                self.move_cursor(0, 1)
                            }
                            _ => Ok(()),
                        }
                    }
                }
                EditMode::Visual => Ok(()),
            }
        } else {
            Ok(())
        }
    }

    fn handle_insert_key(&mut self, event: KeyboardEvent) -> Result<()> {
        if event.key == "Escape" {
            return self.controller.dispatch_action(Action::Escape);
        }
        // In Insert mode, handle character input
        // The UI typically handles the actual text editing
        Ok(())
    }

    fn handle_command_key(&mut self, event: KeyboardEvent) -> Result<()> {
        if event.key == "Escape" {
            return self.controller.dispatch_action(Action::ExitCommandMode);
        }

        if let UIState::Navigation {
            modal: Some(NavigationModal::Command { value }),
            ..
        } = &self.controller.state()
        {
            if event.is_printable() {
                let mut new_value = value.clone();
                new_value.push_str(&event.key);
                self.controller
                    .dispatch_action(Action::UpdateCommandValue { value: new_value })
            } else if event.key == "Enter" {
                self.controller
                    .event_dispatcher
                    .dispatch(&SpreadsheetEvent::CommandExecuted {
                        command: value.clone(),
                    });
                self.controller.dispatch_action(Action::ExitCommandMode)
            } else if event.key == "Backspace" && !value.is_empty() {
                let mut new_value = value.clone();
                new_value.pop();
                self.controller
                    .dispatch_action(Action::UpdateCommandValue { value: new_value })
            } else {
                Ok(())
            }
        } else {
            Ok(())
        }
    }

    fn handle_visual_key(&mut self, event: KeyboardEvent) -> Result<()> {
        use super::mode::EditorMode;

        match event.key.as_str() {
            "Escape" => {
                // Exit visual mode - clear selection and return to navigation
                self.controller.set_mode(EditorMode::Navigation);
                self.controller.set_selection(None);
                // Also update state machine for compatibility
                self.controller
                    .dispatch_action(Action::ExitSpreadsheetVisualMode)
            }

            // Movement keys - extend selection
            "h" | "ArrowLeft" | "j" | "ArrowDown" | "k" | "ArrowUp" | "l" | "ArrowRight" => {
                // Calculate new cursor position
                let current = self.controller.get_cursor();
                let (delta_col, delta_row) = match event.key.as_str() {
                    "h" | "ArrowLeft" => (-1, 0),
                    "l" | "ArrowRight" => (1, 0),
                    "k" | "ArrowUp" => (0, -1),
                    "j" | "ArrowDown" => (0, 1),
                    _ => (0, 0),
                };

                let new_col = (current.col as i32 + delta_col).max(0) as u32;
                let new_row = (current.row as i32 + delta_row).max(0) as u32;
                let new_cursor = CellAddress::new(new_col, new_row);

                // Update cursor and extend selection
                if let EditorMode::Visual { anchor, mode: _ } = self.controller.get_mode() {
                    // Create new selection from anchor to new cursor
                    // The selection should always maintain anchor as the start point
                    // and the current cursor as the end point for the Range type
                    let selection = Selection {
                        selection_type: if *anchor == new_cursor {
                            // Single cell selection
                            SelectionType::Cell {
                                address: new_cursor,
                            }
                        } else {
                            // Range selection - keep anchor and cursor positions as-is
                            // Don't reorder them with min/max - that's a rendering concern
                            SelectionType::Range {
                                start: *anchor,
                                end: new_cursor,
                            }
                        },
                        anchor: Some(*anchor),
                    };

                    // Update direct state
                    self.controller.set_cursor(new_cursor);
                    self.controller.set_selection(Some(selection.clone()));

                    // Also update state machine for compatibility
                    self.controller
                        .dispatch_action(Action::UpdateCursor { cursor: new_cursor })?;
                    self.controller
                        .dispatch_action(Action::UpdateSelection { selection })
                } else {
                    // Just move cursor if not in visual mode (shouldn't happen)
                    self.controller.set_cursor(new_cursor);
                    self.controller
                        .dispatch_action(Action::UpdateCursor { cursor: new_cursor })
                }
            }

            _ => Ok(()),
        }
    }

    fn move_cursor(&mut self, delta_col: i32, delta_row: i32) -> Result<()> {
        let current = self.controller.cursor();
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

        self.controller.viewport_manager.ensure_visible(&new_cursor);

        self.controller
            .event_dispatcher
            .dispatch(&SpreadsheetEvent::CursorMoved {
                from: current,
                to: new_cursor,
            });

        self.controller
            .dispatch_action(Action::UpdateCursor { cursor: new_cursor })?;

        self.controller.update_formula_bar_from_cursor();

        Ok(())
    }

    /// Handle mouse events
    pub fn handle_mouse_event(&mut self, event: MouseEvent) -> Result<()> {
        if let Some(cell) = self
            .controller
            .viewport_manager
            .viewport_to_cell(event.x, event.y)
        {
            match event.event_type {
                crate::controller::events::MouseEventType::Click => {
                    self.controller
                        .event_dispatcher
                        .dispatch(&SpreadsheetEvent::CursorMoved {
                            from: self.controller.cursor(),
                            to: cell,
                        });
                    self.controller
                        .dispatch_action(Action::UpdateCursor { cursor: cell })
                }
                crate::controller::events::MouseEventType::DoubleClick => {
                    self.controller
                        .dispatch_action(Action::UpdateCursor { cursor: cell })?;
                    self.controller.dispatch_action(Action::StartEditing {
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
