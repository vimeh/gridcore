import type { UIState } from "@gridcore/ui-core";
import {
  getResizeModeDisplay,
  getVimCommandDisplay,
  getVisualSelectionRange,
  hasVisualSelection,
  toDisplayState,
} from "../adapters";
import { type OptimizedBuffer, Renderable } from "../framework";

export class StatusBarComponent extends Renderable {
  private colors = {
    bg: { r: 16, g: 16, b: 16, a: 255 },
    fg: { r: 200, g: 200, b: 200, a: 255 },
    modeBg: {
      NORMAL: { r: 0, g: 128, b: 0, a: 255 },
      EDIT: { r: 255, g: 128, b: 0, a: 255 },
      INSERT: { r: 255, g: 128, b: 0, a: 255 },
      VISUAL: { r: 128, g: 0, b: 255, a: 255 },
      COMMAND: { r: 0, g: 128, b: 255, a: 255 },
      RESIZE: { r: 128, g: 128, b: 0, a: 255 },
    },
    modeFg: { r: 255, g: 255, b: 255, a: 255 },
    separator: { r: 64, g: 64, b: 64, a: 255 },
    command: { r: 255, g: 255, b: 100, a: 255 },
  };

  constructor(private getState: () => UIState) {
    super("statusBar");
  }

  protected renderSelf(buffer: OptimizedBuffer): void {
    const state = this.getState();
    const displayState = toDisplayState(state);
    const pos = this.getAbsolutePosition();

    // Clear the status bar
    buffer.fillRect(
      pos.x,
      pos.y,
      this.width,
      this.height,
      " ",
      this.colors.fg,
      this.colors.bg,
    );

    // Draw mode indicator
    const modeText = ` ${displayState.modeString} `;
    const modeBg =
      this.colors.modeBg[
        displayState.modeString as keyof typeof this.colors.modeBg
      ] || this.colors.modeBg.NORMAL;
    buffer.setText(pos.x, pos.y, modeText, this.colors.modeFg, modeBg);

    let currentX = pos.x + modeText.length + 1;

    // Show vim mode details if different from main mode
    if (
      displayState.vimMode &&
      displayState.vimMode !== displayState.modeString
    ) {
      const vimModeText = `[${displayState.vimMode}]`;
      buffer.setText(
        currentX,
        pos.y,
        vimModeText,
        this.colors.command,
        this.colors.bg,
      );
      currentX += vimModeText.length + 1;
    }

    // Show command/number buffer if present
    if (displayState.numberBuffer || displayState.commandBuffer) {
      const vimInfo = getVimCommandDisplay(
        displayState.numberBuffer,
        displayState.commandBuffer,
      );
      if (vimInfo) {
        buffer.setText(
          currentX,
          pos.y,
          vimInfo,
          this.colors.command,
          this.colors.bg,
        );
        currentX += vimInfo.length + 1;
      }
    }

    // Show command input in command mode
    if (state.spreadsheetMode === "command") {
      buffer.setText(currentX, pos.y, ":", this.colors.command, this.colors.bg);
      currentX += 1;
      buffer.setText(
        currentX,
        pos.y,
        `${state.commandValue}█`,
        this.colors.command,
        this.colors.bg,
      );
      return; // Don't show other info in command mode
    }

    // Show resize info
    if (displayState.resizeInfo) {
      const resizeText = getResizeModeDisplay(
        displayState.resizeInfo.target === "Column" ? "column" : "row",
        displayState.resizeInfo.index,
        displayState.resizeInfo.currentSize,
        displayState.resizeInfo.originalSize,
      );
      buffer.setText(
        currentX,
        pos.y,
        resizeText,
        this.colors.fg,
        this.colors.bg,
      );
      currentX += resizeText.length + 2;
    }

    // Show cursor position
    const cursorText = `Cell: ${displayState.cursorDisplay}`;
    buffer.setText(currentX, pos.y, cursorText, this.colors.fg, this.colors.bg);
    currentX += cursorText.length + 2;

    // Show grid info
    const gridInfo = this.getGridInfo(state);
    buffer.setText(currentX, pos.y, gridInfo, this.colors.fg, this.colors.bg);
    currentX += gridInfo.length + 2;

    // Show memory usage (simulated for now)
    const memoryInfo = "MEM: 12.5MB";
    buffer.setText(currentX, pos.y, memoryInfo, this.colors.fg, this.colors.bg);

    // Right-aligned info
    const shortcuts = this.getShortcuts(state);
    const shortcutsX = pos.x + this.width - shortcuts.length - 2;
    if (shortcutsX > currentX + 2) {
      buffer.setText(
        shortcutsX,
        pos.y,
        shortcuts,
        this.colors.fg,
        this.colors.bg,
      );
    }
  }

  private getGridInfo(state: UIState): string {
    // TODO: Get actual grid dimensions from engine
    const usedRows = 100;
    const usedCols = 26;

    // Check if we have a visual selection in editing mode
    if (state.spreadsheetMode === "editing" && hasVisualSelection(state)) {
      const range = getVisualSelectionRange(state);
      if (range) {
        const chars = range.end - range.start + 1;
        return `Selected: ${chars} chars`;
      }
    }

    return `Grid: ${usedRows}R x ${usedCols}C`;
  }

  private getShortcuts(state: UIState): string {
    switch (state.spreadsheetMode) {
      case "navigation":
        return "hjkl:Move  i:Insert  v:Visual  ::Cmd  r:Resize  ^Q:Quit";
      case "editing":
        if (state.cellMode === "insert") {
          return "ESC:Normal  ^C:Cancel";
        } else if (state.cellMode === "visual") {
          return "ESC:Normal  y:Yank  d:Delete  c:Change";
        } else {
          return "i:Insert  v:Visual  ESC:Exit";
        }
      case "command":
        return "ESC:Cancel  ENTER:Execute";
      case "resize":
        return "<>:Width  -+:Height  =:Auto  ESC:Exit";
      default:
        return "";
    }
  }
}
