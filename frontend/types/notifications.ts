// ==============================================================================
// CCE Student Notification System Types (Phase 2)
// ==============================================================================

import { AudienceType } from "./events";

export type NotificationPriority = "normal" | "important" | "urgent";

export type NotificationCategory =
  | "event"
  | "event_announcement"
  | "registration"
  | "announcement"
  | "academic"
  | "workshop"
  | "competition"
  | "internship"
  | "opportunity"
  | "reminder"
  | "urgent_alert"
  | "notice"
  | "general"
  | "custom";

export type NotificationStatus = "draft" | "published" | "scheduled" | "paused" | "archived";

export type NotificationDisplayMode = "bell_only" | "popup_only" | "both" | "normal" | "popup_modal";

export interface NotificationItem {
  id: string;
  title: string;
  short_message: string;
  detailed_message?: string;
  category: NotificationCategory | string;
  priority: NotificationPriority;
  image_url?: string;
  attachment_url?: string;
  external_url?: string;
  cta_label?: string;
  cta_url?: string;
  event_id?: string;
  audience_type: AudienceType;
  audience_payload?: any;
  display_mode: NotificationDisplayMode;
  status: NotificationStatus;
  scheduled_at?: string;
  published_at?: string;
  expires_at?: string;
  can_dismiss: boolean | number;
  created_by: string;
  creator_name?: string;
  created_at: string;
  updated_at: string;

  // Aggregate delivery & engagement statistics
  total_recipients?: number;
  read_count?: number;
  unread_count?: number;
  dismissed_count?: number;
  clicked_count?: number;
}

export interface NotificationCreateRequest {
  title: string;
  short_message: string;
  detailed_message?: string;
  category: NotificationCategory | string;
  priority: NotificationPriority;
  image_url?: string;
  attachment_url?: string;
  external_url?: string;
  cta_label?: string;
  cta_url?: string;
  event_id?: string;
  audience_type: AudienceType;
  audience_payload?: any;
  display_mode: NotificationDisplayMode;
  status?: NotificationStatus;
  scheduled_at?: string;
  published_at?: string;
  expires_at?: string;
  can_dismiss?: boolean;
}

export interface StudentNotificationItem {
  id: string;
  title: string;
  short_message: string;
  detailed_message?: string;
  category: NotificationCategory | string;
  priority: NotificationPriority;
  image_url?: string;
  attachment_url?: string;
  external_url?: string;
  cta_label?: string;
  cta_url?: string;
  event_id?: string;
  display_mode: NotificationDisplayMode;
  can_dismiss: boolean | number;
  published_at?: string;
  expires_at?: string;
  is_read: boolean | number;
  read_at?: string;
  is_dismissed: boolean | number;
  dismissed_at?: string;
  created_at?: string;
}
