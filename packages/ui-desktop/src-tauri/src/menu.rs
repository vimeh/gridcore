use tauri::{
    menu::{Menu, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder},
    App, Wry,
};

pub fn create_menu(app: &App) -> Result<Menu<Wry>, Box<dyn std::error::Error>> {
    let menu = MenuBuilder::new(app)
        .items(&[
            &create_file_menu(app)?,
            &create_edit_menu(app)?,
            &create_view_menu(app)?,
            &create_window_menu(app)?,
            &create_help_menu(app)?,
        ])
        .build()?;

    Ok(menu)
}

fn create_file_menu(app: &App) -> Result<tauri::menu::Submenu<Wry>, Box<dyn std::error::Error>> {
    let new = MenuItemBuilder::with_id("new", "New")
        .accelerator("CmdOrCtrl+N")
        .build(app)?;
    let open = MenuItemBuilder::with_id("open", "Open...")
        .accelerator("CmdOrCtrl+O")
        .build(app)?;
    let save = MenuItemBuilder::with_id("save", "Save")
        .accelerator("CmdOrCtrl+S")
        .build(app)?;
    let save_as = MenuItemBuilder::with_id("save_as", "Save As...")
        .accelerator("CmdOrCtrl+Shift+S")
        .build(app)?;
    let export = MenuItemBuilder::with_id("export", "Export...").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit")
        .accelerator("CmdOrCtrl+Q")
        .build(app)?;

    let file_menu = SubmenuBuilder::new(app, "File")
        .items(&[
            &new,
            &open,
            &PredefinedMenuItem::separator(app)?,
            &save,
            &save_as,
            &export,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ])
        .build()?;

    Ok(file_menu)
}

fn create_edit_menu(app: &App) -> Result<tauri::menu::Submenu<Wry>, Box<dyn std::error::Error>> {
    let undo = MenuItemBuilder::with_id("undo", "Undo")
        .accelerator("CmdOrCtrl+Z")
        .build(app)?;
    let redo = MenuItemBuilder::with_id("redo", "Redo")
        .accelerator("CmdOrCtrl+Shift+Z")
        .build(app)?;
    let cut = MenuItemBuilder::with_id("cut", "Cut")
        .accelerator("CmdOrCtrl+X")
        .build(app)?;
    let copy = MenuItemBuilder::with_id("copy", "Copy")
        .accelerator("CmdOrCtrl+C")
        .build(app)?;
    let paste = MenuItemBuilder::with_id("paste", "Paste")
        .accelerator("CmdOrCtrl+V")
        .build(app)?;
    let select_all = MenuItemBuilder::with_id("select_all", "Select All")
        .accelerator("CmdOrCtrl+A")
        .build(app)?;
    let find = MenuItemBuilder::with_id("find", "Find...")
        .accelerator("CmdOrCtrl+F")
        .build(app)?;
    let replace = MenuItemBuilder::with_id("replace", "Replace...")
        .accelerator("CmdOrCtrl+H")
        .build(app)?;

    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .items(&[
            &undo,
            &redo,
            &PredefinedMenuItem::separator(app)?,
            &cut,
            &copy,
            &paste,
            &PredefinedMenuItem::separator(app)?,
            &select_all,
            &PredefinedMenuItem::separator(app)?,
            &find,
            &replace,
        ])
        .build()?;

    Ok(edit_menu)
}

fn create_view_menu(app: &App) -> Result<tauri::menu::Submenu<Wry>, Box<dyn std::error::Error>> {
    let zoom_in = MenuItemBuilder::with_id("zoom_in", "Zoom In")
        .accelerator("CmdOrCtrl+Plus")
        .build(app)?;
    let zoom_out = MenuItemBuilder::with_id("zoom_out", "Zoom Out")
        .accelerator("CmdOrCtrl+Minus")
        .build(app)?;
    let zoom_reset = MenuItemBuilder::with_id("zoom_reset", "Reset Zoom")
        .accelerator("CmdOrCtrl+0")
        .build(app)?;
    let fullscreen = MenuItemBuilder::with_id("fullscreen", "Toggle Fullscreen")
        .accelerator("F11")
        .build(app)?;
    let toggle_vim = MenuItemBuilder::with_id("toggle_vim", "Toggle Vim Mode").build(app)?;
    let toggle_formula_bar =
        MenuItemBuilder::with_id("toggle_formula_bar", "Toggle Formula Bar").build(app)?;
    let toggle_headers = MenuItemBuilder::with_id("toggle_headers", "Toggle Headers").build(app)?;

    let view_menu = SubmenuBuilder::new(app, "View")
        .items(&[
            &zoom_in,
            &zoom_out,
            &zoom_reset,
            &PredefinedMenuItem::separator(app)?,
            &fullscreen,
            &PredefinedMenuItem::separator(app)?,
            &toggle_vim,
            &toggle_formula_bar,
            &toggle_headers,
        ])
        .build()?;

    Ok(view_menu)
}

fn create_window_menu(app: &App) -> Result<tauri::menu::Submenu<Wry>, Box<dyn std::error::Error>> {
    let minimize = MenuItemBuilder::with_id("minimize", "Minimize")
        .accelerator("CmdOrCtrl+M")
        .build(app)?;
    let close = MenuItemBuilder::with_id("close", "Close")
        .accelerator("CmdOrCtrl+W")
        .build(app)?;

    let window_menu = SubmenuBuilder::new(app, "Window")
        .items(&[&minimize, &close])
        .build()?;

    Ok(window_menu)
}

fn create_help_menu(app: &App) -> Result<tauri::menu::Submenu<Wry>, Box<dyn std::error::Error>> {
    let documentation = MenuItemBuilder::with_id("documentation", "Documentation").build(app)?;
    let keyboard_shortcuts = MenuItemBuilder::with_id("keyboard_shortcuts", "Keyboard Shortcuts")
        .accelerator("CmdOrCtrl+/")
        .build(app)?;
    let report_issue = MenuItemBuilder::with_id("report_issue", "Report Issue...").build(app)?;
    let about = MenuItemBuilder::with_id("about", "About GridCore").build(app)?;

    let help_menu = SubmenuBuilder::new(app, "Help")
        .items(&[
            &documentation,
            &keyboard_shortcuts,
            &PredefinedMenuItem::separator(app)?,
            &report_issue,
            &PredefinedMenuItem::separator(app)?,
            &about,
        ])
        .build()?;

    Ok(help_menu)
}
