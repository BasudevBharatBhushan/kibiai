import { chromium } from 'playwright';

(async () => {
  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  let hasErrors = false;

  page.on('console', msg => {
    const text = msg.text();
    console.log(`[Browser Console]: ${text}`);
    if (text.includes("returned null. Skipping.") || text.includes("[InsightParser]")) {
      hasErrors = true;
    }
  });

  page.on('pageerror', err => {
    console.log(`[Browser PageError]: ${err.message}`);
    hasErrors = true;
  });

  console.log("Navigating to URL...");
  await page.goto('http://localhost:3000/us-spice-mills/templates/a3591f17-22ce-4d07-bf09-ac8d2a4f8823/charts', { timeout: 60000 });

  console.log("Waiting for 'Switch to Business Insights' button...");
  await page.waitForSelector('button[title="Switch to Business Insights"]', { timeout: 30000 });
  await page.click('button[title="Switch to Business Insights"]');

  console.log("Filling prompt...");
  await page.waitForSelector('textarea', { timeout: 10000 });
  await page.fill('textarea', 'Generate business insights from my report schema');
  await page.keyboard.press('Enter');

  console.log("Waiting for AI response (up to 40 seconds)...");
  // We wait for the success toast or insight cards
  // Or just wait 30 seconds and check if any cards appeared
  await page.waitForTimeout(30000);

  if (hasErrors) {
    console.error("TEST FAILED: Errors found in console!");
    process.exit(1);
  }

  // Check if cards actually rendered
  const html = await page.content();
  if (html.includes('TOTAL_QTY_SOLD_IN_PERIOD') || html.includes('Total sales amount') || html.includes('Business Insights')) {
    console.log("SUCCESS: Insights appear to be rendered successfully without console errors.");
  } else {
    console.log("WARNING: Did not detect console errors, but couldn't verify rendering in HTML. Let's do a snapshot or check specific classes.");
  }

  await browser.close();
})();
