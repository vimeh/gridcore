import { GridCore } from "@gridcore/core";
import { setupMenuHandlers } from "./menu-handlers";

// This file is only used during development to set up Tauri-specific features
// In production, Tauri loads the ui-web build directly

const core = new GridCore();
console.log(`GridCore Desktop v${core.getVersion()}`);

// Set up menu handlers when running in Tauri context
if (window.__TAURI__) {
  setupMenuHandlers();
  console.log("Tauri menu handlers initialized");
}
