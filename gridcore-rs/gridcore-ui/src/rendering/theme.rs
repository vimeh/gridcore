#[derive(Clone, Debug)]
pub struct GridTheme {
    // Colors
    pub background_color: String,
    pub grid_line_color: String,
    pub cell_text_color: String,
    pub header_background_color: String,
    pub header_text_color: String,
    pub selection_background_color: String,
    pub selection_border_color: String,
    pub active_cell_border_color: String,

    // Dimensions
    pub default_cell_width: f64,
    pub default_cell_height: f64,
    pub min_cell_width: f64,
    pub max_cell_width: f64,
    pub row_header_width: f64,
    pub column_header_height: f64,

    // Fonts
    pub cell_font_family: String,
    pub cell_font_size: f64,
    pub header_font_family: String,
    pub header_font_size: f64,

    // Padding
    pub cell_padding_left: f64,
    pub cell_padding_top: f64,
}

impl Default for GridTheme {
    fn default() -> Self {
        Self {
            // Colors
            background_color: "#ffffff".to_string(),
            grid_line_color: "#e0e0e0".to_string(),
            cell_text_color: "#333333".to_string(),
            header_background_color: "#f5f5f5".to_string(),
            header_text_color: "#666666".to_string(),
            selection_background_color: "rgba(0, 102, 204, 0.1)".to_string(),
            selection_border_color: "#0066cc".to_string(),
            active_cell_border_color: "#0066cc".to_string(),

            // Dimensions
            default_cell_width: 100.0,
            default_cell_height: 24.0,
            min_cell_width: 40.0,
            max_cell_width: 500.0,
            row_header_width: 50.0,
            column_header_height: 24.0,

            // Fonts
            cell_font_family: "sans-serif".to_string(),
            cell_font_size: 13.0,
            header_font_family: "sans-serif".to_string(),
            header_font_size: 12.0,

            // Padding
            cell_padding_left: 4.0,
            cell_padding_top: 4.0,
        }
    }
}

pub fn default_theme() -> GridTheme {
    GridTheme::default()
}
