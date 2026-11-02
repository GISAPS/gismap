// The gallery is a view of the engine's existing basemap selection, not a
// second selection store. Provider names and notes are static application data.
const FAVORITES_KEY = "gismap-online:basemap-favorites:v1";
const DETAILS = Object.freeze({
  "usgs-imagery": { category: "Imagery", provider: "USGS / USDA", note: "U.S. imagery; resolution and coverage vary.", preview: "USGSImageryOnly" },
  "usgs-imagery-topo": { category: "Imagery", provider: "USGS", note: "U.S. imagery and topographic detail. Service retires November 16, 2026.", preview: "USGSImageryTopo" },
  "open-liberty": { category: "Terrain", provider: "OpenFreeMap", note: "Detailed global OpenStreetMap data." },
  "open-bright": { category: "Streets", provider: "OpenFreeMap", note: "Global streets and labels." },
  "open-positron": { category: "Light", provider: "OpenFreeMap", note: "Light neutral map for overlays." },
  "open-dark": { category: "Dark", provider: "OpenFreeMap", note: "Dark neutral map for overlays." },
  "open-fiord": { category: "Artistic", provider: "OpenFreeMap", note: "Cool-toned global map." },
  skin: { category: "Artistic", provider: "OpenFreeMap", note: "Colors follow the selected GISMap Online skin." },
});
export const GALLERY_CATEGORIES = Object.freeze(["All", "Favorites", "Imagery", "Light", "Dark", "Streets", "Terrain", "Artistic"]);
export function galleryEntries(options, { search = "", category = "All", favorites = [] } = {}) {
  const needle = String(search).trim().toLowerCase();
  return options.map((option) => ({ ...option, ...(DETAILS[option.id] || { category: "Streets", provider: option.group || "MapLibre", note: "" }) }))
    .filter((entry) => (category === "All" || (category === "Favorites" ? favorites.includes(entry.id) : entry.category === category))
      && (!needle || `${entry.label} ${entry.provider} ${entry.category} ${entry.note}`.toLowerCase().includes(needle)));
}
function readFavorites(storage) {
  try { const value = JSON.parse(storage?.getItem(FAVORITES_KEY) || "[]"); return Array.isArray(value) ? value.filter((id) => typeof id === "string") : []; } catch { return []; }
}

export function mountBasemapGallery(host, { options, select, storage = globalThis.localStorage }) {
  const doc = host.ownerDocument;
  const section = doc.createElement("section");
  section.className = "basemap-gallery";
  section.innerHTML = '<label class="field"><span>Search basemaps</span><input type="search" data-gallery-search placeholder="Search by name or provider"></label><label class="field"><span>Category</span><select data-gallery-category></select></label><p class="form-note">Keyless basemaps · availability and coverage depend on each provider.</p><div data-gallery-list class="basemap-gallery__list"></div>';
  const input = section.querySelector("[data-gallery-search]");
  const category = section.querySelector("[data-gallery-category]");
  for (const name of GALLERY_CATEGORIES) { const option = doc.createElement("option"); option.value = name; option.textContent = name; category.append(option); }
  const list = section.querySelector("[data-gallery-list]");
  let favorites = readFavorites(storage);
  const update = () => {
    const state = options();
    const entries = galleryEntries(state.options, { search: input.value, category: category.value, favorites });
    list.replaceChildren();
    if (!entries.length) { const empty = doc.createElement("p"); empty.textContent = "No basemaps match your search."; list.append(empty); }
    for (const entry of entries) {
      const row = doc.createElement("div"); row.className = "basemap-gallery__item";
      const button = doc.createElement("button"); button.type = "button"; button.className = "basemap-gallery__choice";
      button.setAttribute("aria-pressed", String(state.selected === entry.id));
      if (entry.preview) {
        const image = doc.createElement("img"); image.loading = "lazy"; image.alt = ""; image.width = 72; image.height = 56;
        image.src = `https://basemap.nationalmap.gov/arcgis/rest/services/${entry.preview}/MapServer/tile/4/6/2`;
        image.addEventListener("error", () => { image.hidden = true; }, { once: true }); button.append(image);
      }
      const text = doc.createElement("span"); const title = doc.createElement("strong"); title.textContent = entry.label;
      const note = doc.createElement("small"); note.textContent = `${entry.provider} · No key · ${entry.note}`;
      text.append(title, note); button.append(text); button.addEventListener("click", () => { select(entry.id); update(); });
      const favorite = doc.createElement("button"); favorite.type = "button"; favorite.className = "basemap-gallery__favorite";
      const selected = favorites.includes(entry.id); favorite.textContent = selected ? "★" : "☆";
      favorite.setAttribute("aria-label", `${selected ? "Remove" : "Add"} ${entry.label} ${selected ? "from" : "to"} favorites`);
      favorite.setAttribute("aria-pressed", String(selected));
      favorite.addEventListener("click", () => { favorites = selected ? favorites.filter((id) => id !== entry.id) : [...favorites, entry.id]; try { storage?.setItem(FAVORITES_KEY, JSON.stringify(favorites)); } catch { /* Storage may be unavailable. */ } update(); });
      row.append(button, favorite); list.append(row);
    }
  };
  input.addEventListener("input", update); category.addEventListener("change", update);
  host.replaceChildren(section); update();
  return { update };
}
