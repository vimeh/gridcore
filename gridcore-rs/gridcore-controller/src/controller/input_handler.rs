use crate::controller::{KeyboardEvent, MouseEvent, SpreadsheetEvent};
use crate::state::{Action, InsertMode, Selection, SelectionType};
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
        let mode = self.controller.get_mode().clone();
        log::debug!(
            "Handling keyboard event: key='{}', mode={:?}",
            event.key,
            mode
        );

        use super::mode::EditorMode;
        match mode {
            EditorMode::Navigation => self.handle_navigation_key(event),
            EditorMode::Editing { .. } | EditorMode::CellEditing { .. } => {
                self.handle_editing_key(event)
            }
            EditorMode::Command { .. } => self.handle_command_key(event),
            EditorMode::Visual { .. } => self.handle_visual_key(event),
            EditorMode::Resizing => Ok(()),
        }
    }

    fn handle_navigation_key(&mut self, event: KeyboardEvent) -> Result<()> {
        use crate::controller::vim_handler::VimHandler;
        let current_cursor = self.controller.cursor();
        log::debug!(
            "Navigation mode key: '{}', current cursor: {:?}",
            event.key,
            current_cursor
        );

        // Check if this is a vim navigation key that should start editing
        if VimHandler::should_handle_navigation_key(&event.key) {
            match event.key.as_str() {
                // Edit mode triggers
                "i" => {
                    let existing_value = self.controller.get_cell_display_for_ui(&current_cursor);
                    log::debug!(
                        "'i' key pressed, starting insert mode with existing value: '{}', cursor at 0",
                        existing_value
                    );
                    use super::mode::{CellEditMode, EditorMode};
                    self.controller.set_mode(EditorMode::CellEditing {
                        value: existing_value,
                        cursor_pos: 0,
                        mode: CellEditMode::Insert(InsertMode::I),
                        visual_anchor: None,
                    });
                    Ok(())
                }
                "a" => {
                    let existing_value = self.controller.get_cell_display_for_ui(&current_cursor);
                    let cursor_pos = existing_value.len();
                    log::debug!(
                        "'a' key pressed, starting append mode with existing value: '{}', cursor at {}",
                        existing_value,
                        cursor_pos
                    );
                    use super::mode::{CellEditMode, EditorMode};
                    self.controller.set_mode(EditorMode::CellEditing {
                        value: existing_value,
                        cursor_pos,
                        mode: CellEditMode::Insert(InsertMode::A),
                        visual_anchor: None,
                    });
                    Ok(())
                }
                "I" => {
                    let existing_value = self.controller.get_cell_display_for_ui(&current_cursor);
                    log::debug!("'I' key pressed, entering insert mode at start of line");
                    use super::mode::{CellEditMode, EditorMode};
                    self.controller.set_mode(EditorMode::CellEditing {
                        value: existing_value,
                        cursor_pos: 0,
                        mode: CellEditMode::Insert(InsertMode::CapitalI),
                        visual_anchor: None,
                    });
                    Ok(())
                }
                "A" => {
                    let existing_value = self.controller.get_cell_display_for_ui(&current_cursor);
                    let cursor_pos = existing_value.len();
                    log::debug!("'A' key pressed, entering insert mode at end of line");
                    use super::mode::{CellEditMode, EditorMode};
                    self.controller.set_mode(EditorMode::CellEditing {
                        value: existing_value,
                        cursor_pos,
                        mode: CellEditMode::Insert(InsertMode::CapitalA),
                        visual_anchor: None,
                    });
                    Ok(())
                }
                _ => self.handle_navigation_vim_key(event.key.as_str()),
            }
        } else {
            match event.key.as_str() {
                "Enter" => {
                    log::debug!("Enter key pressed, starting edit in Insert mode with empty value");
                    use super::mode::{CellEditMode, EditorMode};
                    self.controller.set_mode(EditorMode::CellEditing {
                        value: String::new(),
                        cursor_pos: 0,
                        mode: CellEditMode::Insert(InsertMode::I), // Start in INSERT mode for Enter key
                        visual_anchor: None,
                    });
                    Ok(())
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

                _ => {
                    // Check if this is a single printable character that should start editing
                    if event.key.len() == 1 && !event.ctrl && !event.alt && !event.meta {
                        log::debug!("Starting edit mode with typed character: '{}'", event.key);
                        use super::mode::{CellEditMode, EditorMode};
                        self.controller.set_mode(EditorMode::CellEditing {
                            value: event.key.clone(),
                            cursor_pos: 1,
                            mode: CellEditMode::Insert(InsertMode::I),
                            visual_anchor: None,
                        });
                        Ok(())
                    } else {
                        log::debug!("Unhandled navigation key: '{}'", event.key);
                        Ok(())
                    }
                }
            }
        }
    }

    fn handle_tab_navigation(&mut self, shift: bool, current_cursor: CellAddress) -> Result<()> {
        let new_cursor = if shift {
            // Shift+Tab moves left, then wraps to previous row
            if current_cursor.col > 0 {
                CellAddress::new(current_cursor.col - 1, current_cursor.row)
            } else if current_cursor.row > 0 {
                // Wrap to end of previous row (assuming max 256 columns)
                CellAddress::new(255, current_cursor.row - 1)
            } else {
                return Ok(());
            }
        } else {
            // Tab moves right, then wraps to next row
            if current_cursor.col < 255 {
                CellAddress::new(current_cursor.col + 1, current_cursor.row)
            } else if current_cursor.row < 9999 {
                // Wrap to start of next row
                CellAddress::new(0, current_cursor.row + 1)
            } else {
                return Ok(());
            }
        };

        // Use direct set_cursor following hybrid architecture
        self.controller.set_cursor(new_cursor);
        self.controller.update_formula_bar_from_cursor();
        Ok(())
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
        // Delegate all editing keys to the controller's vim handler
        self.controller.dispatch_action(Action::HandleEditingKey {
            key: event.key,
            shift: event.shift,
            ctrl: event.ctrl,
            alt: event.alt,
            selection_start: None,
            selection_end: None,
        })
    }

    fn handle_command_key(&mut self, event: KeyboardEvent) -> Result<()> {
        use super::mode::EditorMode;

        if event.key == "Escape" {
            return self.controller.dispatch_action(Action::ExitCommandMode);
        }

        if let EditorMode::Command { value } = self.controller.get_mode() {
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
                if let EditorMode::Visual { anchor, mode } = self.controller.get_mode() {
                    use crate::state::VisualMode;

                    // Create new selection based on visual mode type
                    let selection = match mode {
                        VisualMode::Line => {
                            // For line mode, select all rows between anchor and current
                            let start_row = anchor.row.min(new_cursor.row);
                            let end_row = anchor.row.max(new_cursor.row);
                            let mut rows = Vec::new();
                            for row in start_row..=end_row {
                                rows.push(row);
                            }
                            Selection {
                                selection_type: SelectionType::Row { rows },
                                anchor: Some(*anchor),
                            }
                        }
                        _ => {
                            // For character/block mode
                            Selection {
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
                            }
                        }
                    };

                    // Update direct state (no action dispatch needed)
                    self.controller.set_cursor(new_cursor);
                    self.controller.set_selection(Some(selection));
                    Ok(())
                } else {
                    // Just move cursor if not in visual mode (shouldn't happen)
                    self.controller.set_cursor(new_cursor);
                    Ok(())
                }
            }

            _ => Ok(()),
        }
    }

    fn handle_navigation_vim_key(&mut self, key: &str) -> Result<()> {
        let current_cursor = self.controller.cursor();

        match key {
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
            "V" => {
                use super::mode::EditorMode;
                use crate::state::VisualMode;

                // Enter visual line mode with current cursor as anchor
                self.controller.set_mode(EditorMode::Visual {
                    mode: VisualMode::Line,
                    anchor: current_cursor,
                });

                // Set initial selection to the current row
                self.controller.set_selection(Some(Selection {
                    selection_type: SelectionType::Row {
                        rows: vec![current_cursor.row],
                    },
                    anchor: Some(current_cursor),
                }));

                // Also update state for compatibility
                self.controller
                    .dispatch_action(Action::EnterSpreadsheetVisualMode {
                        visual_mode: VisualMode::Line,
                        selection: Selection {
                            selection_type: SelectionType::Row {
                                rows: vec![current_cursor.row],
                            },
                            anchor: Some(current_cursor),
                        },
                    })
            }

            // Navigation
            "h" => self.move_cursor(-1, 0),
            "j" => self.move_cursor(0, 1),
            "k" => self.move_cursor(0, -1),
            "l" => self.move_cursor(1, 0),

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

        // Check if we're in visual mode and update selection accordingly
        use super::mode::EditorMode;
        if let EditorMode::Visual { mode, anchor } = self.controller.get_mode() {
            use crate::state::{SelectionType, VisualMode};

            // Update selection based on visual mode type
            let selection = match mode {
                VisualMode::Line => {
                    // For line mode, select all rows between anchor and current
                    let start_row = anchor.row.min(new_cursor.row);
                    let end_row = anchor.row.max(new_cursor.row);
                    let mut rows = Vec::new();
                    for row in start_row..=end_row {
                        rows.push(row);
                    }
                    Selection {
                        selection_type: SelectionType::Row { rows },
                        anchor: Some(*anchor),
                    }
                }
                _ => {
                    // For character/block mode, create a range
                    Selection {
                        selection_type: SelectionType::Range {
                            start: CellAddress::new(
                                anchor.col.min(new_cursor.col),
                                anchor.row.min(new_cursor.row),
                            ),
                            end: CellAddress::new(
                                anchor.col.max(new_cursor.col),
                                anchor.row.max(new_cursor.row),
                            ),
                        },
                        anchor: Some(*anchor),
                    }
                }
            };

            self.controller.set_selection(Some(selection));
        }

        // Use direct set_cursor which emits the CursorMoved event
        // This follows the hybrid architecture plan - no action dispatch needed
        self.controller.set_cursor(new_cursor);

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
                    // If in visual mode, exit it when clicking
                    use super::mode::EditorMode;
                    if matches!(self.controller.get_mode(), EditorMode::Visual { .. }) {
                        self.controller.set_mode(EditorMode::Navigation);
                    }
                    // Use direct set_cursor which emits the event
                    self.controller.set_cursor(cell);
                    self.controller.update_formula_bar_from_cursor();
                    Ok(())
                }
                crate::controller::events::MouseEventType::DoubleClick => {
                    self.controller.set_cursor(cell);
                    let existing_value = self.controller.get_cell_display_for_ui(&cell);
                    use super::mode::{CellEditMode, EditorMode};
                    self.controller.set_mode(EditorMode::CellEditing {
                        value: existing_value,
                        cursor_pos: 0,
                        mode: CellEditMode::Insert(InsertMode::I),
                        visual_anchor: None,
                    });
                    self.controller.update_formula_bar_from_cursor();
                    Ok(())
                }
                _ => Ok(()),
            }
        } else {
            Ok(())
        }
    }
}
