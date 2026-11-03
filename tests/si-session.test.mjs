import test from "node:test";
import assert from "node:assert/strict";
import { apiBase, createSiClient, SiError } from "../js/si-client.js";
import { betaInviteCode, createSiSession, NO_FLAGS, resolveFlags } from "../js/si-session.js";

const json = (status, body, headers = {}) => new Response(body === null ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

function fakeSi(routes) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const path = new URL(url).pathname.replace("/api/v1", "");
    calls.push({ path, method: init.method, auth: init.headers.Authorization || "", body: init.body ? JSON.parse(init.body) : undefined });
    const handler = routes[`${init.method} ${path}`];
    return handler ? handler(calls.at(-1)) : json(404, { issues: [{ message: "Not found." }] });
  };
  return { calls, fetchImpl };
}

function memoryStorage() {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: (key) => map.delete(key), map };
}

test("anonymous sessions have every flag off", () => {
  const session = createSiSession({ fetchImpl: async () => { throw new Error("no request expected"); } });
  assert.deepEqual(session.snapshot().flags, NO_FLAGS);
  assert.equal(session.snapshot().signedIn, false);
});

test("flags need their dependencies", () => {
  assert.equal(resolveFlags({ save_maps: true }).save_maps, false);
  assert.equal(resolveFlags({ accounts: true, save_maps: true }).save_maps, true);
  assert.equal(resolveFlags({ accounts: true, save_datasets: true }).save_datasets, false);
  assert.equal(resolveFlags({ accounts: "yes" }).accounts, false);
});

test("sign in loads flags from /me and sends the token only as a header", async () => {
  const { calls, fetchImpl } = fakeSi({
    "POST /auth/login": () => json(200, { accessToken: "tok-1", refreshToken: "ref-1", user: { name: "Loki" } }),
    "GET /auth/me": () => json(200, { user: { name: "Loki" }, features: { accounts: true, save_maps: true } }),
  });
  const storage = memoryStorage();
  const session = createSiSession({ fetchImpl, storage });
  const state = await session.signIn({ email: "a@b.c", password: "pw" });
  assert.equal(state.signedIn, true);
  assert.equal(session.isEnabled("save_maps"), true);
  assert.equal(session.isEnabled("si_data_browser"), false);
  assert.equal(calls[0].auth, "");
  assert.equal(calls[1].auth, "Bearer tok-1");
  assert.ok(![...storage.map.values()].some((value) => value.includes("tok-1") || value.includes("ref-1")), "tokens never reach local storage");
  assert.ok(!JSON.stringify(session.snapshot()).includes("tok-1"));
});

test("a 401 refreshes once, and a failed refresh signs out quietly", async () => {
  let meCalls = 0;
  const { fetchImpl } = fakeSi({
    "POST /auth/login": () => json(200, { accessToken: "old", refreshToken: "ref" }),
    "GET /auth/me": (call) => (++meCalls === 1 || call.auth === "Bearer new" ? json(200, { features: { accounts: true } }) : json(401, {})),
    "POST /auth/refresh": () => json(200, { accessToken: "new" }),
  });
  const session = createSiSession({ fetchImpl, storage: memoryStorage() });
  await session.signIn({ email: "a", password: "b" });
  const { data } = await session.client.get("/auth/me");
  assert.deepEqual(data.features, { accounts: true });

  const failing = fakeSi({
    "POST /auth/login": () => json(200, { accessToken: "old", refreshToken: "ref" }),
    "GET /auth/me": (call) => (failing.calls.filter((c) => c.path === "/auth/me").length === 1 ? json(200, { features: { accounts: true } }) : json(401, {})),
    "POST /auth/refresh": () => json(401, {}),
  });
  const other = createSiSession({ fetchImpl: failing.fetchImpl, storage: memoryStorage() });
  const seen = [];
  other.subscribe((snap) => seen.push(snap.signedIn));
  await other.signIn({ email: "a", password: "b" });
  await assert.rejects(other.client.get("/auth/me"), (error) => error.name === "SiError" && error.status === 401);
  assert.equal(other.snapshot().signedIn, false);
  assert.deepEqual(other.snapshot().flags, NO_FLAGS);
  assert.deepEqual(seen, [true, false]);
});

test("errors use SI's issue messages, then a friendly status message", async () => {
  const client = createSiClient({ fetchImpl: async (url) => (url.endsWith("/a") ? json(422, { issues: [{ message: "Layer 2 has no URL." }] }) : json(409, {})) });
  await assert.rejects(client.get("/a"), { message: "Layer 2 has no URL.", status: 422 });
  await assert.rejects(client.get("/b"), { message: /changed somewhere else/, status: 409 });
});

test("network failures and timeouts become SiErrors", async () => {
  const down = createSiClient({ fetchImpl: async () => { throw new TypeError("fetch failed"); } });
  await assert.rejects(down.get("/x"), { code: "network" });
  const slow = createSiClient({ timeoutMs: 10, fetchImpl: (url, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted")))) });
  await assert.rejects(slow.get("/x"), { code: "timeout" });
});

test("only SI or local API origins are accepted", () => {
  assert.equal(apiBase("https://api.staging.gismap.si"), "https://api.staging.gismap.si/api/v1");
  assert.equal(apiBase("http://localhost:8787/whatever"), "http://localhost:8787/api/v1");
  assert.throws(() => apiBase("https://evil.example"), { code: "bad_origin" });
});

test("sign up requires terms, and the recovery draft round-trips once", async () => {
  const session = createSiSession({ fetchImpl: async () => json(500, {}), storage: memoryStorage() });
  assert.throws(() => session.signUp({ name: "a", email: "b", password: "c", acceptTerms: false }), /terms/);
  session.saveRecoveryDraft({ layers: [1] });
  assert.deepEqual(session.takeRecoveryDraft(), { layers: [1] });
  assert.equal(session.takeRecoveryDraft(), null);
});

test("the beta invite route reads only /beta codes", () => {
  assert.equal(betaInviteCode({ pathname: "/beta", search: "?code=abc-123" }), "abc-123");
  assert.equal(betaInviteCode({ pathname: "/beta/", search: "?code=abc-123" }), "abc-123");
  assert.equal(betaInviteCode({ pathname: "/", search: "?code=abc-123" }), "");
  assert.equal(betaInviteCode({ pathname: "/beta", search: "?code=<x>" }), "");
});

test("SI's FastAPI shapes: access_token, display_name and detail errors", async () => {
  const { calls, fetchImpl } = fakeSi({
    "POST /auth/register": () => json(201, { access_token: "tok", user: { display_name: "Loki", email: "a@b.c" } }),
    "GET /auth/me": () => json(200, { user: { display_name: "Loki", email: "a@b.c" }, organizations: [] }),
    "POST /auth/logout": () => json(204, null),
  });
  const session = createSiSession({ fetchImpl, storage: memoryStorage() });
  await session.signUp({ name: "Loki", email: "a@b.c", password: "x".repeat(12), acceptTerms: true });
  assert.equal(calls[0].body.organization_name, "Loki's workspace");
  assert.equal(calls[0].body.display_name, "Loki");
  assert.equal(session.snapshot().user.display_name, "Loki");
  session.signOut();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(calls.at(-1), { path: "/auth/logout", method: "POST", auth: "Bearer tok", body: undefined });

  const client = createSiClient({ fetchImpl: async (url) => (url.endsWith("/a")
    ? json(401, { detail: "Email or password is incorrect." })
    : json(422, { detail: [{ msg: "Field required" }, { msg: "Too short" }] })) });
  await assert.rejects(client.get("/a"), { message: "Email or password is incorrect." });
  await assert.rejects(client.get("/b"), { message: "Field required Too short" });
});
