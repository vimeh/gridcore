import {
  isCommandMode,
  isEditingMode,
  isNavigationMode,
  isResizeMode,
  type UIState,
} from "@gridcore/ui-core";

export interface TUIDisplayState {
  // Main mode display
  modeString: string;
  vimMode?: string;

  // Cursor and selection
  cursorDisplay: string;

  // Formula bar content
  formulaBarContent: string;
  showFormulaCursor: boolean;
  formulaCursorPosition?: number;

  // Status bar details
  commandBuffer?: string;
  numberBuffer?: string;
  visualType?: string;

  // Resize mode info
  resizeInfo?: {
    target: string;
    index: number;
    currentSize: number;
    originalSize: number;
  };
}

export function toDisplayState(state: UIState): TUIDisplayState {
  const base: TUIDisplayState = {
    modeString: getModeString(state),
    cursorDisplay: getCursorDisplay(state),
    formulaBarContent: getFormulaBarContent(state),
    showFormulaCursor: false,
  };

  // Add mode-specific details
  if (isNavigationMode(state)) {
    base.vimMode = "NORMAL";
  } else if (isEditingMode(state)) {
    base.showFormulaCursor = true;
    base.formulaCursorPosition = state.cursorPosition;

    // Add cell mode details
    switch (state.cellMode) {
      case "normal":
        base.vimMode = "CELL-NORMAL";
        break;
      case "insert":
        base.vimMode = `CELL-INSERT (${state.editVariant || "i"})`;
        break;
      case "visual":
        base.vimMode = `CELL-VISUAL ${(state.visualType || "character").toUpperCase()}`;
        base.visualType = state.visualType;
        break;
    }
  } else if (isCommandMode(state)) {
    base.vimMode = "COMMAND";
    base.commandBuffer = state.commandValue;
  } else if (isResizeMode(state)) {
    base.vimMode = "RESIZE";
    base.resizeInfo = {
      target: state.resizeTarget === "column" ? "COLUMN" : "ROW",
      index: state.resizeIndex,
      currentSize: state.currentSize,
      originalSize: state.originalSize,
    };
  }

  return base;
}

function getModeString(state: UIState): string {
  if (isNavigationMode(state)) {
    return "NORMAL";
  } else if (isEditingMode(state)) {
    switch (state.cellMode) {
      case "normal":
        return "NORMAL";
      case "insert":
        return "INSERT";
      case "visual":
        return "VISUAL";
      default:
        return "NORMAL";
    }
  } else if (isCommandMode(state)) {
    return "COMMAND";
  } else if (isResizeMode(state)) {
    return "RESIZE";
  }
  return "NORMAL";
}

function getCursorDisplay(state: UIState): string {
  const col = columnIndexToLabel(state.cursor.col);
  const row = state.cursor.row + 1;
  return `${col}${row}`;
}

// Helper function to convert column index to label (0 -> A, 1 -> B, etc.)
function columnIndexToLabel(col: number): string {
  let label = "";
  let n = col;
  while (n >= 0) {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
    if (n < 0) break;
  }
  return label;
}

function getFormulaBarContent(state: UIState): string {
  if (isEditingMode(state)) {
    return state.editingValue;
  } else if (isCommandMode(state)) {
    return `:${state.commandValue}`;
  }
  return "";
}

export function formatVimMode(vimMode?: string): string {
  switch (vimMode) {
    case "NORMAL":
      return "-- NORMAL --";
    case "INSERT":
      return "-- INSERT --";
    case "VISUAL":
      return "-- VISUAL --";
    case "VISUAL LINE":
      return "-- VISUAL LINE --";
    default:
      return "";
  }
}

export function formatResizeInfo(info?: TUIDisplayState["resizeInfo"]): string {
  if (!info) return "";
  const delta = info.currentSize - info.originalSize;
  const sign = delta >= 0 ? "+" : "";
  return `${info.target} ${info.index}: ${info.currentSize}px (${sign}${delta})`;
}

export function getSelectionRange(
  state: UIState,
): { start: number; end: number } | null {
  if (!isEditingMode(state) || state.cellMode !== "visual") {
    return null;
  }

  const start = Math.min(
    state.visualStart ?? state.cursorPosition,
    state.cursorPosition,
  );
  const end = Math.max(
    state.visualStart ?? state.cursorPosition,
    state.cursorPosition,
  );

  return { start, end };
}

export function getVimCommandDisplay(
  numberBuffer?: string,
  commandBuffer?: string,
): string {
  return `${numberBuffer || ""}${commandBuffer || ""}`;
}

export function getResizeModeDisplay(
  info: {
    target: string;
    index: number;
    currentSize: number;
    originalSize: number;
  }
): string {
  const targetName = info.target.toUpperCase();
  const delta = info.currentSize - info.originalSize;
  const sign = delta >= 0 ? "+" : "";
  return `${targetName} ${info.index}: ${info.currentSize} (${sign}${delta})`;
}

export function hasVisualSelection(state: UIState): boolean {
  return (
    isEditingMode(state) &&
    state.cellMode === "visual" &&
    state.visualStart !== undefined
  );
}

export function getVisualSelectionRange(state: UIState): {
  start: number;
  end: number;
} | null {
  if (!hasVisualSelection(state)) {
    return null;
  }

  const start = Math.min(
    state.visualStart ?? state.cursorPosition,
    state.cursorPosition,
  );
  const end = Math.max(
    state.visualStart ?? state.cursorPosition,
    state.cursorPosition,
  );

  return { start, end };
}
