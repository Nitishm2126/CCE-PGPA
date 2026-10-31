import { test, expect } from '@playwright/test';
import { TARGET_MOBILE_VIEWPORTS, PAGES } from './helpers/viewports';
import { checkHorizontalOverflow } from './helpers/assertions';

test.describe('Tier 3: Mobile Responsiveness Constraints (R4, F15)', () => {
  for (const vp of TARGET_MOBILE_VIEWPORTS) {
    const testCaseId =
      vp.width === 360 ? 'TC-MOB-01' :
      vp.width === 375 ? 'TC-MOB-02' :
      vp.width === 390 ? 'TC-MOB-03' :
      vp.width === 412 ? 'TC-MOB-04' : 'TC-MOB-05';

    test.describe(`${testCaseId}: ${vp.name} (${vp.width}x${vp.height})`, () => {
      for (const pageDef of PAGES) {
        test(`Page ${pageDef.title} (${pageDef.path}) has zero horizontal overflow, natural vertical scrolling, and accessible touch targets`, async ({ page }) => {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await page.goto(pageDef.path);
          await page.waitForLoadState('networkidle');

          // 1. Zero Horizontal Overflow Assertion
          const horizontalMetrics = await checkHorizontalOverflow(page);
          expect(
            horizontalMetrics.hasOverflow,
            `Horizontal overflow detected on ${pageDef.title} at ${vp.width}x${vp.height}: elements ${horizontalMetrics.overflowingElements.join('; ')}`
          ).toBe(false);

          // 2. Natural Vertical Scrolling Check
          // On mobile, vertical scrolling must NOT be disabled with overflow-y: hidden on body/root
          const verticalScrollability = await page.evaluate(() => {
            const doc = document.documentElement;
            const body = document.body;
            const docStyle = window.getComputedStyle(doc);
            const bodyStyle = window.getComputedStyle(body);
            return {
              docOverflowY: docStyle.overflowY,
              bodyOverflowY: bodyStyle.overflowY,
              scrollHeight: doc.scrollHeight,
              innerHeight: window.innerHeight,
            };
          });

          expect(verticalScrollability.docOverflowY).not.toBe('hidden');
          expect(verticalScrollability.bodyOverflowY).not.toBe('hidden');

          // If content is taller than viewport, verify window can scroll down
          if (verticalScrollability.scrollHeight > verticalScrollability.innerHeight) {
            await page.evaluate(() => window.scrollTo(0, 100));
            const scrollPos = await page.evaluate(() => window.scrollY);
            expect(scrollPos, 'Page should be able to scroll vertically when content exceeds viewport').toBeGreaterThan(0);
          }

          // 3. Touch Target Minimum Size Check (>= 40px for buttons and primary inputs)
          const smallTargets = await page.evaluate(() => {
            const targets: string[] = [];
            const interactiveElements = document.querySelectorAll<HTMLElement>(
              'button[type="submit"], input[type="text"], input[type="email"], input[type="password"]'
            );

            for (const el of Array.from(interactiveElements)) {
              const rect = el.getBoundingClientRect();
              const isVisible = el.offsetParent !== null && rect.width > 0 && rect.height > 0;
              if (isVisible && rect.height < 38) {
                // Tolerance: 38px (allows 40px base with borders)
                targets.push(`${el.tagName.toLowerCase()}[${el.id || el.getAttribute('name') || 'unnamed'}] (height: ${Math.round(rect.height)}px)`);
              }
            }
            return targets;
          });

          expect(
            smallTargets.length,
            `Touch targets below 40px minimum height detected: ${smallTargets.join(', ')}`
          ).toBe(0);
        });
      }
    });
  }
});
