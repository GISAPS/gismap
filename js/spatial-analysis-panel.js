// Tools > Spatial Analysis: choose layers or drawings, draw on the map, add the result as a layer.
import { SPATIAL_OPERATIONS } from "./spatial-analysis.js?v=0.66.0-analysis1";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
const GEOMETRY_NOTE = { polygon: "polygons", point: "points", any: "any geometry" };
const DRAW_TYPES = [["point", "Point"], ["polyline", "Line"], ["polygon", "Polygon"], ["rectangle", "Rectangle"]];

export function openSpatialAnalysis(ui, analysis) {
  const groups = [...new Set(SPATIAL_OPERATIONS.map((item) => item.group))];
  const operationOptions = groups.map((group) => `<optgroup label="${group}">${SPATIAL_OPERATIONS.filter((item) => item.group === group).map((item) => `<option value="${item.id}">${escapeHtml(item.label)}</option>`).join("")}</optgroup>`).join("");
  ui.openDialog({
    eyebrow: "Tools",
    title: "Spatial Analysis",
    content: `<div class="workspace-tool spatial-analysis">
      <label class="field"><span>Analysis</span><select data-analysis-operation>${operationOptions}</select></label>
      <p class="form-note" data-analysis-description></p>
      <label class="field"><span>Input</span><select data-analysis-input></select></label>
      <label class="field" data-analysis-overlay-field><span>Overlay</span><select data-analysis-overlay></select></label>
      <div data-analysis-options></div>
      <fieldset class="spatial-analysis__draw"><legend>Draw on the map</legend>
        <div class="draw-tools">${DRAW_TYPES.map(([type, label]) => `<button type="button" data-analysis-draw="${type}">${label}</button>`).join("")}<button type="button" class="button--quiet" data-analysis-clear>Clear</button></div>
        <p class="form-note" data-analysis-drawings></p>
      </fieldset>
      <button type="button" class="button--primary" data-analysis-run>Run analysis</button>
      <p class="form-note" data-analysis-output role="status"></p>
      <p class="form-note">Runs in this browser. Nothing is uploaded.</p>
    </div>`,
  });
  // Docked, the dialog leaves the map free to draw on.
  document.querySelector("#dialog-dock")?.click();
  const root = ui.dialog.querySelector(".spatial-analysis");
  const get = (name) => root.querySelector(`[data-analysis-${name}]`);
  const controller = ui.mapController;
  const current = () => SPATIAL_OPERATIONS.find((item) => item.id === get("operation").value);
  const sources = () => {
    const count = controller.getDrawings().length;
    const layers = globalThis.gisMapOnline.layers.list().filter((layer) => controller.getLayer(layer.id)?.queryable);
    return [`<option value="drawings">Drawings on the map (${count})</option>`, ...layers.map((layer) => `<option value="${escapeHtml(layer.id)}">${escapeHtml(layer.title)}</option>`)].join("");
  };
  const refreshSources = () => {
    for (const select of [get("input"), get("overlay")]) {
      const chosen = select.value;
      select.innerHTML = sources();
      if ([...select.options].some((option) => option.value === chosen)) select.value = chosen;
    }
    const count = controller.getDrawings().length;
    get("drawings").textContent = count ? `${count} drawn ${count === 1 ? "shape" : "shapes"}. Choose Drawings on the map as the input or overlay.` : "Pick a shape, then draw it on the map.";
  };
  const renderOperation = () => {
    const operation = current();
    get("description").textContent = `${operation.description} Input: ${GEOMETRY_NOTE[operation.input]}.`;
    get("overlay-field").hidden = !operation.overlay;
    get("options").innerHTML = operation.options.map((option) => `<label class="field"><span>${escapeHtml(option.label)}${option.unit ? ` (${option.unit})` : ""}</span><input data-option="${option.name}" type="${option.type === "number" ? "number" : "text"}" ${option.type === "number" ? `value="${option.default}" min="${option.min}" max="${option.max}" step="any"` : ""} /></label>`).join("");
  };
  get("operation").addEventListener("change", renderOperation);
  root.querySelectorAll("[data-analysis-draw]").forEach((button) => button.addEventListener("click", () => {
    controller.draw(button.dataset.analysisDraw);
    get("input").value = "drawings";
    if (ui.mobileMedia.matches) drawOnMobile(ui);
  }));
  get("clear").addEventListener("click", () => { controller.clearDrawings(); refreshSources(); });
  get("run").addEventListener("click", async () => {
    const operation = current();
    const output = get("output");
    const options = Object.fromEntries([...root.querySelectorAll("[data-option]")].filter((field) => field.value !== "").map((field) => [field.dataset.option, field.value]));
    output.textContent = "Running…";
    get("run").disabled = true;
    try {
      const result = await analysis.run(operation.id, { input: get("input").value, overlay: operation.overlay ? get("overlay").value : undefined, options });
      output.textContent = result.summary;
      ui.toast(result.summary);
      refreshSources();
    } catch (error) {
      output.textContent = error.message;
    } finally {
      get("run").disabled = false;
    }
  });
  renderOperation();
  refreshSources();
  const refresh = setInterval(() => {
    if (!root.isConnected) clearInterval(refresh);
    else if (!root.contains(document.activeElement) || document.activeElement.tagName !== "SELECT") refreshSources();
  }, 800);
}

/** On a phone the sheet covers the map, so it steps aside until drawing is done. */
function drawOnMobile(ui) {
  ui.dialog.style.display = "none";
  const done = document.createElement("button");
  done.type = "button";
  done.className = "button--primary spatial-analysis__done";
  done.textContent = "Done drawing";
  done.addEventListener("click", () => { ui.dialog.style.display = ""; done.remove(); });
  document.body.append(done);
}
