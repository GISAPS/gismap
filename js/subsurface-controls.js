// The "Below ground" controls (Style layer › Below, and Advanced style): depth,
// thickness or diameter from a fixed value or a field in its units, depth
// exaggeration and colour. Changes apply right away, like an animated effect.
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

const UNIT_SCALES = [["1", "metres"], ["0.3048", "feet"], ["0.0254", "inches"], ["0.01", "centimetres"], ["0.001", "millimetres"]];
const isNumeric = (field) => /^(?:small-integer|integer|single|double|long|esriFieldTypeDouble|esriFieldTypeInteger|esriFieldTypeSmallInteger|esriFieldTypeSingle)$/i.test(field?.type || "");

/** Whether a layer can be drawn below ground on this map. */
export function canDrawBelowGround(layer, capabilities = []) {
  return capabilities.includes("subsurface") && Boolean(layer?.queryable) && ["point", "multipoint", "polyline", "polygon"].includes(layer?.geometryType);
}

/** The controls' markup for a layer and its saved setting (or null). */
export function subsurfaceControlsMarkup(layer, saved = null) {
  const geometry = layer.geometryType === "multipoint" ? "point" : layer.geometryType;
  const numeric = (layer.fields || []).filter(isNumeric).filter((field) => !/^(?:oid|objectid|fid)$/i.test(field.name));
  const measure = (key, label, spec, meters, hint) => {
    const scale = String(spec?.scale ?? 1);
    return `<div class="field" data-subsurface-measure="${key}"><span>${label} <small>${hint}</small></span><div class="field-grid"><select data-subsurface-field aria-label="${label} from"><option value="">Fixed value</option>${numeric.map((field) => `<option value="${escapeHtml(field.name)}"${field.name === spec?.field ? " selected" : ""}>${escapeHtml(field.alias || field.name)}</option>`).join("")}</select><select data-subsurface-scale aria-label="${label} field units"${spec?.field ? "" : " hidden"}>${UNIT_SCALES.map(([value, name]) => `<option value="${value}"${value === scale ? " selected" : ""}>Field in ${name}</option>`).join("")}</select><label class="field"><span>${spec?.field ? "Where empty" : "Metres"}</span><input data-subsurface-meters type="number" min="0" step="0.1" value="${escapeHtml(spec?.meters ?? meters)}" /></label></div></div>`;
  };
  const kind = geometry === "polyline" ? "pipes, cables, tunnels" : geometry === "point" ? "wells, shafts, manholes" : "rock units, aquifers, basements";
  const depthHint = geometry === "polyline" ? "ground to the pipe's centre" : geometry === "point" ? "ground to the bottom" : "ground to the unit's top";
  return `<div data-subsurface><label class="display-checkbox"><input data-subsurface-enabled type="checkbox"${saved ? " checked" : ""} /><span>Draw below ground <small>${kind}</small></span></label><div data-subsurface-options${saved ? "" : " hidden"}>${measure("depth", "Depth", saved?.depth, geometry === "polygon" ? 10 : 3, depthHint)}${geometry === "polygon" ? measure("thickness", "Thickness", saved?.thickness, 20, "the unit's top to its base") : measure("diameter", "Diameter", saved?.diameter, 1, "drawn at least 1 m wide")}<div class="field-grid"><label class="field"><span>Depth exaggeration</span><input data-subsurface-exaggeration type="number" min="0.1" max="100" step="0.5" value="${escapeHtml(saved?.exaggeration ?? 1)}" /></label><label class="field"><span>Colour</span><select data-subsurface-color-mode><option value="">The layer's style</option><option value="own"${saved?.color ? " selected" : ""}>One colour</option></select></label><label class="field" data-subsurface-color-field${saved?.color ? "" : " hidden"}><span>Below-ground colour</span><input data-subsurface-color type="color" value="${escapeHtml(saved?.color || "#3d8bd1")}" /></label></div></div><p class="form-note">Seen in the underground view (Map menu), which fades the ground. Depth is measured down from the local ground, terrain included. Applies right away and is saved with the layer.</p></div>`;
}

/** The setting the controls describe, or null when "Draw below ground" is off. Updates which inputs show. */
function readControls(root) {
  const enabled = root.querySelector("[data-subsurface-enabled]").checked;
  root.querySelector("[data-subsurface-options]").hidden = !enabled;
  const measure = (key) => {
    const control = root.querySelector(`[data-subsurface-measure="${key}"]`);
    if (!control) return undefined;
    const field = control.querySelector("[data-subsurface-field]").value;
    control.querySelector("[data-subsurface-scale]").hidden = !field;
    control.querySelector("[data-subsurface-meters]").previousElementSibling.textContent = field ? "Where empty" : "Metres";
    return { ...(field ? { field, scale: Number(control.querySelector("[data-subsurface-scale]").value) } : {}), meters: Number(control.querySelector("[data-subsurface-meters]").value) };
  };
  const ownColor = root.querySelector("[data-subsurface-color-mode]").value === "own";
  root.querySelector("[data-subsurface-color-field]").hidden = !ownColor;
  if (!enabled) return null;
  return { depth: measure("depth"), thickness: measure("thickness"), diameter: measure("diameter"), exaggeration: Number(root.querySelector("[data-subsurface-exaggeration]").value) || 1, ...(ownColor ? { color: root.querySelector("[data-subsurface-color]").value } : {}) };
}

/**
 * Applies the controls in `container` to layer `uid` as they change. Turning one on
 * also turns on the underground view: a layer below ground is unseen without it.
 */
export function bindSubsurfaceControls(container, { uid, mapController, toast = () => {}, error = () => {} }) {
  const root = container?.querySelector("[data-subsurface]");
  if (!root) return;
  const apply = async ({ announce = false } = {}) => {
    const config = readControls(root);
    try {
      await mapController.setSubsurface(uid, config);
      if (config && announce && !mapController.getUndergroundView().enabled) {
        await mapController.setUndergroundView({ ...mapController.getUndergroundView(), enabled: true });
        toast("Underground view on: the ground is faded so the layer shows below it.");
      }
    } catch (problem) { error(`Could not draw the layer below ground: ${problem.message}`); }
  };
  root.querySelector("[data-subsurface-enabled]").addEventListener("change", () => void apply({ announce: true }));
  root.querySelectorAll("[data-subsurface-options] select, [data-subsurface-options] input").forEach((input) => input.addEventListener("change", () => void apply()));
}
