const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:8080');
  await page.waitForSelector('.grid-container');
  
  // Check initial focus
  let activeElement = await page.evaluate(() => document.activeElement.className);
  console.log('Initial focus:', activeElement);
  
  // Navigate with j
  await page.keyboard.press('j');
  await page.waitForTimeout(100);
  
  activeElement = await page.evaluate(() => document.activeElement.className);
  console.log('After j:', activeElement);
  
  // Navigate with l
  await page.keyboard.press('l');
  await page.waitForTimeout(100);
  
  activeElement = await page.evaluate(() => document.activeElement.className);
  console.log('After l:', activeElement);
  
  // Press i to enter insert mode
  await page.keyboard.press('i');
  await page.waitForTimeout(100);
  
  const mode = await page.locator('.mode-text').last().textContent();
  console.log('Mode after i:', mode);
  
  activeElement = await page.evaluate(() => document.activeElement.className);
  console.log('Focus after i:', activeElement);
  
  await browser.close();
})();