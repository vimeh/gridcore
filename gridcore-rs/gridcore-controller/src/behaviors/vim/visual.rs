use super::{Motion, Operator, VimBehavior, VimMode};
use crate::state::{Action, Selection, SelectionType, SpreadsheetVisualMode, UIState};
use gridcore_core::{types::CellAddress, Result};

/// Visual mode selection state
#[derive(Debug, Clone)]
pub struct VisualSelection {
    pub anchor: CellAddress,
    pub cursor: CellAddress,
    pub mode: VimMode,
}

impl VisualSelection {
    pub fn new(anchor: CellAddress, mode: VimMode) -> Self {
        Self {
            anchor,
            cursor: anchor,
            mode,
        }
    }

    /// Calculate the selection range
    pub fn to_selection(&self) -> Selection {
        let selection_type = match self.mode {
            VimMode::Visual => {
                // Character-wise visual mode - select range
                SelectionType::Range {
                    start: self.min_address(),
                    end: self.max_address(),
                }
            }
            VimMode::VisualLine => {
                // Line-wise visual mode - select entire rows
                let min_row = self.anchor.row.min(self.cursor.row);
                let max_row = self.anchor.row.max(self.cursor.row);
                let rows: Vec<u32> = (min_row..=max_row).collect();
                SelectionType::Row { rows }
            }
            VimMode::VisualBlock => {
                // Block-wise visual mode - rectangular selection
                let min_col = self.anchor.col.min(self.cursor.col);
                let max_col = self.anchor.col.max(self.cursor.col);
                let min_row = self.anchor.row.min(self.cursor.row);
                let max_row = self.anchor.row.max(self.cursor.row);

                SelectionType::Range {
                    start: CellAddress::new(min_col, min_row),
                    end: CellAddress::new(max_col, max_row),
                }
            }
            _ => SelectionType::Cell {
                address: self.cursor,
            },
        };

        Selection {
            selection_type,
            anchor: Some(self.anchor),
        }
    }

    fn min_address(&self) -> CellAddress {
        if self.anchor.row < self.cursor.row
            || (self.anchor.row == self.cursor.row && self.anchor.col <= self.cursor.col)
        {
            self.anchor
        } else {
            self.cursor
        }
    }

    fn max_address(&self) -> CellAddress {
        if self.anchor.row > self.cursor.row
            || (self.anchor.row == self.cursor.row && self.anchor.col >= self.cursor.col)
        {
            self.anchor
        } else {
            self.cursor
        }
    }
}

impl VimBehavior {
    /// Enter visual mode
    pub fn enter_visual_mode(
        &mut self,
        mode: VimMode,
        current_state: &UIState,
    ) -> Result<Option<Action>> {
        self.mode = mode;
        self.visual_anchor = Some(*current_state.cursor());

        let visual_mode = match mode {
            VimMode::Visual => SpreadsheetVisualMode::Char,
            VimMode::VisualLine => SpreadsheetVisualMode::Line,
            VimMode::VisualBlock => SpreadsheetVisualMode::Block,
            _ => SpreadsheetVisualMode::Char,
        };

        let selection = Selection {
            selection_type: match mode {
                VimMode::VisualLine => SelectionType::Row {
                    rows: vec![current_state.cursor().row],
                },
                _ => SelectionType::Cell {
                    address: *current_state.cursor(),
                },
            },
            anchor: Some(*current_state.cursor()),
        };

        Ok(Some(Action::EnterSpreadsheetVisualMode {
            visual_mode,
            selection,
        }))
    }

    /// Exit visual mode
    pub fn exit_visual_mode(&mut self) -> Result<Option<Action>> {
        self.mode = VimMode::Normal;
        self.visual_anchor = None;
        Ok(Some(Action::ExitSpreadsheetVisualMode))
    }

    /// Handle visual mode key presses
    pub fn handle_visual_mode(
        &mut self,
        key: &str,
        current_state: &UIState,
    ) -> Result<Option<Action>> {
        match key {
            // Exit visual mode
            "Escape" | "v" if self.mode == VimMode::Visual => self.exit_visual_mode(),
            "V" if self.mode == VimMode::VisualLine => self.exit_visual_mode(),

            // Switch visual modes
            "v" if self.mode != VimMode::Visual => {
                self.mode = VimMode::Visual;
                self.update_visual_selection(current_state)
            }
            "V" if self.mode != VimMode::VisualLine => {
                self.mode = VimMode::VisualLine;
                self.update_visual_selection(current_state)
            }

            // Movement extends selection
            "h" | "ArrowLeft" => self.extend_selection(Motion::Left(1), current_state),
            "j" | "ArrowDown" => self.extend_selection(Motion::Down(1), current_state),
            "k" | "ArrowUp" => self.extend_selection(Motion::Up(1), current_state),
            "l" | "ArrowRight" => self.extend_selection(Motion::Right(1), current_state),

            "w" => self.extend_selection(Motion::WordForward(1), current_state),
            "b" => self.extend_selection(Motion::WordBackward(1), current_state),
            "e" => self.extend_selection(Motion::WordEnd(1), current_state),
            "W" => self.extend_selection(Motion::BigWordForward(1), current_state),
            "B" => self.extend_selection(Motion::BigWordBackward(1), current_state),
            "E" => self.extend_selection(Motion::BigWordEnd(1), current_state),

            "0" | "Home" => self.extend_selection(Motion::LineStart, current_state),
            "$" | "End" => self.extend_selection(Motion::LineEnd, current_state),
            "^" => self.extend_selection(Motion::FirstNonBlank, current_state),

            "G" => self.extend_selection(Motion::DocumentEnd, current_state),
            "{" => self.extend_selection(Motion::ParagraphBackward(1), current_state),
            "}" => self.extend_selection(Motion::ParagraphForward(1), current_state),

            // Switch selection anchor
            "o" => self.switch_visual_anchor(current_state),
            "O" if self.mode == VimMode::VisualBlock => self.switch_visual_corner(current_state),

            // Operators on selection
            "d" | "x" => self.delete_selection(current_state),
            "c" => self.change_selection(current_state),
            "y" => self.yank_selection(current_state),
            ">" => self.indent_selection(current_state),
            "<" => self.outdent_selection(current_state),
            "=" => self.format_selection(current_state),
            "~" => self.toggle_case_selection(current_state),
            "u" => self.lowercase_selection(current_state),
            "U" => self.uppercase_selection(current_state),

            // Special visual mode operations
            "I" if self.mode == VimMode::VisualBlock => self.block_insert_before(current_state),
            "A" if self.mode == VimMode::VisualBlock => self.block_insert_after(current_state),

            // Join lines
            "J" => self.join_selection(current_state),

            // Search within selection
            "/" => self.search_in_selection(current_state),

            _ => {
                // Check for counts
                if key.len() == 1
                    && key.chars().next().unwrap_or('\0').is_ascii_digit()
                    && key != "0"
                {
                    self.count_buffer.push_str(key);
                    Ok(None)
                } else {
                    Ok(None)
                }
            }
        }
    }

    fn extend_selection(
        &mut self,
        motion: Motion,
        current_state: &UIState,
    ) -> Result<Option<Action>> {
        let context = super::motion::MotionContext::new(
            *current_state.cursor(),
            current_state.viewport().clone(),
        );

        let new_cursor = super::motion::apply_motion(&motion, &context)?;

        // Update visual selection
        if let Some(anchor) = &self.visual_anchor {
            let visual_selection = VisualSelection {
                anchor: *anchor,
                cursor: new_cursor,
                mode: self.mode,
            };

            let selection = visual_selection.to_selection();

            Ok(Some(Action::UpdateSelection { selection }))
        } else {
            Ok(None)
        }
    }

    fn update_visual_selection(&self, current_state: &UIState) -> Result<Option<Action>> {
        if let Some(anchor) = &self.visual_anchor {
            let visual_selection = VisualSelection {
                anchor: *anchor,
                cursor: *current_state.cursor(),
                mode: self.mode,
            };

            let _selection = visual_selection.to_selection();

            let visual_mode = match self.mode {
                VimMode::Visual => SpreadsheetVisualMode::Char,
                VimMode::VisualLine => SpreadsheetVisualMode::Line,
                VimMode::VisualBlock => SpreadsheetVisualMode::Block,
                _ => SpreadsheetVisualMode::Char,
            };

            Ok(Some(Action::ChangeVisualMode {
                new_mode: visual_mode,
            }))
        } else {
            Ok(None)
        }
    }

    fn switch_visual_anchor(&mut self, current_state: &UIState) -> Result<Option<Action>> {
        if let Some(anchor) = &self.visual_anchor {
            let new_anchor = *current_state.cursor();
            self.visual_anchor = Some(*anchor);
            Ok(Some(Action::UpdateCursor { cursor: new_anchor }))
        } else {
            Ok(None)
        }
    }

    fn switch_visual_corner(&mut self, current_state: &UIState) -> Result<Option<Action>> {
        // Switch between opposite corners of the visual block
        if let Some(anchor) = self.visual_anchor {
            self.visual_anchor = Some(*current_state.cursor());
            Ok(Some(Action::UpdateCursor { cursor: anchor }))
        } else {
            Ok(None)
        }
    }

    fn delete_selection(&mut self, current_state: &UIState) -> Result<Option<Action>> {
        self.perform_operator_on_selection(Operator::Delete, current_state)
    }

    fn change_selection(&mut self, current_state: &UIState) -> Result<Option<Action>> {
        self.perform_operator_on_selection(Operator::Change, current_state)
    }

    fn yank_selection(&mut self, current_state: &UIState) -> Result<Option<Action>> {
        self.perform_operator_on_selection(Operator::Yank, current_state)
    }

    fn indent_selection(&mut self, current_state: &UIState) -> Result<Option<Action>> {
        self.perform_operator_on_selection(Operator::Indent, current_state)
    }

    fn outdent_selection(&mut self, current_state: &UIState) -> Result<Option<Action>> {
        self.perform_operator_on_selection(Operator::Outdent, current_state)
    }

    fn format_selection(&mut self, current_state: &UIState) -> Result<Option<Action>> {
        self.perform_operator_on_selection(Operator::Format, current_state)
    }

    fn toggle_case_selection(&mut self, current_state: &UIState) -> Result<Option<Action>> {
        self.perform_operator_on_selection(Operator::ToggleCase, current_state)
    }

    fn lowercase_selection(&mut self, current_state: &UIState) -> Result<Option<Action>> {
        self.perform_operator_on_selection(Operator::LowerCase, current_state)
    }

    fn uppercase_selection(&mut self, current_state: &UIState) -> Result<Option<Action>> {
        self.perform_operator_on_selection(Operator::UpperCase, current_state)
    }

    fn perform_operator_on_selection(
        &mut self,
        operator: Operator,
        _current_state: &UIState,
    ) -> Result<Option<Action>> {
        // Get the current selection
        // Apply the operator
        // Exit visual mode

        self.mode = VimMode::Normal;
        self.visual_anchor = None;

        match operator {
            Operator::Delete => {
                // Delete the selected cells and exit visual mode
                Ok(Some(Action::ExitSpreadsheetVisualMode))
            }
            Operator::Change => {
                // Delete and enter insert mode
                self.mode = VimMode::Insert;
                Ok(Some(Action::EnterInsertMode { mode: None }))
            }
            Operator::Yank => {
                // Copy to register
                Ok(Some(Action::ExitSpreadsheetVisualMode))
            }
            _ => Ok(Some(Action::ExitSpreadsheetVisualMode)),
        }
    }

    fn join_selection(&mut self, _current_state: &UIState) -> Result<Option<Action>> {
        // Join selected lines - in spreadsheet context, this could mean concatenating cell values
        // For now, just exit visual mode as joining rows doesn't have a clear meaning in spreadsheets
        self.exit_visual_mode()
    }

    fn search_in_selection(&mut self, _current_state: &UIState) -> Result<Option<Action>> {
        // Enter command mode with search pre-populated for the selection
        // The command mode will handle the actual search within selection
        Ok(Some(Action::EnterCommandMode))
    }

    fn block_insert_before(&mut self, _current_state: &UIState) -> Result<Option<Action>> {
        // Block insert - apply the same text to all cells in the visual block
        // The insert mode will handle applying changes to all selected cells
        self.mode = VimMode::Insert;
        Ok(Some(Action::EnterInsertMode {
            mode: Some(crate::state::InsertMode::I),
        }))
    }

    fn block_insert_after(&mut self, _current_state: &UIState) -> Result<Option<Action>> {
        // Block append - append the same text to all cells in the visual block
        // The insert mode will handle applying changes to all selected cells
        self.mode = VimMode::Insert;
        Ok(Some(Action::EnterInsertMode {
            mode: Some(crate::state::InsertMode::A),
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_visual_selection_range() {
        let anchor = CellAddress::new(5, 5);
        let cursor = CellAddress::new(10, 10);
        let selection = VisualSelection {
            anchor,
            cursor,
            mode: VimMode::Visual,
        };

        let result = selection.to_selection();
        match result.selection_type {
            SelectionType::Range { start, end } => {
                assert_eq!(start, anchor);
                assert_eq!(end, cursor);
            }
            _ => panic!("Expected range selection"),
        }
    }

    #[test]
    fn test_visual_line_selection() {
        let anchor = CellAddress::new(5, 3);
        let cursor = CellAddress::new(10, 7);
        let selection = VisualSelection {
            anchor,
            cursor,
            mode: VimMode::VisualLine,
        };

        let result = selection.to_selection();
        match result.selection_type {
            SelectionType::Row { rows } => {
                assert_eq!(rows, vec![3, 4, 5, 6, 7]);
            }
            _ => panic!("Expected row selection"),
        }
    }
}
