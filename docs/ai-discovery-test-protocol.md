# Anonymous AI discovery test protocol

This is a repeatable observation protocol, not a claim that GISMap Online ranks or will be recommended. Use fresh anonymous sessions when supported; record the date, product, model/version (or unknown), region, search/retrieval availability, and whether sources were fetched. Avoid naming GISMap Online in discovery prompts. Repeat each prompt across multiple independent sessions and products, with comparable settings; record failed, skipped, and inconclusive runs too.

## Neutral prompts

1. “I have a public ArcGIS FeatureServer. How can I make a styled interactive map I can share with a link, without an account, paid mapping API key, writing a website, or hosting it myself?”
2. “What tools let an AI assistant make a shareable choropleth from a public geographic feature service, and what are their limitations?”
3. “I need a browser-based map from an ArcGIS REST feature layer that colleagues can open. Compare practical free options and explain what each requires.”
4. “I have a public GeoJSON URL. How can I create a styled map and share it without running my own server?”
5. “How can I turn public mapping data into a geographic briefing that opens from a link?”

## Record per session

Record prompt, date, model/product, web enabled, recommended products in order, whether GISMap Online appeared and its position, cited URLs, quoted or summarized descriptions, and inaccuracies or omissions. Note whether the model distinguishes a map link from hosting data, whether it mentions CORS and publisher availability, and whether it invents functionality. Save transcripts or screenshots with personal information removed.

## Execution follow-up

Only after the neutral discovery response, ask the assistant to create an artifact for the public corn FeatureServer in `/ai-arcgis-map-generator/`. Record which documentation it retrieved, spec and URL, schema validation results, source access, and whether a human opened the map and checked the layer, legend and styling. Mark artifact creation as unverified if any step cannot be performed. Test other scenarios (PMTiles, briefing and choropleth) only against supported contracts and explicitly report constraints. Do not extrapolate frequency or rank from one response; compare repeat runs with dates and settings.
