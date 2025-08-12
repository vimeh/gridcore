/// Tracks frame rate and frame timing information
pub struct FpsTracker {
    frame_times: Vec<f64>,
    last_frame_time: f64,
    dropped_frames: u32,
    is_tracking: bool,
    frame_threshold: f64, // Threshold for dropped frame detection (default 33ms for 30fps min)
}

impl FpsTracker {
    pub fn new() -> Self {
        Self {
            frame_times: Vec::with_capacity(1000),
            last_frame_time: 0.0,
            dropped_frames: 0,
            is_tracking: false,
            frame_threshold: 33.0, // 30 FPS minimum
        }
    }
    
    pub fn start(&mut self) {
        self.is_tracking = true;
        self.last_frame_time = Self::now();
    }
    
    pub fn stop(&mut self) {
        self.is_tracking = false;
    }
    
    pub fn record_frame(&mut self) {
        if !self.is_tracking {
            return;
        }
        
        let current_time = Self::now();
        let frame_time = current_time - self.last_frame_time;
        
        // Record frame time
        self.frame_times.push(frame_time);
        
        // Check for dropped frames (frame took longer than threshold)
        if frame_time > self.frame_threshold {
            self.dropped_frames += 1;
        }
        
        self.last_frame_time = current_time;
    }
    
    pub fn clear(&mut self) {
        self.frame_times.clear();
        self.dropped_frames = 0;
        self.last_frame_time = 0.0;
    }
    
    pub fn get_frame_times(&self) -> Vec<f64> {
        self.frame_times.clone()
    }
    
    pub fn get_dropped_frames(&self) -> u32 {
        self.dropped_frames
    }
    
    pub fn get_average_fps(&self) -> f64 {
        if self.frame_times.is_empty() {
            return 0.0;
        }
        
        let avg_frame_time: f64 = self.frame_times.iter().sum::<f64>() / self.frame_times.len() as f64;
        if avg_frame_time > 0.0 {
            1000.0 / avg_frame_time
        } else {
            0.0
        }
    }
    
    pub fn get_percentile_fps(&self, percentile: f64) -> f64 {
        if self.frame_times.is_empty() {
            return 0.0;
        }
        
        let mut sorted_times = self.frame_times.clone();
        sorted_times.sort_by(|a, b| a.partial_cmp(b).unwrap());
        
        let index = ((sorted_times.len() - 1) as f64 * percentile / 100.0) as usize;
        let frame_time = sorted_times[index];
        
        if frame_time > 0.0 {
            1000.0 / frame_time
        } else {
            0.0
        }
    }
    
    fn now() -> f64 {
        web_sys::window()
            .and_then(|w| w.performance())
            .map(|p| p.now())
            .unwrap_or(0.0)
    }
}