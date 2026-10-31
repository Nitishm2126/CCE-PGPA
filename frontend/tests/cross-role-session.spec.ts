import { test, expect } from '@playwright/test';

test.describe('Cross-Role Session Persistence & Isolation Suite', () => {
  test.beforeEach(async ({ page }) => {
    // Start with a clean browser context and 1440x900 viewport
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('TC-CROSS-01: Full Sequential Role Lifecycle — Student -> Logout -> Mentor -> Logout -> HOD -> Logout', async ({ page }) => {
    // -------------------------------------------------------------
    // STEP 1: Student Login
    // -------------------------------------------------------------
    await page.goto('/login/student');
    await expect(page.getByRole('heading', { name: /Student Portal Login/i })).toBeVisible();

    // Fill Student Credentials
    await page.fill('#login-email-input', 'sec25co031@sairamtap.edu.in');
    await page.fill('#login-password-input', 'cce@123');
    await page.click('#login-submit-button');

    // Student has mandatory first-time password change requirement, routing to /change-password
    await page.waitForURL(/(\/change-password|\/student)/, { timeout: 15000 });
    const currentUrl = page.url();

    // Verify token exists in localStorage
    const studentToken = await page.evaluate(() => localStorage.getItem('cce_achieve_token'));
    expect(studentToken).toBeTruthy();

    // -------------------------------------------------------------
    // STEP 2: Student Logout
    // -------------------------------------------------------------
    if (currentUrl.includes('/change-password')) {
      const headerSignOut = page.locator('#change-password-header-signout');
      await expect(headerSignOut).toBeVisible();
      await headerSignOut.click();
    } else {
      const studentSignOut = page.locator('#student-header-signout');
      if (await studentSignOut.isVisible()) {
        await studentSignOut.click();
      } else {
        await page.click('button[aria-label="Open student navigation menu"]');
        await page.getByText(/Sign Out of Portal/i).click();
      }
    }

    // Must return to /login
    await page.waitForURL(/\/login/, { timeout: 10000 });

    // Verify student token is completely purged from localStorage
    const tokenAfterStudentLogout = await page.evaluate(() => localStorage.getItem('cce_achieve_token'));
    expect(tokenAfterStudentLogout).toBeNull();

    // Verify Portal Selection shows all public institutional cards
    await expect(page.locator('#portal-card-student')).toBeVisible();
    await expect(page.locator('#portal-card-mentor')).toBeVisible();
    await expect(page.locator('#portal-card-hod')).toBeVisible();

    // -------------------------------------------------------------
    // STEP 3: Faculty Mentor Login after Student Logout
    // -------------------------------------------------------------
    await page.click('#portal-card-mentor');
    await page.waitForURL(/\/login\/mentor/, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: /Faculty Mentor Login/i })).toBeVisible();

    // Ensure NO active student session banner is displayed
    await expect(page.getByText(/Active Student Session Detected/i)).toHaveCount(0);

    // Fill Mentor Credentials
    await page.fill('#login-email-input', 'lekha.cce@sairam.edu.in');
    await page.fill('#login-password-input', 'cce@123');
    await page.click('#login-submit-button');

    // Route to /change-password or /mentor
    await page.waitForURL(/(\/change-password|\/mentor)/, { timeout: 15000 });

    // Verify new token exists in localStorage
    const mentorToken = await page.evaluate(() => localStorage.getItem('cce_achieve_token'));
    expect(mentorToken).toBeTruthy();
    expect(mentorToken).not.toEqual(studentToken);

    // -------------------------------------------------------------
    // STEP 4: Faculty Mentor Logout
    // -------------------------------------------------------------
    if (page.url().includes('/change-password')) {
      await page.click('#change-password-header-signout');
    } else {
      await page.getByRole('button', { name: /Sign out/i }).click();
    }

    await page.waitForURL(/\/login/, { timeout: 10000 });

    // Verify mentor token is completely purged
    const tokenAfterMentorLogout = await page.evaluate(() => localStorage.getItem('cce_achieve_token'));
    expect(tokenAfterMentorLogout).toBeNull();

    // -------------------------------------------------------------
    // STEP 5: Department HOD Login after Mentor Logout
    // -------------------------------------------------------------
    await page.click('#portal-card-hod');
    await page.waitForURL(/\/login\/hod/, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: /Department Head Login/i })).toBeVisible();

    // Ensure NO active session banner is displayed
    await expect(page.getByText(/Active Session Detected/i)).toHaveCount(0);

    // Fill HOD Credentials
    await page.fill('#login-email-input', 'hod.cce@sairam.edu.in');
    await page.fill('#login-password-input', 'cce@123');
    await page.click('#login-submit-button');

    // Route to /change-password or /hod
    await page.waitForURL(/(\/change-password|\/hod)/, { timeout: 15000 });

    // Verify new token exists in localStorage
    const hodToken = await page.evaluate(() => localStorage.getItem('cce_achieve_token'));
    expect(hodToken).toBeTruthy();
    expect(hodToken).not.toEqual(mentorToken);

    // -------------------------------------------------------------
    // STEP 6: Department HOD Logout
    // -------------------------------------------------------------
    if (page.url().includes('/change-password')) {
      await page.click('#change-password-header-signout');
    } else {
      await page.getByRole('button', { name: /Sign out/i }).click();
    }

    await page.waitForURL(/\/login/, { timeout: 10000 });

    // Verify HOD token is completely purged
    const tokenAfterHODLogout = await page.evaluate(() => localStorage.getItem('cce_achieve_token'));
    expect(tokenAfterHODLogout).toBeNull();
  });

  test('TC-CROSS-02: Role Mismatch Protection & 1-Click Switch Account on /login/[role]', async ({ page }) => {
    // 1. Log in as Student
    await page.goto('/login/student');
    await page.fill('#login-email-input', 'sec25co031@sairamtap.edu.in');
    await page.fill('#login-password-input', 'cce@123');
    await page.click('#login-submit-button');
    await page.waitForURL(/(\/change-password|\/student)/, { timeout: 15000 });

    // 2. Open /login/mentor directly while student session is active
    await page.goto('/login/mentor');
    await page.waitForURL(/\/login\/mentor/);

    // Verify Role Mismatch Alert is visible with explicit details
    const mismatchAlert = page.locator('div[role="alert"]');
    await expect(mismatchAlert).toBeVisible();
    await expect(mismatchAlert).toContainText(/Active Student Session Detected/i);
    await expect(mismatchAlert).toContainText(/NITISH M/i);

    // Verify 1-click switch button is present
    const switchBtn = page.locator('#switch-account-button');
    await expect(switchBtn).toBeVisible();
    await expect(switchBtn).toContainText(/Sign Out & Log In as Faculty Mentor/i);

    // 3. Click Switch Account
    await switchBtn.click();

    // Verify mismatch banner disappears and student token is removed
    await expect(page.locator('#switch-account-button')).toHaveCount(0);
    const stored = await page.evaluate(() => localStorage.getItem('cce_achieve_token'));
    expect(stored).toBeNull();

    // Verify clean mentor form is ready
    await expect(page.getByRole('heading', { name: /Faculty Mentor Login/i })).toBeVisible();
    await expect(page.locator('#login-email-input')).toHaveValue('');
    await expect(page.locator('#login-password-input')).toHaveValue('');
  });

  test('TC-CROSS-03: Dashboard Route Guards Prevent Cross-Role Hijacking & Loops', async ({ page }) => {
    // 1. Log in as Student
    await page.goto('/login/student');
    await page.fill('#login-email-input', 'sec25co031@sairamtap.edu.in');
    await page.fill('#login-password-input', 'cce@123');
    await page.click('#login-submit-button');
    await page.waitForURL(/(\/change-password|\/student)/, { timeout: 15000 });

    // 2. Attempt to navigate directly to /mentor dashboard
    await page.goto('/mentor');

    // Must redirect to /login/mentor (with role mismatch notice), NOT stay in /mentor or trigger infinite loops
    await page.waitForURL(/\/login\/mentor/, { timeout: 10000 });
    await expect(page.locator('#switch-account-button')).toBeVisible();

    // 3. Attempt to navigate directly to /hod dashboard
    await page.goto('/hod');
    await page.waitForURL(/\/login\/hod/, { timeout: 10000 });
    await expect(page.locator('#switch-account-button')).toBeVisible();

    // 4. Attempt to navigate directly to /admin console
    await page.goto('/admin');
    await page.waitForURL(/\/login\/admin/, { timeout: 10000 });
  });

  test('TC-CROSS-04: Mandatory Change-Password Page Offers Immediate Sign-Out / Switch', async ({ page }) => {
    // 1. Log in as Student with initial credentials
    await page.goto('/login/student');
    await page.fill('#login-email-input', 'sec25co031@sairamtap.edu.in');
    await page.fill('#login-password-input', 'cce@123');
    await page.click('#login-submit-button');
    await page.waitForURL(/(\/change-password|\/student)/, { timeout: 15000 });

    // Navigate to change-password
    await page.goto('/change-password');
    await page.waitForURL(/\/change-password/);

    // Verify header and card sign-out buttons are present
    const headerSignOut = page.locator('#change-password-header-signout');
    const cardSignOut = page.locator('#change-password-card-signout');
    await expect(headerSignOut).toBeVisible();
    await expect(cardSignOut).toBeVisible();

    // 2. Click Sign Out
    await cardSignOut.click();
    await page.waitForURL(/\/login/, { timeout: 10000 });

    // Verify session token is completely gone
    const stored = await page.evaluate(() => localStorage.getItem('cce_achieve_token'));
    expect(stored).toBeNull();
  });

  test('TC-CROSS-05: Back Button & Page Refresh Navigation After Logout', async ({ page }) => {
    // 1. Log in as Student
    await page.goto('/login/student');
    await page.fill('#login-email-input', 'sec25co031@sairamtap.edu.in');
    await page.fill('#login-password-input', 'cce@123');
    await page.click('#login-submit-button');
    await page.waitForURL(/(\/change-password|\/student)/, { timeout: 15000 });

    // 2. Refresh page while logged in — session remains active
    await page.reload();
    await page.waitForLoadState('networkidle');
    const tokenDuringActiveSession = await page.evaluate(() => localStorage.getItem('cce_achieve_token'));
    expect(tokenDuringActiveSession).toBeTruthy();

    // 3. Log out cleanly
    if (page.url().includes('/change-password')) {
      await page.click('#change-password-header-signout');
    } else {
      const studentSignOut = page.locator('#student-header-signout');
      if (await studentSignOut.isVisible()) {
        await studentSignOut.click();
      } else {
        await page.click('button[aria-label="Open student navigation menu"]');
        await page.getByText(/Sign Out of Portal/i).click();
      }
    }
    await page.waitForURL(/\/login/);

    // 4. Refresh page after logout — stays on login, no session restored
    await page.reload();
    await page.waitForLoadState('networkidle');
    const tokenAfterReload = await page.evaluate(() => localStorage.getItem('cce_achieve_token'));
    expect(tokenAfterReload).toBeNull();
    await expect(page.locator('#portal-card-student')).toBeVisible();

    // 5. Click browser Back button — protected routes must redirect back to login
    await page.goBack();
    await page.waitForURL(/(\/login|\/login\/student)/);
    const tokenAfterBack = await page.evaluate(() => localStorage.getItem('cce_achieve_token'));
    expect(tokenAfterBack).toBeNull();
  });

  test('TC-CROSS-06: Administrator Portal Remains Independent & Accessible', async ({ page }) => {
    await page.goto('/login');
    // Admin login accessed discreetly via bottom-left footer
    const adminLink = page.getByRole('link', { name: 'CCE PGPA Management System' });
    await expect(adminLink).toBeVisible();
    await adminLink.click();

    await page.waitForURL(/\/login\/admin/);
    await expect(page.getByRole('heading', { name: /Administrator Console Login/i })).toBeVisible();
    await expect(page.locator('#login-email-input')).toHaveAttribute('placeholder', /cce\.pgpa@gmail\.com/i);
  });
});
