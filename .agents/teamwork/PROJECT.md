# Project: CCE PGPA Authentication Experience & Viewport Optimization

## Architecture
- **Framework**: Next.js 16.4.1 (App Router), React 19.3.0, Tailwind CSS v4.
- **Backend**: FastAPI (Python 3.12, Uvicorn) with PostgreSQL (local/Neon) and Firebase Admin SDK.
- **Frontend Pages**:
  - `/` (`frontend/app/page.tsx`) & `/login` (`frontend/app/(auth)/login/page.tsx`): Root and login landing pages rendering `PortalSelection.tsx`. Global shell Navbar and Footer are suppressed on these routes.
  - `/login/[role]` (`frontend/app/(auth)/login/[role]/page.tsx`): Renders `RoleLoginForm.tsx` for roles `student`, `mentor`, `hod`, `admin`.
- **Security Boundary**:
  - Authentication logic in `frontend/lib/auth-context.tsx` and `backend/app/core/permissions.py`.
  - Admin login utilizes Firebase Web SDK; backend endpoints (`/api/v1/admin/*`) require `require_admin` (Bearer token validation returning HTTP 401 unauthenticated, 403 unauthorized).
  - Presentation-level isolation (hiding Admin cards/links) is strictly decoupled from cryptographic backend RBAC.
- **Test Infrastructure**:
  - Playwright (`@playwright/test` v1.64.1) under `frontend/tests/`.
  - Dev servers running on port 3000 (frontend) and port 8000 (backend).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | CCE PGPA Brand Title | Change branding title from "CCE Achieve" to "CCE PGPA" on portal selection while preserving institutional branding (SEC crest, accreditations, Department of CCE, subtitle, tagline, founder footer, FineWorks) | M1 | Survey / R1 |
| F2 | Public Admin Card Removal | Remove Admin portal card from public portal selection page; update unauthenticated role list to `["student", "mentor", "hod"]` | M1 | Survey / R1 |
| F3 | Public Word "Admin" Omission | Eliminate any text or attribute occurrences of "Admin" / "Administrator" from public landing page (footer link, page metadata) | M1 | Survey / R1 |
| F4 | 3-Card Desktop Alignment | Adjust portal selection responsive grid for 3 cards (`grid-cols-1 md:grid-cols-3 max-w-6xl mx-auto`) so cards align cleanly across desktop viewports | M1 | Survey / R1 |
| F5 | Interactive Brand Title Navigation | Wrap "CCE PGPA" in semantic accessible link with `id="cce-pgpa-brand-title"`, `aria-label="CCE PGPA"`, navigating to `/login/admin` on click | M1 | Survey / R1 |
| F6 | Keyboard Activation (Enter & Space) | Support accessible activation of "CCE PGPA" via `Enter` key natively and `Space` key via custom keydown interception | M1 | Survey / R1 |
| F7 | Role Navigation Isolation (Public Roles) | On Student, Faculty Mentor, and Department HOD login pages, display switch options ONLY for Student, Faculty Mentor, and Department HOD | M2 | Survey / R2 |
| F8 | Role Navigation Isolation (Admin Role) | On Admin login page, completely remove public role-switch navigation bar; provide subtle "Back to Portal Selection" link | M2 | Survey / R2 |
| F9 | Desktop No-Scroll Containment (1920×1080) | Ensure all 4 login pages satisfy `scrollHeight <= innerHeight` and `scrollWidth <= innerWidth` at 1920×1080 without scrollbars | M3 | Survey / R3 |
| F10 | Desktop No-Scroll Containment (1440×900) | Ensure all 4 login pages satisfy `scrollHeight <= innerHeight` and `scrollWidth <= innerWidth` at 1440×900 without scrollbars | M3 | Survey / R3 |
| F11 | Desktop No-Scroll Containment (1366×768) | Ensure all 4 login pages satisfy `scrollHeight <= innerHeight` and `scrollWidth <= innerWidth` at 1366×768 without scrollbars | M3 | Survey / R3 |
| F12 | Desktop No-Scroll Containment (1280×720) | Ensure all 4 login pages satisfy `scrollHeight <= innerHeight` and `scrollWidth <= innerWidth` at 1280×720 without scrollbars | M3 | Survey / R3 |
| F13 | Complete Element Visibility | Header, branding, role navigation, login card, inputs, submit button, and footer remain completely visible and unclipped without `overflow: hidden` | M3 | Survey / R3 |
| F14 | Login Card Compact Consistency | Apply consistent, compact login layout across all 4 roles preserving role icon, title, badge, description, inputs, toggle, button, states | M3 | Survey / R4 |
| F15 | Mobile Viewport Responsiveness | Across 360×800, 375×667, 390×844, 412×915, 430×932: `scrollWidth <= innerWidth`, natural vertical scroll enabled, touch targets >= 40-44px | M3 | Survey / R4 |
| F16 | Apple-Inspired Micro-Interactions | Title hover/brightness/scale, button press feedback, smooth focus rings, card transitions with `prefers-reduced-motion` compliance | M3 | Survey / R5 |
| F17 | Backend & Auth Regression Safety | Preserve backend auth logic, Argon2id passwords, Firebase tokens, Neon PostgreSQL, RBAC 401/403 boundaries intact | M4 | Survey / R6 |
| F18 | E2E Testing Suite & Infrastructure | Implement comprehensive Playwright test suites covering Tiers 1-4, update viewports/assertions, capture screenshots at 1366×768 and 1920×1080 | E2E-Track | Survey / AC |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Infrastructure & Suites | Update `viewports.ts`, `assertions.ts`, `responsive.spec.ts`, create dedicated test suites for R1-R6 | none | IN_PROGRESS |
| M1 | Branding & Hidden Admin Access | `PortalSelection.tsx`, `page.tsx`: "CCE PGPA" branding, card removal, no "Admin" on public page, click & Enter/Space navigation | none | READY |
| M2 | Role Switch Navigation Isolation | `role-config.ts` / `RoleLoginForm.tsx`: Public roles switch isolation (student, mentor, hod), Admin page switcher suppression | M1 | PENDING |
| M3 | Desktop Viewport No-Scroll & Mobile Layout | `RoleLoginForm.tsx`, `globals.css`: Compact responsive layout for 1280×720 to 1920×1080 desktop no-scroll, mobile natural scroll, micro-interactions | M2 | PENDING |
| M4 | Final Milestone: E2E Test Pass & Verification | 100% test pass on Playwright suites, capture screenshots, console errors check, forensic integrity audit | E2E, M3 | PENDING |

## Interface Contracts
### `PortalSelection.tsx` ↔ `RoleLoginForm.tsx` & App Router
- Target Admin login route: `/login/admin`
- Interactive title element ID: `#cce-pgpa-brand-title`
- Interactive title attributes: `aria-label="CCE PGPA"`, `href="/login/admin"`
- Key handlers: `Enter` (native Next.js Link behavior), `Space` (custom keydown preventDefault + navigation)

### `role-config.ts` ↔ `RoleLoginForm.tsx`
- `ALL_ROLES = ["student", "mentor", "hod", "admin"]` (retained for type/system completeness)
- `PUBLIC_SWITCH_ROLES = ["student", "mentor", "hod"]` (exported constant for public login navigation)
- On `/login/[role]`:
  - When `role in PUBLIC_SWITCH_ROLES`: render role switcher tabs for `PUBLIC_SWITCH_ROLES` only.
  - When `role === "admin"`: do NOT render switcher tabs. Render subtle "Back to Portal Selection" link pointing to `/`.

### Viewport Layout Contracts
- Desktop Viewports (`>= 1024px` or `min-width: 640px` with desktop height):
  - Container must use `min-h-[100dvh] flex flex-col justify-between` with compact vertical spacing.
  - Max stacked height must not exceed 580px so that `scrollHeight <= 720px`.
  - Body and root must NOT have `overflow: hidden` or `overflow-y: hidden`.
- Mobile Viewports (`< 640px`):
  - `min-h-[100dvh]` with natural vertical scrolling (`overflow-y: auto`), `scrollWidth <= innerWidth`.

## Code Layout
- `frontend/components/PortalSelection.tsx`: Owned by M1.
- `frontend/app/page.tsx` & `frontend/app/(auth)/login/page.tsx`: Owned by M1.
- `frontend/lib/role-config.ts`: Owned by M2.
- `frontend/components/RoleLoginForm.tsx`: Owned by M3.
- `frontend/app/globals.css`: Owned by M3.
- `frontend/tests/*`: Owned by E2E Testing Track.
- `backend/*`: Read-only / Regression safety verified by M4.
