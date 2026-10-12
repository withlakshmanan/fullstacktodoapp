const apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const TOKEN_KEY = "todo_token";

export function api(path, options) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = { "Content-Type": "application/json", ...options?.headers };
  if (token) headers.Authorization = `Bearer ${token}`;

  return fetch(`${apiBase}${path}`, {
    ...options,
    headers,
  });
}
