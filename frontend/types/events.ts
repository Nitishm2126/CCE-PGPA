// ==============================================================================
// CCE Events & Forms Type Definitions (Advanced Form Builder & Publishing)
// ==============================================================================

export type EventMode = "Offline" | "Online" | "Hybrid";

export type EventStatus = "draft" | "published" | "closed" | "archived";

export type EffectiveEventStatus =
  | EventStatus
  | "scheduled"
  | "registration_open"
  | "registration_closed"
  | "completed";

export type AudienceType = "all" | "specific_students" | "section" | "academic_year" | "custom";

export type FormLayoutMode = "single_page" | "multi_step";

export type FormFieldType =
  // Basic
  | "text"
  | "textarea"
  | "number"
  | "email"
  | "phone"
  | "url"
  | "rich_text"
  // Date & Time
  | "date"
  | "time"
  | "datetime"
  | "date_range"
  // Selection
  | "dropdown"
  | "radio"
  | "checkbox"
  | "yes_no"
  | "multi_select"
  // Feedback & Rating
  | "star_rating"
  | "numeric_rating"
  | "satisfaction_rating"
  | "difficulty_rating"
  | "custom_scale"
  // Uploads
  | "file"
  | "image_upload"
  | "pdf_upload"
  | "document_upload"
  | "camera_capture"
  | "gallery_upload"
  // Geo Photo
  | "geo_photo"
  // Layout Blocks
  | "heading"
  | "subheading"
  | "description"
  | "rich_text_block"
  | "divider"
  | "info"
  | "info_card"
  | "image_block"
  | "pdf_link"
  | "notice"
  // Repeatable
  | "repeatable_group"
  | (string & {});

export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "greater_than"
  | "less_than"
  | "in"
  | "is_empty"
  | "is_not_empty";

export interface ConditionalRule {
  field: string; // source field key
  operator: ConditionOperator;
  value?: any;
  target_value?: any;
  action?: "show" | "hide" | "skip";
  jump_to_section_id?: string;
}

export interface ConditionalConfig {
  logic?: "and" | "or";
  rules: ConditionalRule[];
}

export interface RatingConfig {
  min_rating?: number; // e.g. 0 or 1
  max_rating?: number; // e.g. 5 or 10
  allow_half?: boolean;
  min_label?: string; // e.g. "Poor" or "Beginner"
  max_label?: string; // e.g. "Excellent" or "Advanced"
  scale_type?: "stars" | "numbers" | "emojis" | "labels";
  options?: string[]; // e.g. ["Poor", "Fair", "Good", "Very Good", "Excellent"]
  show_feedback_box?: boolean;
  feedback_box_label?: string;
}

export interface RepeatableConfig {
  entity_name?: string; // e.g. "Team Member", "Participant"
  min_items?: number; // e.g. 1
  max_items?: number; // e.g. 4
  add_button_text?: string; // e.g. "+ Add Team Member"
  fields?: EventFormField[];
}

export interface GeoLocationData {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  timestamp?: string;
  has_geo: boolean;
  file_url?: string;
  storage_reference?: string;
  original_filename?: string;
}

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  order: number;
  conditions?: ConditionalRule[] | ConditionalConfig | any;
  collapsed?: boolean;
}

export interface FormFieldValidationConfig {
  min_len?: number;
  max_len?: number;
  min_val?: number;
  max_val?: number;
  number_mode?: "integer" | "decimal";
  regex_pattern?: string;
  custom_error?: string;
  min_selections?: number;
  max_selections?: number;
  min_date?: string;
  max_date?: string;
  min_time?: string;
  max_time?: string;
  allowed_types?: string[];
  max_size_mb?: number;
  allow_multiple_files?: boolean;
  max_files?: number;
  help_text?: string;
  allow_other?: boolean;
  other_label?: string;
}

export interface FormSettings {
  form_title?: string;
  form_description?: string;
  custom_instructions?: string;
  submit_button_label?: string;
  success_message?: string;
  allow_multiple_responses?: boolean;
  allow_edit_submission?: boolean;
  allow_resubmission?: boolean;
  registration_capacity?: number | null;
  submission_deadline?: string | null;
  show_progress_indicator?: boolean;
  show_section_navigation?: boolean;
}

export interface FormFieldOption {
  label: string;
  value: string;
}

export interface EventFormField {
  id: string;
  field_key: string;
  field_type: FormFieldType;
  label: string;
  description?: string;
  help_text?: string;
  placeholder?: string;
  required: boolean;
  validation_config?: FormFieldValidationConfig;
  options_config?: FormFieldOption[];
  display_order: number;
  enabled?: boolean;
  section_id?: string;
  conditions?: ConditionalRule[] | ConditionalConfig | any;
  rating_config?: RatingConfig;
  repeatable_config?: RepeatableConfig;
  default_value?: any;
  min_len?: number;
  max_len?: number;
  min_val?: number;
  max_val?: number;
}

export interface EventFormVersion {
  id: string;
  event_id: string;
  version_number: number;
  status: "draft" | "published" | "archived";
  sections_config?: FormSection[];
  form_settings?: FormSettings | null;
  created_by: string;
  created_at: string;
  published_at?: string;
  fields: EventFormField[];
  submissions_count?: number;
  fields_count?: number;
}

export interface EventAttachment {
  id?: string;
  name: string;
  url: string;
  type?: string;
  size?: number;
}

export interface EventItem {
  id: string;
  title: string;
  subtitle?: string;
  custom_category?: string;
  short_description?: string;
  detailed_description?: string;
  category: string;
  poster_url?: string;
  banner_image_url?: string;
  document_url?: string;
  gallery_images?: string[];
  attachments?: EventAttachment[];
  venue?: string;
  mode: EventMode;
  meeting_url?: string;
  online_meeting_url?: string;
  event_start_at: string;
  event_end_at: string;
  registration_start_at: string;
  registration_deadline: string;
  academic_year?: string;
  semester_id?: string;
  semester_display_name?: string;
  status: EventStatus;
  effective_status?: EffectiveEventStatus;
  idempotency_key?: string;
  allow_multiple_responses: boolean;
  allow_edit_submission: boolean;
  close_after_deadline: boolean;
  is_registration_enabled: boolean;
  contact_person?: string;
  contact_email?: string;
  contact_phone?: string;
  instructions?: string;
  terms_conditions?: string;
  form_layout_mode?: FormLayoutMode;
  registration_capacity?: number | null;
  notify_students?: boolean | number;
  notification_title?: string;
  notification_message?: string;
  notification_image_url?: string;
  notification_priority?: "normal" | "important" | "urgent";
  notification_display_mode?: "bell_only" | "both" | "popup_only";
  notification_schedule?: string | null;
  notification_cta_label?: string;
  send_update_notification?: boolean;
  update_message?: string;
  created_by: string;
  creator_name?: string;
  creator_email?: string;
  created_at: string;
  updated_at: string;
  audience_type?: AudienceType;
  audience_payload?: any;
  total_submissions?: number;
  current_form?: EventFormVersion;
  has_submitted?: boolean;
  my_submission_id?: string;
  my_submission_status?: string;
  my_submitted_at?: string;
  my_submission?: EventSubmissionItem;
}

export interface EventSubmissionValue {
  value: any;
  label?: string;
  field_type?: FormFieldType;
}

export interface EventSubmissionFile {
  id: string;
  submission_id: string;
  field_id?: string;
  field_key: string;
  storage_reference: string;
  drive_file_id?: string;
  drive_folder_id?: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  uploaded_at: string;
  file_url?: string;
  download_url?: string;
}

export interface EventSubmissionItem {
  id: string;
  event_id: string;
  form_version_id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  register_number?: string;
  section?: string;
  academic_year?: number | string;
  phone_number?: string;
  submission_status: "submitted" | "updated" | "resubmitted";
  submitted_at: string;
  updated_at: string;
  version_number: number;
  values?: Record<string, EventSubmissionValue | any>;
  files?: EventSubmissionFile[];
  files_count?: number;
  form_version?: EventFormVersion;
}

export interface EventResponsesResponse {
  event: EventItem;
  current_form_version?: EventFormVersion;
  total_submissions: number;
  total_not_submitted: number;
  submissions: EventSubmissionItem[];
  not_submitted_students: Array<{
    id: string;
    full_name: string;
    email: string;
    register_number?: string;
    section?: string;
    year?: number;
  }>;
}

export interface EventCreateRequest {
  title: string;
  subtitle?: string;
  custom_category?: string;
  short_description?: string;
  detailed_description?: string;
  category: string;
  poster_url?: string;
  banner_image_url?: string;
  document_url?: string;
  gallery_images?: string[];
  attachments?: EventAttachment[];
  venue?: string;
  mode: EventMode;
  meeting_url?: string;
  online_meeting_url?: string;
  event_start_at: string;
  event_end_at: string;
  registration_start_at: string;
  registration_deadline: string;
  academic_year?: string;
  semester_id?: string;
  audience_type?: AudienceType;
  audience_payload?: any;
  allow_multiple_responses?: boolean;
  allow_edit_submission?: boolean;
  close_after_deadline?: boolean;
  is_registration_enabled?: boolean;
  contact_person?: string;
  contact_email?: string;
  contact_phone?: string;
  instructions?: string;
  terms_conditions?: string;
  form_layout_mode?: FormLayoutMode;
  registration_capacity?: number | null;
  notify_students?: boolean | number;
  notification_title?: string;
  notification_message?: string;
  notification_image_url?: string;
  notification_priority?: "normal" | "important" | "urgent";
  notification_display_mode?: "bell_only" | "both" | "popup_only";
  notification_schedule?: string | null;
  notification_cta_label?: string;
  send_update_notification?: boolean;
  update_message?: string;
  idempotency_key?: string;
  form_fields?: Array<Partial<EventFormField>>;
  sections_config?: FormSection[];
}

export interface EventSubmissionRequest {
  form_version_id?: string;
  values: Record<string, any>;
  uploaded_files?: Array<{
    field_key: string;
    storage_reference: string;
    original_filename: string;
    mime_type: string;
    file_size: number;
  }>;
}

export interface EventTemplate {
  id: string;
  name: string;
  category: string;
  purpose: string;
  description: string;
  is_starter: number | boolean;
  default_title?: string;
  default_subtitle?: string;
  default_mode?: EventMode;
  form_layout_mode?: FormLayoutMode;
  sections_config?: FormSection[];
  fields_config?: EventFormField[];
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

