mod menu;

use tauri::{Emitter, Manager, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Create and set the menu
            let menu = menu::create_menu(app)?;
            app.set_menu(menu)?;

            Ok(())
        })
        .on_menu_event(|app, event| {
            let window = app.get_webview_window("main").unwrap();

            match event.id.as_ref() {
                // File menu handlers
                "new" => {
                    window.emit("menu:new", ()).unwrap();
                }
                "open" => {
                    window.emit("menu:open", ()).unwrap();
                }
                "save" => {
                    window.emit("menu:save", ()).unwrap();
                }
                "save_as" => {
                    window.emit("menu:save_as", ()).unwrap();
                }
                "export" => {
                    window.emit("menu:export", ()).unwrap();
                }
                "quit" => {
                    app.exit(0);
                }

                // Edit menu handlers
                "undo" => {
                    window.emit("menu:undo", ()).unwrap();
                }
                "redo" => {
                    window.emit("menu:redo", ()).unwrap();
                }
                "cut" => {
                    window.emit("menu:cut", ()).unwrap();
                }
                "copy" => {
                    window.emit("menu:copy", ()).unwrap();
                }
                "paste" => {
                    window.emit("menu:paste", ()).unwrap();
                }
                "select_all" => {
                    window.emit("menu:select_all", ()).unwrap();
                }
                "find" => {
                    window.emit("menu:find", ()).unwrap();
                }
                "replace" => {
                    window.emit("menu:replace", ()).unwrap();
                }

                // View menu handlers
                "zoom_in" => {
                    window.emit("menu:zoom_in", ()).unwrap();
                }
                "zoom_out" => {
                    window.emit("menu:zoom_out", ()).unwrap();
                }
                "zoom_reset" => {
                    window.emit("menu:zoom_reset", ()).unwrap();
                }
                "fullscreen" => {
                    let is_fullscreen = window.is_fullscreen().unwrap_or(false);
                    window.set_fullscreen(!is_fullscreen).unwrap();
                }
                "toggle_vim" => {
                    window.emit("menu:toggle_vim", ()).unwrap();
                }
                "toggle_formula_bar" => {
                    window.emit("menu:toggle_formula_bar", ()).unwrap();
                }
                "toggle_headers" => {
                    window.emit("menu:toggle_headers", ()).unwrap();
                }

                // Window menu handlers
                "minimize" => {
                    window.minimize().unwrap();
                }
                "close" => {
                    window.close().unwrap();
                }

                // Help menu handlers
                "documentation" => {
                    window.emit("menu:documentation", ()).unwrap();
                }
                "keyboard_shortcuts" => {
                    window.emit("menu:keyboard_shortcuts", ()).unwrap();
                }
                "report_issue" => {
                    window.emit("menu:report_issue", ()).unwrap();
                }
                "about" => {
                    window.emit("menu:about", ()).unwrap();
                }

                _ => {}
            }
        })
        .on_window_event(|_window, event| {
            // Update menu state based on window events if needed
            if let WindowEvent::Focused(focused) = event {
                // Could update menu items based on focus state
                log::debug!("Window focused: {focused}");
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
