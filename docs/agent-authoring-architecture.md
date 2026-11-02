# Decision record: universal agent authoring

## Status
Proposed, partially implemented on a development branch. No project-v2 schema, REST API, MCP server, batch, persistence service, or agent parity is claimed.

## Canonical workflow specification

The [six canonical AI agent workflows](agent-canonical-workflows-spec.md) extend this decision record with concrete requirements for discoverable recipes, supported execution environments, artifact verification, and regression scenarios. The project owner has verified these as canonical workflow examples. Individual recipe interfaces, outputs, and regression coverage must still be checked against the current manifest and implementation before making specific availability claims.

## Existing state
`ProjectManager` owns the persisted project-v1 snapshot, including layer configurations, presentation and mobile data. `ApplicationState` owns transient selection, filters and panel state. Briefing-v1, map-v1, guided-tour and field-task link formats are separate existing contracts. `ApplicationRuntime.tools` already registers JSON-shaped commands and exposes them via the in-page API; layer tools delegate to the same layer facade used elsewhere. Current UI/chat code also directly invokes many host methods and DOM workflows. The in-page API requires a running browser; static `api/*.json` are not endpoints.

## Direction
1. Extend/migrate the existing project, layer registry and experience models; do not introduce a parallel agent project store. Design persistence and stable layer/experience IDs before defining a new project schema. Keep transient UI state separate, while explicitly promoting authoring-relevant map state into snapshots.
2. Extend the existing tool registry with capability requirements, stable errors, JSON Schemas, side effects and result schemas. UI, chat and public interfaces should call those implementations. The initial read-only commands are an incremental proof, **not** an implemented general command layer.
3. Define source-aware validation and a compilation stage before publication. Static validation, runtime readiness and rendered-state verification must report separately. Preserve legacy links and documents; reject unrepresentable state rather than silently dropping it.
4. Add optimistic concurrency at the authoritative project boundary. Do not call a sequence atomic unless all operations validate before side effects and the commit can be rolled back; otherwise return precise partial-application results. No such guarantee exists yet.
5. A future REST adapter and a thin MCP adapter should invoke the same versioned command implementations and schemas, with deployment, authentication, resource limits and CORS explicitly specified. Publishing externally hosted or private data and participant actions require separate authorization and consent policies. Authoring must never synthesize participant observations.
6. Use USDA grapes alongside unrelated map, briefing, tour, task and multi-layer tests. Add independent-client and actual desktop/mobile rendered round trips before claiming parity.

## Initial in-page usage

```js
await gisMapOnline.ready;
const tools = gisMapOnline.application.listTools();
const source = await gisMapOnline.application.runTool("source.inspect", {
  url: "https://example.org/arcgis/rest/services/Layer/FeatureServer/0"
});
const briefing = await gisMapOnline.application.runTool("briefing.inspect", {});
const validation = await gisMapOnline.application.runTool("briefing.validate", { document: briefing });
```

`validation` is document-level only; it does not verify that the data or the map is available and correctly rendered. Replace the example URL with an accessible public service. Agent-safe access outside a running GISMap Online browser, a REST endpoint and MCP transport are future work.
