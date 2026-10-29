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

  if (!headers.has("Content-Type")) {
    if (rest.body instanceof URLSearchParams) {
      headers.set("Content-Type", "application/x-www-form-urlencoded");
    } else if (!(rest.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      headers,
    });
  } catch (err: unknown) {
    throw new ApiError(0, "Unable to connect to the server. Please check your internet or server status.", err);
  }

  if (response.status === 401) {
    removeToken();
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login") && !window.location.pathname.startsWith("/register")) {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login";
    }
    throw new ApiError(401, "Session expired. Please sign in again.");
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
    let errorMessage = `Request failed (${response.status})`;
    if (responseData && typeof responseData === "object" && "detail" in responseData) {
      const detail = (responseData as { detail: unknown }).detail;
      if (typeof detail === "string") {
        if (detail === "Incorrect email or password") {
          errorMessage = "Incorrect email or password";
        } else if (detail === "Email already registered") {
          errorMessage = "This email is already registered";
        } else if (detail === "Category already exists") {
          errorMessage = "Category already exists";
        } else if (detail === "Category not found") {
          errorMessage = "Category not found";
        } else if (detail === "Transaction not found") {
          errorMessage = "Transaction not found";
        } else if (detail === "Duplicate transaction: slip reference already recorded") {
          errorMessage = "This slip has already been recorded";
        } else if (detail.includes("Duplicate transaction")) {
          errorMessage = "Duplicate transaction already exists";
        } else {
          errorMessage = detail;
        }
      } else if (Array.isArray(detail)) {
        errorMessage = detail
          .map((d: { msg?: string; loc?: string[] }) => {
            const field = d.loc ? d.loc[d.loc.length - 1] : "";
            if (field === "password") return "Password must be 8-72 characters";
            if (field === "email") return "Please enter a valid email address";
            if (field === "amount") return "Amount must be greater than 0 with at most 2 decimal places";
            if (field === "occurred_at") return "Transaction date cannot be in the future";
            return d.msg || JSON.stringify(d);
          })
          .join(", ");
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
