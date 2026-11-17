export interface SemesterPointConfig {
  semester_number: number;
  is_enabled: boolean;
  min_points: number;
  max_points: number;
  credit_value: number;
  scale_label?: string | null;
  guideline?: string | null;
  grade_thresholds?: Record<string, number> | null;
  rules_description?: string | null;
}

export interface ComponentPointSettingsResponse {
  component_id: string;
  component_name: string;
  component_slug: string;
  credit_value: number;
  unit: string;
  default_min_points: number;
  default_max_points: number;
  scale_label: string;
  guideline: string;
  semesters: SemesterPointConfig[];
  updated_at?: string | null;
  updated_by_name?: string | null;
}

export interface ComponentPointSettingsUpdatePayload {
  unit?: string;
  default_min_points?: number;
  default_max_points?: number;
  scale_label?: string;
  guideline?: string;
  semesters: SemesterPointConfig[];
}
