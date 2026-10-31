import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { PAGES } from './helpers/viewports';

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'test-results', 'screenshots');

test.beforeAll(() => {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
});

test.describe('Tier 4: Regression Safety, Visual Baseline & RBAC Boundaries (R6, F17)', () => {
  test('TC-SAFE-01: No browser console errors or unhandled page exceptions during navigation across all pages', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore benign 401/404 fetch warnings or React DevTools message if any
        if (!text.includes('favicon.ico') && !text.includes('React DevTools')) {
          consoleErrors.push(text);
        }
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    for (const pageDef of PAGES) {
      await page.goto(pageDef.path);
      await page.waitForLoadState('networkidle');

      // Interact slightly with form inputs if present
      const emailInput = page.locator('input[type="email"], input[type="text"]').first();
      if (await emailInput.isVisible()) {
        await emailInput.fill('test@sairam.edu.in');
        await emailInput.clear();
      }
    }

    expect(
      pageErrors,
      `Unhandled page exceptions were caught: ${pageErrors.join('; ')}`
    ).toEqual([]);

    expect(
      consoleErrors,
      `Browser console errors were logged during navigation: ${consoleErrors.join('; ')}`
    ).toEqual([]);
  });

  test('TC-SAFE-02: Visual baseline screenshot capture of all 5 pages at 1366x768 and 1920x1080', async ({ page }) => {
    const resolutions = [
      { width: 1366, height: 768, label: '1366x768' },
      { width: 1920, height: 1080, label: '1920x1080' },
    ];

    for (const res of resolutions) {
      await page.setViewportSize({ width: res.width, height: res.height });

      for (const pageDef of PAGES) {
        await page.goto(pageDef.path);
        await page.waitForLoadState('networkidle');

        const screenshotPath = path.join(
          SCREENSHOT_DIR,
          `${pageDef.id}-${res.label}.png`
        );

        await page.screenshot({
          path: screenshotPath,
          fullPage: false, // Capture visible viewport to document no-scroll containment
        });

        expect(fs.existsSync(screenshotPath), `Screenshot should exist at ${screenshotPath}`).toBe(true);
      }
    }
  });

  test('TC-SAFE-03: Backend RBAC boundary enforcement: Unauthenticated requests to /api/v1/admin/* strictly return HTTP 401', async ({ request }) => {
    const backendBase = 'http://localhost:8000';

    // 1. Unauthenticated request to /api/v1/admin/overview
    const overviewResponse = await request.get(`${backendBase}/api/v1/admin/overview`);
    expect(overviewResponse.status()).toBe(401);

    const overviewJson = await overviewResponse.json();
    expect(overviewJson.detail).toContain('Not authenticated');

    // 2. Unauthenticated request to /api/v1/admin/students
    const studentsResponse = await request.get(`${backendBase}/api/v1/admin/students`);
    expect(studentsResponse.status()).toBe(401);

    const studentsJson = await studentsResponse.json();
    expect(studentsJson.detail).toContain('Not authenticated');
  });
});
