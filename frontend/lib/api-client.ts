import {
  TokenResponse,
  UserResponse,
  StudentDetailResponse,
  StudentProfileUpdateRequest,
  MentorStudentItem,
  HODStudentItem,
  DepartmentOverviewResponse,
  AdminStudentItem,
  AdminStudentDetailResponse,
  AdminStudentCreate,
  AdminStudentUpdate,
  AdminStudentDeleteRequest,
  AdminMentorItem,
  AdminMentorDetailResponse,
  AdminMentorCreate,
  AdminMentorUpdate,
  AdminMentorDeleteRequest,
  AdminHODItem,
  AdminHODCreate,
  AdminHODUpdate,
  AdminHODDeleteRequest,
  AdminOperationResult,
  ProvisioningPreviewResponse,
  ProvisioningExecuteRequest,
  ProvisioningExecuteResponse,
  ChangePasswordRequest,
  AdminOverviewResponse,
  AdminSubmissionItem,
  AdminMentorAllocationItem,
  AdminComponentItem,
  DriveFolderAuditReport,
  DriveFolderProvisionResponse,
  MessageType,
  MessageItem,
  MessageCreateRequest,
  UnreadCountResponse,
  AdminEmailUpdateRequest,
  AdminEmailUpdateResponse,
  AdminSendVerificationEmailResponse,
  AdminVerificationStatusResponse,
} from "@/types/auth";
import {
  PGPAComponentResponse,
  AchievementResponse,
  AchievementCreate,
  AchievementFileResponse,
  SemesterResponse,
  SemesterDriveAuditReport,
  SemesterDriveProvisionResponse,
  AdminSemesterMatrixResponse,
  ComponentSemesterConfigResponse,
  HODImportPreviewResponse,
  HODImportConfirmResult,
  HODImportBatchItem,
  StudentComponentResultItem,
  StudentPGPAResponse,
} from "@/types/achievement";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api/v1";

const TOKEN_STORAGE_KEY = "cce_achieve_token";

export const getStoredToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
};

export const setStoredToken = (token: string): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
};

export const clearStoredToken = (): void => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_STORAGE_KEY);
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {},
  token?: string | null
): Promise<T> {
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const authToken = token !== undefined ? token : getStoredToken();

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const { timeoutMs = 12000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: fetchOptions.signal || controller.signal,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError(
        `Request timed out after ${timeoutMs}ms (${url}). The backend service took too long to respond. Please verify the backend is running and retry.`,
        408
      );
    }
    const errDetail = err instanceof Error ? ` (${err.message})` : "";
    throw new ApiError(
      `Unable to connect to CCE-PGPA backend service at ${url}${errDetail}. Please check your network connection or verify that the backend is active.`,
      0
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData.detail) {
        errorMessage =
          typeof errorData.detail === "string"
            ? errorData.detail
            : JSON.stringify(errorData.detail);
      }
    } catch {
      // Use fallback error message
    }
    throw new ApiError(errorMessage, response.status);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError(
      `Invalid response from CCE-PGPA backend for ${path}: Expected JSON payload but received non-JSON (status ${response.status}).`,
      502
    );
  }
}

async function requestBlob(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<Blob> {
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const authToken = token !== undefined ? token : getStoredToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    throw new ApiError(`Download failed with status ${response.status}`, response.status);
  }
  return response.blob();
}

let cachedComponents: PGPAComponentResponse[] | null = null;
let cachedSemesters: SemesterResponse[] | null = null;

export const api = {
  login: async (email: string, password: string): Promise<TokenResponse> => {
    return request<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  getMe: async (token?: string | null): Promise<UserResponse> => {
    return request<UserResponse>("/auth/me", { method: "GET" }, token);
  },

  getStudentDetail: async (token?: string | null): Promise<StudentDetailResponse> => {
    return request<StudentDetailResponse>("/students/me", { method: "GET" }, token);
  },

  updateStudentProfile: async (
    data: StudentProfileUpdateRequest,
    token?: string | null
  ): Promise<StudentDetailResponse> => {
    return request<StudentDetailResponse>(
      "/students/me",
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
      token
    );
  },


  getComponents: async (
    semesterId?: string,
    token?: string | null,
    forceRefresh: boolean = false
  ): Promise<PGPAComponentResponse[]> => {
    if (cachedComponents && !forceRefresh && !semesterId) {
      return cachedComponents;
    }
    const query = semesterId ? `?semester_id=${encodeURIComponent(semesterId)}` : "";
    const res = await request<PGPAComponentResponse[]>(`/students/components${query}`, { method: "GET" }, token);
    if (!semesterId) {
      cachedComponents = res;
    }
    return res;
  },

  getMyComponentResults: async (
    semesterId?: string,
    token?: string | null
  ): Promise<StudentComponentResultItem[]> => {
    const query = semesterId ? `?semester_id=${encodeURIComponent(semesterId)}` : "";
    return request<StudentComponentResultItem[]>(`/students/me/component-results${query}`, { method: "GET" }, token);
  },

  getMyPGPA: async (
    semesterId?: string,
    token?: string | null
  ): Promise<StudentPGPAResponse> => {
    const query = semesterId ? `?semester_id=${encodeURIComponent(semesterId)}` : "";
    return request<StudentPGPAResponse>(`/students/me/pgpa${query}`, { method: "GET" }, token);
  },

  getMyAchievements: async (token?: string | null): Promise<AchievementResponse[]> => {
    return request<AchievementResponse[]>("/students/me/achievements", { method: "GET" }, token);
  },

  createAchievement: async (
    data: AchievementCreate,
    token?: string | null
  ): Promise<AchievementResponse> => {
    return request<AchievementResponse>(
      "/students/me/achievements",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
      token
    );
  },

  updateAchievement: async (
    achievementId: string,
    data: Partial<AchievementCreate>,
    token?: string | null
  ): Promise<AchievementResponse> => {
    return request<AchievementResponse>(
      `/students/me/achievements/${achievementId}`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
      token
    );
  },

  submitAchievement: async (
    achievementId: string,
    token?: string | null
  ): Promise<AchievementResponse> => {
    return request<AchievementResponse>(
      `/students/me/achievements/${achievementId}/submit`,
      { method: "POST" },
      token
    );
  },

  deleteAchievement: async (
    achievementId: string,
    token?: string | null
  ): Promise<{ detail: string; id: string }> => {
    return request<{ detail: string; id: string }>(
      `/students/me/achievements/${achievementId}`,
      { method: "DELETE" },
      token
    );
  },

  uploadEvidenceFile: async (
    achievementId: string,
    file: File,
    category: "certificate" | "photo" | "supporting_document" = "certificate",
    token?: string | null
  ): Promise<AchievementFileResponse> => {
    const url = `${API_BASE_URL}/achievements/${achievementId}/files`;
    const authToken = token !== undefined ? token : getStoredToken();

    const formData = new FormData();
    formData.append("file", file);
    formData.append("file_category", category);

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers,
        body: formData,
      });
    } catch {
      throw new ApiError(
        "Unable to connect to CCE-PGPA backend service. Please check your network connection.",
        0
      );
    }

    if (!response.ok) {
      let errorMessage = `Upload failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.detail) {
          errorMessage =
            typeof errorData.detail === "string"
              ? errorData.detail
              : JSON.stringify(errorData.detail);
        }
      } catch {
        // Fallback error message
      }
      throw new ApiError(errorMessage, response.status);
    }

    return response.json() as Promise<AchievementFileResponse>;
  },

  // Mentor Endpoints (View-Only Faculty Access)
  getMentorStudents: async (token?: string | null): Promise<MentorStudentItem[]> => {
    return request<MentorStudentItem[]>("/mentor/students", { method: "GET" }, token);
  },

  getMentorSubmissions: async (status?: string, token?: string | null): Promise<AchievementResponse[]> => {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return request<AchievementResponse[]>(`/mentor/submissions${query}`, { method: "GET" }, token);
  },

  getMenteeAchievement: async (achievementId: string, token?: string | null): Promise<AchievementResponse> => {
    return request<AchievementResponse>(`/mentor/achievements/${achievementId}`, { method: "GET" }, token);
  },

  reviewMenteeAchievement: async (
    achievementId: string,
    data: { action: "approved" | "rejected" | "requested_changes"; remarks?: string },
    token?: string | null
  ): Promise<AchievementResponse> => {
    return request<AchievementResponse>(
      `/mentor/achievements/${achievementId}/review`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
      token
    );
  },

  // HOD Endpoints (View-Only Department Oversight)
  getHodOverview: async (token?: string | null): Promise<DepartmentOverviewResponse> => {
    return request<DepartmentOverviewResponse>("/hod/overview", { method: "GET" }, token);
  },

  getHodStudents: async (token?: string | null): Promise<HODStudentItem[]> => {
    return request<HODStudentItem[]>("/hod/students", { method: "GET" }, token);
  },

  getHodSubmissions: async (
    params?: { status?: string; component_id?: string; student_id?: string; semester?: string; search?: string },
    token?: string | null
  ): Promise<AchievementResponse[]> => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);
    if (params?.component_id) searchParams.set("component_id", params.component_id);
    if (params?.student_id) searchParams.set("student_id", params.student_id);
    if (params?.semester) searchParams.set("semester", params.semester);
    if (params?.search) searchParams.set("search", params.search);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return request<AchievementResponse[]>(`/hod/submissions${query}`, { method: "GET" }, token);
  },

  getStudentAchievementsForHod: async (studentId: string, token?: string | null): Promise<AchievementResponse[]> => {
    return request<AchievementResponse[]>(`/hod/students/${studentId}/achievements`, { method: "GET" }, token);
  },

  downloadFile: async (fileId: string, token?: string | null): Promise<{ blob: Blob; url: string }> => {
    const authToken = token !== undefined ? token : getStoredToken();
    const headers: Record<string, string> = {};
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
    const res = await fetch(`${API_BASE_URL}/files/${fileId}/content`, {
      method: "GET",
      headers,
    });
    if (!res.ok) {
      throw new ApiError(`Failed to fetch file (Status: ${res.status})`, res.status);
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    return { blob, url };
  },

  getGoogleDriveAuthUrl: async (token?: string | null): Promise<GoogleDriveAuthResponse> => {
    return request<GoogleDriveAuthResponse>("/auth/google/authorize", { method: "GET" }, token);
  },

  logout: async (token?: string | null): Promise<{ message: string }> => {
    try {
      return await request<{ message: string }>("/auth/logout", { method: "POST" }, token);
    } finally {
      clearStoredToken();
    }
  },

  health: async (): Promise<HealthResponse> => {
    return request<HealthResponse>("/health", { method: "GET" });
  },

  // ============================================================================
  // Admin User Management Endpoints
  // ============================================================================

  // Students
  adminGetStudents: async (
    params?: { search?: string; department?: string; year?: number; section?: string; is_active?: boolean; mentor_id?: string },
    token?: string | null
  ): Promise<AdminStudentItem[]> => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set("search", params.search);
    if (params?.department) searchParams.set("department", params.department);
    if (params?.year !== undefined) searchParams.set("year", params.year.toString());
    if (params?.section) searchParams.set("section", params.section);
    if (params?.is_active !== undefined) searchParams.set("is_active", params.is_active.toString());
    if (params?.mentor_id) searchParams.set("mentor_id", params.mentor_id);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return request<AdminStudentItem[]>(`/admin/students${query}`, { method: "GET" }, token);
  },

  adminGetStudent: async (studentId: string, token?: string | null): Promise<AdminStudentDetailResponse> => {
    return request<AdminStudentDetailResponse>(`/admin/students/${studentId}`, { method: "GET" }, token);
  },

  adminCreateStudent: async (data: AdminStudentCreate, token?: string | null): Promise<AdminStudentItem> => {
    return request<AdminStudentItem>("/admin/students", {
      method: "POST",
      body: JSON.stringify(data),
    }, token);
  },

  adminUpdateStudent: async (studentId: string, data: AdminStudentUpdate, token?: string | null): Promise<AdminStudentItem> => {
    return request<AdminStudentItem>(`/admin/students/${studentId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }, token);
  },

  adminUpdateStudentStatus: async (studentId: string, isActive: boolean, token?: string | null): Promise<AdminOperationResult> => {
    return request<AdminOperationResult>(`/admin/students/${studentId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: isActive }),
    }, token);
  },

  adminDeleteStudent: async (studentId: string, data: AdminStudentDeleteRequest, token?: string | null): Promise<AdminOperationResult> => {
    return request<AdminOperationResult>(`/admin/students/${studentId}/delete`, {
      method: "POST",
      body: JSON.stringify(data),
    }, token);
  },

  // Faculty Mentors
  adminGetMentors: async (
    params?: { search?: string; department?: string; is_active?: boolean },
    token?: string | null
  ): Promise<AdminMentorItem[]> => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set("search", params.search);
    if (params?.department) searchParams.set("department", params.department);
    if (params?.is_active !== undefined) searchParams.set("is_active", params.is_active.toString());
    const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return request<AdminMentorItem[]>(`/admin/mentors${query}`, { method: "GET" }, token);
  },

  adminGetMentor: async (mentorId: string, token?: string | null): Promise<AdminMentorDetailResponse> => {
    return request<AdminMentorDetailResponse>(`/admin/mentors/${mentorId}`, { method: "GET" }, token);
  },

  adminCreateMentor: async (data: AdminMentorCreate, token?: string | null): Promise<AdminMentorItem> => {
    return request<AdminMentorItem>("/admin/mentors", {
      method: "POST",
      body: JSON.stringify(data),
    }, token);
  },

  adminUpdateMentor: async (mentorId: string, data: AdminMentorUpdate, token?: string | null): Promise<AdminMentorItem> => {
    return request<AdminMentorItem>(`/admin/mentors/${mentorId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }, token);
  },

  adminUpdateMentorStatus: async (mentorId: string, isActive: boolean, token?: string | null): Promise<AdminOperationResult> => {
    return request<AdminOperationResult>(`/admin/mentors/${mentorId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: isActive }),
    }, token);
  },

  adminDeleteMentor: async (mentorId: string, data: AdminMentorDeleteRequest, token?: string | null): Promise<AdminOperationResult> => {
    return request<AdminOperationResult>(`/admin/mentors/${mentorId}/delete`, {
      method: "POST",
      body: JSON.stringify(data),
    }, token);
  },

  adminReassignMentorStudents: async (
    mentorId: string,
    targetMentorId: string,
    studentIds?: string[],
    token?: string | null
  ): Promise<AdminOperationResult> => {
    return request<AdminOperationResult>(`/admin/mentors/${mentorId}/reassign-students`, {
      method: "POST",
      body: JSON.stringify({ target_mentor_id: targetMentorId, student_ids: studentIds }),
    }, token);
  },

  // HOD
  adminGetHods: async (
    params?: { search?: string; department?: string; is_active?: boolean },
    token?: string | null
  ): Promise<AdminHODItem[]> => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set("search", params.search);
    if (params?.department) searchParams.set("department", params.department);
    if (params?.is_active !== undefined) searchParams.set("is_active", params.is_active.toString());
    const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return request<AdminHODItem[]>(`/admin/hods${query}`, { method: "GET" }, token);
  },

  adminGetHod: async (hodId: string, token?: string | null): Promise<AdminHODItem> => {
    return request<AdminHODItem>(`/admin/hods/${hodId}`, { method: "GET" }, token);
  },

  adminCreateHod: async (data: AdminHODCreate, token?: string | null): Promise<AdminHODItem> => {
    return request<AdminHODItem>("/admin/hods", {
      method: "POST",
      body: JSON.stringify(data),
    }, token);
  },

  adminUpdateHod: async (hodId: string, data: AdminHODUpdate, token?: string | null): Promise<AdminHODItem> => {
    return request<AdminHODItem>(`/admin/hods/${hodId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }, token);
  },

  adminUpdateHodStatus: async (hodId: string, isActive: boolean, token?: string | null): Promise<AdminOperationResult> => {
    return request<AdminOperationResult>(`/admin/hods/${hodId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: isActive }),
    }, token);
  },

  adminDeleteHod: async (hodId: string, data: AdminHODDeleteRequest, token?: string | null): Promise<AdminOperationResult> => {
    return request<AdminOperationResult>(`/admin/hods/${hodId}/delete`, {
      method: "POST",
      body: JSON.stringify(data),
    }, token);
  },

  // Drive Cleanup Retry
  adminRetryDriveCleanup: async (driveFileId: string, token?: string | null): Promise<AdminOperationResult> => {
    return request<AdminOperationResult>(`/admin/cleanup/drive-file/${driveFileId}`, {
      method: "POST",
    }, token);
  },

  // Password Management
  changePassword: async (data: ChangePasswordRequest, token?: string | null): Promise<UserResponse> => {
    return request<UserResponse>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify(data),
    }, token);
  },

  // Bulk Account Provisioning
  getProvisioningPreview: async (token?: string | null): Promise<ProvisioningPreviewResponse> => {
    return request<ProvisioningPreviewResponse>("/admin/provisioning/preview", {
      method: "GET",
    }, token);
  },

  executeProvisioning: async (data: ProvisioningExecuteRequest, token?: string | null): Promise<ProvisioningExecuteResponse> => {
    return request<ProvisioningExecuteResponse>("/admin/provisioning/execute", {
      method: "POST",
      body: JSON.stringify(data),
    }, token);
  },

  adminGetOverview: async (token?: string | null): Promise<AdminOverviewResponse> => {
    return request<AdminOverviewResponse>("/admin/overview", { method: "GET" }, token);
  },

  adminGetSubmissions: async (
    params?: { status?: string; search?: string; component_id?: string },
    token?: string | null
  ): Promise<AdminSubmissionItem[]> => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);
    if (params?.search) searchParams.set("search", params.search);
    if (params?.component_id) searchParams.set("component_id", params.component_id);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return request<AdminSubmissionItem[]>(`/admin/submissions${query}`, { method: "GET" }, token);
  },

  adminGetMentorAllocations: async (
    params?: { search?: string; mentor_id?: string; is_active?: boolean },
    token?: string | null
  ): Promise<AdminMentorAllocationItem[]> => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set("search", params.search);
    if (params?.mentor_id) searchParams.set("mentor_id", params.mentor_id);
    if (params?.is_active !== undefined) searchParams.set("is_active", params.is_active.toString());
    const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return request<AdminMentorAllocationItem[]>(`/admin/allocations${query}`, { method: "GET" }, token);
  },

  adminGetComponents: async (token?: string | null): Promise<AdminComponentItem[]> => {
    return request<AdminComponentItem[]>("/admin/components", { method: "GET" }, token);
  },

  adminGetDriveAudit: async (token?: string | null): Promise<DriveFolderAuditReport> => {
    return request<DriveFolderAuditReport>("/admin/drive/audit", { method: "GET" }, token);
  },

  adminProvisionDriveFolders: async (
    dryRun: boolean = true,
    token?: string | null
  ): Promise<DriveFolderProvisionResponse> => {
    return request<DriveFolderProvisionResponse>(
      `/admin/drive/provision-folders?dry_run=${dryRun}`,
      { method: "POST" },
      token
    );
  },

  deleteEvidenceFile: async (fileId: string, token?: string | null): Promise<{ detail: string; file_id: string }> => {
    return request<{ detail: string; file_id: string }>(`/files/${fileId}`, { method: "DELETE" }, token);
  },

  // ==========================================
  // SHARED MESSAGES & REMARKS ENDPOINTS
  // ==========================================
  getMessages: async (
    params?: {
      achievement_id?: string;
      student_id?: string;
      message_type?: MessageType;
      unread_only?: boolean;
      limit?: number;
      offset?: number;
    },
    token?: string | null
  ): Promise<MessageItem[]> => {
    const searchParams = new URLSearchParams();
    if (params?.achievement_id) searchParams.set("achievement_id", params.achievement_id);
    if (params?.student_id) searchParams.set("student_id", params.student_id);
    if (params?.message_type) searchParams.set("message_type", params.message_type);
    if (params?.unread_only) searchParams.set("unread_only", "true");
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.offset) searchParams.set("offset", params.offset.toString());
    const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return request<MessageItem[]>(`/messages${query}`, { method: "GET" }, token);
  },

  sendMessage: async (
    data: MessageCreateRequest,
    token?: string | null
  ): Promise<MessageItem> => {
    return request<MessageItem>("/messages", {
      method: "POST",
      body: JSON.stringify(data),
    }, token);
  },

  markMessageRead: async (
    messageId: string,
    token?: string | null
  ): Promise<MessageItem> => {
    return request<MessageItem>(`/messages/${messageId}/read`, {
      method: "PATCH",
    }, token);
  },

  markAllMessagesRead: async (
    payload: { achievement_id?: string; message_ids?: string[] },
    token?: string | null
  ): Promise<{ detail: string; count: number }> => {
    return request<{ detail: string; count: number }>("/messages/read-all", {
      method: "POST",
      body: JSON.stringify(payload),
    }, token);
  },

  getUnreadMessageCount: async (
    token?: string | null
  ): Promise<UnreadCountResponse> => {
    return request<UnreadCountResponse>("/messages/unread-count", {
      method: "GET",
    }, token);
  },

  // User Email Management
  adminUpdateUserEmail: async (
    userId: string,
    data: AdminEmailUpdateRequest,
    token?: string | null
  ): Promise<AdminEmailUpdateResponse> => {
    return request<AdminEmailUpdateResponse>(
      `/admin/users/${userId}/email`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
      token
    );
  },

  adminGetVerificationStatus: async (
    userId: string,
    token?: string | null
  ): Promise<AdminVerificationStatusResponse> => {
    return request<AdminVerificationStatusResponse>(
      `/admin/users/${userId}/verification-status`,
      { method: "GET" },
      token
    );
  },

  adminSendVerificationEmail: async (
    userId: string,
    token?: string | null
  ): Promise<AdminSendVerificationEmailResponse> => {
    return request<AdminSendVerificationEmailResponse>(
      `/admin/users/${userId}/send-verification-email`,
      { method: "POST" },
      token
    );
  },

  // Semester Management
  adminGetSemesters: async (
    token?: string | null
  ): Promise<SemesterResponse[]> => {
    return request<SemesterResponse[]>("/admin/semesters", { method: "GET" }, token);
  },

  adminUpdateSemesterStatus: async (
    semesterId: string,
    isEnabled: boolean,
    token?: string | null
  ): Promise<SemesterResponse> => {
    return request<SemesterResponse>(
      `/admin/semesters/${semesterId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ is_enabled: isEnabled }),
      },
      token
    );
  },

  adminGetSemesterDriveAudit: async (
    token?: string | null
  ): Promise<SemesterDriveAuditReport> => {
    return request<SemesterDriveAuditReport>(
      "/admin/semesters/drive-audit",
      { method: "GET" },
      token
    );
  },

  adminProvisionSemesterDriveFolders: async (
    dryRun: boolean = true,
    token?: string | null
  ): Promise<SemesterDriveProvisionResponse> => {
    return request<SemesterDriveProvisionResponse>(
      `/admin/semesters/provision-folders?dry_run=${dryRun}`,
      { method: "POST" },
      token
    );
  },

  studentGetSemesters: async (
    token?: string | null,
    forceRefresh: boolean = false
  ): Promise<SemesterResponse[]> => {
    if (cachedSemesters && !forceRefresh) {
      return cachedSemesters;
    }
    const res = await request<SemesterResponse[]>("/students/semesters", { method: "GET" }, token);
    cachedSemesters = res;
    return res;
  },

  // ============================================================================
  // PGPA Component Configuration & Semester Matrix (Admin)
  // ============================================================================

  adminUpdateComponent: async (
    componentId: string,
    data: {
      credit_value?: number;
      submission_mode?: string;
      grading_strategy?: string;
      requires_verification?: boolean;
      is_active?: boolean;
    },
    token?: string | null
  ): Promise<PGPAComponentResponse> => {
    return request<PGPAComponentResponse>(
      `/admin/components/${componentId}`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
      token
    );
  },

  adminGetComponentSemesters: async (
    componentId: string,
    token?: string | null
  ): Promise<ComponentSemesterConfigResponse[]> => {
    return request<ComponentSemesterConfigResponse[]>(
      `/admin/components/${componentId}/semesters`,
      { method: "GET" },
      token
    );
  },

  adminUpdateComponentSemester: async (
    componentId: string,
    semesterId: string,
    data: { is_enabled?: boolean; submission_deadline?: string | null },
    token?: string | null
  ): Promise<ComponentSemesterConfigResponse> => {
    return request<ComponentSemesterConfigResponse>(
      `/admin/components/${componentId}/semesters/${semesterId}`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
      token
    );
  },

  adminGetComponentSemesterMatrix: async (
    token?: string | null
  ): Promise<AdminSemesterMatrixResponse> => {
    return request<AdminSemesterMatrixResponse>(
      "/admin/components/semester-matrix",
      { method: "GET" },
      token
    );
  },

  // ============================================================================
  // HOD Excel Import & Component Results
  // ============================================================================

  hodGetEligibleComponents: async (
    semesterId?: string,
    token?: string | null
  ): Promise<PGPAComponentResponse[]> => {
    const query = semesterId ? `?semester_id=${encodeURIComponent(semesterId)}` : "";
    return request<PGPAComponentResponse[]>(`/hod/components${query}`, { method: "GET" }, token);
  },

  hodDownloadImportTemplate: async (
    componentId: string,
    semesterId: string,
    token?: string | null
  ): Promise<Blob> => {
    return requestBlob(
      `/hod/import/template?component_id=${encodeURIComponent(componentId)}&semester_id=${encodeURIComponent(semesterId)}`,
      { method: "GET" },
      token
    );
  },

  hodPreviewImport: async (
    formData: FormData,
    token?: string | null
  ): Promise<HODImportPreviewResponse> => {
    return request<HODImportPreviewResponse>(
      "/hod/import/preview",
      {
        method: "POST",
        body: formData,
      },
      token
    );
  },

  hodConfirmImport: async (
    previewToken: string,
    token?: string | null
  ): Promise<HODImportConfirmResult> => {
    return request<HODImportConfirmResult>(
      "/hod/import/confirm",
      {
        method: "POST",
        body: JSON.stringify({ preview_token: previewToken }),
      },
      token
    );
  },

  hodGetImportHistory: async (
    token?: string | null
  ): Promise<HODImportBatchItem[]> => {
    return request<HODImportBatchItem[]>("/hod/import/history", { method: "GET" }, token);
  },

  hodGetComponentResults: async (
    filters?: { student_id?: string; component_id?: string; semester_id?: string },
    token?: string | null
  ): Promise<StudentComponentResultItem[]> => {
    const params = new URLSearchParams();
    if (filters?.student_id) params.set("student_id", filters.student_id);
    if (filters?.component_id) params.set("component_id", filters.component_id);
    if (filters?.semester_id) params.set("semester_id", filters.semester_id);
    const query = params.toString() ? `?${params.toString()}` : "";
    return request<StudentComponentResultItem[]>(`/hod/results${query}`, { method: "GET" }, token);
  },

  hodCorrectComponentResult: async (
    resultId: string,
    data: {
      raw_score?: number;
      category?: string;
      grade?: string;
      notes?: string;
      reason: string;
    },
    token?: string | null
  ): Promise<StudentComponentResultItem> => {
    return request<StudentComponentResultItem>(
      `/hod/results/${resultId}`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
      token
    );
  },
};

export interface GoogleDriveAuthResponse {
  authorization_url: string;
  state: string;
  redirect_uri: string;
  scopes: string[];
  instruction?: string;
}

export interface HealthResponse {
  status: string;
  app_name: string;
  environment: string;
  storage?: {
    configured: boolean;
    connected: boolean;
    oauth_authorized?: boolean | null;
    authorized_email?: string | null;
    root_folder_id?: string | null;
    message: string;
    detail?: string | null;
  };
}
