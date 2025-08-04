import { beforeEach, describe, expect, test } from "bun:test";
import { CellAddress } from "@gridcore/core";
import { UIStateMachine } from "../state/UIStateMachine";
import { StateVisualizer } from "./StateVisualizer";

describe("StateVisualizer", () => {
  let stateMachine: UIStateMachine;

  beforeEach(() => {
    const cursor = CellAddress.create(0, 0).value;
    const viewport = { startRow: 0, startCol: 0, rows: 20, cols: 10 };
    stateMachine = new UIStateMachine({
      spreadsheetMode: "navigation",
      cursor,
      viewport,
    });
  });

  describe("generateMermaidDiagram", () => {
    test("generates valid mermaid diagram", () => {
      const diagram = StateVisualizer.generateMermaidDiagram(stateMachine);

      expect(diagram).toContain("stateDiagram-v2");
      expect(diagram).toContain("navigation");
      expect(diagram).toContain("editing");
      expect(diagram).toContain("command");
      expect(diagram).toContain("resize");
    });

    test("includes state transitions", () => {
      const diagram = StateVisualizer.generateMermaidDiagram(stateMachine);

      expect(diagram).toContain("navigation --> editing");
      expect(diagram).toContain("editing --> navigation");
      expect(diagram).toContain("navigation --> command");
      expect(diagram).toContain("navigation --> resize");
    });

    test("includes nested editing states", () => {
      const diagram = StateVisualizer.generateMermaidDiagram(stateMachine);

      expect(diagram).toContain("state editing");
      expect(diagram).toContain("normal");
      expect(diagram).toContain("insert");
      expect(diagram).toContain("visual");
    });

    test("includes editing mode transitions", () => {
      const diagram = StateVisualizer.generateMermaidDiagram(stateMachine);

      expect(diagram).toContain("normal --> insert");
      expect(diagram).toContain("insert --> normal");
      expect(diagram).toContain("normal --> visual");
      expect(diagram).toContain("visual --> normal");
    });
  });

  describe("generateStateTable", () => {
    test("generates text table with transitions", () => {
      const table = StateVisualizer.generateStateTable(stateMachine);

      expect(table).toContain("UI State Machine Transition Table");
      expect(table).toContain("Current State");
      expect(table).toContain("Action");
      expect(table).toContain("Next State");
    });

    test("includes all major state transitions", () => {
      const table = StateVisualizer.generateStateTable(stateMachine);

      expect(table).toContain("navigation");
      expect(table).toContain("editing");
      expect(table).toContain("command");
      expect(table).toContain("resize");
    });

    test("includes specific transitions", () => {
      const table = StateVisualizer.generateStateTable(stateMachine);

      expect(table).toContain("START_EDITING");
      expect(table).toContain("EXIT_TO_NAVIGATION");
      expect(table).toContain("ENTER_COMMAND_MODE");
      expect(table).toContain("ENTER_RESIZE_MODE");
    });
  });

  describe("analyzeStateHistory", () => {
    test("shows message when no history", () => {
      const analysis = StateVisualizer.analyzeStateHistory(stateMachine);

      expect(analysis).toContain("State History Analysis");
      expect(analysis).toContain("Total transitions: 0");
    });

    test("analyzes transitions after state changes", () => {
      stateMachine.transition({ type: "START_EDITING" });
      stateMachine.transition({ type: "EXIT_TO_NAVIGATION" });

      const analysis = StateVisualizer.analyzeStateHistory(stateMachine);

      expect(analysis).toContain("Total transitions: 2");
      expect(analysis).toContain("START_EDITING");
      expect(analysis).toContain("EXIT_TO_NAVIGATION");
    });

    test("shows most common transitions", () => {
      // Perform repeated transitions
      for (let i = 0; i < 3; i++) {
        stateMachine.transition({ type: "START_EDITING" });
        stateMachine.transition({ type: "EXIT_TO_NAVIGATION" });
      }

      const analysis = StateVisualizer.analyzeStateHistory(stateMachine);
      expect(analysis).toContain("Common State Transitions");
    });
  });

  describe("generateHTMLDocumentation", () => {
    test("generates complete HTML document", () => {
      const html = StateVisualizer.generateHTMLDocumentation(stateMachine);

      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("<html>");
      expect(html).toContain("</html>");
      expect(html).toContain("<title>UI State Machine Diagram</title>");
    });

    test("includes all sections", () => {
      const html = StateVisualizer.generateHTMLDocumentation(stateMachine);

      expect(html).toContain("State Descriptions");
      expect(html).toContain("Navigation");
      expect(html).toContain("Editing");
      expect(html).toContain("mermaid.initialize");
    });

    test("includes styling", () => {
      const html = StateVisualizer.generateHTMLDocumentation(stateMachine);

      expect(html).toContain("<style>");
      expect(html).toContain("font-family");
      expect(html).toContain("border-radius");
    });

    test("includes mermaid script", () => {
      const html = StateVisualizer.generateHTMLDocumentation(stateMachine);

      expect(html).toContain("https://cdn.jsdelivr.net/npm/mermaid");
      expect(html).toContain("mermaid.initialize");
    });
  });

  describe("edge cases", () => {
    test("handles complex state paths", () => {
      // Create a complex state
      stateMachine.transition({ type: "START_EDITING" });
      stateMachine.transition({ type: "ENTER_INSERT_MODE", mode: "i" });

      const analysis = StateVisualizer.analyzeStateHistory(stateMachine);
      expect(analysis).toContain("navigation → editing");
    });

    test("generates valid diagram", () => {
      // This shouldn't happen in practice, but test robustness
      const diagram = StateVisualizer.generateMermaidDiagram(stateMachine);
      expect(diagram.length).toBeGreaterThan(0);
      expect(diagram).toContain("stateDiagram-v2");
    });
  });
});
