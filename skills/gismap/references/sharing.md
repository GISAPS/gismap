# Sharing

`await mapSpec.createLink(spec)` returns a URL and QR suitability; `mapSpec.decode` checks its encoded content. Inspect the decoded spec against intended filters, layers, renderer, camera and briefing. Then open the result in the app and verify rendered state. Public links expose their content: do not include credentials, sensitive personal information, or private service URLs. Respect payload limits; use the app's supported file export or hosted map spec instead of a third-party shortener. See https://gismap.online/guides/ai-agents/.

## Status definitions

**Reporting.** Always return the actual URL. Then state one status (prepared, validated, loaded or verified) and one line listing what you could not check. Don't withhold a link because you couldn't verify it.

- **prepared**: a constructed specification, URL or iframe.
- **validated**: the GISMap Online validator accepted it; disclose any warnings.
- **loaded**: the required layers loaded in GISMap Online.
- **verified**: the intended features, filter, camera and style were checked in GISMap Online, and the shared URL was reopened.

`mapSpec.prepareVerification(spec)` runs without a browser: it reports the offline checks and marks service metadata, fields, filter acceptance, rendering and reopening as `not_checked`. In a browser, await `mapSpec.load(spec).ready`, review its issues and inspect the map, then query the source independently and reopen the URL.

## Agent attribution

Links can credit the tool that wrote them: `https://gismap.online/?via=<agent>#map=json:…`. `via` takes 1 to 32 lowercase letters, digits or hyphens. It exists for aggregate counts, never personal data, and the app ignores it when drawing the map.

## Embeds

GISMap Online can publish a configured **public map** as an iframe. The embedded map preserves the public layers, style, layer filters, camera, basemap and interface skin in the share URL. It is a live map, not a screenshot or a copied dataset. Use the Share & export dialog's Embed option. The in-app Map assistant has a `get_map_embed` tool for this: input optional `title` and `height`, output the embed URL and paste-ready iframe. Outside the app, use the helpers below.

For a normal map share URL, use the standalone helpers at `https://gismap.online/js/embed-share.js`:

```js
import { createEmbedUrl, createEmbedIframe } from "https://gismap.online/js/embed-share.js";

const embedUrl = createEmbedUrl(sharedMapUrl, { kind: "map" });
const iframe = createEmbedIframe(sharedMapUrl, {
  kind: "map",
  title: "County health dashboard",
  height: 600,
});
```

`kind` may be `map`, `briefing` or `tour` when the supplied share URL is that artifact. The helper only adds `embed=1` and `embedKind`; the original share fragment remains the authoritative configuration. Heights are bounded to 280–1200 px. Test the final iframe in the destination site, including resize behavior, keyboard navigation, fullscreen and geolocation permission.

Embeds can only carry shareable public web resources. Local files, device-only layers, private URLs, and sources with tokens, keys or passwords must be exported as a project file (`.gis`) or project package (`.gisx`, from Project → Download project…) or hosted by the publisher with suitable public access. The remote publisher can still change, throttle, block CORS, or remove a public service after embedding.
