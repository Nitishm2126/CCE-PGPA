import { test, expect } from '@playwright/test';

test.describe('Tier 2: Role Navigation Isolation (R2, F7-F8)', () => {
  const publicRoles = [
    { role: 'student', path: '/login/student', name: 'Student' },
    { role: 'mentor', path: '/login/mentor', name: 'Faculty Mentor' },
    { role: 'hod', path: '/login/hod', name: 'Department HOD' },
  ];

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  for (const { role, path, name } of publicRoles) {
    test(`TC-ROLE-0${role === 'student' ? '1' : role === 'mentor' ? '2' : '3'}: ${name} login page displays only public role switchers (Student, Mentor, HOD) and excludes Admin`, async ({ page }) => {
      await page.goto(path);

      // Verify breadcrumb back link
      const backLink = page.getByRole('link', { name: /Back to Portal Selection/i });
      await expect(backLink).toBeVisible();

      // Find all role switch links inside the role switcher bar (excluding back link)
      // Switch links have hrefs matching /login/student, /login/mentor, /login/hod, /login/admin
      const switchContainer = page.locator('main').locator('text=Switch:').locator('..');
      await expect(switchContainer).toBeVisible();

      const switchLinks = switchContainer.locator('a');
      const switchHrefs = await switchLinks.evaluateAll((links) =>
        links.map((a) => (a as HTMLAnchorElement).pathname)
      );

      // Verify Admin is NOT among the switcher links
      const hasAdminSwitch = switchHrefs.some((h) => h.includes('/admin'));
      expect(hasAdminSwitch, `Admin switch link found on ${path}: ${switchHrefs.join(', ')}`).toBe(false);

      // Verify public roles (Student, Mentor, HOD) are represented
      const textContent = (await switchContainer.textContent()) || '';
      expect(textContent).toContain('Student');
      expect(textContent).toContain('Mentor');
      expect(textContent).toContain('HOD');
      expect(textContent.toLowerCase()).not.toContain('admin');
    });
  }

  test('TC-ROLE-04: Admin login page completely suppresses public role switcher and exposes no switch links', async ({ page }) => {
    await page.goto('/login/admin');

    // 1. Role switcher label "Switch:" must NOT exist on Admin page
    const switchLabel = page.locator('main').locator('text=Switch:');
    await expect(switchLabel).toHaveCount(0);

    // 2. No links to /login/student, /login/mentor, or /login/hod should appear in the navigation bar
    const publicSwitchLinks = page.locator('main a[href*="/login/student"], main a[href*="/login/mentor"], main a[href*="/login/hod"]');
    await expect(publicSwitchLinks).toHaveCount(0);

    // 3. Subtle "Back to Portal Selection" link must still be present
    const backLink = page.getByRole('link', { name: /Back to Portal Selection/i });
    await expect(backLink).toBeVisible();
  });

  test('TC-ROLE-05: Back to Portal Selection navigates back to portal landing from all 4 login pages', async ({ page }) => {
    const allLoginPaths = ['/login/student', '/login/mentor', '/login/hod', '/login/admin'];

    for (const loginPath of allLoginPaths) {
      await page.goto(loginPath);

      const backLink = page.getByRole('link', { name: /Back to Portal Selection/i });
      await expect(backLink).toBeVisible();
      await backLink.click();

      await page.waitForURL(/(\/login|\/)$/);
      expect(page.url()).toMatch(/(\/login|\/)$/);
    }
  });
});
