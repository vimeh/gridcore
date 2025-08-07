use crate::state::{Action, CellMode, InsertMode, VisualMode};
use gridcore_core::Result;

/// Vim behavior within a cell editor
pub struct CellVimBehavior {
    mode: CellMode,
    text: String,
    cursor_position: usize,
    visual_anchor: Option<usize>,
    visual_mode: Option<VisualMode>,
    last_change: Option<CellChange>,
    registers: std::collections::HashMap<char, String>,
}

#[derive(Debug, Clone)]
struct CellChange {
    action: ChangeAction,
    text: String,
    position: usize,
}

#[derive(Debug, Clone, Copy)]
enum ChangeAction {
    Insert,
    Delete,
    Replace,
}

impl CellVimBehavior {
    pub fn new(initial_text: String) -> Self {
        Self {
            mode: CellMode::Normal,
            text: initial_text,
            cursor_position: 0,
            visual_anchor: None,
            visual_mode: None,
            last_change: None,
            registers: std::collections::HashMap::new(),
        }
    }

    pub fn get_mode(&self) -> CellMode {
        self.mode
    }

    pub fn get_text(&self) -> &str {
        &self.text
    }

    pub fn get_cursor_position(&self) -> usize {
        self.cursor_position
    }

    pub fn get_visual_selection(&self) -> Option<(usize, usize)> {
        if self.mode == CellMode::Visual {
            if let Some(anchor) = self.visual_anchor {
                let start = anchor.min(self.cursor_position);
                let end = anchor.max(self.cursor_position);
                Some((start, end))
            } else {
                None
            }
        } else {
            None
        }
    }

    /// Process a key press in the cell editor
    pub fn process_key(&mut self, key: &str) -> Result<Option<Action>> {
        match self.mode {
            CellMode::Normal => self.process_normal_key(key),
            CellMode::Insert => self.process_insert_key(key),
            CellMode::Visual => self.process_visual_key(key),
        }
    }

    fn process_normal_key(&mut self, key: &str) -> Result<Option<Action>> {
        match key {
            // Mode changes
            "i" => self.enter_insert_mode(InsertMode::I),
            "a" => self.enter_insert_mode(InsertMode::A),
            "I" => self.enter_insert_mode(InsertMode::CapitalI),
            "A" => self.enter_insert_mode(InsertMode::CapitalA),
            "o" => self.enter_insert_mode(InsertMode::O),
            "O" => self.enter_insert_mode(InsertMode::CapitalO),

            // Visual mode
            "v" => self.enter_visual_mode(VisualMode::Character),
            "V" => self.enter_visual_mode(VisualMode::Line),

            // Movement
            "h" | "ArrowLeft" => self.move_cursor_left(1),
            "l" | "ArrowRight" => self.move_cursor_right(1),
            "0" | "Home" => self.move_to_line_start(),
            "$" | "End" => self.move_to_line_end(),
            "^" => self.move_to_first_non_blank(),

            // Word movement
            "w" => self.move_word_forward(),
            "b" => self.move_word_backward(),
            "e" => self.move_word_end(),
            "W" => self.move_big_word_forward(),
            "B" => self.move_big_word_backward(),
            "E" => self.move_big_word_end(),

            // Delete
            "x" => self.delete_char(),
            "X" => self.delete_char_before(),
            "dd" => self.delete_line(),
            "D" => self.delete_to_end(),
            "dw" => self.delete_word(),
            "db" => self.delete_word_backward(),

            // Change
            "cc" => self.change_line(),
            "C" => self.change_to_end(),
            "cw" => self.change_word(),
            "cb" => self.change_word_backward(),
            "s" => self.substitute_char(),
            "S" => self.substitute_line(),

            // Copy/paste
            "yy" => self.yank_line(),
            "y$" => self.yank_to_end(),
            "yw" => self.yank_word(),
            "p" => self.paste_after(),
            "P" => self.paste_before(),

            // Replace
            "r" => Ok(None), // TODO: Enter replace mode
            "R" => Ok(None), // TODO: Enter replace mode

            // Undo/redo
            "u" => self.undo(),

            // Exit cell editing
            "Escape" => Ok(Some(Action::ExitToNavigation)),

            _ => Ok(None),
        }
    }

    fn process_insert_key(&mut self, key: &str) -> Result<Option<Action>> {
        match key {
            "Escape" => {
                self.mode = CellMode::Normal;
                Ok(Some(Action::ExitInsertMode))
            }
            "Backspace" => {
                if self.cursor_position > 0 {
                    self.text.remove(self.cursor_position - 1);
                    self.cursor_position -= 1;
                    self.update_editing_value()
                } else {
                    Ok(None)
                }
            }
            "Delete" => {
                if self.cursor_position < self.text.len() {
                    self.text.remove(self.cursor_position);
                    self.update_editing_value()
                } else {
                    Ok(None)
                }
            }
            "ArrowLeft" => self.move_cursor_left(1),
            "ArrowRight" => self.move_cursor_right(1),
            "Home" => self.move_to_line_start(),
            "End" => self.move_to_line_end(),
            _ => {
                // Insert the character(s)
                if key.len() == 1 || key == "Tab" || key == "Space" {
                    let ch = if key == "Tab" {
                        '\t'
                    } else if key == "Space" {
                        ' '
                    } else {
                        key.chars().next().unwrap()
                    };
                    self.text.insert(self.cursor_position, ch);
                    self.cursor_position += 1;
                    self.update_editing_value()
                } else {
                    Ok(None)
                }
            }
        }
    }

    fn process_visual_key(&mut self, key: &str) -> Result<Option<Action>> {
        match key {
            "Escape" | "v" => {
                self.mode = CellMode::Normal;
                self.visual_anchor = None;
                self.visual_mode = None;
                Ok(Some(Action::ExitVisualMode))
            }

            // Movement extends selection
            "h" | "ArrowLeft" => self.extend_selection_left(),
            "l" | "ArrowRight" => self.extend_selection_right(),
            "0" | "Home" => self.extend_selection_to_start(),
            "$" | "End" => self.extend_selection_to_end(),
            "w" => self.extend_selection_word_forward(),
            "b" => self.extend_selection_word_backward(),

            // Operations on selection
            "d" | "x" => self.delete_selection(),
            "c" => self.change_selection(),
            "y" => self.yank_selection(),
            "~" => self.toggle_case_selection(),
            "u" => self.lowercase_selection(),
            "U" => self.uppercase_selection(),

            _ => Ok(None),
        }
    }

    // Mode transitions
    fn enter_insert_mode(&mut self, mode: InsertMode) -> Result<Option<Action>> {
        self.mode = CellMode::Insert;

        match mode {
            InsertMode::I => {
                // Insert before cursor
            }
            InsertMode::A => {
                // Append after cursor
                self.cursor_position = (self.cursor_position + 1).min(self.text.len());
            }
            InsertMode::CapitalI => {
                // Insert at beginning of line
                self.cursor_position = 0;
            }
            InsertMode::CapitalA => {
                // Append at end of line
                self.cursor_position = self.text.len();
            }
            InsertMode::O => {
                // Open line below (not applicable in single cell)
                self.cursor_position = self.text.len();
                self.text.push('\n');
            }
            InsertMode::CapitalO => {
                // Open line above (not applicable in single cell)
                self.cursor_position = 0;
                self.text.insert(0, '\n');
            }
        }

        Ok(Some(Action::EnterInsertMode { mode: Some(mode) }))
    }

    fn enter_visual_mode(&mut self, mode: VisualMode) -> Result<Option<Action>> {
        self.mode = CellMode::Visual;
        self.visual_mode = Some(mode);
        self.visual_anchor = Some(self.cursor_position);

        Ok(Some(Action::EnterVisualMode {
            visual_type: mode,
            anchor: Some(self.cursor_position),
        }))
    }

    // Movement operations
    fn move_cursor_left(&mut self, count: usize) -> Result<Option<Action>> {
        self.cursor_position = self.cursor_position.saturating_sub(count);
        self.update_editing_value()
    }

    fn move_cursor_right(&mut self, count: usize) -> Result<Option<Action>> {
        self.cursor_position = (self.cursor_position + count).min(self.text.len());
        self.update_editing_value()
    }

    fn move_to_line_start(&mut self) -> Result<Option<Action>> {
        self.cursor_position = 0;
        self.update_editing_value()
    }

    fn move_to_line_end(&mut self) -> Result<Option<Action>> {
        self.cursor_position = self.text.len();
        self.update_editing_value()
    }

    fn move_to_first_non_blank(&mut self) -> Result<Option<Action>> {
        self.cursor_position = self
            .text
            .chars()
            .position(|c| !c.is_whitespace())
            .unwrap_or(0);
        self.update_editing_value()
    }

    fn move_word_forward(&mut self) -> Result<Option<Action>> {
        self.cursor_position = self.find_next_word_start(self.cursor_position);
        self.update_editing_value()
    }

    fn move_word_backward(&mut self) -> Result<Option<Action>> {
        self.cursor_position = self.find_prev_word_start(self.cursor_position);
        self.update_editing_value()
    }

    fn move_word_end(&mut self) -> Result<Option<Action>> {
        self.cursor_position = self.find_word_end(self.cursor_position);
        self.update_editing_value()
    }

    fn move_big_word_forward(&mut self) -> Result<Option<Action>> {
        self.cursor_position = self.find_next_big_word_start(self.cursor_position);
        self.update_editing_value()
    }

    fn move_big_word_backward(&mut self) -> Result<Option<Action>> {
        self.cursor_position = self.find_prev_big_word_start(self.cursor_position);
        self.update_editing_value()
    }

    fn move_big_word_end(&mut self) -> Result<Option<Action>> {
        self.cursor_position = self.find_big_word_end(self.cursor_position);
        self.update_editing_value()
    }

    // Delete operations
    fn delete_char(&mut self) -> Result<Option<Action>> {
        if self.cursor_position < self.text.len() {
            self.text.remove(self.cursor_position);
            self.update_editing_value()
        } else {
            Ok(None)
        }
    }

    fn delete_char_before(&mut self) -> Result<Option<Action>> {
        if self.cursor_position > 0 {
            self.cursor_position -= 1;
            self.text.remove(self.cursor_position);
            self.update_editing_value()
        } else {
            Ok(None)
        }
    }

    fn delete_line(&mut self) -> Result<Option<Action>> {
        self.text.clear();
        self.cursor_position = 0;
        self.update_editing_value()
    }

    fn delete_to_end(&mut self) -> Result<Option<Action>> {
        self.text.truncate(self.cursor_position);
        self.update_editing_value()
    }

    fn delete_word(&mut self) -> Result<Option<Action>> {
        let end = self.find_next_word_start(self.cursor_position);
        self.text.drain(self.cursor_position..end);
        self.update_editing_value()
    }

    fn delete_word_backward(&mut self) -> Result<Option<Action>> {
        let start = self.find_prev_word_start(self.cursor_position);
        self.text.drain(start..self.cursor_position);
        self.cursor_position = start;
        self.update_editing_value()
    }

    // Change operations
    fn change_line(&mut self) -> Result<Option<Action>> {
        self.text.clear();
        self.cursor_position = 0;
        self.mode = CellMode::Insert;
        Ok(Some(Action::EnterInsertMode { mode: None }))
    }

    fn change_to_end(&mut self) -> Result<Option<Action>> {
        self.text.truncate(self.cursor_position);
        self.mode = CellMode::Insert;
        Ok(Some(Action::EnterInsertMode { mode: None }))
    }

    fn change_word(&mut self) -> Result<Option<Action>> {
        let end = self.find_next_word_start(self.cursor_position);
        self.text.drain(self.cursor_position..end);
        self.mode = CellMode::Insert;
        Ok(Some(Action::EnterInsertMode { mode: None }))
    }

    fn change_word_backward(&mut self) -> Result<Option<Action>> {
        let start = self.find_prev_word_start(self.cursor_position);
        self.text.drain(start..self.cursor_position);
        self.cursor_position = start;
        self.mode = CellMode::Insert;
        Ok(Some(Action::EnterInsertMode { mode: None }))
    }

    fn substitute_char(&mut self) -> Result<Option<Action>> {
        if self.cursor_position < self.text.len() {
            self.text.remove(self.cursor_position);
        }
        self.mode = CellMode::Insert;
        Ok(Some(Action::EnterInsertMode { mode: None }))
    }

    fn substitute_line(&mut self) -> Result<Option<Action>> {
        self.text.clear();
        self.cursor_position = 0;
        self.mode = CellMode::Insert;
        Ok(Some(Action::EnterInsertMode { mode: None }))
    }

    // Visual mode operations
    fn extend_selection_left(&mut self) -> Result<Option<Action>> {
        self.cursor_position = self.cursor_position.saturating_sub(1);
        self.update_visual_selection()
    }

    fn extend_selection_right(&mut self) -> Result<Option<Action>> {
        self.cursor_position = (self.cursor_position + 1).min(self.text.len());
        self.update_visual_selection()
    }

    fn extend_selection_to_start(&mut self) -> Result<Option<Action>> {
        self.cursor_position = 0;
        self.update_visual_selection()
    }

    fn extend_selection_to_end(&mut self) -> Result<Option<Action>> {
        self.cursor_position = self.text.len();
        self.update_visual_selection()
    }

    fn extend_selection_word_forward(&mut self) -> Result<Option<Action>> {
        self.cursor_position = self.find_next_word_start(self.cursor_position);
        self.update_visual_selection()
    }

    fn extend_selection_word_backward(&mut self) -> Result<Option<Action>> {
        self.cursor_position = self.find_prev_word_start(self.cursor_position);
        self.update_visual_selection()
    }

    fn delete_selection(&mut self) -> Result<Option<Action>> {
        if let Some((start, end)) = self.get_visual_selection() {
            self.text.drain(start..=end);
            self.cursor_position = start;
            self.mode = CellMode::Normal;
            self.visual_anchor = None;
            self.update_editing_value()
        } else {
            Ok(None)
        }
    }

    fn change_selection(&mut self) -> Result<Option<Action>> {
        if let Some((start, end)) = self.get_visual_selection() {
            self.text.drain(start..=end);
            self.cursor_position = start;
            self.mode = CellMode::Insert;
            self.visual_anchor = None;
            Ok(Some(Action::EnterInsertMode { mode: None }))
        } else {
            Ok(None)
        }
    }

    fn yank_selection(&mut self) -> Result<Option<Action>> {
        if let Some((start, end)) = self.get_visual_selection() {
            let yanked = self.text[start..=end].to_string();
            self.registers.insert('0', yanked.clone());
            self.registers.insert('"', yanked);
            self.mode = CellMode::Normal;
            self.visual_anchor = None;
            Ok(Some(Action::ExitVisualMode))
        } else {
            Ok(None)
        }
    }

    fn toggle_case_selection(&mut self) -> Result<Option<Action>> {
        if let Some((start, end)) = self.get_visual_selection() {
            let selection = self.text[start..=end]
                .chars()
                .map(|c| {
                    if c.is_lowercase() {
                        c.to_uppercase().to_string()
                    } else {
                        c.to_lowercase().to_string()
                    }
                })
                .collect::<String>();
            self.text.replace_range(start..=end, &selection);
            self.mode = CellMode::Normal;
            self.visual_anchor = None;
            self.update_editing_value()
        } else {
            Ok(None)
        }
    }

    fn lowercase_selection(&mut self) -> Result<Option<Action>> {
        if let Some((start, end)) = self.get_visual_selection() {
            let selection = self.text[start..=end].to_lowercase();
            self.text.replace_range(start..=end, &selection);
            self.mode = CellMode::Normal;
            self.visual_anchor = None;
            self.update_editing_value()
        } else {
            Ok(None)
        }
    }

    fn uppercase_selection(&mut self) -> Result<Option<Action>> {
        if let Some((start, end)) = self.get_visual_selection() {
            let selection = self.text[start..=end].to_uppercase();
            self.text.replace_range(start..=end, &selection);
            self.mode = CellMode::Normal;
            self.visual_anchor = None;
            self.update_editing_value()
        } else {
            Ok(None)
        }
    }

    // Yank operations
    fn yank_line(&mut self) -> Result<Option<Action>> {
        self.registers.insert('0', self.text.clone());
        self.registers.insert('"', self.text.clone());
        Ok(None)
    }

    fn yank_to_end(&mut self) -> Result<Option<Action>> {
        let yanked = self.text[self.cursor_position..].to_string();
        self.registers.insert('0', yanked.clone());
        self.registers.insert('"', yanked);
        Ok(None)
    }

    fn yank_word(&mut self) -> Result<Option<Action>> {
        let end = self.find_next_word_start(self.cursor_position);
        let yanked = self.text[self.cursor_position..end].to_string();
        self.registers.insert('0', yanked.clone());
        self.registers.insert('"', yanked);
        Ok(None)
    }

    // Paste operations
    fn paste_after(&mut self) -> Result<Option<Action>> {
        if let Some(content) = self.registers.get(&'"') {
            let pos = (self.cursor_position + 1).min(self.text.len());
            self.text.insert_str(pos, content);
            self.cursor_position = pos + content.len() - 1;
            self.update_editing_value()
        } else {
            Ok(None)
        }
    }

    fn paste_before(&mut self) -> Result<Option<Action>> {
        if let Some(content) = self.registers.get(&'"') {
            self.text.insert_str(self.cursor_position, content);
            self.cursor_position += content.len() - 1;
            self.update_editing_value()
        } else {
            Ok(None)
        }
    }

    // Undo operation
    fn undo(&mut self) -> Result<Option<Action>> {
        // TODO: Implement undo stack
        Ok(None)
    }

    // Helper methods
    fn update_editing_value(&self) -> Result<Option<Action>> {
        Ok(Some(Action::UpdateEditingValue {
            value: self.text.clone(),
            cursor_position: self.cursor_position,
        }))
    }

    fn update_visual_selection(&self) -> Result<Option<Action>> {
        // Update visual selection display
        Ok(None) // TODO: Create appropriate action
    }

    fn find_next_word_start(&self, from: usize) -> usize {
        let chars: Vec<char> = self.text.chars().collect();
        let mut pos = from;

        // Skip current word
        while pos < chars.len() && !chars[pos].is_whitespace() {
            pos += 1;
        }

        // Skip whitespace
        while pos < chars.len() && chars[pos].is_whitespace() {
            pos += 1;
        }

        pos
    }

    fn find_prev_word_start(&self, from: usize) -> usize {
        let chars: Vec<char> = self.text.chars().collect();
        let mut pos = from.saturating_sub(1);

        // Skip whitespace
        while pos > 0 && chars[pos].is_whitespace() {
            pos -= 1;
        }

        // Find word start
        while pos > 0 && !chars[pos - 1].is_whitespace() {
            pos -= 1;
        }

        pos
    }

    fn find_word_end(&self, from: usize) -> usize {
        let chars: Vec<char> = self.text.chars().collect();
        let mut pos = from;

        // Move to next character if at word end
        if pos < chars.len() - 1 && !chars[pos + 1].is_whitespace() {
            pos += 1;
        }

        // Find word end
        while pos < chars.len() - 1 && !chars[pos + 1].is_whitespace() {
            pos += 1;
        }

        pos
    }

    fn find_next_big_word_start(&self, from: usize) -> usize {
        let chars: Vec<char> = self.text.chars().collect();
        let mut pos = from;

        // Skip current WORD (non-whitespace)
        while pos < chars.len() && !chars[pos].is_whitespace() {
            pos += 1;
        }

        // Skip whitespace
        while pos < chars.len() && chars[pos].is_whitespace() {
            pos += 1;
        }

        pos
    }

    fn find_prev_big_word_start(&self, from: usize) -> usize {
        let chars: Vec<char> = self.text.chars().collect();
        let mut pos = from.saturating_sub(1);

        // Skip whitespace
        while pos > 0 && chars[pos].is_whitespace() {
            pos -= 1;
        }

        // Find WORD start
        while pos > 0 && !chars[pos - 1].is_whitespace() {
            pos -= 1;
        }

        pos
    }

    fn find_big_word_end(&self, from: usize) -> usize {
        let chars: Vec<char> = self.text.chars().collect();
        let mut pos = from;

        // Move to next character if at WORD end
        if pos < chars.len() - 1 && !chars[pos + 1].is_whitespace() {
            pos += 1;
        }

        // Find WORD end
        while pos < chars.len() - 1 && !chars[pos + 1].is_whitespace() {
            pos += 1;
        }

        pos
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_cell_vim(text: &str) -> CellVimBehavior {
        CellVimBehavior::new(text.to_string())
    }

    #[test]
    fn test_initial_state() {
        let vim = create_cell_vim("test content");
        assert_eq!(vim.get_mode(), CellMode::Normal);
        assert_eq!(vim.get_text(), "test content");
        assert_eq!(vim.get_cursor_position(), 0);
        assert_eq!(vim.get_visual_selection(), None);
    }

    // Normal mode navigation tests
    #[test]
    fn test_normal_mode_h_moves_left() {
        let mut vim = create_cell_vim("hello world");
        vim.cursor_position = 5;

        let action = vim.process_key("h").unwrap();
        assert_eq!(vim.get_cursor_position(), 4);
        assert!(matches!(action, Some(Action::UpdateEditingValue { .. })));
    }

    #[test]
    fn test_normal_mode_l_moves_right() {
        let mut vim = create_cell_vim("hello world");

        let action = vim.process_key("l").unwrap();
        assert_eq!(vim.get_cursor_position(), 1);
        assert!(matches!(action, Some(Action::UpdateEditingValue { .. })));
    }

    #[test]
    fn test_normal_mode_0_moves_to_start() {
        let mut vim = create_cell_vim("hello world");
        vim.cursor_position = 5;

        let action = vim.process_key("0").unwrap();
        assert_eq!(vim.get_cursor_position(), 0);
        assert!(matches!(action, Some(Action::UpdateEditingValue { .. })));
    }

    #[test]
    fn test_normal_mode_dollar_moves_to_end() {
        let mut vim = create_cell_vim("hello world");

        let action = vim.process_key("$").unwrap();
        assert_eq!(vim.get_cursor_position(), 11);
        assert!(matches!(action, Some(Action::UpdateEditingValue { .. })));
    }

    #[test]
    fn test_normal_mode_w_moves_word_forward() {
        let mut vim = create_cell_vim("hello world test");

        vim.process_key("w").unwrap();
        assert_eq!(vim.get_cursor_position(), 6); // Start of "world"

        vim.process_key("w").unwrap();
        assert_eq!(vim.get_cursor_position(), 12); // Start of "test"
    }

    #[test]
    fn test_normal_mode_b_moves_word_backward() {
        let mut vim = create_cell_vim("hello world test");
        vim.cursor_position = 12;

        vim.process_key("b").unwrap();
        assert_eq!(vim.get_cursor_position(), 6); // Start of "world"

        vim.process_key("b").unwrap();
        assert_eq!(vim.get_cursor_position(), 0); // Start of "hello"
    }

    #[test]
    fn test_normal_mode_e_moves_to_word_end() {
        let mut vim = create_cell_vim("hello world test");

        vim.process_key("e").unwrap();
        // The implementation moves to next char if at word end initially (pos 0 -> 1)
        // then finds end of word, which is position 4 for "hello"
        assert_eq!(vim.get_cursor_position(), 4); // End of "hello"
    }

    // Insert mode transition tests
    #[test]
    fn test_i_enters_insert_mode_before_cursor() {
        let mut vim = create_cell_vim("hello");
        vim.cursor_position = 2;

        let action = vim.process_key("i").unwrap();
        assert_eq!(vim.get_mode(), CellMode::Insert);
        assert_eq!(vim.get_cursor_position(), 2);
        assert!(matches!(
            action,
            Some(Action::EnterInsertMode {
                mode: Some(InsertMode::I)
            })
        ));
    }

    #[test]
    fn test_a_enters_insert_mode_after_cursor() {
        let mut vim = create_cell_vim("hello");
        vim.cursor_position = 2;

        let action = vim.process_key("a").unwrap();
        assert_eq!(vim.get_mode(), CellMode::Insert);
        assert_eq!(vim.get_cursor_position(), 3);
        assert!(matches!(
            action,
            Some(Action::EnterInsertMode {
                mode: Some(InsertMode::A)
            })
        ));
    }

    #[test]
    fn test_capital_i_enters_insert_mode_at_line_start() {
        let mut vim = create_cell_vim("hello world");
        vim.cursor_position = 5;

        let action = vim.process_key("I").unwrap();
        assert_eq!(vim.get_mode(), CellMode::Insert);
        assert_eq!(vim.get_cursor_position(), 0);
        assert!(matches!(
            action,
            Some(Action::EnterInsertMode {
                mode: Some(InsertMode::CapitalI)
            })
        ));
    }

    #[test]
    fn test_capital_a_enters_insert_mode_at_line_end() {
        let mut vim = create_cell_vim("hello");
        vim.cursor_position = 2;

        let action = vim.process_key("A").unwrap();
        assert_eq!(vim.get_mode(), CellMode::Insert);
        assert_eq!(vim.get_cursor_position(), 5);
        assert!(matches!(
            action,
            Some(Action::EnterInsertMode {
                mode: Some(InsertMode::CapitalA)
            })
        ));
    }

    #[test]
    fn test_o_opens_line_below() {
        let mut vim = create_cell_vim("hello");

        let action = vim.process_key("o").unwrap();
        assert_eq!(vim.get_mode(), CellMode::Insert);
        assert_eq!(vim.get_text(), "hello\n");
        // Cursor position is set to text.len() before adding '\n', so it's position 5
        // But after appending '\n', cursor stays at position 5 (which is where newline starts)
        assert_eq!(vim.get_cursor_position(), 5);
        assert!(matches!(
            action,
            Some(Action::EnterInsertMode {
                mode: Some(InsertMode::O)
            })
        ));
    }

    #[test]
    fn test_capital_o_opens_line_above() {
        let mut vim = create_cell_vim("hello");

        let action = vim.process_key("O").unwrap();
        assert_eq!(vim.get_mode(), CellMode::Insert);
        assert_eq!(vim.get_text(), "\nhello");
        assert_eq!(vim.get_cursor_position(), 0);
        assert!(matches!(
            action,
            Some(Action::EnterInsertMode {
                mode: Some(InsertMode::CapitalO)
            })
        ));
    }

    // Visual mode tests
    #[test]
    fn test_v_enters_visual_mode() {
        let mut vim = create_cell_vim("hello world");
        vim.cursor_position = 5;

        let action = vim.process_key("v").unwrap();
        assert_eq!(vim.get_mode(), CellMode::Visual);
        assert_eq!(vim.visual_anchor, Some(5));
        assert!(matches!(
            action,
            Some(Action::EnterVisualMode {
                visual_type: VisualMode::Character,
                ..
            })
        ));
    }

    #[test]
    fn test_visual_mode_h_extends_selection_left() {
        let mut vim = create_cell_vim("hello world");
        vim.cursor_position = 5;
        vim.process_key("v").unwrap();

        vim.process_key("h").unwrap();
        assert_eq!(vim.get_cursor_position(), 4);
        assert_eq!(vim.get_visual_selection(), Some((4, 5)));
    }

    #[test]
    fn test_visual_mode_l_extends_selection_right() {
        let mut vim = create_cell_vim("hello world");
        vim.cursor_position = 5;
        vim.process_key("v").unwrap();

        vim.process_key("l").unwrap();
        assert_eq!(vim.get_cursor_position(), 6);
        assert_eq!(vim.get_visual_selection(), Some((5, 6)));
    }

    #[test]
    fn test_visual_mode_escape_exits() {
        let mut vim = create_cell_vim("hello world");
        vim.process_key("v").unwrap();

        let action = vim.process_key("Escape").unwrap();
        assert_eq!(vim.get_mode(), CellMode::Normal);
        assert_eq!(vim.visual_anchor, None);
        assert!(matches!(action, Some(Action::ExitVisualMode)));
    }

    #[test]
    fn test_visual_mode_d_deletes_selection() {
        let mut vim = create_cell_vim("hello world");
        vim.cursor_position = 0;
        vim.process_key("v").unwrap();
        vim.process_key("l").unwrap();
        vim.process_key("l").unwrap();
        vim.process_key("l").unwrap();
        vim.process_key("l").unwrap(); // Select "hello"

        vim.process_key("d").unwrap();
        assert_eq!(vim.get_text(), " world");
        assert_eq!(vim.get_mode(), CellMode::Normal);
        assert_eq!(vim.get_cursor_position(), 0);
    }

    #[test]
    fn test_visual_mode_c_changes_selection() {
        let mut vim = create_cell_vim("hello world");
        vim.cursor_position = 0;
        vim.process_key("v").unwrap();
        vim.process_key("l").unwrap();
        vim.process_key("l").unwrap();
        vim.process_key("l").unwrap();
        vim.process_key("l").unwrap(); // Select "hello"

        let action = vim.process_key("c").unwrap();
        assert_eq!(vim.get_text(), " world");
        assert_eq!(vim.get_mode(), CellMode::Insert);
        assert_eq!(vim.get_cursor_position(), 0);
        assert!(matches!(action, Some(Action::EnterInsertMode { .. })));
    }

    #[test]
    fn test_visual_mode_y_yanks_selection() {
        let mut vim = create_cell_vim("hello world");
        vim.cursor_position = 0;
        vim.process_key("v").unwrap();
        vim.process_key("l").unwrap();
        vim.process_key("l").unwrap();
        vim.process_key("l").unwrap();
        vim.process_key("l").unwrap(); // Select "hello"

        let action = vim.process_key("y").unwrap();
        assert_eq!(vim.get_text(), "hello world"); // Text unchanged
        assert_eq!(vim.get_mode(), CellMode::Normal);
        assert_eq!(vim.registers.get(&'"'), Some(&"hello".to_string()));
        assert!(matches!(action, Some(Action::ExitVisualMode)));
    }

    // Delete operations tests
    #[test]
    fn test_x_deletes_char() {
        let mut vim = create_cell_vim("hello");
        vim.cursor_position = 1;

        vim.process_key("x").unwrap();
        assert_eq!(vim.get_text(), "hllo");
        assert_eq!(vim.get_cursor_position(), 1);
    }

    #[test]
    fn test_capital_x_deletes_char_before() {
        let mut vim = create_cell_vim("hello");
        vim.cursor_position = 2;

        vim.process_key("X").unwrap();
        assert_eq!(vim.get_text(), "hllo");
        assert_eq!(vim.get_cursor_position(), 1);
    }

    #[test]
    fn test_dd_deletes_line() {
        let mut vim = create_cell_vim("hello world");
        vim.cursor_position = 5;

        vim.process_key("dd").unwrap();
        assert_eq!(vim.get_text(), "");
        assert_eq!(vim.get_cursor_position(), 0);
    }

    #[test]
    fn test_capital_d_deletes_to_end() {
        let mut vim = create_cell_vim("hello world");
        vim.cursor_position = 5;

        vim.process_key("D").unwrap();
        assert_eq!(vim.get_text(), "hello");
        assert_eq!(vim.get_cursor_position(), 5);
    }

    #[test]
    fn test_dw_deletes_word() {
        let mut vim = create_cell_vim("hello world test");
        vim.cursor_position = 0;

        vim.process_key("dw").unwrap();
        assert_eq!(vim.get_text(), "world test");
        assert_eq!(vim.get_cursor_position(), 0);
    }

    // Change operations tests
    #[test]
    fn test_cc_changes_line() {
        let mut vim = create_cell_vim("hello world");

        let action = vim.process_key("cc").unwrap();
        assert_eq!(vim.get_text(), "");
        assert_eq!(vim.get_mode(), CellMode::Insert);
        assert!(matches!(action, Some(Action::EnterInsertMode { .. })));
    }

    #[test]
    fn test_capital_c_changes_to_end() {
        let mut vim = create_cell_vim("hello world");
        vim.cursor_position = 5;

        let action = vim.process_key("C").unwrap();
        assert_eq!(vim.get_text(), "hello");
        assert_eq!(vim.get_mode(), CellMode::Insert);
        assert_eq!(vim.get_cursor_position(), 5);
        assert!(matches!(action, Some(Action::EnterInsertMode { .. })));
    }

    #[test]
    fn test_cw_changes_word() {
        let mut vim = create_cell_vim("hello world");
        vim.cursor_position = 0;

        let action = vim.process_key("cw").unwrap();
        assert_eq!(vim.get_text(), "world");
        assert_eq!(vim.get_mode(), CellMode::Insert);
        assert_eq!(vim.get_cursor_position(), 0);
        assert!(matches!(action, Some(Action::EnterInsertMode { .. })));
    }

    #[test]
    fn test_s_substitutes_char() {
        let mut vim = create_cell_vim("hello");
        vim.cursor_position = 1;

        let action = vim.process_key("s").unwrap();
        assert_eq!(vim.get_text(), "hllo");
        assert_eq!(vim.get_mode(), CellMode::Insert);
        assert_eq!(vim.get_cursor_position(), 1);
        assert!(matches!(action, Some(Action::EnterInsertMode { .. })));
    }

    // Insert mode tests
    #[test]
    fn test_insert_mode_typing() {
        let mut vim = create_cell_vim("hello");
        vim.process_key("i").unwrap();

        vim.process_key("X").unwrap();
        assert_eq!(vim.get_text(), "Xhello");
        assert_eq!(vim.get_cursor_position(), 1);
    }

    #[test]
    fn test_insert_mode_backspace() {
        let mut vim = create_cell_vim("hello");
        vim.cursor_position = 3;
        vim.mode = CellMode::Insert;

        vim.process_key("Backspace").unwrap();
        assert_eq!(vim.get_text(), "helo");
        assert_eq!(vim.get_cursor_position(), 2);
    }

    #[test]
    fn test_insert_mode_delete() {
        let mut vim = create_cell_vim("hello");
        vim.cursor_position = 1;
        vim.mode = CellMode::Insert;

        vim.process_key("Delete").unwrap();
        assert_eq!(vim.get_text(), "hllo");
        assert_eq!(vim.get_cursor_position(), 1);
    }

    #[test]
    fn test_insert_mode_escape_returns_to_normal() {
        let mut vim = create_cell_vim("hello");
        vim.process_key("i").unwrap();

        let action = vim.process_key("Escape").unwrap();
        assert_eq!(vim.get_mode(), CellMode::Normal);
        assert!(matches!(action, Some(Action::ExitInsertMode)));
    }

    // Yank and paste tests
    #[test]
    fn test_yy_yanks_line() {
        let mut vim = create_cell_vim("hello world");

        vim.process_key("yy").unwrap();
        assert_eq!(vim.registers.get(&'"'), Some(&"hello world".to_string()));
        assert_eq!(vim.get_text(), "hello world"); // Text unchanged
    }

    #[test]
    fn test_yw_yanks_word() {
        let mut vim = create_cell_vim("hello world");

        vim.process_key("yw").unwrap();
        assert_eq!(vim.registers.get(&'"'), Some(&"hello ".to_string()));
        assert_eq!(vim.get_text(), "hello world"); // Text unchanged
    }

    #[test]
    fn test_p_pastes_after() {
        let mut vim = create_cell_vim("hello");
        vim.registers.insert('"', " world".to_string());
        vim.cursor_position = 4;

        vim.process_key("p").unwrap();
        assert_eq!(vim.get_text(), "hello world");
    }

    #[test]
    fn test_capital_p_pastes_before() {
        let mut vim = create_cell_vim("world");
        vim.registers.insert('"', "hello ".to_string());
        vim.cursor_position = 0;

        vim.process_key("P").unwrap();
        assert_eq!(vim.get_text(), "hello world");
    }

    // Visual mode case operations
    #[test]
    fn test_visual_mode_tilde_toggles_case() {
        let mut vim = create_cell_vim("Hello");
        vim.process_key("v").unwrap();
        vim.process_key("l").unwrap();
        vim.process_key("l").unwrap();

        vim.process_key("~").unwrap();
        assert_eq!(vim.get_text(), "hELlo");
        assert_eq!(vim.get_mode(), CellMode::Normal);
    }

    #[test]
    fn test_visual_mode_u_lowercases() {
        let mut vim = create_cell_vim("HELLO");
        vim.process_key("v").unwrap();
        vim.process_key("l").unwrap();
        vim.process_key("l").unwrap();

        vim.process_key("u").unwrap();
        assert_eq!(vim.get_text(), "helLO");
        assert_eq!(vim.get_mode(), CellMode::Normal);
    }

    #[test]
    fn test_visual_mode_capital_u_uppercases() {
        let mut vim = create_cell_vim("hello");
        vim.process_key("v").unwrap();
        vim.process_key("l").unwrap();
        vim.process_key("l").unwrap();

        vim.process_key("U").unwrap();
        assert_eq!(vim.get_text(), "HELlo");
        assert_eq!(vim.get_mode(), CellMode::Normal);
    }

    // Edge cases
    #[test]
    fn test_movement_at_boundaries() {
        let mut vim = create_cell_vim("hi");

        // Can't move left from start
        vim.process_key("h").unwrap();
        assert_eq!(vim.get_cursor_position(), 0);

        // Can't move right past end
        vim.cursor_position = 2;
        vim.process_key("l").unwrap();
        assert_eq!(vim.get_cursor_position(), 2);
    }

    #[test]
    fn test_delete_at_boundaries() {
        let mut vim = create_cell_vim("x");

        // Delete only char
        vim.process_key("x").unwrap();
        assert_eq!(vim.get_text(), "");

        // Can't delete from empty
        vim.process_key("x").unwrap();
        assert_eq!(vim.get_text(), "");
    }

    #[test]
    fn test_escape_exits_to_navigation() {
        let mut vim = create_cell_vim("hello");

        let action = vim.process_key("Escape").unwrap();
        assert!(matches!(action, Some(Action::ExitToNavigation)));
    }
}
