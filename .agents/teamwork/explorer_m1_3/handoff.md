# Handoff Report: Milestone 1 Word "Admin" Omission & Accessible Keyboard Activation

**Author**: Milestone 1 Explorer (`teamwork_explorer`)  
**Role**: Word Omission & Keyboard Activation  
**Working Directory**: `e:\Projects\pgpa web-app\.agents\teamwork\explorer_m1_3\`  
**Date**: 2026-10-31  
**Recipient**: Orchestrator (`c364f927-468b-4f3e-b56d-9af3c9f5a65e`)  

---

## 1. Observation

Direct observations from codebase inspection across public landing routes (`/` and `/login`):

1. **Footer Link in `frontend/components/PortalSelection.tsx` (lines 587–606)**:
   ```tsx
   587:           {/* Lower Footer: Legal, Department Notice & Subtle Admin Login */}
   ...
   596:               <Link
   597:                 href="/login/admin"
   598:                 className="hover:underline hover:text-slate-800 dark:hover:text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-400 rounded transition-colors text-[10px] text-slate-400 dark:text-slate-500"
   599:                 title="System Administrator Portal Login"
   600:                 aria-label="System Administrator Portal Login"
   601:               >
   602:                 CCE Achieve System
   603:               </Link>
   ```
   Directly observed: `title="System Administrator Portal Login"` and `aria-label="System Administrator Portal Login"` leak "System Administrator" to screen readers and automated DOM test queries. Additionally, the footer exposes a direct link to `/login/admin` with outdated text `CCE Achieve System`.

2. **Metadata Description in `frontend/app/page.tsx` (lines 5–9)**:
   ```ts
   5: export const metadata: Metadata = {
   6:   title: "CCE-PGPA Portal - Department of CCE, Sri Sairam Engineering College",
   7:   description:
   8:     "Official institutional access portal for CCE-PGPA Management System. Four dedicated role entry points for Students, Faculty Mentors, Department Head, and System Administrators.",
   9: };
   ```
   Directly observed: Line 8 includes `"System Administrators."` and `"Four dedicated role entry points"`. This is injected into `<meta name="description">` on the root page `/`.

3. **Metadata Description in `frontend/app/(auth)/login/page.tsx` (lines 5–9)**:
   ```ts
   5: export const metadata: Metadata = {
   6:   title: "CCE-PGPA Portal - Department of CCE, Sri Sairam Engineering College",
   7:   description:
   8:     "Official institutional access portal for CCE-PGPA Management System. Four dedicated role entry points for Students, Faculty Mentors, Department Head, and System Administrators.",
   9: };
   ```
   Directly observed: Line 8 contains the identical text leaking `"System Administrators."` on `/login`.

4. **Brand Heading in `frontend/components/PortalSelection.tsx` (lines 296–298)**:
   ```tsx
   296:             <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[#800000] dark:text-[#f87171] leading-tight">
   297:               CCE Achieve
   298:             </h1>
   ```
   Directly observed: Rendered as static `<h1>CCE Achieve</h1>` without interactive link, keyboard handler, or `id="cce-pgpa-brand-title"`.

5. **Layout Shell Suppression**:
   In `frontend/components/Navbar.tsx` (line 17), `frontend/components/Footer.tsx` (line 12), and `frontend/components/EmailVerificationBanner.tsx` (line 14), all three components explicitly return `null` on `pathname === "/" || pathname?.startsWith("/login")`.
   Directly observed: Global Navbar and global Footer are suppressed; no additional "Admin" text leaks from the global layout shell onto `/` or `/login`.

---

## 2. Logic Chain

1. **Word Omission on Public Landing Page**:
   - *Premise*: Requirement R1 and Acceptance Criteria stipulate that the public portal selection page must not display "Admin" or "Administrator" anywhere in visible text, attributes, or metadata.
   - *Step 1*: Based on Observation 1, the footer link has `title="System Administrator Portal Login"`, `aria-label="System Administrator Portal Login"`, and `href="/login/admin"`. Replacing this `<Link>` with a static `<span>CCE PGPA</span>` eliminates both attributes and the redundant navigation link.
   - *Step 2*: Based on Observations 2 and 3, both `frontend/app/page.tsx` and `frontend/app/(auth)/login/page.tsx` inject `"System Administrators"` into `<head>` metadata. Modifying the description to `"Official institutional access portal for CCE-PGPA Management System. Dedicated role entry points for Students, Faculty Mentors, and Department Head."` eliminates "System Administrators" and corrects the count from "Four" to "Three" public roles.
   - *Step 3*: Based on Observation 5, no other layout components render on `/` or `/login`. Combined with `explorer_m1_2`'s card removal (changing unauthenticated `authorizedRoles` to `["student", "mentor", "hod"]`), the public page is completely purified of all occurrences of "Admin" and "Administrator".

2. **Accessible Keyboard Activation**:
   - *Premise*: Requirement R1 requires that activating "CCE PGPA" navigates to `/login/admin` via Enter or Space using a semantic element with an accessible label.
   - *Step 1*: Based on Observation 4, the brand title is currently a static `<h1>`. Wrapping `"CCE PGPA"` in Next.js `<Link href="/login/admin" id="cce-pgpa-brand-title" aria-label="CCE PGPA">` establishes a semantic interactive anchor tag.
   - *Step 2*: HTML anchor tags natively activate on `Enter` keypress, causing the browser and Next.js router to navigate to `href="/login/admin"` without extra handlers.
   - *Step 3*: HTML anchor tags do *not* activate on `Space` (defaulting to window scrolling). Attaching an `onKeyDown` handler that intercepts `(e.key === ' ' || e.key === 'Spacebar')`, calls `e.preventDefault()`, and executes `router.push('/login/admin')` ensures keyboard users and accessibility devices achieve identical navigation behavior on Space.
   - *Step 4*: Providing `aria-label="CCE PGPA"` fulfills WCAG accessibility without revealing "Admin" to screen reader users or automated DOM text scanners.

---

## 3. Caveats

1. **Authenticated Admin Sessions**:
   When an admin is authenticated (`user.role === 'admin'`), the portal selection page displays the admin dashboard card as part of their active session (`authorizedRoles = ['admin']`). This is intentional and compliant, as Requirement R1 applies strictly to unauthenticated public visitors.
2. **Role Switcher Navigation on Subsequent Login Pages**:
   The isolation of role switchers on `/login/student`, `/login/mentor`, and `/login/hod` is handled in Milestone 2 (`RoleLoginForm.tsx` & `role-config.ts`), not in `PortalSelection.tsx`.
3. **Card Grid Layout & Styling Coordination**:
   The 3-card grid container (`grid-cols-1 md:grid-cols-3 max-w-6xl mx-auto`) is handled by `explorer_m1_2`, and title hover micro-interaction tokens are aligned with `explorer_m1_1`.

---

## 4. Conclusion

The word "Admin" and "Administrator" can be 100% eliminated from the public landing page by applying targeted changes to:
1. `frontend/components/PortalSelection.tsx`:
   - Import `useRouter` from `"next/navigation"`.
   - Add `handleBrandKeyDown` with Space key `e.preventDefault()` + `router.push("/login/admin")`.
   - Update `<h1>` to contain `<Link href="/login/admin" id="cce-pgpa-brand-title" aria-label="CCE PGPA" onKeyDown={handleBrandKeyDown}>CCE PGPA</Link>`.
   - Replace footer `<Link href="/login/admin">` with `<span>CCE PGPA</span>`, removing `title` and `aria-label`.
2. `frontend/app/page.tsx`:
   - Cleanse metadata description string.
3. `frontend/app/(auth)/login/page.tsx`:
   - Cleanse metadata description string.

The complete code diffs are ready and documented in `analysis.md`.

---

## 5. Verification Method

### Automated Playwright Tests:
1. Run Playwright brand and keyboard access suite:
   ```bash
   cd "e:\Projects\pgpa web-app\frontend"
   npx playwright test brand-admin-access.spec.ts
   ```
2. Verify zero occurrences of "Admin" in body text and attributes:
   - Check `document.body.innerText.match(/\badmin\b/i)` returns `null`.
   - Check all `[aria-label]` attributes do not contain `"Admin"` or `"Administrator"`.
   - Check all `[title]` attributes do not contain `"Admin"` or `"Administrator"`.
   - Check `<meta name="description">` content does not contain `"Admin"` or `"Administrator"`.
3. Verify Keyboard Navigation:
   - Focus `#cce-pgpa-brand-title`, dispatch `page.keyboard.press('Space')` -> verify navigation to `/login/admin`.
   - Focus `#cce-pgpa-brand-title`, dispatch `page.keyboard.press('Enter')` -> verify navigation to `/login/admin`.
