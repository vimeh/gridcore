# State Machine Diagram

```mermaid
stateDiagram-v2
    [*] --> navigation
    navigation --> editing: START_EDITING
    state editing {
        [*] --> normal
        normal --> insert: ENTER_INSERT_MODE
        normal --> visual: ENTER_VISUAL_MODE
        normal --> visual: ENTER_VISUAL_BLOCK_MODE
        normal --> resize: ENTER_RESIZE_MODE
        insert --> normal: EXIT_INSERT_MODE
        insert --> normal: ESCAPE
        visual --> normal: EXIT_VISUAL_MODE
        visual --> normal: ESCAPE
        visual --> insert: ENTER_INSERT_MODE
        resize --> normal: EXIT_RESIZE_MODE
        resize --> normal: ESCAPE
    }
    editing --> navigation: STOP_EDITING
    editing --> navigation: ESCAPE
```

## How to view this diagram

1. Copy the mermaid code above
2. Visit [Mermaid Live Editor](https://mermaid.live)
3. Paste the code to see the diagram
4. Or use any markdown viewer that supports Mermaid diagrams
