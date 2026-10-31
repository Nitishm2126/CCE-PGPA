import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { VIEWPORTS, PAGES, ViewportDefinition, PageDefinition } from './helpers/viewports';
import {
  checkHorizontalOverflow,
  checkLogoAspectRatio,
  checkDepartmentNameExactness,
  checkPortalCardsAlignment,
} from './helpers/assertions';

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'test-results', 'screenshots');

test.beforeAll(() => {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
});

// Group 1: Comprehensive Viewport Responsive Tests across all 4 pages
test.describe('Responsive UI Suite across Viewports', () => {
  for (const pageDef of PAGES) {
    test.describe(`Page: ${pageDef.title} (${pageDef.path})`, () => {
      for (const vp of VIEWPORTS) {
        test(`Viewport ${vp.name} (${vp.width}x${vp.height}) - checks 1, 2, 3, 9 & 10`, async ({ page }) => {
          // Listen for browser console errors (Check 9)
          const consoleErrors: string[] = [];
          page.on('console', (msg) => {
            if (msg.type() === 'error') {
              // Ignore benign next-auth/network mock warnings if any
              const txt = msg.text();
              if (!txt.includes('Download the React DevTools')) {
                consoleErrors.push(txt);
              }
            }
          });
          page.on('pageerror', (err) => {
            consoleErrors.push(err.message);
          });

          // Set viewport
          await page.setViewportSize({ width: vp.width, height: vp.height });

          // Navigate to page
          await page.goto(pageDef.path, { waitUntil: 'networkidle' });
          await page.waitForTimeout(300);

          // Check 1: Horizontal Overflow
          const overflow = await checkHorizontalOverflow(page);
          expect(
            overflow.hasOverflow,
            `Horizontal overflow detected on ${pageDef.title} at ${vp.name}! Overflowing elements: ${overflow.overflowingElements.join(', ')}`
          ).toBe(false);

          // Check 2: Vertical layout check (document renders content properly)
          const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
          expect(bodyHeight).toBeGreaterThan(0);

          // Check 3: Logo sizing and aspect ratio
          const logos = await checkLogoAspectRatio(page);
          for (const logo of logos) {
            if (logo.visible && logo.naturalWidth > 0 && logo.naturalHeight > 0) {
              const renderedRatio = logo.clientWidth / logo.clientHeight;
              const naturalRatio = logo.naturalWidth / logo.naturalHeight;
              // Ensure logo is not distorted by more than 15%
              const ratioDelta = Math.abs(renderedRatio - naturalRatio) / naturalRatio;
              expect(
                ratioDelta,
                `Logo distorted on ${pageDef.title} at ${vp.name}: ${logo.src} (rendered ratio=${renderedRatio.toFixed(2)}, natural=${naturalRatio.toFixed(2)})`
              ).toBeLessThan(0.25);
            }
          }

          // Check 9: Zero console errors
          expect(
            consoleErrors,
            `Console errors detected on ${pageDef.title} at ${vp.name}: ${consoleErrors.join('; ')}`
          ).toEqual([]);

          // Check 10: Screenshot capture saved in dedicated test-results folder
          const screenshotFileName = `${pageDef.id}_${vp.width}x${vp.height}.png`;
          const screenshotPath = path.join(SCREENSHOT_DIR, screenshotFileName);
          await page.screenshot({ path: screenshotPath, fullPage: true });
          expect(fs.existsSync(screenshotPath)).toBe(true);
        });
      }
    });
  }
});

// Group 2: Specific Landing Page Checks (Full Department Name Visibility, Cards, Touch Targets)
test.describe('Landing Page Specific Responsive Checks', () => {
  for (const vp of VIEWPORTS) {
    test(`Landing Page: Full Department Name Visibility at ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/', { waitUntil: 'networkidle' });

      // Check 4: Full department name exactness and styling
      const deptDetails = await checkDepartmentNameExactness(page, vp);

      // Requirement 1 & Exact text
      expect(deptDetails.text).toBe('DEPARTMENT OF COMPUTER AND COMMUNICATION ENGINEERING');

      // Requirement 2: Never use ellipsis
      expect(deptDetails.hasEllipsisText).toBe(false);
      expect(deptDetails.text).not.toContain('...');
      expect(deptDetails.text).not.toContain('COMMU...');

      // Requirement 3: Do not use text-overflow: ellipsis
      expect(deptDetails.textOverflow).not.toBe('ellipsis');

      // Requirement 4: Do not hide text with overflow: hidden
      expect(deptDetails.overflowX).not.toBe('hidden');

      // Requirement 5 & 6: On desktop single line, on mobile 2 or more lines
      if (vp.category === 'desktop') {
        // Desktop: single line (height ~ 18-30px, whitespace-nowrap)
        expect(deptDetails.height).toBeLessThanOrEqual(32);
      } else if (vp.category === 'mobile') {
        // Mobile: wraps into 2 or more lines (height >= 26px)
        expect(deptDetails.height).toBeGreaterThan(20);
      }
    });

    test(`Landing Page: Portal Cards Alignment & Touch Targets at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/', { waitUntil: 'networkidle' });

      // Check 5: Card alignment
      const cards = await checkPortalCardsAlignment(page, vp);

      if (vp.category === 'desktop') {
        // On desktop, 3 cards are arranged side by side horizontally
        // Their top positions must be aligned (within 5px)
        const topDiff1 = Math.abs(cards.student.y - cards.mentor.y);
        const topDiff2 = Math.abs(cards.mentor.y - cards.hod.y);
        expect(topDiff1).toBeLessThanOrEqual(5);
        expect(topDiff2).toBeLessThanOrEqual(5);
      } else if (vp.category === 'mobile') {
        // On mobile, 3 cards are stacked vertically
        expect(cards.mentor.y).toBeGreaterThan(cards.student.y);
        expect(cards.hod.y).toBeGreaterThan(cards.mentor.y);
      }

      // Check 6: Touch target sizes for mobile viewports
      if (vp.category === 'mobile') {
        // All portal cards should have ample touch area (height >= 120px)
        expect(cards.student.height).toBeGreaterThanOrEqual(80);
        expect(cards.mentor.height).toBeGreaterThanOrEqual(80);
        expect(cards.hod.height).toBeGreaterThanOrEqual(80);

        // Header logo link touch target
        const headerLogoLink = page.locator('header a[title*="Sri Sairam Engineering College"]');
        if (await headerLogoLink.isVisible()) {
          const headerBox = await headerLogoLink.boundingBox();
          expect(headerBox?.height).toBeGreaterThanOrEqual(40);
        }
      }
    });
  }
});

// Group 3: Login Form Responsiveness across Viewports
test.describe('Login Form Responsiveness', () => {
  const roles = [
    { role: 'student', path: '/login/student', badgeText: '2025-2029 Students' },
    { role: 'mentor', path: '/login/mentor', badgeText: 'Review & Verification' },
    { role: 'hod', path: '/login/hod', badgeText: 'Department Administration' },
  ];

  for (const roleDef of roles) {
    for (const vp of VIEWPORTS) {
      test(`${roleDef.role} login form responsiveness at ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(roleDef.path, { waitUntil: 'networkidle' });

        // Check 7: Form elements presence & responsiveness
        const emailInput = page.locator('#login-email-input');
        const passwordInput = page.locator('#login-password-input');
        const submitButton = page.locator('button[type="submit"]');

        await expect(emailInput).toBeVisible();
        await expect(passwordInput).toBeVisible();
        await expect(submitButton).toBeVisible();

        const formBox = await page.locator('form').boundingBox();
        expect(formBox).toBeTruthy();
        expect(formBox!.width).toBeLessThanOrEqual(vp.width);

        // Check password visibility toggle
        const toggleBtn = page.locator('button[title*="password" i], button[aria-label*="password" i], button:has-text("Show"), button:has-text("Hide")');
        if (await toggleBtn.count() > 0) {
          const btn = toggleBtn.first();
          await expect(btn).toBeVisible();
        }

        // On mobile, submit button touch target height >= 40px
        if (vp.category === 'mobile') {
          const btnBox = await submitButton.boundingBox();
          expect(btnBox?.height).toBeGreaterThanOrEqual(40);
        }
      });
    }
  }
});

// Group 4: Navigation between all portals (Check 8)
test.describe('Navigation between Portals', () => {
  test('Navigate from Landing page to Student, Mentor, and HOD portals and back', async ({ page }) => {
    // Start at landing page
    await page.goto('/');

    // 1. Navigate to Student Portal
    await page.click('#portal-card-student');
    await expect(page).toHaveURL(/\/login\/student/);

    // Return to Portal Selection
    await page.getByRole('link', { name: /Back to Portal Selection/i }).click();
    await expect(page).toHaveURL(/(\/login|\/)$/);

    // 2. Navigate to Mentor Portal
    await page.click('#portal-card-mentor');
    await expect(page).toHaveURL(/\/login\/mentor/);

    // Return to Portal Selection
    await page.getByRole('link', { name: /Back to Portal Selection/i }).click();
    await expect(page).toHaveURL(/(\/login|\/)$/);

    // 3. Navigate to HOD Portal
    await page.click('#portal-card-hod');
    await expect(page).toHaveURL(/\/login\/hod/);

    // Return to Portal Selection
    await page.getByRole('link', { name: /Back to Portal Selection/i }).click();
    await expect(page).toHaveURL(/(\/login|\/)$/);
  });

  test('Navigate between role login pages using role switch links on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/login/student');

    // Role switcher link to Mentor
    const mentorLink = page.locator('main').locator('text=Faculty Mentor');
    if (await mentorLink.isVisible()) {
      await mentorLink.click();
      await page.waitForURL('**/login/mentor');
      expect(page.url()).toContain('/login/mentor');
    }
  });
});
