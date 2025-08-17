use crate::controller::mode::{CellEditMode, EditorMode};
use crate::state::{InsertMode, VisualMode};
use gridcore_core::Result;

/// Centralized handler for all vim-related keyboard behavior in cell editing
pub struct VimHandler;

impl VimHandler {
    /// Handle a key press in cell editing mode, returning the new mode and updated text state
    pub fn handle_editing_key(
        mode: &EditorMode,
        key: &str,
        shift: bool,
        ctrl: bool,
        alt: bool,
        selection_start: Option<usize>,
        selection_end: Option<usize>,
    ) -> Result<Option<VimKeyResult>> {
        // Don't handle special keys with modifiers (except shift for capital letters)
        if ctrl || alt {
            return Ok(None);
        }

        match mode {
            EditorMode::CellEditing {
                value,
                cursor_pos,
                mode: edit_mode,
                visual_anchor,
            } => match edit_mode {
                CellEditMode::Normal => {
                    Self::handle_normal_mode_key(key, value, *cursor_pos, *visual_anchor)
                }
                CellEditMode::Insert(insert_mode) => Self::handle_insert_mode_key(
                    key,
                    value,
                    *cursor_pos,
                    *insert_mode,
                    shift,
                    selection_start,
                    selection_end,
                ),
                CellEditMode::Visual(visual_mode) => Self::handle_visual_mode_key(
                    key,
                    value,
                    *cursor_pos,
                    *visual_anchor,
                    *visual_mode,
                ),
            },
            EditorMode::Editing {
                value,
                cursor_pos,
                insert_mode,
            } => {
                if let Some(insert) = insert_mode {
                    Self::handle_insert_mode_key(
                        key,
                        value,
                        *cursor_pos,
                        *insert,
                        shift,
                        selection_start,
                        selection_end,
                    )
                } else {
                    Self::handle_normal_mode_key(key, value, *cursor_pos, None)
                }
            }
            _ => Ok(None),
        }
    }

    fn handle_normal_mode_key(
        key: &str,
        value: &str,
        cursor_pos: usize,
        visual_anchor: Option<usize>,
    ) -> Result<Option<VimKeyResult>> {
        Ok(match key {
            // Mode transitions
            "i" => Some(VimKeyResult::ChangeMode(EditorMode::CellEditing {
                value: value.to_string(),
                cursor_pos,
                mode: CellEditMode::Insert(InsertMode::I),
                visual_anchor,
            })),
            "a" => {
                let new_pos = cursor_pos.min(value.len());
                Some(VimKeyResult::ChangeMode(EditorMode::CellEditing {
                    value: value.to_string(),
                    cursor_pos: new_pos + 1,
                    mode: CellEditMode::Insert(InsertMode::A),
                    visual_anchor,
                }))
            }
            "I" => Some(VimKeyResult::ChangeMode(EditorMode::CellEditing {
                value: value.to_string(),
                cursor_pos: 0,
                mode: CellEditMode::Insert(InsertMode::CapitalI),
                visual_anchor,
            })),
            "A" => Some(VimKeyResult::ChangeMode(EditorMode::CellEditing {
                value: value.to_string(),
                cursor_pos: value.len(),
                mode: CellEditMode::Insert(InsertMode::CapitalA),
                visual_anchor,
            })),
            "v" => Some(VimKeyResult::ChangeMode(EditorMode::CellEditing {
                value: value.to_string(),
                cursor_pos,
                mode: CellEditMode::Visual(VisualMode::Character),
                visual_anchor: Some(cursor_pos),
            })),
            "V" => Some(VimKeyResult::ChangeMode(EditorMode::CellEditing {
                value: value.to_string(),
                cursor_pos,
                mode: CellEditMode::Visual(VisualMode::Line),
                visual_anchor: Some(0),
            })),

            // Navigation
            "h" => {
                let new_pos = cursor_pos.saturating_sub(1);
                Some(VimKeyResult::UpdateCursor {
                    cursor_pos: new_pos,
                })
            }
            "l" => {
                let new_pos = (cursor_pos + 1).min(value.len());
                Some(VimKeyResult::UpdateCursor {
                    cursor_pos: new_pos,
                })
            }
            "0" => Some(VimKeyResult::UpdateCursor { cursor_pos: 0 }),
            "$" => Some(VimKeyResult::UpdateCursor {
                cursor_pos: value.len(),
            }),

            // Commands
            "Enter" => Some(VimKeyResult::CompleteEdit),
            "Escape" => Some(VimKeyResult::CompleteEdit),

            _ => None,
        })
    }

    fn handle_insert_mode_key(
        key: &str,
        value: &str,
        cursor_pos: usize,
        _insert_mode: InsertMode,
        _shift: bool,
        selection_start: Option<usize>,
        selection_end: Option<usize>,
    ) -> Result<Option<VimKeyResult>> {
        // Check if there's a selection that should be replaced
        let has_selection = match (selection_start, selection_end) {
            (Some(start), Some(end)) => start != end,
            _ => false,
        };
        Ok(match key {
            "Escape" => {
                // Exit to normal mode
                Some(VimKeyResult::ChangeMode(EditorMode::CellEditing {
                    value: value.to_string(),
                    cursor_pos,
                    mode: CellEditMode::Normal,
                    visual_anchor: None,
                }))
            }
            "Enter" => {
                // In insert mode, Enter adds a newline
                let mut new_value = String::new();
                new_value.push_str(&value[..cursor_pos]);
                new_value.push('\n');
                new_value.push_str(&value[cursor_pos..]);

                Some(VimKeyResult::UpdateText {
                    value: new_value,
                    cursor_pos: cursor_pos + 1,
                })
            }
            "Backspace" => {
                if cursor_pos > 0 {
                    let mut new_value = String::new();
                    new_value.push_str(&value[..cursor_pos - 1]);
                    new_value.push_str(&value[cursor_pos..]);

                    Some(VimKeyResult::UpdateText {
                        value: new_value,
                        cursor_pos: cursor_pos - 1,
                    })
                } else {
                    None
                }
            }
            "Delete" => {
                if cursor_pos < value.len() {
                    let mut new_value = String::new();
                    new_value.push_str(&value[..cursor_pos]);
                    new_value.push_str(&value[cursor_pos + 1..]);

                    Some(VimKeyResult::UpdateText {
                        value: new_value,
                        cursor_pos,
                    })
                } else {
                    None
                }
            }
            "ArrowLeft" => {
                let new_pos = cursor_pos.saturating_sub(1);
                Some(VimKeyResult::UpdateCursor {
                    cursor_pos: new_pos,
                })
            }
            "ArrowRight" => {
                let new_pos = (cursor_pos + 1).min(value.len());
                Some(VimKeyResult::UpdateCursor {
                    cursor_pos: new_pos,
                })
            }
            _ if key.len() == 1 => {
                // Insert single character, replacing selection if present
                let (new_value, new_cursor) = if has_selection {
                    // Replace selected text with the typed character
                    let start = selection_start.unwrap_or(cursor_pos);
                    let end = selection_end.unwrap_or(cursor_pos);
                    let mut new_val = String::new();
                    new_val.push_str(&value[..start.min(end)]);
                    new_val.push_str(key);
                    new_val.push_str(&value[start.max(end)..]);
                    (new_val, start.min(end) + 1)
                } else {
                    // Normal insert at cursor position
                    let mut new_val = String::new();
                    new_val.push_str(&value[..cursor_pos]);
                    new_val.push_str(key);
                    new_val.push_str(&value[cursor_pos..]);
                    (new_val, cursor_pos + 1)
                };

                Some(VimKeyResult::UpdateText {
                    value: new_value,
                    cursor_pos: new_cursor,
                })
            }
            _ => None,
        })
    }

    fn handle_visual_mode_key(
        key: &str,
        value: &str,
        cursor_pos: usize,
        visual_anchor: Option<usize>,
        _visual_mode: VisualMode,
    ) -> Result<Option<VimKeyResult>> {
        Ok(match key {
            "Escape" => {
                // Exit to normal mode
                Some(VimKeyResult::ChangeMode(EditorMode::CellEditing {
                    value: value.to_string(),
                    cursor_pos,
                    mode: CellEditMode::Normal,
                    visual_anchor: None,
                }))
            }
            "h" => {
                let new_pos = cursor_pos.saturating_sub(1);
                Some(VimKeyResult::UpdateCursor {
                    cursor_pos: new_pos,
                })
            }
            "l" => {
                let new_pos = (cursor_pos + 1).min(value.len());
                Some(VimKeyResult::UpdateCursor {
                    cursor_pos: new_pos,
                })
            }
            "d" | "x" => {
                // Delete selected text
                if let Some(anchor) = visual_anchor {
                    let start = anchor.min(cursor_pos);
                    let end = anchor.max(cursor_pos);

                    let mut new_value = String::new();
                    new_value.push_str(&value[..start]);
                    new_value.push_str(&value[end..]);

                    Some(VimKeyResult::UpdateTextAndMode {
                        value: new_value.clone(),
                        cursor_pos: start,
                        mode: EditorMode::CellEditing {
                            value: new_value,
                            cursor_pos: start,
                            mode: CellEditMode::Normal,
                            visual_anchor: None,
                        },
                    })
                } else {
                    None
                }
            }
            _ => None,
        })
    }

    /// Check if a key should trigger vim handling in navigation mode
    pub fn should_handle_navigation_key(key: &str) -> bool {
        matches!(
            key,
            "i" | "a" | "I" | "A" | "v" | "V" | ":" | "h" | "j" | "k" | "l"
        )
    }
}

/// Result of handling a vim key press
pub enum VimKeyResult {
    /// Change the editing mode
    ChangeMode(EditorMode),
    /// Update the text value and cursor
    UpdateText { value: String, cursor_pos: usize },
    /// Just update cursor position
    UpdateCursor { cursor_pos: usize },
    /// Update text and change mode
    UpdateTextAndMode {
        value: String,
        cursor_pos: usize,
        mode: EditorMode,
    },
    /// Complete the edit and return to navigation
    CompleteEdit,
    /// Cancel the edit and return to navigation
    CancelEdit,
}
