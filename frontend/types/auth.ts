export type UserRole = "student" | "mentor" | "hod";

export interface UserResponse {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
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

export interface StudentDetailResponse {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  profile?: StudentProfileResponse | null;
  assigned_mentor?: MentorInfo | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in_minutes: number;
  role: UserRole;
}
