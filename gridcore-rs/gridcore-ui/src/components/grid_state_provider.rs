use crate::context::{use_app_state, use_reactive_signals, use_viewport};
use gridcore_core::types::CellAddress;
use leptos::prelude::*;

#[component]
pub fn GridStateProvider(children: Children) -> impl IntoView {
    let app_state = use_app_state();
    let controller_stored = app_state.controller;
    let (state_generation, _render_generation) = use_reactive_signals();
    let viewport_stored = use_viewport();

    let active_cell = Memo::new(move |_| {
        state_generation.get();
        controller_stored.with_value(|ctrl| ctrl.borrow().cursor())
    });

    let editing_mode = Memo::new(move |_| {
        state_generation.get();
        controller_stored.with_value(|ctrl| ctrl.borrow().get_mode().is_editing())
    });

    let cell_position = Memo::new(move |_| {
        if editing_mode.get() {
            let cell = active_cell.get();
            viewport_stored.with_value(|vp| {
                let vp_borrow = vp.borrow();
                let pos = vp_borrow.get_cell_position(&cell);
                let (row_header_width, column_header_height) = controller_stored.with_value(|c| {
                    let borrow = c.borrow();
                    let config = borrow.get_config();
                    (config.row_header_width, config.column_header_height)
                });
                (
                    pos.x + row_header_width,
                    pos.y + column_header_height,
                    pos.width,
                    pos.height,
                )
            })
        } else {
            (0.0, 0.0, 100.0, 25.0)
        }
    });

    provide_context(active_cell);
    provide_context(editing_mode);
    provide_context(cell_position);

    children()
}

#[derive(Clone, Copy)]
pub struct GridStateContext {
    pub active_cell: Memo<CellAddress>,
    pub editing_mode: Memo<bool>,
    pub cell_position: Memo<(f64, f64, f64, f64)>,
}

pub fn use_grid_state() -> GridStateContext {
    GridStateContext {
        active_cell: use_context::<Memo<CellAddress>>()
            .expect("GridStateProvider must be in the component tree"),
        editing_mode: use_context::<Memo<bool>>()
            .expect("GridStateProvider must be in the component tree"),
        cell_position: use_context::<Memo<(f64, f64, f64, f64)>>()
            .expect("GridStateProvider must be in the component tree"),
    }
}
