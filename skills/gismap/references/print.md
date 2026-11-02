# Print Editor: PDFs and Smart Images

Use `gisMapOnline.print` in a running GISMap page to get the same branded output as Tools → Print Editor. Exports return files and never start a browser download.

## Templates

Read ids and sizes from `gisMapOnline.print.templates()`.

| Need | Template id |
| --- | --- |
| Default page with a layer key and QR code (11 × 8.5 in) | `branded` |
| The map edge to edge | `full-bleed` |
| Map with written findings (8.5 × 11 in) | `portrait-report` |
| Tabloid poster (11 × 17 in) | `poster` |
| Wall maps | `wall-24x36`, `wall-36x36` |
| Printed page for site work | `field-sheet` |
| 16:9 slide | `slide` |
| Map with logos or photos added in the editor | `image-overlay` |

## Export

```js
await gisMapOnline.ready;
const { file, warnings, share } = await gisMapOnline.print.exportPdf({
  template: "poster", title: "Sacramento potholes", subtitle: "Reports, 2026",
});
```

Options: `template`, `title`, `subtitle`, `description`, `marginIn`, `marginColor`, `borderPt`, `borderColor`, `showQr`, `showNorthArrow`, `showScaleBar`, `clickableLinks`, `pages` (`current-view` or, for PDFs, `bookmarks`), `dpi` (48–300), `waitFor` (`idle` or `layers`), `timeoutMs` (default 30000) and `allowPartial`. Wall maps are capped at about 6000 pixels on the long side.

`print.preview()` returns a low-resolution PNG. `print.setOptions()` keeps options for later calls, and `print.open()` opens the editor for a person.

## Smart Image

Create Smart Images only with `gisMapOnline.print.exportSmartImage()` or `smartImages.createCurrent()` in a running GISMap page. Do not draw your own map image or write `giMp` chunks yourself. If export fails, report the error code and return the live share link instead.

```js
const { file, manifest } = await gisMapOnline.print.exportSmartImage({ template: "branded" });
```

Its default template is `branded`. `smartImages.read()` returns `provenance`; app exports report `renderedBy: "app"` and anything else reports `"unknown"`. Provenance is informational, not a signature.

## Verify

Open the PNG or PDF and check the title, the legend and that the QR opens the live map (`share.url`). Read `warnings` and pass them on to the user. For a Smart Image, confirm `smartImages.read(file)` restores the project.

## Errors

| Code | What to do |
| --- | --- |
| `PRINT_LAYERS_NOT_LOADED` | Check `describe().state.issues` and report which layers failed. Use `allowPartial: true` only if the user agrees. |
| `PRINT_RENDER_TIMEOUT` | Increase `timeoutMs` or reduce the extent. |
| `PRINT_CANVAS_TAINTED` | Switch basemaps or report the source. |
| `WEBGL_UNAVAILABLE` | In headless Chromium, launch with `--use-gl=angle --use-angle=swiftshader` or `--enable-unsafe-swiftshader`. |
| `UNKNOWN_TEMPLATE` | Use an id from `print.templates()`. |

## Project files

`gisMapOnline.project.exportFile()` returns the `.gis` project and `exportPackage()` the `.gisx` package, which carries local datasets. Legacy `.gmo` and `.gmop` files still import.
