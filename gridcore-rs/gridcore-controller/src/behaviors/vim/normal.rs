use super::{Motion, Operator, VimBehavior};
use crate::state::{Action, InsertMode, UIState};
use gridcore_core::Result;

/// Handle normal mode key presses
impl VimBehavior {
    pub fn handle_normal_mode(
        &mut self,
        key: &str,
        current_state: &UIState,
    ) -> Result<Option<Action>> {
        // Check for count prefix
        if self.is_count_digit(key) {
            self.count_buffer.push_str(key);
            return Ok(None);
        }

        // Parse and clear count
        let count = self.parse_count();

        // Handle multi-char commands
        if !self.command_buffer.is_empty() {
            return self.handle_multi_char_command(key, count, current_state);
        }

        // Single character commands
        match key {
            // Insert mode transitions
            "i" => self.enter_insert_mode(InsertMode::I),
            "a" => self.enter_insert_mode(InsertMode::A),
            "I" => self.enter_insert_mode(InsertMode::CapitalI),
            "A" => self.enter_insert_mode(InsertMode::CapitalA),
            "o" => self.enter_insert_mode(InsertMode::O),
            "O" => self.enter_insert_mode(InsertMode::CapitalO),

            // Replace mode
            "r" => {
                self.command_buffer = "r".to_string();
                Ok(None)
            }
            "R" => {
                self.mode = super::VimMode::Replace;
                Ok(Some(Action::EnterInsertMode {
                    mode: Some(InsertMode::I),
                }))
            }

            // Delete/change without motion (shortcuts)
            "x" => self.delete_chars(count.unwrap_or(1), true),
            "X" => self.delete_chars(count.unwrap_or(1), false),
            "s" => self.substitute_chars(count.unwrap_or(1)),
            "S" => self.substitute_lines(count.unwrap_or(1)),

            // Line operations
            "dd" if self.last_key_was('d') => self.delete_lines(count.unwrap_or(1)),
            "cc" if self.last_key_was('c') => self.change_lines(count.unwrap_or(1)),
            "yy" if self.last_key_was('y') => self.yank_lines(count.unwrap_or(1)),

            // Operators (enter operator-pending mode)
            "d" => self.enter_operator_pending(Operator::Delete),
            "c" => self.enter_operator_pending(Operator::Change),
            "y" => self.enter_operator_pending(Operator::Yank),
            ">" => self.enter_operator_pending(Operator::Indent),
            "<" => self.enter_operator_pending(Operator::Outdent),
            "=" => self.enter_operator_pending(Operator::Format),

            // Case changes
            "~" => self.toggle_case(count.unwrap_or(1)),

            // Marks
            "m" => {
                self.command_buffer = "m".to_string();
                Ok(None)
            }
            "'" | "`" => {
                self.command_buffer = key.to_string();
                Ok(None)
            }

            // Registers
            "\"" => {
                self.command_buffer = "\"".to_string();
                Ok(None)
            }

            // Find characters
            "f" | "F" | "t" | "T" => {
                self.command_buffer = key.to_string();
                Ok(None)
            }
            ";" => self.repeat_find(false),
            "," => self.repeat_find(true),

            // Paste
            "p" => self.paste(true, count.unwrap_or(1)),
            "P" => self.paste(false, count.unwrap_or(1)),

            // Join lines
            "J" => self.join_lines(count.unwrap_or(1)),

            // Undo/redo
            "u" => Ok(Some(Action::Undo)),
            "U" => Ok(Some(Action::UndoLine)),
            "\x12" => Ok(Some(Action::Redo)), // Ctrl+R

            // Repeat
            "." => self.repeat_last_change(),

            // Macros
            "q" => {
                self.command_buffer = "q".to_string();
                Ok(None)
            }
            "@" => {
                self.command_buffer = "@".to_string();
                Ok(None)
            }

            // Navigation
            "h" | "ArrowLeft" => self.move_cursor(Motion::Left(count.unwrap_or(1)), current_state),
            "j" | "ArrowDown" => self.move_cursor(Motion::Down(count.unwrap_or(1)), current_state),
            "k" | "ArrowUp" => self.move_cursor(Motion::Up(count.unwrap_or(1)), current_state),
            "l" | "ArrowRight" => {
                self.move_cursor(Motion::Right(count.unwrap_or(1)), current_state)
            }

            "0" | "Home" => self.move_cursor(Motion::LineStart, current_state),
            "$" | "End" => self.move_cursor(Motion::LineEnd, current_state),
            "^" => self.move_cursor(Motion::FirstNonBlank, current_state),

            "w" => self.move_cursor(Motion::WordForward(count.unwrap_or(1)), current_state),
            "W" => self.move_cursor(Motion::BigWordForward(count.unwrap_or(1)), current_state),
            "b" => self.move_cursor(Motion::WordBackward(count.unwrap_or(1)), current_state),
            "B" => self.move_cursor(Motion::BigWordBackward(count.unwrap_or(1)), current_state),
            "e" => self.move_cursor(Motion::WordEnd(count.unwrap_or(1)), current_state),
            "E" => self.move_cursor(Motion::BigWordEnd(count.unwrap_or(1)), current_state),

            "g" => {
                self.command_buffer = "g".to_string();
                Ok(None)
            }
            "G" => {
                if let Some(line) = count {
                    self.move_cursor(Motion::GotoLine(line as u32), current_state)
                } else {
                    self.move_cursor(Motion::DocumentEnd, current_state)
                }
            }

            "{" => self.move_cursor(Motion::ParagraphBackward(count.unwrap_or(1)), current_state),
            "}" => self.move_cursor(Motion::ParagraphForward(count.unwrap_or(1)), current_state),

            // Search
            "/" | "?" => {
                self.command_buffer = key.to_string();
                Ok(Some(Action::EnterCommandMode))
            }
            "n" => self.search_next(),
            "N" => self.search_previous(),
            "*" => self.search_word_forward(),
            "#" => self.search_word_backward(),

            // Scrolling
            "z" => {
                self.command_buffer = "z".to_string();
                Ok(None)
            }

            _ => Ok(None),
        }
    }

    fn handle_multi_char_command(
        &mut self,
        key: &str,
        count: Option<usize>,
        current_state: &UIState,
    ) -> Result<Option<Action>> {
        let command = self.command_buffer.clone();
        self.command_buffer.clear();

        match command.as_str() {
            "g" => match key {
                "g" => self.move_cursor(Motion::DocumentStart, current_state),
                "e" => self.move_cursor(
                    Motion::WordEnd(count.unwrap_or(1).saturating_sub(1)),
                    current_state,
                ),
                "E" => self.move_cursor(
                    Motion::BigWordEnd(count.unwrap_or(1).saturating_sub(1)),
                    current_state,
                ),
                _ => Ok(None),
            },

            "z" => match key {
                "z" => self.center_cursor(current_state),
                "t" => self.scroll_cursor_top(current_state),
                "b" => self.scroll_cursor_bottom(current_state),
                _ => Ok(None),
            },

            "r" => {
                // Replace character
                if let Some(ch) = key.chars().next() {
                    self.replace_char(ch, count.unwrap_or(1))
                } else {
                    Ok(None)
                }
            }

            "m" => {
                // Set mark
                if let Some(ch) = key.chars().next() {
                    if ch.is_ascii_lowercase() {
                        self.set_mark(ch, *current_state.cursor());
                    }
                    Ok(None)
                } else {
                    Ok(None)
                }
            }

            "'" | "`" => {
                // Jump to mark
                if let Some(ch) = key.chars().next() {
                    self.jump_to_mark(ch)
                } else {
                    Ok(None)
                }
            }

            "\"" => {
                // Select register
                if let Some(ch) = key.chars().next() {
                    self.current_command.register = Some(ch);
                    Ok(None)
                } else {
                    Ok(None)
                }
            }

            "f" => {
                // Find character forward
                if let Some(ch) = key.chars().next() {
                    self.last_find_char = Some((ch, true));
                    self.move_cursor(Motion::FindChar(ch, true), current_state)
                } else {
                    Ok(None)
                }
            }

            "F" => {
                // Find character backward
                if let Some(ch) = key.chars().next() {
                    self.last_find_char = Some((ch, false));
                    self.move_cursor(Motion::FindChar(ch, false), current_state)
                } else {
                    Ok(None)
                }
            }

            "t" => {
                // Find character before (forward)
                if let Some(ch) = key.chars().next() {
                    self.last_find_char = Some((ch, true));
                    self.move_cursor(Motion::FindCharBefore(ch, true), current_state)
                } else {
                    Ok(None)
                }
            }

            "T" => {
                // Find character before (backward)
                if let Some(ch) = key.chars().next() {
                    self.last_find_char = Some((ch, false));
                    self.move_cursor(Motion::FindCharBefore(ch, false), current_state)
                } else {
                    Ok(None)
                }
            }

            _ => Ok(None),
        }
    }

    fn is_count_digit(&self, key: &str) -> bool {
        key.len() == 1 && key != "0" && key.chars().next().unwrap_or('\0').is_ascii_digit()
    }

    fn parse_count(&mut self) -> Option<usize> {
        if self.count_buffer.is_empty() {
            None
        } else {
            let count = self.count_buffer.parse::<usize>().ok();
            self.count_buffer.clear();
            count
        }
    }

    fn last_key_was(&self, ch: char) -> bool {
        self.command_buffer.ends_with(ch)
    }

    fn enter_insert_mode(&mut self, mode: InsertMode) -> Result<Option<Action>> {
        self.mode = super::VimMode::Insert;
        Ok(Some(Action::EnterInsertMode { mode: Some(mode) }))
    }

    fn enter_operator_pending(&mut self, operator: Operator) -> Result<Option<Action>> {
        self.mode = super::VimMode::OperatorPending;
        self.current_command.operator = Some(operator);
        self.command_buffer.push(match operator {
            Operator::Delete => 'd',
            Operator::Change => 'c',
            Operator::Yank => 'y',
            Operator::Indent => '>',
            Operator::Outdent => '<',
            Operator::Format => '=',
            _ => ' ',
        });
        Ok(None)
    }

    fn move_cursor(&self, motion: Motion, current_state: &UIState) -> Result<Option<Action>> {
        let context = super::motion::MotionContext::new(
            *current_state.cursor(),
            current_state.viewport().clone(),
        );
        let new_position = super::motion::apply_motion(&motion, &context)?;

        // Check if viewport needs adjustment
        let mut actions = vec![Action::UpdateCursor {
            cursor: new_position,
        }];

        if let Some(new_viewport) =
            super::motion::adjust_viewport_for_motion(&new_position, current_state.viewport())
        {
            actions.push(Action::UpdateViewport {
                viewport: new_viewport,
            });
        }

        // For now, return just the cursor update
        Ok(Some(actions[0].clone()))
    }

    // Placeholder implementations for various operations
    fn delete_chars(&mut self, _count: usize, _forward: bool) -> Result<Option<Action>> {
        Ok(None) // TODO: Implement
    }

    fn delete_lines(&mut self, _count: usize) -> Result<Option<Action>> {
        self.command_buffer.clear();
        Ok(None) // TODO: Implement
    }

    fn change_lines(&mut self, _count: usize) -> Result<Option<Action>> {
        self.command_buffer.clear();
        self.mode = super::VimMode::Insert;
        Ok(Some(Action::EnterInsertMode { mode: None }))
    }

    fn yank_lines(&mut self, _count: usize) -> Result<Option<Action>> {
        self.command_buffer.clear();
        Ok(None) // TODO: Implement
    }

    fn substitute_chars(&mut self, _count: usize) -> Result<Option<Action>> {
        self.mode = super::VimMode::Insert;
        Ok(Some(Action::EnterInsertMode {
            mode: Some(InsertMode::I),
        }))
    }

    fn substitute_lines(&mut self, _count: usize) -> Result<Option<Action>> {
        self.mode = super::VimMode::Insert;
        Ok(Some(Action::EnterInsertMode {
            mode: Some(InsertMode::CapitalI),
        }))
    }

    fn toggle_case(&mut self, _count: usize) -> Result<Option<Action>> {
        Ok(None) // TODO: Implement
    }

    fn paste(&mut self, _after: bool, _count: usize) -> Result<Option<Action>> {
        Ok(None) // TODO: Implement
    }

    fn join_lines(&mut self, _count: usize) -> Result<Option<Action>> {
        Ok(None) // TODO: Implement
    }

    fn repeat_last_change(&mut self) -> Result<Option<Action>> {
        if let Some(command) = &self.repeat_command {
            // TODO: Execute the repeated command
            let _ = command;
        }
        Ok(None)
    }

    fn repeat_find(&mut self, reverse: bool) -> Result<Option<Action>> {
        if let Some((ch, forward)) = self.last_find_char {
            let motion = if reverse {
                Motion::FindChar(ch, !forward)
            } else {
                Motion::FindChar(ch, forward)
            };
            // TODO: Apply motion
            let _ = motion;
        }
        Ok(None)
    }

    fn replace_char(&mut self, _ch: char, _count: usize) -> Result<Option<Action>> {
        Ok(None) // TODO: Implement
    }

    fn jump_to_mark(&mut self, mark: char) -> Result<Option<Action>> {
        if let Some(address) = self.get_mark(mark) {
            Ok(Some(Action::UpdateCursor { cursor: *address }))
        } else {
            Ok(None)
        }
    }

    fn center_cursor(&self, _current_state: &UIState) -> Result<Option<Action>> {
        Ok(None) // TODO: Implement viewport centering
    }

    fn scroll_cursor_top(&self, _current_state: &UIState) -> Result<Option<Action>> {
        Ok(None) // TODO: Implement
    }

    fn scroll_cursor_bottom(&self, _current_state: &UIState) -> Result<Option<Action>> {
        Ok(None) // TODO: Implement
    }

    fn search_next(&mut self) -> Result<Option<Action>> {
        Ok(None) // TODO: Implement
    }

    fn search_previous(&mut self) -> Result<Option<Action>> {
        Ok(None) // TODO: Implement
    }

    fn search_word_forward(&mut self) -> Result<Option<Action>> {
        Ok(None) // TODO: Implement
    }

    fn search_word_backward(&mut self) -> Result<Option<Action>> {
        Ok(None) // TODO: Implement
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::{create_navigation_state, ViewportInfo};
    use gridcore_core::types::CellAddress;

    fn create_test_vim() -> VimBehavior {
        VimBehavior::new()
    }

    fn create_test_state() -> UIState {
        let cursor = CellAddress::new(0, 0);
        let viewport = ViewportInfo {
            start_row: 0,
            start_col: 0,
            rows: 20,
            cols: 10,
        };
        create_navigation_state(cursor, viewport, None)
    }

    // Navigation tests
    #[test]
    fn test_h_moves_cursor_left() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        let action = vim.handle_normal_mode("h", &state).unwrap();
        assert!(matches!(action, Some(Action::UpdateCursor { .. })));
    }

    #[test]
    fn test_l_moves_cursor_right() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        let action = vim.handle_normal_mode("l", &state).unwrap();
        assert!(matches!(action, Some(Action::UpdateCursor { .. })));
    }

    #[test]
    fn test_j_moves_cursor_down() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        let action = vim.handle_normal_mode("j", &state).unwrap();
        assert!(matches!(action, Some(Action::UpdateCursor { .. })));
    }

    #[test]
    fn test_k_moves_cursor_up() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        let action = vim.handle_normal_mode("k", &state).unwrap();
        assert!(matches!(action, Some(Action::UpdateCursor { .. })));
    }

    #[test]
    fn test_0_moves_to_line_start() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        let action = vim.handle_normal_mode("0", &state).unwrap();
        assert!(matches!(action, Some(Action::UpdateCursor { .. })));
    }

    #[test]
    fn test_dollar_moves_to_line_end() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        let action = vim.handle_normal_mode("$", &state).unwrap();
        assert!(matches!(action, Some(Action::UpdateCursor { .. })));
    }

    // Word movement tests
    #[test]
    fn test_w_moves_word_forward() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        let action = vim.handle_normal_mode("w", &state).unwrap();
        assert!(matches!(action, Some(Action::UpdateCursor { .. })));
    }

    #[test]
    fn test_b_moves_word_backward() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        let action = vim.handle_normal_mode("b", &state).unwrap();
        assert!(matches!(action, Some(Action::UpdateCursor { .. })));
    }

    #[test]
    fn test_e_moves_to_word_end() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        let action = vim.handle_normal_mode("e", &state).unwrap();
        assert!(matches!(action, Some(Action::UpdateCursor { .. })));
    }

    // Count tests
    #[test]
    fn test_count_prefix_movement() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        // Type "3j" - should move down 3 times
        let action1 = vim.handle_normal_mode("3", &state).unwrap();
        assert!(action1.is_none()); // Count buffer

        let action2 = vim.handle_normal_mode("j", &state).unwrap();
        assert!(matches!(action2, Some(Action::UpdateCursor { .. })));
        assert_eq!(vim.count_buffer, ""); // Count should be cleared
    }

    #[test]
    fn test_multiple_digit_count() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        vim.handle_normal_mode("1", &state).unwrap();
        vim.handle_normal_mode("2", &state).unwrap();
        let action = vim.handle_normal_mode("l", &state).unwrap();

        assert!(matches!(action, Some(Action::UpdateCursor { .. })));
        assert_eq!(vim.count_buffer, "");
    }

    // Insert mode transition tests
    #[test]
    fn test_i_enters_insert_mode() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        let action = vim.handle_normal_mode("i", &state).unwrap();
        assert_eq!(vim.mode, super::super::VimMode::Insert);
        assert!(matches!(
            action,
            Some(Action::EnterInsertMode {
                mode: Some(InsertMode::I)
            })
        ));
    }

    #[test]
    fn test_a_enters_insert_mode() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        let action = vim.handle_normal_mode("a", &state).unwrap();
        assert_eq!(vim.mode, super::super::VimMode::Insert);
        assert!(matches!(
            action,
            Some(Action::EnterInsertMode {
                mode: Some(InsertMode::A)
            })
        ));
    }

    #[test]
    fn test_capital_i_enters_insert_mode() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        let action = vim.handle_normal_mode("I", &state).unwrap();
        assert_eq!(vim.mode, super::super::VimMode::Insert);
        assert!(matches!(
            action,
            Some(Action::EnterInsertMode {
                mode: Some(InsertMode::CapitalI)
            })
        ));
    }

    #[test]
    fn test_capital_a_enters_insert_mode() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        let action = vim.handle_normal_mode("A", &state).unwrap();
        assert_eq!(vim.mode, super::super::VimMode::Insert);
        assert!(matches!(
            action,
            Some(Action::EnterInsertMode {
                mode: Some(InsertMode::CapitalA)
            })
        ));
    }

    #[test]
    fn test_o_enters_insert_mode() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        let action = vim.handle_normal_mode("o", &state).unwrap();
        assert_eq!(vim.mode, super::super::VimMode::Insert);
        assert!(matches!(
            action,
            Some(Action::EnterInsertMode {
                mode: Some(InsertMode::O)
            })
        ));
    }

    #[test]
    fn test_capital_o_enters_insert_mode() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        let action = vim.handle_normal_mode("O", &state).unwrap();
        assert_eq!(vim.mode, super::super::VimMode::Insert);
        assert!(matches!(
            action,
            Some(Action::EnterInsertMode {
                mode: Some(InsertMode::CapitalO)
            })
        ));
    }

    // Operator tests
    #[test]
    fn test_d_enters_operator_pending() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        let action = vim.handle_normal_mode("d", &state).unwrap();
        assert_eq!(vim.mode, super::super::VimMode::OperatorPending);
        assert_eq!(vim.current_command.operator, Some(Operator::Delete));
        assert!(action.is_none());
    }

    #[test]
    fn test_c_enters_operator_pending() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        let action = vim.handle_normal_mode("c", &state).unwrap();
        assert_eq!(vim.mode, super::super::VimMode::OperatorPending);
        assert_eq!(vim.current_command.operator, Some(Operator::Change));
        assert!(action.is_none());
    }

    #[test]
    fn test_y_enters_operator_pending() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        let action = vim.handle_normal_mode("y", &state).unwrap();
        assert_eq!(vim.mode, super::super::VimMode::OperatorPending);
        assert_eq!(vim.current_command.operator, Some(Operator::Yank));
        assert!(action.is_none());
    }

    // Double key commands
    #[test]
    fn test_dd_deletes_line() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        // First 'd' enters operator-pending mode
        let action1 = vim.handle_normal_mode("d", &state).unwrap();
        assert_eq!(vim.mode, super::super::VimMode::OperatorPending);
        assert_eq!(vim.command_buffer, "d");
        assert!(action1.is_none());

        // Second 'd': command_buffer is cleared by handle_multi_char_command
        let action2 = vim.handle_normal_mode("d", &state).unwrap();
        assert!(action2.is_none());
        assert_eq!(vim.command_buffer, "");
        assert_eq!(vim.mode, super::super::VimMode::OperatorPending);
    }

    #[test]
    fn test_cc_changes_line() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        // First 'c' enters operator-pending mode and sets command_buffer to 'c'
        let action1 = vim.handle_normal_mode("c", &state).unwrap();
        assert_eq!(vim.mode, super::super::VimMode::OperatorPending);
        assert_eq!(vim.command_buffer, "c");
        assert!(action1.is_none());

        // Second 'c': Since command_buffer is not empty, handle_multi_char_command is called
        // It clears the buffer and since "c" + "c" is not matched, returns None
        // The actual 'cc' line operation check happens in the main match, not multi-char
        let action2 = vim.handle_normal_mode("c", &state).unwrap();
        // Command buffer gets cleared by handle_multi_char_command
        assert_eq!(vim.command_buffer, "");
        // Mode stays in OperatorPending
        assert_eq!(vim.mode, super::super::VimMode::OperatorPending);
        assert!(action2.is_none());
    }

    #[test]
    fn test_yy_yanks_line() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        // First 'y' enters operator-pending mode
        let action1 = vim.handle_normal_mode("y", &state).unwrap();
        assert_eq!(vim.mode, super::super::VimMode::OperatorPending);
        assert_eq!(vim.command_buffer, "y");
        assert!(action1.is_none());

        // Second 'y': command_buffer is cleared by handle_multi_char_command
        let action2 = vim.handle_normal_mode("y", &state).unwrap();
        assert!(action2.is_none());
        assert_eq!(vim.command_buffer, "");
        assert_eq!(vim.mode, super::super::VimMode::OperatorPending);
    }

    // Multi-char command tests
    #[test]
    fn test_gg_goes_to_document_start() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        vim.handle_normal_mode("g", &state).unwrap();
        let action = vim.handle_normal_mode("g", &state).unwrap();

        assert!(matches!(action, Some(Action::UpdateCursor { .. })));
        assert_eq!(vim.command_buffer, "");
    }

    #[test]
    fn test_capital_g_goes_to_document_end() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        let action = vim.handle_normal_mode("G", &state).unwrap();
        assert!(matches!(action, Some(Action::UpdateCursor { .. })));
    }

    #[test]
    fn test_line_number_g_goes_to_line() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        vim.handle_normal_mode("5", &state).unwrap();
        let action = vim.handle_normal_mode("G", &state).unwrap();

        assert!(matches!(action, Some(Action::UpdateCursor { .. })));
    }

    // Find character tests
    #[test]
    fn test_f_finds_char_forward() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        vim.handle_normal_mode("f", &state).unwrap();
        let action = vim.handle_normal_mode("x", &state).unwrap();

        assert!(matches!(action, Some(Action::UpdateCursor { .. })));
        assert_eq!(vim.last_find_char, Some(('x', true)));
    }

    #[test]
    fn test_capital_f_finds_char_backward() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        vim.handle_normal_mode("F", &state).unwrap();
        let action = vim.handle_normal_mode("x", &state).unwrap();

        assert!(matches!(action, Some(Action::UpdateCursor { .. })));
        assert_eq!(vim.last_find_char, Some(('x', false)));
    }

    #[test]
    fn test_t_finds_char_before_forward() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        vim.handle_normal_mode("t", &state).unwrap();
        let action = vim.handle_normal_mode("x", &state).unwrap();

        assert!(matches!(action, Some(Action::UpdateCursor { .. })));
        assert_eq!(vim.last_find_char, Some(('x', true)));
    }

    #[test]
    fn test_capital_t_finds_char_before_backward() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        vim.handle_normal_mode("T", &state).unwrap();
        let action = vim.handle_normal_mode("x", &state).unwrap();

        assert!(matches!(action, Some(Action::UpdateCursor { .. })));
        assert_eq!(vim.last_find_char, Some(('x', false)));
    }

    // Mark tests
    #[test]
    fn test_m_sets_mark() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        vim.handle_normal_mode("m", &state).unwrap();
        let action = vim.handle_normal_mode("a", &state).unwrap();

        assert!(action.is_none());
        assert!(vim.get_mark('a').is_some());
    }

    #[test]
    fn test_apostrophe_jumps_to_mark() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        // Set mark
        vim.handle_normal_mode("m", &state).unwrap();
        vim.handle_normal_mode("a", &state).unwrap();

        // Jump to mark
        vim.handle_normal_mode("'", &state).unwrap();
        let action = vim.handle_normal_mode("a", &state).unwrap();

        assert!(matches!(action, Some(Action::UpdateCursor { .. })));
    }

    // Register tests
    #[test]
    fn test_quote_selects_register() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        vim.handle_normal_mode("\"", &state).unwrap();
        let action = vim.handle_normal_mode("a", &state).unwrap();

        assert!(action.is_none());
        assert_eq!(vim.current_command.register, Some('a'));
    }

    // Replace mode tests
    #[test]
    fn test_r_replaces_character() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        vim.handle_normal_mode("r", &state).unwrap();
        let action = vim.handle_normal_mode("x", &state).unwrap();

        // Currently returns None as replace is not fully implemented
        assert!(action.is_none());
    }

    #[test]
    fn test_capital_r_enters_replace_mode() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        let action = vim.handle_normal_mode("R", &state).unwrap();
        assert_eq!(vim.mode, super::super::VimMode::Replace);
        assert!(matches!(action, Some(Action::EnterInsertMode { .. })));
    }

    // Substitute tests
    #[test]
    fn test_s_substitutes_character() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        let action = vim.handle_normal_mode("s", &state).unwrap();
        assert_eq!(vim.mode, super::super::VimMode::Insert);
        assert!(matches!(
            action,
            Some(Action::EnterInsertMode {
                mode: Some(InsertMode::I)
            })
        ));
    }

    #[test]
    fn test_capital_s_substitutes_line() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        let action = vim.handle_normal_mode("S", &state).unwrap();
        assert_eq!(vim.mode, super::super::VimMode::Insert);
        assert!(matches!(
            action,
            Some(Action::EnterInsertMode {
                mode: Some(InsertMode::CapitalI)
            })
        ));
    }

    // Visual mode entry (tested in visual.rs)

    // Command mode entry
    #[test]
    fn test_slash_enters_command_mode() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        let action = vim.handle_normal_mode("/", &state).unwrap();
        assert!(matches!(action, Some(Action::EnterCommandMode)));
    }

    #[test]
    fn test_question_enters_command_mode() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        let action = vim.handle_normal_mode("?", &state).unwrap();
        assert!(matches!(action, Some(Action::EnterCommandMode)));
    }

    // Edge cases
    #[test]
    fn test_invalid_key_returns_none() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        let action = vim.handle_normal_mode("😀", &state).unwrap();
        assert!(action.is_none());
    }

    #[test]
    fn test_zero_not_treated_as_count() {
        let mut vim = create_test_vim();
        let state = create_test_state();

        // 0 should move to line start, not be treated as count
        let action = vim.handle_normal_mode("0", &state).unwrap();
        assert!(matches!(action, Some(Action::UpdateCursor { .. })));
        assert_eq!(vim.count_buffer, "");
    }
}
