# Comprehensive Survey Report: Portal Selection & Branding Architecture (Requirement R1)

**Investigator**: Teamwork Explorer (Codebase Researcher - Portal & Branding)  
**Date**: October 31, 2026  
**Workspace**: `e:\Projects\pgpa web-app`  
**Mission**: Investigate the authoritative source of truth regarding the main portal selection page and branding architecture in preparation for Requirement R1.

---

## 1. Executive Summary

This investigation surveys the frontend codebase to establish the complete architectural blueprint for Requirement R1:
1. Transitioning the main portal branding title from **"CCE Achieve"** to **"CCE PGPA"**.
2. Preserving all official institutional branding elements (Sri Sairam Engineering College crest, autonomous accreditations, Department of CCE identity, PGPA Management System subtitle, "Academic Performance. Structured. Simplified." tagline, Founder Chairman medallion, and FineWorks development wordmark).
3. Completely removing the **Admin portal card** from the public portal selection page and guaranteeing that the word **"Admin"** / **"Administrator"** is not displayed or leaked anywhere on the public portal page (including cards, footers, tooltips, and accessibility attributes).
4. Transforming the **"CCE PGPA"** title into an interactive element with Apple-inspired micro-interactions (subtle hover, smooth transition, active press feedback, focus-visible outline) and accessible keyboard activation (**Enter** and **Space**) that navigates directly to `/login/admin`.
5. Maintaining absolute backend authentication, role authorization, and session security, recognizing that hidden navigation is purely a UX role isolation measure and not an access control boundary.

---

## 2. Portal Selection Page & Routing Architecture

### 2.1 Route Entry Points

The main portal selection view is served at two distinct routes:

1. **Root URL (`/`)**:
   - **File**: `frontend/app/page.tsx`
   - **Component**: `<PortalSelection />` (exported from `@/components/PortalSelection`)
   - **Page Metadata** (lines 5-9):
     ```typescript
     export const metadata: Metadata = {
       title: "CCE-PGPA Portal - Department of CCE, Sri Sairam Engineering College",
       description:
         "Official institutional access portal for CCE-PGPA Management System. Four dedicated role entry points for Students, Faculty Mentors, Department Head, and System Administrators.",
     };
     ```
   - *Observation*: Line 8 references "Four dedicated role entry points... and System Administrators." Updating this description will eliminate "System Administrators" from public page `<meta>` tags.

2. **Login Selection URL (`/login`)**:
   - **File**: `frontend/app/(auth)/login/page.tsx`
   - **Component**: `<PortalSelection />` (exported from `@/components/PortalSelection`)
   - **Page Metadata** (lines 5-9): Identical to `frontend/app/page.tsx`.

3. **Role Specific Login Route (`/login/[role]`)**:
   - **File**: `frontend/app/(auth)/login/[role]/page.tsx`
   - **Component**: `<RoleLoginForm role={role as UserRole} />` (exported from `@/components/RoleLoginForm`)
   - Handles `/login/student`, `/login/mentor`, `/login/hod`, and `/login/admin`.

### 2.2 Global Layout & Shell Interactions

- **Root Layout** (`frontend/app/layout.tsx`):
  - Wraps all pages in `ThemeProvider`, `AuthProvider`, `Navbar`, `EmailVerificationBanner`, `<main>`, and `Footer`.
- **Global Navbar Exclusion** (`frontend/components/Navbar.tsx`, lines 16-23):
  ```typescript
  if (
    pathname === "/" ||
    pathname?.startsWith("/login") ||
    pathname?.startsWith("/student") ||
    pathname?.startsWith("/admin")
  ) {
    return null;
  }
  ```
  *Result*: The global `Navbar` is suppressed on `/` and `/login`. The institutional header inside `PortalSelection` is the exclusive navigation header.
- **Global Footer Exclusion** (`frontend/components/Footer.tsx`, lines 11-18):
  ```typescript
  if (
    pathname === "/" ||
    pathname?.startsWith("/login") ||
    pathname?.startsWith("/student") ||
    pathname?.startsWith("/admin")
  ) {
    return null;
  }
  ```
  *Result*: The global `Footer` is suppressed on `/` and `/login`. The institutional footer inside `PortalSelection` is the exclusive footer.

---

## 3. Branding Architecture & Identity Inventory

All branding assets and typography for the portal selection page are located in `frontend/components/PortalSelection.tsx`.

| Branding Element | Current Implementation Location | Current Content & Styling | R1 Requirement Action |
| :--- | :--- | :--- | :--- |
| **Main Branding Title** | `PortalSelection.tsx:296-298` | `<h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[#800000] dark:text-[#f87171] leading-tight">CCE Achieve</h1>` | Change to `"CCE PGPA"`, convert into accessible interactive link navigating to `/login/admin` |
| **System Subtitle** | `PortalSelection.tsx:299-301` | `<p className="text-[10px] sm:text-[11px] md:text-xs font-bold uppercase tracking-[0.22em] text-[#0f2942] dark:text-slate-300">PGPA MANAGEMENT SYSTEM</p>` | **PRESERVE EXACTLY** |
| **Institutional Tagline** | `PortalSelection.tsx:304-306` | `<p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 italic">&ldquo;Academic Performance. Structured. Simplified.&rdquo;</p>` | **PRESERVE EXACTLY** |
| **Department Identity Badge** | `PortalSelection.tsx:280-292` | `#department-identity-container` & `#department-identity-name`: `"DEPARTMENT OF COMPUTER AND COMMUNICATION ENGINEERING"`, sky blue dot, pill badge | **PRESERVE EXACTLY** |
| **College Emblem & Title** | `PortalSelection.tsx:209-238` | `/images/sec logo.png`, `"Sri Sairam Engineering College"`, `"Autonomous Institution • Anna University Affiliated • NBA & NAAC 'A+'"` | **PRESERVE EXACTLY** |
| **Department Header Lockup** | `PortalSelection.tsx:242-250` | Desktop right lockup: `"Department of CCE"`, `"Academic Performance Portal"` | **PRESERVE EXACTLY** |
| **Sairam Group Logo** | `PortalSelection.tsx:256-265` | `/images/logo1.png`, alt="Sri Sairam Institutions Logo" | **PRESERVE EXACTLY** |
| **Founder Chairman Medallion** | `PortalSelection.tsx:553-571` | `/images/founder logo.png`, `"MJF. Ln. Leo Muthu"`, `"Founder Chairman • Sri Sairam Group of Institutions"` | **PRESERVE EXACTLY** |
| **FineWorks Attribution** | `PortalSelection.tsx:573-584` | `"Designed & Developed by"`, `"FINEWORKS"` with sky blue dot | **PRESERVE EXACTLY** |
| **Footer Admin Link & Label** | `PortalSelection.tsx:596-604` | `<Link href="/login/admin" title="System Administrator Portal Login" aria-label="System Administrator Portal Login">CCE Achieve System</Link>` | **REMOVE LINK & "ADMINISTRATOR" LABEL** to prevent leaking "Admin" on public portal |

---

## 4. Portal Cards Architecture & Role Configuration

### 4.1 Role Definition & Configuration Sources

1. **Role Configuration** (`frontend/lib/role-config.ts`):
   - Defines `ROLE_CONFIGS` for `"student"`, `"mentor"`, `"hod"`, `"admin"`.
   - `ALL_ROLES = ["student", "mentor", "hod", "admin"]`.
2. **Card Visual Themes** (`frontend/components/PortalSelection.tsx`, lines 37-134):
   - `PORTAL_CARD_THEMES` contains palette definitions for `student` (sky/blue), `mentor` (purple/indigo), `hod` (amber/orange), and `admin` (slate).
3. **Card Metadata** (`frontend/components/PortalSelection.tsx`, lines 137-169):
   - `PORTAL_CARD_METADATA` provides audience summaries and feature chips.
4. **Card Roles Memo** (`frontend/components/PortalSelection.tsx`, lines 179-197):
   ```typescript
   const authorizedRoles: UserRole[] = React.useMemo(() => {
     if (!user || isLoading) {
       return ["student", "mentor", "hod", "admin"];
     }
     if (user.role === "hod") {
       return ["hod", "mentor"];
     }
     if (user.role === "mentor") {
       return ["mentor"];
     }
     if (user.role === "student") {
       return ["student"];
     }
     if (user.role === "admin") {
       return ["admin"];
     }
     return [user.role];
   }, [user, isLoading]);
   ```

### 4.2 Card Rendering & Grid Behavior

The portal selection cards are rendered in lines 372-540 of `PortalSelection.tsx`.
Current grid wrapper:
```tsx
<div
  className={`grid gap-4 sm:gap-4 md:gap-5 lg:gap-5 w-full ${
    authorizedRoles.length === 1
      ? "grid-cols-1 max-w-md mx-auto"
      : authorizedRoles.length === 2
      ? "grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto"
      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 max-w-7xl mx-auto"
  }`}
>
```
Each card features:
- Interactive `<Link href={cardHref} id={`portal-card-${roleKey}`} className="apple-pressable group relative ... min-h-[220px]">`
- Top color accent bar (`h-[3px] bg-gradient-to-r ${theme.accentGradient}`)
- Role icon container with SVG graphic
- Role audience badge pill
- Portal title (`cfg.portalName`)
- Audience description (`meta.audience`)
- Academic function description (`meta.description`)
- Capability chips (`meta.tags`)
- Action CTA bar (`cfg.ctaText` with hover arrow transition)

---

## 5. Requirement R1 Detailed Analysis & Technical Blueprint

### 5.1 Changing Title to "CCE PGPA"
- Replace `CCE Achieve` with `CCE PGPA` at line 297 of `PortalSelection.tsx`.
- Keep the exact institutional typography:
  - Font weight: `font-black` (`900`)
  - Tracking: `tracking-tight`
  - Colors: Crimson maroon `#800000` in light mode, salmon red `#f87171` in dark mode.
  - Scale: `text-3xl sm:text-4xl md:text-5xl`.

### 5.2 Removing Admin Portal Card & Concealing "Admin"
1. **Public Role List Modification**:
   In `PortalSelection.tsx` line 181:
   Change:
   ```typescript
   if (!user || isLoading) {
     return ["student", "mentor", "hod", "admin"];
   }
   ```
   To:
   ```typescript
   if (!user || isLoading) {
     return ["student", "mentor", "hod"];
   }
   ```
   This immediately eliminates the Admin card (`#portal-card-admin`) from rendering on the public landing page.

2. **Responsive Grid Layout Optimization for 3 Cards**:
   With 3 cards, leaving `lg:grid-cols-4` would create an unbalanced 4-column grid with a missing 4th cell.
   The layout class logic should be updated:
   ```tsx
   authorizedRoles.length === 1
     ? "grid-cols-1 max-w-md mx-auto"
     : authorizedRoles.length === 2
     ? "grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto"
     : authorizedRoles.length === 3
     ? "grid-cols-1 md:grid-cols-3 max-w-6xl mx-auto"
     : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 max-w-7xl mx-auto"
   ```
   This cleanly organizes the 3 cards across desktop viewports (1280×720, 1366×768, 1920×1080), ensuring they sit horizontally side-by-side with identical Y positions, satisfying Playwright's `checkPortalCardsAlignment` assertion.

3. **Complete Elimination of the Word "Admin" / "Administrator"**:
   Inspection discovered three potential leakage locations on the public portal page:
   - **Footer Link** (`PortalSelection.tsx:596-604`):
     Currently renders:
     ```tsx
     <Link
       href="/login/admin"
       className="hover:underline hover:text-slate-800 dark:hover:text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-400 rounded transition-colors text-[10px] text-slate-400 dark:text-slate-500"
       title="System Administrator Portal Login"
       aria-label="System Administrator Portal Login"
     >
       CCE Achieve System
     </Link>
     ```
     *Fix*: Remove this link completely from the footer of `PortalSelection.tsx`. Replace with neutral institutional text:
     ```tsx
     <span className="text-[10px] text-slate-400 dark:text-slate-500">
       Version 1.0.0
     </span>
     ```
   - **Page Metadata Description** (`frontend/app/page.tsx:8` and `frontend/app/(auth)/login/page.tsx:8`):
     Change `"Four dedicated role entry points for Students, Faculty Mentors, Department Head, and System Administrators."` to `"Official institutional access portal for CCE-PGPA Management System. Dedicated role entry points for Students, Faculty Mentors, and Department Head."`

### 5.3 Interactive "CCE PGPA" Title Architecture

To fulfill Requirement R1 with highest craft and standards:

1. **Semantic HTML Structure**:
   Wrap the title inside an `<h1>` containing a semantic Next.js `<Link>`:
   ```tsx
   <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[#800000] dark:text-[#f87171] leading-tight">
     <Link
       href="/login/admin"
       id="cce-pgpa-brand-title"
       aria-label="CCE PGPA"
       onKeyDown={(e) => {
         if (e.key === " " || e.key === "Spacebar") {
           e.preventDefault();
           (e.currentTarget as HTMLAnchorElement).click();
         }
       }}
       className="inline-block transition-all duration-200 ease-out hover:opacity-90 active:scale-[0.99] hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 rounded-lg cursor-pointer motion-reduce:transition-none motion-reduce:transform-none select-none"
     >
       CCE PGPA
     </Link>
   </h1>
   ```

2. **Accessibility & Keyboard Activation**:
   - **Enter Key**: Handled natively by `<Link>` (`<a>` element).
   - **Space Key**: Browsers natively scroll when pressing Space on an anchor tag. The `onKeyDown` handler intercepts `Space` (`e.key === " "` or `e.key === "Spacebar"`), calls `e.preventDefault()`, and triggers `(e.currentTarget as HTMLAnchorElement).click()`.
   - **Accessible Label**: `aria-label="CCE PGPA"`. Intentionally omits the word "Admin" to satisfy the requirement: *"do not display 'Admin' anywhere on the public portal selection page"*.
   - **Focus Indicator**: `focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2` provides WCAG AA/AAA compliant high-contrast keyboard navigation cues without disrupting normal mouse click aesthetics.

3. **Micro-Interactions**:
   - `duration-200 ease-out` transition timing.
   - Micro-brightness adjustment `hover:brightness-105` and subtle opacity `hover:opacity-90`.
   - Physical tactile response on press: `active:scale-[0.99]`.
   - Strict `prefers-reduced-motion` compliance via `motion-reduce:transition-none` and `motion-reduce:transform-none`.

### 5.4 Access Control Integrity

- The hidden entry is strictly a UI navigation feature.
- Unauthenticated requests to `/admin` or `/api/v1/admin/*` are blocked by:
  1. Next.js Admin layout/route guard checking `user?.role === "admin"`.
  2. FastAPI server-side role governance: `get_current_admin_user` in backend services.
  3. Firebase token role claim validation.
- Navigating to `/login/admin` simply presents the Admin authentication form where valid administrator credentials and Firebase authentication are required.

---

## 6. Exact Files and Lines to be Modified

| File Path | Line Range | Current Content / Behavior | Proposed Modification | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| `frontend/components/PortalSelection.tsx` | 179–182 | `return ["student", "mentor", "hod", "admin"];` | Change to `return ["student", "mentor", "hod"];` | Removes Admin card from public view |
| `frontend/components/PortalSelection.tsx` | 296–298 | `<h1 ...>CCE Achieve</h1>` | Replace with `<h1 ...><Link href="/login/admin" id="cce-pgpa-brand-title" ...>CCE PGPA</Link></h1>` | Rebrands to "CCE PGPA" and implements accessible interactive navigation |
| `frontend/components/PortalSelection.tsx` | 374–380 | `authorizedRoles.length === 1 ? ... : authorizedRoles.length === 2 ? ... : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 max-w-7xl mx-auto"` | Add branch for `authorizedRoles.length === 3 ? "grid-cols-1 md:grid-cols-3 max-w-6xl mx-auto"` | Ensures 3 cards form a balanced 3-column row on desktop |
| `frontend/components/PortalSelection.tsx` | 587–606 | Footer has `<Link href="/login/admin" title="System Administrator Portal Login" aria-label="System Administrator Portal Login">CCE Achieve System</Link>` | Remove link and title/aria-label; render `<span>Version 1.0.0</span>` | Eliminates all occurrences of "Admin" / "Administrator" from public footer |
| `frontend/app/page.tsx` | 5–9 | Metadata mentions "System Administrators" | Remove "System Administrators" from description | Prevents leaking "Admin" in HTML `<head>` metadata |
| `frontend/app/(auth)/login/page.tsx` | 5–9 | Metadata mentions "System Administrators" | Remove "System Administrators" from description | Prevents leaking "Admin" in HTML `<head>` metadata |
| `frontend/tests/responsive.spec.ts` | 238–245 | `await page.click('#portal-card-admin'); await expect(page).toHaveURL(/\/login\/admin/);` | Update navigation test: click `#cce-pgpa-brand-title` to reach `/login/admin` | Adapts test suite to test hidden title navigation instead of deleted `#portal-card-admin` |

---

## 7. Downstream Dependencies & Related Requirements

1. **Requirement R2 (Login Page Role Navigation Isolation)**:
   - In `frontend/components/RoleLoginForm.tsx` lines 242-258: Role switcher iterates `ALL_ROLES` (`["student", "mentor", "hod", "admin"]`).
   - For R2, on Student, Mentor, and HOD login pages, filter `ALL_ROLES.filter(r => r !== 'admin')`.
   - On Admin login page, suppress public role switcher.
   - In `RoleLoginForm.tsx` lines 688-695: Remove footer link exposing "System Administrator Portal Login".
   - Branding title in `RoleLoginForm.tsx:214` currently says "CCE Achieve"; should be aligned with "CCE PGPA".
2. **Requirement R3 & R4 (Viewport Containment & Micro-Interactions)**:
   - Portal selection page currently fits viewport cleanly on desktop and mobile.
   - Reducing to 3 cards improves desktop viewport vertical clearance.

---

## 8. Summary of Verification Plan

1. **Visual & Text Verification**:
   - Inspect public landing page at `/` and `/login`. Verify "CCE PGPA" is rendered in maroon `#800000` / dark `#f87171`.
   - Verify `#portal-card-admin` does not exist in DOM.
   - Run text search on public DOM: assert that text and aria attributes do not contain `"Admin"` or `"Administrator"`.
2. **Keyboard & Pointer Activation**:
   - Click "CCE PGPA" → navigates to `/login/admin`.
   - Focus "CCE PGPA" via `Tab`, press `Enter` → navigates to `/login/admin`.
   - Focus "CCE PGPA" via `Tab`, press `Space` → navigates to `/login/admin`.
3. **Card Alignment & Responsiveness**:
   - On desktop viewports (1280×720, 1366×768, 1920×1080), verify Student, Mentor, and HOD cards are aligned horizontally side by side.
4. **Automated Test Suite**:
   - Run Playwright test suite `npm run test:e2e` to confirm all assertions pass.
