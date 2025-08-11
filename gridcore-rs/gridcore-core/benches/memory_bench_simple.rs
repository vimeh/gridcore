use criterion::{Criterion, criterion_group, criterion_main};
use gridcore_core::{
    domain::cell::Cell,
    formula::parser::FormulaParser,
    repository::cell_repository::CellRepository,
    types::{cell_address::CellAddress, cell_value::CellValue},
};
use std::collections::HashMap;
use std::hint::black_box;

fn bench_cell_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("cell_operations");

    group.bench_function("create_1000_cells", |b| {
        b.iter(|| {
            let cells: Vec<Cell> = (0..1000)
                .map(|i| Cell::new(CellValue::Number(i as f64)))
                .collect();
            black_box(cells)
        });
    });

    group.bench_function("clone_100_cells", |b| {
        let cells: Vec<Cell> = (0..100)
            .map(|i| Cell::new(CellValue::Number(i as f64)))
            .collect();

        b.iter(|| {
            let cloned: Vec<Cell> = cells.iter().cloned().collect();
            black_box(cloned)
        });
    });

    group.finish();
}

fn bench_formula_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("formula_operations");

    let formulas = vec![
        "=A1+B2",
        "=SUM(A1:A100)",
        "=IF(A1>10,B1*2,C1/3)",
        "=VLOOKUP(A1,B:D,2,FALSE)",
        "=A1+B1+C1+D1+E1+F1+G1+H1",
    ];

    group.bench_function("parse_formulas", |b| {
        b.iter(|| {
            for formula in &formulas {
                for _ in 0..20 {
                    let _ = FormulaParser::parse(formula);
                }
            }
        });
    });

    group.finish();
}

fn bench_repository_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("repository");

    group.bench_function("insert_10k_cells", |b| {
        b.iter(|| {
            let mut repo = CellRepository::new();
            for i in 0..100 {
                for j in 0..100 {
                    let addr = CellAddress::new(j, i);
                    let cell = Cell::new(CellValue::Number((i * 100 + j) as f64));
                    repo.set(&addr, cell);
                }
            }
            black_box(repo)
        });
    });

    group.finish();
}

fn bench_string_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("strings");

    group.bench_function("address_to_string", |b| {
        b.iter(|| {
            let mut strings = Vec::with_capacity(1000);
            for i in 0..100 {
                for j in 0..10 {
                    let addr = CellAddress::new(j, i);
                    strings.push(addr.to_string());
                }
            }
            black_box(strings)
        });
    });

    group.finish();
}

fn bench_collection_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("collections");

    // Compare HashMap vs FxHashMap
    group.bench_function("std_hashmap_small", |b| {
        b.iter(|| {
            let mut map = HashMap::new();
            for i in 0..10 {
                map.insert(i, format!("value_{}", i));
            }
            for i in 0..10 {
                let _ = map.get(&i);
            }
            black_box(map)
        });
    });

    group.bench_function("fx_hashmap_small", |b| {
        use rustc_hash::FxHashMap;
        b.iter(|| {
            let mut map = FxHashMap::default();
            for i in 0..10 {
                map.insert(i, format!("value_{}", i));
            }
            for i in 0..10 {
                let _ = map.get(&i);
            }
            black_box(map)
        });
    });

    // Compare Vec with and without capacity
    group.bench_function("vec_no_capacity", |b| {
        b.iter(|| {
            let mut v = Vec::new();
            for i in 0..100 {
                v.push(i);
            }
            black_box(v)
        });
    });

    group.bench_function("vec_with_capacity", |b| {
        b.iter(|| {
            let mut v = Vec::with_capacity(100);
            for i in 0..100 {
                v.push(i);
            }
            black_box(v)
        });
    });

    group.finish();
}

criterion_group!(
    benches,
    bench_cell_operations,
    bench_formula_operations,
    bench_repository_operations,
    bench_string_operations,
    bench_collection_operations
);
criterion_main!(benches);
