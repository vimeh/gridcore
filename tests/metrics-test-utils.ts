import { Page, test } from "@playwright/test";

/**
 * Helper function to check if metrics feature is enabled
 */
export async function hasMetricsFeature(page: Page): Promise<boolean> {
  // Check if the metrics button exists (only present when perf feature is enabled)
  const metricsButton = await page.$("button:has-text('Show Metrics')");
  return metricsButton !== null;
}

/**
 * Skip test if metrics feature is not enabled
 */
export async function skipIfNoMetrics(page: Page) {
  const hasMetrics = await hasMetricsFeature(page);
  if (!hasMetrics) {
    test.skip(true, "Metrics feature not enabled");
  }
}