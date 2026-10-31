import { test, expect } from '@playwright/test';
import { TARGET_DESKTOP_VIEWPORTS, PAGES } from './helpers/viewports';
import { checkVerticalScrollContainment, checkHorizontalOverflow, checkElementsFullyInViewport } from './helpers/assertions';

test.describe('Tier 3: Desktop Viewport No-Scroll Containment (R3, F9-F14)', () => {
  for (const vp of TARGET_DESKTOP_VIEWPORTS) {
    const testCaseId =
      vp.width === 1920 ? 'TC-DESK-01' :
      vp.width === 1440 ? 'TC-DESK-02' :
      vp.width === 1366 ? 'TC-DESK-03' : 'TC-DESK-04';

    test.describe(`${testCaseId}: ${vp.name} (${vp.width}x${vp.height})`, () => {
      for (const pageDef of PAGES) {
        test(`Page ${pageDef.title} (${pageDef.path}) fits without scrollbars and elements unclipped`, async ({ page }) => {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await page.goto(pageDef.path);
          await page.waitForLoadState('networkidle');

          // 1. Vertical Containment Assertion: doc.scrollHeight <= window.innerHeight
          const verticalMetrics = await checkVerticalScrollContainment(page);
          expect(
            verticalMetrics.scrollHeight,
            `Vertical overflow detected on ${pageDef.title} at ${vp.width}x${vp.height}: scrollHeight=${verticalMetrics.scrollHeight}px exceeds innerHeight=${verticalMetrics.innerHeight}px by +${verticalMetrics.overflowPx}px`
          ).toBeLessThanOrEqual(verticalMetrics.innerHeight);

          // 2. Horizontal Containment Assertion: doc.scrollWidth <= window.innerWidth
          const horizontalMetrics = await checkHorizontalOverflow(page);
          expect(
            horizontalMetrics.hasOverflow,
            `Horizontal overflow detected on ${pageDef.title} at ${vp.width}x${vp.height}: elements ${horizontalMetrics.overflowingElements.join('; ')}`
          ).toBe(false);

          // 3. Verify no layout cheating via overflow:hidden on body or html
          const overflowStyles = await page.evaluate(() => {
            const docStyle = window.getComputedStyle(document.documentElement);
            const bodyStyle = window.getComputedStyle(document.body);
            return {
              htmlOverflowY: docStyle.overflowY,
              bodyOverflowY: bodyStyle.overflowY,
            };
          });
          expect(overflowStyles.htmlOverflowY, 'html element should not force overflowY: hidden').not.toBe('hidden');
          expect(overflowStyles.bodyOverflowY, 'body element should not force overflowY: hidden').not.toBe('hidden');

          // 4. Element Visibility Assertions (Header, Branding, Login Card / Main Content, Footer)
          const targetSelectors = ['header', 'footer'];
          if (pageDef.path !== '/') {
            targetSelectors.push('button[type="submit"]');
          }

          const elementsStatus = await checkElementsFullyInViewport(page, targetSelectors);
          for (const el of elementsStatus) {
            if (el.exists) {
              expect(
                el.fullyInViewport,
                `Element '${el.selector}' is clipped or outside viewport on ${pageDef.title} at ${vp.width}x${vp.height}: clipping=${JSON.stringify(el.clipping)}, rect=${JSON.stringify(el.rect)}`
              ).toBe(true);
            }
          }
        });
      }
    });
  }
});
