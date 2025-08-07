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
            "u" => Ok(Some(Action::ExitToNavigation)), // TODO: Implement proper undo
            "U" => Ok(None),                           // TODO: Implement undo line

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
                if key.len() == 1 {
                    self.replace_char(key.chars().next().unwrap(), count.unwrap_or(1))
                } else {
                    Ok(None)
                }
            }

            "m" => {
                // Set mark
                if key.len() == 1 && key.chars().next().unwrap().is_ascii_lowercase() {
                    self.set_mark(key.chars().next().unwrap(), current_state.cursor().clone());
                    Ok(None)
                } else {
                    Ok(None)
                }
            }

            "'" | "`" => {
                // Jump to mark
                if key.len() == 1 {
                    self.jump_to_mark(key.chars().next().unwrap())
                } else {
                    Ok(None)
                }
            }

            "\"" => {
                // Select register
                if key.len() == 1 {
                    self.current_command.register = Some(key.chars().next().unwrap());
                    Ok(None)
                } else {
                    Ok(None)
                }
            }

            "f" => {
                // Find character forward
                if key.len() == 1 {
                    let ch = key.chars().next().unwrap();
                    self.last_find_char = Some((ch, true));
                    self.move_cursor(Motion::FindChar(ch, true), current_state)
                } else {
                    Ok(None)
                }
            }

            "F" => {
                // Find character backward
                if key.len() == 1 {
                    let ch = key.chars().next().unwrap();
                    self.last_find_char = Some((ch, false));
                    self.move_cursor(Motion::FindChar(ch, false), current_state)
                } else {
                    Ok(None)
                }
            }

            "t" => {
                // Find character before (forward)
                if key.len() == 1 {
                    let ch = key.chars().next().unwrap();
                    self.last_find_char = Some((ch, true));
                    self.move_cursor(Motion::FindCharBefore(ch, true), current_state)
                } else {
                    Ok(None)
                }
            }

            "T" => {
                // Find character before (backward)
                if key.len() == 1 {
                    let ch = key.chars().next().unwrap();
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
        key.len() == 1 && key != "0" && key.chars().next().unwrap().is_ascii_digit()
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
        self.command_buffer.chars().last() == Some(ch)
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
            current_state.cursor().clone(),
            current_state.viewport().clone(),
        );
        let new_position = super::motion::apply_motion(&motion, &context)?;

        // Check if viewport needs adjustment
        let mut actions = vec![Action::UpdateCursor {
            cursor: new_position.clone(),
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
            Ok(Some(Action::UpdateCursor {
                cursor: address.clone(),
            }))
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
