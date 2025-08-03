import { parseCellAddress, parseCellRange } from "../utils/cellAddress";
import type {
  ASTNode,
  BinaryOperator,
  ParseResult,
  UnaryOperator,
} from "./ast";
import { type Token, Tokenizer, type TokenType } from "./tokenizer";

export class FormulaParser {
  private tokens: Token[];
  private current: number;

  constructor() {
    this.tokens = [];
    this.current = 0;
  }

  parse(formula: string): ParseResult {
    try {
      // Remove leading '=' if present
      const cleanFormula = formula.startsWith("=") ? formula.slice(1) : formula;

      const tokenizer = new Tokenizer(cleanFormula);
      this.tokens = tokenizer.tokenize();
      this.current = 0;

      const ast = this.parseExpression();

      if (!this.isAtEnd()) {
        throw this.error("Unexpected token after expression");
      }

      return { ast };
    } catch (error) {
      if (error instanceof Error) {
        return {
          error: {
            message: error.message,
            position:
              this.current < this.tokens.length
                ? this.tokens[this.current].position
                : 0,
            line: 1,
            column:
              this.current < this.tokens.length
                ? this.tokens[this.current].position + 1
                : 1,
          },
        };
      }
      return {
        error: { message: "Unknown error", position: 0, line: 1, column: 1 },
      };
    }
  }

  private parseExpression(): ASTNode {
    return this.parseComparison();
  }

  private parseComparison(): ASTNode {
    let left = this.parseConcatenation();

    while (
      this.check("OPERATOR") &&
      this.isComparisonOperator(this.peek().value)
    ) {
      this.advance();
      const operator = this.previous().value as BinaryOperator;
      const right = this.parseConcatenation();
      left = {
        type: "binary",
        operator,
        left,
        right,
      };
    }

    return left;
  }

  private parseConcatenation(): ASTNode {
    let left = this.parseAddition();

    while (this.check("OPERATOR") && this.peek().value === "&") {
      this.advance();
      const operator = "&" as BinaryOperator;
      const right = this.parseAddition();
      left = {
        type: "binary",
        operator,
        left,
        right,
      };
    }

    return left;
  }

  private parseAddition(): ASTNode {
    let left = this.parseMultiplication();

    while (
      this.check("OPERATOR") &&
      (this.peek().value === "+" || this.peek().value === "-")
    ) {
      this.advance();
      const operator = this.previous().value as BinaryOperator;
      const right = this.parseMultiplication();
      left = {
        type: "binary",
        operator,
        left,
        right,
      };
    }

    return left;
  }

  private parseMultiplication(): ASTNode {
    let left = this.parseExponentiation();

    while (
      this.check("OPERATOR") &&
      (this.peek().value === "*" || this.peek().value === "/")
    ) {
      this.advance();
      const operator = this.previous().value as BinaryOperator;
      const right = this.parseExponentiation();
      left = {
        type: "binary",
        operator,
        left,
        right,
      };
    }

    return left;
  }

  private parseExponentiation(): ASTNode {
    let left = this.parseUnary();

    while (this.check("OPERATOR") && this.peek().value === "^") {
      this.advance();
      const operator = "^" as BinaryOperator;
      const right = this.parseUnary();
      left = {
        type: "binary",
        operator,
        left,
        right,
      };
    }

    return left;
  }

  private parseUnary(): ASTNode {
    if (
      this.check("OPERATOR") &&
      (this.peek().value === "-" || this.peek().value === "+")
    ) {
      this.advance();
      const operator = this.previous().value as UnaryOperator;

      // Check for double operators like "+ +"
      if (
        this.check("OPERATOR") &&
        (this.peek().value === "-" || this.peek().value === "+")
      ) {
        // Allow unary operators to stack (like --5)
        const operand = this.parseUnary();
        return {
          type: "unary",
          operator,
          operand,
        };
      }

      const operand = this.parseUnary();
      return {
        type: "unary",
        operator,
        operand,
      };
    }

    return this.parsePrimary();
  }

  private parsePrimary(): ASTNode {
    if (this.match("NUMBER")) {
      return {
        type: "number",
        value: parseFloat(this.previous().value),
      };
    }

    if (this.match("STRING")) {
      const value = this.previous().value;
      // Remove quotes
      return {
        type: "string",
        value: value.slice(1, -1).replace(/\\(.)/g, "$1"),
      };
    }

    if (this.match("TRUE")) {
      return {
        type: "boolean",
        value: true,
      };
    }

    if (this.match("FALSE")) {
      return {
        type: "boolean",
        value: false,
      };
    }

    if (this.match("CELL")) {
      const reference = this.previous().value;
      const address = parseCellAddress(reference.replace(/\$/g, ""));
      if (!address) {
        throw this.error(`Invalid cell reference: ${reference}`);
      }

      // Parse absolute references
      const colMatch = reference.match(/^(\$?)([A-Z]+)/);
      const rowMatch = reference.match(/([A-Z]+)(\$?)(\d+)$/);

      return {
        type: "cell",
        address,
        reference,
        absolute: {
          row: rowMatch ? rowMatch[2] === "$" : false,
          col: colMatch ? colMatch[1] === "$" : false,
        },
      };
    }

    if (this.match("RANGE")) {
      const reference = this.previous().value;
      const range = parseCellRange(reference.replace(/\$/g, ""));
      if (!range) {
        throw this.error(`Invalid range reference: ${reference}`);
      }

      return {
        type: "range",
        range,
        reference,
      };
    }

    if (this.match("SHEET_CELL")) {
      const reference = this.previous().value;
      
      // Parse sheet name and cell reference
      const match = reference.match(/^(.*?)!(.+)$/);
      if (!match) {
        throw this.error(`Invalid sheet cell reference: ${reference}`);
      }

      let sheetName = match[1];
      const cellRef = match[2];

      // Remove quotes from sheet name if present
      if (sheetName.startsWith("'") && sheetName.endsWith("'")) {
        sheetName = sheetName.slice(1, -1);
      }

      const address = parseCellAddress(cellRef.replace(/\$/g, ""));
      if (!address) {
        throw this.error(`Invalid cell reference in sheet reference: ${cellRef}`);
      }

      // Parse absolute references
      const colMatch = cellRef.match(/^(\$?)([A-Z]+)/);
      const rowMatch = cellRef.match(/([A-Z]+)(\$?)(\d+)$/);

      return {
        type: "sheet_cell",
        sheetName,
        address,
        reference,
        absolute: {
          row: rowMatch ? rowMatch[2] === "$" : false,
          col: colMatch ? colMatch[1] === "$" : false,
        },
      };
    }

    if (this.match("SHEET_RANGE")) {
      const reference = this.previous().value;
      
      // Parse sheet name and range reference
      const match = reference.match(/^(.*?)!(.+)$/);
      if (!match) {
        throw this.error(`Invalid sheet range reference: ${reference}`);
      }

      let sheetName = match[1];
      const rangeRef = match[2];

      // Remove quotes from sheet name if present
      if (sheetName.startsWith("'") && sheetName.endsWith("'")) {
        sheetName = sheetName.slice(1, -1);
      }

      const range = parseCellRange(rangeRef.replace(/\$/g, ""));
      if (!range) {
        throw this.error(`Invalid range reference in sheet reference: ${rangeRef}`);
      }

      return {
        type: "sheet_range",
        sheetName,
        range,
        reference,
      };
    }

    if (this.match("FUNCTION")) {
      const name = this.previous().value.toUpperCase();
      this.consume("LPAREN", `Expected '(' after function name '${name}'`);

      const args: ASTNode[] = [];

      if (!this.check("RPAREN")) {
        do {
          args.push(this.parseExpression());
        } while (this.match("COMMA"));
      }

      this.consume("RPAREN", `Expected ')' after function arguments`);

      return {
        type: "function",
        name,
        args,
      };
    }

    if (this.match("LPAREN")) {
      const expr = this.parseExpression();
      this.consume("RPAREN", "Expected ) after expression");
      return expr;
    }

    throw this.error("Expected expression");
  }

  private isComparisonOperator(op: string): boolean {
    return ["=", "<>", "<", ">", "<=", ">="].includes(op);
  }

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === "EOF";
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw this.error(message);
  }

  private error(message: string): Error {
    return new Error(message);
  }
}
