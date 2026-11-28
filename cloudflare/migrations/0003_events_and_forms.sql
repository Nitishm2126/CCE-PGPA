-- ==============================================================================
-- CCE-PGPA Cloudflare D1 Migration: 0003_events_and_forms.sql
-- Module: CCE Events & Forms (Phase 1)
-- Description: Independent Event Management, Dynamic Form Builder, and Submissions
-- ==============================================================================

PRAGMA foreign_keys = ON;

-- 1. Events Master Table
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    short_description TEXT,
    detailed_description TEXT,
    category TEXT NOT NULL DEFAULT 'Workshop',
    poster_url TEXT,
    document_url TEXT,
    venue TEXT,
    mode TEXT NOT NULL DEFAULT 'Offline' CHECK (mode IN ('Offline', 'Online', 'Hybrid')),
    meeting_url TEXT,
    event_start_at TEXT NOT NULL,
    event_end_at TEXT NOT NULL,
    registration_start_at TEXT NOT NULL,
    registration_deadline TEXT NOT NULL,
    academic_year TEXT,
    semester_id TEXT REFERENCES semesters (id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed', 'archived')),
    allow_multiple_responses INTEGER NOT NULL DEFAULT 0,
    allow_edit_submission INTEGER NOT NULL DEFAULT 0,
    close_after_deadline INTEGER NOT NULL DEFAULT 1,
    is_registration_enabled INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
    updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);

CREATE INDEX IF NOT EXISTS ix_events_status ON events (status);
CREATE INDEX IF NOT EXISTS ix_events_dates ON events (registration_start_at, registration_deadline);
CREATE INDEX IF NOT EXISTS ix_events_created_by ON events (created_by);
CREATE INDEX IF NOT EXISTS ix_events_semester ON events (semester_id);

-- 2. Event Target Audience Configuration
CREATE TABLE IF NOT EXISTS event_audiences (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events (id) ON DELETE CASCADE,
    audience_type TEXT NOT NULL CHECK (audience_type IN ('all', 'specific_students', 'section', 'academic_year', 'custom')),
    audience_payload TEXT,
    created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);

CREATE INDEX IF NOT EXISTS ix_event_audiences_event ON event_audiences (event_id);

-- 3. Event Form Versions (Immutable Form Snapshots)
CREATE TABLE IF NOT EXISTS event_form_versions (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events (id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    created_by TEXT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
    published_at TEXT,
    UNIQUE (event_id, version_number)
);

CREATE INDEX IF NOT EXISTS ix_event_form_versions_event ON event_form_versions (event_id, version_number);

-- 4. Event Form Fields
CREATE TABLE IF NOT EXISTS event_form_fields (
    id TEXT PRIMARY KEY,
    form_version_id TEXT NOT NULL REFERENCES event_form_versions (id) ON DELETE CASCADE,
    field_key TEXT NOT NULL,
    field_type TEXT NOT NULL CHECK (field_type IN ('text', 'textarea', 'number', 'email', 'phone', 'dropdown', 'radio', 'checkbox', 'date', 'time', 'file', 'heading', 'info')),
    label TEXT NOT NULL,
    description TEXT,
    placeholder TEXT,
    required INTEGER NOT NULL DEFAULT 0,
    validation_config TEXT,
    options_config TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);

CREATE INDEX IF NOT EXISTS ix_event_form_fields_version ON event_form_fields (form_version_id, display_order);

-- 5. Student Event Submissions
CREATE TABLE IF NOT EXISTS event_submissions (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events (id) ON DELETE CASCADE,
    form_version_id TEXT NOT NULL REFERENCES event_form_versions (id) ON DELETE RESTRICT,
    student_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    submission_status TEXT NOT NULL DEFAULT 'submitted' CHECK (submission_status IN ('submitted', 'updated', 'resubmitted')),
    submitted_at TEXT NOT NULL DEFAULT (DATETIME('now')),
    updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);

CREATE INDEX IF NOT EXISTS ix_event_submissions_event_student ON event_submissions (event_id, student_id);
CREATE INDEX IF NOT EXISTS ix_event_submissions_student ON event_submissions (student_id);

-- 6. Event Submission Response Values
CREATE TABLE IF NOT EXISTS event_submission_values (
    id TEXT PRIMARY KEY,
    submission_id TEXT NOT NULL REFERENCES event_submissions (id) ON DELETE CASCADE,
    field_id TEXT NOT NULL REFERENCES event_form_fields (id) ON DELETE RESTRICT,
    field_key TEXT NOT NULL,
    value_json TEXT,
    created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);

CREATE INDEX IF NOT EXISTS ix_event_sub_values_sub ON event_submission_values (submission_id);

-- 7. Event Submission Uploaded Files
CREATE TABLE IF NOT EXISTS event_submission_files (
    id TEXT PRIMARY KEY,
    submission_id TEXT NOT NULL REFERENCES event_submissions (id) ON DELETE CASCADE,
    field_id TEXT REFERENCES event_form_fields (id) ON DELETE SET NULL,
    field_key TEXT NOT NULL,
    storage_reference TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    uploaded_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);

CREATE INDEX IF NOT EXISTS ix_event_sub_files_sub ON event_submission_files (submission_id);
