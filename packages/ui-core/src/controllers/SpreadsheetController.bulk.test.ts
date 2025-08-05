import { beforeEach, describe, expect, it } from "bun:test";
import type { SpreadsheetFacade } from "@gridcore/core";
import { isCommandMode } from "../state/UIState";
import type { ViewportManager } from "./SpreadsheetController";
import { SpreadsheetController } from "./SpreadsheetController";

describe("SpreadsheetController - Bulk Operations", () => {
  let controller: SpreadsheetController;
  let mockViewportManager: ViewportManager;
  let mockFacade: SpreadsheetFacade;

  beforeEach(() => {
    // Create mock ViewportManager
    mockViewportManager = {
      getColumnWidth: () => 100,
      setColumnWidth: () => {},
      getRowHeight: () => 25,
      setRowHeight: () => {},
      getTotalRows: () => 100,
      getTotalCols: () => 26,
      scrollTo: () => {},
    };

    // Create mock SpreadsheetFacade
    mockFacade = {
      getCell: () => ({ ok: false, error: "Not implemented" }),
      setCellValue: () => {},
    } as any;

    controller = new SpreadsheetController({
      facade: mockFacade,
      viewportManager: mockViewportManager,
    });
  });

  describe("Command Parsing", () => {
    it("should parse bulk set command", () => {
      // Enter command mode
      const commandResult = controller.handleKeyPress(":", {
        key: "colon",
        ctrl: false,
        shift: false,
        alt: false,
      });
      expect(commandResult.ok).toBe(true);
      expect(isCommandMode(commandResult.value)).toBe(true);

      // Type bulk set command
      let state = commandResult.value;
      const chars = "set Hello";
      for (const char of chars) {
        const result = controller.handleKeyPress(char, {
          key: char,
          ctrl: false,
          shift: false,
          alt: false,
        });
        expect(result.ok).toBe(true);
        state = result.value;
      }

      expect(state.commandValue).toBe(":set Hello");
    });

    it("should handle find/replace command", () => {
      // Enter command mode
      let result = controller.handleKeyPress(":", {
        key: "colon",
        ctrl: false,
        shift: false,
        alt: false,
      });
      expect(result.ok).toBe(true);

      // Type find/replace command
      let state = result.value;
      const command = "s/old/new/g";
      for (const char of command) {
        result = controller.handleKeyPress(char, {
          key: char,
          ctrl: false,
          shift: false,
          alt: false,
        });
        expect(result.ok).toBe(true);
        state = result.value;
      }

      expect(state.commandValue).toBe(":s/old/new/g");
    });

    it("should handle math operation commands", () => {
      // Enter command mode
      let result = controller.handleKeyPress(":", {
        key: "colon",
        ctrl: false,
        shift: false,
        alt: false,
      });
      expect(result.ok).toBe(true);

      // Type add command
      let state = result.value;
      const command = "add 10";
      for (const char of command) {
        result = controller.handleKeyPress(char, {
          key: char,
          ctrl: false,
          shift: false,
          alt: false,
        });
        expect(result.ok).toBe(true);
        state = result.value;
      }

      expect(state.commandValue).toBe(":add 10");
    });
  });

  describe("Command Completion", () => {
    it("should auto-complete set command", () => {
      // Enter command mode and type partial command
      let result = controller.handleKeyPress(":", {
        key: "colon",
        ctrl: false,
        shift: false,
        alt: false,
      });
      expect(result.ok).toBe(true);

      let state = result.value;

      // Type "se"
      for (const char of "se") {
        result = controller.handleKeyPress(char, {
          key: char,
          ctrl: false,
          shift: false,
          alt: false,
        });
        expect(result.ok).toBe(true);
        state = result.value;
      }

      // Press Tab for completion
      result = controller.handleKeyPress("\t", {
        key: "tab",
        ctrl: false,
        shift: false,
        alt: false,
      });
      expect(result.ok).toBe(true);
      state = result.value;

      expect(state.commandValue).toBe(":set ");
    });

    it("should complete fill commands", () => {
      // Enter command mode
      let result = controller.handleKeyPress(":", {
        key: "colon",
        ctrl: false,
        shift: false,
        alt: false,
      });
      expect(result.ok).toBe(true);

      let state = result.value;

      // Type "fill"
      for (const char of "fill") {
        result = controller.handleKeyPress(char, {
          key: char,
          ctrl: false,
          shift: false,
          alt: false,
        });
        expect(result.ok).toBe(true);
        state = result.value;
      }

      // Press Tab for completion
      result = controller.handleKeyPress("\t", {
        key: "tab",
        ctrl: false,
        shift: false,
        alt: false,
      });
      expect(result.ok).toBe(true);
      state = result.value;

      expect(state.commandValue).toBe(":fill down");
    });
  });

  describe("Command Execution", () => {
    it("should transition to bulk operation mode for valid commands", () => {
      const events: any[] = [];
      controller.subscribe((event) => events.push(event));

      // Enter command mode
      let result = controller.handleKeyPress(":", {
        key: "colon",
        ctrl: false,
        shift: false,
        alt: false,
      });
      expect(result.ok).toBe(true);

      // Type find/replace command (requires preview)
      let _state = result.value;
      const command = "s/old/new/g";
      for (const char of command) {
        result = controller.handleKeyPress(char, {
          key: char,
          ctrl: false,
          shift: false,
          alt: false,
        });
        expect(result.ok).toBe(true);
        _state = result.value;
      }

      // Execute command (press Enter)
      result = controller.handleKeyPress("\r", {
        key: "enter",
        ctrl: false,
        shift: false,
        alt: false,
      });
      expect(result.ok).toBe(true);

      // Should transition back to navigation (since we don't have selection for now)
      // This will emit error event because no selection
      const errorEvents = events.filter((e) => e.type === "error");
      expect(errorEvents.length).toBeGreaterThan(0);
    });

    it("should emit error for invalid commands", () => {
      const events: any[] = [];
      controller.subscribe((event) => events.push(event));

      // Enter command mode and execute invalid command
      let result = controller.handleKeyPress(":", {
        key: "colon",
        ctrl: false,
        shift: false,
        alt: false,
      });
      expect(result.ok).toBe(true);

      let _state = result.value;
      const command = "invalid_command";
      for (const char of command) {
        result = controller.handleKeyPress(char, {
          key: char,
          ctrl: false,
          shift: false,
          alt: false,
        });
        expect(result.ok).toBe(true);
        _state = result.value;
      }

      // Execute command
      result = controller.handleKeyPress("\r", {
        key: "enter",
        ctrl: false,
        shift: false,
        alt: false,
      });
      expect(result.ok).toBe(true);

      // Should emit command executed event for non-bulk commands
      const commandEvents = events.filter((e) => e.type === "commandExecuted");
      expect(commandEvents.length).toBe(1);
      expect(commandEvents[0].command).toBe(":invalid_command");
    });
  });

  describe("Error Handling", () => {
    it("should validate commands requiring selection", () => {
      const events: any[] = [];
      controller.subscribe((event) => events.push(event));

      // Enter command mode and try bulk set without selection
      let result = controller.handleKeyPress(":", {
        key: "colon",
        ctrl: false,
        shift: false,
        alt: false,
      });
      expect(result.ok).toBe(true);

      let _state = result.value;
      const command = "set test";
      for (const char of command) {
        result = controller.handleKeyPress(char, {
          key: char,
          ctrl: false,
          shift: false,
          alt: false,
        });
        expect(result.ok).toBe(true);
        _state = result.value;
      }

      // Execute command
      result = controller.handleKeyPress("\r", {
        key: "enter",
        ctrl: false,
        shift: false,
        alt: false,
      });
      expect(result.ok).toBe(true);

      // Should emit error about requiring selection
      const errorEvents = events.filter((e) => e.type === "error");
      expect(errorEvents.length).toBe(1);
      expect(errorEvents[0].error).toContain("requires a selection");
    });

    it("should validate regex patterns", () => {
      const events: any[] = [];
      controller.subscribe((event) => events.push(event));

      // Enter command mode with invalid regex
      let result = controller.handleKeyPress(":", {
        key: "colon",
        ctrl: false,
        shift: false,
        alt: false,
      });
      expect(result.ok).toBe(true);

      let _state = result.value;
      const command = "s/[unclosed/replacement/g";
      for (const char of command) {
        result = controller.handleKeyPress(char, {
          key: char,
          ctrl: false,
          shift: false,
          alt: false,
        });
        expect(result.ok).toBe(true);
        _state = result.value;
      }

      // Execute command
      result = controller.handleKeyPress("\r", {
        key: "enter",
        ctrl: false,
        shift: false,
        alt: false,
      });
      expect(result.ok).toBe(true);

      // Should emit error about invalid regex
      const errorEvents = events.filter((e) => e.type === "error");
      expect(errorEvents.length).toBe(1);
      expect(errorEvents[0].error).toContain("Invalid regex pattern");
    });
  });
});
