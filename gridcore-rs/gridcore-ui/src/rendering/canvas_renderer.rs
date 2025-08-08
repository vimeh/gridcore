use web_sys::{HtmlCanvasElement, CanvasRenderingContext2d};
use gridcore_core::types::CellAddress;
use crate::components::viewport::Viewport;
use crate::rendering::GridTheme;

pub struct CanvasRenderer {
    canvas: HtmlCanvasElement,
    ctx: CanvasRenderingContext2d,
    theme: GridTheme,
    device_pixel_ratio: f64,
}

impl CanvasRenderer {
    pub fn new(canvas: HtmlCanvasElement, theme: GridTheme) -> Result<Self, String> {
        let ctx = canvas
            .get_context("2d")
            .map_err(|_| "Failed to get 2D context")?
            .ok_or("No 2D context available")?
            .dyn_into::<CanvasRenderingContext2d>()
            .map_err(|_| "Failed to cast to CanvasRenderingContext2d")?;
        
        let device_pixel_ratio = web_sys::window()
            .and_then(|w| Some(w.device_pixel_ratio()))
            .unwrap_or(1.0);
        
        Ok(Self {
            canvas,
            ctx,
            theme,
            device_pixel_ratio,
        })
    }
    
    pub fn clear(&self) {
        let width = self.canvas.width() as f64;
        let height = self.canvas.height() as f64;
        self.ctx.clear_rect(0.0, 0.0, width, height);
        self.ctx.set_fill_style(&self.theme.background_color.as_str().into());
        self.ctx.fill_rect(0.0, 0.0, width, height);
    }
    
    pub fn resize(&mut self, width: f64, height: f64) {
        self.canvas.set_width((width * self.device_pixel_ratio) as u32);
        self.canvas.set_height((height * self.device_pixel_ratio) as u32);
        self.ctx.scale(self.device_pixel_ratio, self.device_pixel_ratio).ok();
    }
}