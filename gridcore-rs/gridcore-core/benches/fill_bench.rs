use criterion::{BenchmarkId, Criterion, criterion_group, criterion_main};
use std::hint::black_box;
use gridcore_core::adapters::RepositoryAdapter;
use gridcore_core::domain::Cell;
use gridcore_core::fill::{CellRange, FillDirection, FillEngine, FillOperation, PatternType};
use gridcore_core::ports::RepositoryPort;
use gridcore_core::types::{CellAddress, CellValue};
use std::sync::Arc;

fn setup_linear_data(size: usize) -> Arc<dyn RepositoryPort> {
    let repo = Arc::new(RepositoryAdapter::new_empty());

    // Create a linear sequence
    for i in 0..size {
        let addr = CellAddress::new(0, i as u32);
        let value = CellValue::Number(i as f64);
        let _ = repo.set(&addr, Cell::new(value));
    }

    repo
}

fn setup_exponential_data(size: usize) -> Arc<dyn RepositoryPort> {
    let repo = Arc::new(RepositoryAdapter::new_empty());

    // Create an exponential sequence
    let mut value = 1.0;
    for i in 0..size {
        let addr = CellAddress::new(0, i as u32);
        let _ = repo.set(&addr, Cell::new(CellValue::Number(value)));
        value *= 2.0;
    }

    repo
}

fn setup_text_data(size: usize) -> Arc<dyn RepositoryPort> {
    let repo = Arc::new(RepositoryAdapter::new_empty());

    // Create a text sequence with numbers
    for i in 0..size {
        let addr = CellAddress::new(0, i as u32);
        let value = CellValue::String(format!("Item {}", i + 1));
        let _ = repo.set(&addr, Cell::new(value));
    }

    repo
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

    for size in [10, 50, 100].iter() {
        group.bench_with_input(
            BenchmarkId::new("linear_fill", size),
            size,
            |b, &source_size| {
                let repo = setup_linear_data(source_size);
                let engine = FillEngine::new(repo.clone());

                b.iter(|| {
                    let source_range = CellRange::new(
                        CellAddress::new(0, 0),
                        CellAddress::new(0, (source_size - 1) as u32),
                    );
                    let target_range = CellRange::new(
                        CellAddress::new(0, source_size as u32),
                        CellAddress::new(0, (source_size * 5 - 1) as u32),
                    );

                    let operation = FillOperation {
                        source_range,
                        target_range,
                        direction: FillDirection::Down,
                        pattern: Some(PatternType::Linear { slope: 1.0 }),
                    };

                    engine.fill(&operation)
                });
            },
        );

        group.bench_with_input(
            BenchmarkId::new("exponential_fill", size),
            size,
            |b, &source_size| {
                let repo = setup_exponential_data(source_size);
                let engine = FillEngine::new(repo.clone());

                b.iter(|| {
                    let source_range = CellRange::new(
                        CellAddress::new(0, 0),
                        CellAddress::new(0, (source_size - 1) as u32),
                    );
                    let target_range = CellRange::new(
                        CellAddress::new(0, source_size as u32),
                        CellAddress::new(0, (source_size * 3 - 1) as u32),
                    );

                    let operation = FillOperation {
                        source_range,
                        target_range,
                        direction: FillDirection::Down,
                        pattern: Some(PatternType::Exponential { rate: 2.0 }),
                    };

                    engine.fill(&operation)
                });
            },
        );

        group.bench_with_input(
            BenchmarkId::new("copy_fill", size),
            size,
            |b, &source_size| {
                let repo = setup_text_data(source_size);
                let engine = FillEngine::new(repo.clone());

                b.iter(|| {
                    let source_range = CellRange::new(
                        CellAddress::new(0, 0),
                        CellAddress::new(0, (source_size - 1) as u32),
                    );
                    let target_range = CellRange::new(
                        CellAddress::new(0, source_size as u32),
                        CellAddress::new(0, (source_size * 10 - 1) as u32),
                    );

                    let operation = FillOperation {
                        source_range,
                        target_range,
                        direction: FillDirection::Down,
                        pattern: Some(PatternType::Copy),
                    };

                    engine.fill(&operation)
                });
            },
        );
    }

    group.finish();
}

fn bench_large_fill_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("large_fill_operations");
    group.sample_size(10); // Reduce sample size for large operations

    group.bench_function("fill_10000_cells", |b| {
        let repo = setup_linear_data(100);
        let engine = FillEngine::new(repo.clone());

        b.iter(|| {
            let source_range = CellRange::new(CellAddress::new(0, 0), CellAddress::new(0, 99));
            let target_range =
                CellRange::new(CellAddress::new(0, 100), CellAddress::new(0, 9999));

            let operation = FillOperation {
                source_range,
                target_range,
                direction: FillDirection::Down,
                pattern: Some(PatternType::Linear { slope: 1.0 }),
            };

            black_box(engine.fill(&operation))
        });
    });

    group.finish();
}

criterion_group!(
    benches,
    bench_pattern_detection,
    bench_fill_operations,
    bench_large_fill_operations
);
criterion_main!(benches);