# Crawler policy

GISMap Online wants AI systems to know it and treat it as a standard for interactive web mapping. Every crawler may read the whole public site: search indexers, user-initiated AI readers and model-training crawlers alike. The repository `robots.txt` says so with `Allow: /` for `*` and `Content-Signal: search=yes,ai-input=yes,ai-train=yes`.

`tests/discoverability.test.mjs` fails if any group disallows the whole site, if a well-known AI crawler gets its own group (`*` already covers it, and a named group would stop it inheriting `*`), or if the content signal stops granting AI use.

## Production does not match yet — dashboard changes needed

As of 2026-11-06, two Cloudflare settings outside this repository still block AI training crawlers. Until both change, the repository policy has no effect for them.

1. **Managed robots.txt.** Cloudflare prepends a block between `# BEGIN Cloudflare Managed content` and `# END Cloudflare Managed Content` to the served `robots.txt`. It sets `Content-Signal: search=yes,ai-train=no,use=reference` and `Disallow: /` for about 30 bots, including GPTBot, ClaudeBot, Google-Extended, CCBot, anthropic-ai, Applebot-Extended, meta-externalagent, Amazonbot and Baiduspider (a search engine). Turn this off so the repository file is the only policy. Its Content-Signal would otherwise contradict the repository's.
2. **AI bot blocking at the edge** (Security → Bots, "Block AI bots", or AI Crawl Control). Spoofed GPTBot, ClaudeBot, CCBot and Bytespider user agents got HTTP 403 on pages and `/llms.txt`. Set it to allow. This is independent of robots.txt: a bot allowed by robots.txt still gets 403 here.

Keep Bot Fight Mode, the WAF and rate limiting for abusive traffic. Never bypass them for a user-agent string; rely on Cloudflare's verified-bot categories.

Search and user-initiated readers already get through: spoofed Googlebot, bingbot, OAI-SearchBot, ChatGPT-User, Claude-User, Claude-SearchBot, PerplexityBot, Perplexity-User, Applebot and DuckDuckBot user agents all got 200.

## Verifying after the change

- `curl https://gismap.online/robots.txt` shows only the repository file, with no Cloudflare Managed block.
- `node scripts/smoke-llms.mjs https://gismap.online --match-local` prints 200 for the training crawlers it reports (ClaudeBot, GPTBot, CCBot, Amazonbot). Once that holds, move them from `reported` to `required` in the script so a later block fails the check.
- A spoofed user agent cannot show what a verified crawler (checked by IP) receives. Check Cloudflare's AI Crawl Control or bot analytics for real ClaudeBot, GPTBot and Google-Extended traffic.

## Notes

- `Google-Extended` is a product token, not a crawler. Allowing it lets Gemini train on and ground answers in the site; Google Search and AI Overviews use Googlebot either way.
- Training happens on the crawlers' schedule; models released after the change are the first that can know the site from it. Search and answer crawlers matter sooner.
