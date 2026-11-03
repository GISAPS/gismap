// The one place GISMap Online talks to the GISMap SI API. Every call gets a
// timeout, the bearer token (when signed in), one silent refresh on 401, and
// errors mapped to a user-facing message from SI's `issues[].message` or
// FastAPI's `detail` (a string, or a list of `{ msg }`).
// Anonymous viewing never depends on this module.
export const SI_API_ORIGINS = ["https://api.gismap.si", "https://api.staging.gismap.si"];
export const SI_API_BASE = "https://api.gismap.si/api/v1";
const DEFAULT_TIMEOUT_MS = 10000;

const STATUS_MESSAGES = {
  401: "Signed out. Sign in to keep saving.",
  402: "Your plan doesn't include this. Upgrade in GISMap SI.",
  409: "This map changed somewhere else. Reload it before saving.",
  410: "This map was deleted in GISMap SI.",
  422: "GISMap SI couldn't accept this.",
  428: "Reload the map before saving.",
};

export class SiError extends Error {
  constructor(message, { status = 0, code = "si_error", issues = [] } = {}) {
    super(message);
    this.name = "SiError";
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

export function apiBase(override = "") {
  if (!override) return SI_API_BASE;
  const url = new URL(override);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (!local && !SI_API_ORIGINS.includes(url.origin)) throw new SiError("Unknown GISMap SI address.", { code: "bad_origin" });
  return `${url.origin}/api/v1`;
}

export async function toSiError(response) {
  let body = null;
  try { body = await response.json(); } catch { /* not JSON */ }
  const issues = Array.isArray(body?.issues) ? body.issues : [];
  const details = typeof body?.detail === "string" ? [body.detail] : Array.isArray(body?.detail) ? body.detail.map((item) => item?.msg) : [];
  const detail = [...issues.map((issue) => issue?.message), ...details].filter((text) => typeof text === "string" && text).join(" ");
  const message = detail || STATUS_MESSAGES[response.status] || `GISMap SI returned ${response.status}.`;
  return new SiError(message, { status: response.status, code: body?.code || `http_${response.status}`, issues });
}

// getToken() returns the in-memory access token or "". refresh() returns a new
// token or "" (signed out). Neither is ever written to a URL or the console.
export function createSiClient({ base = SI_API_BASE, fetchImpl = globalThis.fetch, getToken = () => "", refresh = async () => "", timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  let capabilities = null;

  async function send(method, path, { body, headers = {}, auth = true, signal } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    signal?.addEventListener("abort", () => controller.abort(), { once: true });
    const token = auth ? getToken() : "";
    const init = {
      method,
      headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      credentials: "omit",
    };
    try {
      return await fetchImpl(`${base}${path}`, init);
    } catch (error) {
      if (controller.signal.aborted) throw new SiError("GISMap SI didn't answer in time.", { code: "timeout" });
      throw new SiError("Can't reach GISMap SI right now.", { code: "network" });
    } finally {
      clearTimeout(timer);
    }
  }

  async function request(method, path, options = {}) {
    let response = await send(method, path, options);
    if (response.status === 401 && options.auth !== false && getToken()) {
      if (await refresh()) response = await send(method, path, options);
    }
    if (!response.ok) throw await toSiError(response);
    if (response.status === 204) return { data: null, etag: response.headers.get("ETag") };
    return { data: await response.json(), etag: response.headers.get("ETag") };
  }

  return {
    request,
    get: (path, options) => request("GET", path, options),
    post: (path, body, options) => request("POST", path, { ...options, body }),
    put: (path, body, options) => request("PUT", path, { ...options, body }),
    async capabilities() {
      if (!capabilities) capabilities = (await request("GET", "/capabilities", { auth: false })).data || {};
      return capabilities;
    },
  };
}
