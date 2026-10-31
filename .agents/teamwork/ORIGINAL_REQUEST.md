# Original User Request

## Initial Request — 2026-10-31T08:08:11Z

Modify the existing CCE Achieve authentication experience to implement hidden Admin login access via the "CCE PGPA" branding title and ensure a no-scroll desktop layout across all four login pages.

Working directory: e:\Projects\pgpa web-app
Integrity mode: development

## Requirements

### R1. Brand Title & Hidden Admin Access
Change the main portal selection branding title from "CCE Achieve" to "CCE PGPA" while preserving institutional branding (Sri Sairam Engineering College header, Department of Computer and Communication Engineering identity, PGPA Management System subtitle, "Academic Performance. Structured. Simplified." tagline, FineWorks branding, and founder footer). Remove the Admin portal card from the portal selection page and do not display "Admin" anywhere on the public portal selection page. Make the "CCE PGPA" title interactive with a subtle hover effect and smooth transition, and support accessible keyboard activation via Enter or Space using a semantic element with an accessible label. Activating "CCE PGPA" must navigate to the existing Admin login route (e.g. `/login/admin` or existing route). Backend authentication, role authorization, protected Admin APIs, and existing session/token validation must continue to be enforced; hidden navigation must not be relied upon for access control.

### R2. Login Page Role Navigation Isolation
On the Student, Faculty Mentor, and Department HOD login pages, display switch options only for Student, Faculty Mentor, and Department HOD; remove Admin from switch navigation. On the Admin login page, remove public role-switch navigation, optionally providing a subtle back-to-portal-selection link. Do not expose other Admin-only navigation before authentication. Keep all existing routes and redirect behaviors intact.

### R3. Desktop Viewport No-Scroll Layout
Ensure all four login pages (Student, Faculty Mentor, Department HOD, Admin) fit completely within the desktop viewport without vertical or horizontal scrollbars across target viewports: 1920×1080, 1440×900, 1366×768, and 1280×720. Header, branding section, role navigation, entire login card, login button, and footer must remain visible and unclipped. The layout must be responsive (using `min-height: 100dvh`, CSS grid/flexbox, `flex-shrink`, viewport-aware spacing, and `min-height: 0` where needed) rather than applying `overflow: hidden` or removing form fields.

### R4. Login Card Consistency & Mobile Responsiveness
Apply a consistent, compact login layout across all four roles, preserving role icon, role title, role badge, short description, email/register number field, password field with visibility toggle, forgot password (if supported), login button, loading states, and error messages. On mobile viewports (360×800, 375×667, 390×844, 412×915, 430×932), allow natural vertical scrolling if the viewport is constrained, prevent horizontal scrolling, maintain readable typography and touch-friendly controls, and handle virtual keyboard appearance properly without forcing desktop no-scroll behavior.

### R5. Micro-Interactions & Reduced Motion
Implement subtle Apple-inspired micro-interactions: subtle title hover interaction, smooth portal switching, gentle card entrance, smooth input focus states, button press feedback, refined loading animations, and full `prefers-reduced-motion` compliance without adding unnecessary dependencies.

### R6. Regression & Functional Safety
Preserve existing backend authentication logic, password verification, Firebase integration (if used), Neon PostgreSQL configuration, Google Drive integration, existing student/mentor/HOD/admin login behaviors, dashboard routes, and role-based access control.

## Verification Resources
- Playwright test configuration: `frontend/playwright.config.ts`
- Existing test suites: `frontend/tests/`

## Acceptance Criteria

### Brand & Navigation
- [ ] Main portal selection page displays "CCE PGPA" as a visually prominent, clickable title.
- [ ] Main portal selection page does not display an Admin card or the word "Admin".
- [ ] Clicking or pressing Enter / Space on "CCE PGPA" navigates to the Admin login route.
- [ ] Student, Faculty Mentor, and Department HOD login pages show switch navigation only between those three roles, with no Admin navigation visible.
- [ ] Admin login page displays no public role-switch navigation.
- [ ] Admin backend authentication and role authorization remain intact; unauthenticated requests cannot access protected Admin APIs or views.

### Viewport & Layout
- [ ] On desktop viewports (1920×1080, 1440×900, 1366×768, 1280×720), `document.documentElement.scrollHeight <= window.innerHeight` across all four login pages.
- [ ] On desktop viewports (1920×1080, 1440×900, 1366×768, 1280×720), `document.documentElement.scrollWidth <= window.innerWidth` across all four login pages.
- [ ] On desktop viewports, header, branding, role navigation, login card, login button, and footer are completely visible with no clipping or scrollbars.
- [ ] On mobile viewports (360×800, 375×667, 390×844, 412×915, 430×932), `document.documentElement.scrollWidth <= window.innerWidth` with natural vertical scrolling enabled when content exceeds viewport height.

### Verification & Testing
- [ ] Playwright test suite passes covering branding, hidden admin access, keyboard activation, navigation isolation, desktop scroll containment, and mobile viewport constraints.
- [ ] Screenshots captured for all four login pages at 1366×768 and 1920×1080.
- [ ] No browser console errors are produced during navigation and form interactions.
- [ ] All four login forms remain functional with their respective authentication flows.
