use super::cell_vim::*;
use crate::state::{Action, CellMode, InsertMode, VisualMode};

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
