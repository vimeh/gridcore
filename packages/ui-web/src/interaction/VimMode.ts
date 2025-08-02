import { CellMode, EditMode } from "../state/SpreadsheetMode"

export type VimModeType = "normal" | "insert" | "visual" | "visual-line";

export interface VimState {
  mode: VimModeType;
  cursor: number;
  visualStart?: number;
  visualEnd?: number;
  operator?: string; // 'c', 'd', 'y', etc.
  textObjectModifier?: string; // 'i' or 'a'
  count: string; // accumulate count digits
  lastAction?: string; // for repeat (.)
}

export interface VimCallbacks {
  onModeChange?: (mode: VimModeType) => void;
  onCursorMove?: (position: number) => void;
  onTextChange?: (text: string, cursor: number) => void;
}

/**
 * Callbacks for the stateless VimBehavior class to communicate with the mode system
 */
export interface VimBehaviorCallbacks {
  onModeChangeRequest: (mode: CellMode, editMode?: EditMode) => void;
  onCursorMove: (position: number) => void;
  onTextChange: (text: string, cursor: number) => void;
}

/**
 * Internal state for VimBehavior that doesn't include mode management
 */
interface VimBehaviorState {
  cursor: number;
  visualStart?: number;
  visualEnd?: number;
  operator?: string; // 'c', 'd', 'y', etc.
  textObjectModifier?: string; // 'i' or 'a'
  count: string; // accumulate count digits
  lastAction?: string; // for repeat (.)
}

/**
 * Stateless VimBehavior class that handles vim keybindings and emits mode change requests
 * instead of managing mode state internally. This integrates with the centralized mode system.
 */
export class VimBehavior {
  private state: VimBehaviorState = {
    cursor: 0,
    count: "",
  };
  
  private text: string = "";
  private callbacks: VimBehaviorCallbacks;
  private getCurrentMode: () => CellMode;
  
  constructor(callbacks: VimBehaviorCallbacks, getCurrentMode: () => CellMode) {
    this.callbacks = callbacks;
    this.getCurrentMode = getCurrentMode;
  }
  
  setText(text: string, cursor?: number, skipCursorCallback: boolean = false): void {
    this.text = text;
    if (cursor !== undefined) {
      // In insert mode, cursor can be at text.length (after last character)
      // In normal mode, cursor is clamped to text.length - 1 (on last character)
      const currentMode = this.getCurrentMode();
      const maxCursor = currentMode === "insert" ? text.length : Math.max(0, text.length - 1);
      this.state.cursor = Math.min(cursor, maxCursor);
    }
    if (!skipCursorCallback) {
      this.callbacks.onCursorMove(this.state.cursor);
    }
  }
  
  getText(): string {
    return this.text;
  }
  
  getCursor(): number {
    return this.state.cursor;
  }
  
  getMode(): CellMode {
    return this.getCurrentMode();
  }
  
  handleKey(key: string, ctrl: boolean = false, shift: boolean = false): boolean {
    const currentMode = this.getCurrentMode();
    switch (currentMode) {
      case "normal":
        return this.handleNormalMode(key, ctrl, shift);
      case "insert":
        return this.handleInsertMode(key, ctrl);
      case "visual":
      case "visual-line":
        return this.handleVisualMode(key, ctrl, shift);
      default:
        return false;
    }
  }
  
  private handleNormalMode(key: string, ctrl: boolean, shift: boolean): boolean {
    // Handle operators
    if (this.state.operator) {
      return this.handleOperatorPending(key, ctrl, shift);
    }
    
    // Accumulate count
    if (key >= "1" && key <= "9" && !this.state.count) {
      this.state.count = key;
      return true;
    } else if (key >= "0" && key <= "9" && this.state.count) {
      this.state.count += key;
      return true;
    }
    
    const count = parseInt(this.state.count || "1");
    
    switch (key) {
      // Movement
      case "h":
        this.moveCursor(-count);
        this.state.count = "";
        return true;
        
      case "l":
        this.moveCursor(count);
        this.state.count = "";
        return true;
        
      case "w":
        this.moveWord(count, "forward");
        this.state.count = "";
        return true;
        
      case "b":
        this.moveWord(count, "backward");
        this.state.count = "";
        return true;
        
      case "e":
        this.moveWord(count, "end");
        this.state.count = "";
        return true;
        
      case "0":
        if (!this.state.count) {
          this.state.cursor = 0;
          this.callbacks.onCursorMove(this.state.cursor);
          return true;
        }
        return false;
        
      case "$":
        this.state.cursor = Math.max(0, this.text.length - 1);
        this.callbacks.onCursorMove(this.state.cursor);
        this.state.count = "";
        return true;
        
      // Insert mode transitions
      case "i":
        this.callbacks.onModeChangeRequest("insert", "insert");
        this.state.count = "";
        return true;
        
      case "I":
        this.state.cursor = 0;
        this.callbacks.onModeChangeRequest("insert", "insert");
        this.state.count = "";
        return true;
        
      case "a":
        if (this.text.length > 0) {
          this.state.cursor = Math.min(this.state.cursor + 1, this.text.length);
        }
        this.callbacks.onModeChangeRequest("insert", "append");
        this.state.count = "";
        return true;
        
      case "A":
        this.state.cursor = this.text.length;
        this.callbacks.onModeChangeRequest("insert", "append");
        this.state.count = "";
        return true;
        
      case "o":
        // In single-line context, just go to end
        this.state.cursor = this.text.length;
        this.callbacks.onModeChangeRequest("insert", "insert");
        this.state.count = "";
        return true;
        
      case "O":
        // In single-line context, just go to beginning
        this.state.cursor = 0;
        this.callbacks.onModeChangeRequest("insert", "insert");
        this.state.count = "";
        return true;
        
      // Visual mode
      case "v":
        this.state.visualStart = this.state.cursor;
        this.state.visualEnd = this.state.cursor;
        this.callbacks.onModeChangeRequest("visual");
        this.state.count = "";
        return true;
        
      case "V":
        this.state.visualStart = 0;
        this.state.visualEnd = this.text.length - 1;
        this.callbacks.onModeChangeRequest("visual-line");
        this.state.count = "";
        return true;
        
      // Operators
      case "c":
      case "d":
      case "y":
        this.state.operator = key;
        return true;
        
      // Delete character
      case "x":
        if (this.text.length > 0) {
          const deleteCount = Math.min(count, this.text.length - this.state.cursor);
          this.text = this.text.slice(0, this.state.cursor) + this.text.slice(this.state.cursor + deleteCount);
          if (this.text.length === 0) {
            this.text = "";
            this.state.cursor = 0;
          } else {
            this.state.cursor = Math.min(this.state.cursor, this.text.length - 1);
          }
          this.callbacks.onTextChange(this.text, this.state.cursor);
          this.callbacks.onCursorMove(this.state.cursor);
        }
        this.state.count = "";
        return true;
        
      default:
        this.state.count = "";
        return false;
    }
  }
  
  private handleInsertMode(key: string, ctrl: boolean): boolean {
    if (key === "Escape" || (ctrl && key === "[")) {
      // Move cursor back if not at start
      if (this.state.cursor > 0 && this.state.cursor === this.text.length) {
        this.state.cursor--;
      }
      this.callbacks.onModeChangeRequest("normal");
      this.callbacks.onCursorMove(this.state.cursor);
      return true;
    }
    
    // Let the input handle actual text insertion
    return false;
  }
  
  private handleVisualMode(key: string, ctrl: boolean, shift: boolean): boolean {
    if (key === "Escape" || (ctrl && key === "[")) {
      this.callbacks.onModeChangeRequest("normal");
      return true;
    }
    
    // Handle movement in visual mode
    switch (key) {
      case "h":
        this.moveCursor(-1);
        this.updateVisualSelection();
        return true;
        
      case "l":
        this.moveCursor(1);
        this.updateVisualSelection();
        return true;
        
      case "w":
        this.moveWord(1, "forward");
        this.updateVisualSelection();
        return true;
        
      case "b":
        this.moveWord(1, "backward");
        this.updateVisualSelection();
        return true;
        
      case "e":
        this.moveWord(1, "end");
        this.updateVisualSelection();
        return true;
        
      case "0":
        this.state.cursor = 0;
        this.updateVisualSelection();
        this.callbacks.onCursorMove(this.state.cursor);
        return true;
        
      case "$":
        this.state.cursor = Math.max(0, this.text.length - 1);
        this.updateVisualSelection();
        this.callbacks.onCursorMove(this.state.cursor);
        return true;
        
      // Operations on visual selection
      case "c":
      case "d":
        const [start, end] = this.getVisualSelection();
        this.text = this.text.slice(0, start) + this.text.slice(end + 1);
        this.state.cursor = start;
        if (key === "c") {
          this.callbacks.onModeChangeRequest("insert");
        } else {
          this.callbacks.onModeChangeRequest("normal");
        }
        this.callbacks.onTextChange(this.text, this.state.cursor);
        this.callbacks.onCursorMove(this.state.cursor);
        return true;
        
      case "y":
        // Would copy to clipboard in real implementation
        this.callbacks.onModeChangeRequest("normal");
        return true;
        
      default:
        return false;
    }
  }
  
  private handleOperatorPending(key: string, ctrl: boolean, shift: boolean): boolean {
    const operator = this.state.operator!;
    
    // Handle operator + motion combinations
    if (operator === key) {
      // Double operator (cc, dd, yy) - operate on whole line
      this.state.operator = undefined;
      if (operator === "c" || operator === "d") {
        this.text = "";
        this.state.cursor = 0;
        if (operator === "c") {
          this.callbacks.onModeChangeRequest("insert");
        }
        this.callbacks.onTextChange(this.text, this.state.cursor);
        this.callbacks.onCursorMove(this.state.cursor);
      }
      return true;
    }
    
    // Text objects
    if (key === "i" || key === "a") {
      // Store modifier and wait for text object
      this.state.textObjectModifier = key;
      return true;
    }
    
    // Check if we're waiting for text object
    if (this.state.textObjectModifier) {
      const handled = this.handleTextObject(operator, this.state.textObjectModifier, key);
      this.state.operator = undefined;
      this.state.textObjectModifier = undefined;
      return handled;
    }
    
    // Reset operator state
    this.state.operator = undefined;
    
    // Handle motion after operator
    const startPos = this.state.cursor;
    let endPos = startPos;
    
    switch (key) {
      case "w":
        endPos = this.getWordEnd(startPos, "forward");
        break;
      case "b":
        endPos = this.getWordEnd(startPos, "backward");
        break;
      case "e":
        endPos = this.getWordEnd(startPos, "end");
        break;
      case "$":
        endPos = this.text.length - 1;
        break;
      case "0":
        endPos = 0;
        break;
      default:
        return false;
    }
    
    // Apply operator
    if (operator === "c" || operator === "d") {
      const [start, end] = startPos <= endPos ? [startPos, endPos] : [endPos, startPos];
      this.text = this.text.slice(0, start) + this.text.slice(end + 1);
      this.state.cursor = start;
      if (operator === "c") {
        this.callbacks.onModeChangeRequest("insert");
      }
      this.callbacks.onTextChange(this.text, this.state.cursor);
      this.callbacks.onCursorMove(this.state.cursor);
    }
    
    return true;
  }
  
  private handleTextObject(operator: string, modifier: string, object: string): boolean {
    let boundaries: [number, number] | null = null;
    
    switch (object) {
      case "w":
        boundaries = this.getWordBoundaries(this.state.cursor);
        if (boundaries && modifier === "a") {
          // "a word" includes surrounding whitespace
          let [start, end] = boundaries;
          while (start > 0 && this.text[start - 1] === " ") start--;
          while (end < this.text.length - 1 && this.text[end + 1] === " ") end++;
          boundaries = [start, end];
        }
        break;
        
      case '"':
      case "'":
      case "`":
        boundaries = this.getQuoteBoundaries(this.state.cursor, object);
        if (boundaries && modifier === "a") {
          // Include the quotes themselves
          boundaries[0]--;
          boundaries[1]++;
        }
        break;
        
      case "(":
      case ")":
      case "b":
        boundaries = this.getParenBoundaries(this.state.cursor, "(", ")");
        if (boundaries && modifier === "a") {
          // Include the parentheses
          boundaries[0]--;
          boundaries[1]++;
        }
        break;
        
      case "[":
      case "]":
        boundaries = this.getParenBoundaries(this.state.cursor, "[", "]");
        if (boundaries && modifier === "a") {
          boundaries[0]--;
          boundaries[1]++;
        }
        break;
        
      case "{":
      case "}":
      case "B":
        boundaries = this.getParenBoundaries(this.state.cursor, "{", "}");
        if (boundaries && modifier === "a") {
          boundaries[0]--;
          boundaries[1]++;
        }
        break;
        
      default:
        return false;
    }
    
    if (!boundaries) return false;
    
    const [start, end] = boundaries;
    
    if (operator === "c" || operator === "d") {
      this.text = this.text.slice(0, start) + this.text.slice(end + 1);
      this.state.cursor = start;
      if (operator === "c") {
        this.callbacks.onModeChangeRequest("insert");
      }
      this.callbacks.onTextChange(this.text, this.state.cursor);
      this.callbacks.onCursorMove(this.state.cursor);
    } else if (operator === "y") {
      // Would copy to clipboard in real implementation
      // For now, just exit operator mode
    }
    
    return true;
  }
  
  private moveCursor(delta: number): void {
    this.state.cursor = Math.max(0, Math.min(this.text.length - 1, this.state.cursor + delta));
    this.callbacks.onCursorMove(this.state.cursor);
  }
  
  private moveWord(count: number, direction: "forward" | "backward" | "end"): void {
    for (let i = 0; i < count; i++) {
      this.state.cursor = this.getWordEnd(this.state.cursor, direction);
    }
    this.callbacks.onCursorMove(this.state.cursor);
  }
  
  private getWordEnd(pos: number, direction: "forward" | "backward" | "end"): number {
    const isWordChar = (ch: string) => /\w/.test(ch);
    
    if (direction === "forward") {
      // Skip current word
      while (pos < this.text.length && isWordChar(this.text[pos])) pos++;
      // Skip whitespace
      while (pos < this.text.length && !isWordChar(this.text[pos])) pos++;
      return Math.min(pos, this.text.length - 1);
    } else if (direction === "backward") {
      if (pos > 0) pos--;
      // Skip whitespace
      while (pos > 0 && !isWordChar(this.text[pos])) pos--;
      // Skip to beginning of word
      while (pos > 0 && isWordChar(this.text[pos - 1])) pos--;
      return pos;
    } else { // end
      // Skip to end of current word
      while (pos < this.text.length - 1 && isWordChar(this.text[pos + 1])) pos++;
      return pos;
    }
  }
  
  private getWordBoundaries(pos: number): [number, number] | null {
    const isWordChar = (ch: string) => /\w/.test(ch);
    
    if (pos >= this.text.length) return null;
    
    // If on whitespace, no word boundaries
    if (!isWordChar(this.text[pos])) {
      return null;
    }
    
    let start = pos;
    let end = pos;
    
    // Find word start
    while (start > 0 && isWordChar(this.text[start - 1])) start--;
    
    // Find word end
    while (end < this.text.length - 1 && isWordChar(this.text[end + 1])) end++;
    
    return [start, end];
  }
  
  private getQuoteBoundaries(pos: number, quote: string): [number, number] | null {
    // Find the nearest quote pair that contains the cursor
    let start = -1;
    let end = -1;
    
    // Look backward for opening quote
    for (let i = pos; i >= 0; i--) {
      if (this.text[i] === quote) {
        start = i;
        break;
      }
    }
    
    if (start === -1) return null;
    
    // Look forward for closing quote
    for (let i = pos; i < this.text.length; i++) {
      if (this.text[i] === quote && i > start) {
        end = i;
        break;
      }
    }
    
    if (end === -1) return null;
    
    // Return inner boundaries (excluding quotes)
    return [start + 1, end - 1];
  }
  
  private getParenBoundaries(pos: number, open: string, close: string): [number, number] | null {
    let depth = 0;
    let start = -1;
    let end = -1;
    
    // First check if we're inside parentheses by scanning backwards
    for (let i = pos; i >= 0; i--) {
      if (this.text[i] === close) {
        depth++;
      } else if (this.text[i] === open) {
        if (depth === 0) {
          start = i;
          break;
        }
        depth--;
      }
    }
    
    if (start === -1) return null;
    
    // Now find the matching closing paren
    depth = 0;
    for (let i = start + 1; i < this.text.length; i++) {
      if (this.text[i] === open) {
        depth++;
      } else if (this.text[i] === close) {
        if (depth === 0) {
          end = i;
          break;
        }
        depth--;
      }
    }
    
    if (end === -1) return null;
    
    // Return inner boundaries (excluding parens)
    return [start + 1, end - 1];
  }
  
  private updateVisualSelection(): void {
    if (this.state.visualStart !== undefined) {
      this.state.visualEnd = this.state.cursor;
    }
  }
  
  private getVisualSelection(): [number, number] {
    const start = Math.min(this.state.visualStart ?? 0, this.state.visualEnd ?? 0);
    const end = Math.max(this.state.visualStart ?? 0, this.state.visualEnd ?? 0);
    return [start, end];
  }
  
  getSelection(): { start: number; end: number } | null {
    const currentMode = this.getCurrentMode();
    if (currentMode === "visual" || currentMode === "visual-line") {
      const [start, end] = this.getVisualSelection();
      return { start, end: end + 1 }; // end is inclusive in selection
    }
    return null;
  }
  
  reset(): void {
    this.state = {
      cursor: 0,
      count: "",
    };
    this.text = "";
  }
}

export class VimMode {
  private state: VimState = {
    mode: "normal",
    cursor: 0,
    count: "",
  };
  
  private callbacks: VimCallbacks;
  private vimBehavior: VimBehavior;
  
  constructor(callbacks: VimCallbacks = {}) {
    this.callbacks = callbacks;
    
    // Create VimBehavior with callbacks that sync with our internal state
    const behaviorCallbacks: VimBehaviorCallbacks = {
      onModeChangeRequest: (mode: CellMode, editMode?: EditMode) => {
        this.setMode(mode as VimModeType);
      },
      onCursorMove: (position: number) => {
        this.state.cursor = position;
        this.callbacks.onCursorMove?.(position);
      },
      onTextChange: (text: string, cursor: number) => {
        this.state.cursor = cursor;
        this.callbacks.onTextChange?.(text, cursor);
      }
    };
    
    // Create VimBehavior that gets current mode from our state
    this.vimBehavior = new VimBehavior(
      behaviorCallbacks,
      () => this.state.mode as CellMode
    );
  }
  
  setText(text: string, cursor?: number, skipCursorCallback: boolean = false): void {
    this.vimBehavior.setText(text, cursor, skipCursorCallback);
    // Sync cursor state
    this.state.cursor = this.vimBehavior.getCursor();
  }
  
  getText(): string {
    return this.vimBehavior.getText();
  }
  
  getCursor(): number {
    return this.state.cursor;
  }
  
  getMode(): VimModeType {
    return this.state.mode;
  }
  
  handleKey(key: string, ctrl: boolean = false, shift: boolean = false): boolean {
    const result = this.vimBehavior.handleKey(key, ctrl, shift);
    // Sync cursor state after key handling
    this.state.cursor = this.vimBehavior.getCursor();
    return result;
  }
  
  getSelection(): { start: number; end: number } | null {
    return this.vimBehavior.getSelection();
  }
  
  reset(): void {
    this.state = {
      mode: "normal",
      cursor: 0,
      count: "",
    };
    this.vimBehavior.reset();
  }
  
  private setMode(mode: VimModeType): void {
    this.state.mode = mode;
    if (mode !== "visual" && mode !== "visual-line") {
      this.state.visualStart = undefined;
      this.state.visualEnd = undefined;
    }
    this.callbacks.onModeChange?.(mode);
  }
}