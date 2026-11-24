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

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData.detail) {
        errorMessage = typeof errorData.detail === "string" ? errorData.detail : JSON.stringify(errorData.detail);
      }
    } catch {
      // Use fallback
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
  uploadEventFile: async (file: File): Promise<{
    storage_reference: string;
    original_filename: string;
    mime_type: string;
    file_size: number;
    file_url?: string;
    download_url?: string;
  }> => {
    const formData = new FormData();
    formData.append("file", file);
    return request<{
      storage_reference: string;
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

  // Templates Library (Phase 1.2)
  listTemplates: async (filters?: {
    category?: string;
    search?: string;
  }): Promise<{ templates: EventTemplate[]; count: number }> => {
    const params = new URLSearchParams();
    if (filters?.category && filters.category !== "all") params.set("category", filters.category);
    if (filters?.search) params.set("search", filters.search);
    const qs = params.toString();
    return request<{ templates: EventTemplate[]; count: number }>(`/events/templates${qs ? `?${qs}` : ""}`);
  },

  getTemplate: async (templateId: string): Promise<EventTemplate> => {
    return request<EventTemplate>(`/events/templates/${templateId}`);
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
