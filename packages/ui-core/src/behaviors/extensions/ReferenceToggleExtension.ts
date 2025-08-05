import { ReferenceAdjuster, ReferenceDetector, type CellReference } from "@gridcore/core";
import type { UIState } from "../../state/UIState";
import { isEditingMode } from "../../state/UIState";
import type { CellVimAction, KeyMeta } from "../VimBehavior";

/**
 * Extension that handles F4 key cycling through reference types
 * and reference-related commands during formula editing.
 */
export class ReferenceToggleExtension {
  private detector: ReferenceDetector;
  private adjuster: ReferenceAdjuster;

  constructor() {
    this.detector = new ReferenceDetector();
    this.adjuster = new ReferenceAdjuster();
  }
  /**
   * Handles key presses related to reference operations.
   * Returns a CellVimAction if the key is handled, null otherwise.
   */
  handleKeyPress(
    key: string,
    meta: KeyMeta,
    state: UIState,
  ): CellVimAction | null {
    if (!isEditingMode(state)) {
      return null;
    }

    // Handle F4 key for reference cycling
    if (
      key === "F4" ||
      key === "f4" ||
      meta.key === "F4" ||
      meta.key === "f4"
    ) {
      return this.handleF4Cycling(state);
    }

    return null;
  }

  /**
   * Handles F4 key cycling through reference types.
   * Finds the reference at or before the cursor and cycles its type.
   */
  private handleF4Cycling(state: UIState): CellVimAction {
    if (!isEditingMode(state)) {
      return { type: "none" };
    }

    const text = state.editingValue;
    const cursorPos = state.cursorPosition;

    // Find reference at or near cursor position
    const exactRef = this.detector.findReferenceAtPosition(text, cursorPos);
    const targetRef =
      exactRef || this.detector.findPreviousReference(text, cursorPos);

    if (!targetRef) {
      return { type: "none" };
    }

    try {
      // Cycle the reference type
      const cycledReference = this.adjuster.cycleReferenceType(
        targetRef.reference,
      );

      // Format the new reference back to text
      const newReferenceText = this.formatCellReference(cycledReference);

      // Use the detector's replace method to handle the replacement
      const replaceResult = this.detector.replaceReferenceAtPosition(
        text,
        targetRef.position,
        newReferenceText,
      );

      if (replaceResult) {
        // Return a composite action that replaces the text and positions cursor
        // First delete the old text, then insert the new text
        // We return the delete action and expect the caller to handle insertion
        return {
          type: "replaceFormula",
          newFormula: replaceResult.formula,
          newCursorPosition: replaceResult.newPosition,
        } as CellVimAction;
      }

      return { type: "none" };
    } catch (_error) {
      // If anything fails, do nothing
      return { type: "none" };
    }
  }

  /**
   * Format a cell reference back to string representation.
   */
  private formatCellReference(ref: CellReference): string {
    const colStr = this.numberToColumn(ref.column);
    const rowStr = (ref.row + 1).toString(); // Convert 0-based to 1-based

    const col = ref.columnAbsolute ? `$${colStr}` : colStr;
    const row = ref.rowAbsolute ? `$${rowStr}` : rowStr;

    const cellRef = `${col}${row}`;

    return ref.sheet ? `${ref.sheet}!${cellRef}` : cellRef;
  }

  /**
   * Convert column number to letter representation (0 = A, 1 = B, etc.)
   */
  private numberToColumn(colNum: number): string {
    let result = "";
    let num = colNum;

    while (num >= 0) {
      result = String.fromCharCode(65 + (num % 26)) + result;
      num = Math.floor(num / 26) - 1;
      if (num < 0) break;
    }

    return result;
  }

  /**
   * Finds the next reference in the text after the current cursor position.
   * Used for ]r navigation command.
   */
  findNextReference(
    text: string,
    cursorPos: number,
  ): { startPos: number; endPos: number } | null {
    const nextRef = this.detector.findNextReference(text, cursorPos);
    if (nextRef) {
      return {
        startPos: nextRef.position,
        endPos: nextRef.position + nextRef.length,
      };
    }
    return null;
  }

  /**
   * Finds the previous reference in the text before the current cursor position.
   * Used for [r navigation command.
   */
  findPreviousReference(
    text: string,
    cursorPos: number,
  ): { startPos: number; endPos: number } | null {
    const prevRef = this.detector.findPreviousReference(text, cursorPos);
    if (prevRef) {
      return {
        startPos: prevRef.position,
        endPos: prevRef.position + prevRef.length,
      };
    }
    return null;
  }

  /**
   * Gets the boundaries of a reference text object at the cursor position.
   * Used for 'ir' (inner reference) and 'ar' (around reference) text objects.
   */
  getReferenceTextObject(
    text: string,
    cursorPos: number,
    includeSpaces: boolean = false,
  ): { start: number; end: number } | null {
    const exactRef = this.detector.findReferenceAtPosition(text, cursorPos);

    if (!exactRef) {
      return null;
    }

    let startPos = exactRef.position;
    let endPos = exactRef.position + exactRef.length;

    if (includeSpaces) {
      // For 'ar' - include surrounding whitespace
      while (startPos > 0 && text[startPos - 1] === " ") {
        startPos--;
      }
      while (endPos < text.length && text[endPos] === " ") {
        endPos++;
      }
    }

    return { start: startPos, end: endPos };
  }
}
