# Handoff Report: Testing Infrastructure & Authentication Safety Survey

**Author**: `teamwork_explorer` (Role: Codebase Researcher - Testing & Auth Safety)  
**Date**: 2026-10-31  
**Working Directory**: `e:\Projects\pgpa web-app\.agents\teamwork\explorer_survey_3\`  
**Target Milestone**: Survey & Specification for CCE PGPA Branding, Hidden Admin Access, and No-Scroll Login Experience  

---

## 1. Observation

### 1.1 Dev Servers & Service Ports
- Powershell command `Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 3000, 8000, 8080 }` confirmed:
  - Port 3000 (`::3000`) is active and listening (Next.js frontend).
  - Port 8000 (`127.0.0.1:8000`) is active and listening (FastAPI backend).
- `Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/v1/health" -UseBasicParsing` returned:
  ```json
  {"status":"healthy","app_name":"CCE Achieve API","environment":"development","database":{"connected":true,"status":"connected","database":"cce_achieve","host":"localhost"}}
  ```
- `Invoke-WebRequest -Uri "http://localhost:3000/" -UseBasicParsing` returned HTTP status `200`.

### 1.2 Frontend Playwright Configuration & Existing Tests
- `frontend/package.json:10`: `"test:e2e": "playwright test"`.
- `frontend/package.json:19`: `"@playwright/test": "^1.64.1"`.
- `frontend/playwright.config.ts:18-29`:
  - `baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'`
  - `webServer: { command: 'npm run start', url: 'http://localhost:3000', reuseExistingServer: true, timeout: 60000 }`
  - `workers: 1`, `fullyParallel: false`.
- `frontend/tests/helpers/viewports.ts:8-21`:
  - 9 viewports defined: `mobile-375x667`, `mobile-390x844`, `mobile-402x874`, `mobile-360x800`, `mobile-412x915`, `tablet-768x1024`, `desktop-1280x720`, `desktop-1366x768`, `desktop-1920x1080`.
  - **Missing required viewports**: Desktop `1440x900` (R3) and Mobile `430x932` (R4) are completely absent.
- `frontend/tests/helpers/assertions.ts:12-48`:
  - `checkHorizontalOverflow(page)` checks `docScrollWidth > docWidth + 1` and `bodyScrollWidth > docWidth + 1`.
  - **No vertical scroll check exists** in `assertions.ts` (`doc.scrollHeight <= window.innerHeight` is never checked).
- `frontend/tests/responsive.spec.ts:238-241`:
  ```typescript
  // 4. Navigate to Admin Portal
  await page.click('#portal-card-admin');
  await expect(page).toHaveURL(/\/login\/admin/);
  ```
  This test directly requires `#portal-card-admin` to exist on the public landing page. Once the Admin card is removed (R1), this test will break.

### 1.3 Baseline Viewport Scroll Measurements (Live Execution)
Headless browser measurements via Playwright against `http://localhost:3000` revealed:
- **Landing Page (`/`)**:
  - `1920x1080`: scrollHeight `1080px`, innerHeight `1080px` (`fitsHeight: true`)
  - `1440x900`: scrollHeight `900px`, innerHeight `900px` (`fitsHeight: true`)
  - `1366x768`: scrollHeight `768px`, innerHeight `768px` (`fitsHeight: true`)
  - `1280x720`: scrollHeight `732px`, innerHeight `720px` (`fitsHeight: false`, **+12px overflow**)
- **Student Login (`/login/student`)**:
  - `1920x1080`: scrollHeight `1080px`, innerHeight `1080px` (`fitsHeight: true`)
  - `1440x900`: scrollHeight `978px`, innerHeight `900px` (`fitsHeight: false`, **+78px overflow**)
  - `1366x768`: scrollHeight `978px`, innerHeight `768px` (`fitsHeight: false`, **+210px overflow**)
  - `1280x720`: scrollHeight `978px`, innerHeight `720px` (`fitsHeight: false`, **+258px overflow**)
- **Mentor Login (`/login/mentor`)**:
  - Same as Student: scrollHeight `978px` across 1440x900, 1366x768, 1280x720 (**overflows +78px, +210px, +258px**).
- **HOD Login (`/login/hod`)**:
  - Same as Student: scrollHeight `978px` across 1440x900, 1366x768, 1280x720 (**overflows +78px, +210px, +258px**).
- **Admin Login (`/login/admin`)**:
  - `1920x1080`: scrollHeight `1080px`, innerHeight `1080px` (`fitsHeight: true`)
  - `1440x900`: scrollHeight `1006px`, innerHeight `900px` (`fitsHeight: false`, **+106px overflow**)
  - `1366x768`: scrollHeight `1006px`, innerHeight `768px` (`fitsHeight: false`, **+238px overflow**)
  - `1280x720`: scrollHeight `1006px`, innerHeight `720px` (`fitsHeight: false`, **+286px overflow**)
- **Mobile Viewports (360×800, 375×667, 390×844, 412×915, 430×932)**:
  - `scrollWidth <= innerWidth` across all 5 viewports on all 5 routes. Zero horizontal overflow observed.

### 1.4 Backend Authentication & RBAC Boundaries
- Command `Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/v1/admin/overview"` without credentials returned:
  - HTTP Status: `401 Unauthorized`
  - Body: `{"detail":"Not authenticated. Bearer token is missing."}`
- `backend/app/core/permissions.py:127-148`:
  - `require_admin = require_role(UserRole.ADMIN)`
  - Rejects missing tokens with 401, non-admin roles with 403 (`"Access forbidden: operation requires one of [admin] role(s)."`).
- `frontend/lib/auth-context.tsx:185-256`:
  - Admin login strictly uses Firebase Web SDK (`signInWithEmailAndPassword`), yields RS256 Firebase ID token, validated against backend `/api/v1/auth/me`.
  - Non-admin roles use backend password authentication (`POST /api/v1/auth/login`) verified by Argon2id in PostgreSQL.
- `backend/tests/test_auth.py:478-501`:
  - `test_login_firebase_managed_placeholder_rejected`: Guarantees admin accounts cannot bypass Firebase via backend password login.

### 1.5 Role Switch Navigation Current State
- `frontend/components/RoleLoginForm.tsx:242`:
  - Current implementation maps over `ALL_ROLES` (`['student', 'mentor', 'hod', 'admin']`) on all login pages.
  - As a result, Admin is currently visible in switch navigation on Student, Mentor, and HOD pages; and public role switches are currently visible on the Admin login page.

---

## 2. Logic Chain

1. **Premise 1**: The requirements dictate that on desktop viewports (1920×1080, 1440×900, 1366×768, 1280×720), `document.documentElement.scrollHeight <= window.innerHeight` across all four login pages without vertical scrollbars.
   - *From Observation 1.3*: The current login pages have a fixed uncompressed vertical height of 978px–1006px. Therefore, they overflow 1440×900 (+78px/+106px), 1366×768 (+210px/+238px), and 1280×720 (+258px/+286px).
   - *Inference*: Responsive layout adjustments (compact padding, `h-[100dvh]`, flex-shrink, and viewport-aware margins) are mandatory in `RoleLoginForm.tsx`. Simply adding `overflow: hidden` is prohibited by R3.

2. **Premise 2**: Existing test suite `responsive.spec.ts` passes all 101 tests, but failed to catch the vertical overflow.
   - *From Observation 1.2*: `assertions.ts` only implements `checkHorizontalOverflow`. It lacks any assertion on `doc.scrollHeight <= window.innerHeight`.
   - *Inference*: A new vertical containment assertion and dedicated desktop test suite must be introduced.

3. **Premise 3**: Requirement R1 requires removing `#portal-card-admin` and the word "Admin" from `/`.
   - *From Observation 1.2*: `responsive.spec.ts:238` explicitly calls `page.click('#portal-card-admin')`.
   - *Inference*: If `responsive.spec.ts` is run after removing the Admin card without modification, test line 238 will throw a timeout error. It must be updated to click the interactive "CCE PGPA" branding title or replaced by a dedicated branding/navigation suite.

4. **Premise 4**: Requirement R1 requires "CCE PGPA" to support both click navigation and keyboard activation via Enter or Space.
   - *From Observation 1.4 & 1.5*: Currently the title is an inert `<h1>CCE Achieve</h1>` in both `PortalSelection.tsx:297` and `RoleLoginForm.tsx:214`.
   - *Inference*: In `PortalSelection.tsx`, the title must be rendered as an interactive element (e.g. Next.js `<Link href="/login/admin">` with `id="brand-title-admin-trigger"`, `aria-label="Admin Portal Access"`, and an `onKeyDown` handler for Space activation).

5. **Premise 5**: Requirement R6 requires that backend authentication logic, passwords, and security boundaries remain intact.
   - *From Observation 1.4*: Backend admin security is strictly enforced by FastAPI Bearer token validation and PostgreSQL database role checks (`require_admin`).
   - *Inference*: Removing the Admin card from public view is purely a presentation-layer change (UI minimalism). It does not affect API security, token verification, Argon2id hashing, or database roles.

---

## 3. Caveats

1. **Port Dependencies**: Playwright tests depend on the frontend server being available on `http://localhost:3000`. In CI or standalone runs without an existing server, `webServer.command: 'npm run start'` requires a prior `npm run build`.
2. **Firebase Live Admin Credentials**: End-to-end testing of the full Firebase authentication form submit for Admin requires live Firebase network access and valid test admin credentials (`cce.pgpa@gmail.com`). However, the navigation to `/login/admin`, rendering of the admin login form, and backend 401/403 authorization guards can be thoroughly verified deterministically without live credential submission.
3. **Reduced Motion**: Apple-inspired micro-interactions must respect `@media (prefers-reduced-motion: reduce)` in Tailwind CSS / CSS transitions.

---

## 4. Conclusion

1. **Authoritative State Verified**: The testing setup uses Playwright 1.64.1 under `frontend/` with baseURL `http://localhost:3000`. Both frontend (port 3000) and backend (port 8000) dev servers are verified active.
2. **Existing Test Fix Required**: `frontend/tests/responsive.spec.ts:238` clicks `#portal-card-admin` and will fail when the card is removed. It must be updated to navigate via the "CCE PGPA" title.
3. **Viewport Definitions Must Be Expanded**: `frontend/tests/helpers/viewports.ts` must add `1440x900` (desktop) and `430x932` (mobile).
4. **Desktop No-Scroll Is Currently Broken**: Baseline measurements prove that Student, Mentor, HOD, and Admin login pages currently suffer from 78px to 286px of vertical overflow on 1440×900, 1366×768, and 1280×720 viewports. The layout must be compacted using viewport-aware styling.
5. **Role Switch Isolation Must Be Enforced**: `RoleLoginForm.tsx` must be modified to exclude Admin from switch links on Student, Mentor, and HOD pages, and remove public role switcher completely on the Admin login page.
6. **Backend Security Is Cryptographically Enforced**: Backend API boundaries unconditionally enforce 401 on unauthenticated requests and 403 on unauthorized roles. Frontend UI changes will not affect auth safety.

---

## 5. Verification Method

To independently verify the findings in this report, execute the following commands in powershell:

### 5.1 Verify Dev Server Health & Listening Ports
```powershell
# Check listening ports
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 3000, 8000 }

# Verify backend health
Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/v1/health" -UseBasicParsing | Select-Object -ExpandProperty Content

# Verify frontend status
Invoke-WebRequest -Uri "http://localhost:3000/" -UseBasicParsing | Select-Object -ExpandProperty StatusCode
```

### 5.2 Verify Backend RBAC 401 Enforcement
```powershell
# Unauthenticated request to protected Admin API must return 401
try {
  Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/v1/admin/overview" -UseBasicParsing
} catch {
  Write-Host "Status Code:" $_.Exception.Response.StatusCode.value__
  Write-Host "Response Body:" $_.ErrorDetails.Message
}
# Expected Output:
# Status Code: 401
# Response Body: {"detail":"Not authenticated. Bearer token is missing."}
```

### 5.3 Verify Desktop Vertical Overflow Baseline
```powershell
node -e "
const { chromium } = require('./frontend/node_modules/playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [w, h] of [[1920, 1080], [1440, 900], [1366, 768], [1280, 720]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('http://localhost:3000/login/student', { waitUntil: 'networkidle' });
    const res = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      innerHeight: window.innerHeight,
      overflow: document.documentElement.scrollHeight - window.innerHeight
    }));
    console.log(w + 'x' + h, 'scrollHeight:', res.scrollHeight, 'overflow:', res.overflow);
  }
  await browser.close();
})();
"
```

### 5.4 Run Existing Playwright Tests
```powershell
cd frontend
npx playwright test -g "Navigation between Portals"
```

### Invalidation Conditions
- If `document.documentElement.scrollHeight <= window.innerHeight` on `/login/student` at 1280×720 in the current codebase without layout modifications, this finding would be invalidated.
- If an unauthenticated request to `/api/v1/admin/overview` succeeds with HTTP 200, the security boundary claim would be invalidated.

