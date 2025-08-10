use criterion::{BenchmarkId, Criterion, black_box, criterion_group, criterion_main};
use gridcore_core::facade::SpreadsheetFacade;
use gridcore_core::types::CellAddress;
use std::rc::Rc;

/// Create a spreadsheet with a given number of formulas
fn setup_spreadsheet(num_cells: usize) -> Rc<SpreadsheetFacade> {
    let facade = Rc::new(SpreadsheetFacade::new());

    // Add some base values
    for i in 0..10 {
        let addr = CellAddress::new(0, i as u32);
        facade.set_cell_value(&addr, &format!("{}", i * 10)).ok();
    }

    // Add formulas that reference the base values
    for i in 0..num_cells {
        let col = (i % 26) as u32 + 1; // Columns B-Z
        let row = (i / 26) as u32;
        let addr = CellAddress::new(col, row);

        // Create formulas that reference column A
        let formula = format!("=A{} * 2 + 10", row + 1);
        facade.set_cell_value(&addr, &formula).ok();
    }

    facade
}

fn bench_insert_row_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("insert_row_operations");

    for size in [10, 100, 1000].iter() {
        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, &num_cells| {
            b.iter_with_setup(
                || setup_spreadsheet(num_cells),
                |facade| {
                    // Insert a row in the middle
                    let _ = facade.insert_row_without_command(black_box(5));
                },
            );
        });
    }

    group.finish();
}

fn bench_delete_column_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("delete_column_operations");

    for size in [10, 100, 1000].iter() {
        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, &num_cells| {
            b.iter_with_setup(
                || setup_spreadsheet(num_cells),
                |facade| {
                    // Delete column B (index 1)
                    let _ = facade.delete_column_without_command(black_box(1));
                },
            );
        });
    }

    group.finish();
}

fn bench_recalculation_after_structural_change(c: &mut Criterion) {
    let mut group = c.benchmark_group("recalc_after_structural");

    group.bench_function("100_dependent_cells", |b| {
        b.iter_with_setup(
            || {
                let facade = Rc::new(SpreadsheetFacade::new());

                // Create a chain of dependencies
                for i in 0..100 {
                    let addr = CellAddress::new(0, i);
                    if i == 0 {
                        facade.set_cell_value(&addr, "10").ok();
                    } else {
                        let formula = format!("=A{} + 1", i);
                        facade.set_cell_value(&addr, &formula).ok();
                    }
                }

                facade
            },
            |facade| {
                // Insert a row which requires recalculation
                let _ = facade.insert_row_without_command(black_box(50));
                facade.recalculate().ok();
            },
        );
    });

    group.finish();
}

criterion_group!(
    benches,
    bench_insert_row_operations,
    bench_delete_column_operations,
    bench_recalculation_after_structural_change
);
criterion_main!(benches);
