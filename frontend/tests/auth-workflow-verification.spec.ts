import { test, expect } from '@playwright/test';

test.describe('Auth, Role Mapping & Dashboard Workflow Fixes Suite', () => {

  test('TC-AUTH-01: HOD Identity, Separation & Optional Email Verification', async ({ page }) => {
    // 1. Navigate to HOD login
    await page.goto('/login/hod');
    await expect(page.getByRole('heading', { name: /Department Head Login/i })).toBeVisible();

    // 2. Log in with official HOD email
    await page.fill('#login-email-input', 'hod.cce@sairam.edu.in');
    await page.fill('#login-password-input', 'cce@123');
    await page.click('#login-submit-button');

    // 3. Wait for redirect to /hod or /change-password
    await page.waitForURL((url) => url.pathname === '/change-password' || url.pathname === '/hod', { timeout: 15000 });

    if (page.url().includes('/change-password')) {
      await page.fill('#current-password', 'cce@123');
      await page.fill('#new-password', 'cce@hod_2026');
      await page.fill('#confirm-password', 'cce@hod_2026');
      await page.click('#change-password-submit-btn');
      await page.waitForURL(/\/hod/, { timeout: 15000 });
    }

    // 4. Verify HOD dashboard identity and elements
    await expect(page).toHaveURL(/\/hod/);
    await expect(page.locator('header').getByText('Dr. Pachaiammal Alias Priya')).toBeVisible();
    await expect(page.locator('header').getByText('hod.cce@sairam.edu.in')).toBeVisible();

    // 5. Verify NO Faculty Mentor Portal button exists in HOD header
    await expect(page.getByText(/Faculty Mentor Portal/i)).toHaveCount(0);

    // 6. Test Settings & Email Verification modal
    const settingsBtn = page.locator('#hod-settings-button');
    await expect(settingsBtn).toBeVisible();
    await settingsBtn.click();

    // Verify modal is displayed with all verification elements
    await expect(page.locator('#settings-modal-title')).toBeVisible();
    await expect(page.locator('#settings-email-display')).toHaveText('hod.cce@sairam.edu.in');
    await expect(page.locator('#verification-status-badge')).toBeVisible();

    // Close modal without blocking HOD functions
    await page.locator('#settings-modal-close').click();
    await expect(page.locator('#settings-modal-title')).toHaveCount(0);

    // Verify HOD dashboard remains fully functional and accessible
    await expect(page.getByRole('tab', { name: /Mentees/i })).toBeVisible();

    // 7. Test Proper Sign Out
    await page.getByRole('button', { name: /Sign out/i }).click();
    await page.waitForURL(/\/login/, { timeout: 10000 });

    // Verify signed out alert is displayed
    const signedOutAlert = page.locator('#signed-out-success-alert');
    await expect(signedOutAlert).toBeVisible();
    await expect(signedOutAlert).toContainText(/Signed out successfully/i);

    // Verify token is removed from client storage
    const token = await page.evaluate(() => localStorage.getItem('cce_achieve_token'));
    expect(token).toBeNull();

    // 8. Test Browser Back Button does NOT expose protected data
    await page.goBack();
    await page.waitForTimeout(1500);
    const tokenAfterBack = await page.evaluate(() => localStorage.getItem('cce_achieve_token'));
    expect(tokenAfterBack).toBeNull();
  });

  test('TC-AUTH-02: Student Dashboard — Exactly ONE Primary Submit Activity Button', async ({ page }) => {
    // 1. Navigate to student login
    await page.goto('/login/student');
    await page.fill('#login-email-input', 'sec25co031@sairamtap.edu.in');
    await page.fill('#login-password-input', 'cce@123');
    await page.click('#login-submit-button');

    await page.waitForURL((url) => url.pathname === '/change-password' || url.pathname === '/student', { timeout: 15000 });

    if (page.url().includes('/change-password')) {
      await page.fill('#current-password', 'cce@123');
      await page.fill('#new-password', 'cce@stud_2026');
      await page.fill('#confirm-password', 'cce@stud_2026');
      await page.click('#change-password-submit-btn');
      await page.waitForURL(/\/student/, { timeout: 15000 });
    }

    // 2. Verify on student dashboard
    await expect(page).toHaveURL(/\/student/);

    // 3. Verify exactly ONE visible Submit Activity button exists in the entire dashboard
    const headerSubmitBtn = page.locator('#student-header-submit-btn');
    await expect(headerSubmitBtn).toBeVisible();

    // Count all visible buttons whose text content is "Submit Activity"
    const submitButtons = page.getByRole('button', { name: /^Submit Activity$/i });
    await expect(submitButtons).toHaveCount(1);

    // 4. Click the single Submit Activity button to ensure submission modal opens properly
    await headerSubmitBtn.click();
    await expect(page.getByRole('heading', { name: /Submit Activity Points/i })).toBeVisible();

    // Close the modal
    const closeBtn = page.getByRole('button', { name: /Cancel|Close/i }).first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }

    // 5. Clean sign out
    const studentSignOut = page.locator('#student-header-signout');
    if (await studentSignOut.isVisible()) {
      await studentSignOut.click();
    } else {
      await page.click('button[aria-label="Open student navigation menu"]');
      await page.getByText(/Sign Out of Portal/i).click();
    }

    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page.locator('#signed-out-success-alert')).toBeVisible();
  });

  test('TC-AUTH-03: Faculty Mentor Optional Email Verification & Settings Modal', async ({ page }) => {
    // 1. Navigate to mentor login
    await page.goto('/login/mentor');
    await page.fill('#login-email-input', 'lekha.cce@sairam.edu.in');
    await page.fill('#login-password-input', 'cce@123');
    await page.click('#login-submit-button');

    await page.waitForURL((url) => url.pathname === '/change-password' || url.pathname === '/mentor', { timeout: 15000 });

    if (page.url().includes('/change-password')) {
      await page.fill('#current-password', 'cce@123');
      await page.fill('#new-password', 'cce@mentor_2026');
      await page.fill('#confirm-password', 'cce@mentor_2026');
      await page.click('#change-password-submit-btn');
      await page.waitForURL(/\/mentor/, { timeout: 15000 });
    }

    // 2. Verify on mentor dashboard
    await expect(page).toHaveURL(/\/mentor/);
    await expect(page.getByText('P. LEKHA').first()).toBeVisible();

    // 3. Open Settings Modal
    const settingsBtn = page.locator('#mentor-settings-button');
    await expect(settingsBtn).toBeVisible();
    await settingsBtn.click();

    // Verify Settings Modal contents
    await expect(page.locator('#settings-modal-title')).toBeVisible();
    await expect(page.locator('#settings-email-display')).toHaveText('nithish21077@gmail.com');
    await expect(page.locator('#verification-status-badge')).toBeVisible();

    // Close settings modal
    await page.locator('#settings-modal-close').click();
    await expect(page.locator('#settings-modal-title')).toHaveCount(0);

    // 4. Verify mentor is NOT blocked from doing reviews or accessing students
    await expect(page.getByText(/Assigned Mentees/i).or(page.getByText(/Mentee Directory/i))).toBeVisible();

    // 5. Sign out
    await page.getByRole('button', { name: /Sign out/i }).click();
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page.locator('#signed-out-success-alert')).toBeVisible();
  });

  test('TC-AUTH-04: Password Change Page Form Validation & Error Handling', async ({ page }) => {
    // 1. Go to student login
    await page.goto('/login/student');
    await page.fill('#login-email-input', 'sec25co032@sairamtap.edu.in');
    await page.fill('#login-password-input', 'cce@123');
    await page.click('#login-submit-button');

    await page.waitForURL((url) => url.pathname === '/change-password' || url.pathname === '/student', { timeout: 15000 });

    if (!page.url().includes('/change-password')) {
      await page.goto('/change-password');
      await page.waitForURL(/\/change-password/);
    }

    // 2. Verify no publicly visible plaintext default password hints
    await expect(page.locator('text=cce@123')).toHaveCount(0);

    // 3. Verify validation: mismatched new passwords
    await page.fill('#current-password', 'cce@123');
    await page.fill('#new-password', 'cce@newpass_1');
    await page.fill('#confirm-password', 'cce@mismatch_2');
    await page.click('#change-password-submit-btn');

    await expect(page.getByText(/do not match/i)).toBeVisible();

    // 4. Verify validation: same as current password
    await page.fill('#new-password', 'cce@123');
    await page.fill('#confirm-password', 'cce@123');
    await page.click('#change-password-submit-btn');

    await expect(page.getByText(/must be different from your current/i)).toBeVisible();

    // 5. Sign out from change password page
    const signoutBtn = page.locator('#change-password-header-signout');
    await expect(signoutBtn).toBeVisible();
    await signoutBtn.click();
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page.locator('#signed-out-success-alert')).toBeVisible();
  });

});
