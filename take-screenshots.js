/**
 * Tapvera CRM - Screenshot Capture Script
 * Run: node take-screenshots.js
 * Captures all key screens for the marketing PDF
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5173';
const SCREENSHOTS_DIR = path.join(__dirname, 'crm-screenshots');

// ── EDIT THESE CREDENTIALS ──────────────────────────────────────────────────
const LOGIN_EMAIL    = 'admin@tapvera.com';   // <-- your admin email
const LOGIN_PASSWORD = 'admin123';             // <-- your admin password
// ────────────────────────────────────────────────────────────────────────────

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const pages = [
  { name: '01-login',         path: '/login',               auth: false, desc: 'Login Page' },
  { name: '02-dashboard',     path: '/dashboard',           auth: true,  desc: 'Main Dashboard' },
  { name: '03-employees',     path: '/employees',           auth: true,  desc: 'Employee Management' },
  { name: '04-attendance',    path: '/attendance',          auth: true,  desc: 'Attendance Tracking' },
  { name: '05-projects',      path: '/projects',            auth: true,  desc: 'Project Management' },
  { name: '06-clients',       path: '/clients',             auth: true,  desc: 'Client Management' },
  { name: '07-leads',         path: '/leads',               auth: true,  desc: 'Lead Management' },
  { name: '08-callbacks',     path: '/callbacks',           auth: true,  desc: 'Callback Management' },
  { name: '09-tasks',         path: '/tasks',               auth: true,  desc: 'Task Management' },
  { name: '10-payslips',      path: '/payslip',             auth: true,  desc: 'Payslip Management' },
  { name: '11-leaves',        path: '/leaves',              auth: true,  desc: 'Leave Management' },
  { name: '12-chat',          path: '/chat',                auth: true,  desc: 'Team Chat' },
  { name: '13-analytics',     path: '/analytics',           auth: true,  desc: 'Analytics' },
  { name: '14-hr-dashboard',  path: '/hr-dashboard',        auth: true,  desc: 'HR Dashboard' },
  { name: '15-salary',        path: '/salary-management',   auth: true,  desc: 'Salary Management' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  console.log('Starting screenshot capture...\n');

  // ── 1. Login page (public)
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-login.png'), fullPage: false });
    console.log('✓ 01-login.png');
  } catch (e) {
    console.log('✗ login page error:', e.message);
  }

  // ── 2. Log in
  let loggedIn = false;
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1500);

    // Try common email/password field selectors
    const emailInput = await page.$('input[type="email"], input[name="email"], input[placeholder*="email" i], input[placeholder*="Email" i]');
    const passInput  = await page.$('input[type="password"]');

    if (emailInput && passInput) {
      await emailInput.fill(LOGIN_EMAIL);
      await passInput.fill(LOGIN_PASSWORD);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(4000);
      loggedIn = true;
      console.log('✓ Logged in\n');
    } else {
      console.log('✗ Could not find login fields — skipping authenticated pages\n');
    }
  } catch (e) {
    console.log('✗ Login failed:', e.message, '\n');
  }

  // ── 3. Capture authenticated pages
  if (loggedIn) {
    for (const pg of pages.filter(p => p.auth)) {
      try {
        await page.goto(`${BASE_URL}${pg.path}`, { waitUntil: 'networkidle', timeout: 20000 });
        await page.waitForTimeout(3000);

        // Hide any loading spinners
        await page.evaluate(() => {
          document.querySelectorAll('[class*="loading"], [class*="spinner"]').forEach(el => {
            el.style.display = 'none';
          });
        });

        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, `${pg.name}.png`),
          fullPage: false,
        });
        console.log(`✓ ${pg.name}.png  —  ${pg.desc}`);
      } catch (e) {
        console.log(`✗ ${pg.name} (${pg.desc}):`, e.message);
      }
    }
  }

  await browser.close();

  // ── 4. List captured files
  const files = fs.readdirSync(SCREENSHOTS_DIR).filter(f => f.endsWith('.png'));
  console.log(`\nDone! ${files.length} screenshot(s) saved to: ${SCREENSHOTS_DIR}`);
  console.log('\nFiles:\n' + files.map(f => `  • ${f}`).join('\n'));
})();
