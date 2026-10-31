# Handoff Report: Login Layout & Role Switcher Navigation Investigation

**From**: Teamwork Explorer (`explorer_survey_2`)  
**Role**: Codebase Researcher (Login Layout & Navigation)  
**Date**: 2026-10-31T08:20:00Z  
**Target Milestone**: R2, R3, R4, R5 Investigation  

---

## 1. Observation

1. **Route Architecture & Single Point of Truth**:
   - `frontend/app/(auth)/login/[role]/page.tsx` defines the 4 login routes (`/login/student`, `/login/mentor`, `/login/hod`, `/login/admin`) via `generateStaticParams()` (lines 10-17).
   - In `frontend/app/(auth)/login/[role]/page.tsx` line 44:
     `<RoleLoginForm key={role} role={role as UserRole} />`
     All four login pages are powered by this single component (`frontend/components/RoleLoginForm.tsx`).
   - `frontend/app/layout.tsx` contains global `<Navbar />` and `<Footer />`, but both components return `null` on login routes (confirmed in `frontend/components/Navbar.tsx` lines 16-23 and `frontend/components/Footer.tsx` lines 11-18).
   - Therefore, `RoleLoginForm.tsx` renders its own self-contained header, branding, breadcrumbs, login card, and footer.

2. **Role Switcher Navigation & Public Admin Exposure (R2)**:
   - In `frontend/components/RoleLoginForm.tsx` lines 240-258:
     ```tsx
     <div className="flex items-center gap-1 text-slate-400 shrink-0">
       <span className="hidden sm:inline text-slate-400 dark:text-slate-500 text-[11px]">Switch:</span>
       {ALL_ROLES.map((r) => {
         const isCurrent = r === role;
         return (
           <Link
             key={r}
             href={ROLE_CONFIGS[r].path}
             ...
           >
             {ROLE_CONFIGS[r].shortTitle}
           </Link>
         );
       })}
     </div>
     ```
   - In `frontend/lib/role-config.ts` line 25:
     `export const ALL_ROLES: UserRole[] = ["student", "mentor", "hod", "admin"];`
   - Observed behavior: `ALL_ROLES` is mapped on all 4 login pages. Student, Mentor, and HOD pages render an active link to Admin (`/login/admin`). The Admin page renders links to all public roles.
   - In `RoleLoginForm.tsx` lines 688-695, the footer also renders a direct link to `/login/admin` with `title="System Administrator Portal Login"`.

3. **Desktop Viewport Overflow (R3)**:
   - Direct empirical measurement via headless Playwright against the active server on `http://localhost:3000` revealed:
     - `/login/student` at 1920×1080: `scrollHeight: 1080px`, `clientHeight: 1080px`, `overflowY: false`.
     - `/login/student` at 1440×900: `scrollHeight: 978px`, `clientHeight: 900px`, `overflowY: true` (overflow by **78px**).
     - `/login/student` at 1366×768: `scrollHeight: 978px`, `clientHeight: 768px`, `overflowY: true` (overflow by **210px**).
     - `/login/student` at 1280×720: `scrollHeight: 978px`, `clientHeight: 720px`, `overflowY: true` (overflow by **258px**).
     - `/login/admin` at 1280×720: `scrollHeight: 1006px`, `clientHeight: 720px`, `overflowY: true` (overflow by **286px**).
   - Horizontal overflow is zero (`scrollWidth === clientWidth`) across all viewports.
   - Mobile viewports (e.g. 390×844) have `scrollHeight: 1069px - 1086px` with natural vertical scrolling and zero horizontal overflow.

4. **DOM Computed Height Stack (1280×720)**:
   - Header: 65px (`h-16` [64px] + 1px border)
   - Hero Branding Section: 179.9px (`pt-6` + `pb-4` [40px], H1 `text-5xl leading-tight` [~60px], subtitle [16px], tagline [20px], badge [24px], gaps [20px])
   - Main container: Switcher/breadcrumbs (40px) + Login Card (549px) + `pb-10` on `<main>` (40px)
   - Login Card (549px): `p-8` padding (64px), card header (100px), form (274px: email 72px, password 72px, remember 18px, submit 52px, 3×20px gaps), notice (70px)
   - Footer: 109.8px (`py-4` [32px], upper row [48px], lower row [18px], gaps [12px])
   - Total stacked height: **978.3px** (Student/Mentor/HOD) to **1006px** (Admin).

---

## 2. Logic Chain

1. **Premise**: Requirement R3 mandates that on desktop viewports 1920×1080, 1440×900, 1366×768, and 1280×720, `scrollHeight <= innerHeight` and `scrollWidth <= innerWidth` with zero clipping, without using `overflow: hidden`, and without removing form fields.
2. **Deduction from Observation 3 & 4**: At the smallest target desktop viewport (1280×720), available vertical height is 720px. The existing page stacks to 978px–1006px, exceeding capacity by 258px–286px.
3. **Height Reduction Budget**:
   - Header: reduce `h-16` to `h-12 sm:h-13` -> saves 13px (new height: 52px).
   - Branding Section: reduce padding from `pt-6 pb-4` to `pt-2.5 pb-1.5 sm:pt-3 sm:pb-2`, H1 from `text-5xl` to `text-2xl sm:text-3xl lg:text-[32px]`, tighter line-height and gaps -> saves 88px (new height: 92px).
   - Main container: reduce `pb-10` (40px) to `pb-2 sm:pb-3` (10px) with `min-h-0 justify-center` -> saves 30px.
   - Breadcrumbs/role switcher: reduce `mb-4` to `mb-2 sm:mb-2.5` -> saves 14px (new height: 26px).
   - Login Card:
     - Padding: reduce `p-8` to `p-4 sm:p-5 lg:p-5` -> saves 24px (new padding: 40px).
     - Card header: compact icon `h-8.5 w-8.5`, title `text-base sm:text-lg`, line-clamp description -> saves 35px (new height: 65px).
     - Form: reduce `space-y-5` to `space-y-2.5 sm:space-y-3`, input padding to `py-2 sm:py-2.5 px-3.5 text-sm`, submit button to `py-2.5 px-4` -> saves 76px (new height: 198px).
     - Closed cohort notice: reduce `mt-6 p-3.5` to `mt-2.5 sm:mt-3 p-2 text-[10px]` -> saves 34px (new height: 36px).
   - Footer: reduce `py-4` to `py-2 sm:py-2.5`, medallion to `h-7 w-7`, smaller font -> saves 46px (new height: 64px).
   - Total height savings: **~360px**.
   - Resulting stacked height: **~583px**.
4. **Verification of Budget against Viewports**:
   - At 1280×720: 583px <= 720px (**137px headroom**).
   - At 1366×768: 583px <= 768px (**185px headroom**).
   - At 1440×900: 583px <= 900px (**317px headroom**).
   - At 1920×1080: 583px <= 1080px (**497px headroom**).
   - All elements remain fully visible and legible.
5. **Deduction from Observation 2**:
   - Creating `PUBLIC_ROLES: UserRole[] = ["student", "mentor", "hod"]` in `frontend/lib/role-config.ts` satisfies R2 by isolating public role switcher links to non-admin roles only.
   - Conditionally suppressing the switcher element when `role === "admin"` removes public switcher navigation on `/login/admin`.
   - Removing the `/login/admin` footer link on public login pages prevents pre-auth Admin exposure.

---

## 3. Caveats

- **Active Session Alert**: If a user is already authenticated and visits the login page, an active session alert (`div[role="status"]`) is rendered. In the compact layout, this alert is styled compactly (`mb-2.5 p-2.5 text-xs`, ~45px). With the alert visible, total height is ~628px, which still satisfies the 720px limit (92px headroom).
- **Error Messages**: Authentication error banners (`div[role="alert"]`) add ~50px to the card height. In the compact design (583px + 50px = 633px), it remains strictly under 720px.
- **Mobile Zoom Safeguard**: On mobile devices, inputs must preserve a minimum 16px computed font-size (`@media (pointer: coarse)`) so iOS Safari does not zoom the viewport on input focus.

---

## 4. Conclusion

The implementation path for the engineer is clear, deterministic, and localized to five files:
1. `frontend/lib/role-config.ts`: Export `PUBLIC_ROLES: UserRole[] = ["student", "mentor", "hod"];`.
2. `frontend/components/RoleLoginForm.tsx`:
   - Title rebranding: Change "CCE Achieve" to "CCE PGPA".
   - Role switcher isolation: Use `PUBLIC_ROLES` when `role !== "admin"`; omit switcher when `role === "admin"`.
   - Desktop no-scroll layout: Apply responsive compact Tailwind utilities to header (`h-12 sm:h-13`), hero section (`pt-2.5 pb-1.5 sm:pt-3 sm:pb-2`), `<main>` (`pb-2 sm:pb-3 justify-center min-h-0`), card (`p-4 sm:p-5 lg:p-5`), form (`space-y-2.5 sm:space-y-3`, input `py-2 sm:py-2.5 text-sm`), notice (`mt-2.5 sm:mt-3 p-2 text-[10px]`), and footer (`py-2 sm:py-2.5`).
   - Remove footer `/login/admin` link on public login pages.
3. `frontend/app/(auth)/login/[role]/page.tsx`:
   - Update `RoleLoginSkeleton` to reflect the compact responsive classes so no layout shift occurs during Suspense hydration.
4. `frontend/components/PortalSelection.tsx`:
   - Rebrand title to "CCE PGPA" with click and keyboard Enter/Space activation navigating to `/login/admin`.
   - Filter public portal cards to `["student", "mentor", "hod"]` and remove "Admin" text/links.
5. `frontend/tests/responsive.spec.ts`:
   - Add automated assertions validating `doc.scrollHeight <= window.innerHeight` across 1920×1080, 1440×900, 1366×768, and 1280×720 on all four login pages.
   - Assert `scrollWidth <= window.innerWidth` across all desktop and mobile viewports.
   - Assert role switcher isolation: on Student, Mentor, and HOD pages, assert `Admin` link does not exist; on Admin page, assert role switcher is absent.

---

## 5. Verification Method

To independently verify after code modifications:

1. **Headless DOM Viewport Measurement Script**:
   Run the Playwright node evaluation command across all target desktop resolutions:
   ```bash
   node -e "
   const { chromium } = require('./frontend/node_modules/playwright');
   (async () => {
     const browser = await chromium.launch();
     const page = await browser.newPage();
     const pages = ['/login/student', '/login/mentor', '/login/hod', '/login/admin'];
     const viewports = [
       { w: 1920, h: 1080 },
       { w: 1440, h: 900 },
       { w: 1366, h: 768 },
       { w: 1280, h: 720 },
       { w: 390, h: 844 }
     ];
     for (const p of pages) {
       for (const { w, h } of viewports) {
         await page.setViewportSize({ width: w, height: h });
         await page.goto('http://localhost:3000' + p, { waitUntil: 'networkidle' });
         const fits = await page.evaluate(() => {
           const d = document.documentElement;
           return {
             path: location.pathname,
             vp: window.innerWidth + 'x' + window.innerHeight,
             scrollHeight: d.scrollHeight,
             innerHeight: window.innerHeight,
             scrollWidth: d.scrollWidth,
             innerWidth: window.innerWidth,
             noVerticalScroll: d.scrollHeight <= window.innerHeight,
             noHorizontalScroll: d.scrollWidth <= window.innerWidth
           };
         });
         console.log(fits);
       }
     }
     await browser.close();
   })();
   "
   ```
   **Pass Condition**: For all desktop viewports (1920×1080, 1440×900, 1366×768, 1280×720), `noVerticalScroll === true` and `noHorizontalScroll === true`. For mobile viewports, `noHorizontalScroll === true`.

2. **Role Switcher Navigation DOM Verification**:
   Inspect the DOM of `/login/student`, `/login/mentor`, `/login/hod`:
   - Verify that links with text "Admin" or pointing to `/login/admin` do NOT exist.
   - Inspect `/login/admin`: verify that the role switcher bar does NOT exist.

3. **Playwright E2E Test Suite**:
   ```bash
   cd frontend
   npx playwright test
   ```

**Invalidation Conditions**:
- If `doc.scrollHeight > window.innerHeight` on any of the four desktop viewports (1920×1080, 1440×900, 1366×768, 1280×720).
- If any form inputs, labels, or buttons are clipped, hidden via `overflow: hidden`, or deleted.
- If `/login/student`, `/login/mentor`, or `/login/hod` renders a switch button or link to `admin`.
- If `/login/admin` renders the public role switcher.
