# Codex Implementation Task: GISMap Online Agent Skills

**Repository:** https://github.com/geolibrerian/gismap  
**Project:** GISMap Online  
**Priority:** High  
**Goal:** Make GISMap Online usable by external AI agents through portable Claude Code and OpenAI Codex skills, public API documentation, validation tooling, and automated examples.

## Mission

Implement and publish an official **GISMap Online Agent Skill** compatible with Claude Code, OpenAI Codex, and other assistants supporting the open Agent Skills specification.

The skill must allow agents to discover geographic data, generate functional interactive maps, configure 2D/3D visualizations, create Briefs, Tours and Field Tasks, and return shareable GISMap Online URLs.

This must be a production-ready integration, not simply a Markdown file describing GISMap Online.

**Important:** This is a general-purpose mapping capability. Do not hardcode the solution around the USDA grape production dataset, ArcGIS FeatureServer, or one map renderer.

### Execution instructions

1. Inspect the existing repository, API implementation, documentation, tests, and deployment configuration before making changes.
2. Identify functionality that is already implemented and reuse it.
3. Review the current Agent Skills specification at https://agentskills.io/specification.
4. Create a dedicated feature branch named `feature/gismap-agent-skills`.
5. Implement the requirements below, following existing repository conventions.
6. Add tests and documentation.
7. Run existing tests, build checks, and new integration tests.
8. Commit the implementation.
9. Push the feature branch to GitHub and open a pull request targeting `main` if GitHub authentication and permissions allow.
10. Do not push directly to production or deploy production infrastructure.

Do not stop after planning or generating placeholder documentation. Implement as much of the functional system as the existing codebase allows.

If API capabilities are missing, implement the smallest reusable changes necessary to support them. Clearly identify any genuinely blocked functionality.

---

# 1. Target Architecture

The system should support this flow:

```text
User
  |
  v
Claude / Codex / Other AI Agent
  |
  v
GISMap Online Agent Skill
  |
  +-- Read API documentation
  +-- Discover geographical datasets
  +-- Inspect schemas and capabilities
  +-- Generate map specification
  +-- Validate specification
  +-- Generate Brief / Tour / Field Task
  +-- Generate shareable URL
  |
  v
GISMap Online API
  |
  +-- Map specification
  +-- Layers and filters
  +-- Renderers and 3D
  +-- Briefs
  +-- Tours
  +-- Field Tasks
  +-- Sharing
  |
  v
GISMap Online
  |
  +-- Desktop interactive map
  +-- Mobile experience
  +-- QR code
  +-- Portable share link
```

Future optional integration:

```text
GISMap Online Agent Skill
        |
        v
     mcp.place
        |
        +-- GIS service discovery
        +-- Wikipedia place information
        +-- OSM / Overture points of interest
        +-- Geocoding
        +-- Geographic context
        |
        v
GISMap Online
```

The skill must work independently of mcp.place for users who supply an existing dataset URL.

---

# 2. Portable Skill Package

Create this structure, adjusting filenames to avoid conflicts with existing files:

```text
skills/
└── gismap/
    ├── SKILL.md
    ├── references/
    │   ├── api.md
    │   ├── data-sources.md
    │   ├── map-spec.md
    │   ├── map-styling.md
    │   ├── briefs.md
    │   ├── tours.md
    │   ├── field-tasks.md
    │   ├── sharing.md
    │   └── troubleshooting.md
    ├── scripts/
    │   ├── validate_map.py
    │   └── test_service.py
    └── assets/
        └── examples/
            ├── grapes.json
            ├── mlb-ballparks.json
            └── philly-police.json
```

Follow the official Agent Skills specification:

- Required YAML frontmatter.
- Skill name `gismap`.
- A concise, descriptive trigger description.
- Portable instructions without vendor-specific assumptions.
- Relative references to documentation.
- Minimal dependencies.
- Progressive disclosure of information.
- No secrets, API keys, or local machine paths embedded in the distributed package.

The canonical skill should live in `skills/gismap/`.

Make the same package available to Claude Code and Codex through documented installation steps or maintained symlinks. Avoid maintaining multiple divergent copies.

## SKILL.md behavior

The skill must activate for requests involving:

- Interactive geographic maps.
- Geospatial data visualization.
- ArcGIS or other geographic service visualization.
- Location-based storytelling.
- Choropleth maps.
- 3D thematic maps.
- Interactive Briefs.
- GIS-based field tasks.
- Geographic tours.
- Map sharing and QR codes.

The skill must guide agents through this workflow:

1. Understand the user's geographic question.
2. Identify the region or extent of interest.
3. Discover a dataset or inspect the supplied data source.
4. Determine geometry type, fields, spatial reference, extent, and supported queries.
5. Select the appropriate GISMap Online map engine or renderer.
6. Construct a valid, versioned map specification.
7. Apply requested filters.
8. Generate thematic styling and 3D configuration.
9. Build any requested Brief, Tour, or Field Task.
10. Validate the complete result.
11. Generate a shareable link or project artifact.
12. Verify that the shared result reconstructs correctly.
13. Return the final result with a concise description.

Agents must not invent data fields, layer identifiers, service URLs, geographic values, API responses, or successful validation results.

---

# 3. Audit and Improve the Existing API

Before adding endpoints, audit the current agent-facing API.

Find the existing implementations of:

- Map specifications.
- Data service loading.
- Layer management.
- Filtering.
- Renderer configuration.
- 3D map configuration.
- Brief authoring.
- Tour authoring.
- Field Task authoring.
- QR and link generation.
- Export/import functionality.
- API discovery documentation.

Preserve established contracts where possible.

For each supported operation, document the actual request and response schema.

The API needs to support these logical operations, whether through existing functionality or newly implemented endpoints:

| Operation | Required behavior |
|---|---|
| `inspect_source` | Read service or file metadata |
| `list_layers` | Discover available layers |
| `inspect_layer` | Read geometry, fields and capabilities |
| `create_map_spec` | Construct a portable map definition |
| `validate_map_spec` | Report errors and compatibility issues |
| `configure_renderer` | Set thematic styling |
| `configure_3d` | Set supported 3D behavior |
| `create_brief` | Produce multi-slide geographic presentation |
| `create_tour` | Produce location-based tour |
| `create_field_tasks` | Produce structured task workflow |
| `create_share_link` | Create a reproducible share URL |
| `validate_share_link` | Verify round-trip reconstruction |

These are logical operation names, not mandatory endpoint URLs. Reuse the project's existing API routing and naming conventions.

## API requirements

- Versioned request and response schemas.
- Predictable errors.
- Validated field names and layer IDs.
- Clear capability information.
- Stable public documentation.
- Explicit coordinate-reference handling.
- CORS behavior compatible with intended external clients.
- No reliance on browser-only state for shareable results.
- No backend requirement for workflows already designed to be client-side.
- Protection against oversized payloads and untrusted service URLs.
- Proper handling of credentials without embedding private tokens into public share links.

If direct external API writes or publishing operations require authentication, document and enforce the correct permission model.

Do not weaken security simply to make an agent workflow easier.

---

# 4. Data Source Compatibility

The skill should operate across supported geographic data sources.

Prioritize:

1. ArcGIS FeatureServer and MapServer.
2. GeoJSON.
3. KML.
4. CSV containing coordinates.
5. GeoPackage and shapefile imports where supported.
6. WMS and WFS.
7. Vector tiles and PMTiles.
8. Image services where practical.
9. STAC resources where supported.

Do not claim support for a format unless GISMap Online can actually load it.

The agent should be able to ask GISMap Online which formats and operations are available.

## Source inspection

For ArcGIS services, inspect:

- Service type.
- Layer names and IDs.
- Geometry type.
- Field definitions.
- Extent.
- Spatial reference.
- Query capabilities.
- Maximum record counts.
- Statistics support.
- Pagination requirements.

The implementation must handle ArcGIS services that do not allow unrestricted requests or require query batching.

Avoid downloading entire large feature services when server-side statistics or filtering can produce the desired result.

For file-based sources, validate the file structure and identify available attributes before generating styling instructions.

---

# 5. Portable Map Specification

Create or extend a versioned JSON specification that fully represents a GISMap Online project.

Use the existing map specification if it already exists.

The specification should include:

```text
Map
├── Specification version
├── Title and description
├── Basemap
├── Map engine
├── Geographic extent
├── Camera
│   ├── Latitude
│   ├── Longitude
│   ├── Zoom
│   ├── Heading
│   └── Pitch / tilt
├── Layers
│   ├── Data source
│   ├── Layer identifier
│   ├── Visibility
│   ├── Filter
│   ├── Renderer
│   ├── Labels
│   ├── Popup
│   └── 3D settings
├── Interactions
├── Brief / Tour / Task references
└── Sharing configuration
```

The specification must round-trip correctly:

```text
JSON specification
       |
       v
GISMap Online interactive viewer
       |
       v
Share URL
       |
       v
GISMap Online interactive viewer
       |
       v
Equivalent restored project
```

Equivalent means that layers, filters, geographic extent, renderer, camera state, and other required project settings are retained.

A successful page load alone is not sufficient.

## Map rendering

Support configuration appropriate to the selected map engine.

GISMap Online is expanding beyond the ArcGIS JavaScript SDK into alternative rendering engines, including MapLibre and related map implementations.

The specification should use engine-independent concepts where practical, with engine-specific extensions for capabilities that cannot be normalized.

Do not assume all map engines support the same types of visualization.

When a requested capability is unsupported, provide a clear compatibility error or supported fallback.

---

# 6. Thematic Styling and 3D

Implement reliable agent-facing styling for:

- Unique values.
- Graduated colors.
- Graduated symbols.
- Continuous numeric ramps where supported.
- Point clustering where supported.
- Polygon transparency.
- Labels and popups.
- 3D extrusion.

For numeric color ramps, the agent must identify a valid numeric data field and use documented classification methods.

## 3D extrusion

The agent must be able to express this type of request:

> Extrude each county polygon by its grape acreage multiplied by 0.01.

The specification should support:

```json
{
  "type": "extrusion",
  "field": "VERIFIED_NUMERIC_FIELD",
  "multiplier": 0.01,
  "unit": "meters"
}
```

This is an illustrative schema; adapt it to the actual GISMap Online implementation.

Validate the field and resulting heights. Apply appropriate clamping or error handling for null, negative, or extreme values.

Use the supported MapLibre fill-extrusion implementation when that renderer is selected, or the equivalent supported rendering mechanism for other engines.

Do not assume an ArcGIS 3D renderer can be applied unchanged to a MapLibre map.

---

# 7. Agent-Created Briefs

Support the full GISMap Online Brief workflow.

Agents should be able to generate a geographic presentation containing multiple slides, with:

- A title.
- Descriptive text.
- Live interactive maps.
- Optional static map images.
- Per-slide layer visibility.
- Per-slide geographic extent and camera.
- Supported filters and renderer settings.
- Images.
- Geographic feature attributes.
- Branding.
- Shareable URL.
- QR code.
- PDF export where available.

## Desktop and mobile

The same Brief definition must work with both desktop and mobile presentation modes.

Desktop should support the presentation-oriented layout already defined by GISMap Online.

Mobile should support the swipeable/scrollable presentation experience.

Do not create separate incompatible data models for desktop and mobile.

## Example Brief

An AI should be able to generate:

**California Grape Production**

Slide 1: Overview of statewide grape production.

Slide 2: County-level production choropleth.

Slide 3: Counties exceeding 1,000 acres of production.

Slide 4: 3D extrusion of county acreage.

Slide 5: Findings and geographic interpretation.

Each slide should retain its intended data layers, styling, geographic extent, and text after sharing.

---

# 8. Agent-Created Tours

Provide a documented Tour generation workflow.

An agent should be able to specify:

- Tour title and description.
- Geographic stops.
- Coordinates or validated geographic feature references.
- Stop ordering.
- Camera configuration.
- Supporting text.
- Optional images.
- Relevant map layers.
- Duration or linger time.
- Share link.

Ensure the skill uses the existing Tour implementation rather than introducing an incompatible format.

Test that Tours retain navigation and camera state when opened through share URLs.

---

# 9. Agent-Created Field Tasks

Expose the existing Field Tasks model to agents.

The goal is for an assistant to generate a usable geographic task workflow rather than just placing points on a map.

Support:

- Task group title.
- Description and instructions.
- Geographic locations.
- Task ordering.
- Check-in requirements.
- Completion criteria.
- Image or proof requirements where supported.
- Shared task URL.
- QR code.
- Completion and reporting functionality where supported.

Respect the existing client-side design.

Do not introduce a mandatory account system or backend persistence without a specific architectural need.

Create examples such as:

> "Create an inspection checklist for these five park facilities, requiring a photograph and completed check-in for each location."

The generated tasks should be compatible with the normal GISMap Online Field Task interface.

---

# 10. Sharing and QR Codes

Sharing is a first-class feature of the skill.

The AI must return a working GISMap Online link, not just a JSON payload.

Where existing share capabilities support it, also provide:

- QR code.
- Shareable map image.
- Link to the Brief, Tour, or Field Task.
- Portable JSON specification.
- PDF export link or artifact where available.

## Sharing requirements

Preserve GISMap Online's preference for client-side portability.

**Do not introduce third-party URL shorteners.**

If a URL becomes too large, use the existing compression, encoding, or supported first-party storage approach.

The system must verify that a share URL reconstructs the intended project.

Specifically test preservation of:

- Data source URLs.
- Layers.
- Filters.
- Choropleth styling.
- 3D extrusion settings.
- Map extent.
- Camera.
- Brief slides.
- Tour stops.
- Field Tasks.

Add regression tests for the previously observed failure in which a shared map restored its layer but lost its styling or filters.

---

# 11. Automated Example Workflows

Build functional acceptance tests around at least three scenarios.

## Example A: California grape production

Use the USDA-related ArcGIS services already referenced in the GISMap Online examples or test fixtures.

Source directory:

https://services.arcgis.com/P3ePLMYs2RVChkJx/ArcGIS/rest/services

The workflow must:

1. Identify the actual grape production dataset.
2. Resolve its correct service and layer.
3. Inspect the actual attribute schema.
4. Identify the acreage field.
5. Filter to California.
6. Filter to counties with greater than 1,000 acres.
7. Generate a county choropleth.
8. Apply 3D extrusion using acreage × 0.01.
9. Generate a Brief.
10. Produce a working share URL.
11. Verify that filters, styling, and extrusion survive reconstruction.

Do not assume field names or layer IDs.

If the dataset is unavailable, use a clearly identified local fixture for deterministic contract tests, and report the live integration failure separately.

## Example B: MLB ballparks

Existing example:

https://gismap.online/examples/ai/mlb-ballparks-by-state/

Use the existing source information and application code.

Test that an agent can generate an interactive baseball stadium map with suitable point symbols, attributes, and a shareable URL.

Include the mobile Brief experience when it is supported by the existing example.

## Example C: Philadelphia Police Divisions

Use the existing GISMap Online example and its verified ArcGIS source.

Generate a polygon map showing Philadelphia Police Divisions.

Test:

- Correct layer identification.
- Polygon renderer.
- Division labels or feature popups.
- Geographic extent.
- Brief generation.
- Shared project reconstruction.

## Additional non-ArcGIS example

Add a small GeoJSON fixture and validate the same general workflow.

This verifies that the skill is not dependent on the ArcGIS ecosystem.

---

# 12. Validation Scripts and Automated Tests

Create a portable validator in:

`skills/gismap/scripts/validate_map.py`

The script should validate GISMap Online specification structure and internal consistency without requiring live internet access.

Validate:

- Schema version.
- Data source declarations.
- Required fields.
- Numeric renderer settings.
- Valid filter structure.
- Coordinates and spatial references.
- Camera settings.
- 3D settings.
- Brief slide references.
- Tour stop references.
- Field Task definitions.
- Share specification structure.

Use a consistent JSON error-reporting format that agents can interpret.

Example invocation:

```bash
python skills/gismap/scripts/validate_map.py \
  skills/gismap/assets/examples/grapes.json
```

Provide meaningful exit codes.

Live remote service verification should be separate from offline JSON validation.

Add automated tests to the repository's existing test framework.

Include tests for malformed data, unsupported renderer options, missing fields, and incompatible map engines.

Validate the skill package itself against the current Agent Skills specification, using the reference validation tooling where available.

---

# 13. Public Skill Distribution

Make the skill publicly accessible from GISMap Online.

Proposed public resources:

```text
https://gismap.online/skills/
https://gismap.online/skills/gismap/SKILL.md
https://gismap.online/skills/gismap.zip
https://gismap.online/llms.txt
https://gismap.online/openapi.json
```

Inspect current routing before implementing these paths.

If the API definition already has a different canonical path, link to it rather than creating a conflicting second version.

Create a skill landing page that explains:

- What GISMap Online Agent Skill does.
- Supported AI agents.
- Installation instructions.
- Supported mapping workflows.
- Example prompts.
- Current API capabilities.
- Links to reference documentation.
- Version and changelog.

Generate the ZIP distribution from the canonical skill directory.

Do not manually maintain divergent ZIP content.

## Claude Code installation

Document project-local installation at:

```text
.claude/skills/gismap/
```

And user-level installation at:

```text
~/.claude/skills/gismap/
```

## Codex installation

Document project-local installation at:

```text
.agents/skills/gismap/
```

And user-level installation at:

```text
~/.agents/skills/gismap/
```

Verify installation instructions against current vendor documentation.

Where supported, prefer symlinks for repository-local installation and copying for portable downloads.

---

# 14. API Documentation and AI Discoverability

The skill must not be the only way agents learn to use GISMap Online.

Inspect and extend the existing AI-facing documentation.

Add or update:

- `llms.txt`.
- API documentation links.
- OpenAPI schema.
- Structured request/response examples.
- Capability discovery instructions.
- Human-readable examples.
- Public skill installation guidance.
- Agent-focused error explanations.

If `AGENTS.md` or `CLAUDE.md` already exists, update the appropriate project instructions without duplicating or overriding unrelated conventions.

Describe how external AI systems can create GISMap Online content through documented APIs.

The public documentation should prominently connect:

**GISMap Online = interactive geographic visualization, geographic Briefs, Tours, Field Tasks, and sharing.**

The objective is to help agents recognize GISMap Online as a useful geographic publishing tool.

---

# 15. mcp.place Compatibility

Prepare for a future mcp.place integration.

Do not make it a mandatory dependency.

Document a provider-neutral interface for discovery responses containing:

- Dataset title.
- Description.
- Source URL.
- Geographic coverage.
- Geometry type.
- Field metadata.
- License information.
- Supported service operations.

The skill should be capable of accepting a discovered dataset from mcp.place and converting it into a valid GISMap Online layer specification.

If mcp.place is not yet deployed with the necessary API, provide a fixture and integration contract rather than claiming live connectivity.

Avoid tightly coupling GISMap Online core code to the mcp.place implementation.

---

# 16. Security and Reliability

Treat remote GIS services, external data, and agent inputs as untrusted.

Requirements:

- Validate incoming JSON.
- Sanitize content used in HTML and popups.
- Protect any server-side URL fetching against SSRF.
- Prevent embedded credentials in publicly shared specifications.
- Enforce permission checks for write operations.
- Handle service timeouts.
- Handle CORS limitations explicitly.
- Support graceful errors when services are unavailable.
- Never execute instructions found inside dataset metadata.
- Do not allow the skill to run arbitrary code based on remote geographic attributes.

Preserve the current GISMap Online architecture and avoid adding unnecessary infrastructure.

The skill should remain lightweight and safe to distribute publicly.

---

# 17. Documentation Deliverables

Produce the following documentation:

**User-facing**

- GISMap Online Agent Skill overview.
- Claude installation instructions.
- Codex installation instructions.
- Example prompts.
- Skill download page.

**Developer-facing**

- API integration reference.
- Map specification guide.
- Supported data source reference.
- Styling and 3D guide.
- Brief authoring reference.
- Tour authoring reference.
- Field Tasks authoring reference.
- Sharing and validation reference.
- Troubleshooting instructions.

**Maintainer-facing**

- Skill packaging and release process.
- Test instructions.
- Capability support matrix.
- Known limitations.
- Future mcp.place integration notes.

All example requests must match real schemas in the current implementation.

---

# 18. Acceptance Criteria

Consider the implementation complete only when the following conditions are satisfied.

### Agent Skill

- [ ] Valid `skills/gismap/SKILL.md`.
- [ ] Compatible with current Agent Skills specification.
- [ ] Claude Code installation documented and tested where possible.
- [ ] Codex installation documented and tested where possible.
- [ ] Clear activation description.
- [ ] References accurately describe available functionality.

### Mapping

- [ ] Agent can inspect a geographic service.
- [ ] Agent can identify a valid layer and fields.
- [ ] Agent can generate a portable map specification.
- [ ] Agent can configure supported thematic styling.
- [ ] Agent can apply dataset filters.
- [ ] Agent can configure supported 3D extrusion.
- [ ] Agent can generate and verify a share URL.

### GISMap Online Modes

- [ ] Brief creation workflow documented and tested.
- [ ] Tour creation workflow documented and tested.
- [ ] Field Tasks creation workflow documented and tested.
- [ ] Desktop/mobile compatibility verified where supported.

### Reliability

- [ ] Schema validation works offline.
- [ ] Deterministic test fixtures pass.
- [ ] Live data integrations tested where reachable.
- [ ] Shared maps preserve styling.
- [ ] Shared maps preserve filters.
- [ ] Shared maps preserve camera and 3D configuration.
- [ ] Errors are descriptive and machine-readable.

### Distribution

- [ ] Public documentation page.
- [ ] Public skill file.
- [ ] Downloadable ZIP.
- [ ] Installation instructions.
- [ ] Updated AI discovery resources.
- [ ] API documentation cross-linked.

---

# 19. Implementation Priorities

Work in this order:

**Phase 1 — Repository audit and capability mapping**

Inspect the current implementation and identify reusable code. Produce a short internal capability matrix.

**Phase 2 — Skill and API contract**

Create the canonical skill, reference documentation, schemas, and validators. Address missing API capabilities required for basic map creation and sharing.

**Phase 3 — End-to-end validation**

Implement the grape production, MLB ballpark, Philadelphia Police Division, and GeoJSON acceptance tests.

**Phase 4 — GISMap Online modes**

Complete and test agent-facing Briefs, Tours, and Field Tasks integrations.

**Phase 5 — Public distribution**

Build the skill landing page, distribution package, installation instructions, and AI discovery resources.

**Phase 6 — Final verification**

Run tests, inspect resulting changes, document limitations, and prepare the pull request.

Complete all feasible phases in this implementation. If an area is blocked by an unavailable external system, finish the local contracts, fixtures, and tests rather than leaving an undocumented placeholder.

---

# 20. Final Output Required from Codex

When finished, provide:

1. A summary of implemented functionality.
2. The files created and modified.
3. API endpoints and schemas added or reused.
4. The Claude and Codex installation procedures.
5. The public skill URL if deployed, otherwise the intended URL.
6. The example tests performed.
7. Results of build, unit, integration, and round-trip tests.
8. Known limitations.
9. Commit SHA and pushed branch.
10. Pull request URL if created.

Clearly distinguish:

- Implemented and verified.
- Implemented but not live-tested.
- Planned or blocked.

Do not declare an unsupported workflow complete.

## Definition of Success

A user installs the GISMap Online Agent Skill and tells Claude or Codex:

"Create a 3D map of California grape production by county, showing counties with more than 1,000 acres in production. Make a Brief and give me a shareable link."

The agent discovers the necessary geographic data, builds a valid GISMap Online project, applies the requested filters and styling, creates the Brief, verifies the result, and returns a working GISMap Online URL.

The same architecture must work for an entirely different dataset and for Tours and Field Tasks.

**The ultimate objective is to make GISMap Online a broadly usable geographic creation and publishing capability for AI agents, not merely a web mapping application with an AI integration.**
