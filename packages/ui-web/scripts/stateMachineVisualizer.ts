import { exec } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { transitions } from "../src/state/SpreadsheetStateMachine";

const execAsync = promisify(exec);

/**
 * Parses transition keys and builds a state hierarchy
 */
function parseTransitions() {
  const stateHierarchy = new Map<string, Set<string>>();
  const transitionMap = new Map<string, Map<string, string>>();
  const allActions = new Set<string>();

  for (const key of Object.keys(transitions)) {
    const parts = key.split(".");
    const action = parts[parts.length - 1];
    allActions.add(action);

    if (parts.length === 2) {
      // Top-level state transition (e.g., "navigation.START_EDITING")
      const [state] = parts;
      if (!stateHierarchy.has(state)) {
        stateHierarchy.set(state, new Set());
      }
      if (!transitionMap.has(state)) {
        transitionMap.set(state, new Map());
      }
      transitionMap
        .get(state)
        ?.set(action, determineTargetState(state, action));
    } else if (parts.length === 3) {
      // Substate transition (e.g., "editing.normal.ENTER_INSERT_MODE")
      const [parentState, substate] = parts;
      const fullState = `${parentState}.${substate}`;

      if (!stateHierarchy.has(parentState)) {
        stateHierarchy.set(parentState, new Set());
      }
      stateHierarchy.get(parentState)?.add(substate);

      if (!transitionMap.has(fullState)) {
        transitionMap.set(fullState, new Map());
      }
      transitionMap
        .get(fullState)
        ?.set(action, determineTargetState(fullState, action));
    }
  }

  return { stateHierarchy, transitionMap, allActions };
}

/**
 * Determines the target state based on the action
 */
function determineTargetState(fromState: string, action: string): string {
  // These are based on the actual state machine logic
  const actionTargets: Record<string, string> = {
    START_EDITING: "editing",
    STOP_EDITING: "navigation",
    ESCAPE: fromState.startsWith("editing.") ? "editing.normal" : "navigation",
    ENTER_INSERT_MODE: "editing.insert",
    EXIT_INSERT_MODE: "editing.normal",
    ENTER_VISUAL_MODE: "editing.visual",
    EXIT_VISUAL_MODE: "editing.normal",
    ENTER_VISUAL_BLOCK_MODE: "editing.visual",
    ENTER_RESIZE_MODE: "editing.resize",
    EXIT_RESIZE_MODE: "editing.normal",
    TOGGLE_INTERACTION_MODE: fromState, // Stays in same state
    SET_INTERACTION_MODE: fromState, // Stays in same state
    SET_EDIT_MODE: fromState, // Stays in same state
  };

  return actionTargets[action] || fromState;
}

/**
 * Generates a Mermaid diagram of the state machine transitions
 */
export function generateStateDiagram(): string {
  const { stateHierarchy, transitionMap } = parseTransitions();
  const lines: string[] = ["stateDiagram-v2"];

  // Add initial state
  lines.push("    [*] --> navigation");

  // Process each top-level state
  for (const [state, substates] of stateHierarchy) {
    if (substates.size > 0) {
      lines.push(`    state ${state} {`);
      lines.push(`        [*] --> normal`);

      // Add substates
      for (const substate of substates) {
        const fullState = `${state}.${substate}`;
        const transitions = transitionMap.get(fullState) || new Map();

        for (const [action, target] of transitions) {
          const targetParts = target.split(".");
          const targetState = targetParts.length > 1 ? targetParts[1] : target;

          if (target !== fullState) {
            lines.push(`        ${substate} --> ${targetState}: ${action}`);
          }
        }
      }

      lines.push("    }");
    }

    // Add top-level transitions
    const topTransitions = transitionMap.get(state) || new Map();
    for (const [action, target] of topTransitions) {
      if (target !== state) {
        lines.push(`    ${state} --> ${target}: ${action}`);
      }
    }
  }

  return lines.join("\n");
}

/**
 * Generates a simplified ASCII representation of valid state transitions
 */
export function generateStateTable(): string {
  const { transitionMap } = parseTransitions();
  let output = "State Machine Transitions\n";
  output += "========================\n\n";

  // Sort states for consistent output
  const sortedStates = Array.from(transitionMap.keys()).sort();

  for (const state of sortedStates) {
    const transitions = transitionMap.get(state);
    if (!transitions || transitions.size === 0) continue;

    output += `${state}:\n`;
    for (const [action, target] of transitions) {
      const arrow = target === state ? "↻" : "→";
      output += `  - ${action} ${arrow} ${target}\n`;
    }
    output += "\n";
  }

  output += "Notes:\n";
  output +=
    "- TOGGLE_INTERACTION_MODE and SET_INTERACTION_MODE work in all states\n";
  output += "- ESCAPE generally returns to the previous state or navigation\n";
  output += "- ↻ indicates the state remains unchanged\n";

  return output;
}

/**
 * Analyzes the state machine and returns statistics
 */
export function analyzeStateMachine() {
  const { stateHierarchy, transitionMap, allActions } = parseTransitions();
  const transitionCount = Object.keys(transitions).length;

  const allStates = new Set<string>();
  for (const [state, substates] of stateHierarchy) {
    allStates.add(state);
    for (const substate of substates) {
      allStates.add(`${state}.${substate}`);
    }
  }

  const transitionsByState = new Map<string, number>();
  for (const [state, trans] of transitionMap) {
    transitionsByState.set(state, trans.size);
  }

  return {
    totalTransitions: transitionCount,
    uniqueStates: allStates.size,
    uniqueActions: allActions.size,
    statesList: Array.from(allStates).sort(),
    actionsList: Array.from(allActions).sort(),
    averageTransitionsPerState:
      Math.round((transitionCount / allStates.size) * 100) / 100,
    transitionsByState: Object.fromEntries(transitionsByState),
  };
}

/**
 * Generates a PlantUML diagram as an alternative to Mermaid
 */
export function generatePlantUMLDiagram(): string {
  const { stateHierarchy, transitionMap } = parseTransitions();
  const lines: string[] = ["@startuml", "[*] --> navigation"];

  for (const [state, substates] of stateHierarchy) {
    if (substates.size > 0) {
      lines.push(`state ${state} {`);
      lines.push(`  [*] --> normal`);

      for (const substate of substates) {
        const fullState = `${state}.${substate}`;
        const transitions = transitionMap.get(fullState) || new Map();

        for (const [action, target] of transitions) {
          const targetParts = target.split(".");
          const targetState = targetParts.length > 1 ? targetParts[1] : target;

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
 * Generates an HTML page with embedded Mermaid diagram
 */
export function generateHTMLPage(outputPath?: string): string {
  const diagram = generateStateDiagram();
  const analysis = analyzeStateMachine();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Spreadsheet State Machine Diagram</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 0;
      background: #1a1a1a;
      color: #e0e0e0;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    .header {
      background: #2d2d2d;
      padding: 20px;
      text-align: center;
      border-bottom: 1px solid #444;
    }
    h1 {
      margin: 0;
      color: #fff;
      font-size: 24px;
      font-weight: 500;
    }
    #diagram-container {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 40px 20px;
      overflow: auto;
    }
    #diagram {
      background: #fff;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      max-width: 90vw;
      overflow-x: auto;
    }
    .footer {
      background: #2d2d2d;
      padding: 20px;
      border-top: 1px solid #444;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 20px;
    }
    .info-section {
      display: flex;
      gap: 30px;
      align-items: center;
    }
    .info-item {
      text-align: center;
    }
    .info-label {
      color: #999;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .info-value {
      color: #fff;
      font-size: 18px;
      font-weight: 500;
      margin-top: 4px;
    }
    .timestamp {
      color: #999;
      font-size: 14px;
    }
    .details {
      margin-top: 20px;
      padding: 20px;
      background: #2d2d2d;
      border-radius: 8px;
      display: none;
    }
    .toggle-details {
      background: #444;
      color: #fff;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      transition: background 0.2s;
    }
    .toggle-details:hover {
      background: #555;
    }
    .details.show {
      display: block;
    }
    .actions-states {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-top: 20px;
    }
    .actions-states h3 {
      color: #fff;
      margin-bottom: 10px;
      font-size: 16px;
    }
    .actions-states ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .actions-states li {
      padding: 4px 0;
      font-family: monospace;
      font-size: 14px;
      color: #b0b0b0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Spreadsheet State Machine</h1>
  </div>

  <div id="diagram-container">
    <div id="diagram">
      <pre class="mermaid">
${diagram}
      </pre>
    </div>
  </div>

  <div class="footer">
    <div class="info-section">
      <div class="info-item">
        <div class="info-label">States</div>
        <div class="info-value">${analysis.uniqueStates}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Actions</div>
        <div class="info-value">${analysis.uniqueActions}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Transitions</div>
        <div class="info-value">${analysis.totalTransitions}</div>
      </div>
      <button class="toggle-details" onclick="toggleDetails()">Show Details</button>
    </div>
    <div class="timestamp">Generated on ${new Date().toLocaleString()}</div>
  </div>

  <div id="details" class="details">
    <div class="actions-states">
      <div>
        <h3>Available Actions</h3>
        <ul>
          ${analysis.actionsList.map((action) => `<li>${action}</li>`).join("\n          ")}
        </ul>
      </div>
      <div>
        <h3>States</h3>
        <ul>
          ${analysis.statesList.map((state) => `<li>${state}</li>`).join("\n          ")}
        </ul>
      </div>
    </div>
  </div>

  <script>
    mermaid.initialize({ 
      startOnLoad: true,
      theme: 'default',
      securityLevel: 'loose',
    });

    function toggleDetails() {
      const details = document.getElementById('details');
      const button = document.querySelector('.toggle-details');
      details.classList.toggle('show');
      button.textContent = details.classList.contains('show') ? 'Hide Details' : 'Show Details';
    }
  </script>
</body>
</html>`;

  if (outputPath) {
    writeFileSync(outputPath, html);
  }

  return html;
}

/**
 * Opens the state diagram in the default browser
 */
export async function openInBrowser(htmlPath?: string): Promise<void> {
  const path =
    htmlPath ||
    join(import.meta.dir, "../docs/state-machine/state-diagram.html");

  // Generate HTML if it doesn't exist
  generateHTMLPage(path);

  // Open in browser based on platform
  const platform = process.platform;
  let command: string;

  if (platform === "darwin") {
    command = `open "${path}"`;
  } else if (platform === "win32") {
    command = `start "${path}"`;
  } else {
    // Linux
    command = `xdg-open "${path}"`;
  }

  try {
    await execAsync(command);
    console.log(`✅ Opened state diagram in browser: ${path}`);
  } catch (error) {
    console.error("Failed to open browser:", error);
    console.log(`You can manually open: ${path}`);
  }
}

/**
 * Exports the Mermaid diagram to SVG using mermaid-cli
 */
export async function exportToSVG(outputPath?: string): Promise<void> {
  const mermaidPath = join(
    import.meta.dir,
    "../docs/state-machine/state-diagram.mmd",
  );
  const svgPath =
    outputPath ||
    join(import.meta.dir, "../docs/state-machine/state-diagram.svg");

  // Write mermaid diagram to file
  const diagram = generateStateDiagram();
  writeFileSync(mermaidPath, diagram);

  try {
    // Use mermaid-cli to generate SVG
    await execAsync(
      `mmdc -i "${mermaidPath}" -o "${svgPath}" -t dark -b transparent`,
    );
    console.log(`✅ Generated SVG: ${svgPath}`);
  } catch (error) {
    console.error("Failed to generate SVG:", error);
    console.log(
      "Make sure mermaid-cli is installed: bun add -D @mermaid-js/mermaid-cli",
    );
  }
}

/**
 * Exports the Mermaid diagram to PNG using mermaid-cli
 */
export async function exportToPNG(outputPath?: string): Promise<void> {
  const mermaidPath = join(
    import.meta.dir,
    "../docs/state-machine/state-diagram.mmd",
  );
  const pngPath =
    outputPath ||
    join(import.meta.dir, "../docs/state-machine/state-diagram.png");

  // Write mermaid diagram to file
  const diagram = generateStateDiagram();
  writeFileSync(mermaidPath, diagram);

  try {
    // Use mermaid-cli to generate PNG
    await execAsync(
      `mmdc -i "${mermaidPath}" -o "${pngPath}" -t dark -b transparent`,
    );
    console.log(`✅ Generated PNG: ${pngPath}`);
  } catch (error) {
    console.error("Failed to generate PNG:", error);
    console.log(
      "Make sure mermaid-cli is installed: bun add -D @mermaid-js/mermaid-cli",
    );
  }
}

// Example usage:
if (import.meta.main) {
  console.log(generateStateTable());
  console.log("\nState Machine Analysis:");
  console.log(analyzeStateMachine());
  console.log("\nMermaid Diagram:");
  console.log(generateStateDiagram());
  console.log("\nPlantUML Diagram:");
  console.log(generatePlantUMLDiagram());
}
