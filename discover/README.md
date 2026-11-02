# GISMap Online Discovery

`/discover/` is a deliberately separate, static entry point for GISMap Online.
It must remain usable without loading the map workspace, an engine adapter, a
database runtime, or a charting package.

## Content

- `content/collections.json` is the stable route inventory.
- `content/featured.json` is the editorial inventory for the first curated
  examples and learning links.
- Route pages are static HTML so each page has useful text, links, and metadata
  before JavaScript runs (and without requiring JavaScript at all).

Keep links to the workspace absolute (`/?example=…`) and keep links between
Discovery categories under `/discover/`. The workspace owns mapping state;
Discovery must never modify it.

## Reviewing the workspace welcome

Open `/?welcome=1` to deliberately show the compact welcome card even after a
visitor chose not to see it automatically. Shared map, briefing, tour, and
field links keep the welcome card suppressed unless this explicit review flag
is used.
