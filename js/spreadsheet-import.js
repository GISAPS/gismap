// Spreadsheets as point data: CSV and other delimited text, Excel and OpenDocument
// workbooks, and public Google Sheets. Finds the coordinate columns by name, and
// turns the rows into GeoJSON the local file pipeline already understands.
const TEXT_EXTENSIONS = new Set(["csv", "tsv", "tab", "txt"]);
const WORKBOOK_EXTENSIONS = new Set(["xlsx", "xlsm", "ods"]);
export const SPREADSHEET_ACCEPT = ".csv,.tsv,.tab,.txt,.xlsx,.xlsm,.ods,.xls";
const X_NAMES = new Set(["x", "lon", "long", "lng", "longitude", "longdd", "londd", "longdeg", "londeg", "longitudedd", "longitudedeg", "longitudedecimal", "decimallongitude", "xcoord", "xcoordinate", "coordx", "geox", "geolon", "geolong", "geolongitude", "pointx", "wgs84lon", "wgs84long", "wgs84longitude", "gpslon", "gpslong", "gpslongitude", "sitelongitude", "locationlongitude", "startlongitude", "ew"]);
const Y_NAMES = new Set(["y", "lat", "ltd", "latitude", "latdd", "latdeg", "latitudedd", "latitudedeg", "latitudedecimal", "decimallatitude", "ycoord", "ycoordinate", "coordy", "geoy", "geolat", "geolatitude", "pointy", "wgs84lat", "wgs84latitude", "gpslat", "gpslatitude", "sitelatitude", "locationlatitude", "startlatitude", "ns"]);
const PAIR_NAMES = new Set(["latlon", "latlong", "latlng", "latitudelongitude", "coordinates", "coords", "coordinate", "location", "geolocation", "gps", "position", "lonlat", "longlat", "lnglat", "longitudelatitude"]);
const LON_FIRST_PAIRS = new Set(["lonlat", "longlat", "lnglat", "longitudelatitude"]);

export const isSpreadsheetName = (name) => {
  const extension = String(name).split(".").pop().toLowerCase();
  return TEXT_EXTENSIONS.has(extension) || WORKBOOK_EXTENSIONS.has(extension) || extension === "xls";
};
const normalize = (header) => String(header).toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]/g, "");

/** Text to rows, with quoted cells; the delimiter is whichever splits the first line most. */
export function parseDelimited(text) {
  const source = String(text).replace(/^﻿/, "");
  const firstLine = source.split(/\r?\n/, 1)[0];
  const delimiter = [",", "\t", ";", "|"].map((mark) => [mark, firstLine.split(mark).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell === "") quoted = true;
    else if (char === delimiter) { row.push(cell); cell = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((cells) => cells.some((value) => String(value).trim() !== ""));
}

const parseXml = (text) => new DOMParser().parseFromString(text, "application/xml");
const byName = (node, name) => [...node.getElementsByTagName("*")].filter((child) => child.localName === name);
const columnIndex = (reference) => [...reference.replace(/\d+$/, "")].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;

async function xlsxRows(zip) {
  const shared = zip.file("xl/sharedStrings.xml") ? byName(parseXml(await zip.file("xl/sharedStrings.xml").async("string")), "si").map((item) => byName(item, "t").map((text) => text.textContent).join("")) : [];
  const sheets = zip.file(/^xl\/worksheets\/sheet\d+\.xml$/).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  if (!sheets.length) throw new Error("This workbook has no sheets.");
  return byName(parseXml(await sheets[0].async("string")), "row").map((row) => {
    const cells = [];
    for (const cell of byName(row, "c")) {
      const type = cell.getAttribute("t");
      const value = byName(cell, "v")[0]?.textContent ?? byName(cell, "t").map((text) => text.textContent).join("");
      cells[columnIndex(cell.getAttribute("r") || "A")] = type === "s" ? shared[Number(value)] ?? "" : value;
    }
    return Array.from(cells, (value) => value ?? "");
  });
}

async function odsRows(zip) {
  const table = byName(parseXml(await zip.file("content.xml").async("string")), "table")[0];
  if (!table) throw new Error("This workbook has no sheets.");
  return byName(table, "table-row").map((row) => byName(row, "table-cell").flatMap((cell) => {
    const repeat = Math.min(Number(cell.getAttribute("table:number-columns-repeated")) || 1, 256);
    const value = cell.getAttribute("office:value") ?? byName(cell, "p").map((text) => text.textContent).join(" ");
    return Array(repeat).fill(value);
  }));
}

/** A file's cells as { headers, rows }, the first non-empty row being the headers. */
export async function readSpreadsheet(file, { zipLibrary = globalThis.JSZip } = {}) {
  const extension = String(file.name).split(".").pop().toLowerCase();
  if (extension === "xls") throw new Error("Older .xls workbooks can't be read. Save it as .xlsx or .csv and add it again.");
  let cells;
  if (WORKBOOK_EXTENSIONS.has(extension)) {
    if (!zipLibrary) throw new Error("The ZIP library did not load.");
    const zip = await zipLibrary.loadAsync(await file.arrayBuffer());
    cells = extension === "ods" ? await odsRows(zip) : await xlsxRows(zip);
  } else cells = parseDelimited(await file.text());
  cells = cells.filter((row) => row.some((value) => String(value ?? "").trim() !== ""));
  if (cells.length < 2) throw new Error(`${file.name} needs a header row and at least one row of data.`);
  const headers = cells[0].map((header, index) => String(header ?? "").trim() || `Column ${index + 1}`);
  return { headers, rows: cells.slice(1) };
}

/** The coordinate columns recognized by name: { x, y } or { pair, lonFirst }, or null. */
export function detectCoordinateColumns(headers) {
  const names = headers.map(normalize);
  const x = names.findIndex((name) => X_NAMES.has(name));
  const y = names.findIndex((name) => Y_NAMES.has(name));
  if (x >= 0 && y >= 0) return { x: headers[x], y: headers[y] };
  const pair = names.findIndex((name) => PAIR_NAMES.has(name));
  return pair >= 0 ? { pair: headers[pair], lonFirst: LON_FIRST_PAIRS.has(names[pair]) } : null;
}

const number = (value) => {
  const text = String(value ?? "").trim();
  return text === "" ? NaN : Number(text);
};

function coordinates(cell, { x, y, pair, lonFirst }) {
  if (pair) {
    const parts = String(cell(pair)).replace(/[()[\]]/g, "").split(/[,;\s]+/).filter(Boolean).map(Number);
    if (parts.length !== 2) return null;
    return lonFirst ? parts : [parts[1], parts[0]];
  }
  return [number(cell(x)), number(cell(y))];
}

/** Rows to a point FeatureCollection; `skipped` counts rows with no usable position. */
export function rowsToGeoJson({ headers, rows }, columns) {
  const features = [];
  let skipped = 0;
  for (const row of rows) {
    const cell = (header) => row[headers.indexOf(header)];
    const position = coordinates(cell, columns);
    if (!position || !position.every(Number.isFinite) || Math.abs(position[0]) > 180 || Math.abs(position[1]) > 90) { skipped += 1; continue; }
    const properties = Object.fromEntries(headers.map((header, index) => {
      const value = row[index] ?? "";
      const parsed = number(value);
      return [header, Number.isFinite(parsed) ? parsed : value];
    }));
    features.push({ type: "Feature", properties, geometry: { type: "Point", coordinates: position } });
  }
  return { collection: { type: "FeatureCollection", features }, skipped };
}

/** The CSV address of a Google Sheets link, or null. Works for sheets anyone with the link can view. */
export function googleSheetCsvUrl(value) {
  let url;
  try { url = new URL(String(value).trim()); } catch { return null; }
  const id = url.hostname === "docs.google.com" && url.pathname.match(/^\/spreadsheets\/d\/([\w-]+)/)?.[1];
  if (!id) return null;
  const gid = (url.hash.match(/gid=(\d+)/) || url.search.match(/gid=(\d+)/))?.[1];
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv${gid ? `&gid=${gid}` : ""}`;
}
