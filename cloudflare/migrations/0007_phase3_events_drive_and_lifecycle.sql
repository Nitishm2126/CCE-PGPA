-- ==============================================================================
-- CCE-PGPA Cloudflare D1 Migration: 0007_phase3_events_drive_and_lifecycle.sql
-- Module: CCE Events & Forms (Phase 3 - Google Drive Integration & Lifecycle)
-- Description:
--   - Adds idempotency_key and notification_cta_label to events
--   - Extends event_submission_files with Google Drive metadata references
--   - Adds event_files metadata table for Event Media & Student Uploads
--   - Preserves all existing PGPA tables, 61 student profiles, and submissions
-- ==============================================================================

PRAGMA foreign_keys = OFF;

-- 1. Extend events table cleanly
ALTER TABLE events ADD COLUMN notification_cta_label TEXT DEFAULT 'Register Now';
ALTER TABLE events ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS ix_events_idempotency
    ON events (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- 2. Extend event_submission_files with explicit Drive & ownership columns
ALTER TABLE event_submission_files ADD COLUMN drive_file_id TEXT;
ALTER TABLE event_submission_files ADD COLUMN drive_folder_id TEXT;
ALTER TABLE event_submission_files ADD COLUMN student_id TEXT REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE event_submission_files ADD COLUMN event_id TEXT REFERENCES events (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS ix_event_sub_files_student ON event_submission_files (student_id, event_id);
CREATE INDEX IF NOT EXISTS ix_event_sub_files_drive ON event_submission_files (drive_file_id);

-- 3. Event Files Metadata Registry (Stores Drive IDs and ownership, never file binaries in D1)
CREATE TABLE IF NOT EXISTS event_files (
    id TEXT PRIMARY KEY,
    student_id TEXT REFERENCES users (id) ON DELETE CASCADE,
    event_id TEXT REFERENCES events (id) ON DELETE SET NULL,
    submission_id TEXT REFERENCES event_submissions (id) ON DELETE CASCADE,
    field_key TEXT,
    provider TEXT NOT NULL DEFAULT 'google_drive',
    drive_file_id TEXT NOT NULL,
    drive_folder_id TEXT,
    original_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_scope TEXT NOT NULL DEFAULT 'student_submission' CHECK (file_scope IN ('event_media', 'notification_media', 'student_submission')),
    uploaded_by TEXT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);

CREATE INDEX IF NOT EXISTS ix_event_files_drive ON event_files (drive_file_id);
CREATE INDEX IF NOT EXISTS ix_event_files_student ON event_files (student_id, event_id);
CREATE INDEX IF NOT EXISTS ix_event_files_event ON event_files (event_id, file_scope);
CREATE INDEX IF NOT EXISTS ix_event_files_sub ON event_files (submission_id);

PRAGMA foreign_keys = ON;
