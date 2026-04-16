/**
 * Helper to get Authorization headers with fallback session ID
 * This handles cases where session cookies are blocked (ngrok/third-party cookie issues)
 */
export function getAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Get sessionId from sessionStorage (set by auth popup)
  const sessionId = typeof window !== "undefined" 
    ? sessionStorage.getItem("ana_session_id")
    : null;

  if (sessionId) {
    headers["Authorization"] = `Bearer ${sessionId}`;
    headers["x-ana-session-id"] = sessionId;
  }

  return headers;
}

/**
 * Fetch wrapper that automatically includes auth headers and credentials
 * Handles both cookie-based and token-based auth
 */
export function fetchWithAuth(
  url: string | URL,
  options?: RequestInit,
): Promise<Response> {
  const authHeaders = getAuthHeaders();
  const mergedHeaders = {
    ...authHeaders,
    ...options?.headers,
  };

  return fetch(url, {
    ...options,
    credentials: "include",  // Always include credentials for cookie auth
    headers: mergedHeaders,
  });
}
