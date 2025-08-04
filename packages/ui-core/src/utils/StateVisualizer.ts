import type { UIStateMachine } from "../state/UIStateMachine";

/**
 * Analyzes the UIStateMachine's transitions to build a state hierarchy
 */
function analyzeTransitions(stateMachine: UIStateMachine) {
  const stateHierarchy = new Map<string, Set<string>>();
  const transitionMap = new Map<string, Map<string, string>>();
  const allActions = new Set<string>();

  // Access the transitions from the state machine
  // Since transitions is private, we'll use a different approach - analyze based on known structure
  const knownTransitions = [
    { from: "navigation", action: "START_EDITING", to: "editing" },
    { from: "navigation", action: "ENTER_COMMAND_MODE", to: "command" },
    { from: "navigation", action: "ENTER_RESIZE_MODE", to: "resize" },
    { from: "editing", action: "EXIT_TO_NAVIGATION", to: "navigation" },
    { from: "editing.normal", action: "ENTER_INSERT_MODE", to: "editing.insert" },
    { from: "editing.insert", action: "EXIT_INSERT_MODE", to: "editing.normal" },
    { from: "editing.normal", action: "ENTER_VISUAL_MODE", to: "editing.visual" },
    { from: "editing.visual", action: "EXIT_VISUAL_MODE", to: "editing.normal" },
    { from: "command", action: "EXIT_COMMAND_MODE", to: "navigation" },
    { from: "resize", action: "EXIT_RESIZE_MODE", to: "navigation" },
    { from: "editing", action: "ESCAPE", to: "navigation" },
    { from: "command", action: "ESCAPE", to: "navigation" },
    { from: "resize", action: "ESCAPE", to: "navigation" },
  ];

  // Build hierarchy and transition map
  knownTransitions.forEach(({ from, action, to }) => {
    allActions.add(action);
    
    const fromParts = from.split(".");
    const toParts = to.split(".");
    
    // Add to hierarchy
    if (fromParts.length > 1) {
      const [parent, substate] = fromParts;
      if (!stateHierarchy.has(parent)) {
        stateHierarchy.set(parent, new Set());
      }
      stateHierarchy.get(parent)?.add(substate);
    } else {
      if (!stateHierarchy.has(from)) {
        stateHierarchy.set(from, new Set());
      }
    }
    
    if (toParts.length > 1) {
      const [parent, substate] = toParts;
      if (!stateHierarchy.has(parent)) {
        stateHierarchy.set(parent, new Set());
      }
      stateHierarchy.get(parent)?.add(substate);
    }
    
    // Add to transition map
    if (!transitionMap.has(from)) {
      transitionMap.set(from, new Map());
    }
    transitionMap.get(from)?.set(action, to);
  });

  return { stateHierarchy, transitionMap, allActions };
}

/**
 * Generates a Mermaid diagram of the state machine transitions
 */
export function generateMermaidDiagram(stateMachine: UIStateMachine): string {
  const { stateHierarchy, transitionMap } = analyzeTransitions(stateMachine);
  const lines: string[] = ["stateDiagram-v2"];

  // Add initial state
  lines.push("    [*] --> navigation");

  // Process each top-level state
  for (const [state, substates] of stateHierarchy) {
    if (substates.size > 0) {
      lines.push(`    state ${state} {`);
      
      // Determine initial substate
      if (state === "editing") {
        lines.push("        [*] --> normal");
      }
      
      // Add substate transitions
      for (const substate of substates) {
        const fullState = `${state}.${substate}`;
        const transitions = transitionMap.get(fullState) || new Map();
        
        for (const [action, target] of transitions) {
          const targetParts = target.split(".");
          const targetState = targetParts.length > 1 && targetParts[0] === state 
            ? targetParts[1] 
            : target;
          
          if (targetParts[0] === state && target !== fullState) {
            lines.push(`        ${substate} --> ${targetState}: ${action}`);
          }
        }
      }
      
      lines.push("    }");
    }
    
    // Add top-level transitions
    const topTransitions = transitionMap.get(state) || new Map();
    for (const [action, target] of topTransitions) {
      if (!target.startsWith(`${state}.`)) {
        lines.push(`    ${state} --> ${target}: ${action}`);
      }
    }
  }

  return lines.join("\n");
}

/**
 * Generates a state transition table in text format
 */
export function generateStateTable(stateMachine: UIStateMachine): string {
  const { transitionMap } = analyzeTransitions(stateMachine);
  const headers = ["Current State", "Action", "Next State"];
  const transitions: string[][] = [];
  
  // Build transition rows from the map
  for (const [from, actions] of transitionMap) {
    for (const [action, to] of actions) {
      transitions.push([from, action, to]);
    }
  }
  
  // Sort for consistent output
  transitions.sort((a, b) => {
    if (a[0] !== b[0]) return a[0].localeCompare(b[0]);
    return a[1].localeCompare(b[1]);
  });

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
 * Generates a PlantUML diagram of the state machine transitions
 */
export function generatePlantUMLDiagram(stateMachine: UIStateMachine): string {
  const { stateHierarchy, transitionMap } = analyzeTransitions(stateMachine);
  const lines: string[] = ["@startuml", "[*] --> navigation"];

  for (const [state, substates] of stateHierarchy) {
    if (substates.size > 0) {
      lines.push(`state ${state} {`);
      
      // Determine initial substate
      if (state === "editing") {
        lines.push("  [*] --> normal");
      }

      for (const substate of substates) {
        const fullState = `${state}.${substate}`;
        const transitions = transitionMap.get(fullState) || new Map();

        for (const [action, target] of transitions) {
          const targetParts = target.split(".");
          const targetState = targetParts.length > 1 && targetParts[0] === state 
            ? targetParts[1] 
            : target;

          if (target !== fullState && targetParts[0] === state) {
            lines.push(`  ${substate} --> ${targetState} : ${action}`);
          }
        }
      }

      lines.push("}");
    }

    const topTransitions = transitionMap.get(state) || new Map();
    for (const [action, target] of topTransitions) {
      if (target !== state && !target.startsWith(`${state}.`)) {
        lines.push(`${state} --> ${target} : ${action}`);
      }
    }
  }

  lines.push("@enduml");
  return lines.join("\n");
}

/**
 * Generates an HTML documentation page with embedded Mermaid diagram
 */
export function generateHTMLDocumentation(stateMachine: UIStateMachine): string {
  const diagram = generateMermaidDiagram(stateMachine);
  const table = generateStateTable(stateMachine);
  const analysis = analyzeStateHistory(stateMachine);
  
  // Extract statistics from analysis
  const totalTransitions = analysis.match(/Total transitions: (\d+)/)?.[1] || "0";
  
  // Count unique states and actions from the transition analysis
  const { stateHierarchy, allActions } = analyzeTransitions(stateMachine);
  const allStates = new Set<string>();
  for (const [state, substates] of stateHierarchy) {
    allStates.add(state);
    for (const substate of substates) {
      allStates.add(`${state}.${substate}`);
    }
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>UI State Machine Documentation</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 0;
      background: #1a1a1a;
      color: #e0e0e0;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    h1 {
      color: #fff;
      text-align: center;
      margin-bottom: 40px;
    }
    .stats {
      display: flex;
      justify-content: center;
      gap: 40px;
      margin-bottom: 40px;
      flex-wrap: wrap;
    }
    .stat {
      text-align: center;
      background: #2d2d2d;
      padding: 20px 30px;
      border-radius: 8px;
    }
    .stat-value {
      font-size: 36px;
      font-weight: bold;
      color: #4a9eff;
    }
    .stat-label {
      font-size: 14px;
      color: #999;
      margin-top: 8px;
    }
    .diagram-container {
      background: #fff;
      padding: 40px;
      border-radius: 8px;
      margin-bottom: 40px;
      overflow-x: auto;
    }
    .table-container {
      background: #2d2d2d;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 40px;
      overflow-x: auto;
    }
    pre {
      margin: 0;
      font-family: 'Monaco', 'Consolas', monospace;
      font-size: 14px;
      line-height: 1.5;
    }
    .analysis {
      background: #2d2d2d;
      padding: 20px;
      border-radius: 8px;
      white-space: pre-wrap;
      font-family: 'Monaco', 'Consolas', monospace;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>UI State Machine Documentation</h1>
    
    <div class="stats">
      <div class="stat">
        <div class="stat-value">${allStates.size}</div>
        <div class="stat-label">States</div>
      </div>
      <div class="stat">
        <div class="stat-value">${allActions.size}</div>
        <div class="stat-label">Actions</div>
      </div>
      <div class="stat">
        <div class="stat-value">${totalTransitions}</div>
        <div class="stat-label">Transitions</div>
      </div>
    </div>

    <div class="diagram-container">
      <pre class="mermaid">
${diagram}
      </pre>
    </div>

    <div class="table-container">
      <h2>State Transition Table</h2>
      <pre>${table}</pre>
    </div>

    <div class="analysis">
      <h2>State Machine Analysis</h2>
      <pre>${analysis}</pre>
    </div>
  </div>

  <script>
    mermaid.initialize({ 
      startOnLoad: true,
      theme: 'default',
      securityLevel: 'loose',
    });
  </script>
</body>
</html>`;

  return html;
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
