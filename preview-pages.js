const { chromium } = require('./server/node_modules/playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1600, height: 900 });

  const htmlPath = path.resolve('./tapvera-marketing.html');
  const fileUrl = 'file:///' + htmlPath.split('\\').join('/');

  await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Get list of all .page elements and screenshot each
  const pageCount = await page.evaluate(() => document.querySelectorAll('.page').length);
  console.log('Found', pageCount, 'pages');

  for (let i = 0; i < Math.min(pageCount, 4); i++) {
    const box = await page.evaluate((idx) => {
      const el = document.querySelectorAll('.page')[idx];
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y + window.scrollY, width: r.width, height: r.height };
    }, i);

    // Scroll to the element
    await page.evaluate((idx) => {
      document.querySelectorAll('.page')[idx].scrollIntoView();
    }, i);
    await page.waitForTimeout(500);

    const clipBox = await page.evaluate((idx) => {
      const el = document.querySelectorAll('.page')[idx];
      const r = el.getBoundingClientRect();
      return { x: Math.max(0, r.left), y: Math.max(0, r.top), width: r.width, height: r.height };
    }, i);

    await page.screenshot({
      path: './crm-screenshots/preview-page-' + (i + 1) + '.png',
      clip: clipBox
    });
    console.log('Saved preview-page-' + (i + 1) + '.png  (' + Math.round(clipBox.width) + 'x' + Math.round(clipBox.height) + ')');
  }

  await browser.close();
  console.log('Done.');
})().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
