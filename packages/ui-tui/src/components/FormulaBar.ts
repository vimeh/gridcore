import type { ISpreadsheetFacade } from "@gridcore/core";
import {
  FormulaHighlighter,
  type HighlightSegment,
  isCommandMode,
  isEditingMode,
  TUI_HIGHLIGHT_COLORS,
  type UIState,
} from "@gridcore/ui-core";
import { toDisplayState } from "../adapters";
import { type OptimizedBuffer, Renderable } from "../framework";

export class FormulaBarComponent extends Renderable {
  private colors = {
    bg: { r: 24, g: 24, b: 24, a: 255 },
    fg: { r: 255, g: 255, b: 255, a: 255 },
    cellRef: { r: 100, g: 200, b: 255, a: 255 },
    separator: { r: 64, g: 64, b: 64, a: 255 },
    formula: { r: 200, g: 255, b: 200, a: 255 },
    editing: { r: 255, g: 200, b: 100, a: 255 },
    command: { r: 255, g: 255, b: 100, a: 255 },
  };

  private highlighter: FormulaHighlighter;

  constructor(
    private facade: ISpreadsheetFacade,
    private getState: () => UIState,
  ) {
    super("formulaBar");
    this.highlighter = new FormulaHighlighter();
  }

  protected renderSelf(buffer: OptimizedBuffer): void {
    const state = this.getState();
    const displayState = toDisplayState(state);
    const pos = this.getAbsolutePosition();

    // Clear the formula bar area
    buffer.fillRect(
      pos.x,
      pos.y,
      this.width,
      this.height,
      " ",
      this.colors.fg,
      this.colors.bg,
    );

    // Draw the cell reference
    buffer.setText(
      pos.x + 2,
      pos.y,
      displayState.cursorDisplay,
      this.colors.cellRef,
      this.colors.bg,
    );

    // Draw separator
    buffer.setText(
      pos.x + 8,
      pos.y,
      "│",
      this.colors.separator,
      this.colors.bg,
    );

    // Get the content to display
    let displayValue = "";
    let valueColor = this.colors.fg;
    let cursorPosition: number | undefined;

    if (isCommandMode(state)) {
      // Show command input
      displayValue = `:${state.commandValue}`;
      valueColor = this.colors.command;
      cursorPosition = state.commandValue.length + 1; // After the :
    } else if (isEditingMode(state)) {
      // Show editing value with cursor
      displayValue = state.editingValue;
      valueColor = this.colors.editing;
      cursorPosition = state.cursorPosition;

      // Show visual selection if in visual mode
      if (state.cellMode === "visual" && state.visualStart !== undefined) {
        // This would need special rendering to show selection
        // For now, just show the text
      }
    } else {
      // Show current cell value/formula
      const cellResult = this.facade.getCell(state.cursor);
      if (cellResult.ok && cellResult.value) {
        const cell = cellResult.value;
        if (cell.formula) {
          displayValue = cell.formula.toString();
          valueColor = this.colors.formula;
        } else if (cell.value !== null && cell.value !== undefined) {
          displayValue = cell.value.toString();
        }
      }
    }

    // Calculate available width and position
    const contentX = pos.x + 10;
    const maxWidth = this.width - 12;

    // Render with highlighting if this is a formula
    if (
      displayValue.startsWith("=") &&
      (isEditingMode(state) || (!isCommandMode(state) && !isEditingMode(state)))
    ) {
      this.renderHighlightedFormula(
        buffer,
        displayValue,
        contentX,
        pos.y,
        maxWidth,
        cursorPosition,
        displayState.showFormulaCursor,
      );
    } else {
      // Render normal text (commands, non-formulas)
      this.renderNormalText(
        buffer,
        displayValue,
        contentX,
        pos.y,
        maxWidth,
        cursorPosition,
        displayState.showFormulaCursor,
        valueColor,
      );
    }

    // Draw bottom border
    if (this.height > 1) {
      for (let x = pos.x; x < pos.x + this.width; x++) {
        buffer.setChar(x, pos.y + 1, "─", this.colors.separator);
      }
    }
  }

  /**
   * Render a formula with syntax highlighting for references.
   */
  private renderHighlightedFormula(
    buffer: OptimizedBuffer,
    formula: string,
    startX: number,
    y: number,
    maxWidth: number,
    cursorPosition: number | undefined,
    showCursor: boolean,
  ): void {
    const segments = this.highlighter.highlightFormula(formula);

    // Handle scrolling if text is too long
    let visibleStart = 0;
    if (cursorPosition !== undefined && cursorPosition > maxWidth - 5) {
      visibleStart = cursorPosition - maxWidth + 5;
    }

    let currentX = startX;
    let visibleCharCount = 0;

    // Render each segment with appropriate colors
    for (const segment of segments) {
      // Skip segments that are completely before the visible area
      if (segment.end <= visibleStart) {
        continue;
      }

      // Stop if we've filled the available width
      if (visibleCharCount >= maxWidth - 1) {
        break;
      }

      // Calculate the visible portion of this segment
      const segmentStart = Math.max(segment.start, visibleStart);
      const segmentEnd = Math.min(
        segment.end,
        visibleStart + maxWidth - visibleCharCount - 1,
      );
      const visibleText = formula.substring(segmentStart, segmentEnd);

      if (visibleText.length === 0) {
        continue;
      }

      // Determine color for this segment
      const color = this.getSegmentColor(segment);

      // Handle cursor rendering within this segment
      if (
        showCursor &&
        cursorPosition !== undefined &&
        cursorPosition >= segmentStart &&
        cursorPosition < segmentEnd
      ) {
        const beforeCursor = visibleText.substring(
          0,
          cursorPosition - segmentStart,
        );
        const atCursor = visibleText[cursorPosition - segmentStart] || " ";
        const afterCursor = visibleText.substring(
          cursorPosition - segmentStart + 1,
        );

        // Render text before cursor
        if (beforeCursor) {
          buffer.setText(currentX, y, beforeCursor, color, this.colors.bg);
          currentX += beforeCursor.length;
        }

        // Render cursor
        const cursorBg = { r: 255, g: 255, b: 255, a: 255 };
        const cursorFg = { r: 0, g: 0, b: 0, a: 255 };
        buffer.setText(currentX, y, atCursor, cursorFg, cursorBg);
        currentX += 1;

        // Render text after cursor
        if (afterCursor) {
          buffer.setText(currentX, y, afterCursor, color, this.colors.bg);
          currentX += afterCursor.length;
        }
      } else {
        // Render the entire segment without cursor
        buffer.setText(currentX, y, visibleText, color, this.colors.bg);
        currentX += visibleText.length;
      }

      visibleCharCount += visibleText.length;
    }

    // Show scroll indicators if needed
    if (visibleStart > 0) {
      buffer.setText(startX - 1, y, "…", this.colors.separator, this.colors.bg);
    }
    if (visibleStart + visibleCharCount < formula.length) {
      buffer.setText(
        startX + maxWidth - 1,
        y,
        "…",
        this.colors.separator,
        this.colors.bg,
      );
    }
  }

  /**
   * Render normal text (non-formula) with optional cursor.
   */
  private renderNormalText(
    buffer: OptimizedBuffer,
    text: string,
    startX: number,
    y: number,
    maxWidth: number,
    cursorPosition: number | undefined,
    showCursor: boolean,
    color: { r: number; g: number; b: number; a: number },
  ): void {
    // This is the original rendering logic for non-formulas
    if (cursorPosition !== undefined && showCursor) {
      // Split text at cursor position
      const beforeCursor = text.slice(0, cursorPosition);
      const atCursor = text[cursorPosition] || " ";
      const afterCursor = text.slice(cursorPosition + 1);

      // Check if we need to scroll the view
      let visibleStart = 0;
      if (cursorPosition > maxWidth - 5) {
        visibleStart = cursorPosition - maxWidth + 5;
      }

      const visibleBefore = beforeCursor.slice(visibleStart);
      const visibleAfter = afterCursor.slice(
        0,
        maxWidth - visibleBefore.length - 1,
      );

      // Draw text before cursor
      buffer.setText(startX, y, visibleBefore, color, this.colors.bg);

      // Draw cursor
      const cursorX = startX + visibleBefore.length;
      const cursorBg = { r: 255, g: 255, b: 255, a: 255 };
      const cursorFg = { r: 0, g: 0, b: 0, a: 255 };
      buffer.setText(cursorX, y, atCursor, cursorFg, cursorBg);

      // Draw text after cursor
      if (visibleAfter) {
        buffer.setText(cursorX + 1, y, visibleAfter, color, this.colors.bg);
      }

      // Show scroll indicators if needed
      if (visibleStart > 0) {
        buffer.setText(
          startX - 1,
          y,
          "…",
          this.colors.separator,
          this.colors.bg,
        );
      }
      if (cursorPosition + visibleAfter.length < text.length) {
        buffer.setText(
          startX + maxWidth - 1,
          y,
          "…",
          this.colors.separator,
          this.colors.bg,
        );
      }
    } else {
      // Normal display without cursor
      let displayText = text;
      if (displayText.length > maxWidth) {
        displayText = `${displayText.slice(0, maxWidth - 1)}…`;
      }
      buffer.setText(startX, y, displayText, color, this.colors.bg);
    }
  }

  /**
   * Get the appropriate color for a highlight segment.
   */
  private getSegmentColor(segment: HighlightSegment): {
    r: number;
    g: number;
    b: number;
    a: number;
  } {
    if (segment.type === "reference" && segment.referenceType) {
      return this.highlighter.getTUIReferenceColor(segment.referenceType);
    }

    // For non-reference segments, use default colors
    switch (segment.type) {
      case "operator":
        return TUI_HIGHLIGHT_COLORS.elements.operator;
      case "function":
        return TUI_HIGHLIGHT_COLORS.elements.function;
      case "number":
        return TUI_HIGHLIGHT_COLORS.elements.number;
      case "string":
        return TUI_HIGHLIGHT_COLORS.elements.string;
      case "parenthesis":
        return TUI_HIGHLIGHT_COLORS.elements.parenthesis;
      default:
        return this.colors.fg; // Default white
    }
  }
}
