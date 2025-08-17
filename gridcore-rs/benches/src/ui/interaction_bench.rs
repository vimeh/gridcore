//! UI interaction benchmarks
//! These benchmarks test mouse and keyboard interaction handling in WASM context

#[cfg(target_arch = "wasm32")]
use wasm_bindgen_test::*;

#[cfg(target_arch = "wasm32")]
use gridcore_controller::controller::SpreadsheetController;
#[cfg(target_arch = "wasm32")]
use gridcore_ui::interaction::{KeyboardHandler, MouseHandler};
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::JsCast;
#[cfg(target_arch = "wasm32")]
use web_sys::{KeyboardEvent, MouseEvent, window};

#[cfg(target_arch = "wasm32")]
wasm_bindgen_test_configure!(run_in_browser);

#[cfg(target_arch = "wasm32")]
fn create_mouse_event(x: i32, y: i32, button: i16) -> MouseEvent {
    let event = MouseEvent::new("click").unwrap();
    // Note: These are readonly properties in real MouseEvent,
    // so we'd need to use js_sys for proper event creation
    event
}

#[cfg(target_arch = "wasm32")]
fn create_keyboard_event(key: &str, ctrl: bool, shift: bool) -> KeyboardEvent {
    let mut init = web_sys::KeyboardEventInit::new();
    init.key(key);
    init.ctrl_key(ctrl);
    init.shift_key(shift);

    KeyboardEvent::new_with_keyboard_event_init_dict("keydown", &init).unwrap()
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen_test]
fn bench_mouse_click_handling() {
    let controller = SpreadsheetController::new();
    let handler = MouseHandler::new(controller);

    let start = window().unwrap().performance().unwrap().now();

    for i in 0..1000 {
        let event = create_mouse_event((i % 100) * 10, (i / 100) * 24, 0);
        handler.handle_click(&event);
    }

    let elapsed = window().unwrap().performance().unwrap().now() - start;
    web_sys::console::log_1(
        &format!("Mouse click handling (1000 events): {:.2}ms", elapsed).into(),
    );
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen_test]
fn bench_mouse_drag_handling() {
    let controller = SpreadsheetController::new();
    let handler = MouseHandler::new(controller);

    let start = window().unwrap().performance().unwrap().now();

    // Simulate drag operation
    handler.start_drag(100, 100);
    for i in 0..500 {
        handler.update_drag(100 + i * 2, 100 + i);
    }
    handler.end_drag();

    let elapsed = window().unwrap().performance().unwrap().now() - start;
    web_sys::console::log_1(&format!("Mouse drag handling (500 moves): {:.2}ms", elapsed).into());
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen_test]
fn bench_keyboard_navigation() {
    let controller = SpreadsheetController::new();
    let handler = KeyboardHandler::new(controller);

    let keys = vec!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"];

    let start = window().unwrap().performance().unwrap().now();

    for i in 0..1000 {
        let key = keys[i % 4];
        let event = create_keyboard_event(key, false, false);
        handler.handle_keydown(&event);
    }

    let elapsed = window().unwrap().performance().unwrap().now() - start;
    web_sys::console::log_1(&format!("Keyboard navigation (1000 keys): {:.2}ms", elapsed).into());
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen_test]
fn bench_keyboard_shortcuts() {
    let controller = SpreadsheetController::new();
    let handler = KeyboardHandler::new(controller);

    let shortcuts = vec![
        ("c", true, false), // Ctrl+C
        ("v", true, false), // Ctrl+V
        ("z", true, false), // Ctrl+Z
        ("y", true, false), // Ctrl+Y
        ("a", true, false), // Ctrl+A
    ];

    let start = window().unwrap().performance().unwrap().now();

    for _ in 0..200 {
        for (key, ctrl, shift) in &shortcuts {
            let event = create_keyboard_event(key, *ctrl, *shift);
            handler.handle_keydown(&event);
        }
    }

    let elapsed = window().unwrap().performance().unwrap().now() - start;
    web_sys::console::log_1(
        &format!("Keyboard shortcuts (1000 shortcuts): {:.2}ms", elapsed).into(),
    );
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen_test]
fn bench_text_input() {
    let controller = SpreadsheetController::new();
    let handler = KeyboardHandler::new(controller);

    let text = "The quick brown fox jumps over the lazy dog";

    let start = window().unwrap().performance().unwrap().now();

    for _ in 0..100 {
        for ch in text.chars() {
            let event = create_keyboard_event(&ch.to_string(), false, false);
            handler.handle_keypress(&event);
        }
    }

    let elapsed = window().unwrap().performance().unwrap().now() - start;
    web_sys::console::log_1(
        &format!("Text input handling (100 sentences): {:.2}ms", elapsed).into(),
    );
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen_test]
fn bench_wheel_scroll() {
    let controller = SpreadsheetController::new();
    let handler = MouseHandler::new(controller);

    let start = window().unwrap().performance().unwrap().now();

    for i in 0..500 {
        handler.handle_wheel(0.0, (i as f64) * 10.0);
    }

    let elapsed = window().unwrap().performance().unwrap().now() - start;
    web_sys::console::log_1(
        &format!("Wheel scroll handling (500 events): {:.2}ms", elapsed).into(),
    );
}

// Provide stub implementations for non-WASM builds
#[cfg(not(target_arch = "wasm32"))]
pub fn run_benchmarks() {
    println!(
        "UI interaction benchmarks can only run in WASM context. Use wasm-pack test to run these benchmarks."
    );
}
