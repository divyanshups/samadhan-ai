export const token = () => sessionStorage.getItem("samadhan.session") || "";
export async function api(path, options = {}) {
  const response = await fetch("/api" + path, {
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(token() ? { Authorization: "Bearer " + token() } : {}),
      ...options.headers,
    },
  });
  if (options.blob && response.ok) return response.blob();
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof data.detail === "string"
        ? data.detail
        : "Please check the information and try again.";
    throw new Error(message);
  }
  return data;
}
export const post = (path, body = {}) =>
  api(path, { method: "POST", body: JSON.stringify(body) });
export const put = (path, body) =>
  api(path, { method: "PUT", body: JSON.stringify(body) });
export const patch = (path, body) =>
  api(path, { method: "PATCH", body: JSON.stringify(body) });
export const remove = (path) => api(path, { method: "DELETE" });
export const date = (value, lang = "en", time = false) =>
  value
    ? new Date(value).toLocaleString(lang === "hi" ? "hi-IN" : "en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        ...(time ? { hour: "2-digit", minute: "2-digit" } : {}),
      })
    : "—";
