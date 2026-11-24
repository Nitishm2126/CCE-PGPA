// ==============================================================================
// CCE Student Notifications API Client (Phase 2)
// ==============================================================================

import { API_BASE_URL, getStoredToken, ApiError } from "@/lib/api-client";
import {
  NotificationItem,
  NotificationCreateRequest,
  StudentNotificationItem,
} from "@/types/notifications";

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

export const notificationsApi = {
  // Admin & HOD Operations
  listNotifications: async (filters?: {
    status?: string;
    category?: string;
    priority?: string;
    search?: string;
    limit?: number;
  }): Promise<{ notifications: NotificationItem[]; count: number }> => {
    const params = new URLSearchParams();
    if (filters?.status && filters.status !== "all") params.set("status", filters.status);
    if (filters?.category && filters.category !== "all") params.set("category", filters.category);
    if (filters?.priority && filters.priority !== "all") params.set("priority", filters.priority);
    if (filters?.search) params.set("search", filters.search);
    if (filters?.limit) params.set("limit", String(filters.limit));
    const qs = params.toString();
    return request<{ notifications: NotificationItem[]; count: number }>(`/notifications${qs ? `?${qs}` : ""}`);
  },

  getNotification: async (id: string): Promise<NotificationItem> => {
    return request<NotificationItem>(`/notifications/${id}`);
  },

  createNotification: async (data: NotificationCreateRequest): Promise<NotificationItem> => {
    return request<NotificationItem>("/notifications", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateNotification: async (id: string, data: Partial<NotificationCreateRequest>): Promise<NotificationItem> => {
    return request<NotificationItem>(`/notifications/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  changeStatus: async (id: string, newStatus: string): Promise<any> => {
    if (newStatus === "published") return notificationsApi.publishNotification(id);
    if (newStatus === "paused") return notificationsApi.pauseNotification(id);
    if (newStatus === "archived") return notificationsApi.archiveNotification(id);
    return notificationsApi.updateNotification(id, { status: newStatus as any });
  },

  publishNotification: async (id: string): Promise<{ message: string; notification: NotificationItem }> => {
    return request<{ message: string; notification: NotificationItem }>(`/notifications/${id}/publish`, {
      method: "POST",
    });
  },

  pauseNotification: async (id: string): Promise<{ message: string; notification: NotificationItem }> => {
    return request<{ message: string; notification: NotificationItem }>(`/notifications/${id}/pause`, {
      method: "POST",
    });
  },

  resumeNotification: async (id: string): Promise<{ message: string; notification: NotificationItem }> => {
    return request<{ message: string; notification: NotificationItem }>(`/notifications/${id}/resume`, {
      method: "POST",
    });
  },

  archiveNotification: async (id: string): Promise<{ message: string; notification: NotificationItem }> => {
    return request<{ message: string; notification: NotificationItem }>(`/notifications/${id}/archive`, {
      method: "POST",
    });
  },

  deleteNotification: async (id: string): Promise<{ action: string; message: string }> => {
    return request<{ action: string; message: string }>(`/notifications/${id}`, {
      method: "DELETE",
    });
  },

  // Student In-App Interface
  listStudentNotifications: async (filters?: {
    unread_only?: boolean;
    limit?: number;
  }): Promise<{ notifications: StudentNotificationItem[]; count: number; unread_count?: number }> => {
    const params = new URLSearchParams();
    if (filters?.unread_only) params.set("unread_only", "true");
    if (filters?.limit) params.set("limit", String(filters.limit));
    const qs = params.toString();
    return request<{ notifications: StudentNotificationItem[]; count: number; unread_count?: number }>(
      `/student/notifications${qs ? `?${qs}` : ""}`
    );
  },

  getStudentUnreadCount: async (): Promise<{ unread_count: number }> => {
    return request<{ unread_count: number }>("/student/notifications/unread-count");
  },

  markAsRead: async (id: string): Promise<{ message: string }> => {
    return request<{ message: string }>(`/student/notifications/${id}/read`, {
      method: "POST",
    });
  },

  markAllAsRead: async (): Promise<{ message: string }> => {
    return request<{ message: string }>("/student/notifications/read-all", {
      method: "POST",
    });
  },

  dismissNotification: async (id: string): Promise<{ message: string }> => {
    return request<{ message: string }>(`/student/notifications/${id}/dismiss`, {
      method: "POST",
    });
  },

  recordClick: async (id: string): Promise<{ message: string }> => {
    return request<{ message: string }>(`/student/notifications/${id}/click`, {
      method: "POST",
    });
  },
};
