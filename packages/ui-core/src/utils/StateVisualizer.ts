import type { UIStateMachine } from "../state/UIStateMachine";

export class StateVisualizer {
  /**
   * Generates a Mermaid diagram of the state machine transitions
   */
  static generateMermaidDiagram(_stateMachine: UIStateMachine): string {
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
   * Generates an HTML page with an interactive state diagram
   */
  static generateHTMLDocumentation(stateMachine: UIStateMachine): string {
    const mermaidDiagram = StateVisualizer.generateMermaidDiagram(stateMachine);

    return `<!DOCTYPE html>
<html>
<head>
    <title>UI State Machine Diagram</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        h1 {
            color: #333;
        }
        .diagram-container {
            background: #f5f5f5;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .mermaid {
            text-align: center;
        }
        .description {
            margin: 20px 0;
            padding: 20px;
            background: #e8f4f8;
            border-radius: 8px;
        }
        .state-list {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        .state-card {
            background: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .state-card h3 {
            margin-top: 0;
            color: #0066cc;
        }
        .transition {
            background: #f0f0f0;
            padding: 8px 12px;
            margin: 4px 0;
            border-radius: 4px;
            font-family: monospace;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <h1>UI State Machine Documentation</h1>
    
    <div class="description">
        <h2>Overview</h2>
        <p>This diagram shows the state transitions in the UI core state machine. The state machine manages the different modes of interaction in the spreadsheet UI.</p>
    </div>
    
    <div class="diagram-container">
        <div class="mermaid">
${mermaidDiagram}
        </div>
    </div>
    
    <h2>State Descriptions</h2>
    <div class="state-list">
        <div class="state-card">
            <h3>Navigation</h3>
            <p>The default mode for navigating between cells in the spreadsheet.</p>
            <h4>Available Transitions:</h4>
            <div class="transition">START_EDITING → editing</div>
            <div class="transition">ENTER_COMMAND_MODE → command</div>
            <div class="transition">ENTER_RESIZE_MODE → resize</div>
        </div>
        
        <div class="state-card">
            <h3>Editing</h3>
            <p>Mode for editing cell content with vim-like behavior.</p>
            <h4>Substates:</h4>
            <ul>
                <li><strong>normal</strong>: Vim normal mode within cell</li>
                <li><strong>insert</strong>: Text insertion mode</li>
                <li><strong>visual</strong>: Visual selection mode</li>
            </ul>
            <h4>Available Transitions:</h4>
            <div class="transition">EXIT_TO_NAVIGATION → navigation</div>
            <div class="transition">ESCAPE → navigation</div>
        </div>
        
        <div class="state-card">
            <h3>Command</h3>
            <p>Mode for entering vim-style commands (like :w, :q).</p>
            <h4>Available Transitions:</h4>
            <div class="transition">EXIT_COMMAND_MODE → navigation</div>
            <div class="transition">ESCAPE → navigation</div>
        </div>
        
        <div class="state-card">
            <h3>Resize</h3>
            <p>Mode for resizing columns and rows using keyboard shortcuts.</p>
            <h4>Available Transitions:</h4>
            <div class="transition">EXIT_RESIZE_MODE → navigation</div>
            <div class="transition">ESCAPE → navigation</div>
        </div>
    </div>
    
    <div class="description">
        <h2>Key Bindings</h2>
        <p>The state machine responds to various keyboard inputs based on the current state:</p>
        <ul>
            <li><strong>Navigation Mode</strong>: h/j/k/l (movement), i/a (edit), : (command), gr (resize)</li>
            <li><strong>Editing Mode</strong>: Standard vim bindings within cell</li>
            <li><strong>Resize Mode</strong>: +/- (resize), h/j/k/l (navigate), = (auto-fit)</li>
            <li><strong>Command Mode</strong>: Type commands, Enter (execute), Escape (cancel)</li>
        </ul>
    </div>
    
    <script>
        mermaid.initialize({ startOnLoad: true });
    </script>
</body>
</html>`;
  }

  /**
   * Generates a text-based state table for documentation
   */
  static generateStateTable(_stateMachine: UIStateMachine): string {
    const lines: string[] = [];

    lines.push("UI State Machine Transition Table");
    lines.push("=================================");
    lines.push("");
    lines.push("Current State          | Action                | Next State");
    lines.push(
      "-----------------------|-----------------------|------------------",
    );
    lines.push("navigation             | START_EDITING         | editing");
    lines.push("navigation             | ENTER_COMMAND_MODE    | command");
    lines.push("navigation             | ENTER_RESIZE_MODE     | resize");
    lines.push("editing                | EXIT_TO_NAVIGATION    | navigation");
    lines.push(
      "editing.normal         | ENTER_INSERT_MODE     | editing.insert",
    );
    lines.push(
      "editing.insert         | EXIT_INSERT_MODE      | editing.normal",
    );
    lines.push(
      "editing.normal         | ENTER_VISUAL_MODE     | editing.visual",
    );
    lines.push(
      "editing.visual         | EXIT_VISUAL_MODE      | editing.normal",
    );
    lines.push("command                | EXIT_COMMAND_MODE     | navigation");
    lines.push("resize                 | EXIT_RESIZE_MODE      | navigation");
    lines.push("editing/command/resize | ESCAPE                | navigation");
    lines.push("");
    lines.push("Universal Actions (available in all states):");
    lines.push("- UPDATE_CURSOR: Updates cursor position");
    lines.push("- UPDATE_VIEWPORT: Updates viewport scroll position");

    return lines.join("\n");
  }

  /**
   * Analyzes the current state history and generates insights
   */
  static analyzeStateHistory(stateMachine: UIStateMachine): string {
    const history = stateMachine.getHistory();
    const lines: string[] = [];

    lines.push("State History Analysis");
    lines.push("=====================");
    lines.push("");
    lines.push(`Total transitions: ${history.length}`);

    // Count transitions by action type
    const actionCounts: Record<string, number> = {};
    history.forEach(({ action }) => {
      actionCounts[action.type] = (actionCounts[action.type] || 0) + 1;
    });

    lines.push("");
    lines.push("Transition Frequency:");
    Object.entries(actionCounts)
      .sort(([, a], [, b]) => b - a)
      .forEach(([action, count]) => {
        lines.push(`  ${action}: ${count}`);
      });

    // Find most common state transitions
    const transitionPairs: Record<string, number> = {};
    for (let i = 1; i < history.length; i++) {
      const from = history[i - 1].state.spreadsheetMode;
      const to = history[i].state.spreadsheetMode;
      const key = `${from} → ${to}`;
      transitionPairs[key] = (transitionPairs[key] || 0) + 1;
    }

    lines.push("");
    lines.push("Common State Transitions:");
    Object.entries(transitionPairs)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .forEach(([transition, count]) => {
        lines.push(`  ${transition}: ${count}`);
      });

    return lines.join("\n");
  }
}
