# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth-workflow-verification.spec.ts >> Auth, Role Mapping & Dashboard Workflow Fixes Suite >> TC-AUTH-01: HOD Identity, Separation & Optional Email Verification
- Location: tests\auth-workflow-verification.spec.ts:5:7

# Error details

```
TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
============================================================
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - generic [ref=e3]:
      - generic [ref=e6]:
        - link "Sri Sairam Engineering College Crest Sri Sairam Engineering College Autonomous Institution Anna University Affiliated NBA & NAAC 'A+'" [ref=e8] [cursor=pointer]:
          - /url: /
          - img "Sri Sairam Engineering College Crest" [ref=e10]
          - generic [ref=e11]:
            - generic [ref=e12]: Sri Sairam Engineering College
            - generic [ref=e13]:
              - generic [ref=e14]: Autonomous Institution
              - generic [aria-hidden] [ref=e15]: •
              - generic [ref=e16]: Anna University Affiliated
              - generic [aria-hidden] [ref=e17]: •
              - generic [ref=e18]: NBA & NAAC 'A+'
        - generic [ref=e19]:
          - button "Switch to dark mode" [ref=e20] [cursor=pointer]
          - img "Sri Sairam Institutions Logo" [ref=e24]
      - generic [ref=e26]:
        - generic [ref=e27]: DEPARTMENT OF COMPUTER AND COMMUNICATION ENGINEERING
        - generic [ref=e30]:
          - heading "CCE PGPA" [level=1] [ref=e31]
          - paragraph [ref=e32]: PGPA MANAGEMENT SYSTEM
        - paragraph [ref=e33]: “Academic Performance. Structured. Simplified.”
      - main [ref=e34]:
        - generic [ref=e35]:
          - link "← Back to Portal Selection" [ref=e36] [cursor=pointer]:
            - /url: /login
            - generic [ref=e37]: ←
            - generic [ref=e38]: Back to Portal Selection
          - generic [ref=e39]:
            - generic [ref=e40]: "Switch:"
            - link "Student" [ref=e41] [cursor=pointer]:
              - /url: /login/student
            - link "Faculty Mentor" [ref=e42] [cursor=pointer]:
              - /url: /login/mentor
            - link "Department HOD" [ref=e43]:
              - /url: /login/hod
        - generic [ref=e44]:
          - generic [ref=e46]:
            - generic [ref=e47]:
              - generic [ref=e52]:
                - heading "Department Head Login" [level=3] [ref=e53]
                - paragraph [ref=e54]: Authorized institutional access
              - generic [ref=e55]: Head of Department
            - paragraph [ref=e57]: Monitor department-wide performance, mentor activity and PGPA progress.
          - alert [ref=e58]:
            - generic [ref=e62]:
              - paragraph [ref=e63]: Authentication Error
              - paragraph [ref=e64]: Invalid email or password. Please verify your credentials.
          - generic [ref=e65]:
            - generic [ref=e66]:
              - generic [ref=e67]: Official College Email
              - textbox "Official College Email" [ref=e69]:
                - /placeholder: e.g. hod.cce@sairam.edu.in
                - text: hod.cce@sairam.edu.in
            - generic [ref=e70]:
              - generic [ref=e71]:
                - generic [ref=e72]: Account Password
                - link "Forgot password?" [ref=e73] [cursor=pointer]:
                  - /url: /forgot-password
              - generic [ref=e74]:
                - textbox "Account Password" [ref=e75]:
                  - /placeholder: Enter your account password
                  - text: cce@123
                - button "Show password" [ref=e76] [cursor=pointer]
            - button "Login as Department HOD" [ref=e81] [cursor=pointer]
          - paragraph [ref=e84]:
            - strong [ref=e85]: "Authorized Access Only:"
            - text: Cohort accounts are provisioned via verified departmental rosters. Public self-registration is disabled.
      - generic [ref=e87]:
        - generic [ref=e88]:
          - generic [ref=e89]:
            - img "Founder Chairman MJF. Ln. Leo Muthu" [ref=e91]
            - generic [ref=e92]:
              - generic [ref=e93]: MJF. Ln. Leo Muthu
              - generic [ref=e94]: Founder Chairman • Sri Sairam Group of Institutions
          - generic [ref=e95]:
            - generic [ref=e96]: Designed & Developed by
            - generic [ref=e97]: FINEWORKS
        - generic [ref=e100]:
          - generic [ref=e101]:
            - link "CCE PGPA Management System" [ref=e102] [cursor=pointer]:
              - /url: /login/admin
            - generic [aria-hidden] [ref=e103]: •
            - generic [ref=e104]: Department of Computer and Communication Engineering
            - generic [aria-hidden] [ref=e105]: •
            - generic [ref=e106]: Sri Sairam Engineering College (Autonomous)
          - generic [ref=e107]: Version 1.0.0
  - button "Open Next.js Dev Tools" [ref=e114] [cursor=pointer]
  - alert [ref=e118]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('Auth, Role Mapping & Dashboard Workflow Fixes Suite', () => {
  4   | 
  5   |   test('TC-AUTH-01: HOD Identity, Separation & Optional Email Verification', async ({ page }) => {
  6   |     // 1. Navigate to HOD login
  7   |     await page.goto('/login/hod');
  8   |     await expect(page.getByRole('heading', { name: /Department Head Login/i })).toBeVisible();
  9   | 
  10  |     // 2. Log in with official HOD email
  11  |     await page.fill('#login-email-input', 'hod.cce@sairam.edu.in');
  12  |     await page.fill('#login-password-input', 'cce@123');
  13  |     await page.click('#login-submit-button');
  14  | 
  15  |     // 3. Wait for redirect to /hod or /change-password
> 16  |     await page.waitForURL((url) => url.pathname === '/change-password' || url.pathname === '/hod', { timeout: 15000 });
      |                ^ TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
  17  | 
  18  |     if (page.url().includes('/change-password')) {
  19  |       await page.fill('#current-password', 'cce@123');
  20  |       await page.fill('#new-password', 'cce@hod_2026');
  21  |       await page.fill('#confirm-password', 'cce@hod_2026');
  22  |       await page.click('#change-password-submit-btn');
  23  |       await page.waitForURL(/\/hod/, { timeout: 15000 });
  24  |     }
  25  | 
  26  |     // 4. Verify HOD dashboard identity and elements
  27  |     await expect(page).toHaveURL(/\/hod/);
  28  |     await expect(page.locator('header').getByText('Dr. Pachaiammal Alias Priya')).toBeVisible();
  29  |     await expect(page.locator('header').getByText('hod.cce@sairam.edu.in')).toBeVisible();
  30  | 
  31  |     // 5. Verify NO Faculty Mentor Portal button exists in HOD header
  32  |     await expect(page.getByText(/Faculty Mentor Portal/i)).toHaveCount(0);
  33  | 
  34  |     // 6. Test Settings & Email Verification modal
  35  |     const settingsBtn = page.locator('#hod-settings-button');
  36  |     await expect(settingsBtn).toBeVisible();
  37  |     await settingsBtn.click();
  38  | 
  39  |     // Verify modal is displayed with all verification elements
  40  |     await expect(page.locator('#settings-modal-title')).toBeVisible();
  41  |     await expect(page.locator('#settings-email-display')).toHaveText('hod.cce@sairam.edu.in');
  42  |     await expect(page.locator('#verification-status-badge')).toBeVisible();
  43  | 
  44  |     // Close modal without blocking HOD functions
  45  |     await page.locator('#settings-modal-close').click();
  46  |     await expect(page.locator('#settings-modal-title')).toHaveCount(0);
  47  | 
  48  |     // Verify HOD dashboard remains fully functional and accessible
  49  |     await expect(page.getByRole('tab', { name: /Mentees/i })).toBeVisible();
  50  | 
  51  |     // 7. Test Proper Sign Out
  52  |     await page.getByRole('button', { name: /Sign out/i }).click();
  53  |     await page.waitForURL(/\/login/, { timeout: 10000 });
  54  | 
  55  |     // Verify signed out alert is displayed
  56  |     const signedOutAlert = page.locator('#signed-out-success-alert');
  57  |     await expect(signedOutAlert).toBeVisible();
  58  |     await expect(signedOutAlert).toContainText(/Signed out successfully/i);
  59  | 
  60  |     // Verify token is removed from client storage
  61  |     const token = await page.evaluate(() => localStorage.getItem('cce_achieve_token'));
  62  |     expect(token).toBeNull();
  63  | 
  64  |     // 8. Test Browser Back Button does NOT expose protected data
  65  |     await page.goBack();
  66  |     await page.waitForTimeout(1500);
  67  |     const tokenAfterBack = await page.evaluate(() => localStorage.getItem('cce_achieve_token'));
  68  |     expect(tokenAfterBack).toBeNull();
  69  |   });
  70  | 
  71  |   test('TC-AUTH-02: Student Dashboard — Exactly ONE Primary Submit Activity Button', async ({ page }) => {
  72  |     // 1. Navigate to student login
  73  |     await page.goto('/login/student');
  74  |     await page.fill('#login-email-input', 'sec25co031@sairamtap.edu.in');
  75  |     await page.fill('#login-password-input', 'cce@123');
  76  |     await page.click('#login-submit-button');
  77  | 
  78  |     await page.waitForURL((url) => url.pathname === '/change-password' || url.pathname === '/student', { timeout: 15000 });
  79  | 
  80  |     if (page.url().includes('/change-password')) {
  81  |       await page.fill('#current-password', 'cce@123');
  82  |       await page.fill('#new-password', 'cce@stud_2026');
  83  |       await page.fill('#confirm-password', 'cce@stud_2026');
  84  |       await page.click('#change-password-submit-btn');
  85  |       await page.waitForURL(/\/student/, { timeout: 15000 });
  86  |     }
  87  | 
  88  |     // 2. Verify on student dashboard
  89  |     await expect(page).toHaveURL(/\/student/);
  90  | 
  91  |     // 3. Verify exactly ONE visible Submit Activity button exists in the entire dashboard
  92  |     const headerSubmitBtn = page.locator('#student-header-submit-btn');
  93  |     await expect(headerSubmitBtn).toBeVisible();
  94  | 
  95  |     // Count all visible buttons whose text content is "Submit Activity"
  96  |     const submitButtons = page.getByRole('button', { name: /^Submit Activity$/i });
  97  |     await expect(submitButtons).toHaveCount(1);
  98  | 
  99  |     // 4. Click the single Submit Activity button to ensure submission modal opens properly
  100 |     await headerSubmitBtn.click();
  101 |     await expect(page.getByRole('heading', { name: /Submit Activity Points/i })).toBeVisible();
  102 | 
  103 |     // Close the modal
  104 |     const closeBtn = page.getByRole('button', { name: /Cancel|Close/i }).first();
  105 |     if (await closeBtn.isVisible()) {
  106 |       await closeBtn.click();
  107 |     } else {
  108 |       await page.keyboard.press('Escape');
  109 |     }
  110 | 
  111 |     // 5. Clean sign out
  112 |     const studentSignOut = page.locator('#student-header-signout');
  113 |     if (await studentSignOut.isVisible()) {
  114 |       await studentSignOut.click();
  115 |     } else {
  116 |       await page.click('button[aria-label="Open student navigation menu"]');
```