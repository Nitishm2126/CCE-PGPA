import { test, expect } from '@playwright/test';

test.describe('Tier 1: Brand Title & Hidden Admin Access (R1, F1-F6)', () => {
  const brandTitleSelector = '#cce-pgpa-brand-title, #brand-title-admin-trigger';

  test.beforeEach(async ({ page }) => {
    // Set standard desktop viewport for branding tests
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('TC-BRAND-01: Displays "CCE PGPA" branding while preserving institutional identity', async ({ page }) => {
    await page.goto('/');

    // 1. Verify "CCE PGPA" branding heading is present
    const heading = page.locator('h1');
    await expect(heading).toContainText(/CCE PGPA/i);

    // 2. Verify Department identity
    const deptContainer = page.locator('#department-identity-container');
    await expect(deptContainer).toBeVisible();
    const deptName = page.locator('#department-identity-name');
    await expect(deptName).toContainText('DEPARTMENT OF COMPUTER AND COMMUNICATION ENGINEERING');

    // 3. Verify Subtitle and Tagline
    await expect(page.locator('text=PGPA MANAGEMENT SYSTEM')).toBeVisible();
    await expect(page.locator('text="Academic Performance. Structured. Simplified."')).toBeVisible();

    // 4. Verify institutional header branding (emblems/logos)
    const headerImages = page.locator('header img');
    await expect(headerImages.first()).toBeVisible();

    // 5. Verify footer presence
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
  });

  test('TC-BRAND-02: Public Admin card is removed and zero occurrences of "Admin" appear on landing page', async ({ page }) => {
    await page.goto('/');

    // 1. Verify #portal-card-admin is not present in the DOM
    const adminCard = page.locator('#portal-card-admin');
    await expect(adminCard).toHaveCount(0);

    // 2. Verify only 3 public portal cards are present (Student, Mentor, HOD)
    const studentCard = page.locator('#portal-card-student');
    const mentorCard = page.locator('#portal-card-mentor');
    const hodCard = page.locator('#portal-card-hod');

    await expect(studentCard).toBeVisible();
    await expect(mentorCard).toBeVisible();
    await expect(hodCard).toBeVisible();

    // 3. Verify zero occurrences of the word "Admin" or "Administrator" on the public landing page
    const visibleTexts = await page.evaluate(() => {
      // Collect visible text from main content, cards, badges, headings, and footer
      const body = document.body;
      const text = body ? body.innerText : '';
      const matches = text.match(/\b(admin|administrator)\b/gi) || [];
      return {
        count: matches.length,
        matches,
      };
    });

    expect(visibleTexts.count, `Found unexpected "Admin" occurrences on public landing page: ${JSON.stringify(visibleTexts.matches)}`).toBe(0);
  });

  test('TC-BRAND-03: Hidden Admin Access navigates to /login/admin on mouse click', async ({ page }) => {
    await page.goto('/');

    // Locate the interactive brand title
    const brandTitle = page.locator(brandTitleSelector);
    await expect(brandTitle, 'Brand title trigger must be present in DOM').toBeVisible();

    // Click the brand title
    await brandTitle.click();

    // Verify navigation to Admin login route
    await page.waitForURL('**/login/admin');
    await expect(page).toHaveURL(/\/login\/admin/);
    await expect(page.locator('h2, [data-role-badge]')).toContainText(/Admin/i);
  });

  test('TC-BRAND-04: Hidden Admin Access navigates to /login/admin via keyboard Enter key', async ({ page }) => {
    await page.goto('/');

    const brandTitle = page.locator(brandTitleSelector);
    await expect(brandTitle).toBeVisible();

    // Focus the interactive brand element
    await brandTitle.focus();
    await expect(brandTitle).toBeFocused();

    // Trigger Enter key activation
    await page.keyboard.press('Enter');

    // Verify navigation to Admin login route
    await page.waitForURL('**/login/admin');
    await expect(page).toHaveURL(/\/login\/admin/);
  });

  test('TC-BRAND-05: Hidden Admin Access navigates to /login/admin via keyboard Space key', async ({ page }) => {
    await page.goto('/');

    const brandTitle = page.locator(brandTitleSelector);
    await expect(brandTitle).toBeVisible();

    // Focus the interactive brand element
    await brandTitle.focus();
    await expect(brandTitle).toBeFocused();

    // Trigger Space key activation
    await page.keyboard.press('Space');

    // Verify navigation to Admin login route
    await page.waitForURL('**/login/admin');
    await expect(page).toHaveURL(/\/login\/admin/);
  });

  test('TC-BRAND-06: Interactive brand title satisfies accessibility semantics and micro-interaction styling', async ({ page }) => {
    await page.goto('/');

    const brandTitle = page.locator(brandTitleSelector);
    await expect(brandTitle).toBeVisible();

    const semantics = await brandTitle.evaluate((el) => {
      const tag = el.tagName.toLowerCase();
      const role = el.getAttribute('role');
      const ariaLabel = el.getAttribute('aria-label');
      const href = el.getAttribute('href');
      const tabIndex = el.getAttribute('tabindex');
      const computed = window.getComputedStyle(el);
      const isInteractive = tag === 'a' || tag === 'button' || role === 'button' || role === 'link' || tabIndex === '0';

      return {
        tag,
        role,
        ariaLabel,
        href,
        tabIndex,
        isInteractive,
        cursor: computed.cursor,
        transition: computed.transition,
      };
    });

    // Must be semantically interactive
    expect(semantics.isInteractive, 'Brand title element must be semantic a/button or have interactive role/tabindex').toBe(true);

    // Must have accessible label
    expect(semantics.ariaLabel || semantics.href).toBeTruthy();

    // Pointer cursor should be present
    expect(semantics.cursor).toBe('pointer');
  });
});
