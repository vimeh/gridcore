use super::types::{CommandResult, ExCommand};
use crate::behaviors::vim::VimBehavior;
use gridcore_core::{Result, SpreadsheetError};

/// Trait for executing Ex commands
pub trait ExCommandExecutor {
    fn execute_write(&self, parsed: &ExCommand) -> CommandResult;
    fn execute_quit(&self, parsed: &ExCommand) -> CommandResult;
    fn execute_write_quit(&self, parsed: &ExCommand) -> CommandResult;
    fn execute_edit(&self, parsed: &ExCommand) -> CommandResult;
    fn execute_goto(&self, parsed: &ExCommand) -> CommandResult;
    fn execute_substitute(&self, parsed: &ExCommand) -> CommandResult;
    fn execute_global(&self, parsed: &ExCommand) -> CommandResult;
    fn execute_delete(&self, parsed: &ExCommand) -> CommandResult;
    fn execute_yank(&self, parsed: &ExCommand) -> CommandResult;
    fn execute_put(&self, parsed: &ExCommand) -> CommandResult;
    fn execute_copy(&self, parsed: &ExCommand) -> CommandResult;
    fn execute_move(&self, parsed: &ExCommand) -> CommandResult;
    fn execute_indent(&self, parsed: &ExCommand) -> CommandResult;
    fn execute_outdent(&self, parsed: &ExCommand) -> CommandResult;
    fn execute_center(&self, parsed: &ExCommand) -> CommandResult;
    fn execute_left(&self, parsed: &ExCommand) -> CommandResult;
    fn execute_right(&self, parsed: &ExCommand) -> CommandResult;
    fn execute_set(&mut self, parsed: &ExCommand) -> CommandResult;
    fn execute_setlocal(&mut self, parsed: &ExCommand) -> CommandResult;
    fn execute_marks(&self, parsed: &ExCommand) -> CommandResult;
    fn execute_delmarks(&mut self, parsed: &ExCommand) -> CommandResult;
    fn execute_registers(&self, parsed: &ExCommand) -> CommandResult;
    fn execute_normal(&self, parsed: &ExCommand) -> CommandResult;
    fn execute_format(&self, parsed: &ExCommand) -> CommandResult;
    fn execute_sort(&self, parsed: &ExCommand) -> CommandResult;
    fn execute_filter(&self, parsed: &ExCommand) -> CommandResult;
    fn execute_formula(&self, parsed: &ExCommand) -> CommandResult;
    fn execute_chart(&self, parsed: &ExCommand) -> CommandResult;
    fn execute_help(&self, parsed: &ExCommand) -> CommandResult;
}

impl ExCommandExecutor for VimBehavior {
    fn execute_write(&self, _parsed: &ExCommand) -> CommandResult {
        // TODO: Implement save functionality
        // Ok(Some(Action::Save))
        Ok(None)
    }

    fn execute_quit(&self, _parsed: &ExCommand) -> CommandResult {
        // TODO: Check for unsaved changes
        // Ok(Some(Action::Quit))
        Ok(None)
    }

    fn execute_write_quit(&self, _parsed: &ExCommand) -> CommandResult {
        // TODO: Save then quit
        // Ok(Some(Action::SaveAndQuit))
        Ok(None)
    }

    fn execute_edit(&self, _parsed: &ExCommand) -> CommandResult {
        // TODO: Implement file/sheet editing
        Ok(None)
    }

    fn execute_goto(&self, _parsed: &ExCommand) -> CommandResult {
        // TODO: Implement goto line functionality
        // if let Some(ref range) = parsed.range {
        //     match range {
        //         CommandRange::Line(line) => Ok(Some(Action::GotoLine { line: *line as i32 })),
        //         CommandRange::Lines(start, _) => Ok(Some(Action::GotoLine {
        //             line: *start as i32,
        //         })),
        //         _ => Ok(None),
        //     }
        // } else {
        //     Ok(None)
        // }
        Ok(None)
    }

    fn execute_substitute(&self, parsed: &ExCommand) -> CommandResult {
        // Parse substitute pattern
        if parsed.args.is_empty() {
            return Err(SpreadsheetError::InvalidCommand(
                "Substitute requires pattern".to_string(),
            ));
        }

        // TODO: Implement proper substitute parsing
        // let pattern = parsed.args.join(" ");
        // Ok(Some(Action::Substitute { pattern }))
        Ok(None)
    }

    fn execute_global(&self, _parsed: &ExCommand) -> CommandResult {
        // TODO: Implement global command
        Ok(None)
    }

    fn execute_delete(&self, _parsed: &ExCommand) -> CommandResult {
        // TODO: Implement delete functionality
        // if let Some(ref range) = parsed.range {
        //     match range {
        //         CommandRange::Lines(start, end) => Ok(Some(Action::DeleteRange {
        //             start: *start,
        //             end: *end,
        //         })),
        //         _ => Ok(Some(Action::Delete)),
        //     }
        // } else {
        //     Ok(Some(Action::Delete))
        // }
        Ok(None)
    }

    fn execute_yank(&self, _parsed: &ExCommand) -> CommandResult {
        // TODO: Implement yank with range
        // Ok(Some(Action::Yank))
        Ok(None)
    }

    fn execute_put(&self, _parsed: &ExCommand) -> CommandResult {
        // TODO: Implement put command
        // Ok(Some(Action::Put))
        Ok(None)
    }

    fn execute_copy(&self, _parsed: &ExCommand) -> CommandResult {
        // TODO: Implement copy command
        Ok(None)
    }

    fn execute_move(&self, _parsed: &ExCommand) -> CommandResult {
        // TODO: Implement move command
        Ok(None)
    }

    fn execute_indent(&self, _parsed: &ExCommand) -> CommandResult {
        // TODO: Implement indent command
        // Ok(Some(Action::Indent))
        Ok(None)
    }

    fn execute_outdent(&self, _parsed: &ExCommand) -> CommandResult {
        // TODO: Implement outdent command
        // Ok(Some(Action::Outdent))
        Ok(None)
    }

    fn execute_center(&self, _parsed: &ExCommand) -> CommandResult {
        // TODO: Implement center alignment
        Ok(None)
    }

    fn execute_left(&self, _parsed: &ExCommand) -> CommandResult {
        // TODO: Implement left alignment
        Ok(None)
    }

    fn execute_right(&self, _parsed: &ExCommand) -> CommandResult {
        // TODO: Implement right alignment
        Ok(None)
    }

    fn execute_set(&mut self, parsed: &ExCommand) -> CommandResult {
        if parsed.args.is_empty() {
            // return Ok(Some(Action::ShowSettings));
            return Ok(None);
        }

        let setting = parsed.args.join(" ");

        // Parse setting
        if let Some(option) = setting.strip_prefix("no") {
            // Disable setting
            self.apply_setting(option, false)?;
        } else if let Some(eq_pos) = setting.find('=') {
            // Set value
            let option = &setting[..eq_pos];
            let value = &setting[eq_pos + 1..];
            self.apply_setting_value(option, value)?;
        } else {
            // Enable setting
            self.apply_setting(&setting, true)?;
        }

        Ok(None)
    }

    fn execute_setlocal(&mut self, parsed: &ExCommand) -> CommandResult {
        // For now, treat setlocal the same as set
        self.execute_set(parsed)
    }

    fn execute_marks(&self, _parsed: &ExCommand) -> CommandResult {
        // TODO: Display marks
        // Ok(Some(Action::ShowMarks))
        Ok(None)
    }

    fn execute_delmarks(&mut self, parsed: &ExCommand) -> CommandResult {
        if parsed.args.is_empty() {
            return Ok(None);
        }

        for mark in &parsed.args {
            for ch in mark.chars() {
                self.marks.remove(&ch);
            }
        }
        Ok(None)
    }

    fn execute_registers(&self, _parsed: &ExCommand) -> CommandResult {
        // TODO: Display registers
        // Ok(Some(Action::ShowRegisters))
        Ok(None)
    }

    fn execute_normal(&self, _parsed: &ExCommand) -> CommandResult {
        // TODO: Execute normal mode commands
        Ok(None)
    }

    fn execute_format(&self, parsed: &ExCommand) -> CommandResult {
        if parsed.args.is_empty() {
            return Ok(None);
        }

        // let format_type = &parsed.args[0];
        // Ok(Some(Action::Format {
        //     format_type: format_type.clone(),
        // }))
        Ok(None)
    }

    fn execute_sort(&self, _parsed: &ExCommand) -> CommandResult {
        // let ascending = !parsed.flags.iter().any(|f| f == "-r" || f == "--reverse");
        // Ok(Some(Action::Sort { ascending }))
        Ok(None)
    }

    fn execute_filter(&self, parsed: &ExCommand) -> CommandResult {
        if parsed.args.is_empty() {
            return Ok(None);
        }

        // let pattern = parsed.args.join(" ");
        // Ok(Some(Action::Filter { pattern }))
        Ok(None)
    }

    fn execute_formula(&self, parsed: &ExCommand) -> CommandResult {
        if parsed.args.is_empty() {
            return Ok(None);
        }

        // let formula = parsed.args.join(" ");
        // Ok(Some(Action::ApplyFormula { formula }))
        Ok(None)
    }

    fn execute_chart(&self, parsed: &ExCommand) -> CommandResult {
        if parsed.args.is_empty() {
            return Ok(None);
        }

        // let chart_type = &parsed.args[0];
        // Ok(Some(Action::CreateChart {
        //     chart_type: chart_type.clone(),
        // }))
        Ok(None)
    }

    fn execute_help(&self, _parsed: &ExCommand) -> CommandResult {
        // TODO: Show help for command if specified
        // Ok(Some(Action::ShowHelp))
        Ok(None)
    }
}

impl VimBehavior {
    fn apply_setting(&mut self, option: &str, _enable: bool) -> Result<()> {
        // TODO: Implement settings when fields are added to VimBehavior
        // match option {
        //     "number" | "nu" => self.show_line_numbers = enable,
        //     "relativenumber" | "rnu" => self.relative_numbers = enable,
        //     "wrap" => self.wrap_lines = enable,
        //     "expandtab" | "et" => self.expand_tab = enable,
        //     "ignorecase" | "ic" => self.ignore_case = enable,
        //     "smartcase" | "scs" => self.smart_case = enable,
        //     _ => {
        //         return Err(SpreadsheetError::InvalidCommand(format!(
        //             "Unknown option: {}",
        //             option
        //         )));
        //     }
        // }
        match option {
            "number" | "nu" | "relativenumber" | "rnu" | "wrap" | "expandtab" | "et"
            | "ignorecase" | "ic" | "smartcase" | "scs" => {
                // Settings recognized but not yet implemented
                Ok(())
            }
            _ => Err(SpreadsheetError::InvalidCommand(format!(
                "Unknown option: {}",
                option
            ))),
        }
    }

    fn apply_setting_value(&mut self, option: &str, value: &str) -> Result<()> {
        // TODO: Implement when fields are added to VimBehavior
        // match option {
        //     "tabstop" | "ts" => {
        //         self.tab_size = value.parse().map_err(|_| {
        //             SpreadsheetError::InvalidCommand("Invalid tabstop value".to_string())
        //         })?;
        //     }
        //     "shiftwidth" | "sw" => {
        //         self.shift_width = value.parse().map_err(|_| {
        //             SpreadsheetError::InvalidCommand("Invalid shiftwidth value".to_string())
        //         })?;
        //     }
        //     _ => {
        //         return Err(SpreadsheetError::InvalidCommand(format!(
        //             "Unknown option: {}",
        //             option
        //         )));
        //     }
        // }
        match option {
            "tabstop" | "ts" | "shiftwidth" | "sw" => {
                // Validate the value is numeric
                value.parse::<u32>().map_err(|_| {
                    SpreadsheetError::InvalidCommand(format!(
                        "Invalid value for {}: {}",
                        option, value
                    ))
                })?;
                // Settings recognized but not yet implemented
                Ok(())
            }
            _ => Err(SpreadsheetError::InvalidCommand(format!(
                "Unknown option: {}",
                option
            ))),
        }
    }
}
