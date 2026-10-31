# Milestone 1 Investigation Report: Public Admin Card Removal & 3-Card Grid Balance

**File Under Investigation**: `frontend/components/PortalSelection.tsx`  
**Explorer**: `explorer_m1_2` (Card Removal & Grid Layout)  
**Date**: 2026-10-31  

---

## 1. Executive Summary

This investigation covers two interrelated architectural requirements for Milestone 1 in `PortalSelection.tsx`:
1. **Public Admin Card Removal**: Removing the Admin card from the unauthenticated landing view so `#portal-card-admin` is never rendered in the DOM for visitors, while strictly preserving `['admin']` for authenticated administrators.
2. **3-Card Grid Balance & Alignment**: Updating the responsive grid layout container from a 4-column fallback to an explicit 3-column configuration (`grid-cols-1 md:grid-cols-3 max-w-6xl mx-auto`), guaranteeing strict horizontal alignment within 5px across desktop viewports as required by `checkPortalCardsAlignment`.

Both changes are localized, non-breaking, fully typed under `UserRole[]`, and directly satisfy Playwright tests `TC-BRAND-02` and the responsive alignment test suite.

---

## 2. Part 1: Inspection & Reformulation of `authorizedRoles` Memo (Lines 175–200)

### 2.1 Current Implementation

In `frontend/components/PortalSelection.tsx`, lines 176–198:
```tsx
  // Determine authorized roles for current session
  // If not authenticated, display all 4 portals (Student, Mentor, HOD, Admin)
  // If authenticated, display authorized portals
  const authorizedRoles: UserRole[] = React.useMemo(() => {
    if (!user || isLoading) {
      return ["student", "mentor", "hod", "admin"];
    }
    if (user.role === "hod") {
      // HOD possesses dual capabilities: Department Head and Faculty Mentor
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

### 2.2 Root Cause & Flaw Analysis

- **Unauthenticated Default**: When `!user || isLoading` evaluates to `true` (unauthenticated visitors or during initial auth token bootstrap), line 181 explicitly returns `["student", "mentor", "hod", "admin"]`.
- **DOM Rendering Impact**: Lines 381–540 iterate over `authorizedRoles` with `.map()`. When `"admin"` is present in the array, it generates `<Link id="portal-card-admin" href="/login/admin" ...>`.
- **Test Failure**: `frontend/tests/brand-admin-access.spec.ts` (`TC-BRAND-02`) specifically verifies:
  ```ts
  const adminCard = page.locator('#portal-card-admin');
  await expect(adminCard).toHaveCount(0);
  ```
  With current code, `adminCard.count()` is 1, causing a direct test failure.
- **Specification Conflict**: Requirement R1 requires: *"Remove the Admin portal card from the portal selection page and do not display 'Admin' anywhere on the public portal selection page."*

### 2.3 Proposed Change

Update line 181 to omit `"admin"`:
```tsx
    if (!user || isLoading) {
      return ["student", "mentor", "hod"];
    }
```

### 2.4 Verification of Authenticated Admin Retention

When an administrator authenticates via `/login/admin` (or Firebase session) and navigates to the landing page `/`:
1. `user` is populated with `user.role === "admin"` and `isLoading === false`.
2. `!user || isLoading` evaluates to `false`.
3. `user.role === "hod"` evaluates to `false`.
4. `user.role === "mentor"` evaluates to `false`.
5. `user.role === "student"` evaluates to `false`.
6. `user.role === "admin"` evaluates to `true` on line 193.
7. Execution hits line 194: `return ["admin"];`.
8. Result: `authorizedRoles` is `["admin"]`.
9. The card loop generates solely `#portal-card-admin`.
10. Line 385 maps `cardHref = user ? cfg.dashboardPath : cfg.path;` which resolves to `"/admin"`.
11. Line 386 maps `ctaLabel = "Open System Admin Dashboard"`.
12. The responsive container applies `authorizedRoles.length === 1 ? "grid-cols-1 max-w-md mx-auto" : ...`, rendering a focused single-card console entrance.
13. Lines 310–358 render the Active Session Bar displaying `user.full_name` with `(System Administrator)` and `Open Dashboard ->`.

Conclusion: **Authenticated admins retain complete administrative access, while public visitors are never exposed to `#portal-card-admin`.**

---

## 3. Part 2: Inspection & Reformulation of Responsive Grid Container (Lines 370–385)

### 3.1 Current Implementation

In `frontend/components/PortalSelection.tsx`, lines 371–380:
```tsx
        {/* Portal Selection Cards */}
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

### 3.2 Layout Flaw with 3 Cards

When `authorizedRoles.length === 3` (Student, Mentor, HOD):
- Currently, neither `length === 1` nor `length === 2` matches.
- The component falls back to: `"grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 max-w-7xl mx-auto"`.
- **Negative Effects**:
  1. **Tablet / Small Desktop (`sm` to `lg`, 640px to 1023px, e.g. 768px tablet)**:
     `sm:grid-cols-2` is active. Two cards (Student, Mentor) sit on Row 1, while HOD is pushed onto Row 2 as an orphan card.
  2. **Desktop (`lg` and above, >= 1024px, including 1280×720, 1366×768, 1440×900, 1920×1080)**:
     `lg:grid-cols-4` divides the container into 4 columns.
     With only 3 cards, columns 1, 2, and 3 are occupied, leaving column 4 completely empty.
     The 3 cards are pushed to the left, destroying the visual balance and symmetry of the page.

### 3.3 Formulated Responsive Grid Classes

Add an explicit condition for `authorizedRoles.length === 3`:
```tsx
        {/* Portal Selection Cards */}
        <div
          className={`grid gap-4 sm:gap-4 md:gap-5 lg:gap-5 w-full ${
            authorizedRoles.length === 1
              ? "grid-cols-1 max-w-md mx-auto"
              : authorizedRoles.length === 2
              ? "grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto"
              : authorizedRoles.length === 3
              ? "grid-cols-1 md:grid-cols-3 max-w-6xl mx-auto"
              : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 max-w-7xl mx-auto"
          }`}
        >
```

### 3.4 Verification Across Viewports and Alignment Checks

#### A. Mobile Viewports (360×800, 375×667, 390×844, 402×874, 412×915, 430×932)
- Below `md` (width < 768px), `grid-cols-1` is active.
- Cards are stacked vertically in DOM order:
  1. Student (`#portal-card-student`) at top
  2. Mentor (`#portal-card-mentor`) in middle
  3. HOD (`#portal-card-hod`) at bottom
- `gap-4` (16px) vertical spacing.
- **Playwright Test Match**:
  `frontend/tests/responsive.spec.ts` lines 140–143:
  ```ts
  expect(cards.mentor.y).toBeGreaterThan(cards.student.y);
  expect(cards.hod.y).toBeGreaterThan(cards.mentor.y);
  ```
  Both assertions are strictly satisfied.
- **Touch Target Requirement**:
  Each card has `min-h-[220px]`, easily satisfying the mobile >= 80px requirement (`expect(cards.*.height).toBeGreaterThanOrEqual(80)`).
- **Horizontal Overflow**:
  `w-full` inside `px-4` padding prevents horizontal spillover, ensuring `scrollWidth <= innerWidth`.

#### B. Desktop Viewports (1280×720, 1366×768, 1440×900, 1920×1080)
- At `md` and above (width >= 768px), `md:grid-cols-3` is active.
- CSS Grid allocates 3 equal columns: `repeat(3, minmax(0, 1fr))`.
- Cards Student, Mentor, and HOD occupy columns 1, 2, and 3 of Row 1.
- In CSS Grid, items on Row 1 share the same top alignment baseline (default `align-items: stretch`).
- **Playwright Alignment Assertion**:
  `frontend/tests/responsive.spec.ts` lines 135–138:
  ```ts
  const topDiff1 = Math.abs(cards.student.y - cards.mentor.y);
  const topDiff2 = Math.abs(cards.mentor.y - cards.hod.y);
  expect(topDiff1).toBeLessThanOrEqual(5);
  expect(topDiff2).toBeLessThanOrEqual(5);
  ```
  Since all 3 cards start at the exact top border of the grid container, `cards.student.y === cards.mentor.y === cards.hod.y`. The top difference is `0px`, easily inside the `5px` tolerance.

#### C. Optical Balance & Max Width Rationale (`max-w-6xl` vs `max-w-7xl`)
- With `max-w-7xl` (1280px container width), 3 cards with 20px gap would each stretch to ~406px wide, which produces excessive negative space inside each card and distorts typography.
- With `max-w-6xl` (72rem = 1152px container width), total width for 3 cards is `1152px - 40px = 1112px`, yielding ~370px per card.
- This creates an optimal Apple-style card aspect ratio:
  - Header icon & badge fit neatly on one line.
  - Title and audience line wrap naturally.
  - The 3 feature tags fit comfortably without awkward wrapping.
  - The overall grid remains visually centered via `mx-auto`.

#### D. Desktop Viewport No-Scroll Compatibility (1280×720)
- Card height: `min-h-[220px]`, rendered height ~240px.
- Section header & branding: ~140px.
- Institutional header: ~64px.
- Institutional footer: ~70px.
- Total stacked height: ~520px–540px.
- This is well under the 720px viewport height, ensuring `scrollHeight <= innerHeight` across all target desktop resolutions.

---

## 4. Part 3: Exact Recommended Code Diffs

Target file: `frontend/components/PortalSelection.tsx`

### Diff 1: `authorizedRoles` Memo (Lines 177–183)

```diff
--- a/frontend/components/PortalSelection.tsx
+++ b/frontend/components/PortalSelection.tsx
@@ -176,7 +176,8 @@ export function PortalSelection() {
   // Determine authorized roles for current session
-  // If not authenticated, display all 4 portals (Student, Mentor, HOD, Admin)
+  // If not authenticated, display 3 public portals (Student, Mentor, HOD)
+  // Note: Admin portal is hidden for public visitors and accessed via branding title
   // If authenticated, display authorized portals
   const authorizedRoles: UserRole[] = React.useMemo(() => {
     if (!user || isLoading) {
-      return ["student", "mentor", "hod", "admin"];
+      return ["student", "mentor", "hod"];
     }
```

### Diff 2: Responsive Grid Container (Lines 373–380)

```diff
--- a/frontend/components/PortalSelection.tsx
+++ b/frontend/components/PortalSelection.tsx
@@ -373,6 +373,8 @@ export function PortalSelection() {
           className={`grid gap-4 sm:gap-4 md:gap-5 lg:gap-5 w-full ${
             authorizedRoles.length === 1
               ? "grid-cols-1 max-w-md mx-auto"
               : authorizedRoles.length === 2
               ? "grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto"
+              : authorizedRoles.length === 3
+              ? "grid-cols-1 md:grid-cols-3 max-w-6xl mx-auto"
               : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 max-w-7xl mx-auto"
           }`}
```

---

## 5. Part 4: Verification Method

The changes can be independently verified using existing repository tools and test suites:

1. **Verify No `#portal-card-admin` for Unauthenticated Visitors**:
   Run:
   ```bash
   npx playwright test tests/brand-admin-access.spec.ts -g "TC-BRAND-02"
   ```
   *Expected Result*: `adminCard.count()` is 0, while `#portal-card-student`, `#portal-card-mentor`, and `#portal-card-hod` are visible.

2. **Verify Desktop Card Alignment**:
   Run:
   ```bash
   npx playwright test tests/responsive.spec.ts -g "Portal Cards Alignment"
   ```
   *Expected Result*: At desktop viewports (1280x720, 1366x768, 1920x1080), `topDiff1 <= 5` and `topDiff2 <= 5`. At mobile viewports, `mentor.y > student.y` and `hod.y > mentor.y`.

3. **Verify Desktop No-Scroll Containment**:
   Run:
   ```bash
   npx playwright test tests/desktop-noscroll.spec.ts
   ```
   *Expected Result*: `scrollHeight <= innerHeight` across all desktop viewports on `/`.

4. **Static Typecheck**:
   Run:
   ```bash
   npm run build
   # or
   npx tsc --noEmit
   ```
   *Expected Result*: Zero TypeScript errors in `PortalSelection.tsx`.
