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

  const pageCount = await page.evaluate(() => document.querySelectorAll('.page').length);
  console.log('Found', pageCount, 'pages');

  for (let i = 0; i < pageCount; i++) {
    await page.evaluate((idx) => {
      document.querySelectorAll('.page')[idx].scrollIntoView();
    }, i);
    await page.waitForTimeout(400);

    const clipBox = await page.evaluate((idx) => {
      const el = document.querySelectorAll('.page')[idx];
      const r = el.getBoundingClientRect();
      return { x: Math.max(0, r.left), y: Math.max(0, r.top), width: r.width, height: r.height };
    }, i);

    await page.screenshot({
      path: './crm-screenshots/all-page-' + String(i + 1).padStart(2, '0') + '.png',
      clip: clipBox
    });
    console.log('page', i + 1, 'done');
  }

  await browser.close();
  console.log('All done.');
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
