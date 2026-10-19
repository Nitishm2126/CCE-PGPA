export type AchievementStatus = "draft" | "pending" | "approved" | "rejected";
export type ReviewAction = "approved" | "rejected" | "requested_changes";

export interface PGPAComponentResponse {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  semester_label?: string | null;
  academic_period?: string | null;
  display_order: number;
  is_active: boolean;
}

export interface AchievementFileResponse {
  id: string;
  achievement_id: string;
  provider: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  file_category: string;
  uploaded_by: string;
  created_at: string;
  content_url: string;
}

export interface VerificationLogResponse {
  id: string;
  achievement_id: string;
  reviewer_id: string;
  reviewer_name?: string | null;
  action: ReviewAction;
  remarks?: string | null;
  created_at: string;
}

export interface AchievementResponse {
  id: string;
  student_id: string;
  student_name?: string | null;
  student_register_number?: string | null;
  component_id: string;
  component_name?: string | null;
  component_slug?: string | null;
  title: string;
  activity_type?: string | null;
  organizer?: string | null;
  event_date?: string | null;
  description?: string | null;
  outcome?: string | null;
  status: AchievementStatus;
  submitted_at?: string | null;
  created_at: string;
  updated_at?: string | null;
  files: AchievementFileResponse[];
  verification_logs: VerificationLogResponse[];
}

export interface AchievementCreate {
  component_id: string;
  title: string;
  activity_type?: string;
  organizer?: string;
  event_date?: string;
  description?: string;
  outcome?: string;
}
