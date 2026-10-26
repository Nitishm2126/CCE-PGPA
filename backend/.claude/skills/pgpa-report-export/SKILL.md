---
name: pgpa-report-export
description: Implement the complete CCE-PGPA Excel and PDF export workflow for mentors and HODs, with secure filters, all official components, eight semesters, and accurate academic results. Use for end-to-end reporting and export tasks.
argument-hint: "[export-excel|export-pdf] [mentor|hod|student] [filters]"
metadata:
  author: cce-pgpa
  version: "1.0.0"
---

# CCE-PGPA Report Export Skill

## Goal
Implement and maintain a complete, secure, and production-grade Excel (.xlsx) and PDF (.pdf) export workflow for the CCE-PGPA application across Faculty Mentor and Department HOD dashboards.

## Architecture & Workflow

### 1. Dashboards & UI
- Add intuitive, accessible **Export Data** action buttons in both the Mentor Dashboard and Department HOD Dashboard.
- Modal or popover interface allowing the user to select format:
  - **Excel Spreadsheet (.xlsx)** via `openpyxl`
  - **PDF Document (.pdf)** via `reportlab`
- Secure filter controls:
  - **Semester**: All Semesters, or specific semester (Semesters 1 through 8)
  - **Component**: All Components, or filtered by specific PGPA component (14 official components)
  - **Student**: All Mentees / Department Students, or a specific single student for individual report card generation
  - **Status**: All Submissions, Approved Only, or Pending Review
- Provide an **Individual Student Report** option that generates a comprehensive academic progress card (PGPA tally, component breakdown, submission history, and approval trails).

### 2. Authorization & Permissions
- **Faculty Mentors**:
  - Strictly limited to students actively assigned to the authenticated mentor (`MentorAssignment.mentor_id == current_user.id`, `is_active == True`).
  - Cannot export or inspect records of unassigned students or students of other mentors.
- **Department HODs**:
  - Strictly limited to students within the HOD's authorized department (`StudentProfile.department == hod_profile.department`).
  - Cannot export or access records of other departments.
- Backend must enforce permissions on every query regardless of frontend filter parameters.
- Rejection with 403 Forbidden or 404 Not Found if unauthorized student or scope is requested.

### 3. Data Integrity & Academic Calculations
- Reuse the official `calculate_student_semester_pgpa` and component evaluation services.
- Never parse or treat letter grade labels (`O`, `A+`, `A`, `B+`, `B`, `C`, `RA`) as raw numeric points.
- Preserve clear distinction between:
  - Raw score (marks/percentage/counts)
  - Derived letter grade (`O`, `A+`, `A`, etc.)
  - Grade points (e.g. 10, 9, 8, etc.)
  - Component credits
  - Approval status (`approved`, `pending`, `draft`, `rejected`)
- Exports must be strictly read-only: never mutate database records, approval statuses, or timestamps during an export operation.

### 4. Excel Generation Quality (`openpyxl`)
- Professional workbook formatting:
  - Cohesive institutional styling (primary navy/blue headers, zebra stripes, clean typography, borders, auto-adjusted column widths).
  - Multi-tab workbook structure:
    - Tab 1: **Summary & Roster** (Student Register No, Name, Mentor, Approved Credits, CGPA/PGPA)
    - Tab 2: **Semester Results** (Semester-wise PGPA matrix Sem 1 to 8)
    - Tab 3: **Component Breakdown** (14 official components performance)
    - Tab 4: **Pending Approvals** (Submissions awaiting review)
  - Formula injection prevention: prefix any user input starting with `=`, `+`, `-`, `@` with a leading apostrophe `'`.
  - Proper MIME type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
  - Content-Disposition with clean, descriptive filename (e.g., `CCE_PGPA_Report_Semester_4_20261025.xlsx`).

### 5. PDF Generation Quality (`reportlab`)
- Clean, printable PDF layout:
  - Institutional header (College/Department banner, Date of Generation, Scope/Filter summary).
  - Summary metrics card / table.
  - Tabular results with wrap-aware cells, alternating row background colors, clean grid lines, and pagination footer (Page X of Y).
  - Proper MIME type: `application/pdf`.
  - Content-Disposition with clean filename (e.g., `CCE_PGPA_Report_20261025.pdf`).

### 6. Robustness & Error Handling
- Safe handling of empty datasets (returns friendly empty-state document or clean report indicating zero records matched).
- Formula injection sanitization on all text cells.
- Streaming responses using `io.BytesIO` buffer to prevent disk clutter and handle concurrency safely.
