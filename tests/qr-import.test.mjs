import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describeGisMapLink, gisMapLinkFrom } from "../js/qr-import.js";

const here = { hostname: "gismap.online", origin: "https://gismap.online", pathname: "/", search: "" };

test("only GISMap Online links in a QR code are opened, and they open in this copy of the app", () => {
  assert.equal(gisMapLinkFrom("https://gismap.online/#map=zABC", { here }), "https://gismap.online/#map=zABC");
  assert.equal(gisMapLinkFrom("https://www.gismap.online/?workflow=tasks#fieldTask=x", { here }), "https://gismap.online/?workflow=tasks#fieldTask=x");
  assert.equal(gisMapLinkFrom("https://0cf64f34-gismap.silasmerlin.workers.dev/#briefing=z1", { here }), "https://gismap.online/#briefing=z1", "preview-build links open here");
  assert.equal(gisMapLinkFrom("http://gismap.online/?tourOnly=1#tour=t", { here }), "https://gismap.online/?tourOnly=1#tour=t", "legacy HTTP QR cards reopen through this secure copy");
  const preview = { hostname: "abc-gismap.silasmerlin.workers.dev", origin: "https://abc-gismap.silasmerlin.workers.dev", pathname: "/", search: "" };
  assert.equal(gisMapLinkFrom("https://gismap.online/#tour=t", { here: preview }), "https://abc-gismap.silasmerlin.workers.dev/#tour=t");
  for (const text of ["https://example.com/#map=zABC", "https://gismap.online.evil.example/#map=z", "javascript:alert(1)", "http://example.com/#map=z", "WIFI:S:home;;", ""]) {
    assert.equal(gisMapLinkFrom(text, { here }), null, text);
  }
  assert.equal(describeGisMapLink("https://gismap.online/#map=z"), "map");
  assert.equal(describeGisMapLink("https://gismap.online/?workflow=tasks#fieldTask=x"), "field task");
  assert.equal(describeGisMapLink("https://gismap.online/#briefing=z&slide=s-1"), "briefing");
});

test("pictures open from a drop, the photo library or the menu; Smart images stay clean", async () => {
  const ui = await readFile(new URL("../js/ui.js", import.meta.url), "utf8");
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const router = await readFile(new URL("../js/mobile-workflow-router.js", import.meta.url), "utf8");
  const smart = await readFile(new URL("../js/smart-image.js", import.meta.url), "utf8");
  const reader = await readFile(new URL("../js/qr-import.js", import.meta.url), "utf8");
  assert.match(html, /id="image-file-input" type="file" accept="image\/\*"/, "phones offer the photo library and camera");
  assert.match(html, /data-action="open-image"/);
  assert.match(router, /data-open-image/);
  assert.match(ui, /decodeQrFromImage\(file\)/);
  assert.match(ui, /jpe\?g\|webp\|gif\|heic/, "dropped photos are accepted");
  assert.doesNotMatch(smart, /Scan to open this map|drawQrCard/, "no QR card is drawn on the map");
  assert.match(reader, /BarcodeDetector/);
  assert.match(reader, /"define", source\)\(module, module\.exports, undefined\)/, "jsQR loads despite the page's AMD loader");
  assert.match(await readFile(new URL("../js/pdf-document.js", import.meta.url), "utf8"), /export async function brandedQrCanvas/, "PDFs, UI shares and API exports use one branded QR renderer");
});
