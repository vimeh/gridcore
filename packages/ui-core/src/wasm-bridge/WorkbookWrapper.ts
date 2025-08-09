// Import WASM functions from gridcore-core
import * as wasm from "gridcore-core";
import type { CellAddress } from "../types";
import { FacadeWrapper } from "./FacadeWrapper";

/**
 * TypeScript wrapper for the WASM Workbook
 * Manages multiple sheets and provides cross-sheet operations
 */
export class WorkbookWrapper {
  private workbookId: number;
  private disposed: boolean = false;
  private facadeCache: Map<string, FacadeWrapper> = new Map();

  constructor(initialSheetName?: string) {
    if (initialSheetName) {
      this.workbookId = wasm.createWorkbookWithSheet(initialSheetName);
    } else {
      this.workbookId = wasm.createWorkbook();
    }
  }

  /**
   * Destroy the workbook and free its resources
   */
  dispose(): void {
    if (!this.disposed) {
      // Dispose all cached facades
      for (const facade of this.facadeCache.values()) {
        facade.dispose();
      }
      this.facadeCache.clear();

      wasm.destroyWorkbook(this.workbookId);
      this.disposed = true;
    }
  }

  /**
   * Get the number of sheets
   */
  getSheetCount(): number {
    this.checkDisposed();
    return wasm.workbookGetSheetCount(this.workbookId);
  }

  /**
   * Get all sheet names
   */
  getSheetNames(): string[] {
    this.checkDisposed();
    return wasm.workbookGetSheetNames(this.workbookId);
  }

  /**
   * Create a new sheet
   */
  createSheet(name: string): void {
    this.checkDisposed();
    wasm.workbookCreateSheet(this.workbookId, name);
  }

  /**
   * Delete a sheet
   */
  deleteSheet(name: string): void {
    this.checkDisposed();

    // Remove from cache if present
    const facade = this.facadeCache.get(name);
    if (facade) {
      facade.dispose();
      this.facadeCache.delete(name);
    }

    wasm.workbookDeleteSheet(this.workbookId, name);
  }

  /**
   * Rename a sheet
   */
  renameSheet(oldName: string, newName: string): void {
    this.checkDisposed();

    // Update cache if present
    const facade = this.facadeCache.get(oldName);
    if (facade) {
      this.facadeCache.delete(oldName);
      this.facadeCache.set(newName, facade);
    }

    wasm.workbookRenameSheet(this.workbookId, oldName, newName);
  }

  /**
   * Get the active sheet name
   */
  getActiveSheetName(): string | null {
    this.checkDisposed();
    return wasm.workbookGetActiveSheetName(this.workbookId);
  }

  /**
   * Set the active sheet
   */
  setActiveSheet(name: string): void {
    this.checkDisposed();
    wasm.workbookSetActiveSheet(this.workbookId, name);
  }

  /**
   * Get a facade for a specific sheet
   */
  getSheetFacade(sheetName: string): FacadeWrapper {
    this.checkDisposed();

    // Return cached facade if available
    let facade = this.facadeCache.get(sheetName);
    if (facade) {
      return facade;
    }

    // Create new facade
    const facadeId = wasm.workbookGetSheetFacade(this.workbookId, sheetName);
    facade = new FacadeWrapperFromId(facadeId);
    this.facadeCache.set(sheetName, facade);

    return facade;
  }

  /**
   * Get the active sheet's facade
   */
  getActiveFacade(): FacadeWrapper {
    this.checkDisposed();

    const activeSheet = this.getActiveSheetName();
    if (!activeSheet) {
      throw new Error("No active sheet");
    }

    return this.getSheetFacade(activeSheet);
  }

  /**
   * Copy a sheet
   */
  copySheet(sourceName: string, newName: string): void {
    this.checkDisposed();
    wasm.workbookCopySheet(this.workbookId, sourceName, newName);
  }

  /**
   * Move a sheet to a different position
   */
  moveSheet(sheetName: string, newIndex: number): void {
    this.checkDisposed();
    wasm.workbookMoveSheet(this.workbookId, sheetName, newIndex);
  }

  /**
   * Get a cell value from a specific sheet
   */
  getCellValue(sheetName: string, address: CellAddress): any {
    this.checkDisposed();
    return wasm.workbookGetCellValue(this.workbookId, sheetName, address);
  }

  /**
   * Set a cell value in a specific sheet
   */
  setCellValue(sheetName: string, address: CellAddress, value: string): void {
    this.checkDisposed();
    wasm.workbookSetCellValue(this.workbookId, sheetName, address, value);
  }

  private checkDisposed(): void {
    if (this.disposed) {
      throw new Error("WorkbookWrapper has been disposed");
    }
  }
}

/**
 * Internal FacadeWrapper that takes an existing facade ID
 * Used by WorkbookWrapper to wrap facades created from sheets
 */
class FacadeWrapperFromId extends FacadeWrapper {
  constructor(facadeId: number) {
    // Don't call super() as it would create a new facade
    (this as any).facadeId = facadeId;
    (this as any).disposed = false;
  }
}

// Provide compatibility export for migration
export class WasmWorkbook extends WorkbookWrapper {
  constructor() {
    super();
    console.warn("WasmWorkbook is deprecated, use WorkbookWrapper instead");
  }
}
