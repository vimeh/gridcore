use crate::controller::events::{ErrorSeverity, SpreadsheetEvent};
use crate::controller::mode::EditorMode;
use crate::managers::ErrorSystem;
use crate::state::Action;
use gridcore_core::{types::CellAddress, Result, SpreadsheetFacade};

/// Handles cell editing operations
pub struct CellEditor;

impl CellEditor {
    /// Submit formula bar value to current cell
    pub fn submit_formula_bar(
        facade: &mut SpreadsheetFacade,
        cursor: CellAddress,
        value: String,
    ) -> Result<CellEditResult> {
        let result = facade.set_cell_value(&cursor, &value);

        match result {
            Ok(_) => {
                // Check if the cell now contains an error value
                if let Some(gridcore_core::types::CellValue::Error(error_type)) =
                    facade.get_cell_raw_value(&cursor)
                {
                    let enhanced_message = format!("Formula error: {}", error_type.full_display());
                    Ok(CellEditResult::SuccessWithError {
                        address: cursor,
                        value,
                        error_message: enhanced_message,
                    })
                } else {
                    // Always clear formula bar after successful submission
                    Ok(CellEditResult::Success {
                        address: cursor,
                        value,
                        should_clear_formula_bar: true,
                    })
                }
            }
            Err(e) => Ok(CellEditResult::Failed {
                address: cursor,
                error: ErrorSystem::format_error(&e),
            }),
        }
    }

    /// Submit cell edit from editing mode using new architecture
    pub fn submit_cell_edit_direct(
        mode: &EditorMode,
        cursor: CellAddress,
        facade: &mut SpreadsheetFacade,
    ) -> Option<CellEditResult> {
        if let EditorMode::Editing { value, .. } = mode {
            let address = cursor;
            let cell_value = value.clone();

            let result = facade.set_cell_value(&address, &cell_value);

            match result {
                Ok(_) => {
                    // Check if the cell now contains an error value
                    if let Some(gridcore_core::types::CellValue::Error(error_type)) =
                        facade.get_cell_raw_value(&address)
                    {
                        let enhanced_message =
                            format!("Formula error: {}", error_type.full_display());
                        log::error!("Error in cell {}: {}", address, enhanced_message);
                        Some(CellEditResult::SuccessWithError {
                            address,
                            value: cell_value,
                            error_message: enhanced_message,
                        })
                    } else {
                        Some(CellEditResult::Success {
                            address,
                            value: cell_value,
                            should_clear_formula_bar: false,
                        })
                    }
                }
                Err(e) => {
                    let message = ErrorSystem::format_error(&e);
                    log::error!("Parse/Set error in cell {}: {}", address, message);
                    Some(CellEditResult::Failed {
                        address,
                        error: message,
                    })
                }
            }
        } else {
            None
        }
    }

    /// Complete editing from editing mode using new architecture
    pub fn complete_editing_direct(
        mode: &EditorMode,
        cursor: CellAddress,
        facade: &mut SpreadsheetFacade,
    ) -> Option<CellEditResult> {
        if let EditorMode::Editing { value, .. } = mode {
            let address = cursor;
            let cell_value = value.clone();
            
            log::debug!("complete_editing_direct: Setting cell {:?} to value: '{}'", address, cell_value);

            let result = facade.set_cell_value(&address, &cell_value);

            match result {
                Ok(_) => {
                    // Check if the cell now contains an error value
                    if let Some(gridcore_core::types::CellValue::Error(error_type)) =
                        facade.get_cell_raw_value(&address)
                    {
                        let enhanced_message =
                            format!("Formula error: {}", error_type.full_display());
                        log::error!("Error in cell {}: {}", address, enhanced_message);
                        Some(CellEditResult::SuccessWithError {
                            address,
                            value: cell_value,
                            error_message: enhanced_message,
                        })
                    } else {
                        Some(CellEditResult::Success {
                            address,
                            value: cell_value,
                            should_clear_formula_bar: false,
                        })
                    }
                }
                Err(e) => {
                    let message = ErrorSystem::format_error(&e);
                    log::error!("Parse/Set error in cell {}: {}", address, message);
                    Some(CellEditResult::Failed {
                        address,
                        error: message,
                    })
                }
            }
        } else {
            None
        }
    }
}

/// Result of a cell edit operation
pub enum CellEditResult {
    Success {
        address: CellAddress,
        value: String,
        should_clear_formula_bar: bool,
    },
    SuccessWithError {
        address: CellAddress,
        value: String,
        error_message: String,
    },
    Failed {
        address: CellAddress,
        error: String,
    },
}

impl CellEditResult {
    /// Create appropriate events from the result
    pub fn create_events(&self) -> Vec<(SpreadsheetEvent, Option<(String, ErrorSeverity)>)> {
        match self {
            CellEditResult::Success { address, value, .. } => {
                vec![(
                    SpreadsheetEvent::CellEditCompleted {
                        address: *address,
                        value: value.clone(),
                    },
                    None,
                )]
            }
            CellEditResult::SuccessWithError {
                address,
                value,
                error_message,
            } => vec![
                (
                    SpreadsheetEvent::CellEditCompleted {
                        address: *address,
                        value: value.clone(),
                    },
                    None,
                ),
                (
                    SpreadsheetEvent::ErrorOccurred {
                        message: error_message.clone(),
                        severity: ErrorSeverity::Error,
                    },
                    Some((error_message.clone(), ErrorSeverity::Error)),
                ),
            ],
            CellEditResult::Failed { error, .. } => vec![(
                SpreadsheetEvent::ErrorOccurred {
                    message: error.clone(),
                    severity: ErrorSeverity::Error,
                },
                Some((error.clone(), ErrorSeverity::Error)),
            )],
        }
    }

    /// Get the next action to take after this result
    pub fn next_action(&self) -> Option<Action> {
        match self {
            CellEditResult::Success { .. } | CellEditResult::SuccessWithError { .. } => {
                Some(Action::ExitToNavigation)
            }
            CellEditResult::Failed { .. } => Some(Action::ExitToNavigation),
        }
    }
}
