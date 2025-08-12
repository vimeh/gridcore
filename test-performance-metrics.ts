import { chromium } from 'playwright';

async function testPerformanceMetrics() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    // Enable console logging
    page.on('console', msg => {
        if (msg.type() === 'log') {
            console.log('Browser console:', msg.text());
        }
    });
    
    console.log('Navigating to localhost:8080...');
    await page.goto('http://localhost:8080');
    await page.waitForTimeout(2000);
    
    console.log('Enabling Demo Mode...');
    // Find and click the Demo Mode checkbox - it's the second checkbox
    const checkboxes = await page.locator('input[type="checkbox"]').all();
    if (checkboxes.length >= 2) {
        await checkboxes[1].click(); // Second checkbox is Demo Mode
    }
    await page.waitForTimeout(500);
    
    console.log('Clicking Performance button...');
    await page.getByRole('button', { name: 'Performance' }).click();
    await page.waitForTimeout(500);
    
    console.log('Selecting Basic Operations...');
    await page.selectOption('select', 'Basic Operations');
    await page.waitForTimeout(500);
    
    console.log('Starting demo...');
    await page.getByRole('button', { name: 'Start' }).click();
    
    console.log('\nMonitoring performance metrics for 10 seconds...\n');
    
    // Monitor for 10 seconds, checking every second
    for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(1000);
        
        // Get performance metrics from the overlay
        const overlay = await page.locator('.performance-overlay');
        const overlayExists = await overlay.isVisible();
        
        let metrics: Record<string, string> | null = null;
        if (overlayExists) {
            metrics = {};
            const metricDivs = await page.locator('.performance-overlay .metric').all();
            for (const div of metricDivs) {
                const label = await div.locator('.metric-label').textContent();
                const value = await div.locator('.metric-value').textContent();
                if (label && value) {
                    metrics[label.replace(':', '').trim()] = value.trim();
                }
            }
        }
        
        if (metrics && Object.keys(metrics).length > 0) {
            console.log(`Time ${i+1}s:`, metrics);
            
            // Check for issues
            if (metrics['FPS'] === '0.0' || metrics['FPS'] === '0') {
                console.log('  ⚠️  FPS is showing 0!');
            }
            if (metrics['Ops/s'] === '0.0' || metrics['Ops/s'] === '0') {
                console.log('  ⚠️  Ops/s is showing 0!');
            }
        } else {
            console.log(`Time ${i+1}s: No metrics visible yet`);
        }
    }
    
    console.log('\nStopping demo...');
    await page.getByRole('button', { name: 'Stop' }).click();
    
    console.log('\nTest complete!');
    
    // Keep browser open for manual inspection
    console.log('Browser will remain open for inspection. Press Ctrl+C to exit.');
    await page.waitForTimeout(60000);
    
    await browser.close();
}

testPerformanceMetrics().catch(console.error);