import {
  type UIState,
  isEditingMode,
  isCommandMode,
  isNavigationMode,
  isResizeMode,
} from "@gridcore/ui-core"

export interface TUIDisplayState {
  // Main mode display
  modeString: string
  vimMode?: string
  
  // Cursor and selection
  cursorDisplay: string
  
  // Formula bar content
  formulaBarContent: string
  showFormulaCursor: boolean
  formulaCursorPosition?: number
  
  // Status bar details
  commandBuffer?: string
  numberBuffer?: string
  visualType?: string
  
  // Resize mode info
  resizeInfo?: {
    target: string
    index: number
    currentSize: number
    originalSize: number
  }
}

export class StateAdapter {
  static toDisplayState(state: UIState): TUIDisplayState {
    const base: TUIDisplayState = {
      modeString: this.getModeString(state),
      cursorDisplay: this.getCursorDisplay(state),
      formulaBarContent: this.getFormulaBarContent(state),
      showFormulaCursor: false,
    }

    // Add mode-specific details
    if (isNavigationMode(state)) {
      base.vimMode = "NORMAL"
    } else if (isEditingMode(state)) {
      base.showFormulaCursor = true
      base.formulaCursorPosition = state.cursorPosition
      
      switch (state.cellMode) {
        case "normal":
          base.vimMode = "CELL-NORMAL"
          break
        case "insert":
          base.vimMode = `CELL-INSERT${state.editVariant ? ` (${state.editVariant})` : ""}`
          break
        case "visual":
          base.vimMode = `CELL-VISUAL${state.visualType ? ` ${state.visualType.toUpperCase()}` : ""}`
          base.visualType = state.visualType
          break
      }
    } else if (isCommandMode(state)) {
      base.vimMode = "COMMAND"
      base.commandBuffer = state.commandValue
    } else if (isResizeMode(state)) {
      base.vimMode = "RESIZE"
      base.resizeInfo = {
        target: state.resizeTarget.toUpperCase(),
        index: state.resizeIndex,
        currentSize: state.currentSize,
        originalSize: state.originalSize,
      }
    }

    return base
  }

  private static getModeString(state: UIState): string {
    if (isNavigationMode(state)) {
      return "NORMAL"
    } else if (isEditingMode(state)) {
      switch (state.cellMode) {
        case "normal":
          return "EDIT"
        case "insert":
          return "INSERT"
        case "visual":
          return "VISUAL"
      }
    } else if (isCommandMode(state)) {
      return "COMMAND"
    } else if (isResizeMode(state)) {
      return "RESIZE"
    }
    return "UNKNOWN"
  }

  private static getCursorDisplay(state: UIState): string {
    const col = this.columnIndexToLetter(state.cursor.col)
    const row = state.cursor.row + 1 // 1-indexed for display
    return `${col}${row}`
  }

  private static getFormulaBarContent(state: UIState): string {
    if (isEditingMode(state)) {
      return state.editingValue
    } else if (isCommandMode(state)) {
      return `:${state.commandValue}`
    }
    return ""
  }

  private static columnIndexToLetter(index: number): string {
    let letter = ""
    let num = index
    while (num >= 0) {
      letter = String.fromCharCode((num % 26) + 65) + letter
      num = Math.floor(num / 26) - 1
    }
    return letter
  }

  // Convert number buffer and command buffer for vim display
  static getVimCommandDisplay(numberBuffer?: string, commandBuffer?: string): string {
    let display = ""
    if (numberBuffer) {
      display += numberBuffer
    }
    if (commandBuffer) {
      display += commandBuffer
    }
    return display
  }

  // Get resize mode display string
  static getResizeModeDisplay(resizeInfo: TUIDisplayState["resizeInfo"]): string {
    if (!resizeInfo) return ""
    
    const diff = resizeInfo.currentSize - resizeInfo.originalSize
    const sign = diff >= 0 ? "+" : ""
    
    return `${resizeInfo.target} ${resizeInfo.index}: ${resizeInfo.currentSize} (${sign}${diff})`
  }

  // Check if we should show visual selection
  static hasVisualSelection(state: UIState): boolean {
    return isEditingMode(state) && state.cellMode === "visual" && state.visualStart !== undefined
  }

  // Get visual selection range within a cell
  static getVisualSelectionRange(state: UIState): { start: number; end: number } | null {
    if (!isEditingMode(state) || state.cellMode !== "visual" || state.visualStart === undefined) {
      return null
    }

    const start = Math.min(state.visualStart, state.cursorPosition)
    const end = Math.max(state.visualStart, state.cursorPosition)
    return { start, end }
  }
}