export type UserRole = "admin" | "hod" | "mentor" | "student";

export interface UserResponse {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  firebase_uid?: string | null;
  must_change_password?: boolean;
  created_at: string;
  accessible_portals?: UserRole[];
}

export interface StudentProfileResponse {
  id: string;
  register_number: string;
  department: string;
  year: number;
  section?: string | null;
  semester?: string | null;
  original_mentor_name?: string | null;
  batch?: string | null;
  phone_number?: string | null;
}

export interface MentorInfo {
  mentor_id: string;
  full_name: string;
  email: string;
  staff_id?: string | null;
  department: string;
}

export interface StudentProfileUpdateRequest {
  full_name?: string;
  phone_number?: string;
}

export interface StudentDetailResponse {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  profile?: StudentProfileResponse | null;
  assigned_mentor?: MentorInfo | null;
  hod_supervisor?: MentorInfo | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in_minutes: number;
  role: UserRole;
}

export interface MentorStudentItem {
  student_id: string;
  full_name: string;
  email: string;
  register_number?: string | null;
  department: string;
  year: number;
  section?: string | null;
  assignment_id: string;
  assigned_at: string;
  submission_count?: number;
}

export interface HODStudentItem {
  student_id: string;
  full_name: string;
  email: string;
  register_number?: string | null;
  department: string;
  year: number;
  section?: string | null;
  is_active: boolean;
  mentor_id?: string | null;
  mentor_name?: string | null;
}

export interface DepartmentOverviewResponse {
  department: string;
  cohort: string;
  total_students: number;
  total_mentors: number;
  active_components: number;
  achievements: {
    total: number;
    draft: number;
    pending: number;
    approved: number;
    rejected: number;
  };
}

// ==============================================================================
// Admin User Management Types
// ==============================================================================

export interface AdminStudentItem {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  firebase_uid?: string | null;
  created_at: string;
  register_number?: string | null;
  department: string;
  year: number;
  section?: string | null;
  semester?: string | null;
  batch?: string | null;
  phone_number?: string | null;
  original_mentor_name?: string | null;
  google_drive_folder_id?: string | null;
  assigned_mentor?: MentorInfo | null;
  submission_count: number;
  approved_count: number;
  pending_count: number;
}

export interface AdminStudentDetailResponse extends AdminStudentItem {
  assignment_history: Array<{
    assignment_id: string;
    mentor_id: string;
    mentor_name: string;
    is_active: boolean;
    assigned_at: string;
    ended_at?: string | null;
  }>;
  recent_submissions: Array<{
    id: string;
    title: string;
    status: string;
    component_name?: string | null;
    created_at: string;
  }>;
  evidence_files_count: number;
}

export interface AdminStudentCreate {
  full_name: string;
  email: string;
  register_number: string;
  department?: string;
  year?: number;
  section?: string;
  semester?: string;
  batch?: string;
  phone_number?: string;
  assigned_mentor_id?: string | null;
  password?: string;
}

export interface AdminStudentUpdate {
  full_name?: string;
  email?: string;
  register_number?: string;
  department?: string;
  year?: number;
  section?: string;
  semester?: string;
  batch?: string;
  phone_number?: string;
  assigned_mentor_id?: string | null;
  is_active?: boolean;
}

export interface AdminStudentDeleteRequest {
  delete_mode: "deactivate" | "delete_login" | "permanent";
  confirmation_register_number?: string;
}

export interface AdminMentorAssignedStudent {
  student_id: string;
  full_name: string;
  register_number?: string | null;
  email: string;
  year: number;
  section?: string | null;
  assigned_at: string;
}

export interface AdminMentorItem {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  firebase_uid?: string | null;
  created_at: string;
  staff_id?: string | null;
  department: string;
  designation?: string | null;
  assigned_student_count: number;
  assigned_students: AdminMentorAssignedStudent[];
  reviews_count: number;
}

export interface AdminMentorDetailResponse extends AdminMentorItem {
  all_assigned_students: AdminMentorAssignedStudent[];
}

export interface AdminMentorCreate {
  full_name: string;
  email: string;
  staff_id?: string;
  department?: string;
  designation?: string;
  password?: string;
}

export interface AdminMentorUpdate {
  full_name?: string;
  email?: string;
  staff_id?: string;
  department?: string;
  designation?: string;
  is_active?: boolean;
}

export interface AdminMentorDeleteRequest {
  reassign_mentor_id?: string | null;
}

export interface AdminMentorReassignRequest {
  target_mentor_id: string;
  student_ids?: string[];
}

export interface AdminHODItem {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  firebase_uid?: string | null;
  created_at: string;
  staff_id?: string | null;
  department: string;
  designation?: string | null;
  reviews_count: number;
}

export interface AdminHODCreate {
  full_name: string;
  email: string;
  staff_id?: string;
  department?: string;
  designation?: string;
  password?: string;
}

export interface AdminHODUpdate {
  full_name?: string;
  email?: string;
  staff_id?: string;
  department?: string;
  designation?: string;
  is_active?: boolean;
}

export interface AdminHODDeleteRequest {
  replacement_hod_id?: string | null;
}

export interface AdminOperationResult {
  success: boolean;
  message: string;
  affected_id?: string | null;
  delete_mode?: string | null;
  deleted_achievements_count?: number | null;
  deleted_files_count?: number | null;
  failed_drive_file_ids?: string[] | null;
  retry_drive_cleanup_needed?: boolean | null;
  details?: Record<string, unknown> | null;
}

// ==============================================================================
// Bulk Login Provisioning Types
// ==============================================================================

export interface ProvisioningPreviewItem {
  user_id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  status: "already_linked" | "needs_creation" | "exists_unlinked" | "conflict" | "invalid_email";
  firebase_uid?: string | null;
  existing_firebase_uid?: string | null;
  notes: string;
}

export interface ProvisioningPreviewResponse {
  total_users: number;
  by_role: Record<string, number>;
  already_linked_count: number;
  needs_creation_count: number;
  exists_unlinked_count: number;
  conflicts_count: number;
  invalid_email_count: number;
  initial_password: string;
  admin_account_email: string;
  admin_account_preserved: boolean;
  items: ProvisioningPreviewItem[];
}

export interface ProvisioningExecuteRequest {
  confirm: boolean;
  initial_password?: string;
  reset_existing_passwords?: boolean;
}

export interface ProvisioningResultItem {
  user_id: string;
  email: string;
  role: string;
  action: "created" | "reused_linked" | "skipped_already_linked" | "failed";
  firebase_uid?: string | null;
  message: string;
}

export interface ProvisioningExecuteResponse {
  success: boolean;
  message: string;
  total_processed: number;
  created_count: number;
  reused_count: number;
  skipped_count: number;
  failed_count: number;
  details: ProvisioningResultItem[];
}

export interface ChangePasswordRequest {
  current_password?: string;
  new_password: string;
}

// ==============================================================================
// Admin Governance & Dashboard Overview Types
// ==============================================================================

export interface AdminRecentSubmissionItem {
  id: string;
  title: string;
  status: "pending" | "approved" | "rejected" | "draft";
  activity_type?: string | null;
  student_name: string;
  register_number: string;
  component_name: string;
  submitted_at?: string | null;
}

export interface AdminOverviewResponse {
  total_users: number;
  users_by_role: Record<string, number>;
  active_users: number;
  inactive_users: number;
  firebase_linked_users: number;
  unlinked_users: number;
  total_student_profiles: number;
  total_mentor_profiles: number;
  total_hod_profiles: number;
  total_mentor_assignments: number;
  system_status: string;

  // Real data-driven dashboard statistics
  total_students: number;
  total_mentors: number;
  total_hods: number;
  active_accounts: number;
  pending_submissions: number;
  recorded_activities: number;
  approved_submissions: number;
  rejected_submissions: number;
  recent_submissions: AdminRecentSubmissionItem[];
}

export interface AdminSubmissionItem {
  id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  register_number: string;
  component_id: string;
  component_name: string;
  title: string;
  activity_type?: string | null;
  organizer?: string | null;
  event_date?: string | null;
  description?: string | null;
  outcome?: string | null;
  status: "pending" | "approved" | "rejected" | "draft";
  files_count: number;
  semester_id?: number | null;
  semester_number?: number | null;
  semester_name?: string | null;
  submitted_at?: string | null;
  created_at: string;
}

export interface AdminMentorAllocationItem {
  id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  register_number: string;
  section?: string | null;
  batch?: string | null;
  mentor_id: string;
  mentor_name: string;
  mentor_email: string;
  assigned_at?: string | null;
  is_active: boolean;
}

export interface AdminComponentItem {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  display_order: number;
  is_active: boolean;
  total_submissions: number;
  pending_submissions: number;
}

export interface DriveFolderAuditItem {
  student_id: string;
  register_number: string;
  student_name: string;
  student_email: string;
  computed_folder_name: string;
  db_folder_id?: string | null;
  drive_folder_id?: string | null;
  status: "ALREADY_PROVISIONED" | "EXISTS_IN_DRIVE_NEEDS_LINK" | "NEEDS_CREATION" | "ERROR";
  evidence_count: number;
  legacy_evidence_folder_ids: string[];
}

export interface DriveFolderAuditReport {
  total_students: number;
  provisioned_in_db: number;
  found_in_drive: number;
  requires_provisioning: number;
  legacy_folders_detected: number;
  total_evidence_files: number;
  students: DriveFolderAuditItem[];
  root_folder_id?: string | null;
  drive_connected: boolean;
  authorized_email?: string | null;
}

export interface DriveFolderProvisionResultItem {
  student_id: string;
  register_number: string;
  student_name: string;
  folder_name: string;
  folder_id?: string | null;
  action_taken: "CREATED" | "REUSED_EXISTING" | "ALREADY_SET" | "DRY_RUN_CREATED" | "DRY_RUN_REUSED" | "FAILED";
  success: boolean;
  error?: string | null;
}

export interface DriveFolderProvisionResponse {
  dry_run: boolean;
  total_students: number;
  created: number;
  reused: number;
  already_provisioned: number;
  failed: number;
  results: DriveFolderProvisionResultItem[];
  message: string;
}

export type MessageType = "Remark" | "Congratulations" | "Action Required" | "General Message";

export interface MessageItem {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  recipient_id: string;
  recipient_name: string;
  recipient_role: string;
  message_body: string;
  message_type: MessageType;
  achievement_id?: string | null;
  achievement_title?: string | null;
  parent_id?: string | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

export interface MessageCreateRequest {
  recipient_id: string;
  message_body: string;
  message_type?: MessageType;
  achievement_id?: string | null;
  parent_id?: string | null;
}

export interface UnreadCountResponse {
  total_unread: number;
  by_achievement: Record<string, number>;
}

export interface AdminEmailUpdateRequest {
  new_email: string;
  confirm_new_email: string;
  admin_password: string;
}

export interface AdminEmailUpdateResponse {
  user_id: string;
  full_name: string;
  previous_email: string;
  new_email: string;
  role: string;
  status: "pending_verification" | "completed";
  firebase_synced: boolean;
  message: string;
}
