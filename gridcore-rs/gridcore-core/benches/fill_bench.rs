use criterion::{BenchmarkId, Criterion, black_box, criterion_group, criterion_main};
use gridcore_core::domain::Cell;
use gridcore_core::fill::{CellRange, FillDirection, FillEngine, FillOperation, PatternType};
use gridcore_core::repository::CellRepository;
use gridcore_core::types::{CellAddress, CellValue};
use std::rc::Rc;

fn setup_linear_data(size: usize) -> Rc<CellRepository> {
    let mut repo = CellRepository::new();

    // Create a linear sequence
    for i in 0..size {
        let addr = CellAddress::new(0, i as u32);
        let value = CellValue::Number(i as f64);
        repo.set(&addr, Cell::new(value));
    }

    Rc::new(repo)
}

fn setup_exponential_data(size: usize) -> Rc<CellRepository> {
    let mut repo = CellRepository::new();

    // Create an exponential sequence
    let mut value = 1.0;
    for i in 0..size {
        let addr = CellAddress::new(0, i as u32);
        repo.set(&addr, Cell::new(CellValue::Number(value)));
        value *= 2.0;
    }

    Rc::new(repo)
}

fn setup_text_data(size: usize) -> Rc<CellRepository> {
    let mut repo = CellRepository::new();

    // Create a text sequence with numbers
    for i in 0..size {
        let addr = CellAddress::new(0, i as u32);
        let value = CellValue::String(format!("Item {}", i + 1));
        repo.set(&addr, Cell::new(value));
    }

    Rc::new(repo)
}

fn bench_pattern_detection(c: &mut Criterion) {
    let mut group = c.benchmark_group("pattern_detection");

    for size in [10, 100, 1000].iter() {
        group.bench_with_input(BenchmarkId::new("linear", size), size, |b, &size| {
            let repo = setup_linear_data(size);
            let engine = FillEngine::new(repo.clone());

            b.iter(|| {
                let source_range = CellRange::new(
                    CellAddress::new(0, 0),
                    CellAddress::new(0, (size - 1) as u32),
                );
                let target_range = CellRange::new(
                    CellAddress::new(0, size as u32),
                    CellAddress::new(0, (size * 2 - 1) as u32),
                );

                let operation = FillOperation {
                    source_range,
                    target_range,
                    direction: FillDirection::Down,
                    pattern: None, // Let engine detect
                };

                engine.preview(&operation)
            });
        });

        group.bench_with_input(BenchmarkId::new("exponential", size), size, |b, &size| {
            let repo = setup_exponential_data(size);
            let engine = FillEngine::new(repo.clone());

            b.iter(|| {
                let source_range = CellRange::new(
                    CellAddress::new(0, 0),
                    CellAddress::new(0, (size - 1) as u32),
                );
                let target_range = CellRange::new(
                    CellAddress::new(0, size as u32),
                    CellAddress::new(0, (size * 2 - 1) as u32),
                );

                let operation = FillOperation {
                    source_range,
                    target_range,
                    direction: FillDirection::Down,
                    pattern: None, // Let engine detect
                };

                engine.preview(&operation)
            });
        });
    }

    group.finish();
}

fn bench_fill_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("fill_operations");

    for size in [100, 1000, 10000].iter() {
        group.bench_with_input(BenchmarkId::new("linear_fill", size), size, |b, &size| {
            let repo = setup_linear_data(10);
            let engine = FillEngine::new(repo.clone());

            b.iter(|| {
                let source_range = CellRange::new(CellAddress::new(0, 0), CellAddress::new(0, 9));
                let target_range = CellRange::new(
                    CellAddress::new(0, 10),
                    CellAddress::new(0, (10 + size - 1) as u32),
                );

                let operation = FillOperation {
                    source_range,
                    target_range,
                    direction: FillDirection::Down,
                    pattern: Some(PatternType::Linear { slope: 1.0 }),
                };

                black_box(engine.fill(&operation))
            });
        });

        group.bench_with_input(BenchmarkId::new("copy_fill", size), size, |b, &size| {
            let repo = setup_text_data(10);
            let engine = FillEngine::new(repo.clone());

            b.iter(|| {
                let source_range = CellRange::new(CellAddress::new(0, 0), CellAddress::new(0, 9));
                let target_range = CellRange::new(
                    CellAddress::new(0, 10),
                    CellAddress::new(0, (10 + size - 1) as u32),
                );

                let operation = FillOperation {
                    source_range,
                    target_range,
                    direction: FillDirection::Down,
                    pattern: Some(PatternType::Copy),
                };

                black_box(engine.fill(&operation))
            });
        });
    }

    group.finish();
}

fn bench_formula_adjustment(c: &mut Criterion) {
    use gridcore_core::fill::{FormulaAdjuster, adjuster::DefaultFormulaAdjuster};

    let mut group = c.benchmark_group("formula_adjustment");
    let adjuster = DefaultFormulaAdjuster::new();

    let formulas = vec![
        ("simple", "=A1+B1"),
        ("complex", "=SUM(A1:A10)+AVERAGE(B1:B10)*$C$1"),
        ("nested", "=IF(A1>0,SUM(B1:B10),AVERAGE(C1:C10))"),
    ];

    for (name, formula) in formulas {
        group.bench_function(name, |b| {
            let from = CellAddress::new(0, 0);
            let to = CellAddress::new(5, 5);

            b.iter(|| black_box(adjuster.adjust_formula(formula, &from, &to, FillDirection::Down)));
        });
    }

    group.finish();
}

fn bench_large_range_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("large_range_operations");

    group.bench_function("10k_cells_linear", |b| {
        let repo = setup_linear_data(100);
        let engine = FillEngine::new(repo.clone());

        b.iter(|| {
            let source_range = CellRange::new(CellAddress::new(0, 0), CellAddress::new(0, 99));
            let target_range = CellRange::new(CellAddress::new(0, 100), CellAddress::new(0, 10099));

            let operation = FillOperation {
                source_range,
                target_range,
                direction: FillDirection::Down,
                pattern: Some(PatternType::Linear { slope: 1.0 }),
            };

            black_box(engine.preview(&operation))
        });
    });

    group.bench_function("10k_cells_copy", |b| {
        let repo = setup_text_data(100);
        let engine = FillEngine::new(repo.clone());

        b.iter(|| {
            let source_range = CellRange::new(CellAddress::new(0, 0), CellAddress::new(0, 99));
            let target_range = CellRange::new(CellAddress::new(0, 100), CellAddress::new(0, 10099));

            let operation = FillOperation {
                source_range,
                target_range,
                direction: FillDirection::Down,
                pattern: Some(PatternType::Copy),
            };

            black_box(engine.preview(&operation))
        });
    });

    group.finish();
}

criterion_group!(
    benches,
    bench_pattern_detection,
    bench_fill_operations,
    bench_formula_adjustment,
    bench_large_range_operations
);
criterion_main!(benches);
