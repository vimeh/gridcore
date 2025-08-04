# UI State Machine Documentation

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
```bash
open docs/state-machine/state-diagram.html
```

### Mermaid Diagram
The state-diagram.md file can be viewed in any markdown viewer that supports Mermaid diagrams.

### PlantUML Diagram
To render the PlantUML diagram:
1. Install PlantUML
2. Run: `plantuml state-diagram.puml`

## Regenerating Documentation

Run the following command to regenerate these files:

```bash
bun run generate:state-docs
```

This documentation is automatically generated from the actual UIStateMachine implementation,
so it's always up to date with the code.
