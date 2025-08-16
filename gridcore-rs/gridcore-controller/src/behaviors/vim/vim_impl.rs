//! Implementation of the VimBehavior trait
//! This module provides the concrete implementation of vim behavior using the new architecture

use super::vim_core::{
    Direction, ExCommand, InsertMode, Motion, Operator, OperatorTarget, VimBehavior, VimCommand,
    VimContext, VimMode, VimResult, VisualMode,
};
use super::vim_parser::VimParser;
use crate::state::{Action, Selection, SelectionType};
use gridcore_core::{types::CellAddress, Result};
use rustc_hash::FxHashMap;

/// Main implementation of vim behavior
pub struct VimBehaviorImpl {
    mode: VimMode,
    command_buffer: String,
    count_buffer: String,
    register_buffer: Option<char>,
    registers: FxHashMap<char, String>,
    marks: FxHashMap<char, CellAddress>,
    // last_find_char: Option<(char, bool)>,
    visual_anchor: Option<CellAddress>,
    last_command: Option<VimCommand>,
    // search_pattern: Option<String>,
    pending_operator: Option<Operator>,
    current_command: VimCommand,
}

impl VimBehaviorImpl {
    pub fn new() -> Self {
        Self {
            mode: VimMode::Normal,
            command_buffer: String::new(),
            count_buffer: String::new(),
            register_buffer: None,
            registers: FxHashMap::default(),
            marks: FxHashMap::default(),
            // last_find_char: None,
            visual_anchor: None,
            last_command: None,
            // search_pattern: None,
            pending_operator: None,
            current_command: VimCommand::default(),
        }
    }

    /// Set a register value
    pub fn set_register(&mut self, register: char, content: String) {
        self.registers.insert(register, content);
    }

    /// Get a register value
    pub fn get_register(&self, register: char) -> Option<&String> {
        self.registers.get(&register)
    }

    /// Set a mark
    pub fn set_mark(&mut self, mark: char, address: CellAddress) {
        self.marks.insert(mark, address);
    }

    /// Get a mark
    pub fn get_mark(&self, mark: char) -> Option<&CellAddress> {
        self.marks.get(&mark)
    }

    /// Process a normal mode key
    fn process_normal_key(&mut self, key: &str, context: &VimContext) -> Result<VimResult> {
        // Handle count prefix
        if key.len() == 1 && key.chars().next().unwrap_or('\0').is_ascii_digit() && key != "0" {
            self.count_buffer.push_str(key);
            return Ok(VimResult::Incomplete);
        }

        // Handle register specification
        if self.command_buffer == "\"" {
            if key.len() == 1 {
                let ch = key.chars().next().unwrap();
                if ch.is_ascii_alphanumeric() || ch == '_' || ch == '+' || ch == '*' {
                    self.register_buffer = Some(ch);
                    self.command_buffer.clear();
                    return Ok(VimResult::Incomplete);
                }
            }
            self.command_buffer.clear();
        }

        if key == "\"" {
            self.command_buffer = "\"".to_string();
            return Ok(VimResult::Incomplete);
        }

        // Handle mode change commands directly
        match key {
            "i" => {
                self.mode = VimMode::Insert(InsertMode::Insert);
                return Ok(VimResult::Action(Action::EnterInsertMode { mode: None }));
            }
            "a" => {
                self.mode = VimMode::Insert(InsertMode::Append);
                return Ok(VimResult::Action(Action::EnterInsertMode { mode: None }));
            }
            "I" => {
                self.mode = VimMode::Insert(InsertMode::InsertStart);
                return Ok(VimResult::Action(Action::EnterInsertMode { mode: None }));
            }
            "A" => {
                self.mode = VimMode::Insert(InsertMode::AppendEnd);
                return Ok(VimResult::Action(Action::EnterInsertMode { mode: None }));
            }
            "v" => {
                self.mode = VimMode::Visual(VisualMode::Character);
                self.visual_anchor = Some(context.cursor);
                return Ok(VimResult::Action(Action::EnterSpreadsheetVisualMode {
                    visual_mode: crate::state::VisualMode::Character,
                    selection: Selection {
                        selection_type: SelectionType::Cell {
                            address: context.cursor,
                        },
                        anchor: Some(context.cursor),
                    },
                }));
            }
            "V" => {
                self.mode = VimMode::Visual(VisualMode::Line);
                self.visual_anchor = Some(context.cursor);
                return Ok(VimResult::Action(Action::EnterSpreadsheetVisualMode {
                    visual_mode: crate::state::VisualMode::Line,
                    selection: Selection {
                        selection_type: SelectionType::Row {
                            rows: vec![context.cursor.row],
                        },
                        anchor: Some(context.cursor),
                    },
                }));
            }
            ":" => {
                self.mode = VimMode::Command;
                return Ok(VimResult::Action(Action::EnterCommandMode));
            }
            _ => {}
        }

        // Try to parse just the key first (without count)
        // Count will be applied separately
        #[cfg(test)]
        println!(
            "Parsing command: '{}' (count_buffer: '{}', key: '{}')",
            key, self.count_buffer, key
        );

        // Try to parse the command
        match VimParser::parse_command(key) {
            Ok(mut command) => {
                // Apply count from buffer if it was parsed from buffer
                if !self.count_buffer.is_empty() {
                    if let Ok(count) = self.count_buffer.parse::<usize>() {
                        command.count = Some(count);

                        // Apply count to motion
                        if let Some(OperatorTarget::Motion(ref mut motion)) = command.target {
                            #[cfg(test)]
                            println!("Applying count {} to motion {:?}", count, motion);
                            match motion {
                                Motion::Char(dir, _) => *motion = Motion::Char(*dir, count),
                                Motion::WordForward(_) => *motion = Motion::WordForward(count),
                                Motion::WordBackward(_) => *motion = Motion::WordBackward(count),
                                Motion::WordEnd(_) => *motion = Motion::WordEnd(count),
                                Motion::BigWordForward(_) => {
                                    *motion = Motion::BigWordForward(count)
                                }
                                Motion::BigWordBackward(_) => {
                                    *motion = Motion::BigWordBackward(count)
                                }
                                Motion::BigWordEnd(_) => *motion = Motion::BigWordEnd(count),
                                Motion::ParagraphForward(_) => {
                                    *motion = Motion::ParagraphForward(count)
                                }
                                Motion::ParagraphBackward(_) => {
                                    *motion = Motion::ParagraphBackward(count)
                                }
                                _ => {}
                            }
                            #[cfg(test)]
                            println!("Motion after applying count: {:?}", motion);
                        }
                    }
                }

                // Apply register if present
                if let Some(reg) = self.register_buffer {
                    command.register = Some(reg);
                }

                // Store in current command for operator use
                self.current_command = command.clone();

                // Clear buffers
                self.command_buffer.clear();
                self.count_buffer.clear();
                self.register_buffer = None;

                // Process the parsed command
                self.execute_command(command, context)
            }
            Err(_) => {
                // Store the command for potential multi-char commands
                self.command_buffer.push_str(key);

                // Try to parse multi-char command
                match VimParser::parse_command(&self.command_buffer) {
                    Ok(mut command) => {
                        // Apply count if present
                        if !self.count_buffer.is_empty() {
                            if let Ok(count) = self.count_buffer.parse::<usize>() {
                                command.count = Some(count);
                            }
                        }

                        // Apply register if present
                        if let Some(reg) = self.register_buffer {
                            command.register = Some(reg);
                        }

                        // Store in current command for operator use
                        self.current_command = command.clone();

                        // Clear buffers
                        self.command_buffer.clear();
                        self.count_buffer.clear();
                        self.register_buffer = None;

                        // Process the parsed command
                        self.execute_command(command, context)
                    }
                    Err(_) => {
                        // Command might be incomplete or invalid
                        if self.command_buffer.len() > 3 {
                            // Too long, probably invalid
                            self.command_buffer.clear();
                            self.count_buffer.clear();
                            self.register_buffer = None;
                            Ok(VimResult::None)
                        } else {
                            // Might be incomplete
                            Ok(VimResult::Incomplete)
                        }
                    }
                }
            }
        }
    }

    /// Execute a parsed command
    fn execute_command(&mut self, command: VimCommand, context: &VimContext) -> Result<VimResult> {
        // Store command for repeat
        if matches!(
            command.operator,
            Some(Operator::Delete) | Some(Operator::Change) | Some(Operator::Yank)
        ) {
            self.last_command = Some(command.clone());
        }

        match (command.operator, command.target) {
            // Pure motion commands
            (None, Some(OperatorTarget::Motion(motion))) => self.handle_motion(motion, context),

            // Operator without target - enter operator pending mode
            (Some(op), None) => {
                self.pending_operator = Some(op);
                self.mode = VimMode::OperatorPending(op);
                Ok(VimResult::Incomplete)
            }

            // Operator with target - execute the operation
            (Some(op), Some(target)) => self.handle_operator(op, target, context),

            _ => Ok(VimResult::None),
        }
    }

    /// Process an insert mode key
    fn process_insert_key(&mut self, key: &str) -> Result<VimResult> {
        match key {
            "Escape" => {
                self.mode = VimMode::Normal;
                Ok(VimResult::Action(Action::ExitInsertMode))
            }
            _ => Ok(VimResult::None), // Let the cell handle the actual typing
        }
    }

    /// Process a visual mode key
    fn process_visual_key(&mut self, key: &str, context: &VimContext) -> Result<VimResult> {
        match key {
            "Escape" => {
                self.mode = VimMode::Normal;
                self.visual_anchor = None;
                Ok(VimResult::Action(Action::ExitSpreadsheetVisualMode))
            }

            // Operators on selection
            "d" => {
                self.mode = VimMode::Normal;
                self.visual_anchor = None;
                // Calculate selection based on visual mode and anchor
                Ok(VimResult::Action(Action::StartDelete {
                    targets: vec![context.cursor.col], // Placeholder - should calculate actual selection
                    delete_type: crate::state::DeleteType::Row,
                }))
            }
            "y" => {
                self.mode = VimMode::Normal;
                self.visual_anchor = None;
                Ok(VimResult::Action(Action::ExitSpreadsheetVisualMode))
            }
            "c" => {
                self.mode = VimMode::Insert(InsertMode::Insert);
                self.visual_anchor = None;
                Ok(VimResult::Action(Action::EnterInsertMode { mode: None }))
            }

            // Movement extends selection
            _ => self.process_normal_key(key, context),
        }
    }

    /// Process a command mode key
    fn process_command_key(&mut self, key: &str) -> Result<VimResult> {
        match key {
            "Escape" => {
                self.mode = VimMode::Normal;
                self.command_buffer.clear();
                Ok(VimResult::Action(Action::ExitCommandMode))
            }
            "Enter" | "Return" => {
                // Parse and execute ex command
                match super::ex_parser::ExParser::parse_ex(&self.command_buffer) {
                    Ok(ex_command) => {
                        let result = self.execute_ex_command(ex_command);
                        self.mode = VimMode::Normal;
                        self.command_buffer.clear();
                        result
                    }
                    Err(_) => {
                        self.mode = VimMode::Normal;
                        self.command_buffer.clear();
                        Ok(VimResult::None)
                    }
                }
            }
            "Backspace" => {
                self.command_buffer.pop();
                Ok(VimResult::Action(Action::UpdateCommandValue {
                    value: format!(":{}", self.command_buffer),
                }))
            }
            _ => {
                self.command_buffer.push_str(key);
                Ok(VimResult::Action(Action::UpdateCommandValue {
                    value: format!(":{}", self.command_buffer),
                }))
            }
        }
    }

    /// Process an operator pending key
    fn process_operator_pending_key(
        &mut self,
        key: &str,
        context: &VimContext,
    ) -> Result<VimResult> {
        if let Some(op) = self.pending_operator {
            // Check for double operator (dd, yy, cc, etc.)
            let op_char = match op {
                Operator::Delete => "d",
                Operator::Change => "c",
                Operator::Yank => "y",
                Operator::Indent => ">",
                Operator::Outdent => "<",
                _ => "",
            };

            if key == op_char {
                // Double operator - operates on current line
                self.mode = VimMode::Normal;
                self.pending_operator = None;
                return self.handle_operator(op, OperatorTarget::CurrentLine, context);
            }
        }

        // Try to parse as a motion
        let result = self.process_normal_key(key, context)?;

        // If we got a motion, apply the pending operator to it
        if let Some(op) = self.pending_operator {
            if let VimResult::Action(Action::UpdateCursor { .. }) = result {
                // Convert cursor movement to operator target
                // This is simplified - should properly calculate the range
                self.mode = VimMode::Normal;
                self.pending_operator = None;
                return self.handle_operator(op, OperatorTarget::CurrentLine, context);
            }
        }

        Ok(result)
    }

    /// Calculate new position based on motion
    fn calculate_new_position(&self, motion: Motion, context: &VimContext) -> Result<CellAddress> {
        let current = context.cursor;

        match motion {
            Motion::Char(Direction::Left, n) => Ok(CellAddress::new(
                current.col.saturating_sub(n as u32),
                current.row,
            )),
            Motion::Char(Direction::Right, n) => {
                Ok(CellAddress::new(current.col + n as u32, current.row))
            }
            Motion::Char(Direction::Up, n) => Ok(CellAddress::new(
                current.col,
                current.row.saturating_sub(n as u32),
            )),
            Motion::Char(Direction::Down, n) => {
                Ok(CellAddress::new(current.col, current.row + n as u32))
            }
            Motion::LineStart => Ok(CellAddress::new(0, current.row)),
            Motion::LineEnd => Ok(CellAddress::new(9999, current.row)), // Will be clamped by viewport
            Motion::FirstNonBlank => Ok(CellAddress::new(0, current.row)), // Simplified
            Motion::DocumentStart => Ok(CellAddress::new(0, 0)),
            Motion::DocumentEnd => Ok(CellAddress::new(current.col, 9999)),
            Motion::GotoLine(line) => Ok(CellAddress::new(current.col, line.saturating_sub(1))),
            Motion::WordForward(n) => {
                // Simplified word motion - should properly calculate word boundaries
                Ok(CellAddress::new(current.col + n as u32, current.row))
            }
            Motion::WordBackward(n) => Ok(CellAddress::new(
                current.col.saturating_sub(n as u32),
                current.row,
            )),
            Motion::WordEnd(n) => Ok(CellAddress::new(current.col + n as u32, current.row)),
            Motion::BigWordForward(n) => {
                Ok(CellAddress::new(current.col + n as u32 * 2, current.row))
            }
            Motion::BigWordBackward(n) => Ok(CellAddress::new(
                current.col.saturating_sub(n as u32 * 2),
                current.row,
            )),
            Motion::BigWordEnd(n) => Ok(CellAddress::new(current.col + n as u32 * 2, current.row)),
            _ => Ok(current), // Other motions not yet implemented
        }
    }
}

impl VimBehavior for VimBehaviorImpl {
    fn mode(&self) -> VimMode {
        self.mode
    }

    fn process_key(&mut self, key: &str, context: &VimContext) -> Result<VimResult> {
        match self.mode {
            VimMode::Normal => self.process_normal_key(key, context),
            VimMode::Insert(_) => self.process_insert_key(key),
            VimMode::Visual(_) => self.process_visual_key(key, context),
            VimMode::Command => self.process_command_key(key),
            VimMode::Replace => Ok(VimResult::None), // Not yet implemented
            VimMode::OperatorPending(_) => self.process_operator_pending_key(key, context),
        }
    }

    fn handle_motion(&mut self, motion: Motion, context: &VimContext) -> Result<VimResult> {
        let new_cursor = self.calculate_new_position(motion, context)?;

        // If in visual mode, extend selection
        if let VimMode::Visual(visual_mode) = self.mode {
            if let Some(anchor) = self.visual_anchor {
                // Calculate selection based on visual mode
                let selection = match visual_mode {
                    VisualMode::Character => Selection {
                        selection_type: SelectionType::Range {
                            start: anchor,
                            end: new_cursor,
                        },
                        anchor: Some(anchor),
                    },
                    VisualMode::Line => Selection {
                        selection_type: SelectionType::Row {
                            rows: if anchor.row <= new_cursor.row {
                                (anchor.row..=new_cursor.row).collect()
                            } else {
                                (new_cursor.row..=anchor.row).collect()
                            },
                        },
                        anchor: Some(anchor),
                    },
                    VisualMode::Block => {
                        // Block selection not fully implemented
                        Selection {
                            selection_type: SelectionType::Range {
                                start: anchor,
                                end: new_cursor,
                            },
                            anchor: Some(anchor),
                        }
                    }
                };

                return Ok(VimResult::Action(Action::UpdateSelection { selection }));
            }
        }

        // Normal cursor movement
        Ok(VimResult::Action(Action::UpdateCursor {
            cursor: new_cursor,
        }))
    }

    fn handle_operator(
        &mut self,
        operator: Operator,
        target: OperatorTarget,
        context: &VimContext,
    ) -> Result<VimResult> {
        match operator {
            Operator::Delete => {
                // Calculate affected range based on target
                match target {
                    OperatorTarget::CurrentLine => Ok(VimResult::Action(Action::StartDelete {
                        targets: vec![context.cursor.row],
                        delete_type: crate::state::DeleteType::Row,
                    })),
                    OperatorTarget::Motion(_motion) => {
                        // Calculate range based on motion
                        Ok(VimResult::Action(Action::StartDelete {
                            targets: vec![context.cursor.col],
                            delete_type: crate::state::DeleteType::Column,
                        }))
                    }
                    _ => Ok(VimResult::None),
                }
            }
            Operator::Change => {
                // Delete and enter insert mode
                self.mode = VimMode::Insert(InsertMode::Insert);
                Ok(VimResult::Action(Action::EnterInsertMode { mode: None }))
            }
            Operator::Yank => {
                // Copy to register - use command's register if specified, otherwise default
                let register = self.current_command.register.unwrap_or('0');
                self.registers.insert(register, String::new()); // Placeholder
                Ok(VimResult::None)
            }
            _ => Ok(VimResult::None), // Other operators not yet implemented
        }
    }

    fn enter_mode(&mut self, mode: VimMode) -> Result<VimResult> {
        let old_mode = self.mode;
        self.mode = mode;

        match mode {
            VimMode::Normal => {
                self.command_buffer.clear();
                self.count_buffer.clear();
                self.visual_anchor = None;
                Ok(VimResult::ModeChange(mode))
            }
            VimMode::Insert(insert_mode) => Ok(VimResult::Action(Action::EnterInsertMode {
                mode: Some(insert_mode.into()),
            })),
            VimMode::Visual(visual_mode) => {
                if let VimMode::Normal = old_mode {
                    // Set visual anchor at current position
                    self.visual_anchor = Some(CellAddress::new(0, 0)); // Should use actual cursor
                    Ok(VimResult::Action(Action::EnterSpreadsheetVisualMode {
                        visual_mode: visual_mode.into(),
                        selection: Selection {
                            selection_type: SelectionType::Cell {
                                address: CellAddress::new(0, 0),
                            },
                            anchor: self.visual_anchor,
                        },
                    }))
                } else {
                    Ok(VimResult::ModeChange(mode))
                }
            }
            VimMode::Command => {
                self.command_buffer.clear();
                Ok(VimResult::Action(Action::EnterCommandMode))
            }
            _ => Ok(VimResult::ModeChange(mode)),
        }
    }

    fn pending_keys(&self) -> &str {
        &self.command_buffer
    }

    fn clear_pending(&mut self) {
        self.command_buffer.clear();
        self.count_buffer.clear();
        self.register_buffer = None;
    }

    fn execute_ex_command(&mut self, command: ExCommand) -> Result<VimResult> {
        // Simplified ex command execution
        match command.command.as_str() {
            "w" | "write" => Ok(VimResult::None), // Placeholder for save
            "q" | "quit" => Ok(VimResult::None),  // Placeholder for quit
            "wq" => Ok(VimResult::None),          // Placeholder for save and quit
            _ => Ok(VimResult::None),
        }
    }
}

impl Default for VimBehaviorImpl {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_context() -> VimContext {
        VimContext {
            cursor: CellAddress::new(0, 0),
            mode: VimMode::Normal,
            register: None,
            count: None,
        }
    }

    #[test]
    fn test_normal_motion() {
        let mut vim = VimBehaviorImpl::new();
        let context = create_test_context();

        let result = vim.process_key("j", &context).unwrap();
        match result {
            VimResult::Action(Action::UpdateCursor { cursor }) => {
                assert_eq!(cursor.row, 1);
                assert_eq!(cursor.col, 0);
            }
            _ => panic!("Expected cursor update action"),
        }
    }

    #[test]
    fn test_enter_insert_mode() {
        let mut vim = VimBehaviorImpl::new();
        let context = create_test_context();

        let _result = vim.process_key("i", &context).unwrap();
        assert!(matches!(vim.mode, VimMode::Insert(InsertMode::Insert)));
    }

    #[test]
    fn test_count_prefix() {
        let mut vim = VimBehaviorImpl::new();
        let context = create_test_context();

        // First digit should be incomplete
        let result = vim.process_key("3", &context).unwrap();
        assert!(matches!(result, VimResult::Incomplete));

        // Motion with count
        let result = vim.process_key("j", &context).unwrap();
        match result {
            VimResult::Action(Action::UpdateCursor { cursor }) => {
                println!("Cursor after 3j: row={}, col={}", cursor.row, cursor.col);
                assert_eq!(cursor.row, 3);
            }
            _ => panic!("Expected cursor update with count, got: {:?}", result),
        }
    }

    #[test]
    fn test_operator_pending() {
        let mut vim = VimBehaviorImpl::new();
        let context = create_test_context();

        // Delete operator should enter operator pending mode
        let result = vim.process_key("d", &context).unwrap();
        assert!(matches!(result, VimResult::Incomplete));
        assert!(matches!(
            vim.mode,
            VimMode::OperatorPending(Operator::Delete)
        ));
    }

    #[test]
    fn test_double_operator() {
        let mut vim = VimBehaviorImpl::new();
        let context = create_test_context();

        // dd should delete current line
        vim.process_key("d", &context).unwrap();
        let result = vim.process_key("d", &context).unwrap();

        match result {
            VimResult::Action(Action::StartDelete { delete_type, .. }) => {
                assert!(matches!(delete_type, crate::state::DeleteType::Row));
            }
            _ => panic!("Expected delete action"),
        }
    }
}
