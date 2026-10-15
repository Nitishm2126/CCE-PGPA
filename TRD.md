# Technical Requirements Document (TRD)
## CCE Achieve — PGPA Student Achievement Management System

**Version:** 1.1 (Architecture Update: Firebase Authentication Integration)
**Architecture:** Next.js (Vercel) + Firebase Authentication + FastAPI + PostgreSQL + Google Drive API
**Initial development database:** Local PostgreSQL managed through pgAdmin 4
**Production target:** Hosted PostgreSQL and containerized FastAPI deployment; Next.js on Vercel
**File storage rule:** All uploaded evidence binaries reside strictly in Google Drive; PostgreSQL contains structured records and metadata only. *(Backend integration implemented with automated tests; live production connectivity pending).*
**Authentication status:** Planned architectural migration from Phase 1 custom JWT/Argon2id to Firebase Authentication with FastAPI server-side authorization.

---

## 1. Technical Overview

CCE Achieve is a modular web application comprising a Next.js frontend deployed on Vercel and a FastAPI backend service. The application enforces a strict separation between **identity verification** (delegated to Firebase Authentication) and **application authorization / role governance** (strictly enforced server-side by FastAPI and PostgreSQL).

### Technology Stack
| Layer | Technology | Purpose & Responsibility |
| :--- | :--- | :--- |
| **Frontend** | Next.js (App Router, TypeScript) | Responsive web client; Student, Mentor, and HOD role dashboards; hosted on Vercel |
| **Styling & UI** | Tailwind CSS / shadcn/ui | Modern, accessible, responsive component styling |
| **Client Auth** | Firebase Authentication SDK (`firebase/auth`) | Client sign-in, sign-out, session persistence, automatic token refresh, password reset |
| **Backend API** | Python 3.12+ / FastAPI | Business logic, API endpoints, PGPA workflows, QR validation, Google Drive mediation |
| **Backend Auth** | Firebase Admin SDK (`firebase-admin`) | Server-side verification of Firebase ID tokens, UID extraction |
| **Validation** | Pydantic v2 / Pydantic Settings | Strict schema validation, request/response models, environment configuration |
| **Database** | PostgreSQL 18 | Absolute source of truth for users, roles, profiles, assignments, components, achievements, and metadata |
| **ORM & Migrations** | SQLAlchemy 2.x / Alembic | Declarative ORM models, typed mappings, version-controlled schema migrations |
| **Evidence Storage** | Google Drive API (`google-api-python-client`) | Permanent binary storage for certificates, photos, PDFs via server-side streaming proxy |
| **Local DB Admin** | pgAdmin 4 | Local database administration and query inspection |
| **Automated Testing** | pytest / httpx / TestClient | Comprehensive test suite for auth, models, drive integration, and roster CLI |

---

## 2. High-Level Architecture & Request Flow

```text
+-----------------------------------------------------------------------------------+
|                                 CLIENT LAYER                                      |
|                                                                                   |
|   Student / Mentor / HOD Browser (Desktop & Mobile)                               |
|          |                                                                        |
|          | 1. Sign-in credentials (Email/Password or Institutional Google)        |
|          v                                                                        |
|   +------------------------------------+                                          |
|   | Next.js Frontend (Hosted on Vercel)| <--- 2. Firebase ID Token Issued          |
|   | - Firebase Client Auth SDK         |                                          |
|   +------------------------------------+                                          |
+----------|------------------------------------------------------------------------+
           |
           | 3. HTTPS API Request + Header: Authorization: Bearer <Firebase_ID_Token>
           v
+-----------------------------------------------------------------------------------+
|                                BACKEND LAYER                                      |
|                                                                                   |
|   FastAPI Application                                                             |
|   ├── Core Security & Permissions Dependency                                      |
|   │     ├── 4. Verify ID Token using Firebase Admin SDK (check expiry, signature) |
|   │     ├── 5. Extract authenticated `firebase_uid` and verified email            |
|   │     ├── 6. Query PostgreSQL `users` table via `firebase_uid`                  |
|   │     ├── 7. Enforce active status (`is_active == True`)                        |
|   │     └── 8. Check role permissions (`User.role` in [allowed_roles])           |
|   │                                                                               |
|   ├── API Routers & Business Logic (/api/v1)                                      |
|   │     ├── Student Endpoints (Draft, Submit, View Status)                        |
|   │     ├── Mentor Endpoints (Assigned Queue, Approve, Reject with Remarks)       |
|   │     ├── HOD Endpoints (Cohort Search, Mentor Assignments, QR Resolution)      |
|   │     └── File Manager Service (Upload, Authorize, Stream Content)              |
+----------|------------------------------------------------|-----------------------+
           |                                                |
           | 9. Metadata & Relational Queries               | 10. Private Binary Operations
           v                                                v
+------------------------------------+   +------------------------------------------+
| PostgreSQL Database (cce_achieve)  |   | Google Drive API (Service Account)       |
| - users & roles                    |   | - CCE_PGPA Private Root Folder           |
| - student & mentor profiles        |   | - Student / Component / Activity Folders |
| - mentor_assignments               |   | - Certificate & Photograph Binaries      |
| - pgpa_components                  |   +------------------------------------------+
| - achievements & achievement_files |
| - verification_logs & audit_logs   |
+------------------------------------+
```

### Architectural Principles
1. **Separation of Concerns:** Firebase Authentication validates identity; PostgreSQL and FastAPI enforce authorization and roles.
2. **Never Trust Client Claims:** Firebase authentication success alone never grants administrative, mentor, or student privileges. Roles cannot be elevated from the browser or by modifying client payloads.
3. **No Binary Storage in Database:** PostgreSQL stores only file metadata and `drive_file_id`; all file contents reside exclusively in Google Drive.
4. **Opaque & Private Evidence:** Google Drive files and folders use opaque UUIDs. Direct public access is disabled; all file viewing is mediated by authorized backend endpoints.

---

## 3. Repository Structure

```text
pgpa web-app/
├── frontend/                          # Next.js TypeScript application (Vercel)
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/                 # Firebase sign-in page
│   │   │   └── forgot-password/       # Firebase password-reset request page
│   │   ├── student/                   # Student portal (achievements, upload, QR)
│   │   ├── mentor/                    # Mentor portal (review queue, verify)
│   │   ├── hod/                       # HOD portal (cohort directory, assignments, scan)
│   │   └── layout.tsx
│   ├── lib/
│   │   ├── firebase.ts                # Client Firebase initialization (public config)
│   │   └── api-client.ts              # Axios/Fetch wrapper attaching Bearer token
│   ├── components/                    # Reusable UI components
│   ├── types/                         # TypeScript interfaces
│   ├── package.json
│   └── .env.example                   # Frontend environment template
├── backend/                           # FastAPI backend service
│   ├── alembic/                       # Alembic migrations directory
│   │   ├── env.py
│   │   └── versions/                  # Version migration scripts
│   ├── app/
│   │   ├── api/v1/
│   │   │   ├── endpoints/
│   │   │   │   ├── auth.py            # /me, session verification, user profile
│   │   │   │   ├── students.py        # Student profile and activities
│   │   │   │   ├── mentor.py          # Mentor queue and reviews
│   │   │   │   ├── hod.py             # HOD directory, assignments, QR lookup
│   │   │   │   └── health.py          # System and database health checks
│   │   │   └── router.py              # v1 router aggregation
│   │   ├── core/
│   │   │   ├── config.py              # Pydantic Settings
│   │   │   ├── security.py            # Password hashing & Firebase Admin SDK verifier
│   │   │   └── permissions.py         # get_current_user, require_role dependencies
│   │   ├── db/
│   │   │   ├── base.py                # DeclarativeBase
│   │   │   └── session.py             # Engine and SessionLocal
│   │   ├── models/                    # SQLAlchemy models (user, assignment, achievement, etc.)
│   │   ├── schemas/                   # Pydantic validation schemas
│   │   ├── services/
│   │   │   ├── auth_service.py        # User lookup & Firebase UID mapping
│   │   │   ├── drive_service.py       # Google Drive client & folder management
│   │   │   └── file_manager.py        # Evidence upload, authorization & streaming
│   │   ├── cli/
│   │   │   ├── bootstrap_roster.py    # Roster import CLI (--allow-missing-hod)
│   │   │   └── prepare_students_roster.py # Excel roster validator & CSV generator
│   │   └── main.py                    # FastAPI entrypoint, CORS, exception handlers
│   ├── tests/                         # Automated test suite (pytest)
│   ├── requirements.txt               # Pinned backend dependencies
│   └── .env.example                   # Backend environment template
├── PRD.md                             # Product Requirements Document
├── TRD.md                             # Technical Requirements Document
└── README.md                          # Project documentation and run guide
```

---

## 4. PostgreSQL Setup via pgAdmin 4

1. Connect to the local PostgreSQL server in pgAdmin 4.
2. Target database: `cce_achieve`.
3. Dedicated application role: `cce_app_user` (least-privilege; do not use `postgres` superuser).
4. Schema migrations are managed strictly through Alembic (`alembic upgrade head`); no manual table edits.
5. In production, use an SSL-enforced hosted PostgreSQL instance.

---

## 5. Database Schema & Models

All database tables use UUID primary keys (`as_uuid=True`), timezone-aware timestamps (`TIMESTAMPTZ`), foreign keys, and indexes on lookup columns.

### 5.1 `users` Table (Planned Schema Evolution for Firebase)
The core user model is updated to map an authenticated Firebase identity while preserving all existing application relationships:

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY, DEFAULT uuid_generate_v4()` | Internal application identifier |
| `firebase_uid` | `VARCHAR(128)` | `UNIQUE, NULLABLE, INDEXED` | **Planned:** Firebase Authentication UID |
| `full_name` | `VARCHAR(255)` | `NOT NULL` | Full legal/academic name |
| `email` | `VARCHAR(255)` | `UNIQUE, NOT NULL, INDEXED` | Normalized lowercase institutional email |
| `password_hash` | `TEXT` | `NULLABLE (initially NOT NULL)` | Argon2id hash (preserved for migration transition) |
| `role` | `ENUM` | `NOT NULL, INDEXED` | `student`, `mentor`, or `hod` |
| `is_active` | `BOOLEAN` | `NOT NULL, DEFAULT TRUE` | Deactivation toggle (checked on every request) |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT now()` | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT now()` | Last update timestamp |

#### Migration & Backward Compatibility Strategy:
- `firebase_uid` is added as `nullable=True` and `unique=True`.
- Existing user records remain completely intact with their existing UUIDs, roles, student profiles, and mentor assignments.
- `password_hash` is retained as nullable so legacy accounts continue to function until their Firebase counterpart is linked.
- On first login through Firebase Authentication, FastAPI looks up the user by verified email; if found and `firebase_uid` is null, it links `firebase_uid = decoded_token['uid']` transactionally.

### 5.2 `student_profiles` Table
- `id`: `UUID PRIMARY KEY`
- `user_id`: `UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE`
- `register_number`: `VARCHAR(50) NOT NULL UNIQUE INDEXED` (e.g., `SEC25CO001`)
- `department`: `VARCHAR(50) NOT NULL DEFAULT 'CCE'`
- `year`: `SMALLINT NOT NULL DEFAULT 2`
- `section`: `VARCHAR(10) NULL` (e.g., `A`)
- `batch`: `VARCHAR(20) NULL` (e.g., `2023-2027`)
- `phone_number`: `VARCHAR(20) NULL`
- `created_at` / `updated_at`: `TIMESTAMPTZ`

### 5.3 `mentor_profiles` Table
- `id`: `UUID PRIMARY KEY`
- `user_id`: `UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE`
- `staff_id`: `VARCHAR(50) NULL UNIQUE INDEXED`
- `department`: `VARCHAR(50) NOT NULL DEFAULT 'CCE'`
- `designation`: `VARCHAR(100) NULL` (e.g., `Assistant Professor`)
- `created_at` / `updated_at`: `TIMESTAMPTZ`

### 5.4 `mentor_assignments` Table
- `id`: `UUID PRIMARY KEY`
- `mentor_id`: `UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE INDEXED`
- `student_id`: `UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE INDEXED`
- `assigned_by`: `UUID NULL REFERENCES users(id) ON DELETE SET NULL`
- `assigned_at`: `TIMESTAMPTZ NOT NULL DEFAULT now()`
- `ended_at`: `TIMESTAMPTZ NULL`
- `is_active`: `BOOLEAN NOT NULL DEFAULT TRUE INDEXED`
- *Constraints:* Index on `(mentor_id, student_id)`, Index on `(student_id, is_active)`.

### 5.5 `pgpa_components` Table
- `id`: `UUID PRIMARY KEY`
- `name`: `VARCHAR(255) NOT NULL`
- `slug`: `VARCHAR(100) NOT NULL UNIQUE INDEXED`
- `description`: `TEXT NULL`
- `semester_label`: `VARCHAR(50) NULL`
- `academic_period`: `VARCHAR(50) NULL`
- `display_order`: `INTEGER NOT NULL DEFAULT 0`
- `is_active`: `BOOLEAN NOT NULL DEFAULT TRUE INDEXED`
- `created_at` / `updated_at`: `TIMESTAMPTZ`

### 5.6 `achievements` Table
- `id`: `UUID PRIMARY KEY`
- `student_id`: `UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE INDEXED`
- `component_id`: `UUID NOT NULL REFERENCES pgpa_components(id) ON DELETE RESTRICT INDEXED`
- `title`: `VARCHAR(255) NOT NULL`
- `activity_type`: `VARCHAR(100) NULL`
- `organizer`: `VARCHAR(255) NULL`
- `event_date`: `DATE NULL`
- `description`: `TEXT NULL`
- `outcome`: `VARCHAR(255) NULL`
- `status`: `ENUM('draft', 'pending', 'approved', 'rejected') NOT NULL DEFAULT 'draft' INDEXED`
- `submitted_at`: `TIMESTAMPTZ NULL`
- `created_at` / `updated_at`: `TIMESTAMPTZ`

### 5.7 `achievement_files` Table (Metadata Only — No Binaries)
- `id`: `UUID PRIMARY KEY`
- `achievement_id`: `UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE INDEXED`
- `provider`: `VARCHAR(50) NOT NULL DEFAULT 'google_drive'`
- `drive_file_id`: `TEXT NOT NULL INDEXED` (Google Drive file identifier)
- `drive_folder_id`: `TEXT NULL`
- `original_filename`: `VARCHAR(255) NOT NULL`
- `mime_type`: `VARCHAR(100) NOT NULL`
- `size_bytes`: `BIGINT NOT NULL`
- `file_category`: `VARCHAR(50) NOT NULL` (`certificate`, `photo`, `supporting_document`)
- `uploaded_by`: `UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT now()`

### 5.8 `verification_logs` Table
- `id`: `UUID PRIMARY KEY`
- `achievement_id`: `UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE INDEXED`
- `reviewer_id`: `UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT INDEXED`
- `action`: `VARCHAR(50) NOT NULL` (`approved`, `rejected`, `requested_changes`)
- `remarks`: `TEXT NULL`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT now()`

### 5.9 `audit_logs` Table
- `id`: `UUID PRIMARY KEY`
- `actor_id`: `UUID NULL REFERENCES users(id) ON DELETE SET NULL INDEXED`
- `action`: `VARCHAR(100) NOT NULL INDEXED`
- `target_type`: `VARCHAR(100) NOT NULL INDEXED`
- `target_id`: `UUID NULL`
- `metadata`: `JSONB NOT NULL DEFAULT '{}'`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT now()`

---

## 6. Authentication Architecture & Migration Plan

### 6.1 Target Authentication Architecture
In the target architecture, authentication and authorization are handled in a coordinated, multi-tier pipeline:

1. **Client Authentication:** The Next.js frontend uses the Firebase Authentication SDK (`firebase/auth`). The user submits credentials (e.g. email/password or institutional Google OAuth).
2. **ID Token Issuance:** Upon successful sign-in, Firebase issues an RS256-signed JWT ID token with a 1-hour lifespan, containing the `uid`, `email`, and `email_verified` claims.
3. **Bearer Authorization:** The client sends this token on every HTTP request in the header:
   ```http
   Authorization: Bearer <Firebase_ID_Token>
   ```
4. **Backend Token Verification:** FastAPI intercepts the request via a dependency (`get_current_user`). It verifies the signature and expiration against Google's public keys using `firebase_admin.auth.verify_id_token(token)`.
5. **Database User Resolution:**
   - FastAPI queries `SELECT * FROM users WHERE firebase_uid = :uid`.
   - If not found by `firebase_uid`, it falls back to `SELECT * FROM users WHERE lower(email) = :verified_email`. If found, it populates `users.firebase_uid = :uid` (automatic account linking).
   - If no record exists, it raises `401 Unauthorized` ("Account not provisioned").
6. **Account State Enforcement:**
   - If `user.is_active` is `False`, it immediately raises `403 Forbidden` ("Account deactivated").
7. **Role-Based Access Control (RBAC):**
   - Endpoints depend on `require_role(UserRole.STUDENT)`, `require_role(UserRole.MENTOR)`, or `require_role(UserRole.HOD)`.
   - The user's role is checked exclusively against the PostgreSQL `users.role` column. Firebase custom claims or client-side assertions are never used for authorization.

### 6.2 Ten-Point Migration Plan

```text
Current State                              Target State
[Next.js Client]                           [Next.js Client]
       | (Credentials)                            | (Credentials)
       v                                          v
[FastAPI /login]                           [Firebase Authentication]
       | (Verify Argon2id)                        | (Issue ID Token)
       v                                          v
[Custom JWT Generated]                     [FastAPI with Firebase Admin SDK]
       |                                          | (Verify Token & Read PG Role)
       v                                          v
[PostgreSQL users table]                   [PostgreSQL users table (with firebase_uid)]
```

#### 1. Inspection of Existing Components
The current implementation relies on:
- `backend/app/services/auth_service.py`: `authenticate_user()` performs Argon2id verification.
- `backend/app/core/security.py`: `get_password_hash()`, `verify_password()`, `create_access_token()`, `decode_access_token()`.
- `backend/app/core/permissions.py`: `http_bearer`, `get_current_user()`, `require_role()`.
- `backend/app/api/v1/endpoints/auth.py`: `POST /login`, `GET /me`, `POST /logout`.
- `backend/tests/test_auth.py`: 11 tests verifying Argon2id hashing, JWT encoding, and RBAC isolation.

#### 2. Firebase UID Mapping
- Add `firebase_uid VARCHAR(128) UNIQUE NULL` with index via a new Alembic migration:
  ```python
  op.add_column('users', sa.Column('firebase_uid', sa.String(128), nullable=True))
  op.create_index(op.f('ix_users_firebase_uid'), 'users', ['firebase_uid'], unique=True)
  ```
- Lookup logic:
  ```python
  user = db.scalar(select(User).where(User.firebase_uid == uid))
  if not user:
      user = db.scalar(select(User).where(func.lower(User.email) == email.lower()))
      if user:
          user.firebase_uid = uid
          db.commit()
  ```

#### 3. Account Provisioning & Controlled Onboarding
- **No Open Signup:** Public self-registration is disabled in Firebase Console.
- **Roster Ingestion:** 61 students and 3 mentors are provisioned into PostgreSQL via `bootstrap_roster.py`.
- **Firebase User Creation:** An administrative provisioning script creates corresponding Firebase Auth accounts using the Firebase Admin SDK (`auth.create_user(email=..., password=temp_pw)` or sends password-reset invitations).
- Unrecognized users attempting to authenticate are rejected by FastAPI with HTTP 401 ("Account not provisioned for CCE Achieve").

#### 4. Role Enforcement
- Roles (`student`, `mentor`, `hod`) exist only in PostgreSQL.
- Even if an attacker tampers with frontend code or creates arbitrary Firebase accounts, they cannot access any protected endpoint without an authorized, active PostgreSQL record.

#### 5. Login, Logout, Password Reset, and Deactivation
- **Login:** Handled via `signInWithEmailAndPassword` or Google OAuth on Next.js.
- **Logout:** Client calls `signOut(auth)`. The frontend deletes the cached token.
- **Password Reset:** Client calls `sendPasswordResetEmail(auth, email)`. Firebase securely dispatches reset emails directly to student/faculty inboxes.
- **Deactivation:** When an admin sets `User.is_active = False` in PostgreSQL, subsequent requests immediately fail with `403 Forbidden`, regardless of Firebase token validity.

#### 6. Token Verification & Expiration Handling
- Firebase ID tokens expire in 60 minutes.
- The Firebase Client SDK automatically handles background token refresh.
- FastAPI uses `auth.verify_id_token(token, check_revoked=True)` to ensure revoked tokens (e.g., after password change or logout) are rejected.
- Invalid or expired tokens return `401 Unauthorized` with `WWW-Authenticate: Bearer error="invalid_token"`.

#### 7. CORS, Environment, and Secret Management
- Frontend origin (e.g. `https://cce-achieve.vercel.app`, `http://localhost:3000`) is configured in backend `BACKEND_CORS_ORIGINS`.
- Firebase Admin SDK credentials (`FIREBASE_SERVICE_ACCOUNT_FILE` or `FIREBASE_SERVICE_ACCOUNT_JSON`) remain strictly server-side.
- Client variables (`NEXT_PUBLIC_FIREBASE_*`) expose only non-sensitive project identifiers.

#### 8. Existing Test Suite Updates
- `backend/tests/test_auth.py` will be updated:
  - Mock `firebase_admin.auth.verify_id_token` in pytest fixtures.
  - Test token decoding, missing tokens, expired tokens, and unmapped users using the mocked Admin SDK.

#### 9. New Unit and Integration Tests Required
- `test_firebase_valid_token_maps_to_user`
- `test_firebase_unmapped_uid_returns_401`
- `test_firebase_inactive_user_returns_403`
- `test_firebase_expired_token_returns_401`
- `test_firebase_revoked_token_returns_401`
- `test_firebase_auto_link_on_first_login`
- `test_student_cannot_access_mentor_endpoints_with_valid_firebase_token`
- `test_missing_firebase_admin_credentials_safe_error`

#### 10. Rollback & Migration Risks
- **Hash Incompatibility:** Argon2id hashes cannot be exported directly into Firebase Auth without custom hash configuration. Therefore, users will onboard into Firebase via an initial temporary password or an automated password-reset invitation.
- **Dual-System Transition:** During the rollout, `password_hash` remains in PostgreSQL. The backend authentication dependency can support a transitional toggle (`AUTH_PROVIDER="firebase"` vs `"local"`) if a temporary rollback is required.
- **Final End State:** Once verified, local password hashing is retired, leaving Firebase Auth + FastAPI server-side RBAC as the sole authentication pipeline.

---

## 7. API Design (Auth & Core Endpoints)

Base path: `/api/v1`. All protected endpoints require `Authorization: Bearer <Firebase_ID_Token>`.

### 7.1 Authentication Endpoints
- `GET /api/v1/auth/me`: Validates the Firebase ID token and returns the caller's profile and PostgreSQL role.
  - **Headers:** `Authorization: Bearer <Firebase_ID_Token>`
  - **Response (200):**
    ```json
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "full_name": "Student Name",
      "email": "student@sairamtap.edu.in",
      "role": "student",
      "is_active": true
    }
    ```
  - **Errors:** 401 Unauthorized (missing/invalid token, unmapped user), 403 Forbidden (deactivated account).
- `POST /api/v1/auth/logout`: Informs backend of logout for audit logging. (Session revocation handled via Firebase).
- *(Legacy `POST /api/v1/auth/login` will be deprecated following Firebase cutover).*

### 7.2 Student Endpoints
- `GET /api/v1/students/me`: Returns profile and active mentor details.
- `GET /api/v1/students/me/achievements`: Lists student's own achievements.
- `POST /api/v1/achievements`: Creates a draft achievement.
- `PATCH /api/v1/achievements/{id}`: Edits a draft achievement.
- `POST /api/v1/achievements/{id}/submit`: Transitions status to `pending`.
- `POST /api/v1/achievements/{id}/files`: Uploads evidence binary (proxied to Google Drive).
- `GET /api/v1/files/{id}/content`: Streams evidence binary after checking ownership.

### 7.3 Mentor Endpoints
- `GET /api/v1/mentor/students`: Lists mentees actively assigned to current mentor.
- `GET /api/v1/mentor/submissions?status=pending`: Review queue for assigned mentees.
- `POST /api/v1/mentor/achievements/{id}/approve`: Approves submission.
- `POST /api/v1/mentor/achievements/{id}/reject`: Rejects submission (requires `remarks`).
- `POST /api/v1/mentor/achievements/{id}/request-changes`: Requests corrections.

### 7.4 HOD Endpoints
- `GET /api/v1/hod/dashboard`: Department-wide statistics and metrics.
- `GET /api/v1/hod/students`: Search cohort students.
- `GET /api/v1/hod/students/{id}/portfolio`: Full student portfolio view.
- `POST /api/v1/hod/mentor-assignments`: Assigns or reassigns students to mentors.
- `GET /api/v1/hod/audit-logs`: Audit trail viewer.
- `POST /api/v1/hod/qr/resolve`: Resolves scanned opaque QR token to student portfolio.

---

## 8. Google Drive Evidence Storage

All certificate, photograph, and document binaries reside exclusively in Google Drive. PostgreSQL stores metadata only.

### 8.1 Folder Hierarchy (Opaque IDs)
```text
CCE_PGPA/                                 <-- Shared Root Folder (GOOGLE_DRIVE_FOLDER_ID)
  ├── <student-user-uuid>/                <-- Opaque Student Folder
  │     └── <component-slug>/             <-- e.g., online-certifications
  │           └── <achievement-uuid>/     <-- Opaque Achievement Folder
  │                 └── <file-uuid>.<ext> <-- Uploaded binary
```

### 8.2 Operational Constraints
1. **Private by Default:** Files are never made public (`anyoneWithLink`).
2. **Proxied Streaming:** Frontend requests file content via `GET /api/v1/files/{id}/content`. FastAPI checks permissions and streams the file using `MediaIoBaseDownload`.
3. **Atomic Rollback:** If Google Drive upload succeeds but the database record fails to commit, the uploaded Drive file is immediately deleted to prevent orphaned storage leaks.
4. **Implementation Status:** Google Drive integration logic is implemented in `drive_service.py` and `file_manager.py` with 14 passing automated tests; live service account credentials verification in production remains pending.

---

## 9. QR Code Portfolio Access

- Generates an opaque, unguessable token associated with the student.
- The QR code contains an application URL (e.g. `https://cce-achieve.vercel.app/portfolio/verify?token=<opaque_token>`).
- Resolving the portfolio requires an authenticated session with HOD privileges.
- Scanning a QR code never bypasses authentication or server-side authorization.

---

## 10. Environment Configuration

### Backend (`backend/.env.example`)
```dotenv
# Application Settings
APP_NAME="CCE Achieve API"
APP_ENV="development"
DEBUG=True
API_V1_PREFIX="/api/v1"

# Database Configuration (PostgreSQL 18)
DATABASE_URL="postgresql+psycopg://cce_app_user:YOUR_PASSWORD@localhost:5432/cce_achieve"

# CORS Configuration (Vercel frontend and local development)
BACKEND_CORS_ORIGINS="http://localhost:3000,http://127.0.0.1:3000,https://cce-achieve.vercel.app"

# Firebase Admin SDK Configuration (Planned)
# Option A: Path to service account JSON key file
FIREBASE_SERVICE_ACCOUNT_FILE=""
# Option B: Raw JSON string for containerized / hosted environments
# FIREBASE_SERVICE_ACCOUNT_JSON=""
FIREBASE_PROJECT_ID=""

# Legacy JWT Authentication (Retained during migration phase)
JWT_SECRET_KEY="replace-with-a-random-secret-key-at-least-32-chars-long"
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Google Drive Storage Configuration (Evidence Binaries)
GOOGLE_DRIVE_FOLDER_ID=""
GOOGLE_SERVICE_ACCOUNT_FILE=""
# GOOGLE_SERVICE_ACCOUNT_JSON=""
MAX_UPLOAD_SIZE_MB=10
```

### Frontend (`frontend/.env.example`)
```dotenv
# API Base URL
NEXT_PUBLIC_API_BASE_URL="http://localhost:8000/api/v1"

# Firebase Client Configuration (Public identifiers only — no private keys)
NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSy..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="cce-achieve.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="cce-achieve"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="cce-achieve.appspot.com"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="1234567890"
NEXT_PUBLIC_FIREBASE_APP_ID="1:1234567890:web:abcdef"
```

> [!CAUTION]
> Never place Firebase service account private keys or Google Drive credentials in `frontend/.env` or any `NEXT_PUBLIC_*` variables.

---

## 11. Security Checklist

- [x] Dedicated least-privilege PostgreSQL role (`cce_app_user`).
- [x] Zero binary data stored in PostgreSQL (metadata only).
- [x] Google Drive credentials excluded from version control via `.gitignore`.
- [ ] Firebase Admin SDK private key protected server-side; never exposed to browser.
- [ ] Strict server-side RBAC: PostgreSQL is the single authority for roles.
- [ ] Closed cohort: public self-registration disabled in Firebase Auth.
- [ ] Rate-limited authentication and API endpoints.
- [ ] Token expiration and revocation verification (`check_revoked=True`).
- [ ] All production traffic over HTTPS with strict CORS allowlist.
- [ ] Immutable audit logging for all review and administrative actions.
- [ ] No passwords, private keys, or tokens in application log output.

---

## 12. Testing Plan

### Automated Test Strategy
The test suite utilizes `pytest` and `fastapi.testclient.TestClient`. Current status: **50 tests passing**.

1. **Unit & Security Tests:**
   - Model relationships, cascading deletes, and foreign keys (`test_models.py`).
   - Excel roster validation and extraction (`test_prepare_students_roster.py`).
   - Roster bootstrap CLI and `--allow-missing-hod` mode (`test_roster_bootstrap.py`).
   - Google Drive isolation, path sanitization, and MIME validation (`test_drive_integration.py`).
2. **Planned Firebase Tests:**
   - Mock Firebase Admin SDK `verify_id_token` for test suites.
   - Test successful user resolution via `firebase_uid`.
   - Test fallback linking via normalized email on first login.
   - Test rejection of unmapped UIDs (`401 Unauthorized`).
   - Test rejection of deactivated accounts (`403 Forbidden`).
   - Test cross-student and cross-mentor isolation under Firebase tokens.
3. **Live Verification Rule:**
   - Mocked tests validate business logic without network dependency.
   - Live production verification requires testing with real Firebase credentials and an active frontend session before marking complete.

---

## 13. Firebase Setup & Deployment Checklist

Follow this operational checklist during the implementation phase:

1. **Firebase Project Setup:**
   - Create Firebase project in the Google Cloud / Firebase Console (e.g. `cce-achieve`).
   - Register the Next.js web application.
2. **Sign-In Method Configuration:**
   - Enable **Email/Password** in Firebase Authentication.
   - *(Optional)* Enable **Google Sign-In** restricted to institutional domains (`@sairamtap.edu.in`, `@sairam.edu.in`).
3. **Authorized Domains:**
   - Add `localhost` for development.
   - Add production domain (e.g., `cce-achieve.vercel.app`).
4. **Frontend Configuration:**
   - Populate `frontend/.env.local` using values from Firebase Project Settings.
5. **Backend Admin Credentials:**
   - Generate a Firebase Admin SDK private key (Service Account JSON) in Firebase Console.
   - Store securely on the server; configure `FIREBASE_SERVICE_ACCOUNT_FILE` or `FIREBASE_SERVICE_ACCOUNT_JSON`.
6. **Database Migration:**
   - Run Alembic migration to add `firebase_uid` column to `users` table.
7. **Backend Code Implementation:**
   - Update `app/core/permissions.py` to verify Firebase ID tokens using Firebase Admin SDK.
   - Update `app/services/auth_service.py` to query and link `firebase_uid`.
8. **Cohort Account Provisioning:**
   - Import 61 students and 3 mentors via `bootstrap_roster.py`.
   - Provision matching accounts in Firebase Auth with initial password-reset links.
9. **Automated Testing:**
   - Run complete test suite with mocked Firebase Admin SDK; ensure 100% pass rate.
10. **Deployment:**
    - Deploy Next.js to Vercel with client environment variables.
    - Deploy FastAPI backend with database, Drive, and Firebase Admin environment variables.
11. **Verification:**
    - Perform end-to-end smoke test: student login, evidence upload, mentor review, and HOD QR scan.

---

## 14. Definition of Done (Firebase Auth Milestone)

- PRD and TRD documents fully updated and aligned.
- Alembic migration script for `firebase_uid` tested on local database.
- Backend verifies Firebase ID tokens and enforces PostgreSQL roles on every request.
- Uninvited users cannot access API endpoints.
- Password reset emails function via Firebase.
- Full automated test suite passes with Firebase verification mocked.
- Zero secrets committed to Git.
- Local setup and deployment steps are fully documented.
