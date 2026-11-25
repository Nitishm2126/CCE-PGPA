// ==============================================================================
// CCE Events & Forms API Client (Phase 1)
// ==============================================================================

import { API_BASE_URL, getStoredToken, ApiError } from "@/lib/api-client";
import {
  EventItem,
  EventCreateRequest,
  EventFormVersion,
  EventFormField,
  EventResponsesResponse,
  EventSubmissionItem,
  EventSubmissionRequest,
  EventTemplate,
} from "@/types/events";

import { STARTER_EVENT_TEMPLATES } from "@/lib/starter-templates-data";

export function resolveEventAssetUrl(
  urlOrRef?: string | null,
  token?: string | null,
  download = false
): string {
  if (!urlOrRef) return "";
  const raw = String(urlOrRef).trim();
  if (!raw) return "";
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;

  let resolved = raw;
  if (raw.startsWith("/api/v1/")) {
    resolved = `${API_BASE_URL}${raw.slice("/api/v1".length)}`;
  } else if (raw.startsWith("/")) {
    resolved = `${API_BASE_URL}${raw}`;
  } else {
    resolved = `${API_BASE_URL}/events/files/${encodeURIComponent(raw)}/content`;
  }

  const params: string[] = [];
  const authToken = token ?? getStoredToken();
  if (authToken && !resolved.includes("token=")) {
    params.push(`token=${encodeURIComponent(authToken)}`);
  }
  if (download && !resolved.includes("download=")) {
    params.push("download=1");
  }
  if (params.length > 0) {
    resolved += (resolved.includes("?") ? "&" : "?") + params.join("&");
  }
  return resolved;
}

const REQUEST_TIMEOUT_MS = 30000;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const authToken = getStoredToken();
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      signal: options.signal ?? controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === "AbortError") {
      throw new ApiError(
        "Request timed out while contacting the CCE Events service. Please check your connection and try again.",
        408
      );
    }
    throw new ApiError(
      `Network error connecting to CCE Events API (${url}). Please verify backend availability.`,
      0
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const text = await response.text();
      if (text) {
        try {
          const errorData = JSON.parse(text);
          if (errorData?.detail) {
            errorMessage =
              typeof errorData.detail === "string"
                ? errorData.detail
                : JSON.stringify(errorData.detail);
          } else if (errorData?.message) {
            errorMessage = String(errorData.message);
          }
        } catch {
          errorMessage = text.slice(0, 240);
        }
      }
    } catch {
      // Keep status fallback
    }
    if (response.status === 401 && !errorMessage.toLowerCase().includes("unauthorized")) {
      errorMessage = `Unauthorized: ${errorMessage}`;
    } else if (response.status === 403 && !errorMessage.toLowerCase().includes("forbidden")) {
      errorMessage = `Access denied: ${errorMessage}`;
    }
    throw new ApiError(errorMessage, response.status);
  }

  return (await response.json()) as T;
}

export const eventsApi = {
  // Admin & HOD Event Management
  listEvents: async (filters?: {
    status?: string;
    search?: string;
    semester_id?: string;
    academic_year?: string;
  }): Promise<{ events: EventItem[]; count: number }> => {
    const params = new URLSearchParams();
    if (filters?.status && filters.status !== "all") params.set("status", filters.status);
    if (filters?.search) params.set("search", filters.search);
    if (filters?.semester_id && filters.semester_id !== "all") params.set("semester_id", filters.semester_id);
    if (filters?.academic_year && filters.academic_year !== "all") params.set("academic_year", filters.academic_year);
    const qs = params.toString();
    return request<{ events: EventItem[]; count: number }>(`/events${qs ? `?${qs}` : ""}`);
  },

  getEvent: async (eventId: string): Promise<EventItem> => {
    return request<EventItem>(`/events/${eventId}`);
  },

  createEvent: async (data: EventCreateRequest): Promise<EventItem> => {
    return request<EventItem>("/events", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateEvent: async (eventId: string, data: Partial<EventCreateRequest>): Promise<EventItem> => {
    return request<EventItem>(`/events/${eventId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  deleteEvent: async (eventId: string): Promise<{ message: string }> => {
    return request<{ message: string }>(`/events/${eventId}`, {
      method: "DELETE",
    });
  },

  publishEvent: async (eventId: string): Promise<{ message: string; event: EventItem }> => {
    return request<{ message: string; event: EventItem }>(`/events/${eventId}/publish`, {
      method: "POST",
    });
  },

  closeEvent: async (eventId: string): Promise<{ message: string; event: EventItem }> => {
    return request<{ message: string; event: EventItem }>(`/events/${eventId}/close`, {
      method: "POST",
    });
  },

  reopenEvent: async (eventId: string): Promise<{ message: string; event: EventItem }> => {
    return request<{ message: string; event: EventItem }>(`/events/${eventId}/reopen`, {
      method: "POST",
    });
  },

  archiveEvent: async (eventId: string): Promise<{ message: string; event: EventItem }> => {
    return request<{ message: string; event: EventItem }>(`/events/${eventId}/archive`, {
      method: "POST",
    });
  },

  // Form Builder
  getEventForm: async (eventId: string): Promise<EventFormVersion> => {
    return request<EventFormVersion>(`/events/${eventId}/forms/current`);
  },

  saveEventForm: async (
    eventId: string,
    fields: Array<Partial<EventFormField>>,
    sections_config?: any[]
  ): Promise<{ message: string; form: EventFormVersion }> => {
    return request<{ message: string; form: EventFormVersion }>(`/events/${eventId}/forms`, {
      method: "POST",
      body: JSON.stringify({ fields, sections_config }),
    });
  },

  getEventFormVersions: async (eventId: string): Promise<{ versions: EventFormVersion[] }> => {
    return request<{ versions: EventFormVersion[] }>(`/events/${eventId}/forms/versions`);
  },

  getEventFormVersionById: async (eventId: string, versionId: string): Promise<EventFormVersion> => {
    return request<EventFormVersion>(`/events/${eventId}/forms/versions/${versionId}`);
  },

  // Responses Management
  getEventResponses: async (
    eventId: string,
    filters?: { search?: string; status?: string }
  ): Promise<EventResponsesResponse> => {
    const params = new URLSearchParams();
    if (filters?.search) params.set("search", filters.search);
    if (filters?.status && filters.status !== "all") params.set("status", filters.status);
    const qs = params.toString();
    return request<EventResponsesResponse>(`/events/${eventId}/responses${qs ? `?${qs}` : ""}`);
  },

  getSubmissionDetail: async (eventId: string, responseId: string): Promise<EventSubmissionItem> => {
    return request<EventSubmissionItem>(`/events/${eventId}/responses/${responseId}`);
  },

  // File Upload
  uploadEventFile: async (
    file: File,
    uploadOptions?: {
      eventId?: string;
      fieldKey?: string;
      uploadScope?: "event_media" | "notification_media" | "student_submission";
    }
  ): Promise<{
    file_id?: string;
    storage_reference: string;
    drive_file_id?: string;
    drive_folder_id?: string;
    original_filename: string;
    mime_type: string;
    file_size: number;
    file_url?: string;
    download_url?: string;
  }> => {
    const formData = new FormData();
    formData.append("file", file);
    if (uploadOptions?.eventId) formData.append("event_id", uploadOptions.eventId);
    if (uploadOptions?.fieldKey) formData.append("field_key", uploadOptions.fieldKey);
    if (uploadOptions?.uploadScope) formData.append("upload_scope", uploadOptions.uploadScope);
    return request<{
      file_id?: string;
      storage_reference: string;
      drive_file_id?: string;
      drive_folder_id?: string;
      original_filename: string;
      mime_type: string;
      file_size: number;
      file_url?: string;
      download_url?: string;
    }>("/events/upload", {
      method: "POST",
      body: formData,
    });
  },

  // Student Endpoints
  listStudentEvents: async (): Promise<{ events: EventItem[] }> => {
    return request<{ events: EventItem[] }>("/student/events");
  },

  getStudentEvent: async (eventId: string): Promise<EventItem> => {
    return request<EventItem>(`/student/events/${eventId}`);
  },

  getStudentEventForm: async (eventId: string): Promise<{ event: EventItem; form: EventFormVersion }> => {
    return request<{ event: EventItem; form: EventFormVersion }>(`/student/events/${eventId}/form`);
  },

  submitStudentEvent: async (
    eventId: string,
    data: EventSubmissionRequest
  ): Promise<{ message: string; submission: EventSubmissionItem }> => {
    return request<{ message: string; submission: EventSubmissionItem }>(`/student/events/${eventId}/submit`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  getStudentMySubmission: async (eventId: string): Promise<EventSubmissionItem> => {
    return request<EventSubmissionItem>(`/student/events/${eventId}/my-submission`);
  },

  // Templates Library (Phase 1.2 & Phase 2)
  listTemplates: async (filters?: {
    category?: string;
    search?: string;
  }): Promise<{ templates: EventTemplate[]; count: number }> => {
    const params = new URLSearchParams();
    if (filters?.category && filters.category !== "all") params.set("category", filters.category);
    if (filters?.search) params.set("search", filters.search);
    const qs = params.toString();
    try {
      const res = await request<{ templates: EventTemplate[]; count: number }>(`/events/templates${qs ? `?${qs}` : ""}`);
      if (res && Array.isArray(res.templates) && res.templates.length > 0) {
        return res;
      }
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        throw err;
      }
      console.warn("Backend templates API unreachable, utilizing built-in starter templates:", err);
    }

    // High-reliability local fallback: 5 professional starter templates
    let list = [...STARTER_EVENT_TEMPLATES];
    if (filters?.category && filters.category !== "all") {
      list = list.filter((t) => t.category.toLowerCase() === filters.category?.toLowerCase());
    }
    if (filters?.search) {
      const s = filters.search.toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(s) ||
          t.description.toLowerCase().includes(s) ||
          t.purpose.toLowerCase().includes(s)
      );
    }
    return { templates: list, count: list.length };
  },

  getTemplate: async (templateId: string): Promise<EventTemplate> => {
    try {
      return await request<EventTemplate>(`/events/templates/${templateId}`);
    } catch (err) {
      const match = STARTER_EVENT_TEMPLATES.find((t) => t.id === templateId);
      if (match) return match;
      throw err;
    }
  },

  saveCustomTemplate: async (data: Partial<EventTemplate>): Promise<EventTemplate> => {
    return request<EventTemplate>("/events/templates", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  deleteCustomTemplate: async (templateId: string): Promise<{ message: string }> => {
    return request<{ message: string }>(`/events/templates/${templateId}`, {
      method: "DELETE",
    });
  },
};
