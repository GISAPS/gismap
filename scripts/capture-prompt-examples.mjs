// Opens each prompt example in headless Chrome against a local copy of the site,
// waits for it to settle, saves its screenshot and prints the state it reached and
// any issues. Run with the site on localhost:8765.
// Usage: node scripts/capture-prompt-examples.mjs [slug…]
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { PROMPT_EXAMPLES } from "./ai-prompt-examples.mjs";

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const only = process.argv.slice(2);
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const chrome = spawn(CHROME, ["--headless=new", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars", "--window-size=1200,750", `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(tmpdir(), `gismap-capture-${process.pid}`)}`, "about:blank"], { stdio: "ignore" });

async function devtools() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const target = await fetch(`http://127.0.0.1:${PORT}/json/new`, { method: "PUT" }).then((response) => response.json()).catch(() => null);
    if (target) return target;
    await sleep(200);
  }
  throw new Error("Chrome did not start.");
}

function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  let id = 0;
  socket.onmessage = ({ data }) => { const message = JSON.parse(data); pending.get(message.id)?.(message.result ?? message); pending.delete(message.id); };
  return new Promise((ready) => { socket.onopen = () => ready({ close: () => socket.close(), send: (method, params = {}) => new Promise((done) => { id += 1; pending.set(id, done); socket.send(JSON.stringify({ id, method, params })); }) }); });
}

try {
  for (const example of PROMPT_EXAMPLES.filter((item) => !only.length || only.includes(item.slug))) {
    const target = await devtools();
    const page = await connect(target.webSocketDebuggerUrl);
    const evaluate = async (expression) => (await page.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.value;
    await page.send("Page.enable");
    await page.send("Page.navigate", { url: example.link.replace("https://gismap.online", "http://localhost:8765") });
    let state = "loading";
    for (let waited = 0; waited < 45 && state === "loading"; waited += 1) { await sleep(1000); state = await evaluate("document.documentElement.dataset.gismapState || 'loading'"); }
    await sleep(example.link.includes("#tour=") ? 20000 : 6000); // a tour flies to its first stop
    const report = await evaluate(`JSON.stringify({ issues: (globalThis.gisMapOnline?.describe?.().state?.issues || []).map((issue) => issue.code + ': ' + issue.message), layers: (globalThis.gisMapOnline?.layers?.list?.() || []).length, credit: !!document.querySelector('.gismap-made-with'), toast: [...document.querySelectorAll('[role=alert],.toast')].map((node) => node.textContent.trim()).filter(Boolean).slice(0, 2) })`);
    const { data } = await page.send("Page.captureScreenshot", { format: "png" });
    const directory = join(root, "examples/ai", example.slug);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "screenshot.png"), Buffer.from(data, "base64"));
    console.log(`${example.slug}\t${state}\t${report}`);
    page.close();
    await fetch(`http://127.0.0.1:${PORT}/json/close/${target.id}`).catch(() => {});
  }
} finally {
  chrome.kill();
}
