// Bulk operation command types
export interface BulkCommand {
  type: string;
  requiresPreview: boolean;
  requiresSelection: boolean;
}

export interface FindReplaceCommand extends BulkCommand {
  type: "findReplace";
  findPattern: string;
  replaceWith: string;
  options: {
    global: boolean;
    caseSensitive: boolean;
    useRegex: boolean;
    scope: "selection" | "sheet"; // % prefix means entire sheet
  };
  requiresPreview: true;
  requiresSelection: false;
}

export interface BulkSetCommand extends BulkCommand {
  type: "bulkSet";
  value: string;
  requiresPreview: false;
  requiresSelection: true;
}

export interface MathOperationCommand extends BulkCommand {
  type: "mathOperation";
  operation:
    | "add"
    | "sub"
    | "mul"
    | "div"
    | "mod"
    | "percent"
    | "percentd"
    | "round"
    | "floor"
    | "ceil";
  value: number;
  decimalPlaces?: number; // For rounding operations
  requiresPreview: false;
  requiresSelection: true;
}

export interface FillCommand extends BulkCommand {
  type: "fill";
  direction: "down" | "up" | "left" | "right" | "series";
  requiresPreview: false;
  requiresSelection: true;
}

export interface TransformCommand extends BulkCommand {
  type: "transform";
  transformation: "upper" | "lower" | "trim" | "clean";
  requiresPreview: false;
  requiresSelection: true;
}

export interface FormatCommand extends BulkCommand {
  type: "format";
  formatType: string; // e.g., "currency", "percent", "date"
  requiresPreview: false;
  requiresSelection: true;
}

export type ParsedBulkCommand =
  | FindReplaceCommand
  | BulkSetCommand
  | MathOperationCommand
  | FillCommand
  | TransformCommand
  | FormatCommand;

export interface BulkCommandParser {
  parse(command: string): ParsedBulkCommand | null;
  getCompletions(partial: string): string[];
  validateCommand(
    command: ParsedBulkCommand,
    hasSelection: boolean,
  ): string | null;
}

/**
 * Parser for vim-style bulk operation commands
 * Supports:
 * - Find/Replace: :s/pattern/replacement/g, :%s/pattern/replacement/g
 * - Bulk set: :set value
 * - Math operations: :add 10, :sub 5, :mul 2, :div 3
 * - Fill operations: :fill down, :fill series
 * - Transform: :upper, :lower, :trim, :clean
 * - Format: :format currency, :format percent
 */
export class VimBulkCommandParser implements BulkCommandParser {
  private patterns = {
    // Find and replace: :s/pattern/replacement/flags or :%s/pattern/replacement/flags
    findReplace: /^:(%?)s\/(.*)\/(.*)\/([gi]*)$/,
    // Bulk set: :set value
    bulkSet: /^:set\s+(.+)$/,
    // Basic math operations: :add 10, :sub 5, :mul 2, :div 3, :mod 7
    mathOp: /^:(add|sub|mul|div|mod)\s+(-?\d+(?:\.\d+)?)$/,
    // Percentage operations: :percent 20, :percentd 15
    percentOp: /^:(percent|percentd)\s+(-?\d+(?:\.\d+)?)$/,
    // Rounding with decimal places: :round 2 (2 decimal places)
    roundOp: /^:round(?:\s+(\d+))?$/,
    // Floor and ceiling operations: :floor, :ceil
    floorCeilOp: /^:(floor|ceil)$/,
    // Fill operations: :fill down, :fill up, :fill left, :fill right, :fill series
    fill: /^:fill\s+(down|up|left|right|series)$/,
    // Transform: :upper, :lower, :trim, :clean
    transform: /^:(upper|lower|trim|clean)$/,
    // Format: :format type
    format: /^:format\s+(\w+)$/,
  };

  private completions = [
    ":set ",
    ":add ",
    ":sub ",
    ":mul ",
    ":div ",
    ":mod ",
    ":percent ",
    ":percentd ",
    ":round",
    ":round 2",
    ":floor",
    ":ceil",
    ":fill down",
    ":fill up",
    ":fill left",
    ":fill right",
    ":fill series",
    ":upper",
    ":lower",
    ":trim",
    ":clean",
    ":format currency",
    ":format percent",
    ":format date",
    ":format number",
    ":s///g",
    ":%s///g",
  ];

  parse(command: string): ParsedBulkCommand | null {
    // Find and replace
    const findReplaceMatch = command.match(this.patterns.findReplace);
    if (findReplaceMatch) {
      const [, scope, pattern, replacement, flags] = findReplaceMatch;
      return {
        type: "findReplace",
        findPattern: pattern,
        replaceWith: replacement,
        options: {
          global: flags.includes("g"),
          caseSensitive: !flags.includes("i"),
          useRegex: true, // vim substitute uses regex by default
          scope: scope === "%" ? "sheet" : "selection",
        },
        requiresPreview: true,
        requiresSelection: scope !== "%", // Only require selection for non-sheet-wide operations
      };
    }

    // Bulk set
    const bulkSetMatch = command.match(this.patterns.bulkSet);
    if (bulkSetMatch) {
      return {
        type: "bulkSet",
        value: bulkSetMatch[1],
        requiresPreview: false,
        requiresSelection: true,
      };
    }

    // Basic math operations
    const mathOpMatch = command.match(this.patterns.mathOp);
    if (mathOpMatch) {
      const operation = mathOpMatch[1] as "add" | "sub" | "mul" | "div" | "mod";
      const value = parseFloat(mathOpMatch[2]);
      return {
        type: "mathOperation",
        operation,
        value,
        requiresPreview: false,
        requiresSelection: true,
      };
    }

    // Percentage operations
    const percentOpMatch = command.match(this.patterns.percentOp);
    if (percentOpMatch) {
      const operation = percentOpMatch[1] as "percent" | "percentd";
      const value = parseFloat(percentOpMatch[2]);
      return {
        type: "mathOperation",
        operation,
        value,
        requiresPreview: false,
        requiresSelection: true,
      };
    }

    // Rounding operations
    const roundOpMatch = command.match(this.patterns.roundOp);
    if (roundOpMatch) {
      const decimalPlaces = roundOpMatch[1] ? parseInt(roundOpMatch[1]) : 0;
      return {
        type: "mathOperation",
        operation: "round",
        value: 0, // Not used for rounding
        decimalPlaces,
        requiresPreview: false,
        requiresSelection: true,
      };
    }

    // Floor and ceiling operations
    const floorCeilOpMatch = command.match(this.patterns.floorCeilOp);
    if (floorCeilOpMatch) {
      const operation = floorCeilOpMatch[1] as "floor" | "ceil";
      return {
        type: "mathOperation",
        operation,
        value: 0, // Not used for floor/ceil
        requiresPreview: false,
        requiresSelection: true,
      };
    }

    // Fill operations
    const fillMatch = command.match(this.patterns.fill);
    if (fillMatch) {
      const direction = fillMatch[1] as
        | "down"
        | "up"
        | "left"
        | "right"
        | "series";
      return {
        type: "fill",
        direction,
        requiresPreview: false,
        requiresSelection: true,
      };
    }

    // Transform operations
    const transformMatch = command.match(this.patterns.transform);
    if (transformMatch) {
      const transformation = transformMatch[1] as
        | "upper"
        | "lower"
        | "trim"
        | "clean";
      return {
        type: "transform",
        transformation,
        requiresPreview: false,
        requiresSelection: true,
      };
    }

    // Format operations
    const formatMatch = command.match(this.patterns.format);
    if (formatMatch) {
      return {
        type: "format",
        formatType: formatMatch[1],
        requiresPreview: false,
        requiresSelection: true,
      };
    }

    return null;
  }

  getCompletions(partial: string): string[] {
    if (!partial.startsWith(":")) {
      return [];
    }

    return this.completions.filter((completion) =>
      completion.toLowerCase().startsWith(partial.toLowerCase()),
    );
  }

  validateCommand(
    command: ParsedBulkCommand,
    hasSelection: boolean,
  ): string | null {
    // Validate specific command types first (before checking selection requirement)
    switch (command.type) {
      case "findReplace":
        if (!command.findPattern) {
          return "Find pattern cannot be empty";
        }
        if (command.options.useRegex) {
          try {
            new RegExp(
              command.findPattern,
              command.options.caseSensitive ? "g" : "gi",
            );
          } catch (error) {
            return `Invalid regex pattern: ${error}`;
          }
        }
        break;

      case "bulkSet":
        if (command.value === undefined || command.value === null) {
          return "Set value cannot be empty";
        }
        break;

      case "mathOperation":
        // Skip validation for operations that don't use the value parameter
        if (
          command.operation !== "round" &&
          command.operation !== "floor" &&
          command.operation !== "ceil"
        ) {
          if (Number.isNaN(command.value)) {
            return "Math operation requires a valid number";
          }
          if (
            (command.operation === "div" || command.operation === "mod") &&
            command.value === 0
          ) {
            return `Cannot ${command.operation === "div" ? "divide" : "mod"} by zero`;
          }
          if (command.operation === "percentd" && command.value >= 100) {
            return "Percentage decrease cannot be 100% or greater";
          }
        }

        // Validate decimal places for rounding
        if (
          command.operation === "round" &&
          command.decimalPlaces !== undefined
        ) {
          if (command.decimalPlaces < 0 || command.decimalPlaces > 10) {
            return "Decimal places must be between 0 and 10";
          }
        }
        break;

      case "format": {
        const validFormats = ["currency", "percent", "date", "number", "text"];
        if (!validFormats.includes(command.formatType)) {
          return `Invalid format type. Valid types: ${validFormats.join(", ")}`;
        }
        break;
      }
    }

    // Check if command requires selection but none exists (after validating command structure)
    if (command.requiresSelection && !hasSelection) {
      return "This operation requires a selection";
    }

    return null; // Command is valid
  }

  /**
   * Get help text for bulk commands
   */
  getHelpText(): string {
    return `
Bulk Operation Commands:

Find & Replace:
  :s/pattern/replacement/g    - Replace in selection
  :%s/pattern/replacement/g   - Replace in entire sheet
  Flags: g (global), i (case insensitive)

Set Values:
  :set value                  - Set all selected cells to value

Math Operations:
  :add 10                     - Add 10 to numeric cells
  :sub 5                      - Subtract 5 from numeric cells  
  :mul 2                      - Multiply numeric cells by 2
  :div 3                      - Divide numeric cells by 3
  :mod 7                      - Apply modulo 7 to numeric cells
  :percent 20                 - Increase numeric cells by 20%
  :percentd 15                - Decrease numeric cells by 15%
  :round                      - Round numeric cells to integers
  :round 2                    - Round numeric cells to 2 decimal places
  :floor                      - Apply floor to numeric cells
  :ceil                       - Apply ceiling to numeric cells

Fill Operations:
  :fill down                  - Fill down from top cell
  :fill up                    - Fill up from bottom cell
  :fill left                  - Fill left from right cell
  :fill right                 - Fill right from left cell
  :fill series                - Auto-detect and fill series

Text Transforms:
  :upper                      - Convert to uppercase
  :lower                      - Convert to lowercase
  :trim                       - Remove leading/trailing spaces
  :clean                      - Remove extra spaces and line breaks

Formatting:
  :format currency            - Apply currency format
  :format percent             - Apply percentage format
  :format date                - Apply date format
  :format number              - Apply number format

All operations except find/replace require a selection.
Use Tab for command completion.
`;
  }
}
