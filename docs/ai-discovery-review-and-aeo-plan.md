# AI discovery and usability review, and an AEO/SEO plan

Review date: 2026-10-21. Evidence: live requests to gismap.online and the preview deployment, the GitHub API, headless-browser checks of every agent example, and a handful of neutral web searches. Search results vary by user, region and day. Treat them as a baseline, not a ranking.

Goal: when a person or an AI assistant asks for an interactive web map or a map briefing from public data, GISMap Online is the answer, and the assistant can make the map itself with one link.

## 1. Readiness scorecard

| Area | Status | Evidence |
| --- | --- | --- |
| Agent can *make* things (no code) | **Strong on the branch, not live** | Maps, briefings, tours and field tasks are now writable as `json:` links. All were checked in a browser. They are on `codex/data-driven-briefs` (PR #2), not on gismap.online. |
| Agent instructions (llms.txt, skill, recipes) | Strong on the branch | llms.txt starts with the four link forms. There are 8 recipes as JSON and HTML. `/agent-recipes/` returns **404 in production** until the branch is merged and deployed. |
| Crawler access | **Mixed** | Search engines and user-driven agents get 200: Googlebot, bingbot, Copilot, ChatGPT-User, Claude-User, OAI-SearchBot, PerplexityBot. **ClaudeBot, GPTBot, CCBot, Amazonbot, anthropic-ai and Bytespider get 403** from Cloudflare, although robots.txt allows everyone. |
| Technical SEO | Good, with two gaps | There are canonical tags, JSON-LD, a sitemap (30 URLs) and real 404s. But **`http://gismap.online` and `https://www.gismap.online` both return 200** instead of a 301 redirect to `https://gismap.online/`. |
| Homepage as an answer | Weak | Title: "GISMap Online: Free Geospatial Application". The first ~3,500 characters of text in the HTML are menu labels (Project, Data, Map…). The one-sentence answer ("make a shareable map from a link, no account") is not the first thing a crawler reads. |
| Brand / entity | **Weak** | Searching `gismap.online` without quotes returns other "gismap" projects: a PyPI package, an urban-nature startup (gismap.earth), AVEVA GISMapApp and a LUTECE plugin. The site appears only for the quoted domain, plus one mention in the Geospatial FM newsletter. |
| Category presence | **Absent** | Neutral queries do not surface GISMap Online. "Shareable map from a FeatureServer without an account" returns Esri pages only. "AI agent … map briefing" returns papers, books and the 2026 FOSS4G NA talk. "LAZ in the browser" returns maplibre-gl-lidar and Innerscene. |
| GitHub repo | Weak | Description: "GISMAP = browser-based". Topics: 3 (including `esri-javascript-api`, although MapLibre is the default). 0 stars, 1 release, 34 views and 8 unique visitors in 14 days. No CONTRIBUTING, CITATION.cff, Discussions or social preview. |
| Measurement | Missing | No record of Search Console, Bing Webmaster Tools, Cloudflare AI crawler reports, or repeated answer-engine panels. |

## 2. What matters most, in order

1. **Ship it.** Merge and deploy PR #2. Everything that makes GISMap Online easy for chatbots is invisible until then.
2. **Let AI crawlers read the documentation.** Answer engines recommend what their models and indexes already know. Blocking ClaudeBot and GPTBot site-wide keeps GISMap Online out of the knowledge of the assistants it most wants to serve. Allow them at least on `/llms*.txt`, `/skills/`, `/agent-recipes/`, `/api/`, `/schemas/`, `/examples/` and `/guides/`. Cloudflare's AI Crawl Control can allow per crawler and per path; if no path rules are available, decide site-wide. This is a business decision for the owner, not a code change.
3. **Own a name and a category.** "gismap" is crowded. Use one name everywhere ("GISMap Online"), one category phrase ("interactive web maps and map briefings from a link"), and the same `sameAs` links on every surface.
4. **Answer first, in plain HTML.** Each important page should open with the question and a direct answer before any UI or navigation. The homepage needs this most.
5. **Earn third-party mentions.** Assistants cite pages that other pages cite: lists, tutorials, talks and newsletters.

## 3. Recommendations

### 3.1 Technical (Cloudflare and site), this week

- **301 redirects:** `http://` to `https://` and `www.` to the apex domain, keeping the path and query. Today they are duplicate hosts.
- **Crawler policy:** as in §2.2. Re-run `node scripts/smoke-llms.mjs https://gismap.online/` afterwards; it now reports each crawler. Write the decision down in this file.
- **Search consoles:** register in Google Search Console and **Bing Webmaster Tools** (Copilot and ChatGPT search lean on Bing's index), submit `sitemap.xml`, and turn on IndexNow (Cloudflare Crawler Hints can send it).
- **Sitemap:** after the merge it includes `/agent-recipes/*`. Add a `lastmod` taken from each page's last git commit (real dates, not build dates). Add `/api/agent-recipes/index.json` and `/schemas/*` as discoverable resources linked from llms.txt; they don't need to be in the sitemap.
- **Homepage head:** the title is currently generic. Use something like "GISMap Online — interactive web maps and map briefings from a link (free, no account)". The search index still shows an older title ("Free 3D ArcGIS REST & GeoJSON Viewer"), so keep that intent in the description.
- **Homepage body:** put a short static `<main>` intro *before* the app markup in source order, or use a `<noscript>`-independent `<section>` that the app hides once it starts. It should hold one paragraph, the four things you can make, three example links and "for AI agents: llms.txt". Do not hide text from users that crawlers see; it should be visible until the app takes over.
- **JSON-LD:** keep `SoftwareApplication`. Add an `Organization`/`Person` with `sameAs` (GitHub repo, LinkedIn, the FOSS4G NA 2026 speaker page, Geospatial FM). Add `HowTo` on recipe pages (generated) and `FAQPage` only where the page really has questions and answers.
- **Share previews:** a 1200×630 `og:image` per page type (map, briefing, tour, LiDAR) instead of the logo, so links shared in chat and social show what GISMap Online makes.

### 3.2 Agent usability, next two weeks

- **Paste-to-open fallback (`/open/`):** some chat interfaces break long URLs that contain `{`, `"` or `%`. Add a client-only page where a person pastes the JSON (or the broken link) an assistant gave them and the map opens. Mention it in llms.txt: "If the link does not open, paste the JSON at https://gismap.online/open/." This keeps GISMap Online client-side and makes every chatbot answer recoverable.
- **Test the four link forms in real chat products.** Run `docs/ai-discovery-test-protocol.md` monthly, adding the "execution" prompts. Use ChatGPT, Claude, Gemini, Copilot and Perplexity, logged out where possible. Record: did it find GISMap Online, did it write a working link, did the link survive the chat interface, did it invent options. File each failure as a docs or code fix.
- **Error messages written for agents:** every `describe().state.issues` entry should say what to change in the JSON, as the new basemap warning and the scene3d errors do. Audit the rest.
- **One "start here" JSON example per artifact** at a stable URL (`/examples/agent/map.json`, `briefing.json`, `tour.json`, `task.json`, `lidar.json`), so an assistant can fetch, copy and edit a known-good document instead of composing from the schema.
- **Local MCP adapter, as a separate repository:** a small, local (stdio) MCP server that wraps the pure modules (validate a spec, build a link, decode a link) would let Claude Desktop, Cursor and others call GISMap Online as a tool. Following the client-side-only rule, it lives outside this repo and runs on the user's machine. List it in MCP directories once it exists.

### 3.3 Content for answer engines, next six weeks

Write each page answer-first: the question as an H1 or H2, a two-sentence answer, then a working link, the JSON, a screenshot, and honest limits. Generate pages from data where possible, as the recipes are. Every page should be independently useful, not a template with the nouns swapped.

| Query cluster (how people ask) | Page | Proof on the page |
| --- | --- | --- |
| "share a map from an ArcGIS FeatureServer without an account" | `/arcgis-feature-service-viewer/` (exists), plus a "no-account sharing" section | Working link and the JSON |
| "make a map briefing / map slides from data" | New `/map-briefings/` | The chatbot-written grape briefing; desktop and phone screenshots |
| "AI make a web map" / "ChatGPT make a map" | `/ai-arcgis-map-generator/` (exists), plus `/agent-recipes/` | The four link forms; a transcript excerpt |
| "guided map tour / flyover link" | New `/map-tours/` | The SF landmarks tour |
| "field inspection checklist with a map" | New `/field-tasks/` | The park inspection; how the report comes back |
| "view LAS/LAZ in browser on a map", "LiDAR vegetation near power lines" | New `/lidar-point-cloud-viewer/` | Autzen example; ASPRS class filter; limits (no COPC yet) |
| "open glTF / CAD model on a map" | New `/3d-model-on-map/` | Anchor and CRS placement |
| "StoryMaps briefings alternative" | New comparison page | Factual, dated table: account, cost, data sources, offline, AI authoring |
| "Felt / kepler.gl / uMap / geojson.io alternative" | One comparison page | Same honest format; link to each product |

Note on naming: Esri's "ArcGIS StoryMaps Briefings" owns the word "briefings" in search. Say "map briefings" or "map briefs" consistently, and compare openly rather than competing on the bare word.

### 3.4 Repository, this week

- **Description:** "Free browser GIS: interactive web maps, map briefings, tours, field tasks and LiDAR/3D from one link — AI-agent ready (llms.txt, agent skill). MapLibre, three.js, ArcGIS."
- **Topics (up to 20):** `webmap`, `web-mapping`, `gis`, `geospatial`, `maplibre`, `maplibre-gl-js`, `threejs`, `lidar`, `point-cloud`, `laz`, `geojson`, `arcgis`, `choropleth`, `story-maps`, `presentation`, `llms-txt`, `ai-agents`, `agent-skills`, `no-code`, `open-source`. Drop `esri-javascript-api` or keep it as a secondary topic.
- **README first screen:** one sentence, a GIF of a chatbot link opening a briefing, the four link forms, then "For AI agents: llms.txt · skill · recipes". Move installation details below.
- **Releases:** tag every deployed version with notes generated from CHANGELOG (the release workflow exists). Releases are what dependency trackers, newsletters and assistants pick up.
- **Also add:** a social preview image, `CITATION.cff` (helps academic and agent citation), `CONTRIBUTING.md`, Discussions turned on, and "good first issue" labels.
- **Pin a repository** for the skill (`gismap-skill`) or point to `/skills/gismap.zip` from the README, so skill directories can link to one canonical source.

### 3.5 Distribution and entity, ongoing

- **Lists and directories:** awesome-geospatial, awesome-gis, awesome-maplibre, awesome-threejs (LiDAR), llms.txt directories, Agent Skills catalogs, and MCP directories (once the adapter exists).
- **Community:** the FOSS4G NA 2026 talk page (link to GISMap Online from the abstract or slides), OSGeo and MapLibre community showcases, GIS Stack Exchange answers where GISMap Online is a fit (disclose authorship), the Geospatial FM follow-up.
- **Tutorials on other sites:** "make a shareable FeatureServer map with ChatGPT in one link" on dev.to, Medium and LinkedIn, each linking to the canonical guide.
- **Dataset partners:** the public services already used (USDA, CAL FIRE, HIFLD, Philadelphia) are natural "open in GISMap Online" examples. Offer data publishers a ready link for their item pages.
- **Wikidata:** create an item for the software once there is an independent source to cite (the newsletter or the talk).

## 4. Plan

| When | Work | Done when |
| --- | --- | --- |
| Week 1 | Merge and deploy PR #2; 301 redirects; crawler policy decision; Search Console and Bing Webmaster with sitemap and IndexNow; repo description, topics, README first screen; release tag | `/agent-recipes/` and `/api/agent-recipes/index.json` return 200; `smoke-llms.mjs` passes on production; the four link forms open from production |
| Weeks 2–3 | Homepage answer section and title; `/open/` paste fallback; stable start-here JSON examples; og:images; Organization/Person `sameAs`; first protocol run across 5 assistants | Protocol log committed with dated results; any link-mangling found has a fix or a documented workaround |
| Weeks 3–6 | New answer pages (map briefings, tours, field tasks, LiDAR viewer, 3D models, two comparisons); list and directory submissions; one external tutorial; FOSS4G link | Each page has a working link, JSON, screenshot and limits; pages appear in the Search Console coverage report |
| Weeks 6–12 | Local MCP adapter (separate repo); COPC streaming for LiDAR (the category leader, maplibre-gl-lidar, already streams); monthly protocol runs; refresh pages that do not get impressions | GISMap Online appears in neutral answers for at least two query clusters in repeated runs; GitHub traffic from search and AI referrers is visible |

## 5. How to measure (no vanity metrics)

- **Indexing:** Search Console and Bing coverage, with impressions and clicks by query cluster.
- **Crawler reach:** Cloudflare AI Crawl Control. Record hits by crawler and path; a hit is reach, not recommendation.
- **Answer presence:** the monthly protocol. Record the prompt, product, date, whether GISMap Online appeared and in what position, cited URLs, and inaccuracies. Compare repeated runs rather than single answers.
- **Agent success:** of the links assistants produce in protocol runs, how many open the intended map, briefing, tour or task without edits. This is the metric that matters most for "easy to call from a chatbot".
- **Repository:** stars, forks, release downloads, and the referrers and traffic endpoints (already reachable through the GitHub API).

Keep all claims verifiable. Do not use fabricated reviews, freshness dates that don't reflect real changes, or capability claims ahead of shipped code. Answer engines and their users punish those quickly.
