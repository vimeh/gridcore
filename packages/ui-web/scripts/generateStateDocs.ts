#!/usr/bin/env bun
import { generateStateDiagram, generateStateTable, analyzeStateMachine, generatePlantUMLDiagram, generateHTMLPage } from "./stateMachineVisualizer"
import { writeFileSync, mkdirSync } from "fs"
import { join, dirname } from "path"

const outputDir = join(import.meta.dir, "../docs/state-machine")

// Ensure output directory exists
mkdirSync(outputDir, { recursive: true })

// Generate state table
const stateTable = generateStateTable()
writeFileSync(join(outputDir, "state-table.txt"), stateTable)
console.log("✓ Generated state-table.txt")

// Generate Mermaid diagram
const mermaidDiagram = generateStateDiagram()
const mermaidMd = `# State Machine Diagram

\`\`\`mermaid
${mermaidDiagram}
\`\`\`

## How to view this diagram

1. Copy the mermaid code above
2. Visit [Mermaid Live Editor](https://mermaid.live)
3. Paste the code to see the diagram
4. Or use any markdown viewer that supports Mermaid diagrams
`
writeFileSync(join(outputDir, "state-diagram.md"), mermaidMd)
console.log("✓ Generated state-diagram.md")

// Generate PlantUML diagram
const plantUML = generatePlantUMLDiagram()
writeFileSync(join(outputDir, "state-diagram.puml"), plantUML)
console.log("✓ Generated state-diagram.puml")

// Generate analysis report
const analysis = analyzeStateMachine()
const analysisReport = `# State Machine Analysis

Generated on: ${new Date().toISOString()}

## Summary
- Total Transitions: ${analysis.totalTransitions}
- Unique States: ${analysis.uniqueStates}
- Unique Actions: ${analysis.uniqueActions}
- Average Transitions per State: ${analysis.averageTransitionsPerState}

## States
${analysis.statesList.map(s => `- ${s}`).join("\n")}

## Actions
${analysis.actionsList.map(a => `- ${a}`).join("\n")}

## Transitions by State
${Object.entries(analysis.transitionsByState)
  .map(([state, count]) => `- ${state}: ${count} transitions`)
  .join("\n")}
`
writeFileSync(join(outputDir, "analysis.md"), analysisReport)
console.log("✓ Generated analysis.md")

// Generate HTML visualization
generateHTMLPage(join(outputDir, "state-diagram.html"))
console.log("✓ Generated state-diagram.html")

// Generate README
const readme = `# State Machine Documentation

This directory contains automatically generated documentation for the SpreadsheetStateMachine.

## Files

- **state-table.txt** - ASCII table showing all state transitions
- **state-diagram.md** - Mermaid diagram of the state machine
- **state-diagram.html** - Interactive HTML visualization
- **state-diagram.puml** - PlantUML diagram of the state machine
- **analysis.md** - Statistical analysis of the state machine

## Viewing the Diagrams

### Interactive Browser View
\`\`\`bash
bun run view:state-diagram
\`\`\`

### Export to SVG
\`\`\`bash
bun run export:state-svg
\`\`\`

### Export to PNG
\`\`\`bash
bun run export:state-png
\`\`\`

## Regenerating Documentation

Run the following command to regenerate these files:

\`\`\`bash
bun run generate:state-docs
\`\`\`

This documentation is automatically generated from the actual state machine implementation,
so it's always up to date with the code.
`
writeFileSync(join(outputDir, "README.md"), readme)
console.log("✓ Generated README.md")

console.log(`\n✅ State machine documentation generated in ${outputDir}`)