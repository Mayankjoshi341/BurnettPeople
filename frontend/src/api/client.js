const configuredBaseUrl = import.meta.env?.VITE_API_BASE_URL;
const API_BASE_URL = (configuredBaseUrl || "http://localhost:8000/api").replace(/\/+$/, "");
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Tokens intentionally live only in memory. Refreshing the browser starts a new
// session and requires login again; tokens are never written to localStorage.
let accessToken = null;
let refreshToken = null;
let refreshPromise = null;
let sessionExpiredHandler = null;

export class ApiError extends Error {
  constructor(message, { status = 0, data = null, fieldErrors = {} } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    this.fieldErrors = fieldErrors;
  }
}

function buildUrl(endpoint) {
  return `${API_BASE_URL}/${String(endpoint || "").replace(/^\/+/, "")}`;
}

function extractMessages(value) {
  if (typeof value === "string" && value.trim()) return [value.trim()];
  if (Array.isArray(value)) return value.flatMap(extractMessages);
  if (value && typeof value === "object") {
    return Object.entries(value)
      .filter(([key]) => key !== "detail" && key !== "code")
      .flatMap(([key, item]) => extractMessages(item).map((message) => `${key}: ${message}`));
  }
  return [];
}

function getFieldErrors(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  return Object.fromEntries(
    Object.entries(data)
      .filter(([key]) => !["detail", "code", "non_field_errors"].includes(key))
      .map(([key, value]) => [key, extractMessages(value)])
      .filter(([, messages]) => messages.length > 0),
  );
}

function statusMessage(status) {
  const messages = {
    400: "Please check the submitted fields and try again.",
    401: "Your session or credentials are invalid. Please sign in again.",
    403: "You do not have permission to perform this action.",
    404: "The requested record or endpoint was not found.",
    409: "This request conflicts with the current record. Refresh and try again.",
    429: "Too many requests. Please wait a moment and try again.",
    500: "The server encountered an error. Please try again later.",
  };
  return messages[status] || (status >= 500
    ? "A server error occurred. Please try again later."
    : `Request failed (${status}).`);
}

function makeApiError(status, data, overrideMessage) {
  const detail = data?.detail;
  let message = overrideMessage || statusMessage(status);
  if (!overrideMessage && status < 500 && typeof detail === "string" && detail.trim()) {
    message = detail.trim();
  } else if (!overrideMessage && status < 500 && Array.isArray(detail)) {
    message = extractMessages(detail).join(" ") || message;
  }

  const nonFieldErrors = data?.non_field_errors;
  if (!overrideMessage && status < 500 && nonFieldErrors) {
    message = extractMessages(nonFieldErrors).join(" ") || message;
  }

  return new ApiError(message, {
    status,
    data,
    fieldErrors: getFieldErrors(data),
  });
}

async function readResponse(response) {
  if (response.status === 204 || response.status === 205) return null;
  const raw = await response.text();
  if (!raw) return null;

  const contentType = response.headers?.get?.("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(raw);
    } catch {
      return { detail: "The server returned invalid JSON." };
    }
  }
  return raw;
}

function notifySessionExpired() {
  accessToken = null;
  refreshToken = null;
  if (typeof sessionExpiredHandler === "function") sessionExpiredHandler();
}

async function refreshSession() {
  if (refreshPromise) return refreshPromise;

  const oldRefreshToken = refreshToken;
  if (!oldRefreshToken) {
    notifySessionExpired();
    throw new ApiError("Your session has expired. Please sign in again.", { status: 401 });
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(buildUrl("/auth/token/refresh/"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ refresh: oldRefreshToken }),
      });
      const data = await readResponse(response);

      if (!response.ok || !data?.access) {
        throw makeApiError(response.status || 401, data, "Your session has expired. Please sign in again.");
      }

      // ROTATE_REFRESH_TOKENS is enabled in Django. Save the newly returned
      // refresh token so that the blacklisted old token is never reused.
      accessToken = data.access;
      refreshToken = data.refresh || oldRefreshToken;
      return true;
    } catch (error) {
      notifySessionExpired();
      if (error instanceof ApiError) throw error;
      throw new ApiError("Could not refresh your session. Please sign in again.", { status: 401 });
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function headersFor(options, useAuth) {
  const headers = new Headers(options.headers || {});
  if (options.body !== undefined || options.bodyFactory) {
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  }
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (useAuth && accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  else headers.delete("Authorization");
  return headers;
}

async function send(endpoint, method, rawOptions = {}) {
  const {
    auth = true,
    skipRefresh = false,
    retryAfterRefresh = false,
    bodyFactory,
    ...fetchOptions
  } = rawOptions;
  const url = buildUrl(endpoint);
  const normalizedMethod = method.toUpperCase();
  const requestAccessToken = accessToken;
  const runFetch = () => fetch(url, {
    ...fetchOptions,
    method: normalizedMethod,
    headers: headersFor({ ...fetchOptions, bodyFactory }, auth),
    ...(bodyFactory ? { body: bodyFactory() } : {}),
  });

  let response = await runFetch();
  const isAuthEndpoint = String(endpoint).includes("/auth/token/") || String(endpoint).includes("/auth/password-reset/") || String(endpoint).includes("/auth/activate/");

  if (
    response.status === 401 && auth && !skipRefresh && !isAuthEndpoint &&
    (requestAccessToken || accessToken) && refreshToken
  ) {
    // If another request already rotated the token, reuse that new access token.
    if (accessToken === requestAccessToken) await refreshSession();
    if (SAFE_METHODS.has(normalizedMethod) || retryAfterRefresh) {
      response = await runFetch();
      if (response.status === 401) notifySessionExpired();
    } else {
      // The server rejected the request before processing it. Refresh the session,
      // but never replay POST/PATCH/DELETE automatically (duplicate HR actions).
      const originalData = await readResponse(response);
      throw makeApiError(
        401,
        originalData,
        "Your session was refreshed. Please submit this action again to avoid duplicate changes.",
      );
    }
  }

  const data = await readResponse(response);
  if (!response.ok) throw makeApiError(response.status, data);
  return data;
}

const apiClient = {
  setSessionTokens(tokens) {
    accessToken = tokens?.access || null;
    refreshToken = tokens?.refresh || null;
  },

  clearSession() {
    accessToken = null;
    refreshToken = null;
  },

  getAccessToken() {
    return accessToken;
  },

  getRefreshToken() {
    return refreshToken;
  },

  setSessionExpiredHandler(handler) {
    sessionExpiredHandler = typeof handler === "function" ? handler : null;
  },

  get(endpoint, options = {}) {
    return send(endpoint, "GET", options);
  },

  post(endpoint, body, options = {}) {
    return send(endpoint, "POST", {
      ...options,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  },

  put(endpoint, body, options = {}) {
    return send(endpoint, "PUT", {
      ...options,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  },

  patch(endpoint, body, options = {}) {
    return send(endpoint, "PATCH", {
      ...options,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  },

  delete(endpoint, options = {}) {
    return send(endpoint, "DELETE", options);
  },

  // The logout action is safe to retry only after an initial 401 because Django
  // authenticates the access token before blacklisting the refresh token. The
  // body factory uses the newly rotated refresh token on that one retry.
  logout() {
    return send("/auth/logout/", "POST", {
      retryAfterRefresh: true,
      bodyFactory: () => JSON.stringify({ refresh: refreshToken }),
    });
  },
};

export default apiClient;
