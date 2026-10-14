# Product Requirements Document (PRD)
## CCE Achieve — PGPA Student Achievement Management System

**Version:** 1.0  
**Status:** Requirements baseline for initial implementation  
**Initial cohort:** Second-year CCE — 61 students, 3 mentors, 1 HOD  
**Primary storage rule:** All uploaded files are stored in Google Drive. PostgreSQL stores structured records and file metadata only.

---

## 1. Product Summary

CCE Achieve is a role-based web application for organizing PGPA records for the second-year CCE cohort at Sri Sairam Engineering College. Students record activities under official PGPA components and upload certificates, photographs, and supporting documents. Mentors review submissions for their assigned students. The HOD can view department-wide records and scan a student's QR code to open an authenticated portfolio.

The application will use a Next.js frontend, a FastAPI backend, PostgreSQL for structured data, and Google Drive for all uploaded files. Authentication and authorization will be implemented by the FastAPI backend; there is no Supabase or Firebase dependency in the approved baseline.

## 2. Problem Statement

PGPA-related information is difficult to keep organized when activity details, certificates, and photographs are scattered across folders or forgotten after events. Mentors need a consolidated view of assigned students' achievements, and the HOD needs a reliable, searchable way to inspect student evidence.

## 3. Objectives

1. Provide one organized digital record for each student and PGPA component.
2. Allow multiple activities under each component, with multiple evidence files per activity.
3. Keep uploaded documents in Google Drive rather than in PostgreSQL or on the application server as permanent storage.
4. Store searchable activity metadata and Drive file identifiers in PostgreSQL.
5. Provide separate Student, Mentor, and HOD experiences.
6. Support mentor review, approval/rejection, feedback, and review history.
7. Provide HOD search, summary reports, and secure QR-based portfolio access.
8. Protect student records using server-side authentication and authorization.
9. Begin with local PostgreSQL development through pgAdmin, then deploy using an appropriately secured hosted PostgreSQL instance.

## 4. Scope

### 4.1 MVP In Scope
- Login and logout for Student, Mentor, and HOD.
- Department-provisioned accounts; no open public registration by default.
- Student profile management for approved fields.
- PGPA component catalogue, semester labels, and component detail pages.
- Multiple activities under a component.
- Google Drive upload of certificates, photos, and supporting documents.
- PostgreSQL metadata records for activities and files.
- Mentor-to-student assignments.
- Mentor review queue and approve/reject/request-correction workflow.
- HOD department overview, student search, and authorized portfolio access.
- Student-specific QR code and authenticated QR scan flow.
- Audit trail for important administrative and review actions.
- Responsive desktop and mobile UI.

### 4.2 Not in MVP Unless Approved
- Automatic calculation of official PGPA scores or points.
- Publicly accessible student portfolios.
- Native Android/iOS apps.
- AI-based certificate authenticity checks.
- Automatic OCR of certificates.
- Payments, public registration, or social features.
- Guaranteed zero-cost production hosting indefinitely.

## 5. User Roles and Permissions

### 5.1 Student
Students can:
- Sign in and sign out.
- View and update permitted personal profile fields.
- Browse PGPA components and semester labels.
- Create and edit their own draft activities.
- Submit activities for mentor review.
- Upload certificates, photos, and supporting documents.
- View their own activity status and mentor feedback.
- View their own portfolio and QR code if enabled.

Students cannot:
- Read or modify another student's private records.
- Approve their own submissions.
- Assign roles or change their own role.
- Access private Drive files belonging to another student.

### 5.2 Mentor
Mentors can:
- Sign in.
- View their assigned students.
- Open a student's component-wise activity list and evidence.
- Approve, reject, or request corrections for assigned students' submissions.
- Provide remarks and review history.

Mentors cannot:
- Access unassigned students' private records unless explicitly authorized by the HOD.
- Change their own role.
- Access Google Drive files outside the application permissions.

### 5.3 HOD
The HOD can:
- View all authorized cohort students, mentors, components, and submissions.
- Search students by name or register number.
- Review student portfolios and evidence.
- Scan a QR code to open an authorized portfolio.
- View department summaries and pending/approved/rejected counts.
- Manage mentor assignments and component catalogue if this responsibility is enabled.
- View audit history for administrative and review actions.

## 6. PGPA Component Catalogue

The screenshots supplied so far clearly identify 13 distinct components. The project owner expects 14 total components, so the 14th component must be confirmed and must not be invented.

1. Skillrack
2. Academics (GPA)
3. AMCAT
4. Clubs & Cells
5. Sairam Innovation Eco-System — Ideathon, Solvethon, Innovathon, Inspirathon as applicable
6. NPTEL (Non-Credit Transfer)
7. SAIL (Sairam Artificial Intelligence Learning)
8. Online Certifications
9. FIT INDIA Certifications
10. Internship
11. Sairam SDG Action Programme
12. Sports & Games
13. Scouts for SDGs

Requirements:
- Component names must be stored in PostgreSQL, not hard-coded in frontend components.
- Components must support display ordering and active/inactive status.
- Semester or academic period must be represented explicitly.
- The design must support components recurring across semesters or having semester-specific entries; the exact policy is an open decision.
- Historical activity records must remain accessible if a component is archived.

## 7. Core User Journeys

### 7.1 Student submits an activity
1. Student signs in.
2. Student chooses a semester/academic period and PGPA component.
3. Student selects **Add Activity**.
4. Student enters activity title, event date, organizer, activity type, description, and outcome where applicable.
5. Student uploads one or more evidence files.
6. Backend validates the request and uploads files to the configured private Google Drive folder.
7. PostgreSQL stores activity metadata and Drive file IDs; no file binary is stored in PostgreSQL.
8. Student saves a draft or submits for review.
9. The student sees the resulting status.

### 7.2 Mentor reviews an activity
1. Mentor signs in.
2. Mentor opens the assigned-student list or pending review queue.
3. Mentor opens an activity and views authorized evidence.
4. Mentor approves, rejects with a reason, or requests corrections.
5. Backend updates the current status and appends a review history record.
6. Student sees the result and can correct/resubmit when allowed.

### 7.3 HOD scans a student QR code
1. HOD signs in.
2. HOD opens the scanner and grants browser camera permission.
3. QR code contains only an opaque identifier or application URL, not personal details or document URLs.
4. Backend validates the logged-in user's role and access rights.
5. The correct portfolio is displayed.
6. A QR code never bypasses login or server-side authorization.

## 8. Functional Requirements

### FR-01 Authentication
- FastAPI owns login, logout/session handling, and authorization.
- Passwords must be hashed with Argon2id or another approved modern password hashing scheme; never store plaintext passwords.
- Accounts are provisioned by a trusted admin/bootstrap process.
- Public self-registration is disabled by default.
- Rate-limit login and password-reset endpoints.
- Use short-lived access tokens and a carefully designed refresh/session mechanism.
- Never trust a role sent by the browser.

### FR-02 Profile management
- Store name, register number, email, role, department, year, active status, and timestamps as appropriate.
- Enforce uniqueness for email and register number where applicable.
- Collect only data required for PGPA operations.

### FR-03 Components and semester
- Display components grouped by semester/academic period.
- Authorized administrators can add, update, reorder, or archive components.
- Archived components remain linked to historical records.

### FR-04 Activities
- A student can create multiple activities under a component.
- Store title, type, organizer, event date, description, outcome, status, creator, and timestamps.
- Support `draft`, `pending`, `approved`, and `rejected` states.
- Editing after submission must follow a controlled correction/resubmission workflow.
- Approved records must not be silently overwritten.

### FR-05 File handling
- All certificate/photo/document binaries are stored in Google Drive.
- PostgreSQL stores only file metadata, Drive file ID, provider, activity relationship, and upload audit details.
- Files must remain private; do not rely on public Drive links.
- Backend validates file size, type, extension, and safe filename.
- Backend checks user permissions before upload, metadata retrieval, or file viewing.
- Google credentials remain server-side and must never be committed to source control.
- If a Drive upload succeeds but the database write fails, the backend should attempt cleanup or log the orphan for reconciliation.

### FR-06 Mentor assignment and review
- Each student has an active primary mentor unless the department decides otherwise.
- HOD/admin can assign or reassign students.
- Mentor access is restricted to assigned students.
- Rejection requires a reason.
- Each review records reviewer, action, remarks, and timestamp.

### FR-07 HOD dashboard
- Show total students, activity counts, pending reviews, and approval status summaries.
- Search/filter by student, register number, mentor, component, semester, and status.
- Provide authenticated student portfolio access.

### FR-08 QR portfolio
- Generate one QR code per student or portfolio token.
- QR contains no personal data, credentials, or direct private file links.
- Backend authorizes every portfolio request.
- Tokens should be unguessable and revocable if a separate portfolio token is used.

### FR-09 Reporting
- Provide student-wise activity and evidence summaries.
- Provide department and mentor-level summaries.
- CSV/PDF export can be added if approved.
- Do not calculate official PGPA points without an official scoring specification.

### FR-10 Audit trail
- Record approvals, rejections, role changes, mentor assignments, component changes, and sensitive file actions.
- Audit entries include actor, action, target, timestamp, and safe metadata.
- Never log passwords, tokens, or private keys.

## 9. File Storage Rules

**Mandatory architecture rule:**
- PostgreSQL: structured records and file metadata only.
- Google Drive: all uploaded certificates, photos, PDFs, and supporting documents.
- Application server: temporary processing only; no permanent file storage.
- Frontend: must not store privileged Drive credentials or expose private file links.

Suggested Drive folder structure:

```text
CCE_PGPA/
  <student-opaque-id>/
    <component-slug>/
      <activity-opaque-id>/
        <uploaded-file>
```

Use opaque IDs in folder/file names where practical. Do not use register numbers in publicly visible URLs. Folder creation can be automated by the backend.

## 10. Main Screens

### Student
- Login
- Dashboard
- Profile
- Semester/component list
- Component detail and activity list
- Create/edit activity
- Upload evidence
- Submission status and feedback
- Portfolio and QR view

### Mentor
- Login
- Mentor dashboard
- Assigned students
- Student portfolio
- Pending review queue
- Submission detail/evidence viewer
- Review history

### HOD
- Login
- Department dashboard
- Student directory and portfolio
- Mentor assignments
- Component catalogue management (if enabled)
- Reports
- QR scanner
- Audit view

## 11. Acceptance Criteria

1. A provisioned user can sign in and receive the correct role-based experience.
2. A student can create multiple activities under a component.
3. A student can upload multiple files for an activity; all binaries are stored in Drive, not PostgreSQL.
4. PostgreSQL stores only Drive identifiers and file metadata for uploaded evidence.
5. Student A cannot read or modify Student B's records by changing a URL or API identifier.
6. A mentor cannot access an unassigned student's private records.
7. Rejection requires a reason and creates a review log.
8. HOD can search the cohort and open authorized portfolios.
9. QR scanning does not bypass authentication or authorization.
10. Drive files remain private and are served only after backend authorization.
11. The component catalogue is database-driven.
12. The missing 14th component is confirmed before final production seed data.
13. Important review and administrative actions are auditable.
14. The UI works on desktop and mobile browsers.
15. No secrets are committed to GitHub.

## 12. Open Decisions

1. Confirm the 14th PGPA component.
2. Confirm whether components repeat each semester or are configured per semester.
3. Confirm exact mentor-to-student allocation.
4. Confirm login identifier: college email, register number, or both.
5. Confirm account creation and password reset process.
6. Confirm accepted file formats and maximum file size.
7. Confirm ownership of the Google Drive account and folder.
8. Confirm whether HOD can edit component catalogue and override reviews.
9. Confirm CSV/PDF export requirements.
10. Confirm official PGPA scoring rules if scoring is required.

## 13. Release Plan

### MVP
- FastAPI authentication and role checks.
- PostgreSQL schema and migrations.
- Student profile and component catalogue.
- Activity submission.
- Google Drive upload and private file retrieval.
- Mentor assignments and review.
- HOD dashboard and QR lookup.
- Audit trail and deployment documentation.

### Later releases
- PDF/CSV reports.
- Bulk roster import.
- Additional semesters/cohorts.
- Optional notifications.
- Official scoring logic only after the department provides the rules.
