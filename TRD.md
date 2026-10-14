# Technical Requirements Document (TRD)
## CCE Achieve — PGPA Student Achievement Management System

**Version:** 1.0  
**Architecture:** Next.js + FastAPI + PostgreSQL + Google Drive API  
**Initial development database:** Local PostgreSQL managed through pgAdmin 4  
**Production target:** Hosted PostgreSQL and FastAPI deployment  
**File storage rule:** All uploaded files reside in Google Drive; PostgreSQL contains metadata only.

---

## 1. Technical Overview

CCE Achieve is a modular monolith: one FastAPI application with separated routers, services, data models, and authorization dependencies. This is simpler to develop and maintain than microservices for the initial 61-student cohort.

### Technology stack
- Frontend: Next.js + TypeScript.
- UI: Tailwind CSS and optionally shadcn/ui.
- Backend: Python 3.12+ and FastAPI.
- Validation: Pydantic v2.
- Database: PostgreSQL.
- Local database administration: pgAdmin 4.
- ORM: SQLAlchemy 2.x.
- Migrations: Alembic.
- Authentication: FastAPI-managed authentication using Argon2id password hashes and JWT/session controls.
- File storage: Google Drive API.
- QR generation: Python `qrcode` or equivalent.
- QR scanning: browser library such as `html5-qrcode`.
- Testing: pytest and FastAPI TestClient/httpx.
- Version control: GitHub.

No Supabase or Firebase is required in this architecture.

## 2. High-Level Architecture

```text
Student / Mentor / HOD browser
             |
             v
       Next.js frontend
             |
          HTTPS/JSON
             |
             v
        FastAPI backend
       /       |        \
      v        v         v
 Authentication Domain   File service
 & authorization logic   |
      |        |         v
      |        |     Google Drive API
      |        |
      +--------v
          PostgreSQL
    (structured data + metadata)
```

### Data ownership
- PostgreSQL stores users, roles, assignments, PGPA components, activities, review history, audit records, and file metadata.
- Google Drive stores all uploaded file binaries.
- FastAPI mediates access to both systems.
- The browser must never receive PostgreSQL credentials or privileged Google credentials.
- No uploaded file binary should be stored in PostgreSQL large-object/bytea columns or as permanent local server storage.

## 3. Repository Structure

```text
cce-achieve/
├── frontend/
│   ├── app/
│   │   ├── (auth)/login/
│   │   ├── student/
│   │   ├── mentor/
│   │   ├── hod/
│   │   └── portfolio/
│   ├── components/
│   ├── lib/
│   ├── services/
│   ├── types/
│   ├── package.json
│   └── .env.example
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── security.py
│   │   │   └── permissions.py
│   │   ├── db/
│   │   │   ├── session.py
│   │   │   └── base.py
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── api/v1/
│   │   ├── services/
│   │   │   ├── auth_service.py
│   │   │   ├── achievement_service.py
│   │   │   ├── review_service.py
│   │   │   ├── drive_service.py
│   │   │   └── qr_service.py
│   │   └── tests/
│   ├── alembic/
│   ├── alembic.ini
│   ├── requirements.txt
│   └── .env.example
├── docs/
│   ├── PRD.md
│   └── TRD.md
├── .gitignore
└── README.md
```

## 4. PostgreSQL Setup via pgAdmin

1. Use the existing PostgreSQL server in pgAdmin.
2. Create a new database named `cce_achieve`.
3. Do not modify or reuse unrelated databases such as `fastship` or `finestock`.
4. Use a dedicated application database role for the application; do not connect from FastAPI as a PostgreSQL superuser.
5. Keep the database password in the backend `.env` file locally and in the deployment host's secret configuration in production.
6. Use Alembic migrations to create and evolve tables; do not manually create production tables through the pgAdmin UI.
7. For production, use a secure hosted PostgreSQL service or securely hosted PostgreSQL instance. Do not expose the local development database directly to the public internet.

## 5. Database Schema

Use UUID primary keys where appropriate, `TIMESTAMPTZ` for timestamps, foreign keys, uniqueness constraints, and indexes on frequently filtered columns.

### 5.1 `users`
- `id UUID PRIMARY KEY`
- `full_name VARCHAR(...) NOT NULL`
- `email VARCHAR(...) UNIQUE NOT NULL` (normalize to lowercase)
- `register_number VARCHAR(...) UNIQUE NULL` (required for student accounts)
- `role ENUM('student','mentor','hod') NOT NULL`
- `department VARCHAR(...) NOT NULL DEFAULT 'CCE'`
- `year SMALLINT NULL`
- `password_hash TEXT NOT NULL`
- `is_active BOOLEAN NOT NULL DEFAULT TRUE`
- `created_at TIMESTAMPTZ NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`

Rules:
- Never store plaintext passwords.
- Public registration is disabled by default.
- Role assignment is performed only through trusted administrative/bootstrap logic.
- A user cannot update their own role.

### 5.2 `mentor_assignments`
- `id UUID PRIMARY KEY`
- `mentor_id UUID NOT NULL REFERENCES users(id)`
- `student_id UUID NOT NULL REFERENCES users(id)`
- `assigned_by UUID REFERENCES users(id)`
- `assigned_at TIMESTAMPTZ NOT NULL`
- `ended_at TIMESTAMPTZ NULL`
- Unique/active-assignment constraints as appropriate.

Business rule: one active primary mentor per student unless the department approves a different model.

### 5.3 `pgpa_components`
- `id UUID PRIMARY KEY`
- `name VARCHAR(...) NOT NULL`
- `slug VARCHAR(...) UNIQUE NOT NULL`
- `description TEXT NULL`
- `semester_label VARCHAR(...) NULL`
- `academic_period VARCHAR(...) NULL`
- `display_order INTEGER NOT NULL`
- `is_active BOOLEAN NOT NULL DEFAULT TRUE`
- `created_at TIMESTAMPTZ NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`

Seed the 13 confirmed component names. Do not invent the missing 14th component. Confirm the semester policy before finalizing seed records.

### 5.4 `achievements`
- `id UUID PRIMARY KEY`
- `student_id UUID NOT NULL REFERENCES users(id)`
- `component_id UUID NOT NULL REFERENCES pgpa_components(id)`
- `title VARCHAR(...) NOT NULL`
- `activity_type VARCHAR(...) NULL`
- `organizer VARCHAR(...) NULL`
- `event_date DATE NULL`
- `description TEXT NULL`
- `outcome VARCHAR(...) NULL`
- `status ENUM('draft','pending','approved','rejected') NOT NULL DEFAULT 'draft'`
- `submitted_at TIMESTAMPTZ NULL`
- `created_at TIMESTAMPTZ NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`

Rules:
- Students can create/edit their own drafts.
- Submitted records can only be edited through a defined correction/resubmission flow.
- Approved records must not be silently overwritten.

### 5.5 `achievement_files`
This table contains metadata only, never the file binary.

- `id UUID PRIMARY KEY`
- `achievement_id UUID NOT NULL REFERENCES achievements(id)`
- `provider VARCHAR(...) NOT NULL DEFAULT 'google_drive'`
- `drive_file_id TEXT NOT NULL`
- `drive_folder_id TEXT NULL`
- `original_filename VARCHAR(...) NOT NULL`
- `mime_type VARCHAR(...) NOT NULL`
- `size_bytes BIGINT NOT NULL`
- `file_category VARCHAR(...) NOT NULL` — `certificate`, `photo`, or `supporting_document`
- `uploaded_by UUID NOT NULL REFERENCES users(id)`
- `created_at TIMESTAMPTZ NOT NULL`

Do not treat `drive_file_id` as proof of authorization. Every read/download request must check access through FastAPI.

### 5.6 `verification_logs`
- `id UUID PRIMARY KEY`
- `achievement_id UUID NOT NULL REFERENCES achievements(id)`
- `reviewer_id UUID NOT NULL REFERENCES users(id)`
- `action VARCHAR(...) NOT NULL` — `approved`, `rejected`, `requested_changes`
- `remarks TEXT NULL`
- `created_at TIMESTAMPTZ NOT NULL`

Every review decision appends a row; prior decisions are preserved.

### 5.7 `audit_logs`
- `id UUID PRIMARY KEY`
- `actor_id UUID NULL REFERENCES users(id)`
- `action VARCHAR(...) NOT NULL`
- `target_type VARCHAR(...) NOT NULL`
- `target_id UUID NULL`
- `metadata JSONB NOT NULL DEFAULT '{}'`
- `created_at TIMESTAMPTZ NOT NULL`

Never log passwords, tokens, Google credentials, or private keys.

### 5.8 Optional `portfolio_tokens`
If the QR flow needs a separate revocable identifier:
- `id UUID PRIMARY KEY`
- `student_id UUID NOT NULL REFERENCES users(id)`
- `token_hash TEXT UNIQUE NOT NULL`
- `is_active BOOLEAN NOT NULL DEFAULT TRUE`
- `created_at TIMESTAMPTZ NOT NULL`
- `revoked_at TIMESTAMPTZ NULL`

## 6. Authentication and Authorization

### Authentication flow
1. Client submits login identifier and password over HTTPS.
2. FastAPI finds an active account and verifies the password with Argon2id.
3. FastAPI issues a short-lived access credential and establishes the chosen session/refresh mechanism.
4. Protected requests authenticate the caller.
5. Authorization dependencies verify role, record ownership, and mentor assignment for every protected action.

Implementation decisions:
- Prefer secure `HttpOnly`, `Secure`, `SameSite` cookies for browser sessions where practical, with CSRF protection as required; otherwise document and secure the bearer-token strategy.
- Do not persist long-lived bearer tokens in `localStorage` where avoidable.
- Implement login throttling and safe error messages.
- Provide an admin-only account provisioning flow and password reset/change flow.
- Disable accounts rather than deleting history when a student leaves the cohort.

### Authorization rules
- Student: own profile, own achievements, and own authorized file records.
- Mentor: assigned students' profiles, submissions, and evidence; can review those submissions.
- HOD: department-wide access and approved administrative actions.
- A QR code is an identifier, not an authorization credential.
- Every endpoint must enforce these rules on the server.

## 7. API Design

Base path: `/api/v1`. Use JSON except multipart upload endpoints. Validate requests with Pydantic, return consistent errors, paginate list endpoints, and use HTTPS in deployed environments.

### Authentication
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/change-password`
- Optional: password reset and refresh/session endpoints based on the selected session design.

### Components
- `GET /api/v1/components`
- `GET /api/v1/components/{component_id}`
- `POST /api/v1/hod/components`
- `PATCH /api/v1/hod/components/{component_id}`
- `POST /api/v1/hod/components/{component_id}/archive`

### Student activities
- `GET /api/v1/students/me`
- `PATCH /api/v1/students/me`
- `GET /api/v1/students/me/achievements`
- `POST /api/v1/achievements`
- `GET /api/v1/achievements/{achievement_id}`
- `PATCH /api/v1/achievements/{achievement_id}`
- `POST /api/v1/achievements/{achievement_id}/submit`
- `POST /api/v1/achievements/{achievement_id}/files`
- `GET /api/v1/achievements/{achievement_id}/files`
- `GET /api/v1/files/{file_id}/content`

### Mentor
- `GET /api/v1/mentor/students`
- `GET /api/v1/mentor/students/{student_id}`
- `GET /api/v1/mentor/submissions?status=pending`
- `POST /api/v1/mentor/achievements/{achievement_id}/approve`
- `POST /api/v1/mentor/achievements/{achievement_id}/reject`
- `POST /api/v1/mentor/achievements/{achievement_id}/request-changes`

### HOD
- `GET /api/v1/hod/dashboard`
- `GET /api/v1/hod/students`
- `GET /api/v1/hod/students/{student_id}/portfolio`
- `GET /api/v1/hod/mentors`
- `POST /api/v1/hod/mentor-assignments`
- `DELETE /api/v1/hod/mentor-assignments/{assignment_id}`
- `GET /api/v1/hod/reports`
- `GET /api/v1/hod/audit-logs`
- QR portfolio endpoint that validates both the opaque identifier and the caller's authorization.

Mentor routes must check that the requested student is actively assigned to the current mentor. HOD routes must verify the HOD role and department scope.

## 8. Google Drive File Service

### Upload flow
1. Authenticate the caller.
2. Check activity ownership or explicitly authorized reviewer/admin permission.
3. Validate file size, MIME type, extension, and safe filename.
4. Create or locate the private student/component/activity folder using opaque identifiers.
5. Upload the file through the Drive API.
6. Save only Drive file ID and metadata in `achievement_files`.
7. Return metadata to the frontend; do not return a public share link.
8. If Drive upload succeeds but the database transaction fails, attempt cleanup or record the orphan for reconciliation.

### Read/preview flow
1. Client requests a file through FastAPI.
2. Backend checks user role and relationship to the achievement.
3. Backend retrieves the file through Drive API or creates a short-lived authorized access mechanism if supported by the selected design.
4. Never change files to public just to make previews work.

### Google configuration
- Use an institution-approved Google account/folder.
- Decide between OAuth and service account based on Drive ownership and policy.
- If a service account is used, grant access to the intended folder and verify quota/ownership behavior.
- Store credentials in backend environment secrets, never in frontend variables or Git.
- Configure allowed file types and maximum upload size before production.

## 9. QR Code Requirements

- Generate an opaque, unguessable student portfolio identifier.
- QR contains only an application URL or opaque token.
- Never encode student name, register number, email, certificate URL, or private details.
- Require HOD authentication for HOD-only portfolio access.
- Revoke/regenerate tokens if exposed.
- QR scan must not bypass backend authorization.
- Browser scanning requires camera permission and a compatible browser; provide manual lookup as a fallback.

## 10. Environment Configuration

Example `backend/.env.example`:

```dotenv
APP_ENV=development
APP_NAME=CCE Achieve API
API_V1_PREFIX=/api/v1
DATABASE_URL=postgresql+psycopg://APP_USER:APP_PASSWORD@localhost:5432/cce_achieve
JWT_SECRET_KEY=replace-with-a-long-random-secret
ACCESS_TOKEN_EXPIRE_MINUTES=15
FRONTEND_ORIGINS=http://localhost:3000
GOOGLE_DRIVE_FOLDER_ID=
GOOGLE_SERVICE_ACCOUNT_FILE=
MAX_UPLOAD_SIZE_MB=10
```

Notes:
- Adjust `DATABASE_URL` to the installed PostgreSQL driver and environment.
- Create a dedicated least-privilege PostgreSQL application user; do not use the PostgreSQL superuser in the app.
- Put real values only in `.env`, which must be ignored by Git.
- Keep `.env.example` placeholder-only.
- Production secrets belong in the hosting provider's secret settings.
- `GOOGLE_SERVICE_ACCOUNT_FILE` is one possible configuration; OAuth may use different variables.

Example `frontend/.env.example`:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
```

Only non-secret values may use `NEXT_PUBLIC_` variables.

## 11. Local Development Setup

### PostgreSQL
1. Open pgAdmin 4.
2. Use the existing PostgreSQL server.
3. Create a new database named `cce_achieve`.
4. Leave unrelated databases unchanged.
5. Create a dedicated application role and grant only required privileges.
6. Configure the local `DATABASE_URL` in `backend/.env`.

### FastAPI backend
Create and activate a virtual environment from the `backend` directory.

Windows PowerShell:
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install fastapi "uvicorn[standard]" sqlalchemy alembic "psycopg[binary]" pydantic-settings pyjwt "pwdlib[argon2]" python-multipart email-validator pytest httpx
uvicorn app.main:app --reload
```

macOS/Linux:
```bash
python -m venv .venv
source .venv/bin/activate
pip install fastapi "uvicorn[standard]" sqlalchemy alembic "psycopg[binary]" pydantic-settings pyjwt "pwdlib[argon2]" python-multipart email-validator pytest httpx
uvicorn app.main:app --reload
```

Pin versions in the final dependency file and use a lockfile for reproducibility. Install the Google Drive client library after the authentication method is selected.

### Frontend
```bash
cd frontend
npm install
npm run dev
```

FastAPI interactive docs are usually available at `/docs` locally. Review whether they should be disabled or protected in production.

## 12. Migrations and Seed Data

- Use Alembic for all schema changes.
- Commit migration scripts.
- Test migrations against a clean development database.
- Never rely on manual production table edits.
- Seed the 13 confirmed components initially; add the 14th only after confirmation.
- Create initial HOD/mentor accounts through a trusted bootstrap command or script.
- Import student roster only after department approval.
- Seed scripts must be repeatable and must not reset passwords or overwrite production data unexpectedly.

## 13. Security Checklist

- Argon2id password hashing.
- Short-lived credentials and safe session strategy.
- Server-side role/ownership/assignment checks.
- HTTPS in deployment.
- Exact CORS allowlist.
- Login and upload rate limits.
- Pydantic validation and ORM parameterization.
- Private Google Drive folder and authorized file retrieval.
- No secrets committed to source control.
- Safe file type/size validation.
- Audit logs for reviews, role changes, assignments, and component edits.
- No sensitive details in application logs.
- Database backups and a tested recovery plan.
- IDOR/BOLA tests across all roles.
- No public database exposure from the development laptop.

## 14. Testing Plan

### Unit tests
- Password hash/verify.
- Role and ownership policy functions.
- Activity status transitions.
- File type/size validation.
- QR token generation and validation.

### API tests
- Login success/failure.
- Disabled account cannot sign in.
- Student cannot access another student's profile/activity/file.
- Mentor cannot access an unassigned student.
- Mentor can approve/reject assigned submissions.
- Rejection requires remarks.
- HOD can access authorized department summaries.
- QR identifier does not bypass login.
- File content route checks permissions.
- Invalid/oversized file is rejected.
- Database failure after Drive upload triggers cleanup/reconciliation handling.

### End-to-end tests
- Student activity upload → mentor review → student sees status.
- HOD login → QR scan → authorized portfolio.
- Camera permission denied → manual search fallback.
- Mobile/desktop layout.
- Drive quota/network failure displays a safe error and does not leak credentials.

## 15. Deployment Plan

1. Finish local development with pgAdmin/PostgreSQL.
2. Provision a hosted PostgreSQL database for production.
3. Run Alembic migrations against the production database.
4. Deploy FastAPI to a compatible host.
5. Configure production secrets and exact CORS origins.
6. Deploy Next.js and set the API base URL.
7. Configure Google Drive folder permissions and backend credentials.
8. Create HOD and mentor accounts using a trusted bootstrap workflow.
9. Import the approved 61-student roster and mentor assignments.
10. Seed the confirmed component catalogue.
11. Run role-based security smoke tests.
12. Configure backups, account ownership, recovery, and maintenance documentation.

Do not expose the local pgAdmin/PostgreSQL instance directly to the public internet. Free hosting/database plans may have quotas, sleeping policies, and terms that can change; verify them before choosing production services.

## 16. Performance and Reliability

The initial cohort is small; a modular monolith is sufficient. Add indexes for register number, email, status, component, student, mentor assignment, and event date as appropriate. Paginate large lists. Add timeouts and safe error handling around Google Drive requests. Avoid introducing microservices or caching until there is a measured need.

## 17. Open Decisions

1. Confirm the 14th PGPA component.
2. Confirm whether components recur across semesters or are semester-specific.
3. Confirm the login identifier and account provisioning policy.
4. Confirm mentor assignments and whether multiple mentors per student are allowed.
5. Confirm Google Drive account ownership and OAuth/service-account strategy.
6. Confirm allowed file types and maximum upload size.
7. Confirm QR access policy and whether HOD-only access is required.
8. Confirm HOD override permissions.
9. Confirm export requirements.
10. Confirm official PGPA scoring rules if calculations are required.

## 18. Definition of Done

- PRD MVP acceptance criteria pass.
- Database schema can be created from Alembic migrations.
- Student, mentor, and HOD authentication/authorization work.
- Uploaded file binaries exist in Google Drive only; PostgreSQL contains metadata only.
- Mentor review flow records immutable history.
- QR lookup cannot bypass authorization.
- Automated tests cover cross-student and cross-mentor access attempts.
- No secrets are committed.
- Local setup and deployment steps are documented.
