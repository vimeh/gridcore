#!/usr/bin/env bun
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CellAddress } from "@gridcore/core";
import { UIStateMachine } from "../src/state/UIStateMachine";
import {
  analyzeStateHistory,
  generateHTMLDocumentation,
  generateMermaidDiagram,
  generatePlantUMLDiagram,
  generateStateTable,
} from "../src/utils/StateVisualizer";

const outputDir = join(import.meta.dir, "../docs/state-machine");

// Ensure output directory exists
mkdirSync(outputDir, { recursive: true });

// Create a UIStateMachine instance for documentation
const cursor = CellAddress.create(0, 0).value;
const viewport = { startRow: 0, startCol: 0, rows: 20, cols: 10 };
const stateMachine = new UIStateMachine({
  spreadsheetMode: "navigation",
  cursor,
  viewport,
});

// Generate state table
const stateTable = generateStateTable(stateMachine);
writeFileSync(join(outputDir, "state-table.txt"), stateTable);
console.log("✓ Generated state-table.txt");

// Generate Mermaid diagram
const mermaidDiagram = generateMermaidDiagram(stateMachine);
const mermaidMd = `# UI State Machine Diagram

\`\`\`mermaid
${mermaidDiagram}
\`\`\`

## How to view this diagram

1. Copy the mermaid code above
2. Visit [Mermaid Live Editor](https://mermaid.live)
3. Paste the code to see the diagram
4. Or use any markdown viewer that supports Mermaid diagrams
`;
writeFileSync(join(outputDir, "state-diagram.md"), mermaidMd);
console.log("✓ Generated state-diagram.md");

// Generate PlantUML diagram
const plantUML = generatePlantUMLDiagram(stateMachine);
writeFileSync(join(outputDir, "state-diagram.puml"), plantUML);
console.log("✓ Generated state-diagram.puml");

// Generate HTML visualization
const html = generateHTMLDocumentation(stateMachine);
writeFileSync(join(outputDir, "state-diagram.html"), html);
console.log("✓ Generated state-diagram.html");

// Generate analysis report
const analysis = analyzeStateHistory(stateMachine);
const analysisReport = `# UI State Machine Analysis

Generated on: ${new Date().toISOString()}

## State Machine Configuration

The UI State Machine manages the application's interaction modes and states.

### Top-level States
- **navigation**: Default mode for navigating between cells
- **editing**: Active cell editing with vim-like modes
- **command**: Command input mode
- **resize**: Column/row resizing mode

### Editing Sub-states
- **normal**: Vim normal mode for cell operations
- **insert**: Text insertion mode
- **visual**: Visual selection mode

## Analysis

${analysis}

## State Transition Summary

${stateTable}
`;
writeFileSync(join(outputDir, "analysis.md"), analysisReport);
console.log("✓ Generated analysis.md");

// Generate README
const readme = `# UI State Machine Documentation

This directory contains automatically generated documentation for the UIStateMachine.

## Files

- **state-table.txt** - ASCII table showing all state transitions
- **state-diagram.md** - Mermaid diagram of the state machine
- **state-diagram.html** - Interactive HTML visualization
- **state-diagram.puml** - PlantUML diagram of the state machine
- **analysis.md** - Statistical analysis of the state machine

## Viewing the Diagrams

### Interactive Browser View
Open the HTML file directly:
\`\`\`bash
open docs/state-machine/state-diagram.html
\`\`\`

### Mermaid Diagram
The state-diagram.md file can be viewed in any markdown viewer that supports Mermaid diagrams.

### PlantUML Diagram
To render the PlantUML diagram:
1. Install PlantUML
2. Run: \`plantuml state-diagram.puml\`

## Regenerating Documentation

Run the following command to regenerate these files:

\`\`\`bash
bun run generate:state-docs
\`\`\`

This documentation is automatically generated from the actual UIStateMachine implementation,
so it's always up to date with the code.
`;
writeFileSync(join(outputDir, "README.md"), readme);
console.log("✓ Generated README.md");

console.log(`\n✅ UI State Machine documentation generated in ${outputDir}`);
