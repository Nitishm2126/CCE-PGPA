import { Page, expect } from '@playwright/test';
import { ViewportDefinition } from './viewports';

export interface OverflowResult {
  hasOverflow: boolean;
  docWidth: number;
  docScrollWidth: number;
  bodyScrollWidth: number;
  overflowingElements: string[];
}

export interface VerticalScrollResult {
  hasVerticalOverflow: boolean;
  scrollHeight: number;
  innerHeight: number;
  overflowPx: number;
}

export interface ElementViewportResult {
  selector: string;
  exists: boolean;
  visible: boolean;
  fullyInViewport: boolean;
  rect: { top: number; bottom: number; left: number; right: number; width: number; height: number } | null;
  clipping: { top: boolean; bottom: boolean; left: boolean; right: boolean };
}

export async function checkHorizontalOverflow(page: Page): Promise<OverflowResult> {
  return await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const docWidth = doc.clientWidth;
    const docScrollWidth = doc.scrollWidth;
    const bodyScrollWidth = body ? body.scrollWidth : 0;

    // Tolerance of 1px for browser sub-pixel rounding
    const hasDocOverflow = docScrollWidth > docWidth + 1;
    const hasBodyOverflow = bodyScrollWidth > docWidth + 1;

    const overflowingElements: string[] = [];
    const elements = document.querySelectorAll('*');
    for (const el of Array.from(elements)) {
      const rect = el.getBoundingClientRect();
      if (rect.right > docWidth + 1) {
        if (rect.width > 0 && rect.height > 0) {
          const id = el.id ? `#${el.id}` : '';
          const tag = el.tagName.toLowerCase();
          const cls = el.className && typeof el.className === 'string'
            ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
            : '';
          overflowingElements.push(`${tag}${id}${cls} (right: ${Math.round(rect.right)}px, max: ${docWidth}px)`);
        }
      }
    }

    return {
      hasOverflow: hasDocOverflow || hasBodyOverflow,
      docWidth,
      docScrollWidth,
      bodyScrollWidth,
      overflowingElements: overflowingElements.slice(0, 5),
    };
  });
}

export async function checkVerticalScrollContainment(page: Page): Promise<VerticalScrollResult> {
  return await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const scrollHeight = Math.max(doc.scrollHeight, body ? body.scrollHeight : 0);
    const innerHeight = window.innerHeight;
    const overflowPx = Math.max(0, scrollHeight - innerHeight);

    return {
      hasVerticalOverflow: scrollHeight > innerHeight,
      scrollHeight,
      innerHeight,
      overflowPx,
    };
  });
}

export async function checkElementsFullyInViewport(
  page: Page,
  selectors: string[]
): Promise<ElementViewportResult[]> {
  return await page.evaluate((selList) => {
    const innerHeight = window.innerHeight;
    const innerWidth = window.innerWidth;

    return selList.map((sel) => {
      const el = document.querySelector(sel);
      if (!el) {
        return {
          selector: sel,
          exists: false,
          visible: false,
          fullyInViewport: false,
          rect: null,
          clipping: { top: false, bottom: false, left: false, right: false },
        };
      }

      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const isVisible =
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        rect.width > 0 &&
        rect.height > 0;

      // Allow 1px tolerance for browser subpixel calculation
      const clippedTop = rect.top < -1;
      const clippedBottom = rect.bottom > innerHeight + 1;
      const clippedLeft = rect.left < -1;
      const clippedRight = rect.right > innerWidth + 1;

      return {
        selector: sel,
        exists: true,
        visible: isVisible,
        fullyInViewport: isVisible && !clippedTop && !clippedBottom && !clippedLeft && !clippedRight,
        rect: {
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
        clipping: {
          top: clippedTop,
          bottom: clippedBottom,
          left: clippedLeft,
          right: clippedRight,
        },
      };
    });
  }, selectors);
}

export async function checkLogoAspectRatio(page: Page) {
  const images = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('header img, main img'));
    return imgs.map((img) => ({
      src: img.src,
      alt: img.alt,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      clientWidth: img.clientWidth,
      clientHeight: img.clientHeight,
      visible: img.offsetParent !== null && img.clientWidth > 0 && img.clientHeight > 0,
    }));
  });

  return images;
}

export async function checkDepartmentNameExactness(page: Page, _viewport?: ViewportDefinition) {
  const deptElement = page.locator('#department-identity-name');
  await expect(deptElement).toBeVisible();

  const details = await deptElement.evaluate((el) => {
    const computed = window.getComputedStyle(el);
    const text = el.textContent || '';
    const rect = el.getBoundingClientRect();
    const parentRect = el.parentElement ? el.parentElement.getBoundingClientRect() : null;

    return {
      text: text.trim(),
      hasEllipsisText: text.includes('...'),
      textOverflow: computed.textOverflow,
      overflow: computed.overflow,
      overflowX: computed.overflowX,
      width: rect.width,
      height: rect.height,
      parentWidth: parentRect ? parentRect.width : 0,
      parentHeight: parentRect ? parentRect.height : 0,
      whiteSpace: computed.whiteSpace,
    };
  });

  return details;
}

export async function checkPortalCardsAlignment(page: Page, _viewport?: ViewportDefinition) {
  const cardStudent = page.locator('#portal-card-student');
  const cardMentor = page.locator('#portal-card-mentor');
  const cardHod = page.locator('#portal-card-hod');

  await expect(cardStudent).toBeVisible();
  await expect(cardMentor).toBeVisible();
  await expect(cardHod).toBeVisible();

  const boxes = await Promise.all([
    cardStudent.boundingBox(),
    cardMentor.boundingBox(),
    cardHod.boundingBox(),
  ]);

  return {
    student: boxes[0]!,
    mentor: boxes[1]!,
    hod: boxes[2]!,
  };
}
