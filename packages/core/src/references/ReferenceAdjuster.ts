import type { CellAddress } from "../domain/models/CellAddress";
import { err, ok, type Result } from "../shared/types/Result";
import {
  type AdjustmentOptions,
  type AdjustmentResult,
  type CellReference,
  type FillDirection,
  type RangeReference,
  RefError,
} from "./types";

/**
 * Handles adjustment of cell and range references for copy/paste, fill operations,
 * and reference type cycling (F4 functionality).
 */
export class ReferenceAdjuster {
  private static readonly DEFAULT_MAX_COLUMN = 16383; // XFD
  private static readonly DEFAULT_MAX_ROW = 1048575; // 1048576 - 1

  /**
   * Adjust a cell reference when copying from source to target location.
   */
  adjustForCopy(
    ref: CellReference,
    source: CellAddress,
    target: CellAddress,
    options: AdjustmentOptions = {},
  ): Result<AdjustmentResult, RefError> {
    const colDelta = target.col - source.col;
    const rowDelta = target.row - source.row;

    return this.adjustReference(ref, colDelta, rowDelta, options);
  }

  /**
   * Adjust a cell reference for fill operations.
   */
  adjustForFill(
    ref: CellReference,
    fillStart: CellAddress,
    fillTarget: CellAddress,
    fillDirection: FillDirection,
    options: AdjustmentOptions = {},
  ): Result<AdjustmentResult, RefError> {
    let colDelta = 0;
    let rowDelta = 0;

    switch (fillDirection) {
      case "down":
        rowDelta = fillTarget.row - fillStart.row;
        break;
      case "up":
        rowDelta = fillTarget.row - fillStart.row;
        break;
      case "right":
        colDelta = fillTarget.col - fillStart.col;
        break;
      case "left":
        colDelta = fillTarget.col - fillStart.col;
        break;
    }

    return this.adjustReference(ref, colDelta, rowDelta, options);
  }

  /**
   * Adjust a range reference by adjusting both start and end cells.
   */
  adjustRangeForCopy(
    range: RangeReference,
    source: CellAddress,
    target: CellAddress,
    options: AdjustmentOptions = {},
  ): Result<{ start: AdjustmentResult; end: AdjustmentResult }, RefError> {
    const startResult = this.adjustForCopy(
      range.start,
      source,
      target,
      options,
    );
    if (!startResult.ok) {
      return err(startResult.error);
    }

    const endResult = this.adjustForCopy(range.end, source, target, options);
    if (!endResult.ok) {
      return err(endResult.error);
    }

    return ok({
      start: startResult.value,
      end: endResult.value,
    }) as Result<{ start: AdjustmentResult; end: AdjustmentResult }, RefError>;
  }

  /**
   * Cycle through reference types for F4 functionality.
   * Cycles: A1 → $A$1 → A$1 → $A1 → A1
   */
  cycleReferenceType(ref: CellReference): CellReference {
    const { columnAbsolute, rowAbsolute } = ref;

    if (!columnAbsolute && !rowAbsolute) {
      // A1 → $A$1 (both absolute)
      return { ...ref, columnAbsolute: true, rowAbsolute: true };
    }

    if (columnAbsolute && rowAbsolute) {
      // $A$1 → A$1 (row absolute only)
      return { ...ref, columnAbsolute: false, rowAbsolute: true };
    }

    if (!columnAbsolute && rowAbsolute) {
      // A$1 → $A1 (column absolute only)
      return { ...ref, columnAbsolute: true, rowAbsolute: false };
    }

    // $A1 → A1 (both relative)
    return { ...ref, columnAbsolute: false, rowAbsolute: false };
  }

  /**
   * Set reference type explicitly.
   */
  setReferenceType(
    ref: CellReference,
    columnAbsolute: boolean,
    rowAbsolute: boolean,
  ): CellReference {
    return {
      ...ref,
      columnAbsolute,
      rowAbsolute,
    };
  }

  /**
   * Make all components of a reference relative.
   */
  makeRelative(ref: CellReference): CellReference {
    return this.setReferenceType(ref, false, false);
  }

  /**
   * Make all components of a reference absolute.
   */
  makeAbsolute(ref: CellReference): CellReference {
    return this.setReferenceType(ref, true, true);
  }

  /**
   * Make column absolute, row relative.
   */
  makeMixedColumn(ref: CellReference): CellReference {
    return this.setReferenceType(ref, true, false);
  }

  /**
   * Make row absolute, column relative.
   */
  makeMixedRow(ref: CellReference): CellReference {
    return this.setReferenceType(ref, false, true);
  }

  /**
   * Core reference adjustment logic.
   */
  private adjustReference(
    ref: CellReference,
    colDelta: number,
    rowDelta: number,
    options: AdjustmentOptions = {},
  ): Result<AdjustmentResult, RefError> {
    const {
      adjustAbsolute = false,
      clampToBounds = true,
      maxColumn = ReferenceAdjuster.DEFAULT_MAX_COLUMN,
      maxRow = ReferenceAdjuster.DEFAULT_MAX_ROW,
    } = options;

    let newColumn = ref.column;
    let newRow = ref.row;
    let changed = false;
    let clamped = false;

    // Adjust column if it's relative or if adjustAbsolute is true
    if (!ref.columnAbsolute || adjustAbsolute) {
      newColumn = ref.column + colDelta;
      if (newColumn !== ref.column) {
        changed = true;
      }
    }

    // Adjust row if it's relative or if adjustAbsolute is true
    if (!ref.rowAbsolute || adjustAbsolute) {
      newRow = ref.row + rowDelta;
      if (newRow !== ref.row) {
        changed = true;
      }
    }

    // Handle bounds checking
    if (clampToBounds) {
      if (newColumn < 0) {
        newColumn = 0;
        clamped = true;
      } else if (newColumn > maxColumn) {
        newColumn = maxColumn;
        clamped = true;
      }

      if (newRow < 0) {
        newRow = 0;
        clamped = true;
      } else if (newRow > maxRow) {
        newRow = maxRow;
        clamped = true;
      }
    } else {
      // Strict bounds checking - return error if out of bounds
      if (
        newColumn < 0 ||
        newColumn > maxColumn ||
        newRow < 0 ||
        newRow > maxRow
      ) {
        return err(RefError.OUT_OF_BOUNDS);
      }
    }

    const adjustedRef: CellReference = {
      ...ref,
      column: newColumn,
      row: newRow,
    };

    return ok({
      reference: adjustedRef,
      changed,
      clamped,
    }) as Result<AdjustmentResult, RefError>;
  }

  /**
   * Batch adjust multiple references with the same delta.
   */
  batchAdjustForCopy(
    references: CellReference[],
    source: CellAddress,
    target: CellAddress,
    options: AdjustmentOptions = {},
  ): Result<AdjustmentResult[], RefError> {
    const results: AdjustmentResult[] = [];

    for (const ref of references) {
      const result = this.adjustForCopy(ref, source, target, options);
      if (!result.ok) {
        return err(result.error);
      }
      results.push(result.value);
    }

    return ok(results) as Result<AdjustmentResult[], RefError>;
  }

  /**
   * Check if a reference adjustment would go out of bounds.
   */
  wouldBeOutOfBounds(
    ref: CellReference,
    colDelta: number,
    rowDelta: number,
    options: AdjustmentOptions = {},
  ): boolean {
    const {
      adjustAbsolute = false,
      maxColumn = ReferenceAdjuster.DEFAULT_MAX_COLUMN,
      maxRow = ReferenceAdjuster.DEFAULT_MAX_ROW,
    } = options;

    let newColumn = ref.column;
    let newRow = ref.row;

    if (!ref.columnAbsolute || adjustAbsolute) {
      newColumn = ref.column + colDelta;
    }

    if (!ref.rowAbsolute || adjustAbsolute) {
      newRow = ref.row + rowDelta;
    }

    return (
      newColumn < 0 || newColumn > maxColumn || newRow < 0 || newRow > maxRow
    );
  }
}
