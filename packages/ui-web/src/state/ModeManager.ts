import {
  SpreadsheetModeStateMachine,
  SpreadsheetState,
  GridMode,
  CellMode,
  EditMode,
  InteractionMode,
  ModeTransitionEvent,
  ModeChangeCallback,
} from "./SpreadsheetMode"

/**
 * High-level wrapper around SpreadsheetModeStateMachine that provides
 * convenient methods for mode management and queries.
 * 
 * This class serves as the main API for components to interact with
 * the unified mode system, abstracting away the complexity of the
 * underlying state machine.
 */
export class ModeManager {
  private stateMachine: SpreadsheetModeStateMachine

  constructor(stateMachine?: SpreadsheetModeStateMachine) {
    this.stateMachine = stateMachine || new SpreadsheetModeStateMachine()
  }

  // ==================== State Queries ====================

  /**
   * Returns the complete current state of the mode system
   */
  getState(): Readonly<SpreadsheetState> {
    return this.stateMachine.getState()
  }

  /**
   * Returns the current grid mode
   */
  getGridMode(): GridMode {
    return this.stateMachine.getGridMode()
  }

  /**
   * Returns the current cell mode
   */
  getCellMode(): CellMode {
    return this.stateMachine.getCellMode()
  }

  /**
   * Returns the current edit mode (if any)
   */
  getEditMode(): EditMode | undefined {
    return this.stateMachine.getEditMode()
  }

  /**
   * Returns the current interaction mode
   */
  getInteractionMode(): InteractionMode {
    return this.stateMachine.getInteractionMode()
  }

  // ==================== High-Level Mode Queries ====================

  /**
   * Returns true if currently in navigation mode
   */
  isNavigating(): boolean {
    return this.stateMachine.isInNavigationMode()
  }

  /**
   * Returns true if currently in any editing mode
   */
  isEditing(): boolean {
    return this.stateMachine.isInEditMode()
  }

  /**
   * Returns true if currently in insert mode within editing
   */
  isInInsertMode(): boolean {
    return this.stateMachine.isInInsertMode()
  }

  /**
   * Returns true if currently in visual mode (character or line)
   */
  isInVisualMode(): boolean {
    return this.stateMachine.isInVisualMode()
  }

  /**
   * Returns true if currently in visual character mode
   */
  isInVisualCharacterMode(): boolean {
    return this.isEditing() && this.getCellMode() === "visual"
  }

  /**
   * Returns true if currently in visual line mode
   */
  isInVisualLineMode(): boolean {
    return this.isEditing() && this.getCellMode() === "visual-line"
  }

  /**
   * Returns true if currently in normal cell mode (editing but not insert/visual)
   */
  isInNormalCellMode(): boolean {
    return this.stateMachine.isInNormalCellMode()
  }

  /**
   * Returns true if currently in keyboard-only interaction mode
   */
  isInKeyboardOnlyMode(): boolean {
    return this.stateMachine.isInKeyboardOnlyMode()
  }

  /**
   * Returns true if currently in normal interaction mode (mouse + keyboard)
   */
  isInNormalInteractionMode(): boolean {
    return this.stateMachine.isInNormalInteractionMode()
  }

  /**
   * Returns true if currently in append edit mode
   */
  isInAppendMode(): boolean {
    return this.stateMachine.isInAppendMode()
  }

  /**
   * Returns true if currently in replace edit mode
   */
  isInReplaceMode(): boolean {
    return this.stateMachine.isInReplaceMode()
  }

  /**
   * Returns the current edit mode or null if not in insert mode
   */
  getCurrentEditMode(): EditMode | null {
    return this.stateMachine.getCurrentEditMode()
  }

  /**
   * Returns the pending edit mode that will be applied when entering insert mode
   */
  getPendingEditMode(): EditMode | null {
    return this.stateMachine.getPendingEditMode()
  }

  // ==================== Transition Helpers ====================

  /**
   * Starts editing mode, optionally with a specific edit mode to apply
   * when entering insert mode.
   * 
   * @param editMode Optional edit mode to set as pending
   * @returns true if transition was successful
   */
  startEditing(editMode?: EditMode): boolean {
    return this.stateMachine.transition({
      type: "START_EDITING",
      editMode,
    })
  }

  /**
   * Stops editing and returns to navigation mode
   * 
   * @param commit Whether to commit changes (for future use)
   * @returns true if transition was successful
   */
  stopEditing(commit: boolean = true): boolean {
    return this.stateMachine.transition({
      type: "STOP_EDITING",
      commit,
    })
  }

  /**
   * Enters insert mode within editing, optionally with a specific edit mode
   * 
   * @param editMode Optional edit mode to apply
   * @returns true if transition was successful
   */
  enterInsertMode(editMode?: EditMode): boolean {
    return this.stateMachine.transition({
      type: "ENTER_INSERT_MODE",
      editMode,
    })
  }

  /**
   * Exits insert mode back to normal cell mode
   * 
   * @returns true if transition was successful
   */
  exitInsertMode(): boolean {
    return this.stateMachine.transition({
      type: "EXIT_INSERT_MODE",
    })
  }

  /**
   * Enters visual mode (character or line)
   * 
   * @param visualType Type of visual mode to enter
   * @returns true if transition was successful
   */
  enterVisualMode(visualType: "character" | "line" = "character"): boolean {
    return this.stateMachine.transition({
      type: "ENTER_VISUAL_MODE",
      visualType,
    })
  }

  /**
   * Exits visual mode back to normal cell mode
   * 
   * @returns true if transition was successful
   */
  exitVisualMode(): boolean {
    return this.stateMachine.transition({
      type: "EXIT_VISUAL_MODE",
    })
  }

  /**
   * Sets the edit mode when in insert mode
   * 
   * @param editMode The edit mode to set
   * @returns true if transition was successful
   */
  setEditMode(editMode: EditMode): boolean {
    return this.stateMachine.transition({
      type: "SET_EDIT_MODE",
      editMode,
    })
  }

  /**
   * Toggles between normal and keyboard-only interaction modes
   * 
   * @returns true if transition was successful
   */
  toggleInteractionMode(): boolean {
    return this.stateMachine.transition({
      type: "TOGGLE_INTERACTION_MODE",
    })
  }

  /**
   * Sets the interaction mode to a specific value
   * 
   * @param mode The interaction mode to set
   * @returns true if transition was successful
   */
  setInteractionMode(mode: InteractionMode): boolean {
    return this.stateMachine.transition({
      type: "SET_INTERACTION_MODE",
      mode,
    })
  }

  /**
   * Handles escape key behavior - exits current mode level
   * First escape exits insert/visual mode, second escape exits editing
   * 
   * @returns true if transition was successful
   */
  handleEscape(): boolean {
    return this.stateMachine.transition({
      type: "ESCAPE",
    })
  }

  // ==================== Convenience Methods ====================

  /**
   * Starts editing in insert mode with the specified edit mode
   * 
   * @param editMode The edit mode to use
   * @returns true if both transitions were successful
   */
  startEditingInInsertMode(editMode: EditMode = "insert"): boolean {
    if (!this.isEditing()) {
      const startResult = this.startEditing(editMode)
      if (!startResult) return false
    }
    
    if (!this.isInInsertMode()) {
      return this.enterInsertMode(editMode)
    }
    
    return true
  }

  /**
   * Starts editing in visual mode (character or line)
   * 
   * @param visualType The type of visual mode
   * @returns true if both transitions were successful
   */
  startEditingInVisualMode(visualType: "character" | "line" = "character"): boolean {
    if (!this.isEditing()) {
      const startResult = this.startEditing()
      if (!startResult) return false
    }
    
    if (!this.isInVisualMode()) {
      return this.enterVisualMode(visualType)
    }
    
    return true
  }

  /**
   * Returns to navigation mode from any current mode
   * 
   * @param commit Whether to commit changes
   * @returns true if successful
   */
  returnToNavigation(commit: boolean = true): boolean {
    if (!this.isEditing()) {
      return true // Already in navigation
    }
    
    return this.stopEditing(commit)
  }

  /**
   * Returns to normal cell mode from insert or visual modes
   * 
   * @returns true if successful
   */
  returnToNormalCellMode(): boolean {
    if (!this.isEditing()) {
      return false // Can't return to normal cell mode from navigation
    }
    
    if (this.isInNormalCellMode()) {
      return true // Already in normal cell mode
    }
    
    if (this.isInInsertMode()) {
      return this.exitInsertMode()
    }
    
    if (this.isInVisualMode()) {
      return this.exitVisualMode()
    }
    
    return false
  }

  // ==================== Validation Methods ====================

  /**
   * Checks if a specific transition is valid from the current state
   * 
   * @param event The transition event to validate
   * @returns true if the transition is valid
   */
  isValidTransition(event: ModeTransitionEvent): boolean {
    return this.stateMachine.isValidTransition(event)
  }

  /**
   * Checks if editing can be started from the current state
   */
  canStartEditing(): boolean {
    return this.stateMachine.canStartEditing()
  }

  /**
   * Checks if editing can be stopped from the current state
   */
  canStopEditing(): boolean {
    return this.stateMachine.canStopEditing()
  }

  /**
   * Checks if insert mode can be entered from the current state
   */
  canEnterInsertMode(): boolean {
    return this.stateMachine.canEnterInsertMode()
  }

  /**
   * Checks if insert mode can be exited from the current state
   */
  canExitInsertMode(): boolean {
    return this.stateMachine.canExitInsertMode()
  }

  /**
   * Checks if visual mode can be entered from the current state
   */
  canEnterVisualMode(): boolean {
    return this.stateMachine.canEnterVisualMode()
  }

  /**
   * Checks if visual mode can be exited from the current state
   */
  canExitVisualMode(): boolean {
    return this.stateMachine.canExitVisualMode()
  }

  /**
   * Checks if the edit mode can be set from the current state
   */
  canSetEditMode(): boolean {
    return this.stateMachine.canSetEditMode()
  }

  /**
   * Validates if the given edit mode is valid
   */
  isValidEditMode(editMode: EditMode): boolean {
    return this.stateMachine.isValidEditMode(editMode)
  }

  /**
   * Validates if the given interaction mode is valid
   */
  isValidInteractionMode(interactionMode: InteractionMode): boolean {
    return this.stateMachine.isValidInteractionMode(interactionMode)
  }

  // ==================== Event Subscription ====================

  /**
   * Subscribes to mode change events
   * 
   * @param callback Function to call when mode changes
   * @returns Unsubscribe function
   */
  onModeChange(callback: ModeChangeCallback): () => void {
    return this.stateMachine.onModeChange(callback)
  }

  /**
   * Subscribe to specific mode change events with filtering
   * 
   * @param callback Function to call when matching mode changes occur
   * @param filter Optional filter to only receive specific types of changes
   * @returns Unsubscribe function
   */
  onModeChangeFiltered(
    callback: ModeChangeCallback,
    filter?: {
      gridMode?: GridMode[]
      cellMode?: CellMode[]
      editMode?: EditMode[]
      interactionMode?: InteractionMode[]
    }
  ): () => void {
    const wrappedCallback: ModeChangeCallback = (newState, previousState) => {
      if (filter) {
        // Check if any of the specified modes are in the filter
        if (filter.gridMode && !filter.gridMode.includes(newState.gridMode)) {
          return
        }
        if (filter.cellMode && !filter.cellMode.includes(newState.cellMode)) {
          return
        }
        if (filter.editMode && newState.editMode && !filter.editMode.includes(newState.editMode)) {
          return
        }
        if (filter.interactionMode && !filter.interactionMode.includes(newState.interactionMode)) {
          return
        }
      }
      
      callback(newState, previousState)
    }
    
    return this.stateMachine.onModeChange(wrappedCallback)
  }

  // ==================== Utility Methods ====================

  /**
   * Gets a human-readable description of the current mode state
   */
  getStateDescription(): string {
    return this.stateMachine.getStateDescription()
  }

  /**
   * Gets the list of allowed transitions from the current state
   */
  getAllowedTransitions(): ModeTransitionEvent["type"][] {
    return this.stateMachine.getAllowedTransitions()
  }

  /**
   * Resets the mode system to its initial state
   */
  reset(): void {
    this.stateMachine.reset()
  }

  /**
   * Gets the underlying state machine (for advanced use cases)
   * Use with caution - prefer using ModeManager methods when possible
   */
  getStateMachine(): SpreadsheetModeStateMachine {
    return this.stateMachine
  }

  // ==================== Debug Helpers ====================

  /**
   * Returns debug information about the current state
   */
  getDebugInfo(): {
    state: SpreadsheetState
    description: string
    allowedTransitions: ModeTransitionEvent["type"][]
    canStartEditing: boolean
    canStopEditing: boolean
    canEnterInsertMode: boolean
    canExitInsertMode: boolean
    canEnterVisualMode: boolean
    canExitVisualMode: boolean
  } {
    return {
      state: this.getState(),
      description: this.getStateDescription(),
      allowedTransitions: this.getAllowedTransitions(),
      canStartEditing: this.canStartEditing(),
      canStopEditing: this.canStopEditing(),
      canEnterInsertMode: this.canEnterInsertMode(),
      canExitInsertMode: this.canExitInsertMode(),
      canEnterVisualMode: this.canEnterVisualMode(),
      canExitVisualMode: this.canExitVisualMode(),
    }
  }

  /**
   * Logs the current mode state to console (for debugging)
   */
  logCurrentState(): void {
    const debug = this.getDebugInfo()
    console.group("ModeManager State")
    console.log("Description:", debug.description)
    console.log("State:", debug.state)
    console.log("Allowed Transitions:", debug.allowedTransitions)
    console.log("Capabilities:", {
      canStartEditing: debug.canStartEditing,
      canStopEditing: debug.canStopEditing,
      canEnterInsertMode: debug.canEnterInsertMode,
      canExitInsertMode: debug.canExitInsertMode,
      canEnterVisualMode: debug.canEnterVisualMode,
      canExitVisualMode: debug.canExitVisualMode,
    })
    console.groupEnd()
  }
}

/**
 * Creates a new ModeManager instance with an optional existing state machine
 */
export function createModeManager(stateMachine?: SpreadsheetModeStateMachine): ModeManager {
  return new ModeManager(stateMachine)
}

/**
 * Type guard to check if an object is a ModeManager instance
 */
export function isModeManager(obj: any): obj is ModeManager {
  return obj instanceof ModeManager
}

export default ModeManager