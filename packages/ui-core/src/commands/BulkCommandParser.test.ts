import { beforeEach, describe, expect, it } from "bun:test";
import type {
  BulkSetCommand,
  FillCommand,
  FindReplaceCommand,
  FormatCommand,
  MathOperationCommand,
  TransformCommand,
} from "./BulkCommandParser";
import { VimBulkCommandParser } from "./BulkCommandParser";

describe("VimBulkCommandParser", () => {
  let parser: VimBulkCommandParser;

  beforeEach(() => {
    parser = new VimBulkCommandParser();
  });

  describe("Find and Replace Commands", () => {
    it("should parse basic find/replace command", () => {
      const command = parser.parse(":s/old/new/g");
      expect(command).not.toBeNull();
      expect(command?.type).toBe("findReplace");

      const findReplace = command as FindReplaceCommand;
      expect(findReplace.findPattern).toBe("old");
      expect(findReplace.replaceWith).toBe("new");
      expect(findReplace.options.global).toBe(true);
      expect(findReplace.options.caseSensitive).toBe(true);
      expect(findReplace.options.scope).toBe("selection");
    });

    it("should parse sheet-wide find/replace command", () => {
      const command = parser.parse(":%s/old/new/gi");
      expect(command).not.toBeNull();

      const findReplace = command as FindReplaceCommand;
      expect(findReplace.options.scope).toBe("sheet");
      expect(findReplace.options.global).toBe(true);
      expect(findReplace.options.caseSensitive).toBe(false);
    });

    it("should parse find/replace without flags", () => {
      const command = parser.parse(":s/test/result/");
      expect(command).not.toBeNull();

      const findReplace = command as FindReplaceCommand;
      expect(findReplace.options.global).toBe(false);
      expect(findReplace.options.caseSensitive).toBe(true);
    });

    it("should handle complex patterns", () => {
      const command = parser.parse(":s/\\d+\\.\\d+/NUMBER/g");
      expect(command).not.toBeNull();

      const findReplace = command as FindReplaceCommand;
      expect(findReplace.findPattern).toBe("\\d+\\.\\d+");
      expect(findReplace.replaceWith).toBe("NUMBER");
    });
  });

  describe("Bulk Set Commands", () => {
    it("should parse bulk set command", () => {
      const command = parser.parse(":set Hello World");
      expect(command).not.toBeNull();
      expect(command?.type).toBe("bulkSet");

      const bulkSet = command as BulkSetCommand;
      expect(bulkSet.value).toBe("Hello World");
      expect(bulkSet.requiresSelection).toBe(true);
    });

    it("should parse numeric set command", () => {
      const command = parser.parse(":set 42");
      expect(command).not.toBeNull();

      const bulkSet = command as BulkSetCommand;
      expect(bulkSet.value).toBe("42");
    });

    it("should parse formula set command", () => {
      const command = parser.parse(":set =A1+B1");
      expect(command).not.toBeNull();

      const bulkSet = command as BulkSetCommand;
      expect(bulkSet.value).toBe("=A1+B1");
    });
  });

  describe("Math Operation Commands", () => {
    it("should parse add command", () => {
      const command = parser.parse(":add 10");
      expect(command).not.toBeNull();
      expect(command?.type).toBe("mathOperation");

      const mathOp = command as MathOperationCommand;
      expect(mathOp.operation).toBe("add");
      expect(mathOp.value).toBe(10);
    });

    it("should parse subtract command with decimal", () => {
      const command = parser.parse(":sub 3.14");
      expect(command).not.toBeNull();

      const mathOp = command as MathOperationCommand;
      expect(mathOp.operation).toBe("sub");
      expect(mathOp.value).toBe(3.14);
    });

    it("should parse multiply command", () => {
      const command = parser.parse(":mul 2");
      expect(command).not.toBeNull();

      const mathOp = command as MathOperationCommand;
      expect(mathOp.operation).toBe("mul");
      expect(mathOp.value).toBe(2);
    });

    it("should parse divide command", () => {
      const command = parser.parse(":div 4");
      expect(command).not.toBeNull();

      const mathOp = command as MathOperationCommand;
      expect(mathOp.operation).toBe("div");
      expect(mathOp.value).toBe(4);
    });

    it("should parse negative numbers", () => {
      const command = parser.parse(":add -5");
      expect(command).not.toBeNull();

      const mathOp = command as MathOperationCommand;
      expect(mathOp.value).toBe(-5);
    });
  });

  describe("Fill Commands", () => {
    it("should parse fill down command", () => {
      const command = parser.parse(":fill down");
      expect(command).not.toBeNull();
      expect(command?.type).toBe("fill");

      const fill = command as FillCommand;
      expect(fill.direction).toBe("down");
    });

    it("should parse all fill directions", () => {
      const directions = ["down", "up", "left", "right", "series"];

      for (const direction of directions) {
        const command = parser.parse(`:fill ${direction}`);
        expect(command).not.toBeNull();

        const fill = command as FillCommand;
        expect(fill.direction).toBe(direction);
      }
    });
  });

  describe("Transform Commands", () => {
    it("should parse transform commands", () => {
      const transforms = ["upper", "lower", "trim", "clean"];

      for (const transform of transforms) {
        const command = parser.parse(`:${transform}`);
        expect(command).not.toBeNull();
        expect(command?.type).toBe("transform");

        const transformCmd = command as TransformCommand;
        expect(transformCmd.transformation).toBe(transform);
      }
    });
  });

  describe("Format Commands", () => {
    it("should parse format commands", () => {
      const formats = ["currency", "percent", "date", "number"];

      for (const format of formats) {
        const command = parser.parse(`:format ${format}`);
        expect(command).not.toBeNull();
        expect(command?.type).toBe("format");

        const formatCmd = command as FormatCommand;
        expect(formatCmd.formatType).toBe(format);
      }
    });
  });

  describe("Command Completions", () => {
    it("should return completions for partial commands", () => {
      const completions = parser.getCompletions(":s");
      expect(completions).toContain(":set ");
      expect(completions).toContain(":sub ");
    });

    it("should return completions for :fill", () => {
      const completions = parser.getCompletions(":fill");
      expect(completions).toContain(":fill down");
      expect(completions).toContain(":fill series");
    });

    it("should return empty array for non-command input", () => {
      const completions = parser.getCompletions("hello");
      expect(completions).toEqual([]);
    });

    it("should be case-insensitive", () => {
      const completions = parser.getCompletions(":SET");
      expect(completions).toContain(":set ");
    });
  });

  describe("Command Validation", () => {
    it("should validate commands requiring selection", () => {
      const command = parser.parse(":set test");
      expect(command).not.toBeNull();

      const error = parser.validateCommand(command!, false);
      expect(error).toBe("This operation requires a selection");

      const noError = parser.validateCommand(command!, true);
      expect(noError).toBeNull();
    });

    it("should validate find/replace patterns", () => {
      const command = parser.parse(":s//replacement/g") as FindReplaceCommand;
      expect(command).not.toBeNull();

      const error = parser.validateCommand(command, false);
      expect(error).toBe("Find pattern cannot be empty");
    });

    it("should validate regex patterns", () => {
      const command = parser.parse(
        ":s/[unclosed/replacement/g",
      ) as FindReplaceCommand;
      expect(command).not.toBeNull();

      const error = parser.validateCommand(command, false);
      expect(error).toContain("Invalid regex pattern");
    });

    it("should validate division by zero", () => {
      const command = parser.parse(":div 0") as MathOperationCommand;
      expect(command).not.toBeNull();

      const error = parser.validateCommand(command, true);
      expect(error).toBe("Cannot divide by zero");
    });

    it("should validate format types", () => {
      const command = parser.parse(":format invalid") as FormatCommand;
      expect(command).not.toBeNull();

      const error = parser.validateCommand(command, true);
      expect(error).toContain("Invalid format type");
    });
  });

  describe("Invalid Commands", () => {
    it("should return null for invalid commands", () => {
      const invalidCommands = [
        ":invalid",
        ":set", // missing value
        ":add", // missing number
        ":add text", // non-numeric value
        ":fill invalid", // invalid direction
      ];

      for (const cmd of invalidCommands) {
        const command = parser.parse(cmd);
        expect(command).toBeNull();
      }
    });

    it("should return null for non-colon commands", () => {
      const command = parser.parse("not a command");
      expect(command).toBeNull();
    });
  });

  describe("Help Text", () => {
    it("should provide help text", () => {
      const help = parser.getHelpText();
      expect(help).toContain("Find & Replace");
      expect(help).toContain("Math Operations");
      expect(help).toContain(":s/pattern/replacement/g");
    });
  });
});
