import type { SpreadsheetEngine } from "@gridcore/core";
import { type OptimizedBuffer, Renderable, type RGBA } from "../framework";
import type { TUIState } from "../SpreadsheetTUI";

export class StatusBarComponent extends Renderable {
  private colors = {
    bg: { r: 16, g: 16, b: 16, a: 255 },
    fg: { r: 200, g: 200, b: 200, a: 255 },
    modeBg: {
      normal: { r: 0, g: 128, b: 0, a: 255 },
      edit: { r: 255, g: 128, b: 0, a: 255 },
      visual: { r: 128, g: 0, b: 255, a: 255 },
      command: { r: 0, g: 128, b: 255, a: 255 },
    },
    modeFg: { r: 255, g: 255, b: 255, a: 255 },
    separator: { r: 64, g: 64, b: 64, a: 255 },
    command: { r: 255, g: 255, b: 100, a: 255 },
  };

  constructor(
    private engine: SpreadsheetEngine,
    private getState: () => TUIState,
  ) {
    super("statusBar");
  }

  protected renderSelf(buffer: OptimizedBuffer): void {
    const state = this.getState();
    const { mode, cursor, commandValue } = state;
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
    const modeText = ` ${mode.toUpperCase()} `;
    const modeBg = this.colors.modeBg[mode];
    buffer.setText(pos.x, pos.y, modeText, this.colors.modeFg, modeBg);

    let currentX = pos.x + modeText.length + 1;

    // Show command input in command mode
    if (mode === "command" && commandValue !== undefined) {
      buffer.setText(currentX, pos.y, ":", this.colors.command, this.colors.bg);
      currentX += 1;
      buffer.setText(
        currentX,
        pos.y,
        commandValue + "█",
        this.colors.command,
        this.colors.bg,
      );
      return; // Don't show other info in command mode
    }

    // Show grid info
    const gridInfo = this.getGridInfo();
    buffer.setText(currentX, pos.y, gridInfo, this.colors.fg, this.colors.bg);
    currentX += gridInfo.length + 2;

    // Show memory usage (simulated for now)
    const memoryInfo = "MEM: 12.5MB";
    buffer.setText(currentX, pos.y, memoryInfo, this.colors.fg, this.colors.bg);

    // Right-aligned info
    const shortcuts = this.getShortcuts(mode);
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

  private getGridInfo(): string {
    const state = this.getState();
    const { selectedRange } = state;

    // Get grid dimensions from engine
    const usedRows = 100; // TODO: Get from engine
    const usedCols = 26; // TODO: Get from engine

    if (selectedRange) {
      const rows =
        Math.abs(selectedRange.end.row - selectedRange.start.row) + 1;
      const cols =
        Math.abs(selectedRange.end.col - selectedRange.start.col) + 1;
      return `Selected: ${rows}R x ${cols}C`;
    }

    return `Grid: ${usedRows}R x ${usedCols}C`;
  }

  private getShortcuts(mode: TUIState["mode"]): string {
    switch (mode) {
      case "normal":
        return "i:Edit  v:Visual  ::Cmd  ^Q:Quit";
      case "edit":
        return "ESC:Cancel  ENTER:Save";
      case "visual":
        return "ESC:Cancel  y:Copy  d:Delete";
      case "command":
        return "ESC:Cancel  ENTER:Execute";
      default:
        return "";
    }
  }
}
