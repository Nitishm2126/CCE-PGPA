# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth-workflow-verification.spec.ts >> Auth, Role Mapping & Dashboard Workflow Fixes Suite >> TC-AUTH-03: Faculty Mentor Optional Email Verification & Settings Modal
- Location: tests\auth-workflow-verification.spec.ts:124:7

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
            - link "Faculty Mentor" [ref=e42]:
              - /url: /login/mentor
            - link "Department HOD" [ref=e43] [cursor=pointer]:
              - /url: /login/hod
        - generic [ref=e44]:
          - generic [ref=e46]:
            - generic [ref=e47]:
              - generic [ref=e55]:
                - heading "Faculty Mentor Login" [level=3] [ref=e56]
                - paragraph [ref=e57]: Authorized institutional access
              - generic [ref=e58]: Faculty Mentor
            - paragraph [ref=e60]: Review student submissions, verify evidence and provide feedback.
          - alert [ref=e61]:
            - generic [ref=e65]:
              - paragraph [ref=e66]: Authentication Error
              - paragraph [ref=e67]: Invalid email or password. Please verify your credentials.
          - generic [ref=e68]:
            - generic [ref=e69]:
              - generic [ref=e70]: Official College Email
              - textbox "Official College Email" [ref=e72]:
                - /placeholder: e.g. mentor.cce@sairam.edu.in
                - text: lekha.cce@sairam.edu.in
            - generic [ref=e73]:
              - generic [ref=e74]:
                - generic [ref=e75]: Account Password
                - link "Forgot password?" [ref=e76] [cursor=pointer]:
                  - /url: /forgot-password
              - generic [ref=e77]:
                - textbox "Account Password" [ref=e78]:
                  - /placeholder: Enter your account password
                  - text: cce@123
                - button "Show password" [ref=e79] [cursor=pointer]
            - button "Login as Faculty Mentor" [ref=e84] [cursor=pointer]
          - paragraph [ref=e87]:
            - strong [ref=e88]: "Authorized Access Only:"
            - text: Cohort accounts are provisioned via verified departmental rosters. Public self-registration is disabled.
      - generic [ref=e90]:
        - generic [ref=e91]:
          - generic [ref=e92]:
            - img "Founder Chairman MJF. Ln. Leo Muthu" [ref=e94]
            - generic [ref=e95]:
              - generic [ref=e96]: MJF. Ln. Leo Muthu
              - generic [ref=e97]: Founder Chairman • Sri Sairam Group of Institutions
          - generic [ref=e98]:
            - generic [ref=e99]: Designed & Developed by
            - generic [ref=e100]: FINEWORKS
        - generic [ref=e103]:
          - generic [ref=e104]:
            - link "CCE PGPA Management System" [ref=e105] [cursor=pointer]:
              - /url: /login/admin
            - generic [aria-hidden] [ref=e106]: •
            - generic [ref=e107]: Department of Computer and Communication Engineering
            - generic [aria-hidden] [ref=e108]: •
            - generic [ref=e109]: Sri Sairam Engineering College (Autonomous)
          - generic [ref=e110]: Version 1.0.0
  - button "Open Next.js Dev Tools" [ref=e117] [cursor=pointer]
  - alert [ref=e121]
```

# Test source

```ts
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
> 131 |     await page.waitForURL((url) => url.pathname === '/change-password' || url.pathname === '/mentor', { timeout: 15000 });
      |                ^ TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
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
  205 |     await expect(page.locator('#signed-out-success-alert')).toBeVisible();
  206 |   });
  207 | 
  208 | });
  209 | 
```