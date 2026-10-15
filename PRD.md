# Product Requirements Document (PRD)
## CCE Achieve — PGPA Student Achievement Management System

**Version:** 1.1 (Architecture Update: Firebase Authentication Integration)
**Status:** Requirements baseline for implementation
**Frontend target:** Next.js (TypeScript) deployed on Vercel
**Backend target:** FastAPI (Python 3.12+) deployed on a containerized/hosted service
**Initial cohort:** Second-year CCE — 61 students, 3 mentors, 1 HOD
**Primary storage rule:** All uploaded evidence binaries (certificates, photos, PDFs) reside strictly in Google Drive. PostgreSQL stores structured records and file metadata only.
**Authentication model:** Firebase Authentication handles client identity and credential lifecycle; FastAPI backend validates Firebase ID tokens via the Firebase Admin SDK and strictly enforces application roles and permissions stored in PostgreSQL.

---

## 1. Product Summary

CCE Achieve is a role-based web application for organizing, verifying, and tracking PGPA (Performance Grade Point Average) records for the second-year CCE cohort at Sri Sairam Engineering College. Students record activities under official PGPA components and upload certificates, photographs, and supporting evidence. Faculty mentors inspect and verify submissions for their assigned mentees. The Head of Department (HOD) oversees department-wide progress, monitors mentor queues, and scans student QR codes to access authenticated portfolios.

The application architecture consists of:
1. **Frontend:** A Next.js (TypeScript) web application hosted on Vercel, featuring dedicated, responsive dashboard experiences for Student, Mentor, and HOD roles.
2. **Identity & Authentication (Planned):** Firebase Authentication provides secure identity management, sign-in (email/password and/or institutional Google login), password resets, and token issuance.
3. **Backend:** A modular FastAPI application providing business logic, validation, approval workflows, QR generation/verification, and strict role-based access control (RBAC).
4. **Database:** PostgreSQL (managed with SQLAlchemy 2.x and Alembic) as the absolute source of truth for users, roles, profiles, mentor assignments, PGPA components, activity records, verification history, and file metadata.
5. **Evidence Storage:** Google Drive API for secure, private storage of all certificate, photo, and document binaries. *(Backend integration code implemented and test-verified; live production connectivity pending).*

---

## 2. Problem Statement

PGPA-related information is difficult to manage effectively when activity descriptions, certificates, and event photographs are scattered across local folders, messaging apps, or personal drives. Mentors lack a consolidated, real-time dashboard of their assigned students' achievements, and the HOD has no reliable, searchable way to inspect student portfolios or audit department verification progress. Furthermore, authentication must be frictionless and secure for college users while ensuring student records remain strictly isolated and protected against unauthorized access or role elevation.

---

## 3. Objectives

1. Provide one organized, tamper-evident digital record for each student across all official PGPA components.
2. Allow multiple activities under each component, with multiple evidence files per activity.
3. Keep all uploaded document and image binaries in private Google Drive folders rather than in PostgreSQL or permanent local server disks.
4. Store searchable activity metadata and Google Drive file identifiers in PostgreSQL.
5. Provide distinct, customized frontend experiences for Student, Mentor, and HOD roles.
6. Support mentor review workflows: approve, reject with mandatory remarks, request corrections, and preserve complete review histories.
7. Provide HOD search, cohort-wide summary statistics, and secure QR-based portfolio access.
8. Protect student records using industry-standard Firebase Authentication for identity management paired with server-side authorization and PostgreSQL-backed role checks on every request.
9. Prevent self-elevation of privileges: Firebase authentication alone confirms only identity; application roles (Student, Mentor, HOD) are strictly governed by PostgreSQL.
10. Support local PostgreSQL development with pgAdmin 4, followed by deployment to a production hosted database.

---

## 4. Scope

### 4.1 In Scope (MVP)
- **Authentication & User Onboarding:**
  - Secure sign-in and sign-out powered by Firebase Authentication on the Next.js frontend.
  - Authorized cohort provisioning: accounts are pre-authorized from department rosters (61 students, 3 mentors, 1 HOD). No open public registration.
  - Self-service password reset handled via Firebase Authentication email workflows.
  - FastAPI server-side verification of Firebase ID tokens using the Firebase Admin SDK.
  - Mapping Firebase UID to PostgreSQL application user records.
  - Server-side account deactivation (disabled accounts rejected immediately).
- **Role-Based Portals:**
  - Student dashboard: personal profile, PGPA components, activity submission, evidence upload, review feedback, and personal portfolio QR code.
  - Mentor dashboard: assigned mentees list, pending review queue, submission inspection, and approval/rejection with remarks.
  - HOD dashboard: department overview, cohort search, mentor assignment management, and authenticated QR scanning.
- **PGPA Component Catalogue:**
  - Database-driven catalog of 13 confirmed components (14th to be confirmed without invention).
  - Component grouping by semester/academic period.
- **Activity & Evidence Management:**
  - Creation and editing of draft activities under components.
  - Submission workflow (`draft` → `pending` → `approved` / `rejected`).
  - Google Drive upload of certificates, event photos, and PDF documents.
  - PostgreSQL metadata records linking activities to Google Drive file IDs.
- **Mentor Review & Verification:**
  - Strict 1-to-many mentor assignment (initial allocation: 25, 25, 11 students).
  - Mandatory reason on rejection; immutable verification audit log.
- **QR Portfolio Access:**
  - Student portfolio QR code containing an opaque token or route.
  - Server-side authorization check before displaying portfolio data.
- **Audit Logging:**
  - Audit trails for reviews, assignments, role checks, and sensitive file operations.

### 4.2 Not in Scope for Initial Phase
- Automatic calculation of official PGPA grade points (pending department scoring formulas).
- Publicly accessible, unauthenticated student portfolios.
- Native mobile applications (iOS/Android); responsive mobile web is required instead.
- Automated OCR or AI-based certificate tampering analysis.
- Unrestricted public self-registration or self-service role selection.
- Third-party social logins outside authorized institutional accounts.

---

## 5. User Roles and Permissions

Application authorization follows the principle of least privilege. **Firebase Authentication verifies identity only; all authorization decisions and role privileges are determined exclusively by FastAPI inspecting PostgreSQL records.**

```text
+-----------------------+     ID Token      +-----------------------+
|  Next.js (Vercel)     | ----------------> |  FastAPI Backend      |
|  (Firebase Auth SDK)  |                   |  - Verify Firebase ID |
+-----------------------+                   |    Token (Admin SDK)  |
                                            |  - Lookup User in PG  |
                                            |  - Enforce PG Role    |
                                            +-----------------------+
                                                       |
                                                       v
                                            +-----------------------+
                                            |  PostgreSQL Database  |
                                            |  (Source of Truth)    |
                                            +-----------------------+
```

### 5.1 Student
Students can:
- Sign in via Firebase Authentication and sign out.
- View and update permitted personal profile fields.
- Browse PGPA components and semester periods.
- Create and edit draft activities under PGPA components.
- Upload certificates, photos, and supporting evidence.
- Submit activities for mentor review.
- View their own activity status, remarks, and review history.
- View their personal portfolio and display their personal QR code.

Students cannot:
- Read or modify another student's profile, activities, or evidence.
- Approve or modify status on their own submissions.
- Elevate their own privileges or modify their assigned role.
- Access private Google Drive files belonging to another student.
- Re-assign themselves to a different mentor.

### 5.2 Mentor
Mentors can:
- Sign in via Firebase Authentication and sign out.
- View their assigned student list (25, 25, or 11 students in the initial cohort).
- Inspect pending activity submissions and evidence uploaded by assigned mentees.
- Approve submissions, reject submissions with mandatory remarks, or request corrections.
- View historical review logs for assigned students.

Mentors cannot:
- View or verify submissions of students assigned to other mentors (strict mentor isolation).
- Modify student profile data or create submissions on behalf of students.
- Alter department-wide component catalogues or mentor assignments.
- Elevate their own role to HOD.

### 5.3 Head of Department (HOD)
The HOD can:
- Sign in via Firebase Authentication and sign out.
- View department-wide statistics, total submissions, approval rates, and pending queues.
- Search cohort students by name, register number, or assigned mentor.
- Open authorized student portfolios and inspect all component achievements and evidence.
- Scan student QR codes to open authenticated portfolios.
- Manage mentor-to-student assignments.
- View comprehensive audit logs of all administrative and review actions.

The HOD cannot:
- Bypass server-side authentication or authorization checks.
- Delete immutable audit logs or verification histories.

---

## 6. PGPA Component Catalogue

The application tracks achievements across official department PGPA components stored dynamically in PostgreSQL (never hardcoded in frontend components).

### Confirmed Components (13)
1. Skillrack
2. Academics (GPA)
3. AMCAT
4. Clubs & Cells
5. Sairam Innovation Eco-System (Ideathon, Solvethon, Innovathon, Inspirathon)
6. NPTEL (Non-Credit Transfer)
7. SAIL (Sairam Artificial Intelligence Learning)
8. Online Certifications
9. FIT INDIA Certifications
10. Internship
11. Sairam SDG Action Programme
12. Sports & Games
13. Scouts for SDGs

*Note: The 14th component expected by the department must be officially confirmed and must not be invented.*

---

## 7. Core User Journeys

### 7.1 Student Submits an Activity
1. **Sign-In:** Student navigates to the Next.js login page and authenticates using Firebase Authentication.
2. **Token Acquisition:** Frontend receives a Firebase ID token and includes it as `Authorization: Bearer <token>` on all requests to FastAPI.
3. **Session Establishment:** FastAPI verifies the token via Firebase Admin SDK, extracts `firebase_uid`, finds the matching PostgreSQL student record, and confirms active account status.
4. **Draft Creation:** Student selects semester, chooses a PGPA component, enters activity details (title, dates, organization, description), and saves a draft.
5. **Evidence Upload:** Student selects certificate/photo files. FastAPI validates file type/size, streams binary to the private Google Drive folder, and writes file metadata to PostgreSQL.
6. **Submission:** Student clicks "Submit for Review". Status transitions from `draft` to `pending`.
7. **Tracking:** Student tracks status and views mentor remarks in real time.

### 7.2 Mentor Reviews a Submission
1. **Sign-In:** Mentor logs in via Firebase Authentication.
2. **Queue Inspection:** Mentor opens the review queue. FastAPI retrieves submissions only for students actively assigned to that mentor.
3. **Evidence Verification:** Mentor opens an achievement and reviews evidence streamed securely via the backend proxy.
4. **Decision:** Mentor approves, rejects (with mandatory remarks), or requests corrections.
5. **Audit Record:** FastAPI updates achievement status and creates an immutable verification log record in PostgreSQL.

### 7.3 HOD Scans a Student QR Code
1. **Sign-In:** HOD logs in via Firebase Authentication.
2. **Scan:** HOD activates the camera scanner on the Next.js dashboard.
3. **Resolution:** The QR code contains an opaque portfolio token or identifier (never PII or direct file links).
4. **Authorization:** The Next.js client requests portfolio data from FastAPI with the HOD's Bearer token.
5. **Display:** FastAPI confirms the HOD role in PostgreSQL and returns the student's portfolio view.

---

## 8. Functional Requirements

### FR-01: Authentication & Identity Management (Firebase Auth Integration)
- **Identity Provider:** Firebase Authentication manages user credentials, sign-in flows, session persistence on the frontend, and password-reset workflows.
- **Client Implementation:** Next.js uses the client-side Firebase SDK (`firebase/auth`) to handle user login and token refresh.
- **Backend Token Verification:** FastAPI intercepts every protected API call, verifies the Firebase ID token using the Firebase Admin SDK (`firebase-admin`), and extracts the `uid` and verified email.
- **Account Association:** FastAPI queries PostgreSQL using the verified `firebase_uid` (or links it to the pre-provisioned user record matching normalized email on first login).
- **Server-Side Authorization:** Every protected endpoint strictly enforces permissions based on the PostgreSQL `User.role` attribute (`student`, `mentor`, `hod`). Firebase token claims alone never grant access.
- **Password Reset:** Handled via Firebase Authentication password-reset emails, eliminating custom password reset token handling on the backend.
- **Session Lifecycle:** Short-lived Firebase ID tokens (1-hour lifespan) are refreshed automatically by the Firebase client SDK. The backend rejects expired, malformed, or revoked tokens with `401 Unauthorized`.
- **Disabled Accounts:** Inactive accounts (`is_active=False` in PostgreSQL or disabled in Firebase) are immediately rejected with `403 Forbidden`.
- **Throttling & Security:** Firebase Authentication protects against brute-force credential stuffing. Backend endpoints enforce CORS and rate limiting.

### FR-02: Profile Management
- Stores full name, register number (students), staff ID (mentors/HOD), email, department (`CCE`), cohort year (`2`), section (`A`), and timestamps.
- Uniqueness enforced on email, student register number, and mentor staff ID in PostgreSQL.

### FR-03: PGPA Component Catalogue
- Dynamic catalog stored in PostgreSQL, supporting ordering, semester tags, and active status.
- Components can be archived without breaking historical student records.

### FR-04: Activity Submission Workflow
- Full lifecycle: `draft` → `pending` → `approved` / `rejected`.
- Students can edit drafts freely; submitted records lock against edits until corrections are requested by a mentor.
- Approved records cannot be modified or overwritten.

### FR-05: Google Drive Evidence Storage
- **Architecture Mandate:** PostgreSQL stores file metadata only (`drive_file_id`, filename, MIME type, size, upload timestamp).
- All binary contents reside exclusively in Google Drive.
- Backend validates MIME types, file extensions, and file sizes (default limit: 10 MB).
- File access is mediated by FastAPI streaming proxies; no public Google Drive links are ever generated.

### FR-06: Mentor Allocation & Verification
- Mentor assignments link students to faculty mentors (1-to-many).
- Initial cohort allocation: 25 students (Mentor 1), 25 students (Mentor 2), 11 students (Mentor 3).
- Mentors can only inspect and review their assigned mentees.

### FR-07: HOD Oversight & QR Scanning
- Real-time department statistics and cohort search.
- QR code contains opaque identifiers and requires authenticated HOD role to resolve.

### FR-08: Audit Logging
- Immutable audit records for reviews, approvals, rejections, mentor assignments, and profile updates.
- Secrets, tokens, and credentials are never written to logs.

---

## 9. Security Requirements

1. **Credential Segregation:**
   - Firebase client configuration (`NEXT_PUBLIC_FIREBASE_*`) contains public identifiers only.
   - Firebase Admin SDK service account credentials (private keys) reside strictly on the FastAPI server and must never be exposed to the browser or client-side variables.
2. **Zero Secrets in Git:**
   - `.env`, service account JSON files, and private credentials are excluded via `.gitignore`.
3. **Server-Side Role Authority:**
   - Client-side role assertions or custom token claims are never trusted blindly; PostgreSQL is the sole authority for user roles and permissions.
4. **Closed Cohort Security:**
   - Public self-registration is strictly disabled. Only users pre-provisioned in PostgreSQL and Firebase Auth can access the system.
5. **Evidence Isolation:**
   - Google Drive folders are private. Direct file viewing requires an authenticated session with active authorization for that specific student record.

---

## 10. Acceptance Criteria

1. **Firebase Authentication:** A provisioned student, mentor, or HOD can sign in via Firebase Auth on Next.js, and FastAPI verifies the Firebase ID token on every API call.
2. **Server-Side Authorization:** Tampered frontend requests attempting to access unauthorized endpoints or other students' records are rejected with `403 Forbidden`.
3. **Role Segregation:** Students receive Student views, Mentors see only their assigned students, and the HOD has department-wide oversight.
4. **Google Drive Storage:** All evidence binaries are stored in Google Drive; PostgreSQL contains zero bytea/binary data.
5. **No Open Registration:** Uninvited external users cannot sign up or access any student data.
6. **Password Recovery:** Users can initiate password reset securely through Firebase Auth email workflows.
7. **Mobile Responsiveness:** All dashboards function seamlessly on desktop and mobile browsers.

---

## 11. Open Decisions

1. **Firebase Sign-In Method:** Confirm whether email/password only, Google Workspace (restricted to `@sairamtap.edu.in` and `@sairam.edu.in`), or both should be enabled.
2. **14th Component:** Await official department confirmation of the 14th PGPA component name.
3. **HOD Official Email:** Confirm HOD official email address for final provisioning.
4. **Google Drive Production Service Account:** Confirm production Google Cloud service account and shared drive permissions.

---

## 12. Release Plan

### Phase 1–5: Backend Foundation & Evidence Storage (Completed / Verified in Tests)
- [x] FastAPI modular monolith structure, PostgreSQL database, Alembic migrations.
- [x] Initial database models: User, StudentProfile, MentorProfile, MentorAssignment, Component, Achievement, AchievementFile, VerificationLog, AuditLog.
- [x] Custom JWT / Argon2id baseline authentication and role-based permissions dependencies.
- [x] Roster bootstrap CLI with optional HOD support (`--allow-missing-hod`).
- [x] Excel student roster validation and extraction tool (61 students, 3 mentors).
- [x] Google Drive modular service and file streaming proxy (tested with mocks).

### Phase 6: Architecture Realignment — Firebase Authentication Integration (Current Stage)
- [x] PRD and TRD documentation updates for Firebase Authentication.
- [ ] Backend: Add `firebase_uid` column to `users` model via Alembic migration.
- [ ] Backend: Implement Firebase Admin SDK token verification dependency in `app/core/security.py` / `app/core/permissions.py`.
- [ ] Backend: Update test suite to mock Firebase Admin SDK token verification.
- [ ] Backend: Implement controlled user provisioning/onboarding workflow for Firebase users.

### Phase 7: Next.js Frontend Development
- [ ] Next.js (TypeScript) project initialization on Vercel.
- [ ] Firebase Authentication client SDK integration.
- [ ] Student, Mentor, and HOD dashboard interfaces.
- [ ] Activity submission, file upload, review workflow, and QR scanner UI.

### Phase 8: Production Deployment & Verification
- [ ] Production PostgreSQL hosted database setup and Alembic migration.
- [ ] Production Firebase project configuration and authorized domains.
- [ ] Google Drive live service account connectivity verification.
- [ ] Live end-to-end security audit and deployment smoke tests.
