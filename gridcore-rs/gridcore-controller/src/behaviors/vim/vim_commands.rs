//! Consolidated vim command execution
//! Handles all normal mode, visual mode, and operator commands

use super::vim_core::{
    Direction, InsertMode, Motion, Operator, OperatorTarget, VimCommand, VimContext, VimMode,
    VimResult,
};
use super::vim_parser::VimParser;
use super::LegacyVimBehavior;
use crate::state::{Action, UIState};
use gridcore_core::{types::CellAddress, Result};

impl LegacyVimBehavior {
    /// Execute a parsed vim command
    pub fn execute_vim_command(
        &mut self,
        command: &VimCommand,
        context: &VimContext,
    ) -> Result<VimResult> {
        // Handle count
        let count = command.count.unwrap_or(1);

        // Handle register
        if let Some(reg) = command.register {
            self.current_command.register = Some(reg);
        }

        // Execute based on operator and target
        match (&command.operator, &command.target) {
            // Motion only - move cursor
            (None, Some(OperatorTarget::Motion(motion))) => {
                self.execute_motion(motion, count, context)
            }

            // Operator only - enter operator-pending mode
            (Some(op), None) => self.enter_operator_pending_mode(*op),

            // Operator + target - handle specific target types
            (Some(op), Some(target)) => match target {
                OperatorTarget::TextObject(obj) => {
                    self.execute_text_object_operation(*op, obj.clone(), count, context)
                }
                OperatorTarget::CurrentLine => self.execute_line_operation(*op, count, context),
                _ => self.execute_operator_with_target(*op, target, count, context),
            },

            _ => Ok(VimResult::None),
        }
    }

    /// Execute a motion command
    fn execute_motion(
        &self,
        motion: &Motion,
        count: usize,
        context: &VimContext,
    ) -> Result<VimResult> {
        let new_position = self.calculate_motion_target(motion, count, context)?;
        Ok(VimResult::Action(Action::UpdateCursor {
            cursor: new_position,
        }))
    }

    /// Calculate target position for a motion
    fn calculate_motion_target(
        &self,
        motion: &Motion,
        count: usize,
        context: &VimContext,
    ) -> Result<CellAddress> {
        let current = context.cursor;

        Ok(match motion {
            Motion::Char(Direction::Left, n) => CellAddress::new(
                current.col.saturating_sub((*n as u32) * (count as u32)),
                current.row,
            ),
            Motion::Char(Direction::Right, n) => {
                CellAddress::new(current.col + ((*n as u32) * (count as u32)), current.row)
            }
            Motion::Char(Direction::Up, n) => CellAddress::new(
                current.col,
                current.row.saturating_sub((*n as u32) * (count as u32)),
            ),
            Motion::Char(Direction::Down, n) => {
                CellAddress::new(current.col, current.row + ((*n as u32) * (count as u32)))
            }
            Motion::LineStart => CellAddress::new(0, current.row),
            Motion::LineEnd => CellAddress::new(u32::MAX, current.row),
            Motion::FirstNonBlank => CellAddress::new(0, current.row),
            Motion::DocumentStart => CellAddress::new(0, 0),
            Motion::DocumentEnd => CellAddress::new(current.col, u32::MAX),
            Motion::GotoLine(line) => CellAddress::new(current.col, line.saturating_sub(1)),
            Motion::WordForward(n) => {
                CellAddress::new(current.col + ((*n as u32) * (count as u32)), current.row)
            }
            Motion::WordBackward(n) => CellAddress::new(
                current.col.saturating_sub((*n as u32) * (count as u32)),
                current.row,
            ),
            _ => current, // TODO: Implement other motions
        })
    }

    /// Enter operator-pending mode
    fn enter_operator_pending_mode(&mut self, operator: Operator) -> Result<VimResult> {
        self.mode = VimMode::OperatorPending(operator);
        self.current_command.operator = Some(operator);
        Ok(VimResult::None)
    }

    /// Execute operator with target
    fn execute_operator_with_target(
        &mut self,
        operator: Operator,
        target: &OperatorTarget,
        count: usize,
        context: &VimContext,
    ) -> Result<VimResult> {
        match operator {
            Operator::Delete => self.execute_delete(target, count, context),
            Operator::Change => self.execute_change(target, count, context),
            Operator::Yank => self.execute_yank(target, count, context),
            Operator::Indent => self.execute_indent(target, count, context),
            Operator::Outdent => self.execute_outdent(target, count, context),
            _ => Ok(VimResult::None),
        }
    }

    /// Execute delete operation
    fn execute_delete(
        &mut self,
        target: &OperatorTarget,
        count: usize,
        context: &VimContext,
    ) -> Result<VimResult> {
        let range = self.calculate_operator_range(target, count, context)?;

        // Store in register
        let reg = self.current_command.register.unwrap_or('0');
        self.registers.insert(reg, String::new()); // TODO: Get actual content

        // Delete the range
        if range.0.row == range.1.row {
            let cols: Vec<u32> = (range.0.col..=range.1.col).collect();
            Ok(VimResult::Action(Action::StartDelete {
                targets: cols,
                delete_type: crate::state::DeleteType::Column,
            }))
        } else {
            let rows: Vec<u32> = (range.0.row..=range.1.row).collect();
            Ok(VimResult::Action(Action::StartDelete {
                targets: rows,
                delete_type: crate::state::DeleteType::Row,
            }))
        }
    }

    /// Execute change operation
    fn execute_change(
        &mut self,
        _target: &OperatorTarget,
        _count: usize,
        _context: &VimContext,
    ) -> Result<VimResult> {
        // Store in register
        let reg = self.current_command.register.unwrap_or('0');
        self.registers.insert(reg, String::new());

        // Delete and enter insert mode
        self.mode = VimMode::Insert(InsertMode::Insert);

        // For now, just enter insert mode
        Ok(VimResult::Action(Action::EnterInsertMode { mode: None }))
    }

    /// Execute yank operation
    fn execute_yank(
        &mut self,
        target: &OperatorTarget,
        count: usize,
        context: &VimContext,
    ) -> Result<VimResult> {
        let range = self.calculate_operator_range(target, count, context)?;

        // Store in register
        let reg = self.current_command.register.unwrap_or('0');
        let content = format!("Yanked from {:?} to {:?}", range.0, range.1);
        self.registers.insert(reg, content.clone());

        // Also store in unnamed register
        if reg != '"' {
            self.registers.insert('"', content);
        }

        Ok(VimResult::None)
    }

    /// Execute indent operation
    fn execute_indent(
        &mut self,
        _target: &OperatorTarget,
        _count: usize,
        _context: &VimContext,
    ) -> Result<VimResult> {
        // TODO: Implement indentation
        Ok(VimResult::None)
    }

    /// Execute outdent operation
    fn execute_outdent(
        &mut self,
        _target: &OperatorTarget,
        _count: usize,
        _context: &VimContext,
    ) -> Result<VimResult> {
        // TODO: Implement outdentation
        Ok(VimResult::None)
    }

    /// Execute line operation (dd, yy, cc)
    fn execute_line_operation(
        &mut self,
        operator: Operator,
        count: usize,
        context: &VimContext,
    ) -> Result<VimResult> {
        let start = CellAddress::new(0, context.cursor.row);
        let end = CellAddress::new(u32::MAX, context.cursor.row + count as u32 - 1);

        match operator {
            Operator::Delete => {
                let rows: Vec<u32> = (start.row..=end.row).collect();
                Ok(VimResult::Action(Action::StartDelete {
                    targets: rows,
                    delete_type: crate::state::DeleteType::Row,
                }))
            }
            Operator::Change => {
                self.mode = VimMode::Insert(InsertMode::Insert);
                Ok(VimResult::Action(Action::EnterInsertMode { mode: None }))
            }
            Operator::Yank => {
                let reg = self.current_command.register.unwrap_or('0');
                self.registers
                    .insert(reg, format!("Line {}", context.cursor.row));
                Ok(VimResult::None)
            }
            _ => Ok(VimResult::None),
        }
    }

    /// Execute text object operation
    fn execute_text_object_operation(
        &mut self,
        _operator: Operator,
        _text_object: super::vim_core::TextObject,
        _count: usize,
        _context: &VimContext,
    ) -> Result<VimResult> {
        // TODO: Implement text object operations
        Ok(VimResult::None)
    }

    /// Calculate range affected by operator
    fn calculate_operator_range(
        &self,
        target: &OperatorTarget,
        count: usize,
        context: &VimContext,
    ) -> Result<(CellAddress, CellAddress)> {
        match target {
            OperatorTarget::Motion(motion) => {
                let end = self.calculate_motion_target(motion, count, context)?;
                let start = context.cursor;

                // Ensure start is before end
                if start.row < end.row || (start.row == end.row && start.col <= end.col) {
                    Ok((start, end))
                } else {
                    Ok((end, start))
                }
            }
            OperatorTarget::CurrentLine => {
                let start = CellAddress::new(0, context.cursor.row);
                let end = CellAddress::new(u32::MAX, context.cursor.row + count as u32 - 1);
                Ok((start, end))
            }
            _ => Ok((context.cursor, context.cursor)),
        }
    }

    /// Process a key in normal mode using the parser
    pub fn process_normal_key_with_parser(
        &mut self,
        key: &str,
        current_state: &UIState,
    ) -> Result<Option<Action>> {
        // Build command buffer
        self.command_buffer.push_str(key);

        // Try to parse the command
        match VimParser::parse_command(&self.command_buffer) {
            Ok(command) => {
                self.command_buffer.clear();

                let context = VimContext {
                    cursor: *current_state.cursor(),
                    mode: self.mode,
                    register: self.current_command.register,
                    count: self.current_command.count,
                };

                match self.execute_vim_command(&command, &context)? {
                    VimResult::Action(action) => Ok(Some(action)),
                    VimResult::ModeChange(mode) => {
                        self.mode = mode;
                        Ok(None)
                    }
                    VimResult::None => Ok(None),
                    VimResult::Incomplete => Ok(None), // Command not complete yet
                }
            }
            Err(_) => {
                // Command not complete yet or invalid
                if self.command_buffer.len() > 10 {
                    // Likely invalid, clear buffer
                    self.command_buffer.clear();
                }
                Ok(None)
            }
        }
    }
}
