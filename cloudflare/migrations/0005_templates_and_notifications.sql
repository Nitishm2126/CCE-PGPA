-- ==============================================================================
-- CCE-PGPA Cloudflare D1 Migration: 0005_templates_and_notifications.sql
-- Module: CCE Events & Forms (Phase 1.2 & Phase 2)
-- Description: Event Templates Library and Student In-App Notification System
-- ==============================================================================

PRAGMA foreign_keys = ON;

-- 1. Reusable Event Templates
CREATE TABLE IF NOT EXISTS event_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Workshop',
    description TEXT,
    purpose TEXT,
    is_starter INTEGER NOT NULL DEFAULT 0,
    sections_config TEXT,
    fields_config TEXT,
    created_by TEXT REFERENCES users (id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
    updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);

CREATE INDEX IF NOT EXISTS ix_event_templates_category ON event_templates (category);
CREATE INDEX IF NOT EXISTS ix_event_templates_starter ON event_templates (is_starter);

-- 2. In-App Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    short_message TEXT NOT NULL,
    detailed_message TEXT,
    category TEXT NOT NULL DEFAULT 'event' CHECK (category IN (
        'event', 'registration', 'announcement', 'academic', 'workshop',
        'competition', 'internship', 'general', 'custom'
    )),
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'urgent')),
    image_url TEXT,
    attachment_url TEXT,
    external_url TEXT,
    cta_label TEXT,
    cta_url TEXT,
    event_id TEXT REFERENCES events (id) ON DELETE SET NULL,
    audience_type TEXT NOT NULL DEFAULT 'all' CHECK (audience_type IN ('all', 'specific_students', 'section', 'academic_year', 'custom')),
    audience_payload TEXT,
    display_mode TEXT NOT NULL DEFAULT 'both' CHECK (display_mode IN ('bell_only', 'popup_only', 'both')),
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'scheduled', 'paused', 'archived')),
    scheduled_at TEXT,
    published_at TEXT,
    expires_at TEXT,
    can_dismiss INTEGER NOT NULL DEFAULT 1,
    created_by TEXT REFERENCES users (id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
    updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);

CREATE INDEX IF NOT EXISTS ix_notifications_status ON notifications (status);
CREATE INDEX IF NOT EXISTS ix_notifications_priority ON notifications (priority);
CREATE INDEX IF NOT EXISTS ix_notifications_dates ON notifications (published_at, expires_at);
CREATE INDEX IF NOT EXISTS ix_notifications_created_by ON notifications (created_by);
CREATE INDEX IF NOT EXISTS ix_notifications_event ON notifications (event_id);

-- 3. Per-Student Notification Recipient & Engagement Tracking
CREATE TABLE IF NOT EXISTS notification_recipients (
    id TEXT PRIMARY KEY,
    notification_id TEXT NOT NULL REFERENCES notifications (id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    is_read INTEGER NOT NULL DEFAULT 0,
    read_at TEXT,
    is_dismissed INTEGER NOT NULL DEFAULT 0,
    dismissed_at TEXT,
    clicked_at TEXT,
    created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
    UNIQUE(notification_id, student_id)
);

CREATE INDEX IF NOT EXISTS ix_notif_recipients_student ON notification_recipients (student_id, is_read, is_dismissed);
CREATE INDEX IF NOT EXISTS ix_notif_recipients_notif ON notification_recipients (notification_id);
