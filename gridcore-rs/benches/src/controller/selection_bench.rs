use criterion::{BenchmarkId, Criterion, criterion_group, criterion_main};
use gridcore_controller::state::{Selection, SelectionType};
use gridcore_core::types::CellAddress;
use std::hint::black_box;

fn bench_selection_creation(c: &mut Criterion) {
    let mut group = c.benchmark_group("selection_creation");

    for size in [10, 100, 1000].iter() {
        group.bench_with_input(BenchmarkId::new("range", size), size, |b, &range_size| {
            b.iter(|| Selection {
                selection_type: SelectionType::Range {
                    start: CellAddress::new(0, 0),
                    end: CellAddress::new(black_box(range_size), black_box(range_size)),
                },
                anchor: Some(CellAddress::new(0, 0)),
            });
        });

        group.bench_with_input(
            BenchmarkId::new("multiple", size),
            size,
            |b, &num_ranges| {
                b.iter(|| {
                    let mut selections = Vec::with_capacity(num_ranges as usize);
                    for i in 0..num_ranges {
                        selections.push(Selection {
                            selection_type: SelectionType::Range {
                                start: CellAddress::new(i, i),
                                end: CellAddress::new(i + 10, i + 10),
                            },
                            anchor: Some(CellAddress::new(i, i)),
                        });
                    }
                    Selection {
                        selection_type: SelectionType::Multi { selections },
                        anchor: None,
                    }
                });
            },
        );
    }

    group.finish();
}

fn bench_selection_contains(c: &mut Criterion) {
    let mut group = c.benchmark_group("selection_contains");

    for size in [10, 100, 1000].iter() {
        let selection = Selection {
            selection_type: SelectionType::Range {
                start: CellAddress::new(0, 0),
                end: CellAddress::new(*size, *size),
            },
            anchor: Some(CellAddress::new(0, 0)),
        };

        group.bench_with_input(
            BenchmarkId::new("single_range", size),
            &selection,
            |b, sel| {
                b.iter(|| {
                    let addr = CellAddress::new(black_box(size / 2), black_box(size / 2));
                    // Check if address is in range
                    match &sel.selection_type {
                        SelectionType::Range { start, end } => {
                            addr.col >= start.col
                                && addr.col <= end.col
                                && addr.row >= start.row
                                && addr.row <= end.row
                        }
                        _ => false,
                    }
                });
            },
        );
    }

    // Test with multiple ranges
    for num_ranges in [10, 50, 100].iter() {
        let mut selections = Vec::new();
        for i in 0..*num_ranges {
            selections.push(Selection {
                selection_type: SelectionType::Range {
                    start: CellAddress::new(i * 20, i * 20),
                    end: CellAddress::new(i * 20 + 10, i * 20 + 10),
                },
                anchor: Some(CellAddress::new(i * 20, i * 20)),
            });
        }
        let selection = Selection {
            selection_type: SelectionType::Multi { selections },
            anchor: None,
        };

        group.bench_with_input(
            BenchmarkId::new("multiple_ranges", num_ranges),
            &selection,
            |b, sel| {
                b.iter(|| {
                    let addr = CellAddress::new(black_box(25), black_box(25));
                    // Check if address is in any range
                    match &sel.selection_type {
                        SelectionType::Multi { selections } => {
                            selections.iter().any(|s| match &s.selection_type {
                                SelectionType::Range { start, end } => {
                                    addr.col >= start.col
                                        && addr.col <= end.col
                                        && addr.row >= start.row
                                        && addr.row <= end.row
                                }
                                _ => false,
                            })
                        }
                        _ => false,
                    }
                });
            },
        );
    }

    group.finish();
}

fn bench_selection_iteration(c: &mut Criterion) {
    let mut group = c.benchmark_group("selection_iteration");

    for size in [10, 100, 500].iter() {
        let selection = Selection {
            selection_type: SelectionType::Range {
                start: CellAddress::new(0, 0),
                end: CellAddress::new(*size, *size),
            },
            anchor: Some(CellAddress::new(0, 0)),
        };

        group.bench_with_input(BenchmarkId::from_parameter(size), &selection, |b, sel| {
            b.iter(|| {
                let mut count = 0;
                if let SelectionType::Range { start, end } = &sel.selection_type {
                    for row in start.row..=end.row {
                        for col in start.col..=end.col {
                            count += black_box(col + row);
                        }
                    }
                }
                count
            });
        });
    }

    group.finish();
}

fn bench_selection_extend(c: &mut Criterion) {
    let mut group = c.benchmark_group("selection_extend");

    for size in [10, 100, 1000].iter() {
        group.bench_with_input(
            BenchmarkId::from_parameter(size),
            size,
            |b, &extend_size| {
                b.iter(|| {
                    // Create extended selection in one operation
                    Selection {
                        selection_type: SelectionType::Range {
                            start: CellAddress::new(50, 50),
                            end: CellAddress::new(
                                black_box(50 + extend_size),
                                black_box(50 + extend_size),
                            ),
                        },
                        anchor: Some(CellAddress::new(50, 50)),
                    }
                });
            },
        );
    }

    group.finish();
}

fn bench_selection_stats(c: &mut Criterion) {
    let mut group = c.benchmark_group("selection_stats");

    for size in [10, 100, 1000].iter() {
        let selection = Selection {
            selection_type: SelectionType::Range {
                start: CellAddress::new(0, 0),
                end: CellAddress::new(*size, *size),
            },
            anchor: Some(CellAddress::new(0, 0)),
        };

        group.bench_with_input(BenchmarkId::from_parameter(size), &selection, |b, sel| {
            b.iter(|| {
                // Calculate bounds
                match &sel.selection_type {
                    SelectionType::Range { start, end } => (*start, *end),
                    _ => (CellAddress::new(0, 0), CellAddress::new(0, 0)),
                }
            });
        });
    }

    group.finish();
}

criterion_group!(
    benches,
    bench_selection_creation,
    bench_selection_contains,
    bench_selection_iteration,
    bench_selection_extend,
    bench_selection_stats
);
criterion_main!(benches);
