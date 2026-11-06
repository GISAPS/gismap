import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PdfDocument, SITE_URL } from "../js/pdf-document.js";

const uris = async (pdf) => [...Buffer.from(await pdf.toBlob().arrayBuffer()).toString("latin1").matchAll(/\/Subtype \/Link [^\n]*?\/URI \(([^)]*)\)/g)].map((match) => match[1]);

test("the header band and the footer link open gismap.online on every page", async () => {
  // The footer sits in the bottom margin; addTextAt used to drop it there, so it had no link.
  const pdf = new PdfDocument({ heading: "MAP" });
  pdf.addSiteLink();
  pdf.newPage();
  pdf.addTextAt("Open the live map", { x: 48, y: 300, width: 200, link: "https://gismap.online/#map=abc" });
  assert.equal(SITE_URL, "https://gismap.online/");
  assert.deepEqual(await uris(pdf), [SITE_URL, SITE_URL, SITE_URL, "https://gismap.online/#map=abc"]);
});

test("the map and briefing PDFs keep the header link on the site, not the share link", async () => {
  // A share link as homeUrl replaced the only link back to the site (the Map PDF had no other).
  const ui = await readFile(new URL("../js/ui.js", import.meta.url), "utf8");
  const briefing = await readFile(new URL("../js/briefing-pdf.js", import.meta.url), "utf8");
  const mapPdf = ui.slice(ui.indexOf("async #mapPdfFile("), ui.indexOf("Turns a layer into a briefing"));
  for (const source of [mapPdf, briefing]) {
    assert.doesNotMatch(source, /homeUrl:\s*link/);
    assert.match(source, /addSiteLink\(/);
  }
});
