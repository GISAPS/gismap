import assert from "node:assert/strict";
import test from "node:test";
import { detectCoordinateColumns, googleSheetCsvUrl, isSpreadsheetName, parseDelimited, rowsToGeoJson } from "../js/spreadsheet-import.js";

test("delimited text handles quotes, semicolons and a byte order mark", () => {
  assert.deepEqual(parseDelimited('﻿Name,X\n"Beach, Ocean",-122.5\n'), [["Name", "X"], ["Beach, Ocean", "-122.5"]]);
  assert.deepEqual(parseDelimited("a;b\r\n1;2"), [["a", "b"], ["1", "2"]]);
});

test("coordinate column variants are recognized", () => {
  for (const [x, y] of [["X", "Y"], ["Long", "Lat"], ["Longitude", "Latitude"], ["lng", "lat"], ["LON_DD", "LAT_DD"], ["Longitude (deg)", "Latitude (deg)"], ["x_coord", "y_coord"], ["decimalLongitude", "decimalLatitude"]]) {
    assert.deepEqual(detectCoordinateColumns(["Name", x, y]), { x, y });
  }
  assert.deepEqual(detectCoordinateColumns(["Name", "LatLong"]), { pair: "LatLong", lonFirst: false });
  assert.equal(detectCoordinateColumns(["Name", "Easting?", "Value"]), null);
});

test("rows become points, and bad rows are counted", () => {
  const table = { headers: ["Name", "X", "Y"], rows: [["Beach", "-122.511254", "37.766463"], ["Nowhere", "", ""], ["Off", "500", "1"]] };
  const { collection, skipped } = rowsToGeoJson(table, { x: "X", y: "Y" });
  assert.equal(skipped, 2);
  assert.deepEqual(collection.features[0].geometry.coordinates, [-122.511254, 37.766463]);
  assert.equal(collection.features[0].properties.Name, "Beach");
  assert.deepEqual(rowsToGeoJson({ headers: ["At"], rows: [["37.7, -122.5"]] }, { pair: "At", lonFirst: false }).collection.features[0].geometry.coordinates, [-122.5, 37.7]);
});

test("Google Sheets links become CSV addresses and other links do not", () => {
  assert.equal(googleSheetCsvUrl("https://docs.google.com/spreadsheets/d/abc-1/edit#gid=42"), "https://docs.google.com/spreadsheets/d/abc-1/gviz/tq?tqx=out:csv&gid=42");
  assert.equal(googleSheetCsvUrl("https://example.com/a.csv"), null);
  assert.ok(isSpreadsheetName("a.XLSX") && !isSpreadsheetName("a.geojson"));
});
