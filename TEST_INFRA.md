# Test Infrastructure Architecture & Specification

## 1. Test Philosophy

The testing infrastructure for the CCE PGPA Web Application follows strict **opaque-box end-to-end (E2E) verification principles**:
- **Black-Box Observable Verification**: Tests interact with the application strictly from the perspective of an end-user and external HTTP client. No private component state or internal React props are probed. Tests observe DOM elements, bounding boxes, accessibility attributes, keyboard dispatch events, viewport layout metrics (`scrollHeight`, `scrollWidth`, `innerHeight`, `innerWidth`), and HTTP responses.
- **Progressive Testability & Deterministic Oracles**: Tests reflect the explicit requirements and acceptance criteria in `PROJECT.md` and `ORIGINAL_REQUEST.md`. Prior to milestone implementations (M1–M3), new tests establish an authoritative baseline with expected failures corresponding to unmerged features, while existing unaffected tests continue to pass.
- **Self-Contained & Isolated Execution**: Playwright runs sequentially (`workers: 1`, `fullyParallel: false`) against the live development server (`http://localhost:3000`) and FastAPI backend (`http://localhost:8000`), avoiding race conditions in session states or viewport resizes.
- **Zero Mocking of Layout & Micro-Interactions**: Real browser engines (Chromium) compute actual layout geometries, flexbox distributions, and CSS box models across exact device viewport dimensions.

---

## 2. Feature Inventory & Test Mapping

The test suite maps directly to features F1 through F18 as defined in `PROJECT.md`:

| Feature ID | Feature Name | Test Specification File | Test Case IDs | Milestone |
|---|---|---|---|---|
| **F1** | CCE PGPA Brand Title | `frontend/tests/brand-admin-access.spec.ts` | `TC-BRAND-01` | M1 |
| **F2** | Public Admin Card Removal | `frontend/tests/brand-admin-access.spec.ts` | `TC-BRAND-02` | M1 |
| **F3** | Public Word "Admin" Omission | `frontend/tests/brand-admin-access.spec.ts` | `TC-BRAND-02` | M1 |
| **F4** | 3-Card Desktop Alignment | `frontend/tests/responsive.spec.ts` | Portal Cards Alignment | M1 |
| **F5** | Interactive Brand Title Navigation | `frontend/tests/brand-admin-access.spec.ts` | `TC-BRAND-03` | M1 |
| **F6** | Keyboard Activation (Enter & Space) | `frontend/tests/brand-admin-access.spec.ts` | `TC-BRAND-04`, `TC-BRAND-05`, `TC-BRAND-06` | M1 |
| **F7** | Role Switch Navigation Isolation | `frontend/tests/role-navigation-isolation.spec.ts` | `TC-ROLE-01`, `TC-ROLE-02`, `TC-ROLE-03` | M2 |
| **F8** | Admin Role Switch Isolation & Back Link | `frontend/tests/role-navigation-isolation.spec.ts` | `TC-ROLE-04`, `TC-ROLE-05` | M2 |
| **F9** | Desktop No-Scroll (1920×1080) | `frontend/tests/desktop-noscroll.spec.ts` | `TC-DESK-01` | M3 |
| **F10** | Desktop No-Scroll (1440×900) | `frontend/tests/desktop-noscroll.spec.ts` | `TC-DESK-02` | M3 |
| **F11** | Desktop No-Scroll (1366×768) | `frontend/tests/desktop-noscroll.spec.ts` | `TC-DESK-03` | M3 |
| **F12** | Desktop No-Scroll (1280×720) | `frontend/tests/desktop-noscroll.spec.ts` | `TC-DESK-04` | M3 |
| **F13** | Complete Element Visibility | `frontend/tests/desktop-noscroll.spec.ts` | `TC-DESK-01` to `TC-DESK-04` | M3 |
| **F14** | Login Card Consistency | `frontend/tests/desktop-noscroll.spec.ts` | `TC-DESK-01` to `TC-DESK-04` | M3 |
| **F15** | Mobile Viewport Responsiveness | `frontend/tests/mobile-responsiveness.spec.ts` | `TC-MOB-01` to `TC-MOB-05` | M3 |
| **F16** | Micro-Interactions & Reduced Motion | `frontend/tests/brand-admin-access.spec.ts` | `TC-BRAND-06` | M3 |
| **F17** | Backend & Auth Regression Safety | `frontend/tests/regression-safety.spec.ts` | `TC-SAFE-01`, `TC-SAFE-03` | M4 |
| **F18** | E2E Testing Suite & Infrastructure | `frontend/tests/*` | Full Suite (Tiers 1-4) | E2E Track |

---

## 3. Test Architecture & Directory Layout

### 3.1 Directory Structure
```
frontend/tests/
├── helpers/
│   ├── viewports.ts              # Target device & viewport definitions (Desktop, Tablet, Mobile)
│   └── assertions.ts             # Custom DOM assertions (Horizontal/Vertical overflow, Element visibility)
├── responsive.spec.ts            # Baseline responsive tests (101 tests across viewports)
├── brand-admin-access.spec.ts     # Tier 1: Branding, hidden admin access, keyboard activation (Enter/Space)
├── role-navigation-isolation.spec.ts # Tier 2: Role switcher isolation across login pages
├── desktop-noscroll.spec.ts      # Tier 3: Desktop no-scroll containment (1920x1080 to 1280x720)
├── mobile-responsiveness.spec.ts # Tier 3: Mobile responsiveness (360x800 to 430x932)
└── regression-safety.spec.ts     # Tier 4: Console error audit, visual screenshots, backend RBAC
```

### 3.2 Viewport Matrix
- **Target Desktop Viewports (Strict No-Scroll: `scrollHeight <= innerHeight` and `scrollWidth <= innerWidth`)**:
  - `desktop-1920x1080` (1920 × 1080, Full HD)
  - `desktop-1440x900` (1440 × 900, Standard Widescreen / MacBook)
  - `desktop-1366x768` (1366 × 768, Standard Laptop)
  - `desktop-1280x720` (1280 × 720, 720p HD)
- **Target Mobile Viewports (Zero Horizontal Scroll: `scrollWidth <= innerWidth`, Natural Vertical Scroll)**:
  - `mobile-360x800` (360 × 800, Android baseline)
  - `mobile-375x667` (375 × 667, iPhone SE)
  - `mobile-390x844` (390 × 844, iPhone 12/13/14)
  - `mobile-412x915` (412 × 915, Samsung Galaxy / Pixel)
  - `mobile-430x932` (430 × 932, iPhone Pro Max)
- **Target Tablet Viewport**:
  - `tablet-768x1024` (768 × 1024, iPad Portrait)

### 3.3 Test Execution Engine
- **Runner**: Playwright `@playwright/test` v1.64.1
- **Configuration**: `frontend/playwright.config.ts`
- **Base URL**: `http://localhost:3000` (with `reuseExistingServer: true`)
- **Reporters**: List, JSON (`frontend/test-results/results.json`), HTML (`frontend/test-results/html-report`)
- **Visual Artifacts**: Viewport screenshots captured to `frontend/test-results/screenshots/`

---

## 4. Real-World Scenarios Tested

1. **Brand Discovery & Hidden Administrative Access**:
   - A standard user (student/faculty) navigates to the portal landing page (`/` or `/login`). The user sees "CCE PGPA", institutional emblems, department identifiers, and the 3 public portal cards (Student, Faculty Mentor, Department HOD). No card or text mentioning "Admin" is visible.
   - An administrator clicks the "CCE PGPA" heading or tabs to it and presses `Enter` or `Space`. The browser immediately navigates to `/login/admin`.
2. **Role Navigation Switching**:
   - A user visiting `/login/student`, `/login/mentor`, or `/login/hod` uses the top role switcher. Only Student, Mentor, and HOD tabs are offered; Admin is never shown.
   - A user on `/login/admin` sees no role switcher tabs, preserving role isolation, with a single "Back to Portal Selection" breadcrumb link.
3. **Desktop Display Without Scrolling**:
   - A user opens any of the 4 login pages or the landing page on displays ranging from 1280×720 up to 1920×1080.
   - The entire page (institutional header, department title, login card, inputs, submit button, and footer) fits within the viewport without triggering document scrollbars. No content is clipped.
4. **Mobile Responsiveness**:
   - A student accessing the login form on a mobile phone (360px to 430px wide) experiences zero horizontal scroll. When the screen height is compact, natural vertical scrolling allows easy access to all form controls and footer content.
5. **Security Regression & Backend RBAC**:
   - Direct unauthenticated API requests to `/api/v1/admin/overview` return `HTTP 401 Unauthorized`. Client-side navigation obscurity does not substitute for cryptographic RBAC tokens.

---

## 5. Coverage Thresholds & Reporting

- **Assertion Precision**: 1px tolerance for sub-pixel layout rounding in horizontal overflow. Zero tolerance for unclipped element viewport boundary breaches.
- **Console Errors**: 0 unhandled console errors or page errors during test execution.
- **Reporting Commands**:
  - Run all tests: `npm run test:e2e` (from `frontend/`)
  - Run individual test suites: `npx playwright test tests/<spec-file>`
  - View HTML Report: `npx playwright show-report test-results/html-report`
