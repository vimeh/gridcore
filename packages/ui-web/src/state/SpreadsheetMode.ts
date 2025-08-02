import type { CellAddress } from "@gridcore/core"

export type GridMode = "navigation" | "editing"
export type CellMode = "normal" | "insert" | "visual" | "visual-line" | "visual-block" | "resize"
export type EditMode = "insert" | "append" | "replace"
export type InteractionMode = "normal" | "keyboard-only"

export interface SpreadsheetState {
  gridMode: GridMode
  cellMode: CellMode
  editMode?: EditMode // Only relevant when cellMode is "insert"
  pendingEditMode?: EditMode // Edit mode to apply when entering insert mode
  interactionMode: InteractionMode
  previousGridMode?: GridMode
  previousCellMode?: CellMode
  previousEditMode?: EditMode
  previousInteractionMode?: InteractionMode
  visualAnchor?: CellAddress // Starting point of visual selection
  visualCursor?: CellAddress // Current position in visual selection
  resizeTarget?: { type: "column" | "row"; index: number } // What we're resizing
}

export type ModeTransitionEvent =
  | { type: "START_EDITING"; editMode?: EditMode }
  | { type: "STOP_EDITING"; commit: boolean }
  | { type: "ENTER_INSERT_MODE"; editMode?: EditMode }
  | { type: "EXIT_INSERT_MODE" }
  | { type: "ENTER_VISUAL_MODE"; visualType: "character" | "line" }
  | { type: "EXIT_VISUAL_MODE" }
  | { type: "ENTER_VISUAL_BLOCK_MODE" }
  | { type: "ENTER_RESIZE_MODE"; target: { type: "column" | "row"; index: number } }
  | { type: "EXIT_RESIZE_MODE" }
  | { type: "SET_EDIT_MODE"; editMode: EditMode }
  | { type: "TOGGLE_INTERACTION_MODE" }
  | { type: "SET_INTERACTION_MODE"; mode: InteractionMode }
  | { type: "ESCAPE" }

export interface ModeChangeCallback {
  (state: SpreadsheetState, previousState: SpreadsheetState): void
}

export class SpreadsheetModeStateMachine {
  private state: SpreadsheetState = {
    gridMode: "navigation",
    cellMode: "normal",
    interactionMode: "normal",
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
  
  getEditMode(): EditMode | undefined {
    return this.state.editMode
  }
  
  getInteractionMode(): InteractionMode {
    return this.state.interactionMode
  }
  isInEditMode(): boolean {
    return this.state.gridMode === "editing";
  }

  isInNavigationMode(): boolean {
    return this.state.gridMode === "navigation";
  }

  isInInsertMode(): boolean {
    return (
      this.state.gridMode === "editing" && this.state.cellMode === "insert"
    );
  }

  isInVisualMode(): boolean {
    return this.state.gridMode === "editing" && 
           (this.state.cellMode === "visual" || 
            this.state.cellMode === "visual-line" ||
            this.state.cellMode === "visual-block")
  }
  
  isInNormalCellMode(): boolean {
    return this.state.gridMode === "editing" && this.state.cellMode === "normal"
  }
  
  isInKeyboardOnlyMode(): boolean {
    return this.state.interactionMode === "keyboard-only"
  }
  
  isInNormalInteractionMode(): boolean {
    return this.state.interactionMode === "normal"
  }
  
  isInAppendMode(): boolean {
    return this.state.editMode === "append" || this.state.pendingEditMode === "append"
  }
  
  isInReplaceMode(): boolean {
    return this.state.editMode === "replace" || this.state.pendingEditMode === "replace"
  }
  
  isInResizeMode(): boolean {
    return this.state.gridMode === "editing" && this.state.cellMode === "resize"
  }
  
  getCurrentEditMode(): EditMode | null {
    return this.state.editMode || null
  }
  
  getPendingEditMode(): EditMode | null {
    return this.state.pendingEditMode || null
  }
  
  // Mode validation methods
  isValidTransition(event: ModeTransitionEvent): boolean {
    return this.getAllowedTransitions().includes(event.type)
  }
  
  canStartEditing(): boolean {
    return this.state.gridMode === "navigation"
  }
  
  canStopEditing(): boolean {
    return this.state.gridMode === "editing"
  }
  
  canEnterInsertMode(): boolean {
    return this.state.gridMode === "editing" && this.state.cellMode !== "insert"
  }
  
  canExitInsertMode(): boolean {
    return this.state.gridMode === "editing" && this.state.cellMode === "insert"
  }
  
  canEnterVisualMode(): boolean {
    return this.state.gridMode === "editing" && 
           this.state.cellMode !== "visual" && 
           this.state.cellMode !== "visual-line" &&
           this.state.cellMode !== "visual-block"
  }
  
  canExitVisualMode(): boolean {
    return this.state.gridMode === "editing" && 
           (this.state.cellMode === "visual" || 
            this.state.cellMode === "visual-line" ||
            this.state.cellMode === "visual-block")
  }
  
  canSetEditMode(): boolean {
    return this.state.gridMode === "editing" && this.state.cellMode === "insert"
  }
  
  isValidEditMode(editMode: EditMode): boolean {
    return ["insert", "append", "replace"].includes(editMode)
  }
  
  isValidInteractionMode(interactionMode: InteractionMode): boolean {
    return ["normal", "keyboard-only"].includes(interactionMode)
  }
  
  // State constraint validation
  isStateValid(state: SpreadsheetState): boolean {
    // EditMode should only be set when in insert mode
    if (state.editMode && state.cellMode !== "insert") {
      return false
    }
    
    // Check for valid mode combinations
    if (state.gridMode === "navigation" && state.cellMode !== "normal") {
      return false
    }
    
    return true
  }
  transition(event: ModeTransitionEvent): boolean {
    // Validate transition is allowed
    if (!this.isValidTransition(event)) {
      return false
    }
    
    const previousState = { ...this.state }
    let stateChanged = false
    switch (event.type) {
      case "START_EDITING":
        if (this.state.gridMode === "navigation") {
          this.state = {
            gridMode: "editing",
            cellMode: "normal",
            pendingEditMode: event.editMode,
            interactionMode: this.state.interactionMode,
            previousGridMode: "navigation",
            previousCellMode: this.state.cellMode,
            previousInteractionMode: this.state.interactionMode,
          }
          stateChanged = true
        }
        break;

      case "STOP_EDITING":
        if (this.state.gridMode === "editing") {
          this.state = {
            gridMode: "navigation",
            cellMode: "normal",
            interactionMode: this.state.interactionMode,
            previousGridMode: "editing",
            previousCellMode: this.state.cellMode,
            previousEditMode: this.state.editMode,
            previousInteractionMode: this.state.interactionMode,
          }
          stateChanged = true
        }
        break;

      case "ENTER_INSERT_MODE":
        if (
          this.state.gridMode === "editing" &&
          this.state.cellMode !== "insert"
        ) {
          this.state = {
            ...this.state,
            cellMode: "insert",
            editMode: event.editMode || this.state.pendingEditMode || this.state.editMode,
            pendingEditMode: undefined,
            previousCellMode: this.state.cellMode,
            previousEditMode: this.state.editMode,
          }
          stateChanged = true
        }
        break;

      case "EXIT_INSERT_MODE":
        if (
          this.state.gridMode === "editing" &&
          this.state.cellMode === "insert"
        ) {
          this.state = {
            ...this.state,
            cellMode: "normal",
            editMode: undefined,
            previousCellMode: "insert",
            previousEditMode: this.state.editMode,
          }
          stateChanged = true
        }
        break;

      case "ENTER_VISUAL_MODE":
        if (
          this.state.gridMode === "editing" &&
          this.state.cellMode !== "visual" &&
          this.state.cellMode !== "visual-line"
        ) {
          this.state = {
            ...this.state,
            cellMode: event.visualType === "line" ? "visual-line" : "visual",
            previousCellMode: this.state.cellMode,
          };
          stateChanged = true;
        }
        break;

      case "EXIT_VISUAL_MODE":
        if (
          this.state.gridMode === "editing" &&
          (this.state.cellMode === "visual" ||
            this.state.cellMode === "visual-line" ||
            this.state.cellMode === "visual-block")
        ) {
          this.state = {
            ...this.state,
            cellMode: "normal",
            previousCellMode: this.state.cellMode,
            visualAnchor: undefined,
            visualCursor: undefined,
          };
          stateChanged = true;
        }
        break
        
      case "SET_EDIT_MODE":
        if (this.state.gridMode === "editing" && 
            this.state.cellMode === "insert" && 
            this.isValidEditMode(event.editMode)) {
          this.state = {
            ...this.state,
            editMode: event.editMode,
            previousEditMode: this.state.editMode,
          }
          stateChanged = true
        }
        break
        
      case "TOGGLE_INTERACTION_MODE":
        const newInteractionMode: InteractionMode = this.state.interactionMode === "normal" ? "keyboard-only" : "normal"
        this.state = {
          ...this.state,
          interactionMode: newInteractionMode,
          previousInteractionMode: this.state.interactionMode,
        }
        stateChanged = true
        break
        
      case "SET_INTERACTION_MODE":
        if (this.state.interactionMode !== event.mode && 
            this.isValidInteractionMode(event.mode)) {
          this.state = {
            ...this.state,
            interactionMode: event.mode,
            previousInteractionMode: this.state.interactionMode,
          }
          stateChanged = true
        }
        break

      case "ENTER_VISUAL_BLOCK_MODE":
        if (
          this.state.gridMode === "editing" &&
          this.state.cellMode !== "visual-block"
        ) {
          this.state = {
            ...this.state,
            cellMode: "visual-block",
            previousCellMode: this.state.cellMode,
          };
          stateChanged = true;
        }
        break;

      case "ENTER_RESIZE_MODE":
        if (
          this.state.gridMode === "editing" &&
          this.state.cellMode !== "resize"
        ) {
          this.state = {
            ...this.state,
            cellMode: "resize",
            previousCellMode: this.state.cellMode,
            resizeTarget: event.target,
          };
          stateChanged = true;
        }
        break;

      case "EXIT_RESIZE_MODE":
        if (
          this.state.gridMode === "editing" &&
          this.state.cellMode === "resize"
        ) {
          this.state = {
            ...this.state,
            cellMode: "normal",
            previousCellMode: "resize",
            resizeTarget: undefined,
          };
          stateChanged = true;
        }
        break;

      case "ESCAPE":
        if (this.state.gridMode === "editing") {
          if (
            this.state.cellMode === "insert" ||
            this.state.cellMode === "visual" ||
            this.state.cellMode === "visual-line" ||
            this.state.cellMode === "visual-block" ||
            this.state.cellMode === "resize"
          ) {
            // First escape exits insert/visual/resize mode
            this.state = {
              ...this.state,
              cellMode: "normal",
              editMode: undefined,
              previousCellMode: this.state.cellMode,
              previousEditMode: this.state.editMode,
              visualAnchor: undefined,
              visualCursor: undefined,
              resizeTarget: undefined,
            }
            stateChanged = true
          } else {
            // Second escape exits editing mode
            this.state = {
              gridMode: "navigation",
              cellMode: "normal",
              interactionMode: this.state.interactionMode,
              previousGridMode: "editing",
              previousCellMode: this.state.cellMode,
              previousEditMode: this.state.editMode,
              previousInteractionMode: this.state.interactionMode,
            }
            stateChanged = true
          }
        }
        break;
    }
    
    // Validate the resulting state
    if (stateChanged && !this.isStateValid(this.state)) {
      // Rollback to previous state if validation fails
      this.state = previousState
      return false
    }
    
    if (stateChanged) {
      this.notifyListeners(this.state, previousState);
    }

    return stateChanged;
  }

  onModeChange(callback: ModeChangeCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
  
  private notifyListeners(newState: SpreadsheetState, previousState: SpreadsheetState): void {
    this.listeners.forEach(listener => {
      listener(newState, previousState)
    })
  }

  reset(): void {
    const previousState = { ...this.state };
    this.state = {
      gridMode: "navigation",
      cellMode: "normal",
      interactionMode: "normal",
    }
    this.notifyListeners(this.state, previousState)
  }

  getStateDescription(): string {
    const interactionSuffix = this.state.interactionMode === "keyboard-only" ? " (Keyboard Only)" : ""
    
    if (this.state.gridMode === "navigation") {
      return `Grid Navigation${interactionSuffix}`
    }
    
    let description = ""
    switch (this.state.cellMode) {
      case "normal":
        description = "Cell Edit - Normal"
        break
      case "insert":
        const editMode = this.state.editMode ? ` (${this.state.editMode})` : ""
        description = `Cell Edit - Insert${editMode}`
        break
      case "visual":
        description = "Cell Edit - Visual"
        break
      case "visual-line":
        description = "Cell Edit - Visual Line"
        break
      case "visual-block":
        description = "Cell Edit - Visual Block"
        break
      case "resize":
        description = "Cell Edit - Resize"
        break
      default:
        description = "Unknown"
    }
    
    return `${description}${interactionSuffix}`
  }

  getAllowedTransitions(): ModeTransitionEvent["type"][] {
    const allowed: ModeTransitionEvent["type"][] = []
    
    // Interaction mode can always be changed
    allowed.push("TOGGLE_INTERACTION_MODE", "SET_INTERACTION_MODE")
    if (this.state.gridMode === "navigation") {
      allowed.push("START_EDITING");
    } else if (this.state.gridMode === "editing") {
      allowed.push("STOP_EDITING", "ESCAPE");

      if (this.state.cellMode === "normal") {
        allowed.push(
          "ENTER_INSERT_MODE",
          "ENTER_VISUAL_MODE",
          "ENTER_VISUAL_BLOCK_MODE",
          "ENTER_RESIZE_MODE",
        );
      } else if (this.state.cellMode === "insert") {
        allowed.push("EXIT_INSERT_MODE", "SET_EDIT_MODE")
      } else if (
        this.state.cellMode === "visual" ||
        this.state.cellMode === "visual-line" ||
        this.state.cellMode === "visual-block"
      ) {
        allowed.push("EXIT_VISUAL_MODE")
      } else if (this.state.cellMode === "resize") {
        allowed.push("EXIT_RESIZE_MODE")
      }
    }

    return allowed;
  }
}
