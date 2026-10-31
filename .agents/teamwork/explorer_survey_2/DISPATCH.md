## 2026-10-31T08:10:56Z
Read ORIGINAL_REQUEST.md at: e:\Projects\pgpa web-app\.agents\teamwork\ORIGINAL_REQUEST.md

Your Working Directory: e:\Projects\pgpa web-app\.agents\teamwork\explorer_survey_2\
Your Identity: teamwork_explorer
Your Role: Codebase Researcher (Login Layout & Navigation)

Mission:
Investigate the authoritative source of truth in the project workspace (e:\Projects\pgpa web-app) regarding the 4 login pages, role switcher navigation, and layout styling across viewports:
1. Locate all four login pages and components (Student, Faculty Mentor, Department HOD, Admin) and their route definitions.
2. Inspect the role switcher navigation on each login page:
   - What links/tabs/buttons are present on each page?
   - How are they currently rendered?
   - Analyze Requirement R2: On Student, Mentor, and HOD pages, show switch options ONLY for Student, Mentor, and HOD (remove Admin). On Admin page, remove public role-switch navigation (or provide subtle back-to-portal link).
3. Inspect layout structure and CSS/Tailwind classes causing scrolling on desktop:
   - Identify header, branding, role navigation, login card, inputs, button, footer containers.
   - Analyze Requirement R3: Desktop viewport no-scroll layout (1920×1080, 1440×900, 1366×768, 1280×720) so `scrollHeight <= innerHeight` and `scrollWidth <= innerWidth` with no clipping and without using `overflow: hidden` on body/containers or removing fields.
   - Analyze Requirement R4: Compact login card consistency across all 4 roles and mobile responsiveness (360×800 to 430×932) where natural vertical scrolling is allowed and horizontal scroll is prevented.
   - Analyze Requirement R5: Apple-inspired micro-interactions, input focus states, button press feedback, smooth card entrance, and `prefers-reduced-motion` compliance.
4. Identify exact files, components, CSS rules, and classes needing changes.
5. Write a detailed survey report to e:\Projects\pgpa web-app\.agents\teamwork\explorer_survey_2\analysis.md and deliver a complete handoff.md in your working directory.
6. Send a message to the orchestrator when finished with a summary and the path to your handoff.md.
