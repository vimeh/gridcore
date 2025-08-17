//! UI rendering benchmarks
//! These benchmarks test the canvas rendering performance in a WASM context

#[cfg(target_arch = "wasm32")]
use wasm_bindgen_test::*;

#[cfg(target_arch = "wasm32")]
use gridcore_controller::controller::GridConfiguration;
#[cfg(target_arch = "wasm32")]
use gridcore_core::{SpreadsheetFacade, types::CellAddress};
#[cfg(target_arch = "wasm32")]
use gridcore_ui::components::viewport::Viewport;
#[cfg(target_arch = "wasm32")]
use gridcore_ui::rendering::{CanvasRenderer, GridTheme};
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::JsCast;
#[cfg(target_arch = "wasm32")]
use web_sys::{HtmlCanvasElement, window};

#[cfg(target_arch = "wasm32")]
wasm_bindgen_test_configure!(run_in_browser);

#[cfg(target_arch = "wasm32")]
fn setup_canvas() -> HtmlCanvasElement {
    let document = window().unwrap().document().unwrap();
    let canvas = document
        .create_element("canvas")
        .unwrap()
        .dyn_into::<HtmlCanvasElement>()
        .unwrap();
    canvas.set_width(1920);
    canvas.set_height(1080);
    document.body().unwrap().append_child(&canvas).unwrap();
    canvas
}

#[cfg(target_arch = "wasm32")]
fn setup_viewport(width: f64, height: f64) -> Viewport {
    let config = GridConfiguration {
        total_rows: 10000,
        total_cols: 1000,
        default_cell_width: 100.0,
        default_cell_height: 24.0,
        ..Default::default()
    };

    let mut viewport = Viewport::new(config);
    viewport.set_dimensions(width, height);
    viewport
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen_test]
fn bench_render_empty_grid() {
    let canvas = setup_canvas();
    let viewport = setup_viewport(1920.0, 1080.0);
    let facade = SpreadsheetFacade::new();
    let renderer = CanvasRenderer::new(GridTheme::default());

    let start = window().unwrap().performance().unwrap().now();

    for _ in 0..100 {
        renderer.render(&RenderParams {
            canvas: &canvas,
            viewport: &viewport,
            active_cell: CellAddress::new(0, 0),
            selection: None,
            facade: &facade,
            device_pixel_ratio: 1.0,
            config: &viewport.config,
        });
    }

    let elapsed = window().unwrap().performance().unwrap().now() - start;
    web_sys::console::log_1(
        &format!("Empty grid render (100 iterations): {:.2}ms", elapsed).into(),
    );
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen_test]
fn bench_render_with_data() {
    let canvas = setup_canvas();
    let viewport = setup_viewport(1920.0, 1080.0);
    let facade = SpreadsheetFacade::new();

    // Add data to visible cells
    for row in 0..50 {
        for col in 0..20 {
            let addr = CellAddress::new(col, row);
            facade
                .set_cell_value(&addr, &format!("R{}C{}", row, col))
                .ok();
        }
    }

    let renderer = CanvasRenderer::new(GridTheme::default());

    let start = window().unwrap().performance().unwrap().now();

    for _ in 0..100 {
        renderer.render(&RenderParams {
            canvas: &canvas,
            viewport: &viewport,
            active_cell: CellAddress::new(5, 5),
            selection: Some(Selection::range(
                CellAddress::new(0, 0),
                CellAddress::new(10, 10),
            )),
            facade: &facade,
            device_pixel_ratio: 1.0,
            config: &viewport.config,
        });
    }

    let elapsed = window().unwrap().performance().unwrap().now() - start;
    web_sys::console::log_1(
        &format!("Grid with data render (100 iterations): {:.2}ms", elapsed).into(),
    );
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen_test]
fn bench_render_large_selection() {
    let canvas = setup_canvas();
    let viewport = setup_viewport(1920.0, 1080.0);
    let facade = SpreadsheetFacade::new();
    let renderer = CanvasRenderer::new(GridTheme::default());

    // Large selection
    let selection = Selection::range(CellAddress::new(0, 0), CellAddress::new(100, 100));

    let start = window().unwrap().performance().unwrap().now();

    for _ in 0..100 {
        renderer.render(&RenderParams {
            canvas: &canvas,
            viewport: &viewport,
            active_cell: CellAddress::new(50, 50),
            selection: Some(selection.clone()),
            facade: &facade,
            device_pixel_ratio: 1.0,
            config: &viewport.config,
        });
    }

    let elapsed = window().unwrap().performance().unwrap().now() - start;
    web_sys::console::log_1(
        &format!("Large selection render (100 iterations): {:.2}ms", elapsed).into(),
    );
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen_test]
fn bench_render_scroll_performance() {
    let canvas = setup_canvas();
    let mut viewport = setup_viewport(1920.0, 1080.0);
    let facade = SpreadsheetFacade::new();
    let renderer = CanvasRenderer::new(GridTheme::default());

    let start = window().unwrap().performance().unwrap().now();

    // Simulate scrolling by changing viewport position
    for i in 0..100 {
        viewport.set_scroll_position(ScrollPosition {
            x: (i * 10) as f64,
            y: (i * 10) as f64,
        });

        renderer.render(&RenderParams {
            canvas: &canvas,
            viewport: &viewport,
            active_cell: CellAddress::new(0, 0),
            selection: None,
            facade: &facade,
            device_pixel_ratio: 1.0,
            config: &viewport.config,
        });
    }

    let elapsed = window().unwrap().performance().unwrap().now() - start;
    web_sys::console::log_1(&format!("Scroll render (100 frames): {:.2}ms", elapsed).into());
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen_test]
fn bench_render_high_dpi() {
    let canvas = setup_canvas();
    let viewport = setup_viewport(1920.0, 1080.0);
    let facade = SpreadsheetFacade::new();
    let renderer = CanvasRenderer::new(GridTheme::default());

    let start = window().unwrap().performance().unwrap().now();

    for _ in 0..100 {
        renderer.render(&RenderParams {
            canvas: &canvas,
            viewport: &viewport,
            active_cell: CellAddress::new(0, 0),
            selection: None,
            facade: &facade,
            device_pixel_ratio: 2.0, // Simulate retina display
            config: &viewport.config,
        });
    }

    let elapsed = window().unwrap().performance().unwrap().now() - start;
    web_sys::console::log_1(&format!("High DPI render (100 iterations): {:.2}ms", elapsed).into());
}

// Provide stub implementations for non-WASM builds
#[cfg(not(target_arch = "wasm32"))]
pub fn run_benchmarks() {
    println!(
        "UI benchmarks can only run in WASM context. Use wasm-pack test to run these benchmarks."
    );
}
