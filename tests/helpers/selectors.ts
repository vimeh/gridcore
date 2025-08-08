/**
 * Selector mappings for Leptos UI
 * Maps old TypeScript UI selectors to new Leptos UI selectors
 */

export const selectors = {
  // Formula bar elements
  formulaBarAddress: ".cell-indicator", // was .formula-bar-address
  formulaBarInput: ".formula-input", // was .formula-bar-input
  formulaBar: ".formula-bar",
  
  // Editor elements  
  cellEditor: ".cell-editor-overlay", // was .cell-editor
  cellEditorInput: ".cell-editor-overlay input",
  
  // Mode indicators (currently in status bar)
  modeIndicator: ".status-bar", // Mode is now shown in status bar
  modeText: ".status-bar span:last-child span", // The actual mode text in status bar
  modeDetail: ".mode-detail", // Doesn't exist yet - needs implementation
  
  // Grid elements
  grid: "canvas", // was .grid-container
  gridCanvas: "canvas", // Specific canvas element
  gridWrapper: ".canvas-grid-wrapper", // The focusable wrapper around canvas
  
  // Status bar
  statusBar: ".status-bar",
  statusBarMode: ".status-bar span:last-child span", // Mode display in status bar
  
  // Navigation
  activeCell: ".active-cell", // Doesn't exist - cursor is drawn on canvas
  
  // Buttons and controls (if they exist)
  debugCheckbox: 'input[type="checkbox"]:first-of-type',
  keyboardModeCheckbox: 'input[type="checkbox"]:nth-of-type(2)',
  importButton: 'button:has-text("Import")',
  exportButton: 'button:has-text("Export")',
}

export const waitForApp = async (page: any) => {
  // Wait for canvas to be ready
  await page.waitForSelector("canvas")
  // Wait for status bar
  await page.waitForSelector(".status-bar")
  // Give the app a moment to initialize
  await page.waitForTimeout(100)
}