import type { CellAddress } from "@gridcore/core";

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
  operation: "add" | "sub" | "mul" | "div";
  value: number;
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
  validateCommand(command: ParsedBulkCommand, hasSelection: boolean): string | null;
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
    // Math operations: :add 10, :sub 5, :mul 2, :div 3
    mathOp: /^:(add|sub|mul|div)\s+(-?\d+(?:\.\d+)?)$/,
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
    ":%s///g"
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
          global: flags.includes('g'),
          caseSensitive: !flags.includes('i'),
          useRegex: true, // vim substitute uses regex by default
          scope: scope === '%' ? 'sheet' : 'selection'
        },
        requiresPreview: true,
        requiresSelection: false
      };
    }

    // Bulk set
    const bulkSetMatch = command.match(this.patterns.bulkSet);
    if (bulkSetMatch) {
      return {
        type: "bulkSet",
        value: bulkSetMatch[1],
        requiresPreview: false,
        requiresSelection: true
      };
    }

    // Math operations
    const mathOpMatch = command.match(this.patterns.mathOp);
    if (mathOpMatch) {
      const operation = mathOpMatch[1] as "add" | "sub" | "mul" | "div";
      const value = parseFloat(mathOpMatch[2]);
      return {
        type: "mathOperation",
        operation,
        value,
        requiresPreview: false,
        requiresSelection: true
      };
    }

    // Fill operations
    const fillMatch = command.match(this.patterns.fill);
    if (fillMatch) {
      const direction = fillMatch[1] as "down" | "up" | "left" | "right" | "series";
      return {
        type: "fill",
        direction,
        requiresPreview: false,
        requiresSelection: true
      };
    }

    // Transform operations
    const transformMatch = command.match(this.patterns.transform);
    if (transformMatch) {
      const transformation = transformMatch[1] as "upper" | "lower" | "trim" | "clean";
      return {
        type: "transform",
        transformation,
        requiresPreview: false,
        requiresSelection: true
      };
    }

    // Format operations
    const formatMatch = command.match(this.patterns.format);
    if (formatMatch) {
      return {
        type: "format",
        formatType: formatMatch[1],
        requiresPreview: false,
        requiresSelection: true
      };
    }

    return null;
  }

  getCompletions(partial: string): string[] {
    if (!partial.startsWith(':')) {
      return [];
    }

    return this.completions.filter(completion => 
      completion.toLowerCase().startsWith(partial.toLowerCase())
    );
  }

  validateCommand(command: ParsedBulkCommand, hasSelection: boolean): string | null {
    // Check if command requires selection but none exists
    if (command.requiresSelection && !hasSelection) {
      return "This operation requires a selection";
    }

    // Validate specific command types
    switch (command.type) {
      case "findReplace":
        if (!command.findPattern) {
          return "Find pattern cannot be empty";
        }
        if (command.options.useRegex) {
          try {
            new RegExp(command.findPattern, command.options.caseSensitive ? 'g' : 'gi');
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
        if (isNaN(command.value)) {
          return "Math operation requires a valid number";
        }
        if (command.operation === "div" && command.value === 0) {
          return "Cannot divide by zero";
        }
        break;

      case "format":
        const validFormats = ["currency", "percent", "date", "number", "text"];
        if (!validFormats.includes(command.formatType)) {
          return `Invalid format type. Valid types: ${validFormats.join(", ")}`;
        }
        break;
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