/**
 * TypeScript adapter for Rust WASM core and controller
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
import type { Result } from "../utils/Result";

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
    // Dynamic import of WASM module from ui-web location
    // @ts-ignore - Dynamic import of optional dependency
    const module = await import("/src/wasm/gridcore_wasm.js");
    
    // Initialize WASM module - this loads the WASM binary
    if (module.default) {
      await module.default();
    }
    
    wasmModule = module;
    initialized = true;
    console.log("WASM core initialized successfully");
  } catch (error) {
    console.error("Failed to initialize WASM core:", error);
    throw error;
  }
}

/**
 * Rust SpreadsheetFacade adapter
 * Wraps the WASM facade to provide a compatible interface
 */
export class RustSpreadsheetFacade {
  private workbook: any; // WasmWorkbook instance
  private facade: any; // WasmSpreadsheetFacade instance
  
  constructor() {
    if (!initialized) {
      throw new Error("WASM not initialized. Call initializeWasm() first.");
    }
    
    // Create a new workbook with default sheet
    this.workbook = new wasmModule.WasmWorkbook();
    
    // Get the facade for the active sheet
    this.facade = this.workbook.getActiveFacade();
  }
  
  // SpreadsheetFacade implementation
  
  setCellValue(address: CellAddress, value: any): void {
    const wasmAddress = new wasmModule.WasmCellAddress(address.col, address.row);
    // Convert value to string to match WASM expectations
    // The Rust side will parse it back to the appropriate type
    const stringValue = String(value);
    this.facade.setCellValue(wasmAddress, stringValue);
    wasmAddress.free();
  }
  
  getCellValue(address: CellAddress): any {
    const wasmAddress = new wasmModule.WasmCellAddress(address.col, address.row);
    const value = this.facade.getCellValue(wasmAddress);
    wasmAddress.free();
    return value;
  }
  
  getCellFormula(address: CellAddress): string | null {
    const wasmAddress = new wasmModule.WasmCellAddress(address.col, address.row);
    const formula = this.facade.getCellFormula(wasmAddress);
    wasmAddress.free();
    return formula || null;
  }
  
  getCell(address: CellAddress): any {
    const value = this.getCellValue(address);
    const formula = this.getCellFormula(address);
    return {
      ok: true,
      value: {
        value,
        formula,
        rawValue: formula || value
      }
    };
  }
  
  deleteCells(addresses: CellAddress[]): void {
    for (const address of addresses) {
      const wasmAddress = new wasmModule.WasmCellAddress(address.col, address.row);
      this.facade.deleteCell(wasmAddress);
      wasmAddress.free();
    }
  }
  
  clearCells(addresses: CellAddress[]): void {
    for (const address of addresses) {
      const wasmAddress = new wasmModule.WasmCellAddress(address.col, address.row);
      this.facade.clearCell(wasmAddress);
      wasmAddress.free();
    }
  }
  
  // Workbook-specific methods
  
  createSheet(name: string): void {
    this.workbook.createSheet(name);
  }
  
  deleteSheet(name: string): void {
    this.workbook.deleteSheet(name);
  }
  
  renameSheet(oldName: string, newName: string): void {
    this.workbook.renameSheet(oldName, newName);
  }
  
  getSheetNames(): string[] {
    return Array.from(this.workbook.getSheetNames());
  }
  
  setActiveSheet(name: string): void {
    this.workbook.setActiveSheet(name);
    // Update facade to point to new active sheet
    this.facade = this.workbook.getActiveFacade();
  }
  
  getActiveSheetName(): string | null {
    const name = this.workbook.getActiveSheetName();
    return name === null ? null : name;
  }
  
  // Cross-sheet references
  
  getCellValueFromSheet(sheetName: string, address: CellAddress): any {
    const wasmAddress = new wasmModule.WasmCellAddress(address.col, address.row);
    const value = this.workbook.getCellValue(sheetName, wasmAddress);
    wasmAddress.free();
    return value;
  }
  
  setCellValueInSheet(sheetName: string, address: CellAddress, value: string): void {
    const wasmAddress = new wasmModule.WasmCellAddress(address.col, address.row);
    this.workbook.setCellValue(sheetName, wasmAddress, value);
    wasmAddress.free();
  }
  
  // Cleanup
  
  dispose(): void {
    if (this.facade && this.facade.free) {
      this.facade.free();
    }
    if (this.workbook && this.workbook.free) {
      this.workbook.free();
    }
  }
}

/**
 * Rust SpreadsheetController adapter
 * Implements the same interface as the TypeScript SpreadsheetController
 */
export class RustSpreadsheetController {
  private inner: any; // WasmSpreadsheetController instance
  private facade: RustSpreadsheetFacade;
  private viewportManager: ViewportManager;
  private listeners: Array<(event: ControllerEvent) => void> = [];
  private _state: UIState | null = null;

  constructor(options: SpreadsheetControllerOptions | SpreadsheetFacade) {
    if (!initialized) {
      throw new Error("WASM not initialized. Call initializeWasm() first.");
    }

    // Handle both constructor signatures for backward compatibility
    if ("facade" in options) {
      // Use provided facade or create Rust facade
      if (options.facade instanceof RustSpreadsheetFacade) {
        this.facade = options.facade;
      } else {
        // Wrap TypeScript facade in Rust adapter
        this.facade = new RustSpreadsheetFacade();
      }
      this.viewportManager = options.viewportManager;
    } else {
      // Legacy constructor signature
      this.facade = new RustSpreadsheetFacade();
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

    // Create WASM controller if available
    if (wasmModule.WasmSpreadsheetController) {
      this.inner = new wasmModule.WasmSpreadsheetController();
      
      // Subscribe to WASM events (if implemented)
      if (this.inner.subscribe) {
        this.inner.subscribe((event: any) => {
          this.handleWasmEvent(event);
        });
      }
    }
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

  handleKeydown(event: KeyboardEvent): Result<UIState> {
    try {
      if (this.inner && this.inner.handleKeyboardEvent) {
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
          action: { type: "KeyPress", key: event.key } as any,
        });
        
        return { ok: true, value: this._state as UIState };
      }
      
      // If no inner controller, return current state
      return { ok: true, value: this.getState() };
    } catch (error) {
      console.error("Error handling keyboard event:", error);
      this.notify({
        type: "error",
        error: String(error),
      });
      return { ok: false, error: String(error) };
    }
  }

  // Alias for compatibility with different calling conventions
  handleKeyPress(key: string, modifiers?: { key: string; ctrl: boolean; alt: boolean; shift: boolean }): Result<UIState> {
    // Create a synthetic KeyboardEvent-like object
    const event = new KeyboardEvent("keydown", {
      key: modifiers?.key || key,
      ctrlKey: modifiers?.ctrl || false,
      altKey: modifiers?.alt || false,
      shiftKey: modifiers?.shift || false,
      metaKey: false,
    });
    return this.handleKeydown(event);
  }

  handleMouseEvent(event: MouseEvent, target: HTMLElement): void {
    try {
      if (this.inner && this.inner.handleMouseEvent) {
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
      }
    } catch (error) {
      console.error("Error handling mouse event:", error);
    }
  }

  getState(): UIState {
    if (!this._state) {
      if (this.inner && this.inner.getState) {
        this._state = this.inner.getState();
      } else {
        // Return default state
        this._state = {
          spreadsheetMode: "navigation",
          cursor: { row: 0, col: 0 } as CellAddress,
          viewport: {
            startRow: 0,
            startCol: 0,
            rows: 50,
            cols: 20,
          },
        };
      }
    }
    return this._state as UIState;
  }

  getCursor(): CellAddress {
    if (this.inner && this.inner.getCursor) {
      return this.inner.getCursor();
    }
    return { row: 0, col: 0 } as CellAddress;
  }

  getViewport(): ViewportInfo {
    if (this.inner && this.inner.getViewport) {
      return this.inner.getViewport();
    }
    return {
      startRow: 0,
      startCol: 0,
      rows: 50,
      cols: 20,
    };
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
    this.facade.setCellValue(address, value);
    if (this.inner && this.inner.setCellValue) {
      this.inner.setCellValue(address.col, address.row, value);
    }
  }

  getCellValue(address: CellAddress): any {
    return this.facade.getCellValue(address);
  }

  // Undo/Redo support (if implemented in WASM)
  
  undo(): void {
    if (this.inner && this.inner.undo) {
      this.inner.undo();
    } else {
      console.warn("Undo not yet implemented in Rust controller");
    }
  }

  redo(): void {
    if (this.inner && this.inner.redo) {
      this.inner.redo();
    } else {
      console.warn("Redo not yet implemented in Rust controller");
    }
  }

  canUndo(): boolean {
    if (this.inner && this.inner.canUndo) {
      return this.inner.canUndo();
    }
    return false;
  }

  canRedo(): boolean {
    if (this.inner && this.inner.canRedo) {
      return this.inner.canRedo();
    }
    return false;
  }

  // Cleanup

  dispose(): void {
    this.facade.dispose();
    if (this.inner && this.inner.free) {
      this.inner.free();
    }
    this.listeners = [];
  }
}

/**
 * Feature flag to enable/disable Rust implementation
 */
export const USE_RUST_CORE = 
  (typeof process !== "undefined" && process.env?.USE_RUST_CORE === "true") ||
  (typeof window !== "undefined" && 
   new URLSearchParams(window.location.search).get("rust") === "true");

/**
 * Alias for backward compatibility
 */
export const USE_RUST_CONTROLLER = USE_RUST_CORE;

/**
 * Factory function to create the appropriate facade
 */
export async function createSpreadsheetFacade(): Promise<any> {
  if (USE_RUST_CORE) {
    await initializeWasm();
    return new RustSpreadsheetFacade();
  } else {
    // Import TypeScript implementation dynamically
    const { Workbook } = await import("@gridcore/core");
    const workbook = new Workbook();
    const sheet = workbook.getActiveSheet();
    return sheet?.getFacade();
  }
}

/**
 * Factory function to create the appropriate controller
 */
export async function createSpreadsheetController(
  options: SpreadsheetControllerOptions | SpreadsheetFacade
): Promise<any> {
  if (USE_RUST_CORE) {
    await initializeWasm();
    return new RustSpreadsheetController(options);
  } else {
    // Import TypeScript implementation dynamically
    const { SpreadsheetController } = await import("../controllers/SpreadsheetController");
    return new SpreadsheetController(options);
  }
}