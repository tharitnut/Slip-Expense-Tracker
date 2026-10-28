const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const TOKEN_KEY = "slip_access_token";

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // localStorage might be blocked or full
  }
}

export function removeToken(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | undefined | null>;
}

export async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { params, headers: customHeaders, ...rest } = options;

  let url = `${API_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        searchParams.append(key, String(value));
      }
    });
    const qs = searchParams.toString();
    if (qs) {
      url += (url.includes("?") ? "&" : "?") + qs;
    }
  }

  const headers = new Headers(customHeaders);
  const token = getToken();

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!headers.has("Content-Type") && !(rest.body instanceof FormData) && !(rest.body instanceof URLSearchParams)) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      headers,
    });
  } catch (err: unknown) {
    throw new ApiError(0, "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาตรวจสอบอินเทอร์เน็ตหรือสถานะเซิร์ฟเวอร์", err);
  }

  if (response.status === 401) {
    removeToken();
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login") && !window.location.pathname.startsWith("/register")) {
      window.location.href = "/login";
    }
    throw new ApiError(401, "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
  }

  if (response.status === 204) {
    return null as unknown as T;
  }

  let responseData: unknown = null;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      responseData = await response.json();
    } catch {
      responseData = null;
    }
  } else {
    try {
      responseData = await response.text();
    } catch {
      responseData = null;
    }
  }

  if (!response.ok) {
    let errorMessage = `เกิดข้อผิดพลาด (${response.status})`;
    if (responseData && typeof responseData === "object" && "detail" in responseData) {
      const detail = (responseData as { detail: unknown }).detail;
      if (typeof detail === "string") {
        errorMessage = detail;
      } else if (Array.isArray(detail)) {
        errorMessage = detail.map((d: { msg?: string; loc?: string[] }) => d.msg || JSON.stringify(d)).join(", ");
      }
    }
    throw new ApiError(response.status, errorMessage, responseData);
  }

  return responseData as T;
}

export const api = {
  get: <T>(url: string, params?: FetchOptions["params"]) => apiFetch<T>(url, { method: "GET", params }),
  post: <T>(url: string, body?: unknown, options?: FetchOptions) =>
    apiFetch<T>(url, {
      method: "POST",
      body: body instanceof FormData || body instanceof URLSearchParams ? body : JSON.stringify(body),
      ...options,
    }),
  patch: <T>(url: string, body?: unknown, options?: FetchOptions) =>
    apiFetch<T>(url, {
      method: "PATCH",
      body: JSON.stringify(body),
      ...options,
    }),
  delete: <T>(url: string, options?: FetchOptions) => apiFetch<T>(url, { method: "DELETE", ...options }),
};

