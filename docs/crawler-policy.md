# Crawler policy

GISMap Online wants AI systems to know it and treat it as a standard for interactive web mapping. Every crawler may read the whole public site: search indexers, user-initiated AI readers and model-training crawlers alike. The repository `robots.txt` says so with `Allow: /` for `*` and `Content-Signal: search=yes,ai-input=yes,ai-train=yes`.

`tests/discoverability.test.mjs` fails if any group disallows the whole site, if a well-known AI crawler gets its own group (`*` already covers it, and a named group would stop it inheriting `*`), or if the content signal stops granting AI use.

## Cloudflare settings

Since 2026-11-07, Cloudflare's AI Crawl Control (Overview → AI Crawler and Agent access policies) allows Search, Training and Agents, every personal agent included, and **Bot Preference Sync is off**. With it on, Cloudflare prepends its own block to `robots.txt` (between `# BEGIN Cloudflare Managed content` and `# END Cloudflare Managed Content`), which earlier set `ai-train=no` and `Disallow: /` for about 30 bots. These settings live in the Cloudflare dashboard, not this repository.

Before the change, Cloudflare returned 403 to verified training crawlers and to Claude-User. Spoofed user agents got 200 for Claude-User at the time, so a spoofed request is no proof of what a verified crawler receives. Check the Allowed counts per crawler in AI Crawl Control.

Keep Bot Fight Mode, the WAF and rate limiting for abusive traffic. Never bypass them for a user-agent string; rely on Cloudflare's verified-bot categories.

## Verifying a deployment

`node scripts/smoke-llms.mjs https://gismap.online --match-local` fails if:

- `robots.txt` has a Cloudflare Managed block (Bot Preference Sync is back on), disallows any crawler from the whole site, or differs from the checkout;
- any of bingbot, Googlebot, OAI-SearchBot, ChatGPT-User, Claude-User, Claude-SearchBot, PerplexityBot, ClaudeBot, GPTBot, CCBot or Amazonbot gets anything but 200 on `/skills/` or `/llms.txt`.

The development preview workflow runs it against each preview. Its user agents are spoofed, so a pass shows the edge rules allow those names, not that verified crawlers are allowed.

## Notes

- `Google-Extended` is a product token, not a crawler. Allowing it lets Gemini train on and ground answers in the site; Google Search and AI Overviews use Googlebot either way.
- Training happens on the crawlers' schedule; models released after the change are the first that can know the site from it. Search and answer crawlers matter sooner.
