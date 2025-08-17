use criterion::{BenchmarkId, Criterion, criterion_group, criterion_main};
use gridcore_controller::controller::events::{
    KeyboardEvent, MouseButton, MouseEvent, MouseEventType,
};
use gridcore_controller::controller::{GridConfiguration, SpreadsheetController};
use gridcore_core::types::CellAddress;
use std::hint::black_box;

fn setup_controller(rows: usize, cols: usize) -> SpreadsheetController {
    let config = GridConfiguration {
        total_rows: rows,
        total_cols: cols,
        ..Default::default()
    };
    SpreadsheetController::with_config(config)
}

fn bench_keyboard_events(c: &mut Criterion) {
    let mut group = c.benchmark_group("keyboard_events");

    let events = vec![
        (
            "arrow_key",
            KeyboardEvent {
                key: "ArrowDown".to_string(),
                code: "ArrowDown".to_string(),
                ctrl: false,
                shift: false,
                alt: false,
                meta: false,
            },
        ),
        (
            "with_modifiers",
            KeyboardEvent {
                key: "c".to_string(),
                code: "KeyC".to_string(),
                ctrl: true,
                shift: false,
                alt: false,
                meta: false,
            },
        ),
        (
            "tab",
            KeyboardEvent {
                key: "Tab".to_string(),
                code: "Tab".to_string(),
                ctrl: false,
                shift: false,
                alt: false,
                meta: false,
            },
        ),
        (
            "enter",
            KeyboardEvent {
                key: "Enter".to_string(),
                code: "Enter".to_string(),
                ctrl: false,
                shift: false,
                alt: false,
                meta: false,
            },
        ),
        (
            "escape",
            KeyboardEvent {
                key: "Escape".to_string(),
                code: "Escape".to_string(),
                ctrl: false,
                shift: false,
                alt: false,
                meta: false,
            },
        ),
    ];

    for (name, event) in events {
        group.bench_with_input(BenchmarkId::from_parameter(name), &event, |b, evt| {
            let mut controller = setup_controller(1000, 100);
            b.iter(|| {
                let _ = controller.handle_keyboard_event(black_box(evt.clone()));
            });
        });
    }

    group.finish();
}

fn bench_mouse_events(c: &mut Criterion) {
    let mut group = c.benchmark_group("mouse_events");

    let events = vec![
        (
            "click",
            MouseEvent {
                x: 100.0,
                y: 100.0,
                button: MouseButton::Left,
                event_type: MouseEventType::Click,
                ctrl: false,
                shift: false,
                alt: false,
                meta: false,
            },
        ),
        (
            "drag",
            MouseEvent {
                x: 200.0,
                y: 200.0,
                button: MouseButton::Left,
                event_type: MouseEventType::Move,
                ctrl: false,
                shift: false,
                alt: false,
                meta: false,
            },
        ),
        (
            "double_click",
            MouseEvent {
                x: 150.0,
                y: 150.0,
                button: MouseButton::Left,
                event_type: MouseEventType::DoubleClick,
                ctrl: false,
                shift: false,
                alt: false,
                meta: false,
            },
        ),
        (
            "right_click",
            MouseEvent {
                x: 100.0,
                y: 100.0,
                button: MouseButton::Right,
                event_type: MouseEventType::Click,
                ctrl: false,
                shift: false,
                alt: false,
                meta: false,
            },
        ),
    ];

    for (name, event) in events {
        group.bench_with_input(BenchmarkId::from_parameter(name), &event, |b, evt| {
            let mut controller = setup_controller(1000, 100);
            b.iter(|| controller.handle_mouse_event(black_box(evt.clone())));
        });
    }

    group.finish();
}

fn bench_event_dispatch(c: &mut Criterion) {
    let mut group = c.benchmark_group("event_dispatch");

    for num_cells in [10, 100, 1000].iter() {
        group.bench_with_input(
            BenchmarkId::from_parameter(num_cells),
            num_cells,
            |b, &cells| {
                let mut controller = setup_controller(1000, 100);

                b.iter(|| {
                    // Navigate to cells and input values which triggers events
                    for i in 0..cells {
                        let addr = CellAddress::new(i % 100, i / 100);
                        controller.set_cursor(addr);
                        controller.set_formula_bar_value(format!("val{}", i));
                        controller.complete_editing().ok();
                    }
                });
            },
        );
    }

    group.finish();
}

fn bench_bulk_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("bulk_operations");

    for num_operations in [10, 100, 1000].iter() {
        group.bench_with_input(
            BenchmarkId::new("keyboard_sequence", num_operations),
            num_operations,
            |b, &ops| {
                b.iter_with_setup(
                    || setup_controller(1000, 100),
                    |mut controller| {
                        for i in 0..ops {
                            let key = if i % 4 == 0 {
                                "ArrowDown"
                            } else if i % 4 == 1 {
                                "ArrowRight"
                            } else if i % 4 == 2 {
                                "ArrowUp"
                            } else {
                                "ArrowLeft"
                            };
                            let event = KeyboardEvent {
                                key: key.to_string(),
                                code: key.to_string(),
                                ctrl: false,
                                shift: false,
                                alt: false,
                                meta: false,
                            };
                            let _ = controller.handle_keyboard_event(black_box(event));
                        }
                    },
                );
            },
        );

        group.bench_with_input(
            BenchmarkId::new("mouse_sequence", num_operations),
            num_operations,
            |b, &ops| {
                b.iter_with_setup(
                    || setup_controller(1000, 100),
                    |mut controller| {
                        for i in 0..ops {
                            let event = MouseEvent {
                                x: (i as f64 * 10.0) % 800.0,
                                y: (i as f64 * 10.0) % 600.0,
                                button: MouseButton::Left,
                                event_type: if i % 2 == 0 {
                                    MouseEventType::Click
                                } else {
                                    MouseEventType::Move
                                },
                                ctrl: false,
                                shift: false,
                                alt: false,
                                meta: false,
                            };
                            let _ = controller.handle_mouse_event(black_box(event));
                        }
                    },
                );
            },
        );
    }

    group.finish();
}

fn bench_copy_paste(c: &mut Criterion) {
    let mut group = c.benchmark_group("copy_paste");

    for size in [10, 100, 1000].iter() {
        group.bench_with_input(BenchmarkId::new("copy", size), size, |b, &cell_count| {
            let mut controller = setup_controller(1000, 100);

            // Setup: Set some data
            for i in 0..cell_count {
                let addr = CellAddress::new(i, i);
                controller.set_cursor(addr);
                controller.set_formula_bar_value(format!("value{}", i));
                controller.complete_editing().ok();
            }

            b.iter(|| {
                // Simulate copy operation
                let _ = controller.handle_keyboard_event(KeyboardEvent {
                    key: "c".to_string(),
                    code: "KeyC".to_string(),
                    ctrl: true,
                    shift: false,
                    alt: false,
                    meta: false,
                });
            });
        });

        group.bench_with_input(BenchmarkId::new("paste", size), size, |b, &cell_count| {
            let mut controller = setup_controller(1000, 100);

            // Setup: Set some data
            for i in 0..cell_count {
                let addr = CellAddress::new(i, i);
                controller.set_cursor(addr);
                controller.set_formula_bar_value(format!("value{}", i));
                controller.complete_editing().ok();
            }

            // Copy
            let _ = controller.handle_keyboard_event(KeyboardEvent {
                key: "c".to_string(),
                code: "KeyC".to_string(),
                ctrl: true,
                shift: false,
                alt: false,
                meta: false,
            });

            b.iter(|| {
                // Simulate paste operation
                let _ = controller.handle_keyboard_event(KeyboardEvent {
                    key: "v".to_string(),
                    code: "KeyV".to_string(),
                    ctrl: true,
                    shift: false,
                    alt: false,
                    meta: false,
                });
            });
        });
    }

    group.finish();
}

criterion_group!(
    benches,
    bench_keyboard_events,
    bench_mouse_events,
    bench_event_dispatch,
    bench_bulk_operations,
    bench_copy_paste
);
criterion_main!(benches);
