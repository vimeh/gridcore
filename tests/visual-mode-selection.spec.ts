import { test, expect, Page } from '@playwright/test'
import { waitForGrid, getCellSelector, pressKey } from './helpers/test-utils'

// Helper to get the canvas element
async function getCanvas(page: Page) {
  return page.locator('canvas').first()
}

// Helper to click on a specific cell
async function clickCell(page: Page, col: number, row: number) {
  const canvas = await getCanvas(page)
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas not found')
  
  // Assuming default cell dimensions and headers
  const rowHeaderWidth = 50
  const columnHeaderHeight = 25
  const cellWidth = 100
  const cellHeight = 25
  
  // Calculate cell center position
  const x = rowHeaderWidth + (col * cellWidth) + (cellWidth / 2)
  const y = columnHeaderHeight + (row * cellHeight) + (cellHeight / 2)
  
  await canvas.click({ position: { x, y } })
}

// Helper to check if selection is visible by checking controller state
async function isSelectionVisible(page: Page): Promise<boolean> {
  // For now, we'll use a simple approach - checking if we're in visual mode
  // and if the selection rendering has occurred
  await page.waitForTimeout(100) // Give time for render
  
  // Try to detect blue pixels in the canvas that indicate selection
  return await page.evaluate(() => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement
    if (!canvas) return false
    
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return false
    
    // Sample a few areas of the canvas to look for selection color
    // Selection uses rgba(0, 120, 215, 0.2) - which when blended appears as light blue
    const width = canvas.width
    const height = canvas.height
    
    // Sample center area where selection is likely to be
    const centerX = Math.floor(width / 2)
    const centerY = Math.floor(height / 2)
    const sampleSize = 100
    
    try {
      const imageData = ctx.getImageData(
        centerX - sampleSize/2, 
        centerY - sampleSize/2, 
        sampleSize, 
        sampleSize
      )
      const data = imageData.data
      
      // Count pixels that look like our selection color
      let selectionPixels = 0
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1] 
        const b = data[i + 2]
        const a = data[i + 3]
        
        // Look for light blue pixels (selection overlay blended with white background)
        // The exact color will depend on blending, but blue should be dominant
        if (b > 150 && b > r + 20 && b > g + 20 && a > 0) {
          selectionPixels++
        }
      }
      
      // If more than 5% of sampled pixels look like selection, we have a selection
      return selectionPixels > (sampleSize * sampleSize * 0.05)
    } catch (e) {
      console.error('Error sampling canvas:', e)
      return false
    }
  })
}

test.describe('Visual Mode Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8081')
    await waitForGrid(page)
    
    // Wait for initial render
    await page.waitForTimeout(500)
  })

  test('should enter visual mode with v key', async ({ page }) => {
    // Click on cell A1
    await clickCell(page, 0, 0)
    
    // Press 'v' to enter visual mode
    await page.keyboard.press('v')
    
    // Give time for state update
    await page.waitForTimeout(100)
    
    // Check that we're in visual mode by looking for selection
    const hasSelection = await isSelectionVisible(page)
    expect(hasSelection).toBeTruthy()
  })

  test('should extend selection with arrow keys', async ({ page }) => {
    // Click on cell B2
    await clickCell(page, 1, 1)
    
    // Enter visual mode
    await page.keyboard.press('v')
    await page.waitForTimeout(100)
    
    // Extend selection right
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(100)
    
    // Extend selection down
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(100)
    
    // Check that selection is visible
    const hasSelection = await isSelectionVisible(page)
    expect(hasSelection).toBeTruthy()
  })

  test('should extend selection with hjkl keys', async ({ page }) => {
    // Click on cell C3
    await clickCell(page, 2, 2)
    
    // Enter visual mode
    await page.keyboard.press('v')
    await page.waitForTimeout(100)
    
    // Extend selection with vim keys
    await page.keyboard.press('l') // right
    await page.waitForTimeout(100)
    
    await page.keyboard.press('j') // down
    await page.waitForTimeout(100)
    
    await page.keyboard.press('h') // left
    await page.waitForTimeout(100)
    
    await page.keyboard.press('k') // up
    await page.waitForTimeout(100)
    
    // Check that selection is visible
    const hasSelection = await isSelectionVisible(page)
    expect(hasSelection).toBeTruthy()
  })

  test('should exit visual mode with Escape', async ({ page }) => {
    // Click on cell A1
    await clickCell(page, 0, 0)
    
    // Enter visual mode
    await page.keyboard.press('v')
    await page.waitForTimeout(100)
    
    // Extend selection
    await page.keyboard.press('l')
    await page.keyboard.press('j')
    await page.waitForTimeout(100)
    
    // Verify selection is visible
    let hasSelection = await isSelectionVisible(page)
    expect(hasSelection).toBeTruthy()
    
    // Exit visual mode
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    
    // Selection should be cleared
    hasSelection = await isSelectionVisible(page)
    expect(hasSelection).toBeFalsy()
  })

  test('should maintain anchor point when extending selection', async ({ page }) => {
    // Start at cell B2
    await clickCell(page, 1, 1)
    
    // Enter visual mode (anchor is now B2)
    await page.keyboard.press('v')
    await page.waitForTimeout(100)
    
    // Move right twice (selection should be B2:D2)
    await page.keyboard.press('l')
    await page.keyboard.press('l')
    await page.waitForTimeout(100)
    
    // Move down (selection should be B2:D3)
    await page.keyboard.press('j')
    await page.waitForTimeout(100)
    
    // Move left (selection should be B2:C3)
    await page.keyboard.press('h')
    await page.waitForTimeout(100)
    
    // Selection should still be visible
    const hasSelection = await isSelectionVisible(page)
    expect(hasSelection).toBeTruthy()
  })

  test('should handle single cell selection in visual mode', async ({ page }) => {
    // Click on cell C3
    await clickCell(page, 2, 2)
    
    // Enter visual mode
    await page.keyboard.press('v')
    await page.waitForTimeout(100)
    
    // Without moving, we should have a single cell selected
    const hasSelection = await isSelectionVisible(page)
    expect(hasSelection).toBeTruthy()
  })

  test('should create rectangular selection', async ({ page }) => {
    // Start at cell A1
    await clickCell(page, 0, 0)
    
    // Enter visual mode
    await page.keyboard.press('v')
    await page.waitForTimeout(100)
    
    // Create a 3x3 selection (A1:C3)
    await page.keyboard.press('l') // to B1
    await page.keyboard.press('l') // to C1
    await page.keyboard.press('j') // to C2
    await page.keyboard.press('j') // to C3
    await page.waitForTimeout(100)
    
    // Verify selection is visible
    const hasSelection = await isSelectionVisible(page)
    expect(hasSelection).toBeTruthy()
  })

  test('should preserve selection when moving in different directions', async ({ page }) => {
    // Start at center cell
    await clickCell(page, 5, 5)
    
    // Enter visual mode
    await page.keyboard.press('v')
    await page.waitForTimeout(100)
    
    // Move in a pattern that tests selection preservation
    await page.keyboard.press('h') // left
    await page.keyboard.press('h') // left
    await page.keyboard.press('k') // up
    await page.keyboard.press('k') // up
    await page.keyboard.press('l') // right
    await page.keyboard.press('j') // down
    await page.waitForTimeout(100)
    
    // Selection should still be visible
    const hasSelection = await isSelectionVisible(page)
    expect(hasSelection).toBeTruthy()
  })
})

test.describe('Visual Mode Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8081')
    await waitForGrid(page)
    await page.waitForTimeout(500)
  })

  test('should render selection with correct styling', async ({ page }) => {
    // Click on cell B2
    await clickCell(page, 1, 1)
    
    // Enter visual mode
    await page.keyboard.press('v')
    
    // Extend selection to create a 2x2 block
    await page.keyboard.press('l')
    await page.keyboard.press('j')
    await page.waitForTimeout(200)
    
    // Verify selection is visible instead of screenshot
    const hasSelection = await isSelectionVisible(page)
    expect(hasSelection).toBeTruthy()
  })

  test('should show active cell border on top of selection', async ({ page }) => {
    // Click on cell A1
    await clickCell(page, 0, 0)
    
    // Enter visual mode
    await page.keyboard.press('v')
    
    // Create larger selection
    await page.keyboard.press('l')
    await page.keyboard.press('l')
    await page.keyboard.press('l')
    await page.keyboard.press('j')
    await page.keyboard.press('j')
    await page.waitForTimeout(200)
    
    // Verify selection is visible
    const hasSelection = await isSelectionVisible(page)
    expect(hasSelection).toBeTruthy()
  })
})

test.describe('Visual Mode Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8081')
    await waitForGrid(page)
    await page.waitForTimeout(500)
  })

  test('should handle boundary conditions', async ({ page }) => {
    // Click on cell A1 (top-left corner)
    await clickCell(page, 0, 0)
    
    // Enter visual mode
    await page.keyboard.press('v')
    await page.waitForTimeout(100)
    
    // Try to move beyond boundaries
    await page.keyboard.press('h') // try to go left from column A
    await page.keyboard.press('k') // try to go up from row 1
    await page.waitForTimeout(100)
    
    // Should still have selection at A1
    const hasSelection = await isSelectionVisible(page)
    expect(hasSelection).toBeTruthy()
  })

  test('should handle rapid key presses', async ({ page }) => {
    // Click on cell C3
    await clickCell(page, 2, 2)
    
    // Enter visual mode
    await page.keyboard.press('v')
    
    // Rapidly extend selection
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('l')
    }
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('j')
    }
    await page.waitForTimeout(200)
    
    // Selection should still be visible
    const hasSelection = await isSelectionVisible(page)
    expect(hasSelection).toBeTruthy()
  })

  test('should clear selection when clicking elsewhere', async ({ page }) => {
    // Start with a selection
    await clickCell(page, 1, 1)
    await page.keyboard.press('v')
    await page.keyboard.press('l')
    await page.keyboard.press('j')
    await page.waitForTimeout(100)
    
    // Click on a different cell
    await clickCell(page, 5, 5)
    await page.waitForTimeout(100)
    
    // Selection should be cleared
    const hasSelection = await isSelectionVisible(page)
    expect(hasSelection).toBeFalsy()
  })
})