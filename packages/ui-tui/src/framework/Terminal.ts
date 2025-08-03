import type { OptimizedBuffer, Cell, RGBA } from './OptimizedBuffer'

export class Terminal {
  private stdout = process.stdout
  private stdin = process.stdin
  private isRawMode = false

  constructor() {
    // Hide cursor by default
    this.hideCursor()
  }

  enterRawMode(): void {
    if (this.isRawMode) return
    
    // Check if setRawMode is available (not available in some environments)
    if (typeof this.stdin.setRawMode === 'function') {
      this.stdin.setRawMode(true)
    }
    this.stdin.resume()
    this.stdin.setEncoding('utf8')
    this.isRawMode = true
  }

  exitRawMode(): void {
    if (!this.isRawMode) return
    
    // Check if setRawMode is available
    if (typeof this.stdin.setRawMode === 'function') {
      this.stdin.setRawMode(false)
    }
    this.stdin.pause()
    this.isRawMode = false
  }

  clearScreen(): void {
    this.stdout.write('\x1b[2J\x1b[H')
  }

  moveCursor(x: number, y: number): void {
    this.stdout.write(`\x1b[${y + 1};${x + 1}H`)
  }

  hideCursor(): void {
    this.stdout.write('\x1b[?25l')
  }

  showCursor(): void {
    this.stdout.write('\x1b[?25h')
  }

  getSize(): { width: number; height: number } {
    return {
      width: this.stdout.columns || 80,
      height: this.stdout.rows || 24
    }
  }

  onResize(callback: (width: number, height: number) => void): void {
    this.stdout.on('resize', () => {
      const { width, height } = this.getSize()
      callback(width, height)
    })
  }

  onKeyPress(callback: (key: string, meta: KeyMeta) => void): void {
    if (!this.isRawMode) {
      throw new Error('Terminal must be in raw mode to handle key presses')
    }

    this.stdin.on('data', (data: string) => {
      const meta = this.parseKey(data)
      callback(data, meta)
    })
  }

  private parseKey(data: string): KeyMeta {
    const meta: KeyMeta = {
      ctrl: false,
      alt: false,
      shift: false,
      key: data
    }

    // Handle special sequences
    if (data === '\x1b[A') meta.key = 'up'
    else if (data === '\x1b[B') meta.key = 'down'
    else if (data === '\x1b[C') meta.key = 'right'
    else if (data === '\x1b[D') meta.key = 'left'
    else if (data === '\x1b[5~') meta.key = 'pageup'
    else if (data === '\x1b[6~') meta.key = 'pagedown'
    else if (data === '\x1b[H') meta.key = 'home'
    else if (data === '\x1b[F') meta.key = 'end'
    else if (data === '\x1b') meta.key = 'escape'
    else if (data === '\r') meta.key = 'enter'
    else if (data === '\t') meta.key = 'tab'
    else if (data === '\x7f' || data === '\x08') meta.key = 'backspace'
    else if (data === '\x1b[3~') meta.key = 'delete'
    
    // Ctrl combinations
    else if (data.charCodeAt(0) >= 1 && data.charCodeAt(0) <= 26) {
      meta.ctrl = true
      meta.key = String.fromCharCode(data.charCodeAt(0) + 96)
    }

    return meta
  }

  renderBuffer(buffer: OptimizedBuffer): void {
    const size = this.getSize()
    const output: string[] = []

    for (let y = 0; y < size.height; y++) {
      for (let x = 0; x < size.width; x++) {
        const cell = buffer.getCell(x, y)
        if (!cell) continue

        // Move cursor if needed
        output.push(`\x1b[${y + 1};${x + 1}H`)

        // Apply styles
        const styles: string[] = []
        if (cell.fg) {
          styles.push(`\x1b[38;2;${cell.fg.r};${cell.fg.g};${cell.fg.b}m`)
        }
        if (cell.bg) {
          styles.push(`\x1b[48;2;${cell.bg.r};${cell.bg.g};${cell.bg.b}m`)
        }
        if (cell.bold) {
          styles.push('\x1b[1m')
        }
        if (cell.underline) {
          styles.push('\x1b[4m')
        }

        if (styles.length > 0) {
          output.push(styles.join(''))
        }

        output.push(cell.char)

        // Reset styles
        if (styles.length > 0) {
          output.push('\x1b[0m')
        }
      }
    }

    // Write all at once for better performance
    this.stdout.write(output.join(''))
  }

  cleanup(): void {
    this.showCursor()
    this.clearScreen()
    this.exitRawMode()
  }
}

export interface KeyMeta {
  ctrl: boolean
  alt: boolean
  shift: boolean
  key: string
}