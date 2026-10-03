const apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export function api(path, options) {
  return fetch(`${apiBase}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
}
