## 2026-10-31T08:29:19Z
Read ORIGINAL_REQUEST.md at: e:\Projects\pgpa web-app\.agents\teamwork\ORIGINAL_REQUEST.md
Read PROJECT.md at: e:\Projects\pgpa web-app\.agents\teamwork\PROJECT.md
Read Explorer Handoffs at:
- e:\Projects\pgpa web-app\.agents\teamwork\explorer_m1_1\handoff.md
- e:\Projects\pgpa web-app\.agents\teamwork\explorer_m1_2\handoff.md
- e:\Projects\pgpa web-app\.agents\teamwork\explorer_m1_3\handoff.md

Your Working Directory: e:\Projects\pgpa web-app\.agents\teamwork\worker_m1_1\
Your Identity: teamwork_worker
Your Role: Implementation Worker (Milestone 1: Brand Title & Hidden Admin Access)

Exclusive File Ownership:
- `frontend/components/PortalSelection.tsx`
- `frontend/app/page.tsx`
- `frontend/app/(auth)/login/page.tsx`
DO NOT modify `RoleLoginForm.tsx` or `frontend/tests/*` or any backend files.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Mission:
Implement Milestone 1 (Features F1 to F6) in strict accordance with the explorer handoffs and specifications:
1. In `frontend/components/PortalSelection.tsx`:
   - Import `useRouter` from `"next/navigation"`.
   - Instantiate `const router = useRouter();`.
   - Implement `handleBrandKeyDown` to intercept Spacebar (`e.key === " " || e.key === "Spacebar"`), call `e.preventDefault()`, and navigate via `router.push("/login/admin")`.
   - Transform the branding heading `<h1>` from static "CCE Achieve" into an accessible Next.js `<Link href="/login/admin" id="cce-pgpa-brand-title" aria-label="CCE PGPA" onKeyDown={handleBrandKeyDown}>CCE PGPA</Link>` with Apple-inspired micro-interactions (`hover:scale-[1.015]`, `active:scale-[0.985]`, smooth transition, focus ring, `motion-reduce:transform-none motion-reduce:transition-none`).
   - Preserve all institutional branding elements: SEC crest, accreditations, Department of CCE badge, "PGPA MANAGEMENT SYSTEM" subtitle, "Academic Performance. Structured. Simplified." tagline, Founder Chairman medallion, and FineWorks branding.
   - In `authorizedRoles` memo, change unauthenticated default to `["student", "mentor", "hod"]` (omitting "admin" from public cards). Ensure `user.role === "admin"` still returns `["admin"]`.
   - In the cards grid container, add the explicit 3-card balanced layout:
     `authorizedRoles.length === 3 ? "grid-cols-1 md:grid-cols-3 max-w-6xl mx-auto" :`
   - In the lower footer (lines 587-606), replace the `<Link href="/login/admin" ... title="System Administrator Portal Login" aria-label="System Administrator Portal Login">` with static text:
     `<span className="text-[10px] text-slate-400 dark:text-slate-500">CCE PGPA System</span>`.
2. In `frontend/app/page.tsx` & `frontend/app/(auth)/login/page.tsx`:
   - Update metadata description to eliminate "System Administrators":
     `"Official institutional access portal for CCE-PGPA Management System. Dedicated role entry points for Students, Faculty Mentors, and Department Head."`
3. Verification:
   - Run typecheck / build: `npx tsc --noEmit` from `frontend`.
   - Run Playwright brand tests: `npx playwright test brand-admin-access.spec.ts` from `frontend`.
   - Verify zero compile errors and document test results.
4. Deliver `handoff.md` in your working directory and message the orchestrator when complete.
