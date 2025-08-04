import type { UIStateMachine } from "../state/UIStateMachine";

/**
 * Generates a Mermaid diagram of the state machine transitions
 */
export function generateMermaidDiagram(_stateMachine: UIStateMachine): string {
  const lines: string[] = ["stateDiagram-v2"];

  // Add initial state
  lines.push("    [*] --> navigation");

  // Define states and substates
  lines.push("    state navigation {");
  lines.push("        [*] --> idle");
  lines.push("    }");

  lines.push("    state editing {");
  lines.push("        [*] --> normal");
  lines.push("        normal --> insert: ENTER_INSERT_MODE");
  lines.push("        insert --> normal: EXIT_INSERT_MODE");
  lines.push("        normal --> visual: ENTER_VISUAL_MODE");
  lines.push("        visual --> normal: EXIT_VISUAL_MODE");
  lines.push("    }");

  lines.push("    state command {");
  lines.push("        [*] --> input");
  lines.push("    }");

  lines.push("    state resize {");
  lines.push("        [*] --> active");
  lines.push("    }");

  // Top-level transitions
  lines.push("    navigation --> editing: START_EDITING");
  lines.push("    editing --> navigation: EXIT_TO_NAVIGATION");
  lines.push("    navigation --> command: ENTER_COMMAND_MODE");
  lines.push("    command --> navigation: EXIT_COMMAND_MODE");
  lines.push("    navigation --> resize: ENTER_RESIZE_MODE");
  lines.push("    resize --> navigation: EXIT_RESIZE_MODE");

  // Escape transitions
  lines.push("    editing --> navigation: ESCAPE");
  lines.push("    command --> navigation: ESCAPE");
  lines.push("    resize --> navigation: ESCAPE");

  return lines.join("\n");
}

/**
 * Generates a state transition table in text format
 */
export function generateStateTable(_stateMachine: UIStateMachine): string {
  const headers = ["Current State", "Action", "Next State"];
  const transitions = [
    ["navigation", "START_EDITING", "editing.normal"],
    ["navigation", "ENTER_COMMAND_MODE", "command"],
    ["navigation", "ENTER_RESIZE_MODE", "resize"],
    ["editing.normal", "ENTER_INSERT_MODE", "editing.insert"],
    ["editing.insert", "EXIT_INSERT_MODE", "editing.normal"],
    ["editing.normal", "ENTER_VISUAL_MODE", "editing.visual"],
    ["editing.visual", "EXIT_VISUAL_MODE", "editing.normal"],
    ["editing", "EXIT_TO_NAVIGATION", "navigation"],
    ["command", "EXIT_COMMAND_MODE", "navigation"],
    ["resize", "EXIT_RESIZE_MODE", "navigation"],
  ];

  // Calculate column widths
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...transitions.map((t) => t[i].length)),
  );

  // Create table
  const lines: string[] = [];

  // Header
  lines.push(headers.map((h, i) => h.padEnd(widths[i])).join(" | "));
  lines.push(widths.map((w) => "-".repeat(w)).join("-|-"));

  // Rows
  for (const row of transitions) {
    lines.push(row.map((cell, i) => cell.padEnd(widths[i])).join(" | "));
  }

  return lines.join("\n");
}

/**
 * Analyzes the state machine history and generates a summary
 */
export function analyzeStateHistory(stateMachine: UIStateMachine): string {
  const history = stateMachine.getHistory();
  const lines: string[] = [];

  lines.push("=== State Machine History Analysis ===");
  lines.push(`Total transitions: ${history.length}`);

  if (history.length === 0) {
    lines.push("No transitions recorded.");
    return lines.join("\n");
  }

  // Count transitions by action type
  const actionCounts = new Map<string, number>();
  const stateCounts = new Map<string, number>();

  for (const { action, state } of history) {
    actionCounts.set(action.type, (actionCounts.get(action.type) || 0) + 1);
    const stateKey = `${state.spreadsheetMode}${
      state.spreadsheetMode === "editing" ? `.${state.cellMode}` : ""
    }`;
    stateCounts.set(stateKey, (stateCounts.get(stateKey) || 0) + 1);
  }

  lines.push("\nActions performed:");
  const sortedActions = Array.from(actionCounts.entries()).sort(
    (a, b) => b[1] - a[1],
  );
  for (const [action, count] of sortedActions) {
    lines.push(`  ${action}: ${count}`);
  }

  lines.push("\nStates visited:");
  const sortedStates = Array.from(stateCounts.entries()).sort(
    (a, b) => b[1] - a[1],
  );
  for (const [state, count] of sortedStates) {
    lines.push(`  ${state}: ${count}`);
  }

  // Analyze patterns
  lines.push("\nCommon patterns:");

  // Find edit sessions (START_EDITING -> ... -> EXIT_TO_NAVIGATION)
  let editSessions = 0;
  let inEditSession = false;
  for (const { action } of history) {
    if (action.type === "START_EDITING") {
      inEditSession = true;
      editSessions++;
    } else if (action.type === "EXIT_TO_NAVIGATION" && inEditSession) {
      inEditSession = false;
    }
  }
  lines.push(`  Edit sessions: ${editSessions}`);

  // Find command mode usage
  const commandModeUsage = actionCounts.get("ENTER_COMMAND_MODE") || 0;
  lines.push(`  Command mode used: ${commandModeUsage} times`);

  // Find resize operations
  const resizeOperations = actionCounts.get("ENTER_RESIZE_MODE") || 0;
  lines.push(`  Resize operations: ${resizeOperations}`);

  return lines.join("\n");
}
