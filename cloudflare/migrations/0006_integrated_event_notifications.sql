-- ==============================================================================
-- CCE-PGPA Cloudflare D1 Migration: 0006_integrated_event_notifications.sql
-- Module: CCE Events & Forms (Phase 2 Integration)
-- Description: Integrated event notification columns and duplicate prevention index
-- ==============================================================================

PRAGMA foreign_keys = OFF;

-- 1. Extend Events Table with Integrated Notification Configuration
ALTER TABLE events ADD COLUMN notify_students INTEGER NOT NULL DEFAULT 0;
ALTER TABLE events ADD COLUMN notification_title TEXT;
ALTER TABLE events ADD COLUMN notification_message TEXT;
ALTER TABLE events ADD COLUMN notification_image_url TEXT;
ALTER TABLE events ADD COLUMN notification_priority TEXT DEFAULT 'normal';
ALTER TABLE events ADD COLUMN notification_display_mode TEXT DEFAULT 'both';
ALTER TABLE events ADD COLUMN notification_schedule TEXT;

-- 2. Index to optimize event notification lookups and prevent duplicate event notifications
CREATE INDEX IF NOT EXISTS ix_notifications_event_id ON notifications (event_id);

PRAGMA foreign_keys = ON;
