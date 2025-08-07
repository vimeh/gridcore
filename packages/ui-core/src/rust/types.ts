/**
 * TypeScript type definitions that mirror the Rust types
 * These are used for WASM interop
 */

// Import types for use in this file
import type {
  CellMode,
  InsertMode,
  Selection,
  SelectionType,
  SpreadsheetVisualMode,
  UIState,
  ViewportInfo,
  VisualMode,
} from "../state/UIState";

import type { Action } from "../state/UIStateMachine";

// Re-export the types
export type {
  CellMode,
  InsertMode,
  Selection,
  SelectionType,
  SpreadsheetVisualMode,
  UIState,
  ViewportInfo,
  VisualMode,
} from "../state/UIState";

export type { Action } from "../state/UIStateMachine";

// Additional types for WASM interop

export interface RustKeyboardEvent {
  key: string;
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
  meta: boolean;
}

export interface RustMouseEvent {
  x: number;
  y: number;
  button: "left" | "middle" | "right" | "none";
  event_type: "down" | "up" | "move" | "click" | "doubleclick" | "wheel";
}

export interface RustSpreadsheetEvent {
  type: string;
  [key: string]: any;
}

// State types that might differ slightly from TypeScript version

export type RustSpreadsheetMode = 
  | "Navigation"
  | "Editing"
  | "Command"
  | "Visual"
  | "Resize"
  | "Insert"
  | "Delete"
  | "BulkOperation";

// Helper types for conversion

export interface StateConverter {
  toRust(state: UIState): any;
  fromRust(state: any): UIState;
}

export interface ActionConverter {
  toRust(action: Action): any;
  fromRust(action: any): Action;
}