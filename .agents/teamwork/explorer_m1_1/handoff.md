# Milestone 1 Handoff Report: Brand Title & Hidden Admin Access

**Agent**: teamwork_explorer (`explorer_m1_1`)  
**Role**: Milestone 1 Explorer (Brand Title & Institutional Integrity)  
**Parent Conversation ID**: `c364f927-468b-4f3e-b56d-9af3c9f5a65e`  
**Target Milestone**: Milestone 1 (Features F1–F6)  
**Type**: Hard Handoff (Investigation & Architecture Complete)

---

## 1. Observation

1. **Title & Branding Structure (`frontend/components/PortalSelection.tsx:280-307`)**:
   - Lines 280–293: The department pill badge container is tagged with `id="department-identity-container"`, and the child `span` has `id="department-identity-name"` containing verbatim: `"DEPARTMENT OF COMPUTER AND COMMUNICATION ENGINEERING"`.
   - Lines 296–298: The branding title is rendered as static text inside `<h1>`:
     ```tsx
     <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[#800000] dark:text-[#f87171] leading-tight">
       CCE Achieve
     </h1>
     ```
   - Lines 299–302: The subtitle is verbatim: `<p className="text-[10px] sm:text-[11px] md:text-xs font-bold uppercase tracking-[0.22em] text-[#0f2942] dark:text-slate-300">PGPA MANAGEMENT SYSTEM</p>`.
   - Lines 304–306: The institutional tagline is verbatim: `<p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 italic">&ldquo;Academic Performance. Structured. Simplified.&rdquo;</p>`.

2. **Public Role List & Admin Card Exposure (`frontend/components/PortalSelection.tsx:179-182`)**:
   - `authorizedRoles` memo computes:
     ```tsx
     if (!user || isLoading) {
       return ["student", "mentor", "hod", "admin"];
     }
     ```
     This causes `#portal-card-admin` to render on the unauthenticated public portal page.

3. **Public Grid Layout Container (`frontend/components/PortalSelection.tsx:373-380`)**:
   - When role count is not 1 or 2, the grid renders `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 max-w-7xl mx-auto`. With 3 roles, desktop viewports (1280px, 1366px, 1440px, 1920px) leave an empty 4th column slot.

4. **Public Admin Wordmark & Footer Leakage (`frontend/components/PortalSelection.tsx:596-604`)**:
   - Lines 596–604 contain a public hyperlink:
     ```tsx
     <Link
       href="/login/admin"
       className="..."
       title="System Administrator Portal Login"
       aria-label="System Administrator Portal Login"
     >
       CCE Achieve System
     </Link>
     ```
   - Metadata in `frontend/app/page.tsx:8` and `frontend/app/(auth)/login/page.tsx:8`: Description states `"Four dedicated role entry points for Students, Faculty Mentors, Department Head, and System Administrators."`

5. **Existing Regression Suite Constraints (`frontend/tests/responsive.spec.ts:98-159`)**:
   - Check 4 asserts `#department-identity-name` is visible, exact string equals `"DEPARTMENT OF COMPUTER AND COMMUNICATION ENGINEERING"`, has no ellipsis, and `textOverflow !== 'ellipsis'`.
   - Check 5 asserts portal cards `#portal-card-student`, `#portal-card-mentor`, and `#portal-card-hod` exist and their top y-positions are horizontally aligned (`Math.abs(y1 - y2) <= 5`).

---

## 2. Logic Chain

1. **Brand Title Transformation (Observation 1 → Feature F1 & F5)**:
   - Converting `"CCE Achieve"` to `"CCE PGPA"` inside `<h1>` satisfies the rebranding requirement.
   - Wrapping `"CCE PGPA"` in `<Link href="/login/admin" id="cce-pgpa-brand-title" aria-label="CCE PGPA">` establishes a semantic, accessible hyperlink that client-side navigates to the Admin login page upon click or keypress.
   - Structuring `<h1><Link ...>CCE PGPA</Link></h1>` conforms to WCAG 2.2 Technique G115 and HTML5 accessibility standards, correctly announcing "Heading Level 1, Link, CCE PGPA".

2. **Micro-Interaction & Reduced-Motion Design (Observation 1 → Feature F16)**:
   - Applying `transition-all duration-200 ease-out`, `hover:scale-[1.015]`, `hover:brightness-105`, and `hover:text-[#990000] dark:hover:text-[#fca5a5]` gives a refined, Apple-inspired responsiveness without disruptive layout shift.
   - Incorporating `active:scale-[0.985]` provides immediate tactile spring feedback on pointer-down.
   - Enforcing `motion-reduce:transform-none motion-reduce:transition-none` guarantees that users requesting reduced motion experience no scale shifts.
   - Applying `focus-visible:ring-2 focus-visible:ring-sky-500/70 focus-visible:ring-offset-2` provides visible focus indicators for keyboard navigation while suppressing focus rings on mouse clicks.

3. **Keyboard Space & Enter Activation (Observation 1 → Feature F6)**:
   - While `Enter` natively triggers navigation on HTML anchor elements, standard browsers treat `Space` on an `<a>` as page scrolling down.
   - Intercepting `onKeyDown` with `(e.key === " " || e.key === "Spacebar")`, calling `e.preventDefault()`, and dispatching `router.push("/login/admin")` enables seamless accessible Space activation.

4. **Public Admin Isolation & Grid Realignment (Observations 2, 3, 4 → Features F2, F3, F4)**:
   - Changing unauthenticated `authorizedRoles` to `["student", "mentor", "hod"]` removes the Admin portal card.
   - Adding `authorizedRoles.length === 3 ? "grid-cols-1 md:grid-cols-3 max-w-6xl mx-auto"` aligns the 3 cards horizontally across desktop viewports, satisfying Check 5 of `responsive.spec.ts`.
   - Replacing the footer Admin link with static text `<span className="text-[10px] text-slate-400 dark:text-slate-500">CCE PGPA System</span>` and updating page metadata completely eliminates the word "Admin" and "Administrator" from the public landing page.

5. **Institutional Integrity Guarantee (Observation 1, 5 → Institutional Requirements)**:
   - Retaining the SEC crest, college identification, accreditations, Department of CCE badge, subtitle, tagline, founder medallion, and FineWorks wordmark ensures full institutional compliance.

---

## 3. Caveats

1. **Scope Boundaries**:
   - Role switcher isolation on `/login/[role]` belongs to Milestone 2.
   - No-scroll viewport containment on `/login/[role]` forms belongs to Milestone 3.
   - Backend RBAC (`/api/v1/admin/*` 401/403 verification) remains unaltered and will be validated in Milestone 4.
2. **Space Key Browser Event Timing**:
   - `e.preventDefault()` on Space keydown is mandatory to stop default document scrolling. Without it, the browser scrolls before the router navigation fires.
3. **Tailwind v4 Setup**:
   - Tailwind v4 inline theme configuration in `globals.css` natively supports `motion-reduce:` variants.

---

## 4. Conclusion

Milestone 1 is fully investigated, specified, and ready for immediate implementation:
- **File to Edit**: `frontend/components/PortalSelection.tsx`, `frontend/app/page.tsx`, `frontend/app/(auth)/login/page.tsx`.
- **Title Component**:
  ```tsx
  <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight">
    <Link
      href="/login/admin"
      id="cce-pgpa-brand-title"
      aria-label="CCE PGPA"
      onKeyDown={handleBrandKeyDown}
      className="inline-block text-[#800000] dark:text-[#f87171] hover:text-[#990000] dark:hover:text-[#fca5a5] hover:brightness-105 hover:scale-[1.015] active:scale-[0.985] transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 rounded-lg cursor-pointer motion-reduce:transform-none motion-reduce:transition-none"
    >
      CCE PGPA
    </Link>
  </h1>
  ```
- **Grid Layout**: Updated for 3 cards (`grid-cols-1 md:grid-cols-3 max-w-6xl mx-auto`).
- **Public Admin Omission**: Admin card removed; footer link replaced with static text; metadata updated.
- Full architectural report and exact unified diffs are documented in `analysis.md`.

---

## 5. Verification Method

1. **Static Analysis & Typecheck**:
   ```powershell
   cd "e:\Projects\pgpa web-app\frontend"
   npx tsc --noEmit
   ```
2. **Visual & Interaction Verification (Playwright E2E)**:
   - Navigate to `http://localhost:3000/`.
   - Verify `#cce-pgpa-brand-title` renders `"CCE PGPA"`.
   - Click `#cce-pgpa-brand-title` → verify URL transitions to `/login/admin`.
   - Return to `/`, focus `#cce-pgpa-brand-title`, press `Enter` → verify URL transitions to `/login/admin`.
   - Return to `/`, focus `#cce-pgpa-brand-title`, press `Space` → verify URL transitions to `/login/admin` without scrolling.
   - Verify no instance of "Admin" or "Administrator" is visible in public DOM or footer.
   - Run `npx playwright test tests/responsive.spec.ts` to ensure Check 4 (`#department-identity-name`) and Check 5 (3-card horizontal alignment) pass.
3. **Invalidation Conditions**:
   - If `#cce-pgpa-brand-title` does not navigate to `/login/admin`, check router push handling or link href.
   - If Space key triggers vertical page scroll instead of navigation, ensure `e.preventDefault()` is present in `handleBrandKeyDown`.
   - If `responsive.spec.ts` Check 5 fails, ensure `authorizedRoles.length === 3 ? "grid-cols-1 md:grid-cols-3 max-w-6xl mx-auto"` is present.
