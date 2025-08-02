export type GridMode = "navigation" | "editing"
export type CellMode = "normal" | "insert" | "visual" | "visual-line"

export interface SpreadsheetState {
  gridMode: GridMode
  cellMode: CellMode
  previousGridMode?: GridMode
  previousCellMode?: CellMode
}

export type ModeTransitionEvent =
  | { type: "START_EDITING" }
  | { type: "STOP_EDITING"; commit: boolean }
  | { type: "ENTER_INSERT_MODE" }
  | { type: "EXIT_INSERT_MODE" }
  | { type: "ENTER_VISUAL_MODE"; visualType: "character" | "line" }
  | { type: "EXIT_VISUAL_MODE" }
  | { type: "ESCAPE" }

export interface ModeChangeCallback {
  (state: SpreadsheetState, previousState: SpreadsheetState): void
}

export class SpreadsheetModeStateMachine {
  private state: SpreadsheetState = {
    gridMode: "navigation",
    cellMode: "normal",
  }
  
  private listeners: Set<ModeChangeCallback> = new Set()
  
  constructor() {}
  
  getState(): Readonly<SpreadsheetState> {
    return { ...this.state }
  }
  
  getGridMode(): GridMode {
    return this.state.gridMode
  }
  
  getCellMode(): CellMode {
    return this.state.cellMode
  }
  
  isInEditMode(): boolean {
    return this.state.gridMode === "editing"
  }
  
  isInNavigationMode(): boolean {
    return this.state.gridMode === "navigation"
  }
  
  isInInsertMode(): boolean {
    return this.state.gridMode === "editing" && this.state.cellMode === "insert"
  }
  
  isInVisualMode(): boolean {
    return this.state.gridMode === "editing" && 
           (this.state.cellMode === "visual" || this.state.cellMode === "visual-line")
  }
  
  transition(event: ModeTransitionEvent): boolean {
    const previousState = { ...this.state }
    let stateChanged = false
    
    switch (event.type) {
      case "START_EDITING":
        if (this.state.gridMode === "navigation") {
          this.state = {
            gridMode: "editing",
            cellMode: "normal",
            previousGridMode: "navigation",
            previousCellMode: this.state.cellMode,
          }
          stateChanged = true
        }
        break
        
      case "STOP_EDITING":
        if (this.state.gridMode === "editing") {
          this.state = {
            gridMode: "navigation",
            cellMode: "normal",
            previousGridMode: "editing",
            previousCellMode: this.state.cellMode,
          }
          stateChanged = true
        }
        break
        
      case "ENTER_INSERT_MODE":
        if (this.state.gridMode === "editing" && this.state.cellMode !== "insert") {
          this.state = {
            ...this.state,
            cellMode: "insert",
            previousCellMode: this.state.cellMode,
          }
          stateChanged = true
        }
        break
        
      case "EXIT_INSERT_MODE":
        if (this.state.gridMode === "editing" && this.state.cellMode === "insert") {
          this.state = {
            ...this.state,
            cellMode: "normal",
            previousCellMode: "insert",
          }
          stateChanged = true
        }
        break
        
      case "ENTER_VISUAL_MODE":
        if (this.state.gridMode === "editing" && 
            this.state.cellMode !== "visual" && 
            this.state.cellMode !== "visual-line") {
          this.state = {
            ...this.state,
            cellMode: event.visualType === "line" ? "visual-line" : "visual",
            previousCellMode: this.state.cellMode,
          }
          stateChanged = true
        }
        break
        
      case "EXIT_VISUAL_MODE":
        if (this.state.gridMode === "editing" && 
            (this.state.cellMode === "visual" || this.state.cellMode === "visual-line")) {
          this.state = {
            ...this.state,
            cellMode: "normal",
            previousCellMode: this.state.cellMode,
          }
          stateChanged = true
        }
        break
        
      case "ESCAPE":
        if (this.state.gridMode === "editing") {
          if (this.state.cellMode === "insert" || 
              this.state.cellMode === "visual" || 
              this.state.cellMode === "visual-line") {
            // First escape exits insert/visual mode
            this.state = {
              ...this.state,
              cellMode: "normal",
              previousCellMode: this.state.cellMode,
            }
            stateChanged = true
          } else {
            // Second escape exits editing mode
            this.state = {
              gridMode: "navigation",
              cellMode: "normal",
              previousGridMode: "editing",
              previousCellMode: this.state.cellMode,
            }
            stateChanged = true
          }
        }
        break
    }
    
    if (stateChanged) {
      this.notifyListeners(this.state, previousState)
    }
    
    return stateChanged
  }
  
  onModeChange(callback: ModeChangeCallback): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }
  
  private notifyListeners(newState: SpreadsheetState, previousState: SpreadsheetState): void {
    for (const listener of this.listeners) {
      listener(newState, previousState)
    }
  }
  
  reset(): void {
    const previousState = { ...this.state }
    this.state = {
      gridMode: "navigation",
      cellMode: "normal",
    }
    this.notifyListeners(this.state, previousState)
  }
  
  getStateDescription(): string {
    if (this.state.gridMode === "navigation") {
      return "Grid Navigation"
    }
    
    switch (this.state.cellMode) {
      case "normal":
        return "Cell Edit - Normal"
      case "insert":
        return "Cell Edit - Insert"
      case "visual":
        return "Cell Edit - Visual"
      case "visual-line":
        return "Cell Edit - Visual Line"
      default:
        return "Unknown"
    }
  }
  
  getAllowedTransitions(): ModeTransitionEvent["type"][] {
    const allowed: ModeTransitionEvent["type"][] = []
    
    if (this.state.gridMode === "navigation") {
      allowed.push("START_EDITING")
    } else if (this.state.gridMode === "editing") {
      allowed.push("STOP_EDITING", "ESCAPE")
      
      if (this.state.cellMode === "normal") {
        allowed.push("ENTER_INSERT_MODE", "ENTER_VISUAL_MODE")
      } else if (this.state.cellMode === "insert") {
        allowed.push("EXIT_INSERT_MODE")
      } else if (this.state.cellMode === "visual" || this.state.cellMode === "visual-line") {
        allowed.push("EXIT_VISUAL_MODE")
      }
    }
    
    return allowed
  }
}