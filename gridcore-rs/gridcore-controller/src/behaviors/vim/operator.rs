use super::{Motion, Operator, VimBehavior, VimCommand};
use crate::state::{Action, UIState};
use gridcore_core::{types::CellAddress, Result};

/// Context for operator execution
pub struct OperatorContext<'a> {
    pub operator: Operator,
    pub motion: Option<Motion>,
    pub register: Option<char>,
    pub count: Option<usize>,
    pub current_state: &'a UIState,
}

impl VimBehavior {
    /// Execute an operator with a motion
    pub fn execute_operator(&mut self, context: OperatorContext) -> Result<Option<Action>> {
        let range = if let Some(motion) = &context.motion {
            self.calculate_operator_range(motion, context.current_state)?
        } else {
            // No motion - operate on current position
            let cursor = context.current_state.cursor();
            (*cursor, *cursor)
        };

        match context.operator {
            Operator::Delete => self.execute_delete_operator(range, context.register),
            Operator::Change => self.execute_change_operator(range, context.register),
            Operator::Yank => self.execute_yank_operator(range, context.register),
            Operator::Indent => self.execute_indent_operator(range, context.count),
            Operator::Outdent => self.execute_outdent_operator(range, context.count),
            Operator::Format => self.execute_format_operator(range),
            Operator::LowerCase => self.execute_lowercase_operator(range),
            Operator::UpperCase => self.execute_uppercase_operator(range),
            Operator::ToggleCase => self.execute_togglecase_operator(range),
        }
    }

    /// Calculate the range affected by an operator motion
    fn calculate_operator_range(
        &self,
        motion: &Motion,
        current_state: &UIState,
    ) -> Result<(CellAddress, CellAddress)> {
        let context = super::motion::MotionContext::new(
            *current_state.cursor(),
            current_state.viewport().clone(),
        );

        super::motion::motion_range(motion, &context)
    }

    fn execute_delete_operator(
        &mut self,
        range: (CellAddress, CellAddress),
        register: Option<char>,
    ) -> Result<Option<Action>> {
        // Store deleted content in register
        let reg = register.unwrap_or('0');
        self.registers.insert(reg, String::new()); // TODO: Get actual content

        // Delete the range
        if range.0.row == range.1.row {
            // Delete columns in same row
            let cols: Vec<u32> = (range.0.col..=range.1.col).collect();
            Ok(Some(Action::StartDelete {
                targets: cols,
                delete_type: crate::state::DeleteType::Column,
            }))
        } else {
            // Delete rows
            let rows: Vec<u32> = (range.0.row..=range.1.row).collect();
            Ok(Some(Action::StartDelete {
                targets: rows,
                delete_type: crate::state::DeleteType::Row,
            }))
        }
    }

    fn execute_change_operator(
        &mut self,
        _range: (CellAddress, CellAddress),
        register: Option<char>,
    ) -> Result<Option<Action>> {
        // Store changed content in register
        let reg = register.unwrap_or('0');
        self.registers.insert(reg, String::new()); // TODO: Get actual content

        // Delete and enter insert mode
        self.mode = super::VimMode::Insert;

        // TODO: Delete the range first
        Ok(Some(Action::EnterInsertMode { mode: None }))
    }

    fn execute_yank_operator(
        &mut self,
        range: (CellAddress, CellAddress),
        register: Option<char>,
    ) -> Result<Option<Action>> {
        // Store yanked content in register
        let reg = register.unwrap_or('0');

        // TODO: Get actual content from cells
        let content = format!("Yanked from {:?} to {:?}", range.0, range.1);
        self.registers.insert(reg, content);

        // Also store in unnamed register
        if reg != '"' {
            self.registers.insert('"', self.registers[&reg].clone());
        }

        // Yanking doesn't change the buffer
        Ok(None)
    }

    fn execute_indent_operator(
        &mut self,
        range: (CellAddress, CellAddress),
        count: Option<usize>,
    ) -> Result<Option<Action>> {
        let indent_level = count.unwrap_or(1);

        // TODO: Implement actual indentation
        let _ = (range, indent_level);
        Ok(None)
    }

    fn execute_outdent_operator(
        &mut self,
        range: (CellAddress, CellAddress),
        count: Option<usize>,
    ) -> Result<Option<Action>> {
        let outdent_level = count.unwrap_or(1);

        // TODO: Implement actual outdentation
        let _ = (range, outdent_level);
        Ok(None)
    }

    fn execute_format_operator(
        &mut self,
        _range: (CellAddress, CellAddress),
    ) -> Result<Option<Action>> {
        // Format the range
        let command = crate::state::ParsedBulkCommand::Format {
            format_type: "number".to_string(),
        };

        Ok(Some(Action::StartBulkOperation {
            parsed_command: command,
            affected_cells: None,
        }))
    }

    fn execute_lowercase_operator(
        &mut self,
        _range: (CellAddress, CellAddress),
    ) -> Result<Option<Action>> {
        // Convert to lowercase
        let command = crate::state::ParsedBulkCommand::Transform {
            transformation: "lower".to_string(),
        };

        Ok(Some(Action::StartBulkOperation {
            parsed_command: command,
            affected_cells: None,
        }))
    }

    fn execute_uppercase_operator(
        &mut self,
        _range: (CellAddress, CellAddress),
    ) -> Result<Option<Action>> {
        // Convert to uppercase
        let command = crate::state::ParsedBulkCommand::Transform {
            transformation: "upper".to_string(),
        };

        Ok(Some(Action::StartBulkOperation {
            parsed_command: command,
            affected_cells: None,
        }))
    }

    fn execute_togglecase_operator(
        &mut self,
        _range: (CellAddress, CellAddress),
    ) -> Result<Option<Action>> {
        // Toggle case - we'll use transform with "toggle" as a special case
        let command = crate::state::ParsedBulkCommand::Transform {
            transformation: "toggle".to_string(),
        };

        Ok(Some(Action::StartBulkOperation {
            parsed_command: command,
            affected_cells: None,
        }))
    }

    /// Convert a cell address to Excel-style notation (A1, B2, etc.)
    fn _address_to_string(&self, addr: &CellAddress) -> String {
        let col_letter = self._col_to_letter(addr.col);
        format!("{}{}", col_letter, addr.row + 1)
    }

    fn _col_to_letter(&self, col: u32) -> String {
        if col < 26 {
            ((b'A' + col as u8) as char).to_string()
        } else {
            // Handle multi-letter columns (AA, AB, etc.)
            let first = col / 26 - 1;
            let second = col % 26;
            format!(
                "{}{}",
                (b'A' + first as u8) as char,
                (b'A' + second as u8) as char
            )
        }
    }
}

/// Helper functions for operator-pending mode
impl VimBehavior {
    /// Check if we're in operator-pending mode
    pub fn is_operator_pending(&self) -> bool {
        self.mode == super::VimMode::OperatorPending
    }

    /// Get the pending operator
    pub fn get_pending_operator(&self) -> Option<Operator> {
        if self.is_operator_pending() {
            self.current_command.operator
        } else {
            None
        }
    }

    /// Complete an operator with a motion
    pub fn complete_operator(
        &mut self,
        motion: Motion,
        current_state: &UIState,
    ) -> Result<Option<Action>> {
        if let Some(operator) = self.current_command.operator {
            let context = OperatorContext {
                operator,
                motion: Some(motion),
                register: self.current_command.register,
                count: self.current_command.count,
                current_state,
            };

            // Store for repeat
            self.repeat_command = Some(self.current_command.clone());

            // Clear current command
            self.current_command = VimCommand::new();
            self.mode = super::VimMode::Normal;

            self.execute_operator(context)
        } else {
            Ok(None)
        }
    }

    /// Execute a linewise operator (dd, cc, yy)
    pub fn execute_linewise_operator(
        &mut self,
        operator: Operator,
        count: usize,
        current_state: &UIState,
    ) -> Result<Option<Action>> {
        let cursor = current_state.cursor();
        let start = CellAddress::new(0, cursor.row);
        let end = CellAddress::new(u32::MAX, cursor.row + count as u32 - 1);

        match operator {
            Operator::Delete => self.execute_delete_operator((start, end), None),
            Operator::Change => self.execute_change_operator((start, end), None),
            Operator::Yank => self.execute_yank_operator((start, end), None),
            _ => Ok(None),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_address_to_string() {
        let vim = VimBehavior::new();

        assert_eq!(vim._address_to_string(&CellAddress::new(0, 0)), "A1");
        assert_eq!(vim._address_to_string(&CellAddress::new(1, 0)), "B1");
        assert_eq!(vim._address_to_string(&CellAddress::new(25, 0)), "Z1");
        assert_eq!(vim._address_to_string(&CellAddress::new(26, 0)), "AA1");
        assert_eq!(vim._address_to_string(&CellAddress::new(0, 9)), "A10");
    }

    #[test]
    fn test_col_to_letter() {
        let vim = VimBehavior::new();

        assert_eq!(vim._col_to_letter(0), "A");
        assert_eq!(vim._col_to_letter(25), "Z");
        assert_eq!(vim._col_to_letter(26), "AA");
        assert_eq!(vim._col_to_letter(51), "AZ");
        assert_eq!(vim._col_to_letter(52), "BA");
    }
}
