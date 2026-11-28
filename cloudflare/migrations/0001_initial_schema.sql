-- ==============================================================================
-- CCE-PGPA Cloudflare D1 Initial Relational Schema
-- Migration: 0001_initial_schema.sql
-- Compatible with SQLite 3.38+ and Cloudflare D1
-- Storage Mandate: Google Drive stores file binaries; D1 stores metadata only
-- ==============================================================================

PRAGMA foreign_keys = ON;

-- 1. Semesters Catalogue
CREATE TABLE IF NOT EXISTS semesters (
    id TEXT PRIMARY KEY,
    semester_number INTEGER UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
    updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);
CREATE INDEX IF NOT EXISTS ix_semesters_number ON semesters (semester_number);
CREATE INDEX IF NOT EXISTS ix_semesters_enabled ON semesters (is_enabled);

-- 2. Core Users Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    firebase_uid TEXT UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'student', 'mentor', 'hod')),
    is_active INTEGER NOT NULL DEFAULT 1,
    must_change_password INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
    updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);
CREATE INDEX IF NOT EXISTS ix_users_email ON users (email);
CREATE INDEX IF NOT EXISTS ix_users_role ON users (role);
CREATE INDEX IF NOT EXISTS ix_users_firebase_uid ON users (firebase_uid);

-- 3. Student Profiles Extension (2nd-Year CCE 61 Cohort)
CREATE TABLE IF NOT EXISTS student_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    register_number TEXT UNIQUE NOT NULL,
    department TEXT NOT NULL DEFAULT 'CCE',
    year INTEGER NOT NULL DEFAULT 2,
    section TEXT,
    semester TEXT,
    original_mentor_name TEXT,
    batch TEXT,
    phone_number TEXT,
    google_drive_folder_id TEXT,
    created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
    updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);
CREATE INDEX IF NOT EXISTS ix_student_profiles_register ON student_profiles (register_number);
CREATE INDEX IF NOT EXISTS ix_student_profiles_user ON student_profiles (user_id);

-- 4. Mentor Profiles Extension (3 Faculty Mentors)
CREATE TABLE IF NOT EXISTS mentor_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    staff_id TEXT UNIQUE,
    department TEXT NOT NULL DEFAULT 'CCE',
    designation TEXT,
    created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
    updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);
CREATE INDEX IF NOT EXISTS ix_mentor_profiles_user ON mentor_profiles (user_id);

-- 5. HOD Profile Extension
CREATE TABLE IF NOT EXISTS hod_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    staff_id TEXT UNIQUE,
    department TEXT NOT NULL DEFAULT 'CCE',
    designation TEXT DEFAULT 'Head of Department',
    created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
    updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);
CREATE INDEX IF NOT EXISTS ix_hod_profiles_user ON hod_profiles (user_id);

-- 6. Mentor Assignments (1-to-Many Student Allocation)
CREATE TABLE IF NOT EXISTS mentor_assignments (
    id TEXT PRIMARY KEY,
    mentor_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    assigned_by TEXT REFERENCES users (id) ON DELETE SET NULL,
    assigned_at TEXT NOT NULL DEFAULT (DATETIME('now')),
    ended_at TEXT,
    is_active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS ix_mentor_assignments_pair ON mentor_assignments (mentor_id, student_id);
CREATE INDEX IF NOT EXISTS ix_mentor_assignments_student_active ON mentor_assignments (student_id, is_active);
CREATE INDEX IF NOT EXISTS ix_mentor_assignments_mentor_active ON mentor_assignments (mentor_id, is_active);

-- 7. PGPA Components Catalogue (Master 14 Components)
CREATE TABLE IF NOT EXISTS pgpa_components (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    semester_label TEXT,
    academic_period TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    is_visible INTEGER NOT NULL DEFAULT 1,
    credit_value INTEGER NOT NULL DEFAULT 3,
    submission_mode TEXT NOT NULL DEFAULT 'both',
    grading_strategy TEXT NOT NULL DEFAULT 'categorical',
    requires_verification INTEGER NOT NULL DEFAULT 1,
    pdf_requirement TEXT NOT NULL DEFAULT 'optional',
    allow_other_evidence_types INTEGER NOT NULL DEFAULT 0,
    config_schema TEXT,
    rule_version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
    updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);
CREATE INDEX IF NOT EXISTS ix_pgpa_components_slug ON pgpa_components (slug);
CREATE INDEX IF NOT EXISTS ix_pgpa_components_active ON pgpa_components (is_active);

-- 8. Component Semester Availability Matrix (14 x 8)
CREATE TABLE IF NOT EXISTS component_semester_configs (
    id TEXT PRIMARY KEY,
    component_id TEXT NOT NULL REFERENCES pgpa_components (id) ON DELETE CASCADE,
    semester_id TEXT NOT NULL REFERENCES semesters (id) ON DELETE CASCADE,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    submission_deadline TEXT,
    created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
    updated_at TEXT NOT NULL DEFAULT (DATETIME('now')),
    UNIQUE (component_id, semester_id)
);
CREATE INDEX IF NOT EXISTS ix_comp_sem_config ON component_semester_configs (component_id, semester_id);

-- 9. Student Achievements Submissions
CREATE TABLE IF NOT EXISTS achievements (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    component_id TEXT NOT NULL REFERENCES pgpa_components (id) ON DELETE RESTRICT,
    semester_id TEXT REFERENCES semesters (id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    activity_type TEXT,
    organizer TEXT,
    event_date TEXT,
    description TEXT,
    outcome TEXT,
    certificate_status TEXT DEFAULT 'uploaded',
    remarks TEXT,
    component_metadata TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'under_review', 'approved', 'rejected')),
    submitted_at TEXT,
    created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
    updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);
CREATE INDEX IF NOT EXISTS ix_achievements_student ON achievements (student_id);
CREATE INDEX IF NOT EXISTS ix_achievements_component ON achievements (component_id);
CREATE INDEX IF NOT EXISTS ix_achievements_status ON achievements (status);

-- 10. Achievement Files Metadata (Google Drive Storage References)
CREATE TABLE IF NOT EXISTS achievement_files (
    id TEXT PRIMARY KEY,
    achievement_id TEXT NOT NULL REFERENCES achievements (id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'google_drive',
    drive_file_id TEXT NOT NULL,
    drive_folder_id TEXT,
    original_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    file_category TEXT NOT NULL CHECK (file_category IN ('certificate', 'photo', 'supporting_document')),
    uploaded_by TEXT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);
CREATE INDEX IF NOT EXISTS ix_achievement_files_achievement ON achievement_files (achievement_id);
CREATE INDEX IF NOT EXISTS ix_achievement_files_provider_key ON achievement_files (provider, drive_file_id);

-- 11. Verification Logs (Immutable Review History)
CREATE TABLE IF NOT EXISTS verification_logs (
    id TEXT PRIMARY KEY,
    achievement_id TEXT NOT NULL REFERENCES achievements (id) ON DELETE CASCADE,
    reviewer_id TEXT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    action TEXT NOT NULL CHECK (action IN ('approved', 'rejected', 'requested_changes', 'under_review', 'revert')),
    remarks TEXT,
    created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);
CREATE INDEX IF NOT EXISTS ix_verification_logs_achievement ON verification_logs (achievement_id);
CREATE INDEX IF NOT EXISTS ix_verification_logs_reviewer ON verification_logs (reviewer_id);

-- 12. Student Component Results (Final Official Component Grades)
CREATE TABLE IF NOT EXISTS student_component_results (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    component_id TEXT NOT NULL REFERENCES pgpa_components (id) ON DELETE RESTRICT,
    semester_id TEXT NOT NULL REFERENCES semesters (id) ON DELETE RESTRICT,
    raw_score REAL,
    category TEXT,
    grade TEXT,
    grade_points REAL,
    credit_value INTEGER NOT NULL DEFAULT 3,
    is_verified INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'student_submission',
    import_batch_id TEXT,
    achievement_id TEXT,
    created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
    updated_at TEXT NOT NULL DEFAULT (DATETIME('now')),
    UNIQUE (student_id, component_id, semester_id)
);
CREATE INDEX IF NOT EXISTS ix_comp_results_student ON student_component_results (student_id);
CREATE INDEX IF NOT EXISTS ix_comp_results_semester ON student_component_results (semester_id);

-- 13. Student Semester PGPA Records
CREATE TABLE IF NOT EXISTS student_semester_pgpa (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    semester_id TEXT NOT NULL REFERENCES semesters (id) ON DELETE RESTRICT,
    a1_score REAL,
    gpa REAL,
    pgpa REAL,
    total_credits_attempted INTEGER NOT NULL DEFAULT 0,
    total_credits_earned INTEGER NOT NULL DEFAULT 0,
    calculated_at TEXT NOT NULL DEFAULT (DATETIME('now')),
    updated_at TEXT NOT NULL DEFAULT (DATETIME('now')),
    UNIQUE (student_id, semester_id)
);
CREATE INDEX IF NOT EXISTS ix_semester_pgpa_student ON student_semester_pgpa (student_id);

-- 14. Manual Mentor Point Awards
CREATE TABLE IF NOT EXISTS manual_component_points (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    mentor_id TEXT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    component_id TEXT NOT NULL REFERENCES pgpa_components (id) ON DELETE RESTRICT,
    semester_id TEXT NOT NULL REFERENCES semesters (id) ON DELETE RESTRICT,
    points REAL NOT NULL,
    remarks TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
    updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);

-- 15. In-App Communications & Remarks
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    recipient_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    message_body TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'General Message',
    related_achievement_id TEXT REFERENCES achievements (id) ON DELETE SET NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    read_at TEXT,
    created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);
CREATE INDEX IF NOT EXISTS ix_messages_recipient ON messages (recipient_id);

-- 16. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor_id TEXT REFERENCES users (id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    action_metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);
CREATE INDEX IF NOT EXISTS ix_audit_logs_actor ON audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS ix_audit_logs_action ON audit_logs (action);

-- 17. HOD Import Provenance Batches
CREATE TABLE IF NOT EXISTS hod_import_batches (
    id TEXT PRIMARY KEY,
    uploaded_by TEXT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    component_id TEXT NOT NULL REFERENCES pgpa_components (id) ON DELETE RESTRICT,
    semester_id TEXT NOT NULL REFERENCES semesters (id) ON DELETE RESTRICT,
    academic_cohort TEXT NOT NULL,
    source_filename TEXT NOT NULL,
    total_rows INTEGER NOT NULL DEFAULT 0,
    valid_rows INTEGER NOT NULL DEFAULT 0,
    error_rows INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'preview',
    errors_summary TEXT,
    created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
    updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);

-- 18. OAuth Credentials Storage (Google Drive OAuth 2.0 Tokens)
CREATE TABLE IF NOT EXISTS oauth_credentials (
    id TEXT PRIMARY KEY,
    provider TEXT UNIQUE NOT NULL,
    client_id TEXT NOT NULL,
    encrypted_refresh_token TEXT NOT NULL,
    scopes TEXT,
    authorized_by TEXT REFERENCES users (id) ON DELETE SET NULL,
    authorized_email TEXT,
    created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
    updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);
CREATE INDEX IF NOT EXISTS ix_oauth_credentials_provider ON oauth_credentials (provider);

-- 19. Student Semester Google Drive Folder Mappings
CREATE TABLE IF NOT EXISTS student_semester_folders (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    semester_id TEXT NOT NULL REFERENCES semesters (id) ON DELETE CASCADE,
    drive_folder_id TEXT NOT NULL,
    drive_folder_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
    updated_at TEXT NOT NULL DEFAULT (DATETIME('now')),
    UNIQUE (student_id, semester_id)
);
CREATE INDEX IF NOT EXISTS ix_student_semester_folders_student ON student_semester_folders (student_id);
CREATE INDEX IF NOT EXISTS ix_student_semester_folders_drive_folder ON student_semester_folders (drive_folder_id);
