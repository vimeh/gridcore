import type {
  IFormulaParser,
  FormulaToken,
  FormulaAST,
  ParsedFormula,
} from "../../domain/interfaces/IFormulaParser"
import { Result, ok, err } from "../../shared/types/Result"
import { CellAddress } from "../../domain/models/CellAddress"
import { CellRange } from "../../domain/models/CellRange"

export class FormulaParser implements IFormulaParser {
  private tokens: FormulaToken[] = []
  private current = 0

  parse(expression: string): Result<ParsedFormula> {
    try {
      // Remove leading '=' if present
      const cleanExpression = expression.startsWith("=") 
        ? expression.slice(1) 
        : expression

      const tokenResult = this.tokenize(cleanExpression)
      if (!tokenResult.ok) {
        return err(tokenResult.error)
      }

      this.tokens = tokenResult.value
      this.current = 0

      const astResult = this.buildAST(this.tokens)
      if (!astResult.ok) {
        return err(astResult.error)
      }

      const dependencies = this.extractDependencies(astResult.value)

      return ok({
        ast: astResult.value,
        tokens: this.tokens,
        dependencies,
      })
    } catch (error) {
      return err(error instanceof Error ? error.message : "Unknown parsing error")
    }
  }

  tokenize(expression: string): Result<FormulaToken[]> {
    const tokens: FormulaToken[] = []
    let position = 0

    while (position < expression.length) {
      const char = expression[position]

      // Skip whitespace
      if (/\s/.test(char)) {
        position++
        continue
      }

      // Numbers
      if (/\d/.test(char) || (char === "." && position + 1 < expression.length && /\d/.test(expression[position + 1]))) {
        const start = position
        let hasDecimal = char === "."
        position++

        while (position < expression.length && (/\d/.test(expression[position]) || (!hasDecimal && expression[position] === "."))) {
          if (expression[position] === ".") hasDecimal = true
          position++
        }

        tokens.push({
          type: "literal",
          value: expression.slice(start, position),
          position: start,
        })
        continue
      }

      // Cell references and ranges
      if (/[A-Za-z]/.test(char)) {
        const start = position
        
        // Match column letters
        while (position < expression.length && /[A-Za-z]/.test(expression[position])) {
          position++
        }
        
        // Match row numbers
        while (position < expression.length && /\d/.test(expression[position])) {
          position++
        }

        const cellRef = expression.slice(start, position)

        // Check for range operator
        if (expression[position] === ":") {
          position++ // Skip ':'
          const rangeStart = position

          // Match second cell reference
          while (position < expression.length && /[A-Za-z]/.test(expression[position])) {
            position++
          }
          while (position < expression.length && /\d/.test(expression[position])) {
            position++
          }

          tokens.push({
            type: "rangeRef",
            value: cellRef + ":" + expression.slice(rangeStart, position),
            position: start,
          })
        } else {
          // Check if it's a function name
          if (position < expression.length && expression[position] === "(") {
            tokens.push({
              type: "function",
              value: cellRef.toUpperCase(),
              position: start,
            })
          } else {
            tokens.push({
              type: "cellRef",
              value: cellRef,
              position: start,
            })
          }
        }
        continue
      }

      // Strings
      if (char === '"' || char === "'") {
        const quote = char
        const start = position
        position++ // Skip opening quote
        let value = ""

        while (position < expression.length && expression[position] !== quote) {
          if (expression[position] === "\\" && position + 1 < expression.length) {
            position++ // Skip escape character
          }
          value += expression[position]
          position++
        }

        if (position >= expression.length) {
          return err(`Unterminated string at position ${start}`)
        }

        position++ // Skip closing quote
        tokens.push({
          type: "literal",
          value: `"${value}"`,
          position: start,
        })
        continue
      }

      // Operators and parentheses
      const operators: Record<string, FormulaToken["type"]> = {
        "+": "operator",
        "-": "operator",
        "*": "operator",
        "/": "operator",
        "^": "operator",
        "=": "operator",
        "<": "operator",
        ">": "operator",
        "(": "parenthesis",
        ")": "parenthesis",
        ",": "operator",
      }

      if (operators[char]) {
        // Check for two-character operators
        if ((char === "<" || char === ">") && position + 1 < expression.length && expression[position + 1] === "=") {
          tokens.push({
            type: "operator",
            value: char + "=",
            position,
          })
          position += 2
        } else if (char === "<" && position + 1 < expression.length && expression[position + 1] === ">") {
          tokens.push({
            type: "operator",
            value: "<>",
            position,
          })
          position += 2
        } else {
          tokens.push({
            type: operators[char],
            value: char,
            position,
          })
          position++
        }
        continue
      }

      return err(`Unexpected character '${char}' at position ${position}`)
    }

    return ok(tokens)
  }

  buildAST(tokens: FormulaToken[]): Result<FormulaAST> {
    this.tokens = tokens
    this.current = 0

    if (tokens.length === 0) {
      return err("Empty formula")
    }

    try {
      const ast = this.parseExpression()
      if (!this.isAtEnd()) {
        return err(`Unexpected token at position ${this.tokens[this.current].position}`)
      }
      return ok(ast)
    } catch (error) {
      return err(error instanceof Error ? error.message : "Unknown AST building error")
    }
  }

  private parseExpression(): FormulaAST {
    return this.parseComparison()
  }

  private parseComparison(): FormulaAST {
    let left = this.parseAddition()

    while (this.match("=", "<", ">", "<=", ">=", "<>")) {
      const operator = this.previous().value
      const right = this.parseAddition()
      left = {
        type: "binaryOp",
        operator,
        left,
        right,
      }
    }

    return left
  }

  private parseAddition(): FormulaAST {
    let left = this.parseMultiplication()

    while (this.match("+", "-")) {
      const operator = this.previous().value
      const right = this.parseMultiplication()
      left = {
        type: "binaryOp",
        operator,
        left,
        right,
      }
    }

    return left
  }

  private parseMultiplication(): FormulaAST {
    let left = this.parseExponentiation()

    while (this.match("*", "/")) {
      const operator = this.previous().value
      const right = this.parseExponentiation()
      left = {
        type: "binaryOp",
        operator,
        left,
        right,
      }
    }

    return left
  }

  private parseExponentiation(): FormulaAST {
    let left = this.parseUnary()

    while (this.match("^")) {
      const operator = this.previous().value
      const right = this.parseUnary()
      left = {
        type: "binaryOp",
        operator,
        left,
        right,
      }
    }

    return left
  }

  private parseUnary(): FormulaAST {
    if (this.match("-", "+")) {
      const operator = this.previous().value
      const operand = this.parseUnary()
      return {
        type: "unaryOp",
        operator,
        operand,
      }
    }

    return this.parsePrimary()
  }

  private parsePrimary(): FormulaAST {
    // Numbers and strings
    if (this.check("literal")) {
      const token = this.advance()
      const value = token.value

      // Check if it's a string
      if (value.startsWith('"') || value.startsWith("'")) {
        return {
          type: "literal",
          value: value.slice(1, -1), // Remove quotes
        }
      }

      // It's a number
      return {
        type: "literal",
        value: parseFloat(value),
      }
    }

    // Cell references
    if (this.check("cellRef")) {
      const token = this.advance()
      const addressResult = CellAddress.fromString(token.value)
      if (!addressResult.ok) {
        throw new Error(`Invalid cell reference: ${token.value}`)
      }
      return {
        type: "cellRef",
        address: addressResult.value,
      }
    }

    // Ranges
    if (this.check("rangeRef")) {
      const token = this.advance()
      const rangeResult = CellRange.fromString(token.value)
      if (!rangeResult.ok) {
        throw new Error(`Invalid range: ${token.value}`)
      }
      return {
        type: "rangeRef",
        range: rangeResult.value,
      }
    }

    // Functions
    if (this.check("function")) {
      const nameToken = this.advance()
      this.consume("(", "Expected '(' after function name")

      const args: FormulaAST[] = []
      if (!this.check(")")) {
        do {
          args.push(this.parseExpression())
        } while (this.match(","))
      }

      this.consume(")", "Expected ')' after function arguments")

      return {
        type: "function",
        name: nameToken.value,
        arguments: args,
      }
    }

    // Parentheses
    if (this.match("(")) {
      const expr = this.parseExpression()
      this.consume(")", "Expected ')' after expression")
      return expr
    }

    throw new Error(`Unexpected token: ${this.peek().value}`)
  }

  private extractDependencies(ast: FormulaAST): Set<string> {
    const dependencies = new Set<string>()

    const visit = (node: FormulaAST) => {
      switch (node.type) {
        case "cellRef":
          if (node.address) {
            dependencies.add(node.address.toString())
          }
          break
        case "rangeRef":
          if (node.range) {
            for (const cell of node.range.cells()) {
              dependencies.add(cell.toString())
            }
          }
          break
        case "function":
          if (node.arguments) {
            node.arguments.forEach(visit)
          }
          break
        case "binaryOp":
          if (node.left) visit(node.left)
          if (node.right) visit(node.right)
          break
        case "unaryOp":
          if (node.operand) visit(node.operand)
          break
      }
    }

    visit(ast)
    return dependencies
  }

  private match(...types: string[]): boolean {
    for (const type of types) {
      if (this.check("operator") || this.check("parenthesis")) {
        if (this.peek().value === type) {
          this.advance()
          return true
        }
      }
    }
    return false
  }

  private check(type: string): boolean {
    if (this.isAtEnd()) return false
    return this.peek().type === type
  }

  private advance(): FormulaToken {
    if (!this.isAtEnd()) this.current++
    return this.previous()
  }

  private isAtEnd(): boolean {
    return this.current >= this.tokens.length
  }

  private peek(): FormulaToken {
    if (this.current >= this.tokens.length) {
      // Return a dummy EOF token
      return { type: "operator", value: "", position: this.tokens.length }
    }
    return this.tokens[this.current]
  }

  private previous(): FormulaToken {
    return this.tokens[this.current - 1]
  }

  private consume(value: string, message: string): FormulaToken {
    if (this.check("operator") || this.check("parenthesis")) {
      if (this.peek().value === value) {
        return this.advance()
      }
    }
    throw new Error(message)
  }
}