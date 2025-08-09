/**
 * TypeScript adapter for Rust WASM controller
 * Provides a seamless interface between TypeScript UI and Rust controller
 */

import type {
  Action,
  CellAddress,
  Selection,
  SpreadsheetMode,
  UIState,
  ViewportInfo,
} from "./types";

let wasmModule: any = null;
let initialized = false;

/**
 * Initialize the Rust WASM module
 */
export async function initializeWasm(): Promise<void> {
  if (initialized) return;

  try {
    // Dynamic import based on environment
    if (typeof window !== "undefined") {
      // Browser environment
      wasmModule = await import("../pkg/gridcore_controller");
    } else {
      // Node.js environment
      wasmModule = await import("../pkg-node/gridcore_controller");
    }

    // Initialize WASM module
    if (wasmModule.init) {
      await wasmModule.init();
    }

    initialized = true;
    console.log("WASM controller initialized successfully");
  } catch (error) {
    console.error("Failed to initialize WASM controller:", error);
    throw error;
  }
}

/**
 * UIStateMachine wrapper
 */
export class UIStateMachine {
  private inner: any;

  constructor(initialState?: UIState) {
    if (!initialized) {
      throw new Error("WASM not initialized. Call initializeWasm() first.");
    }

    if (initialState) {
      this.inner = wasmModule.WasmUIStateMachine.withInitialState(initialState);
    } else {
      this.inner = new wasmModule.WasmUIStateMachine();
    }
  }

  transition(action: Action): void {
    this.inner.transition(action);
  }

  getState(): UIState {
    return this.inner.getState();
  }

  getSpreadsheetMode(): SpreadsheetMode {
    return this.inner.getSpreadsheetMode();
  }

  getCursor(): CellAddress {
    return this.inner.getCursor();
  }

  getViewport(): ViewportInfo {
    return this.inner.getViewport();
  }

  getHistory(): Array<{ state: UIState; action: Action; timestamp: number }> {
    return this.inner.getHistory();
  }

  clearHistory(): void {
    this.inner.clearHistory();
  }

  // Helper methods
  startEditing(initialValue?: string): void {
    this.inner.startEditing(initialValue);
  }

  enterCommandMode(): void {
    this.inner.enterCommandMode();
  }

  escape(): void {
    this.inner.escape();
  }

  updateCursor(col: number, row: number): void {
    this.inner.updateCursor(col, row);
  }
}

/**
 * SpreadsheetController wrapper
 */
export class SpreadsheetController {
  private inner: any;

  constructor() {
    if (!initialized) {
      throw new Error("WASM not initialized. Call initializeWasm() first.");
    }

    this.inner = new wasmModule.WasmSpreadsheetController();
  }

  getState(): UIState {
    return this.inner.getState();
  }

  processKey(
    key: string,
    shift: boolean = false,
    ctrl: boolean = false,
    alt: boolean = false,
    meta: boolean = false,
  ): void {
    this.inner.processKey(key, shift, ctrl, alt, meta);
  }

  processMouse(
    x: number,
    y: number,
    button: "left" | "middle" | "right" | "none",
    eventType: "down" | "up" | "move" | "click" | "doubleclick" | "wheel",
  ): void {
    this.inner.processMouse(x, y, button, eventType);
  }

  getCellValue(col: number, row: number): any {
    return this.inner.getCellValue(col, row);
  }

  setCellValue(col: number, row: number, value: string): void {
    this.inner.setCellValue(col, row, value);
  }

  getCursor(): CellAddress {
    return this.inner.getCursor();
  }

  getViewport(): ViewportInfo {
    return this.inner.getViewport();
  }

  getSpreadsheetMode(): string {
    return this.inner.getSpreadsheetMode();
  }
}

/**
 * ActionBuilder for creating actions
 */
export class ActionBuilder {
  static startEditing(initialValue?: string): Action {
    if (!initialized) {
      throw new Error("WASM not initialized. Call initializeWasm() first.");
    }
    return wasmModule.ActionBuilder.startEditing(initialValue);
  }

  static enterCommandMode(): Action {
    if (!initialized) {
      throw new Error("WASM not initialized. Call initializeWasm() first.");
    }
    return wasmModule.ActionBuilder.enterCommandMode();
  }

  static escape(): Action {
    if (!initialized) {
      throw new Error("WASM not initialized. Call initializeWasm() first.");
    }
    return wasmModule.ActionBuilder.escape();
  }

  static updateCursor(col: number, row: number): Action {
    if (!initialized) {
      throw new Error("WASM not initialized. Call initializeWasm() first.");
    }
    return wasmModule.ActionBuilder.updateCursor(col, row);
  }

  static updateCommandValue(value: string): Action {
    if (!initialized) {
      throw new Error("WASM not initialized. Call initializeWasm() first.");
    }
    return wasmModule.ActionBuilder.updateCommandValue(value);
  }
}

/**
 * Feature flag to enable/disable Rust controller
 */
export const USE_RUST_CONTROLLER =
  process.env.USE_RUST_CONTROLLER === "true" ||
  process.env.REACT_APP_USE_RUST_CONTROLLER === "true" ||
  (typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("rust") === "true");

/**
 * Export everything needed for drop-in replacement
 */
export default {
  initializeWasm,
  UIStateMachine,
  SpreadsheetController,
  ActionBuilder,
  USE_RUST_CONTROLLER,
};
