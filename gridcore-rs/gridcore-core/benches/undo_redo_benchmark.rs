use criterion::{Criterion, black_box, criterion_group, criterion_main};
use gridcore_core::facade::SpreadsheetFacade;
use gridcore_core::types::CellAddress;

fn benchmark_single_undo_redo(c: &mut Criterion) {
    c.bench_function("single_undo_redo", |b| {
        let facade = SpreadsheetFacade::new();
        let addr = CellAddress::new(0, 0);

        b.iter(|| {
            // Set a value
            facade.set_cell_value(&addr, "42").unwrap();

            // Undo
            facade.undo().unwrap();

            // Redo
            facade.redo().unwrap();

            black_box(facade.get_cell_value(&addr));
        });
    });
}

fn benchmark_batch_undo_redo(c: &mut Criterion) {
    c.bench_function("batch_undo_redo_10_cells", |b| {
        let facade = SpreadsheetFacade::new();

        b.iter(|| {
            // Set multiple values in a batch
            let batch_id = facade.begin_batch(None);
            for i in 0..10 {
                let addr = CellAddress::new(i, 0);
                facade.set_cell_value(&addr, &format!("{}", i)).unwrap();
            }
            facade.commit_batch(&batch_id).unwrap();

            // Undo the batch
            facade.undo().unwrap();

            // Redo the batch
            facade.redo().unwrap();

            black_box(facade.get_cell_count());
        });
    });
}

fn benchmark_deep_undo_stack(c: &mut Criterion) {
    c.bench_function("deep_undo_stack_100_operations", |b| {
        b.iter_batched(
            || {
                let facade = SpreadsheetFacade::new();
                // Build up a history of 100 operations
                for i in 0..100 {
                    let addr = CellAddress::new(i % 10, i / 10);
                    facade.set_cell_value(&addr, &format!("{}", i)).unwrap();
                }
                facade
            },
            |facade| {
                // Undo 50 operations
                for _ in 0..50 {
                    facade.undo().unwrap();
                }

                // Redo 25 operations
                for _ in 0..25 {
                    facade.redo().unwrap();
                }

                black_box(facade.can_undo());
                black_box(facade.can_redo());
            },
            criterion::BatchSize::SmallInput,
        );
    });
}

fn benchmark_undo_redo_with_formulas(c: &mut Criterion) {
    c.bench_function("undo_redo_with_formulas", |b| {
        let facade = SpreadsheetFacade::new();

        b.iter(|| {
            // Set up cells with formulas
            let a1 = CellAddress::new(0, 0);
            let b1 = CellAddress::new(1, 0);
            let c1 = CellAddress::new(2, 0);

            facade.set_cell_value(&a1, "10").unwrap();
            facade.set_cell_value(&b1, "20").unwrap();
            facade.set_cell_value(&c1, "=A1+B1").unwrap();

            // Change a dependency
            facade.set_cell_value(&a1, "15").unwrap();

            // Undo the change
            facade.undo().unwrap();

            // Redo the change
            facade.redo().unwrap();

            black_box(facade.get_cell_value(&c1));
        });
    });
}

fn benchmark_row_column_operations(c: &mut Criterion) {
    c.bench_function("row_column_undo_redo", |b| {
        b.iter_batched(
            || {
                let facade = SpreadsheetFacade::new();
                // Set up some initial data
                for i in 0..5 {
                    for j in 0..5 {
                        let addr = CellAddress::new(i, j);
                        facade
                            .set_cell_value(&addr, &format!("{},{}", i, j))
                            .unwrap();
                    }
                }
                facade
            },
            |facade| {
                // Insert row
                facade.insert_row(2).unwrap();

                // Insert column
                facade.insert_column(3).unwrap();

                // Undo both operations
                facade.undo().unwrap();
                facade.undo().unwrap();

                // Redo one operation
                facade.redo().unwrap();

                black_box(facade.get_cell_count());
            },
            criterion::BatchSize::SmallInput,
        );
    });
}

fn benchmark_history_size(c: &mut Criterion) {
    let mut group = c.benchmark_group("history_size_impact");

    for size in [10, 50, 100, 500].iter() {
        group.bench_function(format!("history_size_{}", size), |b| {
            b.iter_batched(
                || {
                    let facade = SpreadsheetFacade::new();
                    // Build up a history
                    for i in 0..*size {
                        let addr = CellAddress::new(i % 100, i / 100);
                        facade.set_cell_value(&addr, &format!("{}", i)).unwrap();
                    }
                    facade
                },
                |facade| {
                    // Perform a new operation (should potentially trim history)
                    let addr = CellAddress::new(99, 99);
                    facade.set_cell_value(&addr, "new_value").unwrap();

                    black_box(facade.get_undo_history().len());
                },
                criterion::BatchSize::SmallInput,
            );
        });
    }

    group.finish();
}

criterion_group!(
    benches,
    benchmark_single_undo_redo,
    benchmark_batch_undo_redo,
    benchmark_deep_undo_stack,
    benchmark_undo_redo_with_formulas,
    benchmark_row_column_operations,
    benchmark_history_size
);

criterion_main!(benches);
