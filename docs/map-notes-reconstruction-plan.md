> **Product update:** this roadmap describes Field Notes exports and reconstruction. Phase order and the separate data-review Map Notes product are now defined in [the two-note systems plan](two-note-systems-plan.md).

# Map Notes: portable reconstruction roadmap

The field-collection/offline-sharing priority and the self-reconstructing report specification extend the original Map Notes plan. This roadmap distinguishes delivered behavior from proposed work. No hosted backend, account, or new database is required for portable records. Explicit user consent is required before embedding private notes, GPS positions, photos or session metadata in any shareable artifact. Links and QR codes are readable by anyone who receives them; fragments may persist in clipboard or browser history.

## Phase 1 — field collection and a basic report (in progress)

- **Available:** project-owned notes, explicit local field-session persistence and recovery, point selection or mobile GPS, feature references when a stable ID exists, JSON bundle import/export, and one-observation self-contained links with a preview and explicit import. The same single-note link can be displayed as a QR after a privacy warning; it is not a collection QR.
- **Basic report now available:** local PDF pages with a clickable self-contained observation link and QR, and a clearly labeled world-coordinate locator. This initial exporter is limited to point notes, ASCII text, portable-size links and 100 notes; it refuses unsupported records without truncation. Source layers are not restored.
- **Still needed:** map screenshots or a richer local geometry fallback, Unicode-capable PDF text, and a companion-file resolution path for notes too large for an individual link. Preserve all evidence using continuation pages or an explicit companion bundle, not silent truncation. A 25-observation report must include every observation. The report must state whether its links are self-contained, require a companion file, or require network-accessible sources. A separate cover is optional; do not silently replace observation pages with a cover.
- **Link resolution:** small records may use the existing self-contained canonical bundle. Larger records need a working companion-file/local-import resolution path or another explicitly accessible source; a coordinate-only link must not pretend to contain the full note. Preserve coordinates and safely embedded note information when a source is unavailable. Source restoration and feature highlighting must be attempted only when supported and safely authorized; explain unresolved relationships.
- **Offline field use:** ensure the already-installed application shell and needed local assets can launch offline; distinguish that from availability of online basemaps, feature services and remote fonts/libraries. Verify capture, saving and reload on a real mobile device, including 20 observations and GPS accuracy. Explicit resume currently works; automatic project/session restoration and engine switching still need work.
- Test JSON round trips and conflict handling, QR scanning in a real device, local PDF output and links, offline generation and recoverable storage failure. Do not treat unit tests alone as evidence of offline or camera/GPS support.

## Reconstruction manifest and shared pipeline (planned foundation)

Define and document a validated, versioned `gismap.notes.package` envelope containing package identity, project context, the **existing canonical field-session bundle**, safe dataset references and view instructions. The envelope is portable configuration, not a parallel note store; note bodies and relationships must not be duplicated into competing records. The sample in the specification is illustrative, not a fixed API shape.

The common pipeline should validate size, versions and URLs; preview before modifying an existing project; import idempotently using the existing session/registry conflict rules; surface missing datasets, unsupported media and authentication without dropping notes; and route the same package to map or Brief views. Dataset URLs are untrusted: do not embed credentials or fetch arbitrary services automatically without appropriate consent. Make explicit what is embedded, locally resolvable, or externally hosted. Unknown fields/versions and missing attachment bytes must never be silently discarded. Preserve GPS capture separately from feature geometry and identity.

Integrate this envelope with current map/share encodings and bundle formats without breaking existing JSON or `#fieldNote` links. Avoid representing a future view as working before its reconstruction exists. Agent access should use the existing validated action registry, documented schema and explicit authorization for private content—not a separate state store.

## Phase 2 — full portable reconstruction

- Single collection QR and compressed multipart QR with version, package ID, ordered chunks, count, length, checksum, out-of-order/duplicate handling, interrupted-scan recovery, preview, reasonable scan limits and explicit JSON/ZIP fallback when impractical.
- Offer **Open as Interactive Map**, **Open as Brief**, **Import into Current Project** and **Save as Portable JSON** after successful reconstruction. Map and Brief routes use the same validated package and differ only in presentation. Brief uses the existing mobile swipe interface and one observation per slide.
- Collection-level PDF actions and QR instructions must accurately describe the same reconstruction package; individual pages link to their own observation. If links require an accompanying file or an unavailable service, say so in the report and app.
- Include photos only when their bytes are carried in a portable package or an accessible durable URL is explicitly included. A filename or local IndexedDB reference alone is not portable. Use ZIP/JSON for large images rather than silently dropping them from QR; richer PDF layout, attachments and feature restoration/highlighting belong here.
- Test collection/map and Brief restoration, unavailable datasets/attachments, scan on mobile, reimport without duplicates, malicious packages, and partial/offline failures.

## Phase 3 — observation review

Review/respond workflows and a mobile swipeable Observations Mode, with relationships preserved and no automatic publication.

## Phase 4 — agents and synchronization

Expose reconstruction through GISMap Online's existing validated action system, with an agent-readable schema and explicit permission for private data. Integrate Field Tasks and eventual MapSi synchronization without changing the authoritative local record model.
