use criterion::{BenchmarkId, Criterion, criterion_group, criterion_main};
use gridcore_controller::controller::{GridConfiguration, ViewportManager};
use gridcore_core::types::CellAddress;
use std::hint::black_box;

fn setup_viewport(rows: u32, cols: u32) -> ViewportManager {
    let config = GridConfiguration {
        total_rows: rows as usize,
        total_cols: cols as usize,
        default_cell_width: 100.0,
        default_cell_height: 24.0,
        row_header_width: 50.0,
        column_header_height: 30.0,
        ..Default::default()
    };

    ViewportManager::new(rows, cols).with_config(config)
}

fn bench_viewport_scroll(c: &mut Criterion) {
    let mut group = c.benchmark_group("viewport_scroll");

    for size in [100, 1000, 10000].iter() {
        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, &grid_size| {
            let mut viewport = setup_viewport(grid_size, grid_size);

            b.iter(|| {
                viewport.set_scroll_position(black_box(500.0), black_box(1000.0));
                viewport.get_visible_bounds()
            });
        });
    }

    group.finish();
}

fn bench_cell_position_calculation(c: &mut Criterion) {
    let mut group = c.benchmark_group("cell_position");

    for size in [100, 1000, 10000].iter() {
        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, &grid_size| {
            let viewport = setup_viewport(grid_size, grid_size);

            b.iter(|| {
                let addr = CellAddress::new(black_box(grid_size / 2), black_box(grid_size / 2));
                viewport.get_cell_position(&addr)
            });
        });
    }

    group.finish();
}

fn bench_visible_cells_iteration(c: &mut Criterion) {
    let mut group = c.benchmark_group("visible_cells");

    for size in [100, 1000, 10000].iter() {
        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, &grid_size| {
            let viewport = setup_viewport(grid_size, grid_size);

            b.iter(|| {
                let bounds = viewport.get_visible_bounds();
                let mut count = 0;
                for row in bounds.start_row..=bounds.end_row {
                    for col in bounds.start_col..=bounds.end_col {
                        count += black_box(row * col);
                    }
                }
                count
            });
        });
    }

    group.finish();
}

fn bench_resize_column(c: &mut Criterion) {
    let mut group = c.benchmark_group("resize_column");

    for num_resizes in [10, 100, 1000].iter() {
        group.bench_with_input(
            BenchmarkId::from_parameter(num_resizes),
            num_resizes,
            |b, &resizes| {
                b.iter_with_setup(
                    || setup_viewport(1000, 1000),
                    |mut viewport| {
                        for i in 0..resizes {
                            viewport.set_column_width(i as usize, 150.0);
                        }
                    },
                );
            },
        );
    }

    group.finish();
}

criterion_group!(
    benches,
    bench_viewport_scroll,
    bench_cell_position_calculation,
    bench_visible_cells_iteration,
    bench_resize_column
);
criterion_main!(benches);
