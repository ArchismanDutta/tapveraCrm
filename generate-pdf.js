const { chromium } = require('./server/node_modules/playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 794, height: 1123 });

  const htmlPath = path.resolve('./tapvera-marketing.html');
  const fileUrl = 'file:///' + htmlPath.split('\\').join('/');

  console.log('Loading:', fileUrl);
  await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(4000);

  const outPath = path.resolve('./Tapvera_CRM_Overview.pdf');

  await page.pdf({
    path: outPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
  });

  await browser.close();

  const size = fs.statSync(outPath).size;
  console.log('PDF generated:', outPath);
  console.log('File size:', (size / 1024 / 1024).toFixed(2), 'MB');
})().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
