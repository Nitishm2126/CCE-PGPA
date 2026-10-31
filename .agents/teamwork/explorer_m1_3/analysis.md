# Milestone 1 Exploration Report: Word "Admin" Omission & Accessible Keyboard Activation

**Author**: Milestone 1 Explorer (`teamwork_explorer`)  
**Role**: Word Omission & Keyboard Activation  
**Working Directory**: `e:\Projects\pgpa web-app\.agents\teamwork\explorer_m1_3\`  
**Date**: 2026-10-31  
**Project**: CCE PGPA Web Application (`e:\Projects\pgpa web-app`)  

---

## 1. Executive Summary

This investigation delivers the architectural blueprint and exact code modifications for **Milestone 1 (Word Omission & Keyboard Activation)**:
1. **Complete Elimination of the word "Admin" and "Administrator" on the Public Landing Page**:
   - Identifies all occurrences across `frontend/components/PortalSelection.tsx`, `frontend/app/page.tsx`, and `frontend/app/(auth)/login/page.tsx`.
   - Eliminates the legacy footer link pointing to `/login/admin` containing `title="System Administrator Portal Login"` and `aria-label="System Administrator Portal Login"`, replacing it with clean institutional text `<span>CCE PGPA</span>`.
   - Cleanses the Next.js page metadata descriptions in `frontend/app/page.tsx` and `frontend/app/(auth)/login/page.tsx`, removing "System Administrators" and replacing "Four dedicated role entry points" with "Dedicated role entry points for Students, Faculty Mentors, and Department Head".
   - Ensures that when unauthenticated, zero visible text, headings, badges, card CTAs, titles, or aria-labels in the DOM contain the word "Admin" or "Administrator" (case-insensitive).
2. **Accessible Keyboard Activation on "CCE PGPA" (`#cce-pgpa-brand-title`)**:
   - Wraps the "CCE PGPA" title inside an accessible Next.js `<Link href="/login/admin" id="cce-pgpa-brand-title" aria-label="CCE PGPA">`.
   - Implements an optimized `onKeyDown` handler intercepting `Space` (`e.key === ' '` or `'Spacebar'`), preventing default page scroll via `e.preventDefault()`, and navigating to `/login/admin` via `router.push('/login/admin')`.
   - Relies on native browser and Next.js `<Link>` handling for `Enter` activation without redundant event handlers.
   - Enforces `aria-label="CCE PGPA"` so screen readers announce an accessible, institutional name without leaking the administrative route or using the word "Admin".

---

## 2. Comprehensive Inventory of "Admin" / "Administrator" Occurrences

A multi-file forensic audit of public landing pages (`/` and `/login`) identified the following occurrences:

| # | File Path | Line Range | Current Code / Element | Nature of Occurrence | Impact / Risk |
|---|-----------|------------|------------------------|----------------------|---------------|
| **1** | `frontend/components/PortalSelection.tsx` | Lines 596–603 | `<Link href="/login/admin" title="System Administrator Portal Login" aria-label="System Administrator Portal Login">CCE Achieve System</Link>` | Footer link attributes (`title`, `aria-label`) | **Violates F3 & TC-BRAND-02**: Automated DOM attribute scrapers and screen readers detect "System Administrator". Exposes redundant admin link. |
| **2** | `frontend/components/PortalSelection.tsx` | Line 587 | `{/* Lower Footer: Legal, Department Notice & Subtle Admin Login */}` | JSX Comment | Code hygiene; mentions "Admin Login". |
| **3** | `frontend/app/page.tsx` | Line 8 | `description: "Official institutional access portal for CCE-PGPA Management System. Four dedicated role entry points for Students, Faculty Mentors, Department Head, and System Administrators."` | Page `<head>` metadata | **Violates F3**: Next.js injects `<meta name="description" ...>` containing "System Administrators" into HTML source. |
| **4** | `frontend/app/(auth)/login/page.tsx` | Line 8 | `description: "Official institutional access portal for CCE-PGPA Management System. Four dedicated role entry points for Students, Faculty Mentors, Department Head, and System Administrators."` | Page `<head>` metadata | **Violates F3**: Same metadata leak on `/login`. |
| **5** | `frontend/components/PortalSelection.tsx` | Lines 180–182 | `authorizedRoles` memo returning `["student", "mentor", "hod", "admin"]` for unauthenticated sessions | Component State / Card Rendering | Renders `#portal-card-admin` with heading "Administrator", badge "System Administration", and CTA "Enter Admin Portal". (Coordinated with Explorer M1-2). |

### Verification of Isolation on Global Layout Components
Inspection of `frontend/app/layout.tsx`, `frontend/components/Navbar.tsx`, `frontend/components/Footer.tsx`, and `frontend/components/EmailVerificationBanner.tsx` confirmed:
- `Navbar.tsx`: Returns `null` when `pathname === "/" || pathname?.startsWith("/login")`.
- `Footer.tsx`: Returns `null` when `pathname === "/" || pathname?.startsWith("/login")`.
- `EmailVerificationBanner.tsx`: Returns `null` when `pathname === "/" || pathname?.startsWith("/login")`.
- `RootLayout` in `layout.tsx`: Metadata contains zero occurrences of "Admin" (`title: "CCE-PGPA - Student Achievement Management System"`).
- Consequently, **only** `PortalSelection.tsx` and the two route files `app/page.tsx` and `app/(auth)/login/page.tsx` require modification for Milestone 1.

---

## 3. Keyboard Activation & Accessibility Architecture

### 3.1 Interaction Model Matrix

| Interaction | Trigger / Event | Implementation Mechanism | Expected Behavior |
|-------------|-----------------|--------------------------|-------------------|
| **Mouse Click** | `click` event on `#cce-pgpa-brand-title` | Native Next.js `<Link href="/login/admin">` | Client-side transition to `/login/admin` via Next.js router. |
| **Touch Tap** | `touchend` / `click` on `#cce-pgpa-brand-title` | Native Next.js `<Link>` with `active:scale-[0.99]` | Tactile compression feedback + navigation to `/login/admin`. |
| **Keyboard `Enter`** | `keydown` (`e.key === 'Enter'`) while focused | Native HTML `<a>` behavior + Next.js router | Browser natively dispatches click on `<a>` with `href`; Next.js router navigates to `/login/admin` without custom interceptors. |
| **Keyboard `Space`** | `keydown` (`e.key === ' ' \|\| 'Spacebar'`) while focused | Custom `handleBrandKeyDown` handler | `e.preventDefault()` halts browser window scroll; `router.push('/login/admin')` triggers instant client-side route change. |
| **Screen Reader Announcement** | Focus / Virtual cursor navigation | `aria-label="CCE PGPA"` on `<Link>` | Screen reader announces "CCE PGPA, link" or "CCE PGPA, heading level 1, link" without uttering "Admin". |
| **Keyboard Focus Ring** | Tab navigation into brand title | Tailwind `focus-visible:ring-2 focus-visible:ring-offset-2` | High-contrast visible focus outline compliant with WCAG 2.1 AA (2.4.7 Focus Visible). |

### 3.2 Space Key Interception Logic
In standard HTML, pressing `Space` on an anchor link (`<a>`) scrolls the page down and does not activate the link. To achieve accessible button-like keyboard parity for interactive branding triggers:

```typescript
const handleBrandKeyDown = React.useCallback(
  (e: React.KeyboardEvent<HTMLAnchorElement>) => {
    // Intercept Space without modifiers (Ctrl, Alt, Meta)
    if ((e.key === " " || e.key === "Spacebar") && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      router.push("/login/admin");
    }
  },
  [router]
);
```

#### Key Design Decisions:
1. **Handling `" "` and `"Spacebar"`**: Modern browsers report `e.key = " "`. Certain headless or legacy environments report `"Spacebar"`. Supporting both guarantees 100% test and environment compatibility.
2. **Modifier Isolation (`!e.ctrlKey && !e.altKey && !e.metaKey`)**: Prevents hijacking system shortcuts (e.g., OS window switching or browser shortcuts).
3. **`e.preventDefault()`**: Strictly required before navigation to prevent vertical scroll jitter.
4. **No Custom Enter Intercept**: Avoiding a custom handler for `Enter` prevents double navigation triggers, preserving standard browser link behavior.
5. **`React.useCallback`**: Prevents unnecessary handler re-creation on component renders.

---

## 4. Exact Recommended Code Diffs

### Diff 1: `frontend/components/PortalSelection.tsx`
**Target File**: `e:\Projects\pgpa web-app\frontend\components\PortalSelection.tsx`

#### Step 1A: Import `useRouter`
```diff
--- a/frontend/components/PortalSelection.tsx
+++ b/frontend/components/PortalSelection.tsx
@@ -3,4 +3,5 @@
 import React from "react";
 import Image from "next/image";
 import Link from "next/link";
+import { useRouter } from "next/navigation";
 import { useAuth } from "@/lib/auth-context";
```

#### Step 1B: Initialize Hook & `handleBrandKeyDown`
```diff
--- a/frontend/components/PortalSelection.tsx
+++ b/frontend/components/PortalSelection.tsx
@@ -173,4 +174,15 @@
 export function PortalSelection() {
+  const router = useRouter();
   const { user, logout, isLoading } = useAuth();
 
+  const handleBrandKeyDown = React.useCallback(
+    (e: React.KeyboardEvent<HTMLAnchorElement>) => {
+      if ((e.key === " " || e.key === "Spacebar") && !e.ctrlKey && !e.altKey && !e.metaKey) {
+        e.preventDefault();
+        router.push("/login/admin");
+      }
+    },
+    [router]
+  );
+
```

#### Step 1C: Wrap "CCE PGPA" Brand Title in Interactive Link
```diff
--- a/frontend/components/PortalSelection.tsx
+++ b/frontend/components/PortalSelection.tsx
@@ -295,5 +307,15 @@
           {/* Institutional Portal Name & Tagline */}
           <div className="space-y-0.5">
-            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[#800000] dark:text-[#f87171] leading-tight">
-              CCE Achieve
+            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight">
+              <Link
+                href="/login/admin"
+                id="cce-pgpa-brand-title"
+                aria-label="CCE PGPA"
+                onKeyDown={handleBrandKeyDown}
+                className="inline-block text-[#800000] dark:text-[#f87171] hover:opacity-90 active:scale-[0.99] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#800000] dark:focus-visible:ring-[#f87171] rounded-lg motion-reduce:transition-none motion-reduce:active:scale-100"
+              >
+                CCE PGPA
+              </Link>
             </h1>
             <p className="text-[10px] sm:text-[11px] md:text-xs font-bold uppercase tracking-[0.22em] text-[#0f2942] dark:text-slate-300">
```

#### Step 1D: Cleanse Lower Footer (Eliminate Admin Link & Metadata)
```diff
--- a/frontend/components/PortalSelection.tsx
+++ b/frontend/components/PortalSelection.tsx
@@ -587,17 +609,11 @@
-          {/* Lower Footer: Legal, Department Notice & Subtle Admin Login */}
+          {/* Lower Footer: Legal, Department Notice & Platform Version */}
           <div className="flex flex-col sm:flex-row items-center justify-between gap-1.5 sm:gap-2 text-center sm:text-left text-[10px] sm:text-[10.5px] text-slate-500 dark:text-slate-400">
             <div>
               <span>Department of Computer and Communication Engineering</span>
               <span className="hidden sm:inline mx-1.5 text-slate-300 dark:text-slate-700" aria-hidden="true">&bull;</span>
               <span className="block sm:inline">Sri Sairam Engineering College (Autonomous)</span>
             </div>
 
             <div className="flex items-center gap-2">
-              <Link
-                href="/login/admin"
-                className="hover:underline hover:text-slate-800 dark:hover:text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-400 rounded transition-colors text-[10px] text-slate-400 dark:text-slate-500"
-                title="System Administrator Portal Login"
-                aria-label="System Administrator Portal Login"
-              >
-                CCE Achieve System
-              </Link>
+              <span className="text-[10px] text-slate-400 dark:text-slate-500">
+                CCE PGPA
+              </span>
               <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">&bull;</span>
               <span className="text-[10px] text-slate-400 dark:text-slate-500">Version 1.0.0</span>
             </div>
```

---

### Diff 2: `frontend/app/page.tsx`
**Target File**: `e:\Projects\pgpa web-app\frontend\app\page.tsx`

```diff
--- a/frontend/app/page.tsx
+++ b/frontend/app/page.tsx
@@ -5,5 +5,5 @@
 export const metadata: Metadata = {
   title: "CCE-PGPA Portal - Department of CCE, Sri Sairam Engineering College",
   description:
-    "Official institutional access portal for CCE-PGPA Management System. Four dedicated role entry points for Students, Faculty Mentors, Department Head, and System Administrators.",
+    "Official institutional access portal for CCE-PGPA Management System. Dedicated role entry points for Students, Faculty Mentors, and Department Head.",
 };
```

---

### Diff 3: `frontend/app/(auth)/login/page.tsx`
**Target File**: `e:\Projects\pgpa web-app\frontend\app\(auth)\login\page.tsx`

```diff
--- a/frontend/app/(auth)/login/page.tsx
+++ b/frontend/app/(auth)/login/page.tsx
@@ -5,5 +5,5 @@
 export const metadata: Metadata = {
   title: "CCE-PGPA Portal - Department of CCE, Sri Sairam Engineering College",
   description:
-    "Official institutional access portal for CCE-PGPA Management System. Four dedicated role entry points for Students, Faculty Mentors, Department Head, and System Administrators.",
+    "Official institutional access portal for CCE-PGPA Management System. Dedicated role entry points for Students, Faculty Mentors, and Department Head.",
 };
```

---

## 5. Verification Protocol & Playwright Test Scenarios

### 5.1 Verification Checklist

| Test ID | Test Scenario | Verification Method | Pass Criteria |
|---------|---------------|---------------------|---------------|
| `TC-BRAND-01` | Brand Title Text | Inspect text of `#cce-pgpa-brand-title` | Text strictly equals `"CCE PGPA"`. Tagline and subtitle intact. |
| `TC-BRAND-02` | Public Word "Admin" Omission | Inspect body inner text, attributes `aria-label`, and `title` on `/` | 0 occurrences of `"Admin"` or `"Administrator"` in visible text or attributes. `#portal-card-admin` not present. |
| `TC-BRAND-03` | Mouse Click Navigation | `await page.click('#cce-pgpa-brand-title')` | URL transitions to `/login/admin`. |
| `TC-BRAND-04` | Keyboard Enter Navigation | `await page.focus('#cce-pgpa-brand-title'); await page.keyboard.press('Enter');` | URL transitions to `/login/admin`. |
| `TC-BRAND-05` | Keyboard Space Navigation | `await page.focus('#cce-pgpa-brand-title'); await page.keyboard.press('Space');` | URL transitions to `/login/admin`; no scroll offset triggered. |
| `TC-BRAND-06` | Accessible Label & Attributes | Inspect `#cce-pgpa-brand-title` attributes | `aria-label === "CCE PGPA"`, `href === "/login/admin"`, valid focus ring classes present. |

### 5.2 Verification Script (Playwright snippet)
```typescript
import { test, expect } from '@playwright/test';

test.describe('Milestone 1: Brand Title, Word Omission & Keyboard Activation', () => {
  test('Zero occurrences of "Admin" or "Administrator" on public landing page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 1. Check visible body text
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toMatch(/\badmin\b/i);
    expect(bodyText).not.toMatch(/\badministrator\b/i);

    // 2. Check all aria-labels
    const ariaLabels = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[aria-label]')).map((el) => el.getAttribute('aria-label') || '')
    );
    for (const label of ariaLabels) {
      expect(label).not.toMatch(/\badmin\b/i);
      expect(label).not.toMatch(/\badministrator\b/i);
    }

    // 3. Check all title attributes
    const titles = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[title]')).map((el) => el.getAttribute('title') || '')
    );
    for (const title of titles) {
      expect(title).not.toMatch(/\badmin\b/i);
      expect(title).not.toMatch(/\badministrator\b/i);
    }

    // 4. Check page metadata description
    const metaDescription = await page.locator('meta[name="description"]').getAttribute('content');
    expect(metaDescription || '').not.toMatch(/admin/i);
  });

  test('Keyboard Space navigates to Admin login', async ({ page }) => {
    await page.goto('/');
    const brand = page.locator('#cce-pgpa-brand-title');
    await brand.focus();
    await page.keyboard.press('Space');
    await page.waitForURL('**/login/admin');
    expect(page.url()).toContain('/login/admin');
  });

  test('Keyboard Enter navigates to Admin login', async ({ page }) => {
    await page.goto('/');
    const brand = page.locator('#cce-pgpa-brand-title');
    await brand.focus();
    await page.keyboard.press('Enter');
    await page.waitForURL('**/login/admin');
    expect(page.url()).toContain('/login/admin');
  });
});
```

---

## 6. Synthesis with Milestone 1 Peer Streams

- **Peer Stream 1 (`explorer_m1_1`)**: Brand Title & Institutional Integrity
  - Our `#cce-pgpa-brand-title` implementation provides the required `id`, `aria-label`, and `onKeyDown` hook while integrating their recommended Apple hover/opacity micro-interaction and `prefers-reduced-motion` styles.
- **Peer Stream 2 (`explorer_m1_2`)**: Card Removal & 3-Card Grid Balance
  - Their `authorizedRoles` memo update ensures `#portal-card-admin` is excluded from the DOM when unauthenticated. In combination with our footer link omission and metadata cleansing, this completely seals all public paths displaying "Admin".
- **E2E Testing Track (`test_writer_e2e_1`)**:
  - The locator `#cce-pgpa-brand-title` directly matches the locator expected by `brand-admin-access.spec.ts` (TC-BRAND-01 to TC-BRAND-06).

---

## 7. Conclusion

Milestone 1 investigations for Word Omission and Keyboard Activation are complete and conclusively resolved. Applying the three precise diffs outlined in Section 4 will:
1. Completely eradicate the word "Admin" and "Administrator" from public-facing landing pages (HTML body, attributes, and `<head>` metadata).
2. Deliver accessible, high-performance keyboard navigation (Space & Enter) and screen reader support (`aria-label="CCE PGPA"`).
3. Preserve all institutional branding and security boundaries without regressions.
