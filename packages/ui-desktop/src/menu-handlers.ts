import { listen } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";

export function setupMenuHandlers() {
  // File menu handlers
  listen("menu:new", () => {
    console.log("New file requested");
    // Emit event to ui-web to create new spreadsheet
    window.postMessage({ type: "menu:new" }, "*");
  });

  listen("menu:open", async () => {
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: "Spreadsheet",
          extensions: ["csv", "xlsx", "json"],
        },
      ],
    });
    if (selected) {
      console.log("Opening file:", selected);
      window.postMessage({ type: "menu:open", path: selected }, "*");
    }
  });

  listen("menu:save", () => {
    console.log("Save requested");
    window.postMessage({ type: "menu:save" }, "*");
  });

  listen("menu:save_as", async () => {
    const filePath = await save({
      filters: [
        {
          name: "Spreadsheet",
          extensions: ["csv", "xlsx", "json"],
        },
      ],
    });
    if (filePath) {
      console.log("Save as:", filePath);
      window.postMessage({ type: "menu:save_as", path: filePath }, "*");
    }
  });

  listen("menu:export", async () => {
    const filePath = await save({
      filters: [
        {
          name: "Export formats",
          extensions: ["pdf", "html", "png"],
        },
      ],
    });
    if (filePath) {
      console.log("Export to:", filePath);
      window.postMessage({ type: "menu:export", path: filePath }, "*");
    }
  });

  // Edit menu handlers
  listen("menu:undo", () => {
    window.postMessage({ type: "menu:undo" }, "*");
  });

  listen("menu:redo", () => {
    window.postMessage({ type: "menu:redo" }, "*");
  });

  listen("menu:cut", () => {
    window.postMessage({ type: "menu:cut" }, "*");
  });

  listen("menu:copy", () => {
    window.postMessage({ type: "menu:copy" }, "*");
  });

  listen("menu:paste", () => {
    window.postMessage({ type: "menu:paste" }, "*");
  });

  listen("menu:select_all", () => {
    window.postMessage({ type: "menu:select_all" }, "*");
  });

  listen("menu:find", () => {
    window.postMessage({ type: "menu:find" }, "*");
  });

  listen("menu:replace", () => {
    window.postMessage({ type: "menu:replace" }, "*");
  });

  // View menu handlers
  listen("menu:zoom_in", () => {
    window.postMessage({ type: "menu:zoom_in" }, "*");
  });

  listen("menu:zoom_out", () => {
    window.postMessage({ type: "menu:zoom_out" }, "*");
  });

  listen("menu:zoom_reset", () => {
    window.postMessage({ type: "menu:zoom_reset" }, "*");
  });

  listen("menu:toggle_vim", () => {
    window.postMessage({ type: "menu:toggle_vim" }, "*");
  });

  listen("menu:toggle_formula_bar", () => {
    window.postMessage({ type: "menu:toggle_formula_bar" }, "*");
  });

  listen("menu:toggle_headers", () => {
    window.postMessage({ type: "menu:toggle_headers" }, "*");
  });

  // Help menu handlers
  listen("menu:documentation", () => {
    window.open("https://github.com/gridcore/gridcore/wiki", "_blank");
  });

  listen("menu:keyboard_shortcuts", () => {
    window.postMessage({ type: "menu:keyboard_shortcuts" }, "*");
  });

  listen("menu:report_issue", () => {
    window.open("https://github.com/gridcore/gridcore/issues/new", "_blank");
  });

  listen("menu:about", () => {
    window.postMessage({ type: "menu:about" }, "*");
  });
}
