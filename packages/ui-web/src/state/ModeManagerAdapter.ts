import { SpreadsheetStateMachine, type InsertMode, type VisualMode, type InteractionMode } from "./SpreadsheetStateMachine"
import type { SpreadsheetModeStateMachine } from "./SpreadsheetMode"

/**
 * Adapter class that provides backwards compatibility with the existing ModeManager API
 * while using the new cleaner SpreadsheetStateMachine internally.
 */
export class ModeManagerAdapter {
  private stateMachine: SpreadsheetStateMachine

  constructor(stateMachine?: SpreadsheetStateMachine) {
    this.stateMachine = stateMachine || new SpreadsheetStateMachine()
  }

  // Core state accessors
  getStateMachine(): SpreadsheetStateMachine {
    return this.stateMachine
  }

  getState() {
    return this.stateMachine.getState()
  }

  // Grid mode queries
  isNavigating(): boolean {
    return this.stateMachine.isNavigating()
  }

  isEditing(): boolean {
    return this.stateMachine.isEditing()
  }

  getGridMode(): "navigation" | "editing" {
    return this.stateMachine.isNavigating() ? "navigation" : "editing"
  }

  // Cell mode queries
  isInNormalCellMode(): boolean {
    return this.stateMachine.isInNormalMode()
  }

  isInInsertMode(): boolean {
    return this.stateMachine.isInInsertMode()
  }

  isInVisualMode(): boolean {
    return this.stateMachine.isInVisualMode()
  }

  isInVisualCharacterMode(): boolean {
    return this.stateMachine.getVisualMode() === "character"
  }

  isInVisualLineMode(): boolean {
    return this.stateMachine.getVisualMode() === "line"
  }

  isInVisualBlockMode(): boolean {
    return this.stateMachine.getVisualMode() === "block"
  }

  isInResizeMode(): boolean {
    return this.stateMachine.isInResizeMode()
  }

  getCellMode(): string {
    const state = this.stateMachine.getState()
    if (state.type === "navigation") return "normal"
    
    switch (state.substate.type) {
      case "normal": return "normal"
      case "insert": return "insert"
      case "visual": return "visual"
      case "resize": return "resize"
    }
  }

  // Edit mode queries
  getCurrentEditMode(): InsertMode | undefined {
    return this.stateMachine.getInsertMode()
  }

  isInAppendMode(): boolean {
    return this.stateMachine.getInsertMode() === "append"
  }

  isInReplaceMode(): boolean {
    return this.stateMachine.getInsertMode() === "replace"
  }

  // Interaction mode queries
  getInteractionMode(): InteractionMode {
    return this.stateMachine.getInteractionMode()
  }

  isInNormalInteractionMode(): boolean {
    return this.stateMachine.getInteractionMode() === "normal"
  }

  isInKeyboardOnlyMode(): boolean {
    return this.stateMachine.isInKeyboardOnlyMode()
  }

  // State transitions
  startEditing(editMode?: InsertMode): boolean {
    const result = this.stateMachine.transition({ type: "START_EDITING", editMode })
    return result.ok
  }

  stopEditing(): boolean {
    const result = this.stateMachine.transition({ type: "STOP_EDITING" })
    return result.ok
  }

  enterInsertMode(mode?: InsertMode): boolean {
    const result = this.stateMachine.transition({ type: "ENTER_INSERT_MODE", mode })
    return result.ok
  }

  exitInsertMode(): boolean {
    const result = this.stateMachine.transition({ type: "EXIT_INSERT_MODE" })
    return result.ok
  }

  enterVisualMode(visualType: VisualMode = "character"): boolean {
    const result = this.stateMachine.transition({ type: "ENTER_VISUAL_MODE", visualType })
    return result.ok
  }

  exitVisualMode(): boolean {
    const result = this.stateMachine.transition({ type: "EXIT_VISUAL_MODE" })
    return result.ok
  }

  enterResizeMode(type: "column" | "row", index: number): boolean {
    const result = this.stateMachine.transition({
      type: "ENTER_RESIZE_MODE",
      target: { type, index },
    })
    return result.ok
  }

  exitResizeMode(): boolean {
    const result = this.stateMachine.transition({ type: "EXIT_RESIZE_MODE" })
    return result.ok
  }

  setEditMode(mode: InsertMode): boolean {
    const result = this.stateMachine.transition({ type: "SET_EDIT_MODE", mode })
    return result.ok
  }

  toggleInteractionMode(): boolean {
    const result = this.stateMachine.transition({ type: "TOGGLE_INTERACTION_MODE" })
    return result.ok
  }

  setInteractionMode(mode: InteractionMode): boolean {
    const result = this.stateMachine.transition({ type: "SET_INTERACTION_MODE", mode })
    return result.ok
  }

  handleEscape(): boolean {
    const result = this.stateMachine.transition({ type: "ESCAPE" })
    return result.ok
  }

  // Subscribe to state changes
  subscribe(listener: (state: any) => void): () => void {
    return this.stateMachine.subscribe(listener)
  }

  // Convert new state machine to old SpreadsheetModeStateMachine for compatibility
  toLegacyStateMachine(): SpreadsheetModeStateMachine {
    // This would require importing the old implementation
    // For now, we'll throw an error to indicate this needs migration
    throw new Error("Legacy state machine conversion not implemented. Please migrate to new API.")
  }
}

// Factory function that matches the old API
export function createModeManager(stateMachine?: SpreadsheetStateMachine): ModeManagerAdapter {
  return new ModeManagerAdapter(stateMachine)
}

// Re-export as ModeManager for drop-in replacement
export { ModeManagerAdapter as ModeManager }