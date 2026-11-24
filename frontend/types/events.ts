// ==============================================================================
// CCE Events & Forms Type Definitions (Phase 1)
// ==============================================================================

export type EventMode = "Offline" | "Online" | "Hybrid";

export type EventStatus = "draft" | "published" | "closed" | "archived";

export type AudienceType = "all" | "specific_students" | "section" | "academic_year" | "custom";

export type FormFieldType =
  | "text"
  | "textarea"
  | "number"
  | "email"
  | "phone"
  | "dropdown"
  | "radio"
  | "checkbox"
  | "date"
  | "time"
  | "file"
  | "heading"
  | "info";

export interface FormFieldValidationConfig {
  min_len?: number;
  max_len?: number;
  min_val?: number;
  max_val?: number;
  allowed_types?: string[];
  max_size_mb?: number;
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
  placeholder?: string;
  required: boolean;
  validation_config?: FormFieldValidationConfig;
  options_config?: FormFieldOption[];
  display_order: number;
  enabled: boolean;
}

export interface EventFormVersion {
  id: string;
  event_id: string;
  version_number: number;
  status: "draft" | "published" | "archived";
  created_by: string;
  created_at: string;
  published_at?: string;
  fields: EventFormField[];
  submissions_count?: number;
  fields_count?: number;
}

export interface EventItem {
  id: string;
  title: string;
  short_description?: string;
  detailed_description?: string;
  category: string;
  poster_url?: string;
  document_url?: string;
  venue?: string;
  mode: EventMode;
  meeting_url?: string;
  event_start_at: string;
  event_end_at: string;
  registration_start_at: string;
  registration_deadline: string;
  academic_year?: string;
  semester_id?: string;
  semester_display_name?: string;
  status: EventStatus;
  allow_multiple_responses: boolean;
  allow_edit_submission: boolean;
  close_after_deadline: boolean;
  is_registration_enabled: boolean;
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
  original_filename: string;
  mime_type: string;
  file_size: number;
  uploaded_at: string;
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
  short_description?: string;
  detailed_description?: string;
  category: string;
  poster_url?: string;
  document_url?: string;
  venue?: string;
  mode: EventMode;
  meeting_url?: string;
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
  form_fields?: Array<Partial<EventFormField>>;
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
