# State Machine Documentation

This directory contains automatically generated documentation for the SpreadsheetStateMachine.

## Files

- **state-table.txt** - ASCII table showing all state transitions
- **state-diagram.md** - Mermaid diagram of the state machine
- **state-diagram.html** - Interactive HTML visualization
- **state-diagram.puml** - PlantUML diagram of the state machine
- **analysis.md** - Statistical analysis of the state machine

## Viewing the Diagrams

### Interactive Browser View
```bash
bun run view:state-diagram
```

### Export to SVG
```bash
bun run export:state-svg
```

### Export to PNG
```bash
bun run export:state-png
```

## Regenerating Documentation

Run the following command to regenerate these files:

```bash
bun run generate:state-docs
```

This documentation is automatically generated from the actual state machine implementation,
so it's always up to date with the code.
