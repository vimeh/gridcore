/* tslint:disable */
/* eslint-disable */
export function init(): void;
export function version(): string;
export function createFillOperation(source_start_col: number, source_start_row: number, source_end_col: number, source_end_row: number, target_start_col: number, target_start_row: number, target_end_col: number, target_end_row: number, direction: string): any;
/**
 * Parse a formula directly (convenience function)
 */
export function parseFormula(formula: string): any;
export class WasmCell {
  free(): void;
  constructor(value: any);
  static empty(): WasmCell;
  hasFormula(): boolean;
  hasError(): boolean;
  isEmpty(): boolean;
  getRawValue(): any;
  getComputedValue(): any;
  getError(): string | undefined;
  toJson(): any;
}
export class WasmCellAddress {
  free(): void;
  constructor(col: number, row: number);
  static fromString(s: string): WasmCellAddress;
  toString(): string;
  offset(row_offset: number, col_offset: number): WasmCellAddress;
  equals(other: WasmCellAddress): boolean;
  columnLabel(): string;
  readonly col: number;
  readonly row: number;
}
export class WasmCellRepository {
  free(): void;
  constructor();
  get(address: WasmCellAddress): WasmCell | undefined;
  set(address: WasmCellAddress, cell: WasmCell): void;
  delete(address: WasmCellAddress): boolean;
  clear(): void;
  contains(address: WasmCellAddress): boolean;
  isEmpty(): boolean;
  getCount(): number;
  getAllAddresses(): WasmCellAddress[];
}
export class WasmCellValue {
  free(): void;
  constructor();
  static fromNumber(value: number): WasmCellValue;
  static fromString(value: string): WasmCellValue;
  static fromBoolean(value: boolean): WasmCellValue;
  static fromError(message: string): WasmCellValue;
  static fromJS(value: any): WasmCellValue;
  toJS(): any;
  isNumber(): boolean;
  isString(): boolean;
  isBoolean(): boolean;
  isEmpty(): boolean;
  isError(): boolean;
  toString(): string;
}
/**
 * WASM-compatible evaluation context that calls back to JavaScript
 */
export class WasmEvaluationContext {
  free(): void;
  constructor(get_cell_value_callback: Function);
}
/**
 * WASM wrapper for the formula evaluator
 */
export class WasmEvaluator {
  free(): void;
  constructor();
  /**
   * Evaluate a formula string
   */
  evaluate(formula: string, get_cell_value: Function): any;
  /**
   * Evaluate a formula that's already been parsed
   */
  evaluateAST(ast_json: any, get_cell_value: Function): any;
  /**
   * Check if a formula has circular dependencies
   */
  checkCircular(formula: string, current_cell: string, get_dependencies: Function): boolean;
}
export class WasmFillOperation {
  free(): void;
  constructor(source_start_col: number, source_start_row: number, source_end_col: number, source_end_row: number, target_start_col: number, target_start_row: number, target_end_col: number, target_end_row: number, direction: string);
  setPattern(pattern: string, param?: number | null): void;
  toInternal(): any;
}
/**
 * WASM wrapper for formula parsing
 */
export class WasmFormulaParser {
  free(): void;
  /**
   * Create a new formula parser
   */
  constructor();
  /**
   * Parse a formula string into an AST
   * Returns a JavaScript object representing the AST
   */
  parse(formula: string): any;
  /**
   * Parse a formula and return it as a JSON string
   */
  parseToJson(formula: string): string;
}
/**
 * WASM wrapper for Sheet
 */
export class WasmSheet {
  private constructor();
  free(): void;
  /**
   * Get the sheet name
   */
  getName(): string;
  /**
   * Get cell count
   */
  getCellCount(): number;
  /**
   * Set visibility
   */
  setVisible(visible: boolean): void;
  /**
   * Set protection
   */
  setProtected(_protected: boolean): void;
  /**
   * Get column width
   */
  getColumnWidth(column: number): number;
  /**
   * Set column width
   */
  setColumnWidth(column: number, width: number): void;
  /**
   * Get row height
   */
  getRowHeight(row: number): number;
  /**
   * Set row height
   */
  setRowHeight(row: number, height: number): void;
  /**
   * Clear all cells
   */
  clear(): void;
}
/**
 * WASM wrapper for SheetManager (for advanced cross-sheet operations)
 */
export class WasmSheetManager {
  free(): void;
  /**
   * Create a new sheet manager
   */
  constructor();
  /**
   * Get workbook statistics
   */
  getStatistics(): any;
}
/**
 * WASM wrapper for SpreadsheetFacade
 */
export class WasmSpreadsheetFacade {
  free(): void;
  /**
   * Create a new spreadsheet facade
   */
  constructor();
  /**
   * Set the callback for cell update events
   */
  onCellUpdate(callback: Function): void;
  /**
   * Set the callback for batch complete events
   */
  onBatchComplete(callback: Function): void;
  /**
   * Set the callback for calculation complete events
   */
  onCalculationComplete(callback: Function): void;
  /**
   * Set a cell value
   */
  setCellValue(address: WasmCellAddress, value: string): WasmCell;
  /**
   * Get a cell value
   */
  getCellValue(address: WasmCellAddress): any;
  /**
   * Get a cell
   */
  getCell(address: WasmCellAddress): WasmCell | undefined;
  /**
   * Get a cell formula
   */
  getCellFormula(address: WasmCellAddress): string | undefined;
  /**
   * Delete a cell
   */
  deleteCell(address: WasmCellAddress): void;
  /**
   * Clear a cell (sets it to empty but keeps the cell)
   */
  clearCell(address: WasmCellAddress): void;
  /**
   * Recalculate all cells
   */
  recalculate(): void;
  /**
   * Recalculate a specific cell
   */
  recalculateCell(address: WasmCellAddress): WasmCell;
  /**
   * Begin a batch operation
   */
  beginBatch(batch_id?: string | null): string;
  /**
   * Commit a batch operation
   */
  commitBatch(batch_id: string): void;
  /**
   * Rollback a batch operation
   */
  rollbackBatch(batch_id: string): void;
  /**
   * Clear all cells
   */
  clear(): void;
  /**
   * Get the number of cells
   */
  getCellCount(): number;
  /**
   * Perform a fill operation
   */
  fill(operation_js: any): any;
  /**
   * Preview a fill operation without applying it
   */
  previewFill(operation_js: any): any;
  /**
   * Set multiple cell values in a batch
   */
  setCellValues(updates: any): void;
  /**
   * Insert a row at the specified index
   */
  insertRow(row_index: number): void;
  /**
   * Delete a row at the specified index
   */
  deleteRow(row_index: number): void;
  /**
   * Insert a column at the specified index
   */
  insertColumn(col_index: number): void;
  /**
   * Delete a column at the specified index
   */
  deleteColumn(col_index: number): void;
  /**
   * Undo the last operation
   */
  undo(): void;
  /**
   * Redo the last undone operation
   */
  redo(): void;
  /**
   * Check if undo is available
   */
  canUndo(): boolean;
  /**
   * Check if redo is available
   */
  canRedo(): boolean;
  /**
   * Get undo history descriptions
   */
  getUndoHistory(): Array<any>;
  /**
   * Get redo history descriptions
   */
  getRedoHistory(): Array<any>;
  /**
   * Clear undo/redo history
   */
  clearHistory(): void;
}
/**
 * WASM wrapper for Workbook
 */
export class WasmWorkbook {
  free(): void;
  /**
   * Create a new workbook with default sheet
   */
  constructor();
  /**
   * Create a new workbook with a named sheet
   */
  static withSheet(sheet_name: string): WasmWorkbook;
  /**
   * Get the number of sheets
   */
  getSheetCount(): number;
  /**
   * Get all sheet names
   */
  getSheetNames(): Array<any>;
  /**
   * Create a new sheet
   */
  createSheet(name: string): void;
  /**
   * Delete a sheet
   */
  deleteSheet(name: string): void;
  /**
   * Rename a sheet
   */
  renameSheet(old_name: string, new_name: string): void;
  /**
   * Get the active sheet name
   */
  getActiveSheetName(): any;
  /**
   * Set the active sheet
   */
  setActiveSheet(name: string): void;
  /**
   * Get a facade for a specific sheet
   */
  getSheetFacade(sheet_name: string): WasmSpreadsheetFacade;
  /**
   * Get the active sheet's facade
   */
  getActiveFacade(): WasmSpreadsheetFacade;
  /**
   * Copy a sheet
   */
  copySheet(source_name: string, new_name: string): void;
  /**
   * Move a sheet to a different position
   */
  moveSheet(sheet_name: string, new_index: number): void;
  /**
   * Get a cell value from a specific sheet
   */
  getCellValue(sheet_name: string, address: WasmCellAddress): any;
  /**
   * Set a cell value in a specific sheet
   */
  setCellValue(sheet_name: string, address: WasmCellAddress, value: string): void;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly init: () => void;
  readonly version: (a: number) => void;
  readonly __wbg_wasmcell_free: (a: number, b: number) => void;
  readonly wasmcell_new: (a: number, b: number) => void;
  readonly wasmcell_empty: () => number;
  readonly wasmcell_hasFormula: (a: number) => number;
  readonly wasmcell_hasError: (a: number) => number;
  readonly wasmcell_isEmpty: (a: number) => number;
  readonly wasmcell_getRawValue: (a: number) => number;
  readonly wasmcell_getComputedValue: (a: number) => number;
  readonly wasmcell_getError: (a: number, b: number) => void;
  readonly wasmcell_toJson: (a: number, b: number) => void;
  readonly __wbg_wasmevaluationcontext_free: (a: number, b: number) => void;
  readonly wasmevaluationcontext_new: (a: number) => number;
  readonly __wbg_wasmevaluator_free: (a: number, b: number) => void;
  readonly wasmevaluator_new: () => number;
  readonly wasmevaluator_evaluate: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly wasmevaluator_evaluateAST: (a: number, b: number, c: number, d: number) => void;
  readonly wasmevaluator_checkCircular: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
  readonly __wbg_wasmspreadsheetfacade_free: (a: number, b: number) => void;
  readonly wasmspreadsheetfacade_new: () => number;
  readonly wasmspreadsheetfacade_onCellUpdate: (a: number, b: number) => void;
  readonly wasmspreadsheetfacade_onBatchComplete: (a: number, b: number) => void;
  readonly wasmspreadsheetfacade_onCalculationComplete: (a: number, b: number) => void;
  readonly wasmspreadsheetfacade_setCellValue: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly wasmspreadsheetfacade_getCellValue: (a: number, b: number, c: number) => void;
  readonly wasmspreadsheetfacade_getCell: (a: number, b: number) => number;
  readonly wasmspreadsheetfacade_getCellFormula: (a: number, b: number, c: number) => void;
  readonly wasmspreadsheetfacade_deleteCell: (a: number, b: number, c: number) => void;
  readonly wasmspreadsheetfacade_clearCell: (a: number, b: number, c: number) => void;
  readonly wasmspreadsheetfacade_recalculate: (a: number, b: number) => void;
  readonly wasmspreadsheetfacade_recalculateCell: (a: number, b: number, c: number) => void;
  readonly wasmspreadsheetfacade_beginBatch: (a: number, b: number, c: number, d: number) => void;
  readonly wasmspreadsheetfacade_commitBatch: (a: number, b: number, c: number, d: number) => void;
  readonly wasmspreadsheetfacade_rollbackBatch: (a: number, b: number, c: number, d: number) => void;
  readonly wasmspreadsheetfacade_clear: (a: number) => void;
  readonly wasmspreadsheetfacade_getCellCount: (a: number) => number;
  readonly wasmspreadsheetfacade_fill: (a: number, b: number, c: number) => void;
  readonly wasmspreadsheetfacade_previewFill: (a: number, b: number, c: number) => void;
  readonly wasmspreadsheetfacade_setCellValues: (a: number, b: number, c: number) => void;
  readonly wasmspreadsheetfacade_insertRow: (a: number, b: number, c: number) => void;
  readonly wasmspreadsheetfacade_deleteRow: (a: number, b: number, c: number) => void;
  readonly wasmspreadsheetfacade_insertColumn: (a: number, b: number, c: number) => void;
  readonly wasmspreadsheetfacade_deleteColumn: (a: number, b: number, c: number) => void;
  readonly wasmspreadsheetfacade_undo: (a: number, b: number) => void;
  readonly wasmspreadsheetfacade_redo: (a: number, b: number) => void;
  readonly wasmspreadsheetfacade_canUndo: (a: number) => number;
  readonly wasmspreadsheetfacade_canRedo: (a: number) => number;
  readonly wasmspreadsheetfacade_getUndoHistory: (a: number, b: number) => void;
  readonly wasmspreadsheetfacade_getRedoHistory: (a: number, b: number) => void;
  readonly wasmspreadsheetfacade_clearHistory: (a: number) => void;
  readonly __wbg_wasmfilloperation_free: (a: number, b: number) => void;
  readonly wasmfilloperation_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => number;
  readonly wasmfilloperation_setPattern: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly wasmfilloperation_toInternal: (a: number, b: number) => void;
  readonly createFillOperation: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number) => void;
  readonly wasmformulaparser_parse: (a: number, b: number, c: number, d: number) => void;
  readonly wasmformulaparser_parseToJson: (a: number, b: number, c: number, d: number) => void;
  readonly parseFormula: (a: number, b: number, c: number) => void;
  readonly __wbg_wasmcellrepository_free: (a: number, b: number) => void;
  readonly wasmcellrepository_new: () => number;
  readonly wasmcellrepository_get: (a: number, b: number) => number;
  readonly wasmcellrepository_set: (a: number, b: number, c: number, d: number) => void;
  readonly wasmcellrepository_delete: (a: number, b: number) => number;
  readonly wasmcellrepository_clear: (a: number) => void;
  readonly wasmcellrepository_contains: (a: number, b: number) => number;
  readonly wasmcellrepository_isEmpty: (a: number) => number;
  readonly wasmcellrepository_getCount: (a: number) => number;
  readonly wasmcellrepository_getAllAddresses: (a: number, b: number) => void;
  readonly __wbg_wasmcelladdress_free: (a: number, b: number) => void;
  readonly wasmcelladdress_new: (a: number, b: number) => number;
  readonly wasmcelladdress_fromString: (a: number, b: number, c: number) => void;
  readonly wasmcelladdress_toString: (a: number, b: number) => void;
  readonly wasmcelladdress_col: (a: number) => number;
  readonly wasmcelladdress_row: (a: number) => number;
  readonly wasmcelladdress_offset: (a: number, b: number, c: number, d: number) => void;
  readonly wasmcelladdress_equals: (a: number, b: number) => number;
  readonly wasmcelladdress_columnLabel: (a: number, b: number) => void;
  readonly __wbg_wasmcellvalue_free: (a: number, b: number) => void;
  readonly wasmcellvalue_new: () => number;
  readonly wasmcellvalue_fromNumber: (a: number) => number;
  readonly wasmcellvalue_fromString: (a: number, b: number) => number;
  readonly wasmcellvalue_fromBoolean: (a: number) => number;
  readonly wasmcellvalue_fromError: (a: number, b: number) => number;
  readonly wasmcellvalue_fromJS: (a: number, b: number) => void;
  readonly wasmcellvalue_toJS: (a: number) => number;
  readonly wasmcellvalue_isNumber: (a: number) => number;
  readonly wasmcellvalue_isString: (a: number) => number;
  readonly wasmcellvalue_isBoolean: (a: number) => number;
  readonly wasmcellvalue_isEmpty: (a: number) => number;
  readonly wasmcellvalue_isError: (a: number) => number;
  readonly wasmcellvalue_toString: (a: number, b: number) => void;
  readonly __wbg_wasmsheet_free: (a: number, b: number) => void;
  readonly wasmsheet_getName: (a: number, b: number) => void;
  readonly wasmsheet_getCellCount: (a: number) => number;
  readonly wasmsheet_setVisible: (a: number, b: number) => void;
  readonly wasmsheet_setProtected: (a: number, b: number) => void;
  readonly wasmsheet_getColumnWidth: (a: number, b: number) => number;
  readonly wasmsheet_setColumnWidth: (a: number, b: number, c: number) => void;
  readonly wasmsheet_getRowHeight: (a: number, b: number) => number;
  readonly wasmsheet_setRowHeight: (a: number, b: number, c: number) => void;
  readonly wasmsheet_clear: (a: number) => void;
  readonly __wbg_wasmworkbook_free: (a: number, b: number) => void;
  readonly wasmworkbook_new: () => number;
  readonly wasmworkbook_withSheet: (a: number, b: number) => number;
  readonly wasmworkbook_getSheetCount: (a: number) => number;
  readonly wasmworkbook_getSheetNames: (a: number) => number;
  readonly wasmworkbook_createSheet: (a: number, b: number, c: number, d: number) => void;
  readonly wasmworkbook_deleteSheet: (a: number, b: number, c: number, d: number) => void;
  readonly wasmworkbook_renameSheet: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
  readonly wasmworkbook_getActiveSheetName: (a: number) => number;
  readonly wasmworkbook_setActiveSheet: (a: number, b: number, c: number, d: number) => void;
  readonly wasmworkbook_getSheetFacade: (a: number, b: number, c: number, d: number) => void;
  readonly wasmworkbook_getActiveFacade: (a: number, b: number) => void;
  readonly wasmworkbook_copySheet: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
  readonly wasmworkbook_moveSheet: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly wasmworkbook_getCellValue: (a: number, b: number, c: number, d: number) => number;
  readonly wasmworkbook_setCellValue: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
  readonly __wbg_wasmsheetmanager_free: (a: number, b: number) => void;
  readonly wasmsheetmanager_new: () => number;
  readonly wasmsheetmanager_getStatistics: (a: number) => number;
  readonly wasmformulaparser_new: () => number;
  readonly __wbg_wasmformulaparser_free: (a: number, b: number) => void;
  readonly __wbindgen_export_0: (a: number, b: number) => number;
  readonly __wbindgen_export_1: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_export_2: (a: number) => void;
  readonly __wbindgen_export_3: (a: number, b: number, c: number) => void;
  readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
