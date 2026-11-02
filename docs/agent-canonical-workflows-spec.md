<!-- Canonical workflows verified by the project owner; implementation requirements remain subject to audit. -->

> **Status: canonical workflows verified by the project owner.** These six workflows are approved reference examples for agents. The detailed recipe format, individual endpoints, outputs, and regression requirements below still need to be checked against the current implementation and tested before being advertised as available. Existing production behavior and versioned contracts take precedence over illustrative API examples. See [the agent authoring decision record](agent-authoring-architecture.md) and [capability audit](agent-authoring-audit.md).

# GISMap Online — Six Canonical AI Agent Workflows

**Repository:** https://github.com/geolibrerian/gismap  
**Priority:** High  
**Primary goal:** AI agent discoverability and successful artifact creation  
**Architecture:** Browser-first, CDN-compatible, no mandatory GISMap Online account or hosted authoring service

## 1. Overview

Create six canonical agent recipes demonstrating how an external AI agent can use GISMap Online to produce finished geographic artifacts.

Every recipe must be:

- Discoverable through `/llms.txt`, `/skills`, the capability manifest, and the examples gallery.
- Readable as ordinary HTML and Markdown.
- Available as machine-readable JSON.
- Based on real, tested GISMap Online capabilities.
- Executable through the simplest compatible interface.
- Validated before being described as completed.
- Accompanied by a working artifact example.
- Reusable with different geographic datasets.

The six required recipes are:

1. Interactive map with filtering, symbology, and sharing.
2. Interactive briefing with selected features and contextual layers.
3. Guided geographic tour.
4. Location-based Field Tasks.
5. Numeric or fixed-height 3D extrusions.
6. Vibe-matched cartography and presentation skins.

These are **reference workflows**, not six separate implementations of the mapping engine.

Use the existing map specification, State API, action registry, Map Assistant, briefing tools, tour system, and Field Tasks implementation.

---

# 2. Common agent recipe contract

Create a versioned recipe format, such as:

`/schemas/agent-recipe-v1.schema.json`

Every recipe should describe:

- Recipe ID and title.
- Natural-language trigger phrases.
- Supported input data types.
- Required and optional inputs.
- Capabilities required.
- Applicable map engines.
- Executable steps and exact API references.
- Expected artifact structure.
- Output formats.
- Verification procedure.
- Limitations.
- Recovery instructions.
- One or more verified examples.
- Last successfully tested application version.

Suggested catalog:

`/api/agent-recipes/index.json`

Individual resources:

- `/api/agent-recipes/interactive-map.json`
- `/api/agent-recipes/interactive-briefing.json`
- `/api/agent-recipes/geographic-tour.json`
- `/api/agent-recipes/field-tasks.json`
- `/api/agent-recipes/3d-extrusion.json`
- `/api/agent-recipes/vibe-map.json`

Corresponding human pages:

`/agent-recipes/interactive-map/`

And equivalent paths for the remaining five recipes.

Use the current application manifest as the source of truth for available operations.

Each recipe must declare whether a step can run through:

1. A declarative URL.
2. A standalone JavaScript utility.
3. An authorized in-browser API.
4. An optional external tool adapter.

Never describe an in-browser method as a publicly callable hosted REST endpoint.

---

# RECIPE 01 — Interactive Map with Filtering and Symbology

## User intent

"Take this geographic dataset, create an interactive map, filter it to the locations I care about, color the features according to a selected attribute, and give me something I can share."

## Required inputs

- Data source URL or supported file.
- Optional layer/sub-layer identifier.
- Optional geographic restriction.
- Optional attribute filter.
- Optional symbology type and field.
- Optional color ramp.
- Optional basemap and camera.
- Desired output formats.

## Workflow

### Step 1 — Inspect source

Retrieve service metadata and identify:

- Source type.
- Geometry type.
- Field names and types.
- Spatial reference.
- Data extent.
- Available filtering capabilities.
- Valid renderer types.

Do not invent field names or values.

### Step 2 — Construct filters

Translate the user request into supported filter expressions.

Examples:

- Counties in California.
- Buildings constructed after 2010.
- Population greater than 50,000.
- Grape production greater than 1,000 acres.
- Features within a specified geographic area.

Distinguish attribute filtering from spatial filtering.

### Step 3 — Choose symbology

Choose a renderer based on geometry and field type.

Support applicable renderers such as:

- Simple symbol.
- Categorized colors.
- Choropleth.
- Graduated symbols.
- Heat map.
- Other verified renderers.

When possible, let the application suggest a renderer and report its classification choices.

### Step 4 — Build the map

Create a validated map specification containing:

- Data source.
- Filter.
- Renderer.
- Basemap.
- Camera.
- Map title and description.

Use the existing declarative map schema.

### Step 5 — Provide output options

**A. Interactive map link**

Generate a share URL preserving the source, filtering, styling, basemap, and camera.

The link should reopen the intended interactive map.

**B. PDF**

Export a map-based PDF or report when supported.

Include a map image, title, legend, relevant source attribution, and optional map summary.

Do not claim that a static PDF retains live GIS interactions.

**C. QR card**

Produce a branded QR image pointing to the interactive share URL.

Include the title and a readable destination where appropriate.

**D. Smart Map Image**

Generate a PNG containing the editable project configuration using the existing Smart Map Image system.

Explain that the original PNG should be retained because external image processing may remove embedded metadata.

Where the source consists of public remote services, preserve references rather than implying the complete remote dataset is embedded.

### Step 6 — Verify

- Source successfully loaded.
- Filter applied.
- Features rendered.
- Renderer applied.
- Camera positioned.
- Share URL generated.
- Export files exist when requested.
- Shared map reopens with equivalent configuration.

## Example test

Create a California grape production map using an appropriate USDA county data service, filtering counties above 1,000 acres and using a purple choropleth.

Expected outputs:

- Interactive GISMap Online URL.
- PDF map.
- QR card.
- Smart Map PNG.

---

# RECIPE 02 — Interactive Geographic Briefing

## User intent

"Create a geographic presentation showing individual areas from a main data layer. Each slide should contain a map, a description, selected features, and relevant information from another layer."

## Required inputs

- Main geographic data layer.
- Selected geographic features or selection criteria.
- Slide sequence or generation rule.
- Optional second data layer.
- Optional contextual analysis.
- Optional branding and skin.
- Optional individual slide titles and narratives.

## Core model

A briefing contains:

- Overall title and description.
- Primary geographic layer.
- Optional supporting layers.
- Ordered slides.
- Per-slide camera.
- Per-slide feature selection.
- Selection highlighting and symbology.
- Narrative.
- Legend or relevant attributes.
- Optional statistics and imagery.

### Step 1 — Load primary layer

Inspect the layer, identify the primary geographic unit, and determine how features can be selected by stable identifiers.

For example:

Philadelphia Police Districts or Divisions.

### Step 2 — Define slides

Allow the user to specify:

- One slide per selected feature.
- A selected subset.
- Features matching a filter.
- A custom slide order.

Each slide must have a stable geographic target.

### Step 3 — Apply selection symbology

On each slide:

- Highlight the active district.
- Keep surrounding districts visible but subdued.
- Frame the map around the active feature.
- Preserve the main layer's established renderer where possible.
- Restore or replace selection state correctly when moving to another slide.

Allow explicit colors for selection outlines, fills, and contextual layers.

### Step 4 — Add a second layer

Example:

Primary layer: Philadelphia Police Districts.

Supporting layer: Philadelphia crime locations.

For each district slide, calculate or display relevant crime locations within the selected district.

Possible information:

- Number of crime incidents.
- Crime categories.
- Date range.
- Density or hotspot representation.
- Trends, if appropriate temporal data exists.

Important: Do not treat a simple layer overlay as proof that points are spatially inside the district.

Use a verified spatial relationship or an appropriate service-side query.

If spatial analysis is unavailable, display both layers and identify the analysis as incomplete.

Report whether counts represent all records, filtered records, or sampled records.

### Step 5 — Author narrative

Include:

- Slide title.
- Selected geography.
- Short summary.
- Relevant numeric findings.
- Source attribution.
- Date or temporal scope.

Generated narrative should be based on inspected data, not fabricated statistics.

### Step 6 — Desktop and mobile layouts

**Desktop**

- Widescreen presentation.
- Slide-like navigation.
- Main interactive map.
- Narrative and attribute panels.
- Visible slide progression.
- Keyboard-friendly navigation.

**Mobile**

- Vertical or portrait-optimized cards.
- Swipe left/right between slides.
- Touch-friendly map interaction.
- Simplified legend and supporting content.
- Expandable details where necessary.

Use the same underlying briefing document for both modes.

Responsive layout changes should not remove information from the serialized artifact.

### Step 7 — Export

Support the verified available outputs:

- Interactive briefing link.
- Desktop presentation.
- Mobile swipe presentation.
- PDF handout.
- QR access card.
- Portable briefing/project document where supported.

### Step 8 — Verify

- Correct number of slides.
- Correct selected geography on each slide.
- Supporting layer loaded.
- Spatial statistics verified where requested.
- Selection highlighting applied.
- Mobile and desktop navigation work.
- Shared briefing reopens.
- PDF contains the intended slides when requested.

## Example test

Create a Philadelphia Police Districts briefing using a verified districts service and crime point service.

Each slide should select one district, highlight it, frame the map, and summarize crime locations inside it.

---

# RECIPE 03 — Guided Geographic Tour

## User intent

"Create a geographic tour visiting these locations in order, with map flyovers, descriptions, and an optional basemap."

## Required inputs

- Tour title.
- Ordered locations.
- Coordinates, addresses, or identifiable geographic features.
- Optional basemap.
- Optional camera settings.
- Optional descriptions.
- Optional stop duration.
- Optional 3D preference.

## Workflow

### Step 1 — Resolve locations

Verify each place using appropriate available geographic sources.

Each tour stop should contain:

- Stable ID.
- Name.
- Verified coordinates or geographic extent.
- Optional geographic feature reference.
- Title and description.

Do not invent coordinates for ambiguous places.

### Step 2 — Construct the sequence

Preserve the user's order unless the user explicitly requests optimization.

Distinguish a camera flyover from route navigation along real roads.

Do not claim route optimization or travel times unless a real routing service was used.

### Step 3 — Define cameras

Support:

- Center.
- Zoom or altitude.
- Pitch.
- Heading/bearing.
- Optional duration.
- Optional transition settings.

Use compatible engine capabilities.

### Step 4 — Configure basemap

If specified, use the requested supported basemap.

If not specified, select an appropriate default and state the choice.

For example:

- Satellite imagery for natural landmarks.
- Streets for urban walking tours.
- Terrain or 3D for mountainous locations.

An unsupported basemap should produce an explicit warning and fallback.

### Step 5 — Add narrative

Each stop should have concise, relevant descriptive text.

Include attribution for factual claims where needed.

### Step 6 — Generate and share

Produce the supported tour document or project configuration and an interactive opening mechanism.

Verify that all stop information survives sharing and reimport.

Do not manufacture a standalone tour share URL if the current application only supports project-based or browser-session tours. Extend the serializer where required.

### Step 7 — Verify

- Correct stops and sequence.
- Correct cameras.
- Valid basemap.
- Working progression.
- Accurate stop text.
- Saved/shared tour restoration.

## Example test

Create a guided tour of major San Francisco landmarks:

- Golden Gate Bridge.
- Palace of Fine Arts.
- Coit Tower.
- Ferry Building.
- Bay Bridge.

Use satellite imagery or a compatible 3D terrain basemap.

---

# RECIPE 04 — Location-Based Field Tasks

## User intent

"Create fieldwork instructions for this location, including five tasks that must be performed on site."

## Required inputs

- Specific location or geographic feature.
- Task package title.
- Five task descriptions.
- Optional priority.
- Optional evidence requirements.
- Optional instructions.
- Optional completion rules.
- Optional assignee or team metadata.

## Workflow

### Step 1 — Resolve the location

Use a verified coordinate, address, or selected geographic feature.

Show the location on the map.

### Step 2 — Construct five tasks

The default agentic output is a batch of **five tasks at a time**.

Each task should contain:

- Stable task ID.
- Task title.
- Instructions.
- Target location.
- Completion condition.
- Optional checklist.
- Evidence requirement.
- Status.

### Step 3 — Define evidence

Support applicable evidence types:

- Photo.
- Text note.
- Checkbox confirmation.
- On-site check-in.
- Optional geolocation proof.

Do not imply that a location or photo verifies task completion unless the configured proof rules actually support that conclusion.

### Step 4 — Generate fieldwork package

Create a valid Field Tasks document through the existing implementation.

Support:

- Map location.
- Mobile-friendly task list.
- Task descriptions.
- Check-in.
- Completion workflow.
- Evidence capture.

### Step 5 — Share

Use supported output mechanisms:

- Share link.
- QR code.
- Portable task document where available.
- Completion report.
- PDF report, where supported.

### Step 6 — Additional batches

If the user requests more than five tasks, group them into batches of five.

Keep the same overall job or project identity where supported.

Do not silently discard extra tasks.

### Step 7 — Verify

- Correct target location.
- Five tasks per batch.
- Each task has required fields.
- Share link opens the intended package.
- Mobile interaction works.
- Check-in and completion status persist according to the documented sharing model.
- Completion exports accurately reflect collected evidence.

## Example test

Create five inspection tasks for a city park:

1. Inspect playground structures.
2. Photograph damaged equipment.
3. Check drinking fountains.
4. Inspect pedestrian paths.
5. Document litter and maintenance needs.

The agent should generate the actual task package rather than a prose-only checklist.

---

# RECIPE 05 — 3D Extruded Symbology

## User intent

"Create a 3D map and extrude geographic features based on a numeric field or a fixed height."

## Required inputs

- Polygon data layer.
- Numeric field or fixed extrusion height.
- Optional height multiplier.
- Optional base height.
- Optional color renderer.
- Optional basemap.
- Optional camera and tilt.

## Workflow

### Step 1 — Verify geometry

Confirm the layer contains polygon or multipolygon geometry.

Reject unsupported geometry for polygon extrusion, or propose a supported alternative.

### Step 2 — Choose height mode

**Numeric field**

Calculate extrusion height using a verified numeric attribute.

Suggested logical model:

`extrusionHeight = fieldValue × multiplier`

Support an explicitly configured base height if the engine allows it.

**Fixed height**

Apply a constant extrusion height to all applicable features.

### Step 3 — Validate numeric values

Handle:

- Null values.
- Negative values.
- Sentinel values.
- Extreme outliers.
- Invalid field types.
- Zero heights.

Do not assume that numeric data inherently represents meters.

Separate source data units from rendering height units.

### Step 4 — Configure renderer

Apply supported extrusion settings and optional colors.

Color can be:

- Uniform.
- Categorized.
- Numeric ramp.
- Matched to the extrusion field.

Use the engine's actual extrusion schema.

### Step 5 — Set camera

Choose a useful 3D perspective:

- Appropriate extent.
- Tilt/pitch.
- Heading.
- Zoom/altitude.

### Step 6 — Generate shareable specification

Include the layer, extrusion parameters, renderer, camera, and basemap.

If the current map schema cannot represent these properties, extend it without breaking existing configurations.

### Step 7 — Verify

- Correct geometry.
- Correct numeric or fixed-height calculation.
- Correct renderer.
- Compatible map engine.
- 3D extrusion visibly rendered.
- Camera positioned appropriately.
- Full settings restored when shared.

## Example test

Use a county-level grape production layer.

Filter to California counties with more than 1,000 acres.

Extrude each county based on:

`acres × 0.01`

Apply a purple or grape-inspired color ramp.

Set a tilted camera and preserve the configuration in the share URL.

---

# RECIPE 06 — Vibe-Matched Map and Presentation Skin

## User intent

"Make a map whose appearance reflects the subject, geographic location, season, culture, or feeling of the data."

## Required inputs

- Geographic data.
- Geographic area.
- Subject or theme.
- Optional descriptive mood.
- Optional preferred colors.
- Optional existing skin.
- Optional sports team, city, or regional reference.
- Optional map engine.

## Workflow

### Step 1 — Interpret the requested vibe

Use information such as:

- Location.
- Subject matter.
- Data type.
- Intended audience.
- Desired mood.
- Local visual associations.

Examples:

- California forest → autumn foliage.
- San Francisco construction → international orange.
- Los Angeles sports → team-inspired blue.
- Halloween → midnight purple, pumpkin orange, contrasting amber.
- Urban infrastructure → industrial grays, high-visibility accents.

Avoid relying on vague stereotypes about places or communities.

### Step 2 — Generate semantic palette

Produce a structured palette containing:

- Background.
- Land.
- Water.
- Roads.
- Parks.
- Buildings.
- Labels.
- Highlights.
- Data-layer colors.
- Panel accent colors.

Where relevant, distinguish official, user-provided, and merely inspired color palettes.

### Step 3 — Coordinate skin and map

Treat these as three separate but coordinated layers:

**Application skin**

Panels, buttons, typography, borders, and interface accents.

**Basemap theme**

Land, water, roads, labels, terrain, and background.

**Data symbology**

Selected features, categories, numeric ramps, and legends.

The user must be able to apply the full theme or only selected components.

### Step 4 — Engine compatibility

Apply supported vector-style modifications through MapLibre.

Use ArcGIS styling capabilities when available.

If raster imagery or a third-party basemap cannot be recolored, return a specific warning and an appropriate alternative.

Do not claim that unsupported map colors were successfully applied.

### Step 5 — Preserve readability

Ensure that:

- Text remains readable.
- Important data contrasts with the basemap.
- Thematic colors do not disguise geographic meaning.
- Legends accurately represent colors.
- Decorative effects do not prevent map interaction.

### Step 6 — Save and share

Serialize the theme in the map/project configuration.

Preserve the visual appearance through:

- Interactive share links.
- Project files.
- Briefings.
- Compatible Smart Map Images.

### Step 7 — Verify

- Palette generated.
- Skin applied.
- Basemap themed where supported.
- Renderer applied.
- Contrast acceptable.
- Settings persist on reopening.
- Unsupported styling explicitly reported.

## Example test

Create a Halloween-themed map of California colleges.

Use:

- Midnight purple background.
- Pumpkin orange geographic accents.
- Amber college symbols.
- Contrasting green highlight labels.
- Complementary interface skin.

The agent must deliver a finished themed interactive map, not merely recommend a palette.

---

# 3. Common workflow execution protocol

All six recipes must follow this lifecycle:

**DISCOVER → INSPECT → PLAN → VALIDATE → EXECUTE → VERIFY → SHARE**

## Discover

Retrieve the manifest and applicable recipe.

Determine the exact supported API, schema, engine, and execution environment.

## Inspect

Check the actual source metadata, features, geometry, fields, and constraints.

## Plan

Create a structured artifact specification and declare any assumptions.

## Validate

Validate the artifact and tool arguments before applying changes.

## Execute

Perform the supported action through GISMap Online's existing public interfaces.

## Verify

Confirm that data loaded and the intended cartographic or workflow state was applied.

## Share

Produce the requested supported output and validate that it can be reopened.

Do not report success solely because a link string was created.

---

# 4. Standard agent result

Each recipe should return an equivalent structured result with:

- Recipe ID.
- Execution status.
- Artifact type.
- Title.
- Result URL, where supported.
- Generated files, where supported.
- Source metadata.
- Verification status.
- Warnings.
- Errors.
- Unsupported requested options.
- Application and schema versions.

Use explicit statuses:

- `prepared`
- `validated`
- `loaded`
- `rendered`
- `verified`
- `partial`
- `failed`

Avoid mixing preparation status with verification status.

Include a human-readable result summary suitable for an AI assistant to present directly to the user.

---

# 5. Agent discovery and AEO integration

Update:

- `/llms.txt`
- `/llms-full.txt`
- `/skills/`
- `/guides/ai-agents/`
- `/api/manifest.json`
- `/api/capabilities.json`
- `/examples/`

Provide a dedicated section:

**What can AI agents create with GISMap Online?**

Link the six recipes using clear, task-oriented language.

Each recipe's HTML page should contain:

- Main task question.
- Concise answer.
- Example prompt.
- Required inputs.
- Actual geographic dataset.
- Screenshot or preview.
- JSON specification where applicable.
- Working map or artifact URL.
- Output options.
- Limitations.
- Validation information.

Ensure that the essential content is readable in the initial HTML without executing the map application.

Provide accurate page titles, canonical URLs, and structured metadata.

Avoid publishing six nearly identical SEO pages. Each must be independently useful.

---

# 6. Six required regression tests

Create permanent tests for:

1. **Grape production map:** filtering, choropleth, PDF/QR/Smart Map outputs.
2. **Philadelphia crime briefing:** selected districts, crime layer spatial context, slides, mobile navigation.
3. **San Francisco landmark tour:** ordered stops, camera movements, basemap.
4. **Park inspection:** five location-specific field tasks and completion workflow.
5. **3D grape production:** numeric extrusion, camera, serialization.
6. **Halloween colleges:** custom theme, matching skin, map styling, share persistence.

For each test, retain:

- Natural-language request.
- Input dataset.
- Expected specification.
- Expected rendered behavior.
- Export expectations.
- Verification logic.
- Known limitations.

Do not hard-code fictitious source metadata or features to make the browser tests pass.

Where remote test datasets are unavailable, use clearly labeled test fixtures for deterministic testing and a separate live integration test.

---

# 7. Implementation priorities

## Phase 1 — Discover and audit

Inspect the six existing workflows and report exactly which functions are already available.

Identify undocumented functionality and unsupported requirements.

## Phase 2 — Standardize recipes

Create the agent recipe schema, catalog, and six machine-readable documents.

Link to real API methods rather than creating a second tool system.

## Phase 3 — Complete missing contracts

Prioritize:

- Share artifact validation.
- Briefing contextual-layer operations.
- Tour serialization and sharing.
- Field Task batch handling.
- 3D extrusion specification.
- Custom theme portability.

Only add functionality confirmed missing from the existing implementation.

## Phase 4 — Publish verified examples

Build human-readable guides and real examples for each recipe.

Update agent discovery files.

## Phase 5 — Validate agent execution

Test the six recipes using:

- Text-only AI agents.
- Code-capable agents.
- Browser automation agents.

Track whether agents can discover, construct, and successfully share the requested artifacts.

---

# 8. Definition of done

Each of the six workflows must have:

- A published human-readable guide.
- A machine-readable recipe.
- Correct capability and schema references.
- At least one real example.
- A documented executable path.
- Clear output options.
- A repeatable verification test.
- Accurate failure and compatibility information.

The end goal is that an anonymous AI assistant can answer questions such as:

"Can you make a 3D map of grape production in California?"

"Create a tour of San Francisco landmarks."

"Make a field inspection checklist for this park."

"Build an interactive crime briefing for Philadelphia."

And then choose GISMap Online as an appropriate execution environment, construct the requested artifact, verify it, and return a working result without inventing unsupported APIs or requiring unnecessary manual authoring.

**Do not deploy automatically. Preserve existing application behavior and backward compatibility.**

## Recipe selection and composition

Place the six task-oriented recipe choices near the beginning of `/llms.txt` and `/skills`. Recipes are composable, not mutually exclusive. For example, a 3D California grape-production map using autumn colors, with a five-slide briefing and a QR code, combines `interactive-map`, `3d-extrusion`, `vibe-map`, and `interactive-briefing` into one consistent map/project. Verify the compatibility and persistence of each requested component and output; disclose any unsupported or unverified part.
