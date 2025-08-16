use criterion::{Criterion, criterion_group, criterion_main};
use gridcore_core::{
    domain::cell::Cell,
    formula::parser::FormulaParser,
    repository::cell_repository::CellRepository,
    types::{cell_address::CellAddress, cell_value::CellValue},
};
use std::alloc::{GlobalAlloc, Layout, System};
use std::hint::black_box;
use std::sync::atomic::{AtomicUsize, Ordering};

static ALLOCATIONS: AtomicUsize = AtomicUsize::new(0);
static DEALLOCATIONS: AtomicUsize = AtomicUsize::new(0);
static BYTES_ALLOCATED: AtomicUsize = AtomicUsize::new(0);

struct TrackingAllocator;

unsafe impl GlobalAlloc for TrackingAllocator {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        ALLOCATIONS.fetch_add(1, Ordering::Relaxed);
        BYTES_ALLOCATED.fetch_add(layout.size(), Ordering::Relaxed);
        unsafe { System.alloc(layout) }
    }

    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        DEALLOCATIONS.fetch_add(1, Ordering::Relaxed);
        unsafe { System.dealloc(ptr, layout) }
    }
}

#[global_allocator]
static GLOBAL: TrackingAllocator = TrackingAllocator;

fn reset_metrics() {
    ALLOCATIONS.store(0, Ordering::Relaxed);
    DEALLOCATIONS.store(0, Ordering::Relaxed);
    BYTES_ALLOCATED.store(0, Ordering::Relaxed);
}

fn get_metrics() -> (usize, usize, usize) {
    (
        ALLOCATIONS.load(Ordering::Relaxed),
        DEALLOCATIONS.load(Ordering::Relaxed),
        BYTES_ALLOCATED.load(Ordering::Relaxed),
    )
}

fn bench_cell_creation(c: &mut Criterion) {
    c.bench_function("cell_creation", |b| {
        b.iter(|| {
            reset_metrics();
            let cells: Vec<Cell> = (0..1000)
                .map(|i| Cell::new(CellValue::Number(i as f64)))
                .collect();
            let (allocs, deallocs, bytes) = get_metrics();
            black_box((cells, allocs, deallocs, bytes))
        });
    });
}

fn bench_cell_cloning(c: &mut Criterion) {
    let cells: Vec<Cell> = (0..100)
        .map(|i| Cell::new(CellValue::Number(i as f64)))
        .collect();

    c.bench_function("cell_cloning", |b| {
        b.iter(|| {
            reset_metrics();
            let cloned: Vec<Cell> = cells.to_vec();
            let (allocs, deallocs, bytes) = get_metrics();
            black_box((cloned, allocs, deallocs, bytes))
        });
    });
}

fn bench_formula_parsing(c: &mut Criterion) {
    let formulas = vec![
        "=A1+B2",
        "=SUM(A1:A100)",
        "=IF(A1>10,B1*2,C1/3)",
        "=VLOOKUP(A1,B:D,2,FALSE)",
        "=A1+B1+C1+D1+E1+F1+G1+H1",
    ];

    c.bench_function("formula_parsing", |b| {
        b.iter(|| {
            reset_metrics();
            for formula in &formulas {
                for _ in 0..100 {
                    let _ = FormulaParser::parse(formula);
                }
            }
            let (allocs, deallocs, bytes) = get_metrics();
            black_box((allocs, deallocs, bytes))
        });
    });
}

fn bench_cell_repository_operations(c: &mut Criterion) {
    c.bench_function("repository_batch_insert", |b| {
        b.iter(|| {
            reset_metrics();
            let mut repo = CellRepository::new();
            for i in 0..100 {
                for j in 0..100 {
                    let addr = CellAddress::new(j, i);
                    let cell = Cell::new(CellValue::Number((i * 100 + j) as f64));
                    repo.set(&addr, cell);
                }
            }
            let (allocs, deallocs, bytes) = get_metrics();
            black_box((repo, allocs, deallocs, bytes))
        });
    });
}

fn bench_string_operations(c: &mut Criterion) {
    c.bench_function("address_to_string_conversions", |b| {
        b.iter(|| {
            reset_metrics();
            let mut strings = Vec::with_capacity(10000);
            for i in 0..100 {
                for j in 0..100 {
                    let addr = CellAddress::new(j, i);
                    strings.push(addr.to_string());
                }
            }
            let (allocs, deallocs, bytes) = get_metrics();
            black_box((strings, allocs, deallocs, bytes))
        });
    });
}

fn bench_hashmap_operations(c: &mut Criterion) {
    use std::collections::HashMap;

    c.bench_function("small_hashmap_operations", |b| {
        b.iter(|| {
            reset_metrics();
            let mut maps = Vec::new();
            for _ in 0..100 {
                let mut map = HashMap::new();
                for i in 0..10 {
                    map.insert(format!("key{}", i), i);
                }
                maps.push(map);
            }
            let (allocs, deallocs, bytes) = get_metrics();
            black_box((maps, allocs, deallocs, bytes))
        });
    });
}

fn bench_vec_allocations(c: &mut Criterion) {
    c.bench_function("vec_without_capacity", |b| {
        b.iter(|| {
            reset_metrics();
            let mut vecs = Vec::new();
            for _ in 0..100 {
                let mut v = Vec::new();
                for i in 0..100 {
                    v.push(i);
                }
                vecs.push(v);
            }
            let (allocs, deallocs, bytes) = get_metrics();
            black_box((vecs, allocs, deallocs, bytes))
        });
    });

    c.bench_function("vec_with_capacity", |b| {
        b.iter(|| {
            reset_metrics();
            let mut vecs = Vec::new();
            for _ in 0..100 {
                let mut v = Vec::with_capacity(100);
                for i in 0..100 {
                    v.push(i);
                }
                vecs.push(v);
            }
            let (allocs, deallocs, bytes) = get_metrics();
            black_box((vecs, allocs, deallocs, bytes))
        });
    });
}

criterion_group!(
    benches,
    bench_cell_creation,
    bench_cell_cloning,
    bench_formula_parsing,
    bench_cell_repository_operations,
    bench_string_operations,
    bench_hashmap_operations,
    bench_vec_allocations
);
criterion_main!(benches);
