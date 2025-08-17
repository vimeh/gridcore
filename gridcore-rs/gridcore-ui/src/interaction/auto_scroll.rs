use crate::components::viewport::Viewport;
use gridcore_controller::controller::GridConfiguration;
use gridcore_core::types::CellAddress;
use leptos::prelude::*;
use std::cell::RefCell;
use std::rc::Rc;

pub struct AutoScroller;

impl AutoScroller {
    pub fn auto_scroll_to_cell(
        cell: &CellAddress,
        viewport_stored: StoredValue<Rc<RefCell<Viewport>>, LocalStorage>,
        config: &GridConfiguration,
    ) -> bool {
        viewport_stored.with_value(|vp| {
            let mut vp_borrow = vp.borrow_mut();
            let cell_pos = vp_borrow.get_cell_position(cell);
            let absolute_x = cell_pos.x + vp_borrow.get_scroll_position().x;
            let absolute_y = cell_pos.y + vp_borrow.get_scroll_position().y;

            let viewport_width = vp_borrow.get_viewport_width() - config.row_header_width;
            let viewport_height = vp_borrow.get_viewport_height() - config.column_header_height;
            let scroll_pos = vp_borrow.get_scroll_position();

            let mut needs_scroll = false;
            let mut new_scroll_x = scroll_pos.x;
            let mut new_scroll_y = scroll_pos.y;

            if absolute_x < scroll_pos.x {
                new_scroll_x = absolute_x;
                needs_scroll = true;
            } else if absolute_x + cell_pos.width > scroll_pos.x + viewport_width {
                new_scroll_x = absolute_x + cell_pos.width - viewport_width;
                needs_scroll = true;
            }

            if absolute_y < scroll_pos.y {
                new_scroll_y = absolute_y;
                needs_scroll = true;
            } else if absolute_y + cell_pos.height > scroll_pos.y + viewport_height {
                new_scroll_y = absolute_y + cell_pos.height - viewport_height;
                needs_scroll = true;
            }

            if needs_scroll {
                vp_borrow.set_scroll_position(new_scroll_x.max(0.0), new_scroll_y.max(0.0));
            }
            needs_scroll
        })
    }
}
