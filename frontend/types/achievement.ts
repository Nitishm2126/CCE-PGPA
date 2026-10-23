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

export interface SemesterResponse {
  id: string;
  semester_number: number;
  display_name: string;
  is_enabled: boolean;
  created_at?: string;
  updated_at?: string;
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
  semester_id?: number | string | null;
  semester_number?: number | null;
  semester_display_name?: string | null;
  semester?: SemesterResponse | null;
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
  semester_id: string;
  title: string;
  activity_type?: string;
  organizer?: string;
  event_date?: string;
  description?: string;
  outcome?: string;
}

export interface StudentSemesterFolderAuditItem {
  student_id: string;
  register_number: string;
  student_name: string;
  existing_student_folder_id?: string | null;
  has_student_folder: boolean;
  semesters: {
    semester_number: number;
    semester_name: string;
    folder_id?: string | null;
    status: "EXISTS_MAPPED" | "EXISTS_IN_DRIVE" | "MISSING";
  }[];
}

export interface SemesterDriveAuditReport {
  root_folder_id: string;
  total_students: number;
  target_semesters: number[];
  students: StudentSemesterFolderAuditItem[];
}

export interface SemesterDriveProvisionResponse {
  dry_run: boolean;
  total_students: number;
  target_semesters: number[];
  created_folders: number;
  reused_folders: number;
  already_mapped: number;
  failed: number;
  details: {
    student_id: string;
    register_number: string;
    semester_number: number;
    folder_id?: string | null;
    action: "CREATED" | "REUSED_EXISTING" | "ALREADY_MAPPED" | "DRY_RUN_CREATED" | "FAILED";
    error?: string | null;
  }[];
  message: string;
}
