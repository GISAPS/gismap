import { loadArcGISRuntime } from "./arcgis-loader.js?v=0.38.0";

const STORAGE_KEY = "gismap-online:arcgis-connections:v1";

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `connection-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function cleanUrl(value, label) {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    throw new Error(`${label} must be a complete URL.`);
  }
  const isLocalDevelopment = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocalDevelopment)) {
    throw new Error(`${label} must use HTTPS (HTTP is allowed only for local development).`);
  }
  url.search = "";
  url.hash = "";
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url;
}

function normalizePortalUrl(value) {
  const url = cleanUrl(value, "Portal URL");
  url.pathname = url.pathname
    .replace(/\/(?:home|sharing(?:\/rest)?)$/i, "")
    .replace(/\/+$/, "");
  return url.href.replace(/\/$/, "");
}

function normalizeServerUrl(value) {
  const url = cleanUrl(value, "ArcGIS Server URL");
  url.pathname = url.pathname.replace(/\/rest(?:\/services(?:\/.*)?)?$/i, "").replace(/\/+$/, "");
  return url.href.replace(/\/$/, "");
}

function normalizeTokenServiceUrl(value, serverUrl) {
  const url = cleanUrl(value || `${serverUrl}/tokens/generateToken`, "Token service URL");
  if (/\/tokens$/i.test(url.pathname)) url.pathname += "/generateToken";
  return url.href.replace(/\/$/, "");
}

function serverRootFromResource(value) {
  const url = cleanUrl(value, "Service URL");
  const restIndex = url.pathname.toLowerCase().indexOf("/rest/");
  if (restIndex < 0) return normalizeServerUrl(url.href);
  url.pathname = url.pathname.slice(0, restIndex);
  return url.href.replace(/\/$/, "");
}

function portalLoginMode(value) {
  return value === "redirect" ? "redirect" : "popup";
}

function serverAuthMode(value) {
  return value === "web-tier" ? "web-tier" : "token";
}

function publicCredentialSummary(credential) {
  return {
    signedIn: true,
    userId: credential?.userId || null,
    expires: Number.isFinite(credential?.expires) ? credential.expires : null,
  };
}

/**
 * Registers ArcGIS identity metadata and delegates credentials entirely to the
 * ArcGIS Maps SDK IdentityManager. Tokens, passwords, and client secrets never
 * enter GISMap Online project serialization or local settings.
 */
export class AuthController {
  constructor(events) {
    this.events = events;
    this.connections = [];
    this.oauthInfos = new Map();
    this.serverInfos = new Map();
    this.discoveredServers = new Map();
  }

  /**
   * Reads the saved connections. With `runtime: false` (another map engine is
   * drawing) the ArcGIS identity runtime loads only when a connection is used.
   */
  async initialize({ runtime = true } = {}) {
    this.connections = this.#readStore();
    if (runtime) await this.#runtime();
    this.events.publish("auth:ready", { connections: this.list() });
  }

  async #runtime() {
    if (this.identityManager) return;
    await loadArcGISRuntime();
    const [identityManager, OAuthInfo, ServerInfo] = await $arcgis.import([
      "@arcgis/core/identity/IdentityManager.js",
      "@arcgis/core/identity/OAuthInfo.js",
      "@arcgis/core/identity/ServerInfo.js",
    ]);
    Object.assign(this, { identityManager, OAuthInfo, ServerInfo });
    this.connections.forEach((connection) => this.#register(connection));
  }

  list() {
    return structuredClone(this.connections);
  }

  getCallbackUrl() {
    return new URL("oauth-callback.html", document.baseURI).href;
  }

  getRedirectUrl() {
    const url = new URL(document.baseURI);
    url.hash = "";
    url.search = "";
    return url.href;
  }

  addPortal({ name, portalUrl, clientId, loginMode = "popup" }) {
    const normalizedUrl = normalizePortalUrl(portalUrl);
    const normalizedClientId = String(clientId || "").trim();
    if (!normalizedClientId) throw new Error("A Portal application Client ID is required.");

    const existing = this.connections.find(
      (item) => item.type === "portal" && item.portalUrl === normalizedUrl && item.clientId === normalizedClientId,
    );
    const connection = {
      id: existing?.id || makeId(),
      type: "portal",
      name: String(name || "").trim() || (normalizedUrl === "https://www.arcgis.com" ? "ArcGIS Online" : new URL(normalizedUrl).hostname),
      portalUrl: normalizedUrl,
      clientId: normalizedClientId,
      loginMode: portalLoginMode(loginMode),
    };
    this.#upsert(connection);
    return structuredClone(connection);
  }

  addServer({ name, serverUrl, tokenServiceUrl, authMode = "token" }) {
    const normalizedUrl = normalizeServerUrl(serverUrl);
    const normalizedAuthMode = serverAuthMode(authMode);
    const connection = {
      id: this.connections.find((item) => item.type === "server" && item.serverUrl === normalizedUrl)?.id || makeId(),
      type: "server",
      name: String(name || "").trim() || new URL(normalizedUrl).hostname,
      serverUrl: normalizedUrl,
      authMode: normalizedAuthMode,
      tokenServiceUrl: normalizedAuthMode === "token"
        ? normalizeTokenServiceUrl(tokenServiceUrl, normalizedUrl)
        : null,
    };
    this.#upsert(connection);
    return structuredClone(connection);
  }

  async connect(id) {
    const connection = this.#find(id);
    if (connection.type === "server" && connection.authMode === "web-tier") {
      const report = await this.inspectServer(connection.serverUrl, "web-tier");
      const status = { signedIn: true, userId: "Browser session", expires: null };
      this.events.publish("auth:status-changed", { connection: structuredClone(connection), status, report });
      return status;
    }
    await this.#runtime();
    const resource = this.#resourceUrl(connection);
    const options = connection.type === "portal" ? { oAuthPopupConfirmation: false } : undefined;
    const credential = await this.identityManager.getCredential(resource, options);
    const status = publicCredentialSummary(credential);
    this.events.publish("auth:status-changed", { connection: structuredClone(connection), status });
    return status;
  }

  async testConnection(id) {
    const connection = this.#find(id);
    return connection.type === "portal"
      ? this.inspectPortal(connection.portalUrl)
      : this.inspectServer(connection.serverUrl, connection.authMode);
  }

  async inspectPortal(value) {
    const portalUrl = normalizePortalUrl(value);
    const started = performance.now();
    const info = await this.#fetchJson(`${portalUrl}/sharing/rest/info?f=json`);
    const portal = await this.#fetchJson(`${portalUrl}/sharing/rest/portals/self?f=json`);
    return {
      kind: "portal",
      url: portalUrl,
      cors: true,
      responseMs: Math.round(performance.now() - started),
      version: info.currentVersion || portal.currentVersion || null,
      organization: portal.name || portal.portalName || null,
      authentication: info.authInfo?.supportsOAuth === false ? "Portal token authentication" : "OAuth 2.0 / PKCE",
      tokenServiceUrl: info.authInfo?.tokenServicesUrl || `${portalUrl}/sharing/rest/generateToken`,
      supportsOAuth: info.authInfo?.supportsOAuth !== false,
      federated: null,
    };
  }

  async inspectServer(value, configuredMode = null) {
    const serverUrl = serverRootFromResource(value);
    const started = performance.now();
    const info = await this.#fetchJson(`${serverUrl}/rest/info?f=json`, {
      credentials: configuredMode === "web-tier" ? "include" : "same-origin",
    });
    const owningSystemUrl = info.owningSystemUrl ? normalizePortalUrl(info.owningSystemUrl) : null;
    const tokenServiceUrl = info.authInfo?.tokenServicesUrl || null;
    const webTier = configuredMode === "web-tier" || info.authInfo?.isTokenBasedSecurity === false;
    const portalConnectionId = owningSystemUrl
      ? this.connections.find((connection) => connection.type === "portal" && connection.portalUrl === owningSystemUrl)?.id || null
      : null;
    return {
      kind: "server",
      url: serverUrl,
      cors: true,
      responseMs: Math.round(performance.now() - started),
      version: info.currentVersion || null,
      organization: null,
      authentication: owningSystemUrl ? "Federated Portal" : webTier ? "Web-tier (IWA / PKI / reverse proxy)" : "ArcGIS Server token",
      tokenServiceUrl,
      supportsOAuth: Boolean(owningSystemUrl),
      federated: Boolean(owningSystemUrl),
      owningSystemUrl,
      portalConnectionId,
    };
  }

  async prepareService(value) {
    let serverUrl;
    try {
      serverUrl = serverRootFromResource(value);
    } catch {
      return null;
    }
    if (this.discoveredServers.has(serverUrl)) return this.discoveredServers.get(serverUrl);
    let report;
    try {
      report = await this.inspectServer(value);
    } catch {
      return null;
    }
    await this.#runtime();
    const info = new this.ServerInfo({
      server: report.url,
      tokenServiceUrl: report.tokenServiceUrl || undefined,
      hasServer: true,
      webTierAuth: report.authentication.startsWith("Web-tier"),
    });
    this.identityManager.registerServers([info]);
    this.discoveredServers.set(report.url, report);
    return report;
  }

  async getStatus(id) {
    const connection = this.#find(id);
    if (connection.type === "server" && connection.authMode === "web-tier") {
      try {
        await this.inspectServer(connection.serverUrl, "web-tier");
        return { signedIn: true, userId: "Browser access", expires: null };
      } catch {
        return { signedIn: false, userId: null, expires: null };
      }
    }
    if (!this.identityManager) return { signedIn: false, userId: null, expires: null };
    try {
      const credential = await this.identityManager.checkSignInStatus(this.#resourceUrl(connection));
      return publicCredentialSummary(credential);
    } catch {
      return { signedIn: false, userId: null, expires: null };
    }
  }

  async getStatuses() {
    return Promise.all(this.connections.map(async (connection) => ({
      connection: structuredClone(connection),
      status: await this.getStatus(connection.id),
    })));
  }

  remove(id) {
    const connection = this.#find(id);
    this.connections = this.connections.filter((item) => item.id !== id);
    this.oauthInfos.delete(id);
    this.serverInfos.delete(id);
    this.#writeStore();
    // IdentityManager does not expose per-registration removal. Revoking active
    // credentials prevents a removed connection from remaining usable this tab.
    this.identityManager?.destroyCredentials();
    this.events.publish("auth:connections-changed", { connections: this.list(), removed: structuredClone(connection) });
  }

  signOutAll() {
    this.identityManager?.destroyCredentials();
    this.events.publish("auth:status-changed", { connection: null, status: { signedIn: false } });
  }

  exportConnections() {
    return this.list();
  }

  importConnections(definitions = []) {
    if (!Array.isArray(definitions)) return this.list();
    for (const definition of definitions) {
      try {
        if (definition?.type === "portal") this.addPortal(definition);
        if (definition?.type === "server") this.addServer(definition);
      } catch (error) {
        this.events.publish("app:error", { message: `Skipped an invalid ArcGIS connection: ${error.message}` });
      }
    }
    return this.list();
  }

  #upsert(connection) {
    const index = this.connections.findIndex((item) => item.id === connection.id);
    if (index >= 0) this.connections[index] = connection;
    else this.connections.push(connection);
    this.#register(connection);
    this.#writeStore();
    this.events.publish("auth:connections-changed", { connections: this.list() });
  }

  #register(connection) {
    if (!this.identityManager) return;
    if (connection.type === "portal") {
      if (this.oauthInfos.has(connection.id)) return;
      const info = new this.OAuthInfo({
        appId: connection.clientId,
        portalUrl: connection.portalUrl,
        popup: connection.loginMode !== "redirect",
        popupCallbackUrl: "oauth-callback.html",
        flowType: "auto",
        authNamespace: `gismap-online:${connection.id}`,
      });
      this.oauthInfos.set(connection.id, info);
      this.identityManager.registerOAuthInfos([info]);
      return;
    }
    if (connection.type === "server") {
      if (this.serverInfos.has(connection.id)) return;
      const info = new this.ServerInfo({
        server: connection.serverUrl,
        tokenServiceUrl: connection.tokenServiceUrl || undefined,
        hasServer: true,
        webTierAuth: connection.authMode === "web-tier",
      });
      this.serverInfos.set(connection.id, info);
      this.identityManager.registerServers([info]);
    }
  }

  #resourceUrl(connection) {
    return connection.type === "portal" ? `${connection.portalUrl}/sharing` : connection.serverUrl;
  }

  #find(id) {
    const connection = this.connections.find((item) => item.id === id);
    if (!connection) throw new Error("That ArcGIS connection is no longer configured.");
    return connection;
  }

  async #fetchJson(url, options = {}) {
    let response;
    try {
      response = await fetch(url, { mode: "cors", ...options });
    } catch (error) {
      throw new Error(`Could not reach ${new URL(url).origin}. Check CORS, TLS, network access, and web-tier credentials. ${error.message}`);
    }
    if (!response.ok) throw new Error(`Connection test returned HTTP ${response.status} from ${url}.`);
    const data = await response.json();
    if (data?.error) throw new Error(data.error.message || "The ArcGIS endpoint returned an error.");
    return data;
  }

  #readStore() {
    try {
      const definitions = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
      if (!Array.isArray(definitions)) return [];
      const valid = [];
      for (const definition of definitions) {
        try {
          if (definition?.type === "portal") {
            const portalUrl = normalizePortalUrl(definition.portalUrl);
            const clientId = String(definition.clientId || "").trim();
            if (clientId) valid.push({ id: definition.id || makeId(), type: "portal", name: definition.name || new URL(portalUrl).hostname, portalUrl, clientId, loginMode: portalLoginMode(definition.loginMode) });
          } else if (definition?.type === "server") {
            const serverUrl = normalizeServerUrl(definition.serverUrl);
            const authMode = serverAuthMode(definition.authMode);
            valid.push({ id: definition.id || makeId(), type: "server", name: definition.name || new URL(serverUrl).hostname, serverUrl, authMode, tokenServiceUrl: authMode === "token" ? normalizeTokenServiceUrl(definition.tokenServiceUrl, serverUrl) : null });
          }
        } catch {
          // Ignore malformed legacy browser settings instead of preventing startup.
        }
      }
      return valid;
    } catch {
      return [];
    }
  }

  #writeStore() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.connections));
  }
}
