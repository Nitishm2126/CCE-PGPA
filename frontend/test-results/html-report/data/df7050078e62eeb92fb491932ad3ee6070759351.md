# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth-workflow-verification.spec.ts >> Auth, Role Mapping & Dashboard Workflow Fixes Suite >> TC-AUTH-04: Password Change Page Form Validation & Error Handling
- Location: tests\auth-workflow-verification.spec.ts:168:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('#signed-out-success-alert')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('#signed-out-success-alert') with timeout 10000ms
  - waiting for locator('#signed-out-success-alert')

```

```yaml
- main:
  - link "Sri Sairam Engineering College Crest Sri Sairam Engineering College Autonomous Institution Anna University Affiliated NBA & NAAC 'A+'":
    - /url: /
    - img "Sri Sairam Engineering College Crest"
    - text: Sri Sairam Engineering College Autonomous Institution Anna University Affiliated NBA & NAAC 'A+'
  - text: Department of CCE Academic Performance Portal
  - button "Switch to dark mode":
    - img
  - img "Sri Sairam Institutions Logo"
  - main:
    - text: DEPARTMENT OF COMPUTER AND COMMUNICATION ENGINEERING
    - heading "CCE PGPA" [level=1]
    - paragraph: PGPA MANAGEMENT SYSTEM
    - paragraph: “Academic Performance. Structured. Simplified.”
    - text: Select Institutional Portal to Sign In
    - link "2025-2029 Students Student Portal Enrolled CCE Undergraduates (2025–2029) Submit academic activities, upload evidence and track PGPA progress. Portal Capabilities Enter Student Portal":
      - /url: /login/student
      - text: 2025-2029 Students
      - heading "Student Portal" [level=2]
      - paragraph: Enrolled CCE Undergraduates (2025–2029)
      - paragraph: Submit academic activities, upload evidence and track PGPA progress.
      - text: Point Submission Evidence Vault PGPA Progress Enter Student Portal
    - link "Review & Verification Faculty Mentor Portal Faculty Advisors & Verification Officers Review student submissions, verify evidence and provide feedback. Portal Capabilities Enter Faculty Portal":
      - /url: /login/mentor
      - text: Review & Verification
      - heading "Faculty Mentor Portal" [level=2]
      - paragraph: Faculty Advisors & Verification Officers
      - paragraph: Review student submissions, verify evidence and provide feedback.
      - text: Mentee Directory Evidence Audit Remarks Ledger Enter Faculty Portal
    - link "Department Administration Department HOD Portal Head of Department & Academic Governance Monitor department-wide performance, mentor activity and PGPA progress. Portal Capabilities Enter HOD Portal":
      - /url: /login/hod
      - text: Department Administration
      - heading "Department HOD Portal" [level=2]
      - paragraph: Head of Department & Academic Governance
      - paragraph: Monitor department-wide performance, mentor activity and PGPA progress.
      - text: Cohort Analytics Mentor Allocation Executive Reports Enter HOD Portal
  - img "Founder Chairman MJF. Ln. Leo Muthu"
  - text: MJF. Ln. Leo Muthu Founder Chairman • Sri Sairam Group of Institutions Designed & Developed by FINEWORKS
  - link "CCE PGPA Management System":
    - /url: /login/admin
  - text: Department of Computer and Communication Engineering Sri Sairam Engineering College (Autonomous) Version 1.0.0
- alert: CCE-PGPA Portal - Department of CCE, Sri Sairam Engineering College
```

# Test source

```ts
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
  117 |       await page.getByText(/Sign Out of Portal/i).click();
  118 |     }
  119 | 
  120 |     await page.waitForURL(/\/login/, { timeout: 10000 });
  121 |     await expect(page.locator('#signed-out-success-alert')).toBeVisible();
  122 |   });
  123 | 
  124 |   test('TC-AUTH-03: Faculty Mentor Optional Email Verification & Settings Modal', async ({ page }) => {
  125 |     // 1. Navigate to mentor login
  126 |     await page.goto('/login/mentor');
  127 |     await page.fill('#login-email-input', 'lekha.cce@sairam.edu.in');
  128 |     await page.fill('#login-password-input', 'cce@123');
  129 |     await page.click('#login-submit-button');
  130 | 
  131 |     await page.waitForURL((url) => url.pathname === '/change-password' || url.pathname === '/mentor', { timeout: 15000 });
  132 | 
  133 |     if (page.url().includes('/change-password')) {
  134 |       await page.fill('#current-password', 'cce@123');
  135 |       await page.fill('#new-password', 'cce@mentor_2026');
  136 |       await page.fill('#confirm-password', 'cce@mentor_2026');
  137 |       await page.click('#change-password-submit-btn');
  138 |       await page.waitForURL(/\/mentor/, { timeout: 15000 });
  139 |     }
  140 | 
  141 |     // 2. Verify on mentor dashboard
  142 |     await expect(page).toHaveURL(/\/mentor/);
  143 |     await expect(page.getByText('P. LEKHA').first()).toBeVisible();
  144 | 
  145 |     // 3. Open Settings Modal
  146 |     const settingsBtn = page.locator('#mentor-settings-button');
  147 |     await expect(settingsBtn).toBeVisible();
  148 |     await settingsBtn.click();
  149 | 
  150 |     // Verify Settings Modal contents
  151 |     await expect(page.locator('#settings-modal-title')).toBeVisible();
  152 |     await expect(page.locator('#settings-email-display')).toHaveText('nithish21077@gmail.com');
  153 |     await expect(page.locator('#verification-status-badge')).toBeVisible();
  154 | 
  155 |     // Close settings modal
  156 |     await page.locator('#settings-modal-close').click();
  157 |     await expect(page.locator('#settings-modal-title')).toHaveCount(0);
  158 | 
  159 |     // 4. Verify mentor is NOT blocked from doing reviews or accessing students
  160 |     await expect(page.getByText(/Assigned Mentees/i).or(page.getByText(/Mentee Directory/i))).toBeVisible();
  161 | 
  162 |     // 5. Sign out
  163 |     await page.getByRole('button', { name: /Sign out/i }).click();
  164 |     await page.waitForURL(/\/login/, { timeout: 10000 });
  165 |     await expect(page.locator('#signed-out-success-alert')).toBeVisible();
  166 |   });
  167 | 
  168 |   test('TC-AUTH-04: Password Change Page Form Validation & Error Handling', async ({ page }) => {
  169 |     // 1. Go to student login
  170 |     await page.goto('/login/student');
  171 |     await page.fill('#login-email-input', 'sec25co032@sairamtap.edu.in');
  172 |     await page.fill('#login-password-input', 'cce@123');
  173 |     await page.click('#login-submit-button');
  174 | 
  175 |     await page.waitForURL((url) => url.pathname === '/change-password' || url.pathname === '/student', { timeout: 15000 });
  176 | 
  177 |     if (!page.url().includes('/change-password')) {
  178 |       await page.goto('/change-password');
  179 |       await page.waitForURL(/\/change-password/);
  180 |     }
  181 | 
  182 |     // 2. Verify no publicly visible plaintext default password hints
  183 |     await expect(page.locator('text=cce@123')).toHaveCount(0);
  184 | 
  185 |     // 3. Verify validation: mismatched new passwords
  186 |     await page.fill('#current-password', 'cce@123');
  187 |     await page.fill('#new-password', 'cce@newpass_1');
  188 |     await page.fill('#confirm-password', 'cce@mismatch_2');
  189 |     await page.click('#change-password-submit-btn');
  190 | 
  191 |     await expect(page.getByText(/do not match/i)).toBeVisible();
  192 | 
  193 |     // 4. Verify validation: same as current password
  194 |     await page.fill('#new-password', 'cce@123');
  195 |     await page.fill('#confirm-password', 'cce@123');
  196 |     await page.click('#change-password-submit-btn');
  197 | 
  198 |     await expect(page.getByText(/must be different from your current/i)).toBeVisible();
  199 | 
  200 |     // 5. Sign out from change password page
  201 |     const signoutBtn = page.locator('#change-password-header-signout');
  202 |     await expect(signoutBtn).toBeVisible();
  203 |     await signoutBtn.click();
  204 |     await page.waitForURL(/\/login/, { timeout: 10000 });
> 205 |     await expect(page.locator('#signed-out-success-alert')).toBeVisible();
      |                                                             ^ Error: expect(locator).toBeVisible() failed
  206 |   });
  207 | 
  208 | });
  209 | 
```