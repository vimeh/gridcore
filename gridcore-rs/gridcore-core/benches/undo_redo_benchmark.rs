use criterion::{Criterion, criterion_group, criterion_main};
use std::hint::black_box;
use gridcore_core::facade::SpreadsheetFacade;
use gridcore_core::types::CellAddress;

fn benchmark_simple_cell_operations(c: &mut Criterion) {
    c.bench_function("set_and_get_cell_value", |b| {
        let facade = SpreadsheetFacade::new();
        let addr = CellAddress::new(0, 0);

        b.iter(|| {
            // Set a value
            facade.set_cell_value(&addr, "42").unwrap();

            // Get the value
            let _ = black_box(facade.get_cell_value(&addr));
        });
    });
}

fn benchmark_formula_evaluation(c: &mut Criterion) {
    c.bench_function("formula_evaluation_10_cells", |b| {
        let facade = SpreadsheetFacade::new();

        b.iter(|| {
            // Set base values
            for i in 0..10 {
                let addr = CellAddress::new(0, i);
                facade.set_cell_value(&addr, &format!("{}", i)).unwrap();
            }

            // Set formulas that reference base values
            for i in 0..10 {
                let addr = CellAddress::new(1, i);
                facade
                    .set_cell_value(&addr, &format!("=A{} * 2", i + 1))
                    .unwrap();
            }

            black_box(facade.cell_count());
        });
    });
}

fn benchmark_bulk_operations(c: &mut Criterion) {
    c.bench_function("bulk_set_100_cells", |b| {
        let facade = SpreadsheetFacade::new();

        b.iter(|| {
            // Perform 100 set operations
            for i in 0..100 {
                let addr = CellAddress::new(i % 10, i / 10);
                facade.set_cell_value(&addr, &format!("{}", i)).unwrap();
            }

            black_box(facade.cell_count());
        });
    });
}

criterion_group!(
    benches,
    benchmark_simple_cell_operations,
    benchmark_formula_evaluation,
    benchmark_bulk_operations
);
criterion_main!(benches);
