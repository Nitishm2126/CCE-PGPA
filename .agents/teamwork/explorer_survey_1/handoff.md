# Handoff Report: Portal Selection & Branding Survey (Requirement R1)

**Agent**: teamwork_explorer (Codebase Researcher - Portal & Branding)  
**Working Directory**: `e:\Projects\pgpa web-app\.agents\teamwork\explorer_survey_1\`  
**Target Recipient**: Orchestrator (`c364f927-468b-4f3e-b56d-9af3c9f5a65e`) / Implementer Agent  
**Date**: 2026-10-31T08:20:00Z  
**Type**: Hard Handoff (Investigation Complete)

---

## 1. Observation

Direct code observations from the workspace (`e:\Projects\pgpa web-app`):

### 1.1 Portal Selection Routes and Shell Suppression
- **Root Page** (`frontend/app/page.tsx:11-13`):
  ```tsx
  export default function HomePage() {
    return <PortalSelection />;
  }
  ```
  Page metadata (`frontend/app/page.tsx:5-9`):
  ```tsx
  export const metadata: Metadata = {
    title: "CCE-PGPA Portal - Department of CCE, Sri Sairam Engineering College",
    description:
      "Official institutional access portal for CCE-PGPA Management System. Four dedicated role entry points for Students, Faculty Mentors, Department Head, and System Administrators.",
  };
  ```
- **Login Portal Page** (`frontend/app/(auth)/login/page.tsx:11-13`): Identical `<PortalSelection />` call and metadata description.
- **Global Navbar & Footer** (`frontend/components/Navbar.tsx:16-23` and `frontend/components/Footer.tsx:11-18`):
  Both components explicitly return `null` when `pathname === "/" || pathname?.startsWith("/login")`.
  Therefore, the visual presentation on `/` and `/login` is 100% controlled by `frontend/components/PortalSelection.tsx`.

### 1.2 Branding Elements in `frontend/components/PortalSelection.tsx`
- **Branding Title** (`lines 296-298`):
  ```tsx
  <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[#800000] dark:text-[#f87171] leading-tight">
    CCE Achieve
  </h1>
  ```
- **Subtitle** (`lines 299-301`):
  ```tsx
  <p className="text-[10px] sm:text-[11px] md:text-xs font-bold uppercase tracking-[0.22em] text-[#0f2942] dark:text-slate-300">
    PGPA MANAGEMENT SYSTEM
  </p>
  ```
- **Tagline** (`lines 304-306`):
  ```tsx
  <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 italic">
    &ldquo;Academic Performance. Structured. Simplified.&rdquo;
  </p>
  ```
- **Department Identity Badge** (`lines 280-292`):
  - Container `#department-identity-container` with sky blue indicator dot.
  - Text element `#department-identity-name` rendering `"DEPARTMENT OF COMPUTER AND COMMUNICATION ENGINEERING"`.
- **Institutional Header** (`lines 205-269`):
  - SEC Crest (`/images/sec logo.png`), `"Sri Sairam Engineering College"`, `"Autonomous Institution • Anna University Affiliated • NBA & NAAC 'A+'"`.
  - Desktop header lockup: `"Department of CCE"` / `"Academic Performance Portal"`.
  - Sairam official logo (`/images/logo1.png`).
- **Institutional Footer** (`lines 548-609`):
  - Founder Chairman Medallion: `/images/founder logo.png`, `"MJF. Ln. Leo Muthu"`, `"Founder Chairman • Sri Sairam Group of Institutions"`.
  - Development Attribution: `"Designed & Developed by FINEWORKS"` with sky blue dot.
  - Fine print link (`lines 596-604`):
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

### 1.3 Portal Cards & Roles Logic
- **Unauthenticated Role Array** (`frontend/components/PortalSelection.tsx:180-182`):
  ```tsx
  if (!user || isLoading) {
    return ["student", "mentor", "hod", "admin"];
  }
  ```
- **Grid Layout** (`frontend/components/PortalSelection.tsx:373-379`):
  ```tsx
  className={`grid gap-4 sm:gap-4 md:gap-5 lg:gap-5 w-full ${
    authorizedRoles.length === 1
      ? "grid-cols-1 max-w-md mx-auto"
      : authorizedRoles.length === 2
      ? "grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto"
      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 max-w-7xl mx-auto"
  }`}
  ```
- **Existing Test Suite** (`frontend/tests/responsive.spec.ts:238-245`):
  ```ts
  // 4. Navigate to Admin Portal
  await page.click('#portal-card-admin');
  await expect(page).toHaveURL(/\/login\/admin/);
  ```
  `checkPortalCardsAlignment` (`frontend/tests/helpers/assertions.ts:95-114`) only queries `#portal-card-student`, `#portal-card-mentor`, and `#portal-card-hod` and checks their vertical alignment within 5px on desktop.

---

## 2. Logic Chain

1. **Brand Update without Regressions**:
   - Observation 1.2 shows that the title is rendered as static text inside `<h1>` in `PortalSelection.tsx:297`.
   - Changing `"CCE Achieve"` to `"CCE PGPA"` directly fulfills the rebranding requirement while leaving the subtitle (`PGPA MANAGEMENT SYSTEM`), tagline, department badge, institutional header, and founder footer completely intact.

2. **Elimination of Public Admin Card**:
   - Observation 1.3 shows that the public cards are populated by `authorizedRoles` when `!user || isLoading`.
   - Changing `return ["student", "mentor", "hod", "admin"];` to `return ["student", "mentor", "hod"];` prevents the Admin card (`#portal-card-admin`) from being generated for public visitors.
   - For an authenticated administrator (`user.role === "admin"`), line 194 still returns `["admin"]`, preserving administrative session continuity.

3. **Desktop Grid Balance for 3 Cards**:
   - Observation 1.3 shows that with 3 cards, the current grid defaults to `lg:grid-cols-4`, leaving an empty 4th column.
   - Adding a specific branch `authorizedRoles.length === 3 ? "grid-cols-1 md:grid-cols-3 max-w-6xl mx-auto"` ensures the 3 cards are cleanly distributed side-by-side on desktop viewports (1280×720, 1366×768, 1920×1080), directly satisfying `checkPortalCardsAlignment` in the test suite.

4. **Guaranteed Concealment of the Word "Admin"**:
   - Observation 1.2 reveals that lines 596-604 of `PortalSelection.tsx` contain `title="System Administrator Portal Login"`, `aria-label="System Administrator Portal Login"`, and a visible link to `/login/admin`.
   - Observation 1.1 reveals that `app/page.tsx:8` and `app/(auth)/login/page.tsx:8` metadata descriptions include `"and System Administrators."`
   - To satisfy the strict criterion *"do not display 'Admin' anywhere on the public portal selection page"*, both the footer link/attributes and the page metadata descriptions must be cleansed of "Admin" / "Administrator".

5. **Interactive Title Navigation with Keyboard Accessibility**:
   - Wrapping `"CCE PGPA"` inside a semantic `<Link href="/login/admin" aria-label="CCE PGPA" id="cce-pgpa-brand-title">` within `<h1>` provides semantic linking and native `Enter` key activation.
   - Adding an `onKeyDown` handler to intercept `e.key === " "` or `"Spacebar"` and call `e.preventDefault(); (e.currentTarget as HTMLAnchorElement).click()` satisfies accessible keyboard activation via both Enter and Space.
   - Giving the link an accessible label of `aria-label="CCE PGPA"` ensures screen readers identify the element without violating the requirement to keep "Admin" unexposed on the public page.
   - Styling with `hover:opacity-90 hover:brightness-105 active:scale-[0.99] transition-all duration-200 ease-out focus-visible:ring-2 focus-visible:ring-sky-500 rounded-lg cursor-pointer motion-reduce:transition-none` delivers the requested subtle Apple-inspired micro-interaction and reduced motion safety.

6. **Impact on Tests**:
   - Observation 1.3 shows that existing Playwright tests in `responsive.spec.ts:238-245` attempt to click `#portal-card-admin`.
   - Removing `#portal-card-admin` will cause that line to fail unless updated. The test should be updated to click `#cce-pgpa-brand-title` (or activate via Enter/Space), verifying that clicking the title successfully navigates to `/login/admin`.

---

## 3. Caveats

1. **Login Form Branding Alignment**:
   `frontend/components/RoleLoginForm.tsx:214` also has `<h1 ...>CCE Achieve</h1>` and lines 688-695 contain a footer link with `title="System Administrator Portal Login"`. While R1 focuses on the main portal selection page, aligning `RoleLoginForm.tsx` branding will ensure visual consistency across the entire app.
2. **Access Control**:
   Concealing the Admin portal card and navigating via the brand title is purely presentation-layer isolation. Backend FastAPI route security (`/api/v1/admin/*`), Firebase token verification, and Next.js role guards in `app/admin/*` remain the true security boundary.

---

## 4. Conclusion

The implementation path for Requirement R1 is concise, surgical, and verified:
1. In `frontend/components/PortalSelection.tsx`:
   - Change `authorizedRoles` default to `["student", "mentor", "hod"]` (line 181).
   - Replace static `<h1>CCE Achieve</h1>` with accessible interactive link `<h1><Link href="/login/admin" id="cce-pgpa-brand-title" aria-label="CCE PGPA" ...>CCE PGPA</Link></h1>` supporting Enter and Space key activation (lines 296-298).
   - Adjust responsive grid container classes for 3 cards (`grid-cols-1 md:grid-cols-3 max-w-6xl mx-auto`) (lines 374-380).
   - Remove the `/login/admin` footer link and its "System Administrator" title/aria-label (lines 587-604).
2. In `frontend/app/page.tsx` & `frontend/app/(auth)/login/page.tsx`:
   - Update metadata description to omit "System Administrators".
3. In `frontend/tests/responsive.spec.ts`:
   - Update the admin navigation test to trigger `#cce-pgpa-brand-title` instead of `#portal-card-admin`.

A complete, detailed technical report has been written to:
`e:\Projects\pgpa web-app\.agents\teamwork\explorer_survey_1\analysis.md`

---

## 5. Verification Method

To verify these findings and the future implementation independently:
1. **Build Verification**:
   ```powershell
   npm --prefix frontend run build
   ```
   Ensures zero TypeScript or Next.js build errors.
2. **DOM & Content Verification**:
   - Inspect `/` and `/login` in browser or Playwright:
     - Verify visible `<h1>` displays `"CCE PGPA"`.
     - Verify `#portal-card-admin` does not exist in the DOM.
     - Verify `page.locator('text=Admin').count()` is 0 on the public page.
     - Verify `#cce-pgpa-brand-title` has `href="/login/admin"`, `aria-label="CCE PGPA"`.
3. **Interactive & Keyboard Verification**:
   - Click `#cce-pgpa-brand-title` → verify URL changes to `/login/admin`.
   - Focus `#cce-pgpa-brand-title` and press `Enter` → verify URL changes to `/login/admin`.
   - Focus `#cce-pgpa-brand-title` and press `Space` → verify URL changes to `/login/admin`.
4. **Card Alignment & Layout Check**:
   - Run Playwright responsive test suite:
     ```powershell
     npm --prefix frontend run test:e2e
     ```
   - Verify `checkPortalCardsAlignment` passes on desktop viewports (1280×720, 1366×768, 1920×1080) with 3 aligned cards.
