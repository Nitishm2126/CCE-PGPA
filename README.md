# CCE Achieve — PGPA Student Achievement Management System

> **Phase 1 Backend Baseline:** FastAPI + PostgreSQL 18 + SQLAlchemy 2.x + Alembic + Pydantic Settings

CCE Achieve is a role-based system designed for managing and verifying student achievements under official PGPA components for the Sri Sairam Engineering College CCE department.

---

## ⚠️ Architectural Storage Mandate

> [!IMPORTANT]
> **File Storage Rule:**
> The application must **never** store certificate, photo, or document file binaries in PostgreSQL bytea/BLOB columns.
> - **Google Drive:** All uploaded certificate, photograph, PDF, and supporting document binaries reside securely in Google Drive.
> - **PostgreSQL:** Stores **structured data and file metadata only** (e.g., `drive_file_id`, filename, MIME type, size, upload timestamp, ownership, and verification status).
> - **Application Server:** Temporary memory/streaming processing only; no permanent local disk storage.

---

## Workspace Structure

```text
pgpa web-app/
├── backend/
│   ├── alembic/              # Database migration environment
│   │   ├── env.py            # Reads DATABASE_URL dynamically from app settings
│   │   ├── script.py.mako    # Migration template
│   │   └── versions/         # Migration versions directory
│   ├── alembic.ini           # Alembic CLI configuration
│   ├── app/
│   │   ├── api/              # API router and versioned endpoints
│   │   │   └── v1/
│   │   │       ├── endpoints/
│   │   │       │   └── health.py # GET /api/v1/health with DB connectivity check
│   │   │       └── router.py # v1 router aggregation
│   │   ├── core/
│   │   │   └── config.py     # Pydantic Settings reading backend/.env
│   │   ├── db/
│   │   │   ├── base.py       # SQLAlchemy 2.x DeclarativeBase
│   │   │   └── session.py    # Engine, SessionLocal, get_db, check_db_connection
│   │   ├── models/           # SQLAlchemy models (reserved for Phase 2 schema)
│   │   ├── schemas/          # Pydantic validation schemas
│   │   │   └── health.py
│   │   └── main.py           # FastAPI application entrypoint with GET /
│   ├── tests/
│   │   ├── conftest.py       # TestClient fixture
│   │   └── test_health.py    # Automated test suite
│   ├── requirements.txt      # Pinned Python dependencies
│   └── .env.example          # Safe environment template
├── .gitignore                # Excludes secrets, .env, .venv, caches
├── PRD.md                    # Product Requirements Document
├── TRD.md                    # Technical Requirements Document
└── README.md                 # Setup and run instructions
```

---

## 1. Local PostgreSQL 18 Database Setup (pgAdmin 4)

### Rule: Dedicated Least-Privilege Role
> [!CAUTION]
> **Do NOT use the `postgres` superuser as the application account.**
> Connecting the web application as superuser violates the principle of least privilege and introduces severe security risks.
> Do **NOT** modify or reuse any unrelated databases (e.g., `fastship` or `finestock`).

### Step-by-Step Instructions:
1. Open **pgAdmin 4** on your machine and connect to your local PostgreSQL 18 server.
2. Open the **Query Tool** on your PostgreSQL server connection.
3. Run the following SQL statements to create the `cce_achieve` database and a dedicated application user:

```sql
-- 1. Create the dedicated database
CREATE DATABASE cce_achieve;

-- 2. Create the dedicated least-privilege application role
-- Replace 'YOUR_CHOSEN_PASSWORD' with your preferred secure password.
CREATE ROLE cce_app_user WITH LOGIN PASSWORD 'YOUR_CHOSEN_PASSWORD';

-- 3. Grant database connection rights
GRANT CONNECT ON DATABASE cce_achieve TO cce_app_user;
```

4. In pgAdmin 4, switch the Query Tool connection to the newly created `cce_achieve` database (or run `\c cce_achieve` in psql) and execute:

```sql
-- 4. Grant schema usage and creation rights in the cce_achieve database
GRANT USAGE, CREATE ON SCHEMA public TO cce_app_user;

-- 5. Grant default privileges so future tables created by migrations are accessible
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO cce_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO cce_app_user;
```

---

## 2. Windows PowerShell Setup Guide

Follow these exact commands in a Windows PowerShell terminal.

### Step 1: Open Terminal and Navigate to Project
```powershell
cd "e:\Projects\pgpa web-app"
```

### Step 2: Create Python Virtual Environment
Use the Python 3.12 launcher:
```powershell
py -3.12 -m venv .venv
```
*(If `py` is not recognized, use `python -m venv .venv`)*

### Step 3: Activate the Virtual Environment
If script execution is blocked on Windows PowerShell, first run:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
```
Then activate the environment:
```powershell
.\.venv\Scripts\Activate.ps1
```
Your PowerShell prompt will now display `(.venv)`.

### Step 4: Install Dependencies
```powershell
pip install --upgrade pip
pip install -r backend\requirements.txt
```

### Step 5: Configure Environment (`backend/.env`)
Copy the sample `.env.example` to create your local `.env`:
```powershell
Copy-Item backend\.env.example backend\.env
```

Open `backend\.env` in your editor and configure your local PostgreSQL connection string. Replace `YOUR_LOCAL_DB_PASSWORD` with the actual password you assigned to `cce_app_user`:
```dotenv
DATABASE_URL="postgresql+psycopg://cce_app_user:YOUR_LOCAL_DB_PASSWORD@localhost:5432/cce_achieve"
```
*(Note: Never commit `backend/.env` to Git. It is already excluded in `.gitignore`.)*

---

## 3. Running the Backend Server

Navigate into the `backend` directory and start the Uvicorn development server:

```powershell
cd backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The server will start at `http://127.0.0.1:8000`.

---

## 4. Testing Endpoints & Database Connectivity

### Testing from PowerShell
In a separate PowerShell window (or terminal tab):

#### 1. Test Root Service Endpoint (`GET /`):
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/" -Method Get | ConvertTo-Json -Depth 5
```
Expected response:
```json
{
  "app_name": "CCE Achieve API",
  "environment": "development",
  "version": "1.0.0",
  "status": "online",
  "docs_url": "/docs",
  "health_url": "/api/v1/health",
  "storage_architecture_mandate": "All certificate and photo file binaries reside in Google Drive. PostgreSQL stores structured records and file metadata only."
}
```

#### 2. Test Health & Database Connectivity Endpoint (`GET /api/v1/health`):
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/health" -Method Get | ConvertTo-Json -Depth 5
```
- **If the database is configured and running:**
  ```json
  {
    "status": "healthy",
    "app_name": "CCE Achieve API",
    "environment": "development",
    "timestamp": "2026-10-14T...",
    "database": {
      "connected": true,
      "status": "connected",
      "database": "cce_achieve",
      "host": "localhost",
      "message": "Database connection verified successfully.",
      "detail": null
    },
    "storage_rule": "All uploaded certificate and photo file binaries reside in Google Drive; PostgreSQL stores structured records and file metadata only."
  }
  ```
- **If the database has not been created or credentials are unconfigured:**
  ```json
  {
    "status": "healthy",
    "database": {
      "connected": false,
      "status": "unverified",
      "message": "Database connection not verified. Ensure PostgreSQL 18 is running..."
    }
  }
  ```
  *(The system never falsely claims connectivity is verified until a real `SELECT 1` query succeeds).*

---

## 5. Running Automated Tests

Run the test suite from the `backend/` directory:

```powershell
cd backend
pytest -v
```

All health and root endpoint checks will run against the FastAPI application.

---

## 6. Alembic Database Migrations & Phase 2 Schema

Alembic automatically reads `DATABASE_URL` from `app.core.config.settings.DATABASE_URL`.

### Database Schema Objects (Phase 2):
- **`users`**: User identity, role (`student`, `mentor`, `hod`), active status, timestamps.
- **`student_profiles`**: 1-to-1 profile for cohort students (unique `register_number`, department, year, section).
- **`mentor_profiles`**: 1-to-1 profile for faculty mentors (`staff_id`, department, designation).
- **`mentor_assignments`**: Explicit student-to-mentor mappings (`mentor_id`, `student_id`, `is_active`).
- **`pgpa_components`**: Official component catalogue with 13 verified baseline components.
- **`achievements`**: Student activity submissions under PGPA components (`draft`, `pending`, `approved`, `rejected`).
- **`achievement_files`**: Google Drive metadata only (`drive_file_id`, filename, MIME type, size). **Binaries are NEVER stored in PostgreSQL**.
- **`verification_logs`**: Append-only mentor review history (`approved`, `rejected`, `requested_changes`, remarks).
- **`audit_logs`**: Immutable audit records for sensitive actions and state changes.

### Running Migrations:
```powershell
# From the backend directory:
# Check current migration status
alembic current

# Apply migrations
alembic upgrade head

# Rollback migration if necessary (transaction-safe)
alembic downgrade -1
# or revert all migrations:
alembic downgrade base
```

---

---

## 7. Phase 3: Authentication & Role-Based Access Control (RBAC)

The backend implements Argon2id password hashing, signed JWT Bearer access tokens, and strict role authorization.

### Key Roles & Permissions:
- **`student`**: Isolated to own profile (`GET /api/v1/students/me`) and own achievement drafts. Cannot view or edit other students' records.
- **`mentor`**: Can query only students assigned via active `mentor_assignments` (`GET /api/v1/mentor/students`). Cannot inspect students assigned to other mentors.
- **`hod`**: Can access cohort-wide student directory (`GET /api/v1/hod/students`) and review department summaries.

### API Usage Examples (PowerShell)

#### 1. User Login (`POST /api/v1/auth/login`)
```powershell
$loginBody = @{
    email = "student@sairam.edu.in"
    password = "YourPassword123!"
} | ConvertTo-Json

$authResponse = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/auth/login" `
    -Method Post `
    -ContentType "application/json" `
    -Body $loginBody

$token = $authResponse.access_token
Write-Host "Obtained JWT token for role:" $authResponse.role
```

#### 2. Get Authenticated User Identity (`GET /api/v1/auth/me`)
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/auth/me" `
    -Method Get `
    -Headers @{ Authorization = "Bearer $token" } | ConvertTo-Json
```

#### 3. Student Self-Profile (`GET /api/v1/students/me`)
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/students/me" `
    -Method Get `
    -Headers @{ Authorization = "Bearer $token" } | ConvertTo-Json
```

#### 4. Mentor Assigned Students (`GET /api/v1/mentor/students`)
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/mentor/students" `
    -Method Get `
    -Headers @{ Authorization = "Bearer $token" } | ConvertTo-Json
```

#### 5. HOD Department Student Directory (`GET /api/v1/hod/students`)
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/hod/students" `
    -Method Get `
    -Headers @{ Authorization = "Bearer $token" } | ConvertTo-Json
```

#### 6. Logout / Client Token Invalidation Guidance (`POST /api/v1/auth/logout`)
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/auth/logout" `
    -Method Post `
    -Headers @{ Authorization = "Bearer $token" } | ConvertTo-Json
```

---

## 9. Phase 4: Cohort Roster Import & Provisioning CLI

Phase 4 introduces transactional onboarding and roster validation for the 2nd-year CCE cohort (exactly 61 students, 3 faculty mentors, and 1 HOD).

### CSV Templates
Pre-formatted CSV templates with headers and instructions are provided in `backend/data/templates/`:
- **`backend/data/templates/students_roster_template.csv`**:
  Columns: `register_number,full_name,email,section,mentor_reference` (requires exactly 61 rows; `mentor_reference` matches staff mentor email or staff ID).
- **`backend/data/templates/staff_roster_template.csv`**:
  Columns: `role,full_name,email,staff_id,department,designation` (requires exactly 4 rows: 1 `hod` and 3 `mentor` records).

### CLI Script (`backend/app/cli/bootstrap_roster.py`)

#### 1. Dry-Run Verification (Safe, Non-Destructive):
Validates count constraints, duplicate emails/register numbers, format validity, and mentor reference resolution without touching the database:
```powershell
cd backend
python -m app.cli.bootstrap_roster `
    --students-file data/templates/students_roster_template.csv `
    --staff-file data/templates/staff_roster_template.csv `
    --dry-run
```

#### 2. Transactional Production Import:
Creates all User accounts, StudentProfiles, MentorProfiles, and active MentorAssignments atomically:
```powershell
cd backend
python -m app.cli.bootstrap_roster `
    --students-file path/to/authorized_students.csv `
    --staff-file path/to/authorized_staff.csv `
    --output-credentials credentials_distribution_report.csv
```

### Security & Privacy Rules:
- **No Invented Identities**: The CLI strictly requires authorized CSV data. Production user accounts are not created until real, authorized rosters are provided.
- **Secure Password Hashing**: All accounts are initialized with high-entropy temporary passwords hashed with **Argon2id**.
- **No Console Password Leaks**: Passwords and secret hashes are **never printed** to the terminal or logged.
- **Secure Credential Distribution**: The initial credentials CSV report is generated at `--output-credentials` and is ignored by Git (`.gitignore`). It should be distributed securely through official administrative channels and deleted or archived offsite.

---

## 10. Interactive API Documentation

Once the server is running, open your browser:
- **Swagger Interactive UI:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc Documentation:** [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

