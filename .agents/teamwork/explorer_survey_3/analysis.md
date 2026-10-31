# Comprehensive Research & Survey Report: Testing Infrastructure & Authentication Safety

**Author**: `teamwork_explorer` (Codebase Researcher: Testing & Auth Safety)  
**Date**: 2026-10-31  
**Working Directory**: `e:\Projects\pgpa web-app\.agents\teamwork\explorer_survey_3\`  
**Target Project**: CCE PGPA Web Application (`e:\Projects\pgpa web-app`)  

---

## Executive Summary

This investigation analyzed the testing infrastructure, Playwright test suite, dev server orchestration, and backend authentication / RBAC architecture in the project workspace to support the implementation of:
1. **R1**: "CCE PGPA" branding & hidden Admin access via title click & accessible keyboard activation (Enter/Space), public Admin card removal, and complete omission of the word "Admin" on the public landing page.
2. **R2**: Role switcher navigation isolation on Student, Mentor, and HOD pages (Admin removed), and complete omission of public role switcher on the Admin login page.
3. **R3 & R4**: Desktop no-scroll viewport containment (`scrollHeight <= innerHeight`, `scrollWidth <= innerWidth`) at 1920×1080, 1440×900, 1366×768, and 1280×720 across all 4 login pages without vertical or horizontal scrollbars, while preserving natural vertical scrolling and zero horizontal scroll on mobile viewports (360×800, 375×667, 390×844, 412×915, 430×932).
4. **R5 & R6**: Micro-interactions with reduced motion support, and preservation of backend authentication, session tokens, Argon2id hashing, Firebase admin auth, Neon PostgreSQL directory access, and RBAC security boundaries.

### Key Empirical Findings
- **Dev Servers Live**: Port 3000 (Next.js 16.4.1) and Port 8000 (FastAPI / Uvicorn) are actively running in the development workspace.
- **Backend Auth Boundaries Verified**: Unauthenticated requests to `/api/v1/admin/overview` strictly return `HTTP 401 Unauthorized` (`{"detail":"Not authenticated. Bearer token is missing."}`). The backend enforces RBAC at the database/JWT/Firebase level via `require_admin` in `backend/app/core/permissions.py`; UI changes to hide the admin link do not compromise security.
- **Current Viewport Overflow Discovered**: While desktop 1920×1080 currently fits, **all four login pages currently fail the no-scroll requirement** at 1440×900, 1366×768, and 1280×720 (heights reach 978px–1006px against 720px–900px viewports, producing +78px to +286px overflow). The landing page also overflows at 1280×720 (+12px).
- **Existing Playwright Gaps**: `frontend/tests/responsive.spec.ts` (101 tests) tests *only horizontal overflow* (`scrollWidth <= clientWidth + 1`) and *never checks vertical height* (`scrollHeight <= innerHeight`). Furthermore, `responsive.spec.ts` line 238 actively clicks `#portal-card-admin`—it will break once the admin card is removed. Viewports in `viewports.ts` lack `1440x900` (desktop) and `430x932` (mobile).

---

## 1. Testing Infrastructure & Dev Server Configuration

### 1.1 Playwright Configuration (`frontend/playwright.config.ts`)
- **Test Directory**: `./tests` (resolved relative to `frontend/`).
- **Timeouts**: Global test timeout is `45000ms` (45s), expect timeout is `10000ms` (10s).
- **Parallelism**: `fullyParallel: false`, `workers: 1`. Single-worker sequential execution prevents database and session race conditions during end-to-end tests.
- **Reporters**:
  - `list` (terminal real-time reporting)
  - `json` -> `frontend/test-results/results.json`
  - `html` -> `frontend/test-results/html-report` (`open: 'never'`)
- **Base URL**: `process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'`
- **Artifacts Output**: `frontend/test-results/artifacts`
- **webServer Configuration**:
  ```typescript
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 60000,
  }
  ```
  *Crucial Behavior*: Because `reuseExistingServer: true` is configured, running `npx playwright test` when the local dev/start server is already listening on `http://localhost:3000` reuses the live process without attempting to spawn a second instance.

### 1.2 Package Scripts and Dependencies (`frontend/package.json`)
- **Root vs Frontend**: The project root does not have a `package.json`; all frontend JavaScript/TypeScript dependencies reside in `frontend/package.json`.
- **Scripts**:
  - `"dev": "next dev"` (Next.js development server on port 3000)
  - `"build": "next build"`
  - `"start": "next start"` (Next.js production server on port 3000)
  - `"lint": "eslint"`
  - `"test:e2e": "playwright test"`
- **Dependencies**:
  - `next`: `16.4.1`
  - `react`: `19.3.0`
  - `react-dom`: `19.3.0`
  - `firebase`: `^13.0.0`
  - `@playwright/test`: `^1.64.1`
  - `tailwindcss`: `^4` (using `@tailwindcss/turbopack`)
  - `typescript`: `^5`

### 1.3 Backend Test Infrastructure (`backend/`)
- **Python Environment**: `e:\Projects\pgpa web-app\.venv` (Python 3.12.4).
- **Test Runner**: `pytest 9.1.1` with `anyio 4.15.1`.
- **Execution Command**: `.\.venv\Scripts\pytest backend\tests\`
- **Database Fixtures**: `conftest.py` and test-level fixtures (`db`, `admin_db`) connect to local PostgreSQL `cce_achieve`, manage transaction isolation, and perform automated teardown of created test entities via tracked IDs (`track_user`, `track_achievement`).

---

## 2. Existing Playwright Tests & Coverage Audit

### 2.1 File Catalog
| File Path | Purpose | Lines | Key Contents |
|---|---|---|---|
| `frontend/tests/responsive.spec.ts` | Main Playwright spec | 260 | 101 tests across 4 groups (responsive, landing specifics, form responsiveness, navigation) |
| `frontend/tests/helpers/viewports.ts` | Viewport definitions & page routes | 36 | `VIEWPORTS` array (9 viewports) & `PAGES` array (5 routes) |
| `frontend/tests/helpers/assertions.ts` | Custom DOM assertions | 115 | `checkHorizontalOverflow`, `checkLogoAspectRatio`, `checkDepartmentNameExactness`, `checkPortalCardsAlignment` |
| `frontend/verify-desktop.js` | Standalone verification script | 92 | Puppeteer/Playwright headless runner checking `doc.scrollHeight <= window.innerHeight` on landing page |
| `frontend/inspect-dom.js` | Diagnostic DOM inspector | 48 | Measures section heights (`header`, `main`, `footer`, `cardsContainer`) |
| `generate_all_shots.js` (root) | Chrome headless screenshot generator | 36 | Captures landing screenshots via direct Chrome CLI invocation |

### 2.2 Existing Viewports Definition (`frontend/tests/helpers/viewports.ts`)
```typescript
export const VIEWPORTS: ViewportDefinition[] = [
  // Mobile
  { name: 'mobile-375x667', width: 375, height: 667, category: 'mobile' },
  { name: 'mobile-390x844', width: 390, height: 844, category: 'mobile' },
  { name: 'mobile-402x874', width: 402, height: 874, category: 'mobile' }, // Not in R4 list
  { name: 'mobile-360x800', width: 360, height: 800, category: 'mobile' },
  { name: 'mobile-412x915', width: 412, height: 915, category: 'mobile' },
  // Tablet
  { name: 'tablet-768x1024', width: 768, height: 1024, category: 'tablet' },
  // Desktop
  { name: 'desktop-1280x720', width: 1280, height: 720, category: 'desktop' },
  { name: 'desktop-1366x768', width: 1366, height: 768, category: 'desktop' },
  { name: 'desktop-1920x1080', width: 1920, height: 1080, category: 'desktop' },
];
```
#### Viewport Coverage Discrepancies vs Requirements:
1. **Missing Desktop Viewport**: Requirements R3 & Acceptance Criteria specify `1440x900`. This resolution is completely absent from `VIEWPORTS`.
2. **Missing Mobile Viewport**: Requirements R4 & Acceptance Criteria specify `430x932` (iPhone Pro Max). This resolution is missing from `VIEWPORTS`.
3. **Extra Non-Standard Viewport**: `402x874` is present in `VIEWPORTS` but not specified in R4.

### 2.3 Existing Assertions Audit (`frontend/tests/helpers/assertions.ts`)
- `checkHorizontalOverflow(page)`:
  - Compares `doc.scrollWidth` and `body.scrollWidth` against `doc.clientWidth + 1`.
  - Iterates through all DOM elements and logs bounding boxes where `rect.right > docWidth + 1`.
  - **Critical Flaw**: It does **NOT** check vertical overflow (`doc.scrollHeight > window.innerHeight`).
- `checkLogoAspectRatio(page)`:
  - Verifies SEC emblem and Sairam logo rendered aspect ratio matches natural aspect ratio within 25% tolerance.
- `checkDepartmentNameExactness(page)`:
  - Verifies exact string `"DEPARTMENT OF COMPUTER AND COMMUNICATION ENGINEERING"`, absence of ellipsis, and single-line rendering on desktop vs wrapped on mobile.
- `checkPortalCardsAlignment(page)`:
  - Verifies top alignment within 5px across `#portal-card-student`, `#portal-card-mentor`, and `#portal-card-hod`.

### 2.4 Critical Gaps in Existing Test Coverage vs Requirements

| Requirement | Existing Test State | Failure / Gap Details |
|---|---|---|
| **R1. Brand Title: "CCE PGPA"** | Missing | Tests do not check for "CCE PGPA"; current pages render "CCE Achieve" (`PortalSelection.tsx:297`, `RoleLoginForm.tsx:214`). |
| **R1. Hidden Admin Access (Click)** | Missing | No test clicks "CCE PGPA" to verify navigation to `/login/admin`. |
| **R1. Hidden Admin Access (Keyboard)** | Missing | No test focuses the title and dispatches `Enter` or `Space` key presses to verify accessible activation. |
| **R1. Admin Card Removal** | Broken in Existing Spec | `responsive.spec.ts:238` explicitly runs: `await page.click('#portal-card-admin');`. Removing the Admin card causes this test to fail! |
| **R1. Word "Admin" Absence on Landing** | Missing | No test asserts that the string "Admin" is absent from public landing DOM text / headings / cards. |
| **R2. Role Switch Isolation (Student/Mentor/HOD)** | Missing | No test verifies that Admin is excluded from switch buttons on `/login/student`, `/login/mentor`, and `/login/hod`. In fact, `RoleLoginForm.tsx:242` currently maps over `ALL_ROLES` and renders Admin on all of them! |
| **R2. Role Switch Absence on Admin Login** | Missing | No test verifies that switch navigation is absent on `/login/admin`. Currently `ALL_ROLES` is displayed on `/login/admin` too. |
| **R3. Desktop No-Scroll (`scrollHeight <= innerHeight`)** | Missing & Currently Failing | `responsive.spec.ts` only checks horizontal overflow. Bounding height checks are completely absent in Playwright tests. |
| **R3. Target Desktop Resolutions (1920, 1440, 1366, 1280)** | Partial | `1440x900` is missing from `viewports.ts`. |
| **R4. Target Mobile Resolutions (360, 375, 390, 412, 430)** | Partial | `430x932` is missing from `viewports.ts`. |
| **R4. Mobile Natural Vertical Scroll** | Missing | No explicit test confirming vertical scrolling operates normally on mobile while horizontal scroll remains 0. |

---

## 3. Empirical Viewport Measurements (Current Codebase Baseline)

To establish an authoritative baseline, automated measurements were executed against the live application (`http://localhost:3000`).

### 3.1 Desktop Viewports (Target: `scrollHeight <= innerHeight`, No Scrollbars)

| Page | 1920×1080 (Target: 1080) | 1440×900 (Target: 900) | 1366×768 (Target: 768) | 1280×720 (Target: 720) | Status |
|---|---|---|---|---|---|
| **Landing (`/`)** | 1080px (fits ✅) | 900px (fits ✅) | 768px (fits ✅) | **732px (+12px ❌)** | FAILS AT 1280×720 |
| **Student Login (`/login/student`)** | 1080px (fits ✅) | **978px (+78px ❌)** | **978px (+210px ❌)** | **978px (+258px ❌)** | FAILS 3 OF 4 DESKTOPS |
| **Mentor Login (`/login/mentor`)** | 1080px (fits ✅) | **978px (+78px ❌)** | **978px (+210px ❌)** | **978px (+258px ❌)** | FAILS 3 OF 4 DESKTOPS |
| **HOD Login (`/login/hod`)** | 1080px (fits ✅) | **978px (+78px ❌)** | **978px (+210px ❌)** | **978px (+258px ❌)** | FAILS 3 OF 4 DESKTOPS |
| **Admin Login (`/login/admin`)** | 1080px (fits ✅) | **1006px (+106px ❌)** | **1006px (+238px ❌)** | **1006px (+286px ❌)** | FAILS 3 OF 4 DESKTOPS |

#### Root Cause of Desktop Vertical Overflow:
In `frontend/components/RoleLoginForm.tsx`:
- Header height: 56px–64px (`h-14 sm:h-16`)
- Heading Section: padding `pt-5 pb-3 sm:pt-6 sm:pb-4` (~110px)
- Breadcrumb / Switcher row: `mb-4` (~40px)
- Form card: padding `p-6 sm:p-8`, card header with badge, input groups (`h-11` inputs + labels + margin), remember me row, submit button (`h-12`), helper text
- Bottom padding on main: `pb-10` (40px)
- Footer: ~60px
- The natural unconstrained flex column height totals **978px** for student/mentor/hod and **1006px** for admin.
- Because `min-height: 100dvh` is used on the container without compact responsive scaling, viewport-aware padding (e.g. `py-2 sm:py-3`), and `flex-shrink` adjustments, viewports smaller than 1000px height force document vertical scrollbars.

### 3.2 Mobile Viewports (Target: `scrollWidth <= innerWidth`, Natural Vertical Scroll)

| Page | 360×800 | 375×667 | 390×844 | 412×915 | 430×932 | Horizontal Scroll |
|---|---|---|---|---|---|---|
| **Landing (`/`)** | 360 / 360 | 375 / 375 | 390 / 390 | 412 / 412 | 430 / 430 | **0px (No overflow ✅)** |
| **Student Login** | 360 / 360 | 375 / 375 | 390 / 390 | 412 / 412 | 430 / 430 | **0px (No overflow ✅)** |
| **Mentor Login** | 360 / 360 | 375 / 375 | 390 / 390 | 412 / 412 | 430 / 430 | **0px (No overflow ✅)** |
| **HOD Login** | 360 / 360 | 375 / 375 | 390 / 390 | 412 / 412 | 430 / 430 | **0px (No overflow ✅)** |
| **Admin Login** | 360 / 360 | 375 / 375 | 390 / 390 | 412 / 412 | 430 / 430 | **0px (No overflow ✅)** |

*Observation*: All mobile viewports cleanly maintain `doc.scrollWidth <= window.innerWidth`. Vertical scrolling functions as intended on mobile.

---

## 4. Backend Authentication & RBAC Architecture (Requirement R6)

### 4.1 Authentication Flow Architecture

```
[ Client / Browser ]
        │
        ├── Admin Credentials ──> Firebase Web SDK (signInWithEmailAndPassword)
        │                              │
        │                              └──> RS256 Firebase ID Token
        │                                         │
        │                                         ▼
        │                              GET /api/v1/auth/me (Bearer Token)
        │                                         │
        ├── Student/Mentor/HOD ──> POST /api/v1/auth/login (Argon2id verify)
        │                              │
        │                              └──> HS256 JWT Access Token
        │                                         │
        │                                         ▼
        ▼                              GET /api/v1/auth/me (Bearer Token)
[ FastAPI Backend: app.core.permissions.get_current_user ]
        │
        ├── Inspects JWT Algorithm Header:
        │     ├── alg == "RS256" (Firebase ID Token):
        │     │     └── verify_firebase_id_token(token) via Firebase Admin SDK
        │     │     └── Resolve user in PostgreSQL by firebase_uid / email
        │     │
        │     └── alg == "HS256" (Backend JWT):
        │           └── decode_access_token(token)
        │           └── Load user by UUID from PostgreSQL
        │
        ├── Enforce user.is_active == True
        │
        └── Role Verification:
              ├── require_admin: user.role == UserRole.ADMIN
              ├── require_mentor: user.role in [UserRole.MENTOR, UserRole.HOD]
              ├── require_hod: user.role == UserRole.HOD
              └── require_student: user.role == UserRole.STUDENT
```

### 4.2 Security Boundaries & Threat Modeling Analysis
1. **Public Obscurity vs Cryptographic Security**:
   - Requirement R1 removes the Admin card and provides access via clicking or pressing Enter/Space on "CCE PGPA".
   - *Threat Evaluation*: Obscuring the navigation link does NOT constitute access control. An adversary who inspects the client code, network traffic, or navigates directly to `/login/admin` can view the admin login form.
   - *Enforced Boundary*: Access control is strictly enforced cryptographically:
     - **Admin Login Form**: Accepts credentials only through Firebase Authentication. If an unauthorized user attempts direct password login on the backend (`POST /api/v1/auth/login`) with an admin account, `test_login_firebase_managed_placeholder_rejected` guarantees rejection with `401 Unauthorized` (`detail="Incorrect email or password."`).
     - **Backend Admin APIs (`/api/v1/admin/*`)**: Every administrative endpoint (users, students, mentors, HODs, components, semesters, Drive storage, allocations, audit logs) uses `current_user: User = Depends(require_admin)` (`backend/app/core/permissions.py:145`).
     - **Unauthenticated Requests**: Missing Bearer token yields `401 Unauthorized` (`detail="Not authenticated. Bearer token is missing."`). This was empirically verified against the live server.
     - **Non-Admin Requests**: Requests with valid Student, Mentor, or HOD tokens yield `403 Forbidden` (`detail="Access forbidden: operation requires one of [admin] role(s)."`).
     - **Client-Side Admin Page Guard**: `frontend/app/admin/page.tsx:105-118` redirects unauthenticated visitors to `/login`, and non-admin visitors to `/${user.role}`.
2. **Impact of UI Changes on Backend & Database**:
   - Changing the title from "CCE Achieve" to "CCE PGPA" is entirely front-end.
   - Isolating role switchers to `['student', 'mentor', 'hod']` on public login pages affects only client links.
   - Hiding the admin card on `/` affects only the list of cards displayed in `PortalSelection.tsx`.
   - Backend auth logic (`auth.py`, `permissions.py`, `security.py`, `firebase.py`), Argon2id password verification, Neon PostgreSQL user records, Google Drive provisioning, and Firebase Admin SDK are completely isolated and untouched.

---

## 5. Playwright Test Strategy & Recommended Test Matrix

To guarantee strict compliance with all Acceptance Criteria, the following comprehensive test suite must be implemented:

### 5.1 Test Suite 1: Brand & Hidden Admin Access (`brand-admin-access.spec.ts`)

| Test Case | Description & Verification Method | Expected Result |
|---|---|---|
| `TC-BRAND-01` | **Title Rendering**: Navigate to `/`, inspect the main title element. | Displays text `"CCE PGPA"`. Tagline `"Academic Performance. Structured. Simplified."`, subtitle `"PGPA MANAGEMENT SYSTEM"`, and institutional header remain present and intact. |
| `TC-BRAND-02` | **Admin Card & Word Omission**: Inspect DOM on `/`. | `#portal-card-admin` is NOT attached to DOM. Text search for `"Admin"` (case-insensitive) across visible cards, buttons, badges, and headings returns 0 matches. |
| `TC-BRAND-03` | **Hidden Admin Navigation via Click**: Click on the interactive `"CCE PGPA"` title. | Page navigates to `/login/admin`. URL is verified via `toHaveURL(/\/login\/admin/)`. |
| `TC-BRAND-04` | **Hidden Admin Navigation via Keyboard Enter**: Focus the `"CCE PGPA"` title using `page.focus()` or tab navigation, then press `Enter`. | Page navigates to `/login/admin`. |
| `TC-BRAND-05` | **Hidden Admin Navigation via Keyboard Space**: Focus the `"CCE PGPA"` title, then press `Space`. | Page navigates to `/login/admin`. |
| `TC-BRAND-06` | **Accessibility Semantics**: Inspect the `"CCE PGPA"` title element attributes. | Element has accessible role (e.g. `role="button"` or `role="link"` or interactive heading with `tabindex="0"`), clear `aria-label` (e.g. `"Admin Portal Access"` or `"CCE PGPA Portal"`), and smooth transition classes (`transition-all`, hover styling). |

### 5.2 Test Suite 2: Role Switcher Isolation (`role-navigation-isolation.spec.ts`)

| Test Case | Page Under Test | Elements Checked | Expected Result |
|---|---|---|---|
| `TC-ROLE-01` | `/login/student` | Role switcher container | Renders switch links for: **Student**, **Faculty Mentor**, **Department HOD**. Does NOT render Admin link or text. |
| `TC-ROLE-02` | `/login/mentor` | Role switcher container | Renders switch links for: **Student**, **Faculty Mentor**, **Department HOD**. Does NOT render Admin link or text. |
| `TC-ROLE-03` | `/login/hod` | Role switcher container | Renders switch links for: **Student**, **Faculty Mentor**, **Department HOD**. Does NOT render Admin link or text. |
| `TC-ROLE-04` | `/login/admin` | Page DOM | Public role switch navigation container is completely absent. Subtle "Back to Portal Selection" link is present. |
| `TC-ROLE-05` | All 4 login pages | Back link | Clicking "Back to Portal Selection" navigates back to `/` or `/login`. |

### 5.3 Test Suite 3: Desktop Viewport No-Scroll Containment (`desktop-noscroll.spec.ts`)

Target Desktop Viewports:
1. `1920x1080` (Full HD)
2. `1440x900` (MacBook / Standard Widescreen)
3. `1366x768` (Standard Laptop)
4. `1280x720` (720p HD)

Target Pages:
- `/login/student`
- `/login/mentor`
- `/login/hod`
- `/login/admin`
- `/` (Landing / Portal Selection)

Assertions for each page × desktop viewport:
```typescript
const metrics = await page.evaluate(() => {
  const doc = document.documentElement;
  return {
    scrollHeight: doc.scrollHeight,
    innerHeight: window.innerHeight,
    scrollWidth: doc.scrollWidth,
    innerWidth: window.innerWidth,
  };
});

// Vertical Containment (No vertical scrollbar)
expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.innerHeight);

// Horizontal Containment (No horizontal scrollbar)
expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth);
```

Element Visibility Assertions (`isFullyInViewport`):
- `header` is fully visible within `0 <= top && bottom <= innerHeight`.
- Institutional branding (`#department-identity-container`, SEC crest, Sairam logo) are fully visible.
- Entire login card (`#login-card` / form container) is fully visible.
- Submit button (`button[type="submit"]`) is fully visible and clickable without scrolling.
- Footer (`footer`) is fully visible within `bottom <= innerHeight`.

### 5.4 Test Suite 4: Mobile Responsiveness Constraints (`mobile-responsiveness.spec.ts`)

Target Mobile Viewports:
1. `360x800` (Standard Android)
2. `375x667` (iPhone SE)
3. `390x844` (iPhone 12/13/14)
4. `412x915` (Pixel / Samsung Galaxy)
5. `430x932` (iPhone Pro Max)

Assertions for each page × mobile viewport:
- **Zero Horizontal Overflow**: `metrics.scrollWidth <= metrics.innerWidth`.
- **Natural Vertical Scrolling**: If `metrics.scrollHeight > metrics.innerHeight`, page can scroll vertically without clipping or breaking layout.
- **Touch Target Sizing**: Submit buttons, back links, and input fields must satisfy minimum touch height `>= 40px` (or `44px`).
- **Form Layout**: Form card width conforms to viewport (`width <= innerWidth`).

### 5.5 Test Suite 5: Console Error & Visual Regression Suite

- **Console Error Listener**:
  ```typescript
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().includes('React DevTools')) {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));
  // At test completion:
  expect(consoleErrors).toEqual([]);
  ```
- **Screenshots**:
  - Captured for `/login/student`, `/login/mentor`, `/login/hod`, `/login/admin`, and `/` at `1366x768` and `1920x1080`.
  - Saved to `frontend/test-results/screenshots/`.

### 5.6 Test Suite 6: Backend Auth & RBAC Security Regression Suite

- Verify unauthenticated `GET /api/v1/admin/overview` -> `401 Unauthorized`.
- Verify unauthenticated `GET /api/v1/admin/students` -> `401 Unauthorized`.
- Verify student token to `GET /api/v1/admin/overview` -> `403 Forbidden`.
- Verify login form fields (email/reg number, password toggle, validation errors) operate correctly.

---

## 6. Implementation Guidance & Recommendations for Subsequent Agents

### 6.1 Fixing Existing Tests in `frontend/tests/responsive.spec.ts`
- **Line 238**: Update `page.click('#portal-card-admin')` to activate the hidden admin title (`page.click('#brand-title-admin-trigger')` or click "CCE PGPA") or move portal navigation to the dedicated navigation suite.
- **Update `frontend/tests/helpers/viewports.ts`**:
  - Add `{ name: 'desktop-1440x900', width: 1440, height: 900, category: 'desktop' }`.
  - Add `{ name: 'mobile-430x932', width: 430, height: 932, category: 'mobile' }`.
  - Ensure the target desktop and mobile lists exactly match R3 and R4.
- **Update `frontend/tests/helpers/assertions.ts`**:
  - Add `checkVerticalScrollContainment(page: Page)` checking `doc.scrollHeight <= window.innerHeight`.
  - Add `checkElementsFullyInViewport(page: Page, selectors: string[])`.

### 6.2 Component Adjustments for Desktop No-Scroll
In `frontend/components/RoleLoginForm.tsx`:
- Replace fixed large paddings (`pt-5 pb-3 sm:pt-6 sm:pb-4`, `p-6 sm:p-8`, `pb-10`) with compact viewport-aware Tailwind utilities or container queries (e.g. `h-[100dvh] max-h-[100dvh] flex flex-col justify-between overflow-hidden lg:overflow-visible`).
- Make the login card compact: decrease input vertical padding from `py-3` to `py-2` on compact desktop heights, adjust badge/header spacing, and eliminate unnecessary margins.
- Ensure the header, brand heading, login card, submit button, and footer fit effortlessly within 720px height (`1280x720`).
- On mobile viewports (`@media (max-width: 640px)`), allow natural scrolling with `min-h-[100dvh]` and `overflow-y-auto`.

### 6.3 Semantic Implementation of Interactive "CCE PGPA" Title
In `frontend/components/PortalSelection.tsx` and `frontend/components/RoleLoginForm.tsx`:
- Change title text from `"CCE Achieve"` to `"CCE PGPA"`.
- On `PortalSelection.tsx`, wrap or render the title as a semantic button/link:
  ```tsx
  <Link
    href="/login/admin"
    id="brand-title-admin-trigger"
    aria-label="Admin Portal Access"
    className="inline-block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-xl px-2 py-0.5 transition-all duration-200 hover:scale-[1.015] active:scale-[0.985] cursor-pointer"
  >
    <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[#800000] dark:text-[#f87171] leading-tight group-hover:text-[#a00000] dark:group-hover:text-[#fca5a5] transition-colors">
      CCE PGPA
    </h1>
  </Link>
  ```
  - Using Next.js `<Link href="/login/admin">` natively provides:
    1. Click navigation to `/login/admin`.
    2. Keyboard `Enter` activation natively.
    3. Keyboard `Space` activation (by attaching an `onKeyDown` handler that intercepts `e.key === ' '` and navigates via `router.push('/login/admin')`).
    4. Screen reader accessibility via `aria-label`.
    5. Clean fallback without breaking SSR or hydration.

### 6.4 Role Switch Navigation Isolation
In `frontend/components/RoleLoginForm.tsx`:
- Define `const PUBLIC_SWITCH_ROLES: UserRole[] = ["student", "mentor", "hod"];`.
- For `role !== 'admin'`:
  - Render switch links only for `PUBLIC_SWITCH_ROLES` (excluding `admin`).
- For `role === 'admin'`:
  - Do NOT render the switcher bar at all (`null` or only the "Back to Portal Selection" link).

---

## 7. Conclusion

The testing infrastructure and backend auth boundaries are well-architected, stable, and ready to support the new requirements. The primary engineering tasks will be:
1. Updating `PortalSelection.tsx` to display "CCE PGPA", remove the Admin card, and enable accessible click/Enter/Space navigation to `/login/admin`.
2. Updating `RoleLoginForm.tsx` to isolate switch navigation and compact the layout so it fits completely within desktop viewports down to 1280×720 without vertical scrollbars.
3. Updating existing Playwright helpers and tests (`viewports.ts`, `assertions.ts`, `responsive.spec.ts`) and introducing dedicated test specs covering hidden admin access, keyboard activation, role isolation, desktop no-scroll, mobile constraints, screenshots, and console error checks.
4. Preserving all backend auth, PostgreSQL, Firebase, and RBAC implementations without regression.

