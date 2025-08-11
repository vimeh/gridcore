use criterion::{Criterion, criterion_group, criterion_main};
use gridcore_core::formula::{Expr, FormulaParser, FormulaTransformer};
use gridcore_core::types::CellAddress;
use std::hint::black_box;

fn create_simple_formula() -> Expr {
    FormulaParser::parse("A1 + B2").unwrap()
}

fn create_complex_formula() -> Expr {
    FormulaParser::parse("SUM(A1:A100) + AVERAGE(B1:B50) * COUNT(C1:C20)").unwrap()
}

fn create_nested_formula() -> Expr {
    FormulaParser::parse("IF(A1>10, SUM(B1:B10), AVERAGE(C1:C10) + MAX(D1:D10))").unwrap()
}

fn create_large_range_formula() -> Expr {
    FormulaParser::parse("SUM(A1:Z1000)").unwrap()
}

fn bench_row_insert(c: &mut Criterion) {
    let transformer = FormulaTransformer::new();

    let mut group = c.benchmark_group("row_insert");

    group.bench_function("simple_formula", |b| {
        let ast = create_simple_formula();
        b.iter(|| transformer.adjust_for_row_insert(black_box(ast.clone()), black_box(5)));
    });

    group.bench_function("complex_formula", |b| {
        let ast = create_complex_formula();
        b.iter(|| transformer.adjust_for_row_insert(black_box(ast.clone()), black_box(50)));
    });

    group.bench_function("nested_formula", |b| {
        let ast = create_nested_formula();
        b.iter(|| transformer.adjust_for_row_insert(black_box(ast.clone()), black_box(5)));
    });

    group.bench_function("large_range", |b| {
        let ast = create_large_range_formula();
        b.iter(|| transformer.adjust_for_row_insert(black_box(ast.clone()), black_box(500)));
    });

    group.finish();
}

fn bench_column_delete(c: &mut Criterion) {
    let transformer = FormulaTransformer::new();

    let mut group = c.benchmark_group("column_delete");

    group.bench_function("simple_formula", |b| {
        let ast = create_simple_formula();
        b.iter(|| transformer.adjust_for_column_delete(black_box(ast.clone()), black_box(0)));
    });

    group.bench_function("complex_formula", |b| {
        let ast = create_complex_formula();
        b.iter(|| transformer.adjust_for_column_delete(black_box(ast.clone()), black_box(1)));
    });

    group.finish();
}

fn bench_range_move(c: &mut Criterion) {
    let transformer = FormulaTransformer::new();
    let from_start = CellAddress::new(0, 0);
    let from_end = CellAddress::new(10, 10);
    let to_start = CellAddress::new(20, 20);

    let mut group = c.benchmark_group("range_move");

    group.bench_function("simple_formula", |b| {
        let ast = create_simple_formula();
        b.iter(|| {
            transformer.adjust_for_range_move(
                black_box(ast.clone()),
                black_box(&from_start),
                black_box(&from_end),
                black_box(&to_start),
            )
        });
    });

    group.bench_function("complex_formula", |b| {
        let ast = create_complex_formula();
        b.iter(|| {
            transformer.adjust_for_range_move(
                black_box(ast.clone()),
                black_box(&from_start),
                black_box(&from_end),
                black_box(&to_start),
            )
        });
    });

    group.finish();
}

fn bench_batch_transformations(c: &mut Criterion) {
    let transformer = FormulaTransformer::new();

    c.benchmark_group("batch_transformations")
        .bench_function("100_formulas", |b| {
            let formulas: Vec<Expr> = (0..100)
                .map(|i| FormulaParser::parse(&format!("A{} + B{}", i, i)).unwrap())
                .collect();

            b.iter(|| {
                for formula in &formulas {
                    transformer.adjust_for_row_insert(black_box(formula.clone()), black_box(50));
                }
            });
        })
        .bench_function("1000_formulas", |b| {
            let formulas: Vec<Expr> = (0..1000)
                .map(|i| FormulaParser::parse(&format!("A{} + B{}", i % 100, i % 100)).unwrap())
                .collect();

            b.iter(|| {
                for formula in &formulas {
                    transformer.adjust_for_row_insert(black_box(formula.clone()), black_box(50));
                }
            });
        });
}

fn bench_shift_references(c: &mut Criterion) {
    let transformer = FormulaTransformer::new();

    c.benchmark_group("shift_references")
        .bench_function("simple_shift", |b| {
            let ast = create_simple_formula();
            b.iter(|| {
                transformer.shift_references(black_box(ast.clone()), black_box(10), black_box(5))
            });
        })
        .bench_function("large_shift", |b| {
            let ast = create_complex_formula();
            b.iter(|| {
                transformer.shift_references(black_box(ast.clone()), black_box(100), black_box(50))
            });
        });
}

criterion_group!(
    benches,
    bench_row_insert,
    bench_column_delete,
    bench_range_move,
    bench_batch_transformations,
    bench_shift_references
);
criterion_main!(benches);
