use crate::state::{Action, UIState};
use gridcore_core::{types::CellAddress, Result};
use std::collections::HashMap;

/// Represents the current Vim mode
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VimMode {
    Normal,
    Insert,
    Visual,
    VisualLine,
    VisualBlock,
    Command,
    Replace,
    OperatorPending,
}

/// Represents a Vim motion (movement command)
#[derive(Debug, Clone, PartialEq)]
pub enum Motion {
    // Character motions
    Left(usize),
    Right(usize),
    Up(usize),
    Down(usize),

    // Word motions
    WordForward(usize),
    WordBackward(usize),
    WordEnd(usize),
    BigWordForward(usize),
    BigWordBackward(usize),
    BigWordEnd(usize),

    // Line motions
    LineStart,
    LineEnd,
    FirstNonBlank,

    // Document motions
    DocumentStart,
    DocumentEnd,
    GotoLine(u32),

    // Search motions
    FindChar(char, bool), // char, forward?
    FindCharBefore(char, bool),
    RepeatFind,
    RepeatFindReverse,

    // Paragraph/section motions
    ParagraphForward(usize),
    ParagraphBackward(usize),
    SectionForward(usize),
    SectionBackward(usize),
}

/// Represents a Vim operator
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Operator {
    Delete,
    Change,
    Yank,
    Indent,
    Outdent,
    Format,
    LowerCase,
    UpperCase,
    ToggleCase,
}

/// Represents a Vim text object
#[derive(Debug, Clone, PartialEq)]
pub enum TextObject {
    Word,
    BigWord,
    Sentence,
    Paragraph,
    Block(char, char), // opening, closing delimiters
    Quote(char),
    Tag,
}

/// Represents a complete Vim command
#[derive(Debug, Clone)]
pub struct VimCommand {
    pub count: Option<usize>,
    pub operator: Option<Operator>,
    pub motion: Option<Motion>,
    pub text_object: Option<TextObject>,
    pub register: Option<char>,
}

/// Vim state machine for handling Vim commands
pub struct VimBehavior {
    mode: VimMode,
    command_buffer: String,
    current_command: VimCommand,
    repeat_command: Option<VimCommand>,
    registers: HashMap<char, String>,
    marks: HashMap<char, CellAddress>,
    last_find_char: Option<(char, bool)>, // char, forward?
    visual_anchor: Option<CellAddress>,
    count_buffer: String,
    _settings: HashMap<String, String>,
}

impl VimBehavior {
    pub fn new() -> Self {
        Self {
            mode: VimMode::Normal,
            command_buffer: String::new(),
            current_command: VimCommand::new(),
            repeat_command: None,
            registers: HashMap::new(),
            marks: HashMap::new(),
            last_find_char: None,
            visual_anchor: None,
            count_buffer: String::new(),
            _settings: HashMap::new(),
        }
    }

    pub fn get_mode(&self) -> VimMode {
        self.mode
    }

    pub fn set_mode(&mut self, mode: VimMode) {
        self.mode = mode;
        // Clear command buffer when changing modes
        if mode == VimMode::Normal {
            self.command_buffer.clear();
            self.current_command = VimCommand::new();
            self.count_buffer.clear();
        }
    }

    /// Process a key press and return the resulting action if any
    pub fn process_key(&mut self, key: &str, current_state: &UIState) -> Result<Option<Action>> {
        match self.mode {
            VimMode::Normal => self.process_normal_key(key, current_state),
            VimMode::Insert => self.process_insert_key(key),
            VimMode::Visual | VimMode::VisualLine | VimMode::VisualBlock => {
                self.process_visual_key(key, current_state)
            }
            VimMode::Command => self.process_command_key(key),
            VimMode::Replace => self.process_replace_key(key),
            VimMode::OperatorPending => self.process_operator_pending_key(key, current_state),
        }
    }

    fn process_normal_key(&mut self, key: &str, current_state: &UIState) -> Result<Option<Action>> {
        // Handle count prefix
        if key.len() == 1 && key.chars().next().unwrap_or('\0').is_ascii_digit() && key != "0" {
            self.count_buffer.push_str(key);
            return Ok(None);
        }

        // Parse count if present
        let count = if !self.count_buffer.is_empty() {
            self.count_buffer.parse::<usize>().ok()
        } else {
            None
        };
        self.current_command.count = count;
        self.count_buffer.clear();

        // Process the actual command
        match key {
            // Mode changes
            "i" => Ok(Some(Action::EnterInsertMode {
                mode: Some(crate::state::InsertMode::I),
            })),
            "a" => Ok(Some(Action::EnterInsertMode {
                mode: Some(crate::state::InsertMode::A),
            })),
            "I" => Ok(Some(Action::EnterInsertMode {
                mode: Some(crate::state::InsertMode::CapitalI),
            })),
            "A" => Ok(Some(Action::EnterInsertMode {
                mode: Some(crate::state::InsertMode::CapitalA),
            })),
            "o" => Ok(Some(Action::EnterInsertMode {
                mode: Some(crate::state::InsertMode::O),
            })),
            "O" => Ok(Some(Action::EnterInsertMode {
                mode: Some(crate::state::InsertMode::CapitalO),
            })),

            // Visual mode
            "v" => {
                self.mode = VimMode::Visual;
                self.visual_anchor = Some(*current_state.cursor());
                Ok(Some(Action::EnterSpreadsheetVisualMode {
                    visual_mode: crate::state::SpreadsheetVisualMode::Char,
                    selection: crate::state::Selection {
                        selection_type: crate::state::SelectionType::Cell {
                            address: *current_state.cursor(),
                        },
                        anchor: Some(*current_state.cursor()),
                    },
                }))
            }
            "V" => {
                self.mode = VimMode::VisualLine;
                self.visual_anchor = Some(*current_state.cursor());
                Ok(Some(Action::EnterSpreadsheetVisualMode {
                    visual_mode: crate::state::SpreadsheetVisualMode::Line,
                    selection: crate::state::Selection {
                        selection_type: crate::state::SelectionType::Row {
                            rows: vec![current_state.cursor().row],
                        },
                        anchor: Some(*current_state.cursor()),
                    },
                }))
            }

            // Command mode
            ":" => {
                self.mode = VimMode::Command;
                Ok(Some(Action::EnterCommandMode))
            }

            // Movement
            "h" | "ArrowLeft" => {
                self.create_movement_action(Motion::Left(count.unwrap_or(1)), current_state)
            }
            "j" | "ArrowDown" => {
                self.create_movement_action(Motion::Down(count.unwrap_or(1)), current_state)
            }
            "k" | "ArrowUp" => {
                self.create_movement_action(Motion::Up(count.unwrap_or(1)), current_state)
            }
            "l" | "ArrowRight" => {
                self.create_movement_action(Motion::Right(count.unwrap_or(1)), current_state)
            }

            "0" => self.create_movement_action(Motion::LineStart, current_state),
            "$" => self.create_movement_action(Motion::LineEnd, current_state),
            "^" => self.create_movement_action(Motion::FirstNonBlank, current_state),

            "w" => {
                self.create_movement_action(Motion::WordForward(count.unwrap_or(1)), current_state)
            }
            "b" => {
                self.create_movement_action(Motion::WordBackward(count.unwrap_or(1)), current_state)
            }
            "e" => self.create_movement_action(Motion::WordEnd(count.unwrap_or(1)), current_state),
            "W" => self
                .create_movement_action(Motion::BigWordForward(count.unwrap_or(1)), current_state),
            "B" => self
                .create_movement_action(Motion::BigWordBackward(count.unwrap_or(1)), current_state),
            "E" => {
                self.create_movement_action(Motion::BigWordEnd(count.unwrap_or(1)), current_state)
            }

            "g" => {
                self.command_buffer = "g".to_string();
                Ok(None)
            }
            "G" => {
                if let Some(line) = count {
                    self.create_movement_action(Motion::GotoLine(line as u32), current_state)
                } else {
                    self.create_movement_action(Motion::DocumentEnd, current_state)
                }
            }

            // Operators
            "d" => {
                self.mode = VimMode::OperatorPending;
                self.current_command.operator = Some(Operator::Delete);
                Ok(None)
            }
            "c" => {
                self.mode = VimMode::OperatorPending;
                self.current_command.operator = Some(Operator::Change);
                Ok(None)
            }
            "y" => {
                self.mode = VimMode::OperatorPending;
                self.current_command.operator = Some(Operator::Yank);
                Ok(None)
            }

            // Delete/change shortcuts
            "x" => Ok(Some(Action::StartDelete {
                targets: vec![current_state.cursor().col],
                delete_type: crate::state::DeleteType::Column,
            })),

            // Undo/redo
            "u" => Ok(Some(Action::ExitToNavigation)), // Placeholder for undo

            "Escape" => Ok(Some(Action::Escape)),

            _ => {
                // Check for multi-char commands
                if self.command_buffer == "g" {
                    self.command_buffer.clear();
                    match key {
                        "g" => self.create_movement_action(Motion::DocumentStart, current_state),
                        _ => Ok(None),
                    }
                } else {
                    Ok(None)
                }
            }
        }
    }

    fn process_insert_key(&mut self, key: &str) -> Result<Option<Action>> {
        match key {
            "Escape" => {
                self.mode = VimMode::Normal;
                Ok(Some(Action::ExitInsertMode))
            }
            _ => Ok(None), // Let the cell handle the actual typing
        }
    }

    fn process_visual_key(&mut self, key: &str, current_state: &UIState) -> Result<Option<Action>> {
        match key {
            "Escape" => {
                self.mode = VimMode::Normal;
                self.visual_anchor = None;
                Ok(Some(Action::ExitSpreadsheetVisualMode))
            }

            // Movement extends selection
            "h" | "j" | "k" | "l" | "w" | "b" | "e" | "0" | "$" => {
                // Process movement and update selection
                self.process_normal_key(key, current_state)
            }

            // Operators on selection
            "d" => {
                self.mode = VimMode::Normal;
                self.visual_anchor = None;
                Ok(Some(Action::StartDelete {
                    targets: self.get_selected_indices(current_state),
                    delete_type: crate::state::DeleteType::Row,
                }))
            }
            "y" => {
                // Yank selection
                self.mode = VimMode::Normal;
                self.visual_anchor = None;
                Ok(Some(Action::ExitSpreadsheetVisualMode))
            }
            "c" => {
                // Change selection
                self.mode = VimMode::Insert;
                self.visual_anchor = None;
                Ok(Some(Action::EnterInsertMode { mode: None }))
            }

            _ => Ok(None),
        }
    }

    fn process_command_key(&mut self, key: &str) -> Result<Option<Action>> {
        match key {
            "Escape" => {
                self.mode = VimMode::Normal;
                self.command_buffer.clear();
                Ok(Some(Action::ExitCommandMode))
            }
            "Enter" | "Return" => {
                // Execute command
                let result = self.execute_command(&self.command_buffer);
                self.mode = VimMode::Normal;
                self.command_buffer.clear();
                result
            }
            "Backspace" => {
                self.command_buffer.pop();
                Ok(Some(Action::UpdateCommandValue {
                    value: format!(":{}", self.command_buffer),
                }))
            }
            _ => {
                self.command_buffer.push_str(key);
                Ok(Some(Action::UpdateCommandValue {
                    value: format!(":{}", self.command_buffer),
                }))
            }
        }
    }

    fn process_replace_key(&mut self, _key: &str) -> Result<Option<Action>> {
        // TODO: Implement replace mode
        Ok(None)
    }

    fn process_operator_pending_key(
        &mut self,
        key: &str,
        current_state: &UIState,
    ) -> Result<Option<Action>> {
        // Handle motion after operator
        let motion = match key {
            "h" => Some(Motion::Left(self.current_command.count.unwrap_or(1))),
            "j" => Some(Motion::Down(self.current_command.count.unwrap_or(1))),
            "k" => Some(Motion::Up(self.current_command.count.unwrap_or(1))),
            "l" => Some(Motion::Right(self.current_command.count.unwrap_or(1))),
            "w" => Some(Motion::WordForward(self.current_command.count.unwrap_or(1))),
            "b" => Some(Motion::WordBackward(
                self.current_command.count.unwrap_or(1),
            )),
            "e" => Some(Motion::WordEnd(self.current_command.count.unwrap_or(1))),
            "$" => Some(Motion::LineEnd),
            "0" => Some(Motion::LineStart),
            _ => None,
        };

        if let Some(motion) = motion {
            self.current_command.motion = Some(motion);
            self.mode = VimMode::Normal;
            self.execute_operator_motion(current_state)
        } else {
            self.mode = VimMode::Normal;
            Ok(None)
        }
    }

    fn create_movement_action(
        &self,
        motion: Motion,
        current_state: &UIState,
    ) -> Result<Option<Action>> {
        let new_cursor = self.calculate_new_position(motion, current_state)?;
        Ok(Some(Action::UpdateCursor { cursor: new_cursor }))
    }

    fn calculate_new_position(
        &self,
        motion: Motion,
        current_state: &UIState,
    ) -> Result<CellAddress> {
        let current = current_state.cursor();

        match motion {
            Motion::Left(n) => Ok(CellAddress::new(
                current.col.saturating_sub(n as u32),
                current.row,
            )),
            Motion::Right(n) => Ok(CellAddress::new(current.col + n as u32, current.row)),
            Motion::Up(n) => Ok(CellAddress::new(
                current.col,
                current.row.saturating_sub(n as u32),
            )),
            Motion::Down(n) => Ok(CellAddress::new(current.col, current.row + n as u32)),
            Motion::LineStart => Ok(CellAddress::new(0, current.row)),
            Motion::LineEnd => Ok(CellAddress::new(9999, current.row)), // Will be clamped by viewport
            Motion::DocumentStart => Ok(CellAddress::new(0, 0)),
            Motion::DocumentEnd => Ok(CellAddress::new(current.col, 9999)),
            Motion::GotoLine(line) => Ok(CellAddress::new(current.col, line.saturating_sub(1))),
            _ => Ok(*current), // TODO: Implement other motions
        }
    }

    fn execute_operator_motion(&mut self, current_state: &UIState) -> Result<Option<Action>> {
        match self.current_command.operator {
            Some(Operator::Delete) => {
                // Calculate affected range based on motion
                // For now, just delete current cell
                Ok(Some(Action::StartDelete {
                    targets: vec![current_state.cursor().col],
                    delete_type: crate::state::DeleteType::Column,
                }))
            }
            Some(Operator::Change) => {
                // Delete and enter insert mode
                Ok(Some(Action::EnterInsertMode { mode: None }))
            }
            Some(Operator::Yank) => {
                // Copy to register
                self.registers.insert('0', String::new()); // Placeholder
                Ok(None)
            }
            _ => Ok(None),
        }
    }

    fn execute_command(&self, command: &str) -> Result<Option<Action>> {
        let parts: Vec<&str> = command.split_whitespace().collect();
        if parts.is_empty() {
            return Ok(None);
        }

        match parts[0] {
            "w" | "write" => Ok(None), // Placeholder for save
            "q" | "quit" => Ok(None),  // Placeholder for quit
            "wq" => Ok(None),          // Placeholder for save and quit
            _ => Ok(None),
        }
    }

    fn get_selected_indices(&self, _current_state: &UIState) -> Vec<u32> {
        // TODO: Calculate selected indices based on visual selection
        vec![]
    }

    pub fn set_register(&mut self, register: char, content: String) {
        self.registers.insert(register, content);
    }

    pub fn get_register(&self, register: char) -> Option<&String> {
        self.registers.get(&register)
    }

    pub fn set_mark(&mut self, mark: char, address: CellAddress) {
        self.marks.insert(mark, address);
    }

    pub fn get_mark(&self, mark: char) -> Option<&CellAddress> {
        self.marks.get(&mark)
    }
}

impl Default for VimCommand {
    fn default() -> Self {
        Self::new()
    }
}

impl VimCommand {
    pub fn new() -> Self {
        Self {
            count: None,
            operator: None,
            motion: None,
            text_object: None,
            register: None,
        }
    }
}

impl Default for VimBehavior {
    fn default() -> Self {
        Self::new()
    }
}

// Re-export submodules
pub mod cell_vim;
pub mod command;
pub mod motion;
pub mod normal;
pub mod operator;
pub mod visual;
