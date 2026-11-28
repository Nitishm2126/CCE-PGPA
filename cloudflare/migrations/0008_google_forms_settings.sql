-- ==============================================================================
-- CCE-PGPA Cloudflare D1 Migration: 0008_google_forms_settings.sql
-- Module: CCE Events & Forms (Google Forms-style Form Settings)
-- Description: Non-destructive additive column storing per-version form settings
--              (title, description, instructions, submit label, success message,
--              progress bar/section navigation toggles, and response limits).
-- ==============================================================================

ALTER TABLE event_form_versions ADD COLUMN form_settings TEXT;
