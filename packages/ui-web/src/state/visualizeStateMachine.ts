import { transitions } from "./SpreadsheetStateMachine"

/**
 * Generates a Mermaid diagram of the state machine transitions
 */
export function generateStateDiagram(): string {
  const lines: string[] = ["stateDiagram-v2"]
  
  // Define states
  lines.push("    [*] --> Navigation")
  lines.push("    Navigation --> Editing: START_EDITING")
  lines.push("    Editing --> Navigation: STOP_EDITING/ESCAPE")
  lines.push("")
  lines.push("    state Editing {")
  lines.push("        [*] --> Normal")
  lines.push("        Normal --> Insert: ENTER_INSERT_MODE")
  lines.push("        Normal --> Visual: ENTER_VISUAL_MODE")
  lines.push("        Normal --> Resize: ENTER_RESIZE_MODE")
  lines.push("        Insert --> Normal: EXIT_INSERT_MODE/ESCAPE")
  lines.push("        Visual --> Normal: EXIT_VISUAL_MODE/ESCAPE")
  lines.push("        Resize --> Normal: EXIT_RESIZE_MODE/ESCAPE")
  lines.push("")
  lines.push("        state Insert {")
  lines.push("            [*] --> InsertMode")
  lines.push("            InsertMode --> AppendMode: SET_EDIT_MODE")
  lines.push("            AppendMode --> ReplaceMode: SET_EDIT_MODE")
  lines.push("            ReplaceMode --> InsertMode: SET_EDIT_MODE")
  lines.push("        }")
  lines.push("")
  lines.push("        state Visual {")
  lines.push("            [*] --> Character")
  lines.push("            Character --> Line: mode change")
  lines.push("            Line --> Block: mode change")
  lines.push("        }")
  lines.push("    }")
  
  return lines.join("\n")
}

/**
 * Generates a simplified ASCII representation of valid state transitions
 */
export function generateStateTable(): string {
  const states = {
    "Navigation": ["START_EDITING → Editing:Normal"],
    "Editing:Normal": [
      "ENTER_INSERT_MODE → Editing:Insert",
      "ENTER_VISUAL_MODE → Editing:Visual",
      "ENTER_RESIZE_MODE → Editing:Resize",
      "STOP_EDITING/ESCAPE → Navigation"
    ],
    "Editing:Insert": [
      "EXIT_INSERT_MODE/ESCAPE → Editing:Normal",
      "SET_EDIT_MODE → (change mode)"
    ],
    "Editing:Visual": [
      "EXIT_VISUAL_MODE/ESCAPE → Editing:Normal"
    ],
    "Editing:Resize": [
      "EXIT_RESIZE_MODE/ESCAPE → Editing:Normal"
    ]
  }
  
  let output = "State Machine Transitions\n"
  output += "========================\n\n"
  
  for (const [state, transitions] of Object.entries(states)) {
    output += `${state}:\n`
    for (const transition of transitions) {
      output += `  - ${transition}\n`
    }
    output += "\n"
  }
  
  output += "Note: TOGGLE_INTERACTION_MODE and SET_INTERACTION_MODE work in all states\n"
  
  return output
}

/**
 * Analyzes the state machine and returns statistics
 */
export function analyzeStateMachine() {
  const transitionCount = Object.keys(transitions).length
  const states = new Set<string>()
  const actions = new Set<string>()
  
  for (const key of Object.keys(transitions)) {
    const [state, ...actionParts] = key.split(".")
    states.add(state)
    if (actionParts.length > 0) {
      actions.add(actionParts[actionParts.length - 1])
    }
  }
  
  return {
    totalTransitions: transitionCount,
    uniqueStates: states.size,
    uniqueActions: actions.size,
    statesList: Array.from(states),
    actionsList: Array.from(actions).sort(),
    averageTransitionsPerState: Math.round(transitionCount / states.size * 100) / 100
  }
}

// Example usage:
if (import.meta.main) {
  console.log(generateStateTable())
  console.log("\nState Machine Analysis:")
  console.log(analyzeStateMachine())
  console.log("\nMermaid Diagram:")
  console.log(generateStateDiagram())
}