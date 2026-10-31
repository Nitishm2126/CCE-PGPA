export type AchievementStatus = "draft" | "pending" | "approved" | "rejected";
export type ReviewAction = "approved" | "rejected" | "requested_changes";

export interface DynamicFieldDefinition {
  name: string;
  label: string;
  type: "text" | "number" | "select" | "date" | "textarea" | "checkbox";
  required: boolean;
  options?: string[];
  placeholder?: string;
  help_text?: string;
  min?: number;
  max?: number;
}

export interface PGPAComponentResponse {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  semester_label?: string | null;
  academic_period?: string | null;
  display_order: number;
  is_active: boolean;
  credit_value?: number;
  submission_mode?: "student_submission" | "hod_excel_import" | "both" | "direct_staff_entry";
  grading_strategy?: string;
  requires_verification?: boolean;
  input_fields?: DynamicFieldDefinition[];
  pdf_requirement?: "required" | "optional" | "disabled";
  pdf_required?: boolean;
  allow_other_evidence_types?: boolean;
  is_enabled_for_semester?: boolean;
  lock_reason?: string | null;
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
  component_metadata?: Record<string, any> | null;
  evaluated_grade?: string | null;
  evaluated_grade_points?: number | null;
  evaluated_points?: number | null;
  mentor_remarks?: string | null;
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
  title?: string;
  activity_type?: string;
  organizer?: string;
  event_date?: string;
  description?: string;
  outcome?: string;
  component_metadata?: Record<string, any>;
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

export interface ComponentSemesterStatusMap {
  [semesterNumber: string]: boolean;
}

export interface AdminMatrixComponentItem {
  component_id: string;
  name: string;
  slug: string;
  credit_value: number;
  submission_mode: string;
  grading_strategy: string;
  requires_verification: boolean;
  is_active: boolean;
  pdf_requirement?: "required" | "optional" | "disabled";
  pdf_required?: boolean;
  allow_other_evidence_types?: boolean;
  semesters: ComponentSemesterStatusMap;
}

export interface AdminSemesterMatrixResponse {
  semesters: { id: string; number: number; name: string; is_enabled: boolean }[];
  components: AdminMatrixComponentItem[];
}

export interface ComponentSemesterConfigResponse {
  id: string;
  component_id: string;
  component_name?: string;
  semester_id: string;
  semester_number?: number;
  semester_display_name?: string;
  is_enabled: boolean;
  submission_deadline?: string;
}

export interface HODImportPreviewRow {
  row_number: number;
  register_number: string;
  student_name?: string | null;
  student_id?: string | null;
  result_value: string;
  raw_score?: number | null;
  category?: string | null;
  calculated_grade?: string | null;
  grade_points?: number | null;
  is_valid: boolean;
  error_message?: string | null;
}

export interface HODImportPreviewResponse {
  preview_token: string;
  component_id: string;
  component_name: string;
  component_slug: string;
  semester_id: string;
  semester_name: string;
  semester_number: number;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  rows: HODImportPreviewRow[];
  summary_message: string;
}

export interface HODImportConfirmResult {
  batch_id: string;
  component_name: string;
  semester_name: string;
  imported_count: number;
  message: string;
}

export interface HODImportBatchItem {
  id: string;
  uploaded_by: string;
  uploaded_by_name?: string | null;
  component_id: string;
  component_name?: string | null;
  semester_id: string;
  semester_name?: string | null;
  academic_cohort: string;
  source_filename: string;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  status: string;
  created_at: string;
}

export interface StudentComponentResultItem {
  id: string;
  student_id: string;
  student_name?: string | null;
  student_register_number?: string | null;
  component_id: string;
  component_name?: string | null;
  component_slug?: string | null;
  semester_id: string;
  semester_number?: number | null;
  semester_name?: string | null;
  raw_score?: number | null;
  category?: string | null;
  grade?: string | null;
  grade_points?: number | null;
  credit_value: number;
  is_verified: boolean;
  source: string;
  notes?: string | null;
  calculated_at: string;
}

export interface StudentPGPAResponse {
  student_id: string;
  student_name: string;
  register_number: string;
  semester_id: string;
  semester_number: number;
  semester_name: string;
  a1_score: number;
  semester_gpa?: number | null;
  pgpa?: number | null;
  total_credits_attempted: number;
  total_credits_earned: number;
  calculated_at: string;
  results: StudentComponentResultItem[];
  formula_explanation: string;
}

export interface StudentPGPAComponentScore {
  grade?: string | null;
  grade_points?: number | null;
  grade_point?: number | null;
  raw_score?: number | null;
  points?: number | null;
  credit_value: number;
  is_verified: boolean;
  status?: "verified" | "in_review" | "pending_criteria" | "none" | string;
  source?: string | null;
  notes?: string | null;
  criteria_pending?: boolean;
  calculated_at?: string | null;
}

export interface StudentPGPAGradeRow {
  student_id: string;
  register_number?: string | null;
  student_name: string;
  email: string;
  department: string;
  year: number;
  section?: string | null;
  mentor_id?: string | null;
  mentor_name?: string | null;
  components: Record<string, StudentPGPAComponentScore | null>;
  total_points: number;
  total_grade_points: number;
}

