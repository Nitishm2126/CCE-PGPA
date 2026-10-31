## 2026-10-31T08:22:02Z
Read ORIGINAL_REQUEST.md at: e:\Projects\pgpa web-app\.agents\teamwork\ORIGINAL_REQUEST.md
Read PROJECT.md at: e:\Projects\pgpa web-app\.agents\teamwork\PROJECT.md
Read Survey Analysis at: e:\Projects\pgpa web-app\.agents\teamwork\explorer_survey_3\analysis.md

Your Working Directory: e:\Projects\pgpa web-app\.agents\teamwork\test_writer_e2e_1\
Your Identity: teamwork_test_writer
Your Role: E2E Test Suite Creator

Exclusive Write Ownership:
- `frontend/tests/*`
- `e:\Projects\pgpa web-app\TEST_INFRA.md`
- `e:\Projects\pgpa web-app\TEST_READY.md`
DO NOT modify any implementation source code in `frontend/components/`, `frontend/app/`, or `backend/`.

Mission:
Establish the comprehensive opaque-box E2E testing infrastructure and write the full 4-tier Playwright test suite for all features in PROJECT.md:
1. Create `TEST_INFRA.md` at project root using the standard template (Test Philosophy, Feature Inventory, Test Architecture, Real-World Scenarios, Coverage Thresholds).
2. Update `frontend/tests/helpers/viewports.ts`:
   - Add `desktop-1440x900` (`{ name: 'desktop-1440x900', width: 1440, height: 900, category: 'desktop' }`).
   - Add `mobile-430x932` (`{ name: 'mobile-430x932', width: 430, height: 932, category: 'mobile' }`).
3. Update `frontend/tests/helpers/assertions.ts`:
   - Implement `checkVerticalScrollContainment(page: Page)` checking `doc.scrollHeight <= window.innerHeight`.
   - Implement `checkElementsFullyInViewport(page: Page, selectors: string[])`.
4. Update `frontend/tests/responsive.spec.ts`:
   - Line 238: update the admin navigation test to click the interactive brand title (`#cce-pgpa-brand-title` or `#brand-title-admin-trigger`) instead of `#portal-card-admin`.
5. Author dedicated Playwright test specs in `frontend/tests/`:
   - `brand-admin-access.spec.ts` (TC-BRAND-01 to 06: "CCE PGPA" branding, public Admin card removal, zero occurrences of the word "Admin" on public landing page, click navigation to `/login/admin`, keyboard Enter activation, keyboard Space activation, accessibility labels/roles).
   - `role-navigation-isolation.spec.ts` (TC-ROLE-01 to 05: Student, Mentor, and HOD login pages switch only among each other without Admin; Admin login page has NO public role switcher; subtle back-to-portal link).
   - `desktop-noscroll.spec.ts` (TC-DESK-01 to 04: All 4 login pages + landing across 1920×1080, 1440×900, 1366×768, 1280×720 viewports; `scrollHeight <= innerHeight` and `scrollWidth <= innerWidth`; verify header, branding, role navigation, login card, button, and footer are completely visible and unclipped).
   - `mobile-responsiveness.spec.ts` (TC-MOB-01 to 05: Across 360×800, 375×667, 390×844, 412×915, 430×932 viewports; zero horizontal overflow `scrollWidth <= innerWidth`; natural vertical scrolling; touch targets >= 40px).
   - `regression-safety.spec.ts` (TC-SAFE-01 to 03: Listen for browser console errors; capture full-page/viewport screenshots of all 4 login pages at 1366×768 and 1920×1080 to `frontend/test-results/screenshots/`; verify backend RBAC HTTP 401 unauthenticated boundary on `/api/v1/admin/overview`).
6. Run the test suite using `npx playwright test` (from `frontend/`) to verify syntax, execution, and test reporting. Document current pass/fail results (some tests will naturally fail until implementation milestones are applied).
7. Create `TEST_READY.md` at project root with runner command, coverage summary, and feature checklist.
8. Deliver `handoff.md` in your working directory and message the orchestrator when complete.
