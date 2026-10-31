# Milestone 1 Explorer 2 Handoff Report

**Agent Folder**: `.agents/teamwork/explorer_m1_2`  
**Identity**: `teamwork_explorer`  
**Role**: Milestone 1 Explorer (Card Removal & Grid Layout)  
**Report Type**: Hard Handoff (Investigation Complete)  

---

## 1. Observation

1. **`frontend/components/PortalSelection.tsx` (Lines 179–197)**:
   The `authorizedRoles` memo contains:
   ```tsx
   179:   const authorizedRoles: UserRole[] = React.useMemo(() => {
   180:     if (!user || isLoading) {
   181:       return ["student", "mentor", "hod", "admin"];
   182:     }
   183:     if (user.role === "hod") {
   184:       // HOD possesses dual capabilities: Department Head and Faculty Mentor
   185:       return ["hod", "mentor"];
   186:     }
   187:     if (user.role === "mentor") {
   188:       return ["mentor"];
   189:     }
   190:     if (user.role === "student") {
   191:       return ["student"];
   192:     }
   193:     if (user.role === "admin") {
   194:       return ["admin"];
   195:     }
   196:     return [user.role];
   197:   }, [user, isLoading]);
   ```
   Directly returning `"admin"` on line 181 when `!user || isLoading` evaluates to `true`.

2. **`frontend/components/PortalSelection.tsx` (Lines 371–380)**:
   The responsive grid container contains:
   ```tsx
   371:         {/* Portal Selection Cards */}
   372:         <div
   373:           className={`grid gap-4 sm:gap-4 md:gap-5 lg:gap-5 w-full ${
   374:             authorizedRoles.length === 1
   375:               ? "grid-cols-1 max-w-md mx-auto"
   376:               : authorizedRoles.length === 2
   377:               ? "grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto"
   378:               : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 max-w-7xl mx-auto"
   379:           }`}
   380:         >
   ```
   When `authorizedRoles.length === 3`, the component executes line 378 (`"grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 max-w-7xl mx-auto"`), applying `lg:grid-cols-4` on desktop and `sm:grid-cols-2` on tablet/mobile screens.

3. **`frontend/tests/brand-admin-access.spec.ts` (Lines 37–52)**:
   Test `TC-BRAND-02` asserts:
   ```ts
   40:     // 1. Verify #portal-card-admin is not present in the DOM
   41:     const adminCard = page.locator('#portal-card-admin');
   42:     await expect(adminCard).toHaveCount(0);
   43: 
   44:     // 2. Verify only 3 public portal cards are present (Student, Mentor, HOD)
   45:     const studentCard = page.locator('#portal-card-student');
   46:     const mentorCard = page.locator('#portal-card-mentor');
   47:     const hodCard = page.locator('#portal-card-hod');
   48: 
   49:     await expect(studentCard).toBeVisible();
   50:     await expect(mentorCard).toBeVisible();
   51:     await expect(hodCard).toBeVisible();
   ```

4. **`frontend/tests/responsive.spec.ts` (Lines 132–143)**:
   Card alignment assertions:
   ```ts
   132:       if (vp.category === 'desktop') {
   133:         // On desktop, 3 cards are arranged side by side horizontally
   134:         // Their top positions must be aligned (within 5px)
   135:         const topDiff1 = Math.abs(cards.student.y - cards.mentor.y);
   136:         const topDiff2 = Math.abs(cards.mentor.y - cards.hod.y);
   137:         expect(topDiff1).toBeLessThanOrEqual(5);
   138:         expect(topDiff2).toBeLessThanOrEqual(5);
   139:       } else if (vp.category === 'mobile') {
   140:         // On mobile, 3 cards are stacked vertically
   141:         expect(cards.mentor.y).toBeGreaterThan(cards.student.y);
   142:         expect(cards.hod.y).toBeGreaterThan(cards.mentor.y);
   143:       }
   ```

5. **`frontend/tests/helpers/assertions.ts` (Lines 94–114)**:
   `checkPortalCardsAlignment` evaluates bounding boxes for `#portal-card-student`, `#portal-card-mentor`, and `#portal-card-hod`.

---

## 2. Logic Chain

1. **Step 1 (Root Cause of Public Admin Exposure)**:
   - Observation 1 demonstrates that line 181 in `PortalSelection.tsx` returns `["student", "mentor", "hod", "admin"]` for unauthenticated sessions (`!user || isLoading`).
   - In lines 381–540, `authorizedRoles.map()` creates DOM elements `#portal-card-${roleKey}`.
   - For `roleKey === "admin"`, this renders `#portal-card-admin`.
   - By Observation 3, test `TC-BRAND-02` expects `page.locator('#portal-card-admin').toHaveCount(0)`.
   - Therefore, changing line 181 to return `["student", "mentor", "hod"]` ensures `#portal-card-admin` is never rendered for unauthenticated visitors, directly satisfying Observation 3.

2. **Step 2 (Safety of Authenticated Admin Retention)**:
   - In Observation 1, lines 193–195 check:
     ```tsx
     if (user.role === "admin") {
       return ["admin"];
     }
     ```
   - For an authenticated administrator, `user.role === "admin"` and `isLoading === false`.
   - The conditional branch on line 180 (`!user || isLoading`) evaluates to `false`.
   - Line 193 evaluates to `true` and returns `["admin"]`.
   - Therefore, authenticated admins retain `['admin']`, rendering `#portal-card-admin` with link to `/admin` and preserving admin session functionality.

3. **Step 3 (Root Cause of Grid Imbalance)**:
   - With 3 public cards (`["student", "mentor", "hod"]`), Observation 2 shows that `authorizedRoles.length === 3` falls into line 378: `"grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 max-w-7xl mx-auto"`.
   - At desktop viewports (`lg:grid-cols-4`), this creates 4 columns, leaving column 4 blank and cards shifted off-center.
   - At tablet viewports (`sm:grid-cols-2`), cards wrap 2 on row 1 and 1 on row 2.

4. **Step 4 (Resolution with 3-Card Balanced Grid)**:
   - Introducing the condition `authorizedRoles.length === 3 ? "grid-cols-1 md:grid-cols-3 max-w-6xl mx-auto"`:
     - On mobile (< 768px): applies `grid-cols-1`. Cards stack in sequence (Student, Mentor, HOD). As required by Observation 4, `cards.mentor.y > cards.student.y` and `cards.hod.y > cards.mentor.y`.
     - On desktop (>= 768px): applies `md:grid-cols-3`. All 3 cards occupy Row 1 in 3 equal columns. In CSS Grid, items in the same row share the exact top coordinate (`topDiff1 === 0`, `topDiff2 === 0`). This satisfies Observation 4 (`<= 5px`).
     - `max-w-6xl` (1152px) provides an optimal card width of ~370px, maintaining optical balance and avoiding bloated card proportions.

---

## 5. Caveats

1. **Footer Admin Link**: The footer in `PortalSelection.tsx` (lines 596–603) contains a link with `title="System Administrator Portal Login"`. Removing this is under the scope of explorer_m1_3 (F3).
2. **Interactive Brand Title**: The interactive "CCE PGPA" trigger with keyboard handlers (Space/Enter) is handled by explorer_m1_1 and explorer_m1_3 (F1, F5, F6).
3. **Login Switcher Navigation**: Public role navigation isolation on `/login/[role]` is handled in Milestone 2.

---

## 4. Conclusion

The recommended modifications to `frontend/components/PortalSelection.tsx` are:
1. In `authorizedRoles` memo (lines 179–197), change line 181 to return `["student", "mentor", "hod"]`.
2. In the responsive grid container (lines 373–380), add the branch:
   `authorizedRoles.length === 3 ? "grid-cols-1 md:grid-cols-3 max-w-6xl mx-auto"` before the fallback.

These two changes fully resolve Feature F2 (Public Admin Card Removal) and Feature F4 (3-Card Desktop Alignment) without regressions.

---

## 5. Verification Method

To independently verify after code application:

1. **E2E Playwright Tests**:
   ```bash
   npx playwright test tests/brand-admin-access.spec.ts -g "TC-BRAND-02"
   npx playwright test tests/responsive.spec.ts -g "Portal Cards Alignment"
   npx playwright test tests/desktop-noscroll.spec.ts
   ```
2. **Files to Inspect**:
   - `frontend/components/PortalSelection.tsx` (lines 180–185 and 370–385)
   - Detailed analysis: `e:\Projects\pgpa web-app\.agents\teamwork\explorer_m1_2\analysis.md`
3. **Invalidation Conditions**:
   - `#portal-card-admin` appears in DOM on unauthenticated `/` or `/login`.
   - `Math.abs(cards.student.y - cards.mentor.y) > 5` or `Math.abs(cards.mentor.y - cards.hod.y) > 5` on desktop viewports (1280×720, 1366×768, 1440×900, 1920×1080).
   - Authenticated admin (`user.role === 'admin'`) is unable to see or access `/admin`.
