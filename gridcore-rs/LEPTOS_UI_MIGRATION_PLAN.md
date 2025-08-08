# Plan to Replicate Web UI in Rust with Leptos

## Overview

This document outlines the plan to migrate the TypeScript-based web UI to a Rust-based implementation using the Leptos framework. This will allow direct use of Rust structs without WASM wrappers or serialization overhead.

## Project Structure

Create a new Rust crate `gridcore-ui` at `gridcore-rs/gridcore-ui/` that will be a Leptos-based web application.

## 1. Set up Leptos Project

✅ Done - Basic Leptos app with Trunk build configuration

## 2. Canvas Rendering Implementation

✅ Done - Working grid with:
- Grid lines and cell boundaries
- Row/column headers with labels
- Active cell highlighting
- Mouse click selection
- Keyboard navigation (arrows + vim hjkl)
- Viewport management for scrolling

## 3. Controller Integration

✅ Done - Full controller integration with:
- SpreadsheetController initialization
- SpreadsheetFacade for data management
- Cell values rendered from facade
- SelectionManager for cursor/selection state
- Formula bar connected to facade.set_cell_value()
- UI mode tracking (Normal/Insert/Visual/Command)
- Keyboard events dispatched through controller
- State synchronization between UI and controller

## 4. Cell Editing Enhancement

✅ Done - Advanced editing features with:
- Inline cell editor overlay component
- Positioned dynamically based on active cell
- Formula autocomplete with common functions
- Keyboard navigation through suggestions (arrows, Tab)
- Click-to-apply suggestions
- Enhanced vim mode support (i, a, o, O)
- Integration with controller actions
- Real-time value updates from facade

## 2. Core Component Structure

### Main Components to Create

- `App` - Main application component
- `CanvasGrid` - Main grid canvas component
- `TabBar` - Sheet tab navigation
- `FormulaBar` - Formula input/display
- `StatusBar` - Status information
- `CellEditor` - In-cell editing
- `Viewport` - Viewport management

### Rendering Components

- `CanvasRenderer` - Main grid rendering
- `HeaderRenderer` - Row/column headers
- `SelectionRenderer` - Selection highlighting

### Interaction Handlers

- `MouseHandler` - Mouse events
- `KeyboardHandler` - Keyboard events
- `ResizeHandler` - Column/row resizing

## 3. Direct Integration Benefits

With Leptos + Rust, we can:

- Use `SelectionManager` directly without any wrapper
- Access `SpreadsheetController` and `UIStateMachine` natively
- Share types like `Selection`, `CellAddress`, `Direction` directly
- No serialization overhead between UI and controller

## 4. Example Component Structure

```rust
// gridcore-ui/src/components/canvas_grid.rs
use leptos::*;
use gridcore_controller::managers::SelectionManager;
use gridcore_controller::SpreadsheetController;
use web_sys::{HtmlCanvasElement, CanvasRenderingContext2d};

#[component]
pub fn CanvasGrid(
    controller: SpreadsheetController,
    selection_manager: SelectionManager,
) -> impl IntoView {
    // Direct use of Rust structs!
    let selection = selection_manager.get_primary();
    
    // Canvas refs
    let canvas_ref = create_node_ref::<HtmlCanvasElement>();
    
    // Reactive state
    let (viewport, set_viewport) = create_signal(Viewport::new());
    
    // Effects for rendering
    create_effect(move |_| {
        if let Some(canvas) = canvas_ref.get() {
            render_grid(&canvas, &controller, &selection_manager);
        }
    });
    
    view! {
        <div class="grid-container">
            <canvas node_ref=canvas_ref
                on:click=handle_click
                on:mousemove=handle_mouse_move
            />
        </div>
    }
}
```

## 5. Migration Steps

1. **Create new crate** - Set up `gridcore-ui` with Leptos dependencies
1. **Port Viewport logic** - Translate viewport calculations to Rust
1. **Implement Canvas rendering** - Use web-sys for canvas operations
1. **Create main components** - Start with CanvasGrid, then TabBar, FormulaBar
1. **Wire up event handlers** - Keyboard and mouse handlers using web-sys
1. **Integrate SelectionManager** - Use the Rust SelectionManager directly
1. **Add styling** - Either inline styles or use stylers crate

## 6. Build Configuration

### Trunk Setup

- Use Trunk for building and serving the Leptos app
- Configure `Trunk.toml` for asset handling
- Set up hot-reload for development

### Example Trunk.toml

```toml
[build]
target = "index.html"
dist = "dist"

[watch]
watch = ["src", "Cargo.toml", "index.html"]

[serve]
address = "127.0.0.1"
port = 8080
open = true
```

## 7. File Structure

```
gridcore-rs/
└── gridcore-ui/
    ├── Cargo.toml
    ├── Trunk.toml
    ├── index.html
    └── src/
        ├── main.rs
        ├── app.rs
        ├── components/
        │   ├── mod.rs
        │   ├── canvas_grid.rs
        │   ├── tab_bar.rs
        │   ├── formula_bar.rs
        │   ├── status_bar.rs
        │   ├── cell_editor.rs
        │   └── viewport.rs
        ├── rendering/
        │   ├── mod.rs
        │   ├── canvas_renderer.rs
        │   ├── header_renderer.rs
        │   ├── selection_renderer.rs
        │   └── theme.rs
        └── interaction/
            ├── mod.rs
            ├── mouse_handler.rs
            ├── keyboard_handler.rs
            └── resize_handler.rs
```

## 8. Key Advantages

- **No WASM boundary** for controller/UI communication
- **Type safety** throughout the entire stack
- **Direct access** to all Rust structs and enums
- **Better performance** for complex operations
- **Shared business logic** between controller and UI

## 9. Development Workflow

1. Install Trunk: `cargo install trunk`
1. Create the crate structure
1. Implement components incrementally
1. Test with: `trunk serve`
1. Build for production: `trunk build --release`

## 10. TypeScript to Rust Component Mapping

| TypeScript Component  | Rust Component                   | Notes                  |
| --------------------- | -------------------------------- | ---------------------- |
| `CanvasGrid.ts`       | `canvas_grid.rs`                 | Use web-sys for canvas |
| `SelectionManager.ts` | Direct use of `SelectionManager` | No wrapper needed!     |
| `WebStateAdapter.ts`  | Direct use of `UIStateMachine`   | Native Rust access     |
| `Viewport.ts`         | `viewport.rs`                    | Port calculations      |
| `KeyboardHandler.ts`  | `keyboard_handler.rs`            | web-sys events         |
| `MouseHandler.ts`     | `mouse_handler.rs`               | web-sys events         |

## 11. Immediate Benefits

Once implemented, the Leptos UI will:

- Eliminate all WASM wrapper code
- Provide compile-time type checking for all UI/controller interactions
- Allow direct pattern matching on Rust enums
- Enable shared utility functions between UI and core logic
- Reduce bundle size by having a single WASM module

This approach represents a significant architectural improvement, leveraging Rust's type system throughout the entire application stack.

