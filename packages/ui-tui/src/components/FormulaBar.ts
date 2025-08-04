import type { ISpreadsheetFacade } from "@gridcore/core";
import { isCommandMode, isEditingMode, type UIState } from "@gridcore/ui-core";
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

  constructor(
    private facade: ISpreadsheetFacade,
    private getState: () => UIState,
  ) {
    super("formulaBar");
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

    // Render the value with cursor if needed
    if (cursorPosition !== undefined && displayState.showFormulaCursor) {
      // Split text at cursor position
      const beforeCursor = displayValue.slice(0, cursorPosition);
      const atCursor = displayValue[cursorPosition] || " ";
      const afterCursor = displayValue.slice(cursorPosition + 1);

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
      buffer.setText(
        contentX,
        pos.y,
        visibleBefore,
        valueColor,
        this.colors.bg,
      );

      // Draw cursor
      const cursorX = contentX + visibleBefore.length;
      const cursorBg = { r: 255, g: 255, b: 255, a: 255 };
      const cursorFg = { r: 0, g: 0, b: 0, a: 255 };
      buffer.setText(cursorX, pos.y, atCursor, cursorFg, cursorBg);

      // Draw text after cursor
      if (visibleAfter) {
        buffer.setText(
          cursorX + 1,
          pos.y,
          visibleAfter,
          valueColor,
          this.colors.bg,
        );
      }

      // Show scroll indicators if needed
      if (visibleStart > 0) {
        buffer.setText(
          contentX - 1,
          pos.y,
          "…",
          this.colors.separator,
          this.colors.bg,
        );
      }
      if (cursorPosition + visibleAfter.length < displayValue.length) {
        buffer.setText(
          contentX + maxWidth - 1,
          pos.y,
          "…",
          this.colors.separator,
          this.colors.bg,
        );
      }
    } else {
      // Normal display without cursor
      if (displayValue.length > maxWidth) {
        displayValue = `${displayValue.slice(0, maxWidth - 1)}…`;
      }
      buffer.setText(contentX, pos.y, displayValue, valueColor, this.colors.bg);
    }

    // Draw bottom border
    if (this.height > 1) {
      for (let x = pos.x; x < pos.x + this.width; x++) {
        buffer.setChar(x, pos.y + 1, "─", this.colors.separator);
      }
    }
  }
}
