export type TokenType = 
  | 'NUMBER'
  | 'STRING'
  | 'CELL'
  | 'RANGE'
  | 'FUNCTION'
  | 'OPERATOR'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'COLON'
  | 'SEMICOLON'
  | 'TRUE'
  | 'FALSE'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  position: number;
}

export class Tokenizer {
  private input: string;
  private position: number;
  private tokens: Token[];

  constructor(input: string) {
    this.input = input;
    this.position = 0;
    this.tokens = [];
  }

  tokenize(): Token[] {
    this.position = 0;
    this.tokens = [];

    while (this.position < this.input.length) {
      this.skipWhitespace();
      
      if (this.position >= this.input.length) break;

      const char = this.input[this.position];
      
      if (this.isDigit(char) || (char === '.' && this.position + 1 < this.input.length && this.isDigit(this.input[this.position + 1]))) {
        this.readNumber();
      } else if (char === '"' || char === "'") {
        this.readString();
      } else if (this.isLetter(char) || char === '$') {
        this.readIdentifier();
      } else if (this.isOperator(char)) {
        this.readOperator();
      } else if (char === '(') {
        this.addToken('LPAREN', char);
        this.position++;
      } else if (char === ')') {
        this.addToken('RPAREN', char);
        this.position++;
      } else if (char === ',') {
        this.addToken('COMMA', char);
        this.position++;
      } else if (char === ':') {
        this.addToken('COLON', char);
        this.position++;
      } else if (char === ';') {
        this.addToken('SEMICOLON', char);
        this.position++;
      } else {
        throw new Error(`Unexpected character '${char}' at position ${this.position}`);
      }
    }

    this.addToken('EOF', '');
    return this.tokens;
  }

  private skipWhitespace(): void {
    while (this.position < this.input.length && /\s/.test(this.input[this.position])) {
      this.position++;
    }
  }

  private isDigit(char: string): boolean {
    return /\d/.test(char);
  }

  private isLetter(char: string): boolean {
    return /[a-zA-Z]/.test(char);
  }

  private isOperator(char: string): boolean {
    return '+-*/^=<>&'.includes(char);
  }

  private readNumber(): void {
    const start = this.position;
    let hasDecimal = false;

    while (this.position < this.input.length) {
      const char = this.input[this.position];
      
      if (this.isDigit(char)) {
        this.position++;
      } else if (char === '.' && !hasDecimal) {
        hasDecimal = true;
        this.position++;
      } else {
        break;
      }
    }

    const value = this.input.slice(start, this.position);
    this.addToken('NUMBER', value);
  }

  private readString(): void {
    const quote = this.input[this.position];
    const start = this.position;
    this.position++; // Skip opening quote

    while (this.position < this.input.length && this.input[this.position] !== quote) {
      if (this.input[this.position] === '\\' && this.position + 1 < this.input.length) {
        this.position += 2; // Skip escaped character
      } else {
        this.position++;
      }
    }

    if (this.position >= this.input.length) {
      throw new Error(`Unterminated string starting at position ${start}`);
    }

    this.position++; // Skip closing quote
    const value = this.input.slice(start, this.position);
    this.addToken('STRING', value);
  }

  private readIdentifier(): void {
    const start = this.position;
    
    // Handle $ at the beginning for absolute references
    let hasDollarPrefix = false;
    if (this.input[this.position] === '$') {
      hasDollarPrefix = true;
      this.position++;
    }

    // Read the identifier part
    while (this.position < this.input.length && (this.isLetter(this.input[this.position]) || this.isDigit(this.input[this.position]) || this.input[this.position] === '$')) {
      this.position++;
    }

    const identifier = this.input.slice(start, this.position);

    // Check if it's a boolean literal
    if (identifier.toUpperCase() === 'TRUE') {
      this.addToken('TRUE', identifier);
      return;
    }
    
    if (identifier.toUpperCase() === 'FALSE') {
      this.addToken('FALSE', identifier);
      return;
    }

    // Check if it's followed by a colon (range) or is a cell reference
    const savedPos = this.position;
    this.skipWhitespace();
    
    if (this.position < this.input.length && this.input[this.position] === ':') {
      // It's part of a range, read the full range
      this.position++; // Skip colon
      this.skipWhitespace();
      
      const rangeStart = this.position;
      while (this.position < this.input.length && (this.isLetter(this.input[this.position]) || this.isDigit(this.input[this.position]) || this.input[this.position] === '$')) {
        this.position++;
      }
      
      const fullRange = identifier + ':' + this.input.slice(rangeStart, this.position);
      this.addToken('RANGE', fullRange);
    } else if (this.position < this.input.length && this.input[this.position] === '(') {
      // It's a function
      this.position = savedPos; // Restore position
      this.addToken('FUNCTION', identifier);
    } else if (this.isCellReference(identifier)) {
      // It's a cell reference
      this.position = savedPos; // Restore position
      this.addToken('CELL', identifier);
    } else {
      // It's a function without parentheses or an unknown identifier
      this.position = savedPos; // Restore position
      this.addToken('FUNCTION', identifier);
    }
  }

  private readOperator(): void {
    const start = this.position;
    const char = this.input[this.position];
    this.position++;

    // Check for two-character operators
    if (this.position < this.input.length) {
      const nextChar = this.input[this.position];
      if (char === '<' && (nextChar === '=' || nextChar === '>')) {
        this.position++;
        this.addToken('OPERATOR', char + nextChar);
        return;
      } else if (char === '>' && nextChar === '=') {
        this.position++;
        this.addToken('OPERATOR', char + nextChar);
        return;
      }
    }

    this.addToken('OPERATOR', char);
  }

  private isCellReference(str: string): boolean {
    return /^\$?[A-Z]+\$?\d+$/.test(str);
  }

  private addToken(type: TokenType, value: string): void {
    this.tokens.push({
      type,
      value,
      position: this.position - value.length
    });
  }
}