import { SpreadsheetTUI } from './SpreadsheetTUI'

async function main() {
  console.log('Starting GridCore TUI...')
  
  const tui = new SpreadsheetTUI()
  
  // Handle process exit
  process.on('SIGINT', () => {
    tui.stop()
  })
  
  process.on('SIGTERM', () => {
    tui.stop()
  })
  
  // Start the TUI
  await tui.start()
}

// Run if this is the main module
if (import.meta.main) {
  main().catch((error) => {
    console.error('Error starting TUI:', error)
    process.exit(1)
  })
}

export { SpreadsheetTUI }
