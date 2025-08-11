use criterion::{Criterion, criterion_group, criterion_main};
use gridcore_core::{
    formula::parser::FormulaParser,
    types::{cell_address::CellAddress, cell_value::CellValue},
    utils::object_pool::VecPool,
};
use smallvec::SmallVec;
use std::hint::black_box;

fn bench_string_interning(c: &mut Criterion) {
    let mut group = c.benchmark_group("string_interning");

    // Benchmark regular to_string() for cell addresses
    group.bench_function("cell_address_to_string", |b| {
        let addresses: Vec<CellAddress> = (0..100).map(|i| CellAddress::new(i % 26, i)).collect();

        b.iter(|| {
            let mut strings = Vec::with_capacity(100);
            for addr in &addresses {
                strings.push(addr.to_string());
            }
            black_box(strings)
        });
    });

    // Benchmark interned strings
    group.bench_function("cell_address_interned", |b| {
        let addresses: Vec<CellAddress> = (0..100).map(|i| CellAddress::new(i % 26, i)).collect();

        b.iter(|| {
            let mut strings = Vec::with_capacity(100);
            for addr in &addresses {
                strings.push(addr.to_interned_string());
            }
            black_box(strings)
        });
    });

    // Benchmark repeated access to same addresses (should benefit from interning)
    group.bench_function("repeated_address_access", |b| {
        let addresses: Vec<CellAddress> = (0..10).map(|i| CellAddress::new(i % 5, i % 5)).collect();

        b.iter(|| {
            let mut strings = Vec::with_capacity(100);
            // Access same addresses multiple times
            for _ in 0..10 {
                for addr in &addresses {
                    strings.push(addr.to_interned_string());
                }
            }
            black_box(strings)
        });
    });

    group.finish();
}

fn bench_object_pooling(c: &mut Criterion) {
    let mut group = c.benchmark_group("object_pooling");

    // Benchmark Vec allocations without pooling
    group.bench_function("vec_allocation_no_pool", |b| {
        b.iter(|| {
            let mut vecs = Vec::with_capacity(100);
            for _ in 0..100 {
                let mut v: Vec<CellValue> = Vec::with_capacity(100);
                for i in 0..100 {
                    v.push(CellValue::Number(i as f64));
                }
                vecs.push(v);
            }
            black_box(vecs)
        });
    });

    // Benchmark Vec allocations with pooling
    group.bench_function("vec_allocation_with_pool", |b| {
        let pool = VecPool::<CellValue>::new(10, 100);

        b.iter(|| {
            let mut vecs = Vec::with_capacity(100);
            for _ in 0..100 {
                let mut v = pool.get();
                for i in 0..100 {
                    v.push(CellValue::Number(i as f64));
                }
                vecs.push(v.take());
            }
            black_box(vecs)
        });
    });

    // Benchmark reuse pattern (allocate, use, return, repeat)
    group.bench_function("vec_pool_reuse", |b| {
        let pool = VecPool::<CellValue>::new(5, 100);

        b.iter(|| {
            for _ in 0..100 {
                let mut v = pool.get();
                for i in 0..50 {
                    v.push(CellValue::Number(i as f64));
                }
                // v is automatically returned to pool on drop
            }
        });
    });

    group.finish();
}

fn bench_smallvec(c: &mut Criterion) {
    let mut group = c.benchmark_group("smallvec");

    // Benchmark regular Vec for small collections
    group.bench_function("regular_vec_small", |b| {
        b.iter(|| {
            let mut results = Vec::with_capacity(100);
            for _ in 0..100 {
                let mut args: Vec<CellValue> = Vec::with_capacity(3);
                args.push(CellValue::Number(1.0));
                args.push(CellValue::Number(2.0));
                args.push(CellValue::Number(3.0));
                results.push(args);
            }
            black_box(results)
        });
    });

    // Benchmark SmallVec for small collections
    group.bench_function("smallvec_small", |b| {
        b.iter(|| {
            let mut results = Vec::with_capacity(100);
            for _ in 0..100 {
                let mut args: SmallVec<[CellValue; 4]> = SmallVec::with_capacity(3);
                args.push(CellValue::Number(1.0));
                args.push(CellValue::Number(2.0));
                args.push(CellValue::Number(3.0));
                results.push(args);
            }
            black_box(results)
        });
    });

    // Benchmark when exceeding stack capacity (should spill to heap)
    group.bench_function("smallvec_spill", |b| {
        b.iter(|| {
            let mut results = Vec::with_capacity(100);
            for _ in 0..100 {
                let mut args: SmallVec<[CellValue; 4]> = SmallVec::with_capacity(10);
                for i in 0..10 {
                    args.push(CellValue::Number(i as f64));
                }
                results.push(args);
            }
            black_box(results)
        });
    });

    group.finish();
}

fn bench_combined_optimizations(c: &mut Criterion) {
    let mut group = c.benchmark_group("combined");

    // Simulate formula evaluation without optimizations
    group.bench_function("formula_eval_baseline", |b| {
        b.iter(|| {
            let mut results = Vec::new();
            for i in 0..50 {
                // Parse formula
                let formula = format!("=SUM(A{}:D{})", i, i);
                let _ = FormulaParser::parse(&formula);

                // Collect cell addresses
                let mut addresses = Vec::new();
                for col in 0..4 {
                    let addr = CellAddress::new(col, i as u32);
                    addresses.push(addr.to_string());
                }

                // Collect values
                let mut values = Vec::new();
                for _ in 0..4 {
                    values.push(CellValue::Number(i as f64));
                }

                results.push((addresses, values));
            }
            black_box(results)
        });
    });

    // Simulate formula evaluation with all optimizations
    group.bench_function("formula_eval_optimized", |b| {
        let pool = VecPool::<CellValue>::new(10, 100);

        b.iter(|| {
            let mut results = Vec::new();
            for i in 0..50 {
                // Parse formula
                let formula = format!("=SUM(A{}:D{})", i, i);
                let _ = FormulaParser::parse(&formula);

                // Collect cell addresses with interning
                let mut addresses = Vec::with_capacity(4);
                for col in 0..4 {
                    let addr = CellAddress::new(col, i as u32);
                    addresses.push(addr.to_interned_string());
                }

                // Collect values with pooling
                let mut values = pool.get();
                for _ in 0..4 {
                    values.push(CellValue::Number(i as f64));
                }

                results.push((addresses, values.take()));
            }
            black_box(results)
        });
    });

    group.finish();
}

criterion_group!(
    benches,
    bench_string_interning,
    bench_object_pooling,
    bench_smallvec,
    bench_combined_optimizations
);
criterion_main!(benches);
