// GISMap SI account session: sign in, sign up, sign out, refresh, and the
// per-user feature flags SI returns from /me. The access token lives only in
// memory. Anonymous visitors always get every flag off.
import { createSiClient, SI_API_BASE } from "./si-client.js";

export const FEATURE_FLAGS = ["accounts", "save_maps", "si_data_browser", "save_datasets", "si_assistant"];
const FLAG_DEPENDENCIES = {
  save_maps: ["accounts"],
  si_data_browser: ["accounts"],
  save_datasets: ["accounts", "si_data_browser"],
  si_assistant: ["accounts", "si_data_browser"],
};
const RECOVERY_KEY = "gismap.si.recoveryDraft";

export const NO_FLAGS = Object.freeze(Object.fromEntries(FEATURE_FLAGS.map((flag) => [flag, false])));

// A flag is on only when SI turned it and every flag it depends on on.
export function resolveFlags(features = {}) {
  const raw = Object.fromEntries(FEATURE_FLAGS.map((flag) => [flag, features?.[flag] === true]));
  return Object.freeze(Object.fromEntries(FEATURE_FLAGS.map((flag) => [flag, raw[flag] && (FLAG_DEPENDENCIES[flag] || []).every((dep) => raw[dep])])));
}

// `/beta?code=...` lets invited testers reach sign-in while `accounts` is off.
export function betaInviteCode(location = globalThis.location) {
  if (!location || location.pathname.replace(/\/+$/, "") !== "/beta") return "";
  const code = new URLSearchParams(location.search).get("code") || "";
  return /^[\w-]{4,64}$/.test(code) ? code : "";
}

export function createSiSession({ base = SI_API_BASE, fetchImpl, storage = globalThis.localStorage } = {}) {
  let accessToken = "";
  let refreshToken = "";
  let user = null;
  let flags = NO_FLAGS;
  const listeners = new Set();
  const emit = () => listeners.forEach((listener) => listener(snapshot()));
  const snapshot = () => ({ signedIn: Boolean(user), user, flags });

  async function refresh() {
    if (!refreshToken) return "";
    try {
      const { data } = await client.post("/auth/refresh", { refreshToken }, { auth: false });
      accept(data);
      return accessToken;
    } catch {
      clear();
      emit();
      return "";
    }
  }

  const client = createSiClient({ base, fetchImpl, getToken: () => accessToken, refresh });

  function accept(data) {
    accessToken = data?.accessToken || data?.token || "";
    if (data?.refreshToken) refreshToken = data.refreshToken;
    if (data?.user) user = data.user;
    if (data?.features) flags = resolveFlags(data.features);
  }

  function clear() {
    accessToken = "";
    refreshToken = "";
    user = null;
    flags = NO_FLAGS;
  }

  async function loadMe() {
    const { data } = await client.get("/me");
    user = data?.user || data || user;
    flags = resolveFlags(data?.features);
  }

  async function authenticate(path, body) {
    const { data } = await client.post(path, body, { auth: false });
    accept(data);
    if (!accessToken) throw new Error("GISMap SI didn't return a session.");
    await loadMe();
    emit();
    return snapshot();
  }

  return {
    client,
    snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    isEnabled: (flag) => flags[flag] === true,
    signIn: ({ email, password }) => authenticate("/auth/login", { email, password }),
    signUp: ({ name, email, password, acceptTerms, inviteCode }) => {
      if (!acceptTerms) throw new Error("Accept the terms to create an account.");
      return authenticate("/auth/register", { name, email, password, acceptTerms: true, ...(inviteCode ? { inviteCode } : {}) });
    },
    signOut() { clear(); emit(); },
    // Written before the sign-in modal opens so a reload never loses the map.
    saveRecoveryDraft(state) {
      try { storage?.setItem(RECOVERY_KEY, JSON.stringify({ savedAt: Date.now(), state })); } catch { /* storage unavailable */ }
    },
    takeRecoveryDraft() {
      try {
        const text = storage?.getItem(RECOVERY_KEY);
        storage?.removeItem(RECOVERY_KEY);
        return text ? JSON.parse(text).state : null;
      } catch { return null; }
    },
  };
}
