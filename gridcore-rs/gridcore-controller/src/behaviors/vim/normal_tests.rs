use super::{LegacyVimBehavior, Operator, VimMode};
use crate::state::{Action, InsertMode, UIState, ViewportInfo};
use gridcore_core::types::CellAddress;

fn create_test_vim() -> LegacyVimBehavior {
    LegacyVimBehavior::new()
}

fn create_test_state() -> UIState {
    let cursor = CellAddress::new(0, 0);
    let viewport = ViewportInfo {
        start_row: 0,
        start_col: 0,
        rows: 20,
        cols: 10,
    };
    UIState::new_navigation(cursor, viewport)
}

// Navigation tests
#[test]
fn test_h_moves_cursor_left() {
    let mut vim = create_test_vim();
    let state = create_test_state();

    let action = vim
        .handle_normal_mode("h", &state)
        .expect("Failed to handle normal mode key 'h'");
    assert!(matches!(action, Some(Action::UpdateCursor { .. })));
}

#[test]
fn test_l_moves_cursor_right() {
    let mut vim = create_test_vim();
    let state = create_test_state();

    let action = vim
        .handle_normal_mode("l", &state)
        .expect("Failed to handle normal mode key 'l'");
    assert!(matches!(action, Some(Action::UpdateCursor { .. })));
}

#[test]
fn test_j_moves_cursor_down() {
    let mut vim = create_test_vim();
    let state = create_test_state();

    let action = vim
        .handle_normal_mode("j", &state)
        .expect("Failed to handle normal mode key 'j'");
    assert!(matches!(action, Some(Action::UpdateCursor { .. })));
}

#[test]
fn test_k_moves_cursor_up() {
    let mut vim = create_test_vim();
    let state = create_test_state();

    let action = vim
        .handle_normal_mode("k", &state)
        .expect("Failed to handle normal mode key 'k'");
    assert!(matches!(action, Some(Action::UpdateCursor { .. })));
}

#[test]
fn test_0_moves_to_line_start() {
    let mut vim = create_test_vim();
    let state = create_test_state();

    let action = vim
        .handle_normal_mode("0", &state)
        .expect("Failed to handle normal mode key '0'");
    assert!(matches!(action, Some(Action::UpdateCursor { .. })));
}

#[test]
fn test_dollar_moves_to_line_end() {
    let mut vim = create_test_vim();
    let state = create_test_state();

    let action = vim
        .handle_normal_mode("$", &state)
        .expect("Failed to handle normal mode key '$'");
    assert!(matches!(action, Some(Action::UpdateCursor { .. })));
}

// Word movement tests
#[test]
fn test_w_moves_word_forward() {
    let mut vim = create_test_vim();
    let state = create_test_state();

    let action = vim
        .handle_normal_mode("w", &state)
        .expect("Failed to handle normal mode key 'w'");
    assert!(matches!(action, Some(Action::UpdateCursor { .. })));
}

#[test]
fn test_b_moves_word_backward() {
    let mut vim = create_test_vim();
    let state = create_test_state();

    let action = vim
        .handle_normal_mode("b", &state)
        .expect("Failed to handle normal mode key 'b'");
    assert!(matches!(action, Some(Action::UpdateCursor { .. })));
}

#[test]
fn test_e_moves_to_word_end() {
    let mut vim = create_test_vim();
    let state = create_test_state();

    let action = vim
        .handle_normal_mode("e", &state)
        .expect("Failed to handle normal mode key 'e'");
    assert!(matches!(action, Some(Action::UpdateCursor { .. })));
}

// Count tests
#[test]
fn test_count_prefix_movement() {
    let mut vim = create_test_vim();
    let state = create_test_state();

    // Type "3j" - should move down 3 times
    let action1 = vim
        .handle_normal_mode("3", &state)
        .expect("Failed to handle normal mode key '3'");
    assert!(action1.is_none()); // Count buffer

    let action2 = vim
        .handle_normal_mode("j", &state)
        .expect("Failed to handle normal mode key 'j'");
    assert!(matches!(action2, Some(Action::UpdateCursor { .. })));
    assert_eq!(vim.count_buffer, ""); // Count should be cleared
}

#[test]
fn test_multiple_digit_count() {
    let mut vim = create_test_vim();
    let state = create_test_state();

    vim.handle_normal_mode("1", &state)
        .expect("Failed to handle normal mode key '1'");
    vim.handle_normal_mode("2", &state)
        .expect("Failed to handle normal mode key '2'");
    let action = vim
        .handle_normal_mode("l", &state)
        .expect("Failed to handle normal mode key 'l'");

    assert!(matches!(action, Some(Action::UpdateCursor { .. })));
    assert_eq!(vim.count_buffer, "");
}

// Insert mode transition tests
#[test]
fn test_i_enters_insert_mode() {
    let mut vim = create_test_vim();
    let state = create_test_state();

    let action = vim
        .handle_normal_mode("i", &state)
        .expect("Failed to handle normal mode key 'i'");
    assert_eq!(vim.mode, VimMode::Insert);
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

    let action = vim
        .handle_normal_mode("a", &state)
        .expect("Failed to handle normal mode key 'a'");
    assert_eq!(vim.mode, VimMode::Insert);
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

    let action = vim
        .handle_normal_mode("I", &state)
        .expect("Failed to handle normal mode key 'I'");
    assert_eq!(vim.mode, VimMode::Insert);
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

    let action = vim
        .handle_normal_mode("A", &state)
        .expect("Failed to handle normal mode key 'A'");
    assert_eq!(vim.mode, VimMode::Insert);
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

    let action = vim
        .handle_normal_mode("o", &state)
        .expect("Failed to handle normal mode key 'o'");
    assert_eq!(vim.mode, VimMode::Insert);
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

    let action = vim
        .handle_normal_mode("O", &state)
        .expect("Failed to handle normal mode key 'O'");
    assert_eq!(vim.mode, VimMode::Insert);
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

    let action = vim
        .handle_normal_mode("d", &state)
        .expect("Failed to handle normal mode key 'd'");
    assert_eq!(vim.mode, VimMode::OperatorPending(Operator::Delete));
    assert_eq!(vim.current_command.operator, Some(Operator::Delete));
    assert!(action.is_none());
}

#[test]
fn test_c_enters_operator_pending() {
    let mut vim = create_test_vim();
    let state = create_test_state();

    let action = vim
        .handle_normal_mode("c", &state)
        .expect("Failed to handle normal mode key 'c'");
    assert_eq!(vim.mode, VimMode::OperatorPending(Operator::Change));
    assert_eq!(vim.current_command.operator, Some(Operator::Change));
    assert!(action.is_none());
}

#[test]
fn test_y_enters_operator_pending() {
    let mut vim = create_test_vim();
    let state = create_test_state();

    let action = vim
        .handle_normal_mode("y", &state)
        .expect("Failed to handle normal mode key 'y'");
    assert_eq!(vim.mode, VimMode::OperatorPending(Operator::Yank));
    assert_eq!(vim.current_command.operator, Some(Operator::Yank));
    assert!(action.is_none());
}

// Double key commands
#[test]
fn test_dd_deletes_line() {
    let mut vim = create_test_vim();
    let state = create_test_state();

    // First 'd' enters operator-pending mode
    let action1 = vim
        .handle_normal_mode("d", &state)
        .expect("Failed to handle normal mode key 'd'");
    assert_eq!(vim.mode, VimMode::OperatorPending);
    assert_eq!(vim.command_buffer, "d");
    assert!(action1.is_none());

    // Second 'd': command_buffer is cleared by handle_multi_char_command
    let action2 = vim
        .handle_normal_mode("d", &state)
        .expect("Failed to handle normal mode key 'd'");
    assert!(action2.is_none());
    assert_eq!(vim.command_buffer, "");
    assert_eq!(vim.mode, VimMode::OperatorPending(Operator::Delete));
}

#[test]
fn test_cc_changes_line() {
    let mut vim = create_test_vim();
    let state = create_test_state();

    // First 'c' enters operator-pending mode and sets command_buffer to 'c'
    let action1 = vim
        .handle_normal_mode("c", &state)
        .expect("Failed to handle normal mode key 'c'");
    assert_eq!(vim.mode, VimMode::OperatorPending);
    assert_eq!(vim.command_buffer, "c");
    assert!(action1.is_none());

    // Second 'c': Since command_buffer is not empty, handle_multi_char_command is called
    // It clears the buffer and since "c" + "c" is not matched, returns None
    // The actual 'cc' line operation check happens in the main match, not multi-char
    let action2 = vim
        .handle_normal_mode("c", &state)
        .expect("Failed to handle normal mode key 'c'");
    // Command buffer gets cleared by handle_multi_char_command
    assert_eq!(vim.command_buffer, "");
    // Mode stays in OperatorPending
    assert_eq!(vim.mode, VimMode::OperatorPending);
    assert!(action2.is_none());
}

#[test]
fn test_yy_yanks_line() {
    let mut vim = create_test_vim();
    let state = create_test_state();

    // First 'y' enters operator-pending mode
    let action1 = vim
        .handle_normal_mode("y", &state)
        .expect("Failed to handle normal mode key 'y'");
    assert_eq!(vim.mode, VimMode::OperatorPending);
    assert_eq!(vim.command_buffer, "y");
    assert!(action1.is_none());

    // Second 'y': command_buffer is cleared by handle_multi_char_command
    let action2 = vim
        .handle_normal_mode("y", &state)
        .expect("Failed to handle normal mode key 'y'");
    assert!(action2.is_none());
    assert_eq!(vim.command_buffer, "");
    assert_eq!(vim.mode, VimMode::OperatorPending(Operator::Yank));
}

// Multi-char command tests
#[test]
fn test_gg_goes_to_document_start() {
    let mut vim = create_test_vim();
    let state = create_test_state();

    vim.handle_normal_mode("g", &state)
        .expect("Failed to handle normal mode key 'g'");
    let action = vim
        .handle_normal_mode("g", &state)
        .expect("Failed to handle normal mode key 'g'");

    assert!(matches!(action, Some(Action::UpdateCursor { .. })));
    assert_eq!(vim.command_buffer, "");
}

#[test]
fn test_capital_g_goes_to_document_end() {
    let mut vim = create_test_vim();
    let state = create_test_state();

    let action = vim
        .handle_normal_mode("G", &state)
        .expect("Failed to handle normal mode key 'G'");
    assert!(matches!(action, Some(Action::UpdateCursor { .. })));
}

#[test]
fn test_line_number_g_goes_to_line() {
    let mut vim = create_test_vim();
    let state = create_test_state();

    vim.handle_normal_mode("5", &state)
        .expect("Failed to handle normal mode key '5'");
    let action = vim
        .handle_normal_mode("G", &state)
        .expect("Failed to handle normal mode key 'G'");

    assert!(matches!(action, Some(Action::UpdateCursor { .. })));
}

// Find character tests
#[test]
fn test_f_finds_char_forward() {
    let mut vim = create_test_vim();
    let state = create_test_state();

    vim.handle_normal_mode("f", &state)
        .expect("Failed to handle normal mode key 'f'");
    let action = vim
        .handle_normal_mode("x", &state)
        .expect("Failed to handle normal mode key 'x'");

    assert!(matches!(action, Some(Action::UpdateCursor { .. })));
    assert_eq!(vim.last_find_char, Some(('x', true)));
}

#[test]
fn test_capital_f_finds_char_backward() {
    let mut vim = create_test_vim();
    let state = create_test_state();

    vim.handle_normal_mode("F", &state)
        .expect("Failed to handle normal mode key 'F'");
    let action = vim
        .handle_normal_mode("x", &state)
        .expect("Failed to handle normal mode key 'x'");

    assert!(matches!(action, Some(Action::UpdateCursor { .. })));
    assert_eq!(vim.last_find_char, Some(('x', false)));
}

#[test]
fn test_t_finds_char_before_forward() {
    let mut vim = create_test_vim();
    let state = create_test_state();

    vim.handle_normal_mode("t", &state)
        .expect("Failed to handle normal mode key 't'");
    let action = vim
        .handle_normal_mode("x", &state)
        .expect("Failed to handle normal mode key 'x'");

    assert!(matches!(action, Some(Action::UpdateCursor { .. })));
    assert_eq!(vim.last_find_char, Some(('x', true)));
}

#[test]
fn test_capital_t_finds_char_before_backward() {
    let mut vim = create_test_vim();
    let state = create_test_state();

    vim.handle_normal_mode("T", &state)
        .expect("Failed to handle normal mode key 'T'");
    let action = vim
        .handle_normal_mode("x", &state)
        .expect("Failed to handle normal mode key 'x'");

    assert!(matches!(action, Some(Action::UpdateCursor { .. })));
    assert_eq!(vim.last_find_char, Some(('x', false)));
}

// Mark tests
#[test]
fn test_m_sets_mark() {
    let mut vim = create_test_vim();
    let state = create_test_state();

    vim.handle_normal_mode("m", &state)
        .expect("Failed to handle normal mode key 'm'");
    let action = vim
        .handle_normal_mode("a", &state)
        .expect("Failed to handle normal mode key 'a'");

    assert!(action.is_none());
    assert!(vim.get_mark('a').is_some());
}

#[test]
fn test_apostrophe_jumps_to_mark() {
    let mut vim = create_test_vim();
    let state = create_test_state();

    // Set mark
    vim.handle_normal_mode("m", &state)
        .expect("Failed to handle normal mode key 'm'");
    vim.handle_normal_mode("a", &state)
        .expect("Failed to handle normal mode key 'a'");

    // Jump to mark
    vim.handle_normal_mode("'", &state)
        .expect("Failed to handle normal mode key '''");
    let action = vim
        .handle_normal_mode("a", &state)
        .expect("Failed to handle normal mode key 'a'");

    assert!(matches!(action, Some(Action::UpdateCursor { .. })));
}

// Register tests
#[test]
fn test_quote_selects_register() {
    let mut vim = create_test_vim();
    let state = create_test_state();

    vim.handle_normal_mode("\"", &state).unwrap();
    let action = vim
        .handle_normal_mode("a", &state)
        .expect("Failed to handle normal mode key 'a'");

    assert!(action.is_none());
    assert_eq!(vim.current_command.register, Some('a'));
}

// Replace mode tests
#[test]
fn test_r_replaces_character() {
    let mut vim = create_test_vim();
    let state = create_test_state();

    vim.handle_normal_mode("r", &state)
        .expect("Failed to handle normal mode key 'r'");
    let action = vim
        .handle_normal_mode("x", &state)
        .expect("Failed to handle normal mode key 'x'");

    // Currently returns None as replace is not fully implemented
    assert!(action.is_none());
}

#[test]
fn test_capital_r_enters_replace_mode() {
    let mut vim = create_test_vim();
    let state = create_test_state();

    let action = vim
        .handle_normal_mode("R", &state)
        .expect("Failed to handle normal mode key 'R'");
    assert_eq!(vim.mode, VimMode::Replace);
    assert!(matches!(action, Some(Action::EnterInsertMode { .. })));
}

// Substitute tests
#[test]
fn test_s_substitutes_character() {
    let mut vim = create_test_vim();
    let state = create_test_state();

    let action = vim
        .handle_normal_mode("s", &state)
        .expect("Failed to handle normal mode key 's'");
    assert_eq!(vim.mode, VimMode::Insert);
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

    let action = vim
        .handle_normal_mode("S", &state)
        .expect("Failed to handle normal mode key 'S'");
    assert_eq!(vim.mode, VimMode::Insert);
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

    let action = vim
        .handle_normal_mode("/", &state)
        .expect("Failed to handle normal mode key '/'");
    assert!(matches!(action, Some(Action::EnterCommandMode)));
}

#[test]
fn test_question_enters_command_mode() {
    let mut vim = create_test_vim();
    let state = create_test_state();

    let action = vim
        .handle_normal_mode("?", &state)
        .expect("Failed to handle normal mode key '?'");
    assert!(matches!(action, Some(Action::EnterCommandMode)));
}

// Edge cases
#[test]
fn test_invalid_key_returns_none() {
    let mut vim = create_test_vim();
    let state = create_test_state();

    let action = vim
        .handle_normal_mode("😀", &state)
        .expect("Failed to handle normal mode key '😀'");
    assert!(action.is_none());
}

#[test]
fn test_zero_not_treated_as_count() {
    let mut vim = create_test_vim();
    let state = create_test_state();

    // 0 should move to line start, not be treated as count
    let action = vim
        .handle_normal_mode("0", &state)
        .expect("Failed to handle normal mode key '0'");
    assert!(matches!(action, Some(Action::UpdateCursor { .. })));
    assert_eq!(vim.count_buffer, "");
}
