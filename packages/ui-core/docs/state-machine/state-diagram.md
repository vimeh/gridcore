# UI State Machine Diagram

```mermaid
stateDiagram-v2
    [*] --> navigation
    navigation --> editing: START_EDITING
    navigation --> command: ENTER_COMMAND_MODE
    navigation --> resize: ENTER_RESIZE_MODE
    state editing {
        [*] --> normal
        normal --> insert: ENTER_INSERT_MODE
        normal --> visual: ENTER_VISUAL_MODE
        insert --> normal: EXIT_INSERT_MODE
        visual --> normal: EXIT_VISUAL_MODE
    }
    editing --> navigation: EXIT_TO_NAVIGATION
    editing --> navigation: ESCAPE
    command --> navigation: EXIT_COMMAND_MODE
    command --> navigation: ESCAPE
    resize --> navigation: EXIT_RESIZE_MODE
    resize --> navigation: ESCAPE
```

## How to view this diagram

1. Copy the mermaid code above
2. Visit [Mermaid Live Editor](https://mermaid.live)
3. Paste the code to see the diagram
4. Or use any markdown viewer that supports Mermaid diagrams
