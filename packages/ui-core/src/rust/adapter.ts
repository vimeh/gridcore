/**
 * TypeScript adapter for Rust WASM controller
 * Provides compatibility layer between TypeScript and Rust implementations
 */

import type { CellAddress, SpreadsheetFacade } from "@gridcore/core";
import type { 
  ControllerEvent,
  SpreadsheetControllerOptions,
  ViewportManager 
} from "../controllers/SpreadsheetController";
import type { UIState, ViewportInfo } from "../state/UIState";
import type { Action } from "../state/UIStateMachine";

// Dynamic import types for WASM module
type WasmModule = any; // Type will be resolved at runtime

let wasmModule: WasmModule | null = null;
let initialized = false;

/**
 * Initialize the Rust WASM module
 */
export async function initializeWasm(): Promise<void> {
  if (initialized) return;

  try {
    // Dynamic import of WASM module - using optional import
    try {
      // @ts-ignore - Dynamic import of optional dependency
      wasmModule = await import("gridcore-controller");
    } catch (firstError) {
      // Try alternate path if package import fails
      // @ts-ignore
      wasmModule = await import("../../../gridcore-rs/gridcore-controller/pkg/gridcore_controller.js");
    }
    
    // Initialize WASM module
    if (wasmModule.init) {
      wasmModule.init();
    } else if (wasmModule.default) {
      // Handle default export
      await wasmModule.default();
    }

    initialized = true;
    console.log("WASM controller initialized successfully");
  } catch (error) {
    console.error("Failed to initialize WASM controller:", error);
    throw error;
  }
}

/**
 * Rust SpreadsheetController adapter
 * Implements the same interface as the TypeScript SpreadsheetController
 */
export class RustSpreadsheetController {
  private inner: any; // WasmSpreadsheetController instance
  private facade: SpreadsheetFacade;
  private viewportManager: ViewportManager;
  private listeners: Array<(event: ControllerEvent) => void> = [];
  private _state: UIState | null = null;

  constructor(options: SpreadsheetControllerOptions | SpreadsheetFacade) {
    if (!initialized) {
      throw new Error("WASM not initialized. Call initializeWasm() first.");
    }

    // Handle both constructor signatures for backward compatibility
    if ("facade" in options) {
      this.facade = options.facade;
      this.viewportManager = options.viewportManager;
    } else {
      // Legacy constructor signature
      this.facade = options as SpreadsheetFacade;
      // Create default viewport manager
      this.viewportManager = {
        getColumnWidth: (index: number) => 100,
        setColumnWidth: (index: number, width: number) => {},
        getRowHeight: (index: number) => 30,
        setRowHeight: (index: number, height: number) => {},
        getTotalRows: () => 1000,
        getTotalCols: () => 100,
        scrollTo: (row: number, col: number) => {},
      };
    }

    // Create WASM controller
    this.inner = new (wasmModule as WasmModule).WasmSpreadsheetController();
    
    // Subscribe to WASM events (if implemented)
    this.inner.subscribe((event: any) => {
      this.handleWasmEvent(event);
    });
  }

  private handleWasmEvent(event: any): void {
    // Convert WASM event to TypeScript ControllerEvent
    const controllerEvent = this.convertWasmEvent(event);
    if (controllerEvent) {
      this.notify(controllerEvent);
    }
  }

  private convertWasmEvent(event: any): ControllerEvent | null {
    // Map WASM events to TypeScript events
    switch (event.type) {
      case "StateChanged":
        return {
          type: "stateChanged",
          state: event.state,
          action: event.action,
        };
      case "CursorMoved":
        return {
          type: "selectionChanged",
          start: event.to,
          end: undefined,
        };
      case "CellEditCompleted":
        return {
          type: "cellValueChanged",
          address: event.address,
          value: event.value,
        };
      case "CommandExecuted":
        return {
          type: "commandExecuted",
          command: event.command,
        };
      default:
        return null;
    }
  }

  private notify(event: ControllerEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  // Public API matching TypeScript SpreadsheetController

  handleKeydown(event: KeyboardEvent): void {
    try {
      const keyEvent = {
        key: event.key,
        shift: event.shiftKey,
        ctrl: event.ctrlKey,
        alt: event.altKey,
        meta: event.metaKey,
      };
      
      this.inner.handleKeyboardEvent(keyEvent);
      
      // Update cached state
      this._state = this.inner.getState();
      
      // Notify listeners
      this.notify({
        type: "stateChanged",
        state: this._state as UIState,
        action: { type: "KeyPress", key: event.key } as Action,
      });
    } catch (error) {
      console.error("Error handling keyboard event:", error);
      this.notify({
        type: "error",
        error: String(error),
      });
    }
  }

  handleMouseEvent(event: MouseEvent, target: HTMLElement): void {
    try {
      const rect = target.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      let eventType = "move";
      switch (event.type) {
        case "mousedown": eventType = "down"; break;
        case "mouseup": eventType = "up"; break;
        case "click": eventType = "click"; break;
        case "dblclick": eventType = "doubleclick"; break;
        case "wheel": eventType = "wheel"; break;
      }
      
      let button = "none";
      switch (event.button) {
        case 0: button = "left"; break;
        case 1: button = "middle"; break;
        case 2: button = "right"; break;
      }
      
      const mouseEvent = {
        x,
        y,
        button,
        event_type: eventType,
      };
      
      this.inner.handleMouseEvent(mouseEvent);
      
      // Update cached state
      this._state = this.inner.getState();
    } catch (error) {
      console.error("Error handling mouse event:", error);
    }
  }

  getState(): UIState {
    if (!this._state) {
      this._state = this.inner.getState();
    }
    return this._state;
  }

  getCursor(): CellAddress {
    return this.inner.getCursor();
  }

  getViewport(): ViewportInfo {
    return this.inner.getViewport();
  }

  subscribe(listener: (event: ControllerEvent) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // Methods that need to be adapted or stubbed

  processVimCommand(command: string): void {
    // Convert vim command to keyboard events
    for (const char of command) {
      this.handleKeydown(new KeyboardEvent("keydown", { key: char }));
    }
  }

  setCellValue(address: CellAddress, value: string): void {
    this.inner.setCellValue(address.col, address.row, value);
    this.facade.setCellValue(address, value);
  }

  getCellValue(address: CellAddress): any {
    return this.inner.getCellValue(address.col, address.row);
  }

  // Undo/Redo support (if implemented in WASM)
  
  undo(): void {
    // Would need WASM support
    console.warn("Undo not yet implemented in Rust controller");
  }

  redo(): void {
    // Would need WASM support
    console.warn("Redo not yet implemented in Rust controller");
  }

  canUndo(): boolean {
    return false; // Would need WASM support
  }

  canRedo(): boolean {
    return false; // Would need WASM support
  }

  // Cleanup

  dispose(): void {
    if (this.inner && this.inner.free) {
      this.inner.free();
    }
    this.listeners = [];
  }
}

/**
 * Feature flag to enable/disable Rust controller
 */
export const USE_RUST_CONTROLLER = 
  process.env.USE_RUST_CONTROLLER === "true" ||
  (typeof window !== "undefined" && 
   new URLSearchParams(window.location.search).get("rust") === "true");

/**
 * Factory function to create the appropriate controller
 */
export async function createSpreadsheetController(
  options: SpreadsheetControllerOptions | SpreadsheetFacade
): Promise<any> {
  if (USE_RUST_CONTROLLER) {
    await initializeWasm();
    return new RustSpreadsheetController(options);
  } else {
    // Import TypeScript implementation dynamically
    const { SpreadsheetController } = await import("../controllers/SpreadsheetController");
    return new SpreadsheetController(options);
  }
}