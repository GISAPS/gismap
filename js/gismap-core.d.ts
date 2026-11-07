export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type BriefingFilter = {
  op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "not_in" | "contains" | "starts_with" | "is_null" | "is_not_null" | "and" | "or" | "not" | "feature_ids";
  field?: string;
  value?: JsonValue;
  values?: JsonValue[];
  ids?: Array<string | number>;
  args?: BriefingFilter[];
  arg?: BriefingFilter;
};

export type BriefingCamera = {
  center: [longitude: number, latitude: number];
  zoom: number;
  heading: number;
  tilt: number;
};

export type SpatialChart = {
  type: "spatial-3d-chart";
  mode: "attribute-extrusion" | "temporal-strata" | "stacked-footprints" | "exploded-timeline";
  groupBy?: string;
  groups?: Array<string | number>;
  /** Stacking order from the bottom up; "descending" puts the highest group at the bottom, and colours follow. Default "ascending". */
  order?: "ascending" | "descending";
  /** Also draw the flat source outlines on the ground under the 3D shapes. Default false. */
  groundOutlines?: boolean;
  height: { mode?: "field" | "fixed-slot" | "magnitude"; field?: string; slotMeters?: number; gapMeters?: number; thicknessMeters?: number; scale?: number };
  color?: { field?: string | null; strategy?: "original" | "sequential" };
  geometry?: { strategy: "source-footprints"; aggregation: "none" };
  interaction?: { hover?: boolean; select?: boolean; explode?: boolean; scrubTimeline?: boolean };
};

export type BriefingBlock = {
  id: string;
  type: string;
  [key: string]: unknown;
};

export type BriefingSlide = {
  id: string;
  template: "title" | "feature" | "map-narrative" | "key-numbers" | "actions";
  title: string;
  subtitle?: string;
  featureId?: string | null;
  camera?: BriefingCamera | null;
  fit?: "feature" | "selection" | null;
  blocks: BriefingBlock[];
  notes?: string;
  hidden: boolean;
  /** The briefing's other layers on this slide; without it the slide changes no other layer. */
  layers?: BriefingSlideLayer[];
  /** 3D chart state for the primary layer; null returns this slide to flat geography. */
  spatialChart?: SpatialChart | null;
  [key: string]: unknown;
};

/** As an ArcGIS REST query's spatialRel: contains = features inside the slide's feature, within = features containing it. */
export type SpatialRelationship = "intersects" | "contains" | "crosses" | "envelope-intersects" | "index-intersects" | "overlaps" | "touches" | "within" | "disjoint" | "relation";

export type BriefingSlideLayer = {
  /** The layer's service URL (or ID or title). */
  layer: string;
  visible: boolean;
  /** Show only features with this relationship to the slide's feature. */
  relation?: { type: SpatialRelationship; distance?: number; units?: "meters" | "kilometers" | "feet" | "miles" | "nautical-miles" | "us-nautical-miles"; relationParameter?: string };
};

export type BriefingDocument = {
  schemaVersion: 1;
  layerId?: string | null;
  /** How the map moves between slides: "pan" (default) flies there, "cut" jumps straight there. */
  transition?: "pan" | "cut";
  queries: Record<string, BriefingFilter>;
  selection?: { ids?: string[]; useAll?: boolean; [key: string]: unknown };
  slides: BriefingSlide[];
  [key: string]: unknown;
};

export type ValidationIssue = {
  level: "error" | "warning";
  slideId?: string;
  path?: string;
  message: string;
  [key: string]: unknown;
};

export type SourceMetadata = {
  kind: "arcgis-service" | "arcgis-layer" | "geojson";
  url: string;
  title: string;
  description: string;
  geometryType: string | null;
  objectIdField: string | null;
  maxRecordCount: number | null;
  capabilities: string[];
  fields: Array<{ name: string; alias: string; type: string; role: "numeric" | "timestamp" | "text"; nullable: boolean }>;
  layers: Array<{ id: string | number; name: string }>;
  /** The publisher's scale range; 0 means no limit. maxScale 144447 hides the layer zoomed in past 1:144,447. */
  minScale: number;
  maxScale: number;
  /** [west, south, east, north] in degrees, when the extent is in WGS84 or Web Mercator. */
  extent: [number, number, number, number] | null;
  spatialReference: { wkid?: number; latestWkid?: number } | null;
  /** ISO dates from the service's editingInfo: how current the data is. */
  lastEditDate: string | null;
  dataLastEditDate: string | null;
  schemaLastEditDate: string | null;
  featureCount: number | null;
  /** null means the source did not advertise whether result pagination is supported. */
  supportsPagination: boolean | null;
  supportsStatistics: boolean;
  attribution: string;
  /** Accessibility observed in this runtime; CORS and authentication requirements are not inferred. */
  access: { metadataReadable: boolean; authentication: "unknown"; cors: "not-verified" };
  supportsGenerateRenderer: boolean;
  /** Codes that are not measurements, such as -1 = "Not Disclosed". Heuristic ones are reported, never applied by default. */
  sentinels: Sentinel[];
};

export type Sentinel = { field: string; value: number | string; label: string; source: "renderer" | "domain" | "heuristic" };

export type ErrorCode = "INVALID_URL" | "HTTPS_REQUIRED" | "CREDENTIAL_IN_URL" | "UNSUPPORTED_LAYER_TYPE" | "TOO_MANY_LAYERS" | "LAYER_LOAD_FAILED" | "CORS_BLOCKED" | "SERVICE_ERROR" | "FIELD_NOT_FOUND" | "INVALID_SPEC" | "NOT_READY" | "NOT_FOUND" | "SPEC_TOO_LONG";

/** Thrown by the public API. `hint` says what to do next. */
export declare class GisMapError extends Error {
  code: ErrorCode;
  hint: string;
  details?: Record<string, unknown>;
  constructor(code: ErrorCode, message: string, options?: { details?: Record<string, unknown>; hint?: string; cause?: unknown });
}

export type LayerType = "arcgis-auto" | "feature" | "map-image" | "imagery" | "geojson" | "wms" | "wfs" | "kml";
export type RampName = "greens" | "blues" | "reds" | "oranges" | "purples" | "viridis" | "magma" | "red-blue-diverging" | "brown-teal-diverging";

/** A declarative style (schemas/renderer-v1.schema.json). `exclude` defaults to the layer's detected sentinels. */
export type RendererSpec =
  | { type: "service" }
  | { type: "simple"; color?: string; outline?: string; size?: number }
  | { type: "choropleth"; field: string; classes?: number; method?: BreakMethod; breaks?: number[]; ramp?: RampName; normalizeBy?: string; exclude?: Array<number | string> }
  | { type: "graduated-symbols"; field: string; classes?: number; method?: BreakMethod; breaks?: number[]; color?: string; minSize?: number; maxSize?: number; exclude?: Array<number | string> }
  | { type: "categories"; field: string; maxCategories?: number; colors?: Record<string, string> }
  | { type: "heatmap"; field?: string }
  | { type: "arcgis"; json: Record<string, unknown> }
  /** Chosen from the data when the map opens; saving or sharing records the result with its breaks. */
  | { type: "auto"; field?: string; classes?: number; ramp?: RampName; exclude?: Array<number | string> };

/** "auto" picks quantile for skewed values, natural breaks for clusters, equal interval for even spreads. */
export type BreakMethod = "natural-breaks" | "quantile" | "equal-interval" | "auto";

export type ValueStats = { count: number; excluded: number; missing: number; distinct: number; min: number | null; max: number | null; mean: number | null; median: number | null; skew: number | null; integers: boolean };

export type StyleOption = {
  id: string;
  label: string;
  /** Why this style suits the field, in plain words. */
  reason: string;
  recommended: boolean;
  /** Re-decides its classes from the data each time the map opens. */
  spec: RendererSpec;
  /** spec plus the computed breaks: the same classes for everyone. */
  pinnedSpec: RendererSpec;
  breaks: number[] | null;
};

export type StyleSuggestion = { field: string; stats: ValueStats | { count: number; distinct: number; missing: number }; options: StyleOption[] };

export type RendererIssue = { level: "error" | "warning"; code: ErrorCode; path: string; message: string; hint?: string };

export type AddLayerOptions = {
  type?: LayerType;
  title?: string;
  /** A read-only SQL where clause on the layer's fields. */
  where?: string | null;
  outFields?: string[];
  renderer?: RendererSpec;
  spatialChart?: SpatialChart | null;
  opacity?: number;
  visible?: boolean;
  /** Draw at every zoom level, ignoring the publisher's scale range (kept in projects and links). */
  ignoreServiceScaleRange?: boolean;
  /** Fit the view to the data; default true when this is the first data layer. */
  zoomTo?: boolean;
  signal?: AbortSignal;
};

export type LayerInfo = {
  /** Stable for the session; lookups also accept the service URL (with or without /0) or the title. */
  id: string;
  title: string;
  url: string;
  type: LayerType;
  loadStatus: "loading" | "loaded" | "failed";
  visible: boolean;
  opacity: number;
  where: string | null;
  renderer: RendererSpec;
  spatialChart: SpatialChart | null;
  visibleAtCurrentScale: boolean;
  minScale: number;
  maxScale: number;
  ignoreServiceScaleRange: boolean;
  featureCount: number | null;
  dataLastEditDate: string | null;
  sentinels: Sentinel[];
  error: { code: ErrorCode; message: string; hint: string } | null;
};

export type CameraState = { center: [number, number]; zoom: number; scale: number; heading: number; tilt: number };

/** A whole map as one JSON object (schemas/map-v1.schema.json). */
export type MapSpecLayer = {
  url: string;
  type?: LayerType;
  title?: string;
  where?: string;
  renderer?: RendererSpec;
  spatialChart?: SpatialChart;
  opacity?: number;
  visible?: boolean;
  ignoreServiceScaleRange?: boolean;
  refreshInterval?: number;
  popup?: { fields: string[] };
};
export type MapSpec = {
  $schema?: string;
  version?: 1;
  title?: string;
  description?: string;
  basemap?: string;
  skin?: string;
  camera?: { fit: "layers" | "none" } | { center: [number, number]; zoom?: number; scale?: number; heading?: number; tilt?: number };
  layers: MapSpecLayer[];
  legend?: boolean;
  briefing?: BriefingDocument | null;
};
export type SpecIssue = { level: "error" | "warning"; code: ErrorCode; path: string; message: string; hint?: string };

export type SmartImageManifest = {
  format: "gismap-smart-image";
  version: 1;
  createdAt: string;
  project: Record<string, unknown> & { version: 1; layers: unknown[] };
};

export type SmartImageShare = {
  url: string;
  payload: Record<string, unknown>;
  qr: boolean;
};

export type SmartImageOutput = {
  blob: Blob;
  file: File;
  project: SmartImageManifest["project"];
  /** Null when the project has no public web layer that can travel in a link. */
  share: SmartImageShare | null;
};

export const GISMAP_CORE_VERSION: string;
export const capabilities: Readonly<Record<string, unknown>>;
export const briefing: Readonly<{
  schemaVersion: number;
  templates: ReadonlyArray<{ id: BriefingSlide["template"]; label: string; description: string }>;
  statTypes: readonly string[];
  create(value?: Partial<BriefingDocument>): BriefingDocument;
  migrate(value?: Partial<BriefingDocument>): BriefingDocument;
  validate(value: unknown, options?: Record<string, unknown>): { valid: boolean; document: BriefingDocument; issues: ValidationIssue[] };
  createSlide(template: BriefingSlide["template"], input?: Partial<BriefingSlide> & { fields?: string[]; date?: Date }): BriefingSlide;
  addSlide(document: unknown, slide: BriefingSlide, afterId?: string | null): BriefingDocument;
  updateSlide(document: unknown, slideId: string, patch: Partial<BriefingSlide>): BriefingDocument;
  moveSlide(document: unknown, slideId: string, offset: number): BriefingDocument;
  duplicateSlide(document: unknown, slideId: string): BriefingDocument;
  removeSlide(document: unknown, slideId: string): BriefingDocument;
  updateBlock(document: unknown, slideId: string, blockId: string, patch: Partial<BriefingBlock>): BriefingDocument;
  encode(document: unknown, options?: { compress?: boolean }): Promise<string>;
  decode(value: string): Promise<BriefingDocument>;
  createLink(options: { baseUrl: string; briefing: unknown; qrSafe?: boolean; compress?: boolean }): Promise<string>;
  readHash(hash: string): Promise<BriefingDocument | null>;
}>;
export const queries: Readonly<{
  normalize(value: unknown): BriefingFilter | null;
  matches(filter: BriefingFilter | null, record: Record<string, unknown>): boolean;
  /** Sentinel codes (and `exclude` values) are left out of the statistic and counted in `excluded`. */
  statistic(block: BriefingBlock, records?: Array<{ attributes?: Record<string, unknown> }>, options?: { queries?: Record<string, BriefingFilter>; idField?: string | null; total?: number | null; exclude?: Array<number | string>; sentinels?: Sentinel[]; excludeSentinels?: boolean }): { value: number | null; sample: boolean; loaded: number; total: number | null; matched: number; excluded: number };
}>;
export const sources: Readonly<{
  /** Metadata plus (for queryable ArcGIS layers) a feature count and sample-based sentinel checks; `sample: false` skips the two queries. */
  inspect(url: string, options?: { fetchImpl?: typeof fetch; signal?: AbortSignal; allowHttp?: boolean; sample?: boolean }): Promise<SourceMetadata>;
  detectSentinels(serviceJson: Record<string, unknown>, sampleFeatures?: Array<{ attributes?: Record<string, unknown> }>): Sentinel[];
}>;
export const renderers: Readonly<{
  validate(spec: unknown, options?: { fields?: Array<{ name: string; type?: string }>; geometryType?: string }): { valid: boolean; issues: RendererIssue[]; spec: RendererSpec };
  computeBreaks(values: number[], options?: { classes?: number; method?: Exclude<BreakMethod, "auto"> }): { min: number | null; breaks: number[] };
  compile(spec: RendererSpec, options?: { geometryType?: string; values?: number[]; categories?: Array<{ value: unknown; count: number }>; fieldAlias?: string }): Record<string, unknown> | null;
  rampColors(name: RampName, count: number): string[];
  closestField(name: string, fields: Array<{ name: string } | string>): string | null;
  /** Ranked styles for one field, from its values (pure; pass the values you fetched). */
  suggest(input: { field: string; fieldType?: string; geometryType?: string; values: unknown[]; exclude?: Array<number | string>; ramp?: RampName | null; classes?: number | null }): StyleSuggestion;
  /** A validated spec with "auto" decided and breaks pinned. */
  resolve(spec: RendererSpec, options: { values: unknown[]; fieldType?: string; geometryType?: string }): RendererSpec;
  describeValues(values: unknown[], options?: { exclude?: Array<number | string> }): ValueStats;
  chooseMethod(stats: ValueStats): { method: Exclude<BreakMethod, "auto">; reason: string };
  /** The most measurement-like field (never an ID, code or shape field), or null. */
  chooseField(fields: Array<{ name: string; alias?: string; type?: string }>): string | null;
}>;
export const smartImages: Readonly<{
  format: "gismap-smart-image";
  version: 1;
  chunk: "giMp";
  limits: Readonly<{ maxImageBytes: number; maxEncodedBytes: number; maxProjectBytes: number }>;
  embed(png: Blob | ArrayBuffer | Uint8Array, project: SmartImageManifest["project"]): Promise<Blob>;
  read(png: Blob | ArrayBuffer | Uint8Array): Promise<SmartImageManifest>;
}>;
export const utilities: Readonly<{ safeUrl(value: unknown): string | null }>;

/**
 * The in-page API at globalThis.gisMapOnline.briefing: everything in `briefing`
 * plus calls bound to the open map and project.
 */
export const mapSpec: Readonly<{
  version: 1;
  jsonLimit: number;
  /** The usable spec keeps every layer that can load; layers with errors are dropped and reported. */
  validate(spec: unknown, options?: { allowHttp?: boolean }): { valid: boolean; issues: SpecIssue[]; spec: MapSpec | null };
  /** Offline checks only. not_checked means no claim of service, rendering or reopening verification. */
  prepareVerification(spec: unknown, options?: { baseUrl?: string; compress?: boolean; allowHttp?: boolean }): Promise<{
    version: 1; status: "validated" | "invalid"; checks: Record<string, "passed" | "failed" | "not_checked">;
    url: string | null; warnings: SpecIssue[]; errors: SpecIssue[];
  }>;
  /** The #map= payload: compressed ("z…") or readable ("json:…", at most jsonLimit characters, else SPEC_TOO_LONG). */
  encode(spec: MapSpec, options?: { compress?: boolean }): Promise<string>;
  decode(payload: string): Promise<MapSpec>;
  createLink(spec: MapSpec, options?: { baseUrl?: string; compress?: boolean }): Promise<{ url: string; payload: string; qr: boolean }>;
  /** The spec behind a simple ?layer= link: pass parseShareParameters(url.search) from /js/share.js. */
  fromShareParameters(shared: unknown): MapSpec;
}>;

export type MapSpecApi = typeof mapSpec & {
  /** Applies a spec to the live map; ready resolves when everything that can load has loaded. */
  load(spec: unknown, options?: { replace?: boolean; showIssues?: boolean }): { valid: boolean; issues: SpecIssue[]; spec: MapSpec | null; ready: Promise<{ layers: LayerInfo[]; issues: SpecIssue[] }> };
  fromCurrent(options?: { title?: string }): MapSpec;
  issues(): SpecIssue[];
};

export type LayersApi = {
  add(url: string, options?: AddLayerOptions): Promise<LayerInfo>;
  /** Data layers only (no drawings or other internal graphics). */
  list(): LayerInfo[];
  get(idOrUrlOrTitle: string): LayerInfo | null;
  update(idOrUrlOrTitle: string, patch: Partial<AddLayerOptions>): Promise<LayerInfo>;
  remove(idOrUrlOrTitle: string): boolean;
  /** Fits the filtered data of one layer, or of all data layers when omitted. */
  zoomTo(idOrUrlOrTitle?: string | null, options?: { animate?: boolean }): Promise<void>;
  /** [west, south, east, north] that zoomTo frames (the dense core of data spread over half the world). */
  extent(idOrUrlOrTitle?: string | null): Promise<[number, number, number, number] | null>;
  metadata(idOrUrlOrTitle: string): SourceMetadata | null;
  /** Ranked styles for a field (the most measurement-like when omitted), from all values matching the layer's filter. Apply one with update(id, { renderer: option.pinnedSpec }). */
  suggestStyles(idOrUrlOrTitle: string, options?: { field?: string }): Promise<StyleSuggestion & { fieldAlias: string; geometryType: string; sampled: boolean }>;
};

export type CameraApi = {
  get(): CameraState;
  set(camera: { center?: [number, number]; zoom?: number; scale?: number; heading?: number; tilt?: number }, options?: { animate?: boolean }): Promise<CameraState>;
  fitTo(target?: string | "layers" | [number, number, number, number], options?: { animate?: boolean }): Promise<CameraState>;
};

export type InPageBriefingApi = typeof briefing & {
  get(): BriefingDocument;
  /** Opens a document in Briefing; its layerId (a service URL is loaded when missing) and selection apply. */
  load(document: unknown, options?: { activate?: boolean; present?: boolean; slide?: string; allowInvalid?: boolean }): { valid: boolean; document: BriefingDocument; issues: ValidationIssue[]; ready: Promise<void> };
  captureCamera(): BriefingCamera;
  saveCurrentCamera(slideId: string): BriefingDocument;
  /** Slides from the map as it looks: style, filter, Features-tab choices; optional AI descriptions. */
  generate(options?: { layerId?: string; ai?: boolean; share?: boolean }): Promise<BriefingDocument>;
  /** Browser session only. Preview does not save; statistics use a bounded sample. */
  generateTemplate(options: {
    template: "filter-series" | "timeline" | "grid-atlas" | "spatial-3d-chart"; layerId?: string; previewOnly?: boolean;
    field?: string; kind?: "date" | "year"; start?: string | number; end?: string | number;
    step?: number; unit?: "day" | "week" | "month" | "quarter" | "year"; timeZone?: string;
    mode?: "interval" | "cumulative" | "rolling" | "validity"; rolling?: number; endField?: string;
    stat?: "sum" | "average" | "min" | "max"; statField?: string; narration?: boolean;
    presentationMode?: "single-slide" | "slide-series"; rows?: number; columns?: number;
    targetCells?: number; order?: "row-major" | "column-major" | "snake"; skipEmpty?: boolean;
    countMode?: "assigned" | "intersecting";
    /** Grid Atlas area: the loaded features' extent (default) or the visible map. `bounds` ([west, south, east, north]) sets it explicitly. */
    area?: "features" | "view"; bounds?: [number, number, number, number];
    groupBy?: string; heightField?: string; slotMeters?: number; gapMeters?: number; scale?: number;
  }): Promise<{ document: BriefingDocument; preview: unknown; saved: boolean; coverage: { returned: number; limit: number; exceededTransferLimit: boolean; completeness: "unknown"; note: string } }>;
  /** The landscape PDF handout, with a QR code back to the live briefing. */
  exportPdf(options?: { withLink?: boolean }): Promise<File>;
  /** A branded PNG card whose QR opens the complete live briefing. */
  exportQrCard(document?: unknown, options?: { title?: string; fileName?: string; qrSafe?: boolean; documentOnly?: boolean; slide?: string; baseUrl?: string; compress?: boolean }): Promise<File>;
  /** The full share link (layers, styles, filters, skin, view), or a slides-only link with documentOnly. */
  createLink(document?: unknown, options?: { qrSafe?: boolean; documentOnly?: boolean; slide?: string; baseUrl?: string; compress?: boolean }): Promise<string>;
  /** The .gis project with this briefing, returned without downloading. */
  exportProject(document?: unknown, options?: { fileName?: string }): { fileName: string; mimeType: string; text: string; blob: Blob };
  /** @deprecated Use exportProject. */
  exportGmo(document?: unknown, options?: { fileName?: string }): { fileName: string; mimeType: string; text: string; blob: Blob };
};

/** The Smart Image API bound to the currently open GISMap Online project and map. */
export type InPageSmartImagesApi = typeof smartImages & {
  /** A live-map link preserving public layers, styles, filters, camera, basemap and skin. */
  createShareLink(options?: { baseUrl?: string }): Promise<SmartImageShare>;
  /** Renders a Smart Image in memory without starting a browser download. */
  createCurrent(options?: { width?: number; height?: number; baseUrl?: string }): Promise<SmartImageOutput>;
  /** Renders and downloads a Smart Image; pass download:false to suppress the download. */
  downloadCurrent(options?: { width?: number; height?: number; baseUrl?: string; download?: boolean }): Promise<SmartImageOutput>;
};

declare const core: Readonly<{
  version: string;
  capabilities: typeof capabilities;
  briefing: typeof briefing;
  queries: typeof queries;
  sources: typeof sources;
  smartImages: typeof smartImages;
  utilities: typeof utilities;
}>;
export default core;


/** globalThis.gisMapOnline: the whole in-page API. Stability levels are listed in api/capabilities.json. */
export interface PrintTemplate {
  id: string; name: string; description: string; widthIn: number; heightIn: number;
  supports: { qr: boolean; northArrow: boolean; scaleBar: boolean; legend: boolean; notes: boolean };
}

export interface PrintOptions {
  template?: string; title?: string; subtitle?: string; description?: string;
  marginIn?: number; marginColor?: string; borderPt?: number; borderColor?: string;
  showQr?: boolean; showNorthArrow?: boolean; showScaleBar?: boolean; clickableLinks?: boolean;
  /** "bookmarks" draws one PDF page per bookmark. */
  pages?: "current-view" | "bookmarks";
  /** 48 to 300; wall maps stay under about 6000 px. Defaults: 150 for PDF, 120 for Smart Images. */
  dpi?: number | null;
  waitFor?: "layers" | "idle";
  timeoutMs?: number;
  /** Export even if a layer failed, with a warning in the result. */
  allowPartial?: boolean;
}

export interface PrintResult {
  file: File; blob: Blob; template: PrintTemplate; options: Required<PrintOptions>;
  share?: { url: string; qr: boolean }; warnings: string[];
}

export interface PrintApi {
  templates(): PrintTemplate[];
  getOptions(): Required<PrintOptions>;
  setOptions(options: PrintOptions): Required<PrintOptions>;
  preview(options?: PrintOptions): Promise<Blob>;
  exportPdf(options?: PrintOptions): Promise<PrintResult>;
  exportSmartImage(options?: PrintOptions): Promise<PrintResult & { manifest: unknown }>;
  open(options?: PrintOptions): void;
}

export type InPageApi = {
  print: PrintApi;
  project: {
    exportFile(): { fileName: string; mimeType: string; blob: Blob };
    exportPackage(): Promise<{ fileName: string; mimeType: string; blob: Blob }>;
  };
  version: string;
  /** Resolves once the view, basemap and URL-requested layers have loaded (also: the gismap:ready event, <html data-gismap-state>). */
  ready: Promise<void>;
  describe(): Record<string, unknown> & { state: { status: "loading" | "ready" | "error"; layers: LayerInfo[]; basemap: string; camera: CameraState | null; skin: string | null; mode: string; briefingSlides: number; aiConfigured: boolean; issues: unknown[] } };
  layers: LayersApi;
  camera: CameraApi;
  mapSpec: MapSpecApi;
  briefing: InPageBriefingApi;
  queries: typeof queries;
  sources: typeof sources;
  smartImages: typeof smartImages & Record<string, unknown>;
  capabilities(): typeof capabilities;
  GisMapError: typeof GisMapError;
  getProject(): Record<string, unknown>;
  application: {
    listTools(): Array<{ id: string; displayName: string; description: string; inputSchema: Record<string, unknown> | null }>;
    runTool(id: string, input?: Record<string, unknown>, options?: { preview?: boolean }): Promise<unknown>;
    [key: string]: unknown;
  };
  /** Experimental escape hatches (ArcGIS Maps SDK objects); prefer layers.* and camera.*. */
  readonly map: unknown;
  readonly view: unknown;
  events: unknown;
  exportData(options: unknown): Promise<unknown>;
  getConnections(): unknown;
};
