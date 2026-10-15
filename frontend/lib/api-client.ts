import { TokenResponse, UserResponse, StudentDetailResponse } from "@/types/auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

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
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const authToken = token !== undefined ? token : getStoredToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch {
    throw new ApiError(
      "Unable to connect to CCE Achieve backend service. Please check your network connection.",
      0
    );
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

  return response.json() as Promise<T>;
}

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

  logout: async (token?: string | null): Promise<{ message: string }> => {
    try {
      return await request<{ message: string }>("/auth/logout", { method: "POST" }, token);
    } finally {
      clearStoredToken();
    }
  },

  health: async (): Promise<{ status: string; app_name: string }> => {
    return request<{ status: string; app_name: string }>("/health", { method: "GET" });
  },
};
