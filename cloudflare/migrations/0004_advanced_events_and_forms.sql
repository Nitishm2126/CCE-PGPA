-- ==============================================================================
-- CCE-PGPA Cloudflare D1 Migration: 0004_advanced_events_and_forms.sql
-- Module: CCE Events & Forms (Phase 1.2: Advanced Customization & Dynamic Forms)
-- Description: Subtitles, gallery, attachments, contact info, multi-section forms,
--              conditional logic, ratings, geo-photo, and repeatable sections.
-- ==============================================================================

PRAGMA foreign_keys = OFF;

-- 1. Extend Events Table
ALTER TABLE events ADD COLUMN subtitle TEXT;
ALTER TABLE events ADD COLUMN custom_category TEXT;
ALTER TABLE events ADD COLUMN gallery_images TEXT;
ALTER TABLE events ADD COLUMN attachments TEXT;
ALTER TABLE events ADD COLUMN contact_person TEXT;
ALTER TABLE events ADD COLUMN contact_email TEXT;
ALTER TABLE events ADD COLUMN contact_phone TEXT;
ALTER TABLE events ADD COLUMN instructions TEXT;
ALTER TABLE events ADD COLUMN terms_conditions TEXT;
ALTER TABLE events ADD COLUMN form_layout_mode TEXT DEFAULT 'single_page';
ALTER TABLE events ADD COLUMN registration_capacity INTEGER DEFAULT NULL;

-- 2. Extend Event Form Versions Table with sections_config
ALTER TABLE event_form_versions ADD COLUMN sections_config TEXT;

-- 3. Upgrade Event Form Fields Table (Allow advanced field types, sections, logic & configs)
CREATE TABLE IF NOT EXISTS event_form_fields_new (
    id TEXT PRIMARY KEY,
    form_version_id TEXT NOT NULL REFERENCES event_form_versions (id) ON DELETE CASCADE,
    field_key TEXT NOT NULL,
    field_type TEXT NOT NULL,
    label TEXT NOT NULL,
    description TEXT,
    placeholder TEXT,
    required INTEGER NOT NULL DEFAULT 0,
    validation_config TEXT,
    options_config TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    section_id TEXT DEFAULT 'default',
    conditions TEXT,
    rating_config TEXT,
    repeatable_config TEXT,
    default_value TEXT,
    min_len INTEGER,
    max_len INTEGER,
    min_val REAL,
    max_val REAL,
    created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);

INSERT INTO event_form_fields_new (
    id, form_version_id, field_key, field_type, label, description,
    placeholder, required, validation_config, options_config,
    display_order, enabled, created_at
)
SELECT 
    id, form_version_id, field_key, field_type, label, description,
    placeholder, required, validation_config, options_config,
    display_order, enabled, created_at
FROM event_form_fields;

DROP TABLE event_form_fields;
ALTER TABLE event_form_fields_new RENAME TO event_form_fields;

CREATE INDEX IF NOT EXISTS ix_event_form_fields_version ON event_form_fields (form_version_id, display_order);
CREATE INDEX IF NOT EXISTS ix_event_form_fields_section ON event_form_fields (form_version_id, section_id);

PRAGMA foreign_keys = ON;
