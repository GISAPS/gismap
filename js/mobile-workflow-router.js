import { googleMapsLink } from "./google-maps-link.js?v=0.52.9";
import { MobileFeedStore } from "./mobile-feed-store.js?v=0.18.7";
import { compactMedia } from "./viewport.js?v=0.18.2";
import { INTERFACE_SKINS, applyInterfaceSkin, normalizeSkin } from "./skin-catalog.js?v=0.57.0-skins2";
import { FIELD_TASK_LIMITS, addressDetails, createFieldTaskUrl, featureLayerUrl, taskSteps } from "./field-task-share.js?v=0.70.3-geology";
import { appUrl } from "./app-root.js?v=0.65.0-paths";
import { fieldTaskCsv, fieldTaskFileStem, fieldTaskPdf, fieldTaskPoints, photoDataUrl } from "./field-task-report.js?v=0.70.3-geology";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const STATUS_LABELS = { draft: "Draft", sent: "Sent", assigned: "To complete", "in-progress": "In progress", completed: "Completed", returned: "Report received", shared: "Shared" };
const MAX_TASK_PHOTOS = 8;
const newId = (prefix) => globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}`;
const dateLabel = (value) => value ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)) : "Recently";

export class MobileWorkflowRouter {
  /**
   * createTour(places, { title }) and createBriefing({ layerUrl, ids, title }) let a
   * task become a tour or a briefing; both are provided by the UI controller.
   */
  constructor({ events, projectManager, mapController, prepareWorkflow, openWorkflow, shareWorkflow, notify, dockWorkflow, createTour, createBriefing, openFieldNotes }) {
    Object.assign(this, { events, projectManager, mapController, prepareWorkflow, openWorkflow, shareWorkflow, notify, dockWorkflow, createTour, createBriefing, openFieldNotes });
    this.media = compactMedia();
    this.store = new MobileFeedStore({ projectManager, events });
    this.root = document.querySelector("#mobile-workflow-root");
    this.route = "map";
    this.activePanelId = null;
    // Which task screen is showing: null (list) or { mode: "edit" | "complete" | "report", id }.
    this.taskView = null;
    // The task being edited, kept outside the form so map picking can hide the screen.
    this.taskDraft = null;
    this.picking = false;
  }

  initialize() {
    document.querySelectorAll("[data-mobile-workflow]").forEach((button) => button.addEventListener("click", () => this.navigate(button.dataset.mobileWorkflow)));
    this.root?.addEventListener("click", (event) => this.#click(event));
    this.root?.addEventListener("change", (event) => this.#change(event));
    this.root?.addEventListener("submit", (event) => this.#submit(event));
    this.events.subscribe?.("project:loaded", () => { if (this.#rootOpen()) this.render(); });
    this.events.subscribe?.("mobile:workflow-changed", () => { if (this.#rootOpen()) this.render(); });
    this.events.subscribe?.("mobile:workflow-route", ({ route }) => {
      if (!route) return;
      this.route = route;
      this.#hideRoot();
      this.#closeMenu();
      this.#syncNav();
    });
    // The active presentation is the source of truth for which mode is showing.
    // Keep the route in step when a mode is chosen elsewhere (desktop dialog,
    // shared link, project load) so a stale screen can never reappear.
    this.events.subscribe?.("presentation:changed", ({ presentation }) => {
      const template = presentation?.template || "standard";
      const route = ({ briefing: "briefing", atlas: "tours" })[template] || (template === "standard" ? null : "map");
      if (route && route !== this.route) {
        this.route = route;
        this.#hideRoot();
      } else if (!route && ["briefing", "tours"].includes(this.route)) {
        this.route = "map";
      }
      this.#syncNav();
    });
    this.events.subscribe?.("mobile:panel-active", ({ panelId }) => {
      this.activePanelId = panelId || null;
      this.#syncNav();
    });
    this.events.subscribe?.("mobile:menu-toggled", () => this.#syncNav());
    this.events.subscribe?.("workflow:panel-closed", () => { if (this.#rootOpen()) this.navigate("map"); });
    this.media.addEventListener?.("change", ({ matches }) => {
      // Rotating or resizing across the breakpoint: screens that exist only in
      // the compact app close, so they cannot resurface later.
      this.#closeMenu();
      if (!matches && this.route === "more") {
        this.route = "map";
        this.#hideRoot();
      }
      if (this.#rootOpen()) {
        // Phones show the screen full size; desktops hold it in the right panel.
        this.dockWorkflow?.(!matches);
        this.render();
      }
      this.#syncNav();
    });
    this.events.subscribe?.("identify:complete", (payload) => {
      if (this.picking === "location") this.#setPickedLocation(payload);
      else if (this.picking) this.#attachPickedFeature(payload);
    });
    this.#syncNav();
  }

  navigate(route) {
    const compact = this.media.matches;
    if (!["map", "briefing", "tours", "tasks", "more"].includes(route)) route = compact ? "more" : "map";
    if (!compact && route === "more") route = "tasks";
    this.#closeMenu();
    // Messages about the previous screen should not linger over the next one.
    document.querySelectorAll("#toast-region .toast").forEach((toast) => toast.remove());
    this.prepareWorkflow?.(route);
    this.picking = false;
    document.body.classList.remove("field-task-picking");
    this.#removeMapBanner();
    this.taskView = null;
    this.taskDraft = null;
    this.route = route;
    if (route === "map" || route === "tours" || route === "briefing") {
      this.#hideRoot();
      this.#syncNav();
      if (route !== "map") this.openWorkflow(route);
      return;
    }
    this.root.hidden = false;
    document.body.classList.add("mobile-workflow-open");
    if (!compact) this.dockWorkflow?.(true);
    this.render();
    this.#syncNav();
  }

  #rootOpen() { return Boolean(this.root && !this.root.hidden); }

  #hideRoot() {
    if (this.root) this.root.hidden = true;
    document.body.classList.remove("mobile-workflow-open");
    // Phones hide the screen only to show the map for a moment (picking, zooming); it stays docked on desktop.
    if (!this.media.matches) this.dockWorkflow?.(false);
  }

  render() {
    if (!this.root || this.root.hidden) return;
    const renderer = { tasks: () => this.#taskScreen(), more: () => this.#more() }[this.route] || (() => this.#more());
    this.root.innerHTML = `<header class="mobile-workflow__header"><div><span class="mobile-workflow__brand">GISMap Online</span><h1>${escapeHtml(this.#title())}</h1></div><button type="button" data-workflow-close aria-label="Return to map">×</button></header><div class="mobile-workflow__body">${renderer()}</div>`;
  }

  #title() { return ({ tasks: "Field tasks", more: "Modes" })[this.route] || "Modes"; }

  #skinPicker() {
    const active = normalizeSkin(this.projectManager.current.presentation?.skin);
    return `<section class="mobile-skin-section"><h2>Look &amp; feel</h2><p class="mobile-workflow__subtitle">One skin styles the whole app — map, sheets, and menus. It never changes your data colors.</p><div class="skin-picker">${INTERFACE_SKINS.map(({ id, label, description }) => `<button type="button" class="skin-card skin-card--${id}${id === active ? " is-selected" : ""}" data-mobile-skin="${id}" aria-pressed="${id === active}"><span class="skin-mini"><i></i><b></b><em></em></span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(description)}</small></button>`).join("")}</div></section>`;
  }

  #updates() {
    const mobile = this.store.snapshot();
    const scope = mobile.feedPreferences.scope;
    const tasks = mobile.fieldTasks;
    const rules = mobile.watchRules;
    const chapters = this.projectManager.current.presentation?.chapters || [];
    const observations = mobile.observations;
    const cards = [];
    if (tasks.length) cards.push(...tasks.slice(0, 4).map((task) => `<article class="feed-card"><span class="feed-card__meta">Field task · ${dateLabel(task.updatedAt)}</span><h2>${escapeHtml(task.title || "Untitled field task")}</h2><p>${escapeHtml(task.location || task.notes || "Ready for field review.")}</p><div class="feed-card__actions"><button data-open-task="${escapeHtml(task.id)}">Open task →</button></div></article>`));
    if (rules.length) cards.push(...rules.slice(0, 3).map((rule) => `<article class="feed-card${mobile.acknowledgements.includes(rule.id) ? " is-muted" : ""}"><span class="feed-card__meta">Watchlist · ${escapeHtml(rule.status || "Monitoring")}</span><h2>${escapeHtml(rule.title || rule.field || "Saved threshold")}</h2><p><strong>${escapeHtml(rule.current ?? "—")}</strong> ${escapeHtml(rule.units || "")} · threshold ${escapeHtml(rule.operator || "above")} ${escapeHtml(rule.threshold ?? "—")}</p><div class="feed-card__actions"><button data-route="watchlist">View rule →</button></div></article>`));
    if (observations.length) cards.push(...observations.slice(0, 4).map((item) => `<article class="feed-card"><span class="feed-card__meta">${escapeHtml(item.source || "Project update")} · ${dateLabel(item.observedAt)}</span><h2>${escapeHtml(item.title || "Map update")}</h2><p>${escapeHtml(item.summary || "New project activity is available.")}</p></article>`));
    if (!cards.length && chapters.length) cards.push(`<article class="feed-card"><span class="feed-card__meta">Guided tour · ${chapters.length} chapter${chapters.length === 1 ? "" : "s"}</span><h2>${escapeHtml(this.projectManager.current.presentation?.title || "Guided places")}</h2><p>Your tour is ready to view or share.</p><div class="feed-card__actions"><button data-route="tours">Open tour →</button></div></article>`);
    if (!cards.length) cards.push(`<div class="mobile-empty"><h2>No updates yet</h2><p>Updates from field tasks, watched values, comparisons, and project observations will appear here.</p><button data-route="more">Choose a workflow</button></div>`);
    return `<p class="mobile-workflow__subtitle">Your places. What changed.</p><div class="segmented">${[["projects","My projects"],["nearby","Nearby"],["attention","Needs attention"]].map(([id,label]) => `<button data-feed-scope="${id}" class="${scope === id ? "is-active" : ""}">${label}</button>`).join("")}</div><div class="feed-list">${cards.join("")}</div>`;
  }

  #compare() {
    const comparisons = this.store.snapshot().comparisons;
    const layers = this.projectManager.current.layers || [];
    return `<p class="mobile-workflow__subtitle">Review two observations, dates, or layers side by side.</p><form class="mobile-card" data-compare-form><label>Comparison name<input name="title" required placeholder="Before and after" /></label><label>First layer<select name="left">${layers.map((item) => `<option>${escapeHtml(item.title || item.url || "Layer")}</option>`).join("")}</select></label><label>Second layer<select name="right">${layers.map((item) => `<option>${escapeHtml(item.title || item.url || "Layer")}</option>`).join("")}</select></label><button type="submit">Save comparison</button></form><div class="feed-list">${comparisons.map((item) => `<article class="feed-card"><span class="feed-card__meta">Saved comparison</span><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.left)} ↔ ${escapeHtml(item.right)}</p></article>`).join("") || `<div class="mobile-empty"><h2>No comparisons</h2><p>Save a comparison to revisit a change without rebuilding it.</p></div>`}</div>`;
  }

  #taskScreen() {
    const task = this.taskView && this.store.snapshot().fieldTasks.find((item) => item.id === this.taskView.id);
    if (this.taskView?.mode === "edit") return this.#taskEditor(this.taskDraft || task || {});
    if (task && this.taskView.mode === "complete") return this.#taskCompletion(task);
    if (task && this.taskView.mode === "report") return this.#taskReport(task);
    return this.#tasks();
  }

  #tasks() {
    const tasks = this.store.snapshot().fieldTasks;
    const card = (task) => {
      const assignee = task.role === "assignee";
      const steps = taskSteps(task);
      const done = steps.filter((step) => step.done).length;
      const features = task.features?.length || 0;
      const open = assignee ? `<button data-complete-task="${escapeHtml(task.id)}">${task.status === "completed" ? "Review" : "Complete tasks"} →</button>`
        : task.status === "returned" ? `<button data-report-task="${escapeHtml(task.id)}">View report →</button>`
        : `<button data-open-task="${escapeHtml(task.id)}">Edit task →</button>`;
      const share = assignee ? (task.status === "completed" ? `<button data-send-back="${escapeHtml(task.id)}">Send back</button>` : "") : `<button data-share-task="${escapeHtml(task.id)}">Share</button>`;
      const placed = fieldTaskPoints(task).length;
      const id = escapeHtml(task.id);
      // A task's places and features can go on as a tour, a briefing or a PDF map.
      const more = `<div class="feed-card__more"><button type="button" data-task-pdf="${id}">PDF</button>${placed ? `<button type="button" data-task-tour="${id}">Tour</button>` : ""}${task.features?.some((feature) => feature.layerUrl) ? `<button type="button" data-task-briefing="${id}">Briefing</button>` : ""}</div>`;
      return `<article class="feed-card"><span class="status-pill">${escapeHtml(STATUS_LABELS[task.status] || task.status || "Draft")}</span><h2>${escapeHtml(task.title || "Untitled task")}</h2><p>${escapeHtml(task.location || task.notes || "No location set")}</p><span class="feed-card__meta">${done}/${steps.length} steps${features ? ` · ${features} feature${features === 1 ? "" : "s"}` : ""}${task.updatedAt ? ` · ${dateLabel(task.updatedAt)}` : ""}</span><div class="feed-card__actions">${open}${share}</div>${more}</article>`;
    };
    return `<p class="mobile-workflow__subtitle">Write the steps, attach up to ${FIELD_TASK_LIMITS.maxFeatures} map features, then share a link or QR code. The person who completes it sends a link back.</p><button class="mobile-primary" data-new-task data-mobile-bar="primary">+ New field task</button><div class="feed-list">${tasks.map(card).join("") || `<div class="mobile-empty"><h2>No field tasks</h2><p>Create a task with steps to do and the features to visit, then share it.</p></div>`}</div>`;
  }

  #mapsLink(latitude, longitude) {
    const url = googleMapsLink(latitude, longitude);
    return url ? `<a class="task-google-maps" href="${url}" target="_blank" rel="noopener noreferrer">Google Maps ↗</a>` : "";
  }

  #featureRows(features, { editable = false, checkable = false } = {}) {
    if (!features.length) return `<p class="task-feature-empty">No features attached.</p>`;
    return `<ol class="task-feature-list">${features.map((feature, index) => `<li>${checkable ? `<label class="check-row"><input type="checkbox" name="featureDone" value="${index}" ${feature.done ? "checked" : ""}/> <span>${escapeHtml(feature.label)}</span></label>` : `<span>${feature.done ? '<b class="task-feature-done" aria-label="Visited">✓</b> ' : ""}${escapeHtml(feature.label)}</span>`}<small>${feature.objectId != null ? `ID ${escapeHtml(feature.objectId)} · ` : ""}${Number(feature.latitude).toFixed(5)}, ${Number(feature.longitude).toFixed(5)}</small><span class="task-feature-actions">${this.#mapsLink(feature.latitude, feature.longitude)}<button type="button" data-zoom-feature="${index}">Zoom</button>${editable ? `<button type="button" data-remove-feature="${index}" aria-label="Remove ${escapeHtml(feature.label)}">×</button>` : ""}</span></li>`).join("")}</ol>`;
  }

  #locationRow(task) {
    if (!Number.isFinite(task.latitude) || !Number.isFinite(task.longitude)) return "";
    const address = task.address?.label && task.address.label !== task.location ? `<small>${escapeHtml(task.address.label)}</small>` : "";
    return `<div class="task-location-row"><span><b>${escapeHtml(task.location || task.address?.label || "Task location")}</b>${address}<small>${Number(task.latitude).toFixed(5)}, ${Number(task.longitude).toFixed(5)}</small></span><span class="task-feature-actions">${this.#mapsLink(task.latitude, task.longitude)}<button type="button" data-zoom-location>Zoom</button></span></div>`;
  }

  #checkInSummary(checkIn) {
    if (!checkIn || !Number.isFinite(checkIn.latitude)) return "";
    const accuracy = Number.isFinite(checkIn.accuracy) ? ` · ±${Math.round(checkIn.accuracy)} m` : "";
    return `<div class="task-location-row task-checkin-row"><span><b>Checked in ${escapeHtml(dateLabel(checkIn.at))}</b>${checkIn.address?.label ? `<small>${escapeHtml(checkIn.address.label)}</small>` : ""}<small>${Number(checkIn.latitude).toFixed(5)}, ${Number(checkIn.longitude).toFixed(5)}${accuracy}</small></span><button type="button" data-zoom-checkin>Zoom</button></div>`;
  }

  #taskEditor(task = {}) {
    // Unlike shared and completed views, the editor keeps blank rows the author is still filling in.
    const steps = Array.isArray(task.steps) ? task.steps : taskSteps(task);
    const features = task.features || [];
    const full = features.length >= FIELD_TASK_LIMITS.maxFeatures;
    const stepRows = steps.map((step, index) => `<li><input type="checkbox" name="stepDone" value="${index}" ${step.done ? "checked" : ""} aria-label="Step ${index + 1} done"/><input name="stepText" value="${escapeHtml(step.text)}" placeholder="Step ${index + 1}" aria-label="Step ${index + 1}" maxlength="120"/><button type="button" data-remove-step="${index}" aria-label="Remove step ${index + 1}">×</button></li>`).join("");
    return `<form class="mobile-card task-editor" data-task-form data-task-id="${escapeHtml(task.id || "")}"><label>Task title<input name="title" required value="${escapeHtml(task.title || "")}" placeholder="Inspect shoreline access" maxlength="120" /></label><fieldset><legend>Task location</legend><label>Place name<input name="location" value="${escapeHtml(task.location || "")}" placeholder="Place or address" maxlength="120" /></label><div class="task-coordinates"><label>Latitude<input name="latitude" type="number" inputmode="decimal" step="any" min="-90" max="90" value="${escapeHtml(task.latitude ?? "")}" placeholder="45.52345" /></label><label>Longitude<input name="longitude" type="number" inputmode="decimal" step="any" min="-180" max="180" value="${escapeHtml(task.longitude ?? "")}" placeholder="-122.67621" /></label></div><input type="hidden" name="capturedAt" value="${escapeHtml(task.capturedAt || "")}"><div class="task-location-status" data-task-location-status>${task.capturedAt ? `Captured ${escapeHtml(dateLabel(task.capturedAt))}${Number.isFinite(task.latitude) ? ` · ${Number(task.latitude).toFixed(5)}, ${Number(task.longitude).toFixed(5)}` : ""}` : "Enter coordinates, use your location or the map center, or pick a point."}</div><p class="form-note" data-task-address>${task.address?.label ? `Address: ${escapeHtml(task.address.label)}` : ""}</p><div class="task-location-actions"><button type="button" data-capture-task-gps>Use my location</button><button type="button" data-capture-task-location>Use map center</button><button type="button" data-pick-location>Pick on map</button>${Number.isFinite(task.latitude) && Number.isFinite(task.longitude) ? `<button type="button" data-zoom-location>Zoom</button>` : ""}</div></fieldset><label>Instructions<textarea name="notes" rows="3" maxlength="${FIELD_TASK_LIMITS.maxNotes}" placeholder="What should the field worker know?">${escapeHtml(task.notes || "")}</textarea></label><fieldset><legend>Steps to complete</legend><ol class="task-step-list">${stepRows}</ol>${steps.length < FIELD_TASK_LIMITS.maxSteps ? `<button type="button" data-add-step>+ Add step</button>` : ""}</fieldset><fieldset><legend>Features <small>optional · ${features.length}/${FIELD_TASK_LIMITS.maxFeatures}</small></legend>${this.#featureRows(features, { editable: true })}<button type="button" data-attach-feature ${full ? "disabled" : ""}>${full ? `Limit of ${FIELD_TASK_LIMITS.maxFeatures} features reached` : "+ Attach a feature from the map"}</button><p class="form-note">Optional. Click a feature from a feature service layer; its location and ID travel with the shared task. A task can also rely on its location alone.</p></fieldset><label>Photos<input name="photos" type="file" accept="image/*" capture="environment" multiple /></label>${task.photos?.length ? `<p>${task.photos.length} photo${task.photos.length === 1 ? "" : "s"} attached · photos stay on this device</p>` : ""}<div class="feed-card__actions"><button type="submit" name="intent" value="share" data-mobile-bar="primary">Save &amp; share</button><button type="submit" name="intent" value="save" data-mobile-bar>Save draft</button><button type="button" data-cancel-task data-mobile-bar>Cancel</button>${task.id ? `<button type="button" data-delete-task="${escapeHtml(task.id)}">Delete</button>` : ""}</div></form>`;
  }

  #taskCompletion(task) {
    const steps = taskSteps(task);
    const completed = task.status === "completed";
    return `<form class="mobile-card task-editor task-complete" data-task-complete-form data-task-id="${escapeHtml(task.id)}"><span class="feed-card__meta">Tasks to complete</span><h2>${escapeHtml(task.title)}</h2>${task.notes ? `<p class="task-instructions">${escapeHtml(task.notes)}</p>` : ""}${this.#locationRow(task)}<fieldset class="task-checkin"><legend>Check-in <small>optional</small></legend>${this.#checkInSummary(task.checkIn) || `<p class="form-note">Record where you are and the time, with the address, as proof of the visit.</p>`}<button type="button" data-task-checkin>${task.checkIn ? "Check in again" : "Check in here"}</button></fieldset>${task.features?.length ? `<fieldset><legend>Features to visit</legend>${this.#featureRows(task.features, { checkable: true })}</fieldset>` : ""}<fieldset><legend>Steps</legend>${steps.map((step, index) => `<label class="check-row"><input type="checkbox" name="stepDone" value="${index}" ${step.done ? "checked" : ""}/> ${escapeHtml(step.text)}</label>`).join("") || `<p class="task-feature-empty">No steps listed.</p>`}</fieldset><label>Report<textarea name="report" rows="4" maxlength="${FIELD_TASK_LIMITS.maxNotes}" placeholder="What did you find?">${escapeHtml(task.report || "")}</textarea></label><label>Photos <small>kept on this device and added to the PDF report</small><input name="photos" type="file" accept="image/*" capture="environment" multiple /></label>${task.photos?.length ? `<p class="form-note">${task.photos.length} photo${task.photos.length === 1 ? "" : "s"} attached</p>` : ""}<label>Your name <small>optional</small><input name="completedBy" value="${escapeHtml(task.completedBy || "")}" maxlength="60" /></label><div class="feed-card__actions"><button type="submit" name="intent" value="return" data-mobile-bar="primary" data-bar-label="${completed ? "Send again" : "Send back"}">${completed ? "Create return link again" : "Complete &amp; send back"}</button><button type="submit" name="intent" value="save" data-mobile-bar data-bar-label="Save">Save progress</button><button type="button" data-cancel-task data-mobile-bar>Back</button></div></form>`;
  }

  #taskReport(task) {
    const steps = taskSteps(task);
    const done = steps.filter((step) => step.done).length;
    return `<section class="mobile-card task-report"><span class="feed-card__meta">Report received · ${escapeHtml(dateLabel(task.completedAt))}${task.completedBy ? ` · ${escapeHtml(task.completedBy)}` : ""}</span><h2>${escapeHtml(task.title)}</h2><p><strong>${done}/${steps.length}</strong> steps done${task.features?.length ? ` · <strong>${task.features.filter((feature) => feature.done).length}/${task.features.length}</strong> features visited` : ""}</p>${this.#locationRow(task)}${this.#checkInSummary(task.checkIn)}<ul class="task-report-steps">${steps.map((step) => `<li class="${step.done ? "is-done" : ""}"><span aria-hidden="true">${step.done ? "✓" : "○"}</span> ${escapeHtml(step.text)}</li>`).join("")}</ul>${task.features?.length ? `<h3>Features</h3>${this.#featureRows(task.features)}` : ""}${task.report ? `<h3>Report</h3><p class="task-instructions">${escapeHtml(task.report)}</p>` : ""}${task.photos?.length ? `<p class="form-note">${task.photos.length} photo${task.photos.length === 1 ? "" : "s"} on this device are included in the PDF.</p>` : ""}<div class="task-report-downloads"><button type="button" data-task-pdf="${escapeHtml(task.id)}">Download PDF</button><button type="button" data-task-csv="${escapeHtml(task.id)}">Download CSV</button></div><div class="feed-card__actions"><button type="button" data-open-task="${escapeHtml(task.id)}" data-mobile-bar="primary">Edit &amp; reassign</button><button type="button" data-cancel-task data-mobile-bar>Back</button></div></section>`;
  }

  #watchlist() {
    const state = this.store.snapshot();
    return `<p class="mobile-workflow__subtitle">Your places. Your thresholds.</p><div class="feed-list">${state.watchRules.map((rule) => `<article class="feed-card"><span class="status-pill">${state.acknowledgements.includes(rule.id) ? "Acknowledged" : escapeHtml(rule.status || "Monitoring")}</span><h2>${escapeHtml(rule.title || "Watch rule")}</h2><p class="metric">${escapeHtml(rule.current ?? "—")} <small>${escapeHtml(rule.units || "")}</small></p><p>Notify when ${escapeHtml(rule.field || "value")} is ${escapeHtml(rule.operator || "above")} ${escapeHtml(rule.threshold ?? "—")}.</p><div class="feed-card__actions"><button data-ack-rule="${escapeHtml(rule.id)}">Acknowledge</button><button data-route="briefing">Open briefing →</button></div></article>`).join("") || `<div class="mobile-empty"><h2>No watched places</h2><p>Watch rules stored in the project will surface thresholds and delayed sources here.</p></div>`}</div>`;
  }

  #more() {
    return `<p class="mobile-workflow__subtitle">The mobile app keeps the map and its shareable workflows focused and easy to reach.</p><div class="workflow-grid"><button data-route="briefing"><strong>Briefing</strong><span>Selected features and context · share by QR</span></button><button data-route="tours"><strong>Tours</strong><span>Guided places and chapters · share by QR</span></button><button data-route="tasks"><strong>Field tasks</strong><span>Assignments and drafts · share by QR</span></button><button data-open-field-notes><strong>Field notes</strong><span>Observations at a place or feature · share by QR</span></button><a class="workflow-grid__field" href="${appUrl("field/")}"><strong>Field Mode</strong><span>Offline notes, tasks &amp; sharing</span></a><button data-route="map"><strong>Map tools</strong><span>Places, bookmarks, draw, layers, and intelligence</span></button><button data-open-image class="workflow-grid__photo"><strong>Open from a photo</strong><span>A Smart map image or a picture of a GISMap Online QR code</span></button></div>${this.#skinPicker()}<section class="account-workflows"><span>With an account · coming soon</span><p>Updates, Compare, Watchlist, custom dashboards, and their desktop authoring tools.</p></section>`;
  }

  async #click(event) {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.matches("[data-workflow-close]")) return this.navigate("map");
    if (button.dataset.route) return this.navigate(button.dataset.route);
    if (button.matches("[data-open-image]")) return document.querySelector("#image-file-input")?.click();
    if (button.matches("[data-open-field-notes]")) { this.navigate("map"); return this.openFieldNotes?.(); }
    if (button.dataset.mobileSkin) {
      const skin = applyInterfaceSkin(button.dataset.mobileSkin, { colors: this.projectManager.current.presentation?.skinColors?.[button.dataset.mobileSkin] });
      this.projectManager.patchPresentation({ skin });
      this.render();
      return;
    }
    if (button.dataset.feedScope) { this.store.setScope(button.dataset.feedScope); return; }
    if (button.matches("[data-new-task]")) {
      this.#showTaskView({ mode: "edit", id: null }, { steps: [{ text: "", done: false }], features: [] });
      await this.#captureTaskLocation(this.root.querySelector("[data-task-form]"));
      return;
    }
    if (button.dataset.openTask) { const task = this.#task(button.dataset.openTask); return this.#showTaskView({ mode: "edit", id: task?.id }, structuredClone(task || {})); }
    if (button.dataset.completeTask) return this.#showTaskView({ mode: "complete", id: button.dataset.completeTask });
    if (button.dataset.reportTask) return this.#showTaskView({ mode: "report", id: button.dataset.reportTask });
    if (button.matches("[data-cancel-task]")) return this.#showTaskView(null);
    if (button.matches("[data-capture-task-location]")) return this.#captureTaskLocation(button.closest("form"));
    if (button.matches("[data-capture-task-gps]")) return this.#captureTaskGps(button);
    if (button.dataset.shareTask) return this.#shareTask(button.dataset.shareTask);
    if (button.dataset.sendBack) return this.#sendBack(button.dataset.sendBack);
    if (button.dataset.taskPdf) return this.#downloadTaskFile(button, () => this.#taskPdfFile(this.#task(button.dataset.taskPdf)));
    if (button.dataset.taskCsv) return this.#downloadTaskFile(button, async () => this.#taskCsvFile(this.#task(button.dataset.taskCsv)));
    if (button.dataset.deleteTask) return this.#deleteTask(button.dataset.deleteTask);
    if (button.dataset.taskTour) return this.#taskToTour(this.#task(button.dataset.taskTour));
    if (button.dataset.taskBriefing) return this.#taskToBriefing(this.#task(button.dataset.taskBriefing));
    if (button.matches("[data-add-step]")) { this.#editDraft(button.closest("form"), (draft) => draft.steps.push({ text: "", done: false })); this.root.querySelector('[name="stepText"]:last-of-type')?.focus(); return; }
    if (button.dataset.removeStep) return this.#editDraft(button.closest("form"), (draft) => draft.steps.splice(Number(button.dataset.removeStep), 1));
    if (button.dataset.removeFeature) return this.#editDraft(button.closest("form"), (draft) => draft.features.splice(Number(button.dataset.removeFeature), 1));
    if (button.matches("[data-attach-feature]")) return this.#startPicking(button.closest("form"), "feature");
    if (button.matches("[data-pick-location]")) return this.#startPicking(button.closest("form"), "location");
    if (button.matches("[data-zoom-location]")) return this.#zoomToTaskLocation(button);
    if (button.matches("[data-zoom-checkin]")) return this.#zoomToCheckIn();
    if (button.matches("[data-task-checkin]")) return this.#checkIn(button);
    if (button.dataset.zoomFeature) return this.#zoomToTaskFeature(button);
    if (button.dataset.ackRule) { this.store.acknowledge(button.dataset.ackRule); return; }
    if (button.matches("[data-open-mobile-menu]")) { this.navigate("map"); document.querySelector("#mobile-menu-toggle")?.click(); }
  }

  #change() {}

  async #submit(event) {
    event.preventDefault();
    const form = event.target;
    const data = new FormData(form);
    if (form.matches("[data-task-form]")) {
      const draft = this.#readTaskForm(form);
      const hasLat = Number.isFinite(draft.latitude);
      const hasLon = Number.isFinite(draft.longitude);
      if (hasLat !== hasLon || (hasLat && (Math.abs(draft.latitude) > 90 || Math.abs(draft.longitude) > 180))) {
        this.notify?.("Enter both a latitude (−90 to 90) and a longitude (−180 to 180), or leave both empty.");
        return;
      }
      const existing = this.#task(form.dataset.taskId);
      // Look up the address once per location, the same details Location Intelligence shows.
      let address = hasLat ? (draft.address || existing?.address || null) : null;
      if (hasLat && (address?.latitude !== draft.latitude || address?.longitude !== draft.longitude)) address = await this.#addressAt(draft.latitude, draft.longitude);
      const uploaded = await Promise.all([...form.querySelector('[name="photos"]')?.files || []].slice(0, MAX_TASK_PHOTOS).map((file) => photoDataUrl(file)));
      const id = form.dataset.taskId || newId("task");
      this.store.saveTask({ ...draft, address, id, photos: [...(existing?.photos || []), ...uploaded].slice(-MAX_TASK_PHOTOS), capturedAt: draft.capturedAt || new Date().toISOString(), status: existing?.status && existing.status !== "returned" ? existing.status : "draft", role: "author" });
      this.taskDraft = null;
      this.#showTaskView(null);
      if (event.submitter?.value === "share") await this.#shareTask(id);
    }
    if (form.matches("[data-task-complete-form]")) {
      const task = this.#task(form.dataset.taskId);
      if (!task) return;
      const finishing = event.submitter?.value === "return";
      this.store.saveTask({
        ...(await this.#completionPatch(form, task)),
        status: finishing ? "completed" : "in-progress",
        completedAt: finishing ? new Date().toISOString() : task.completedAt,
      });
      if (finishing) {
        this.#showTaskView(null);
        await this.#sendBack(task.id);
      } else {
        this.notify?.("Progress saved on this device.");
      }
    }
    if (form.matches("[data-compare-form]")) {
      this.store.update((state) => state.comparisons.unshift({ id: globalThis.crypto?.randomUUID?.() || `compare-${Date.now()}`, title: data.get("title"), left: data.get("left"), right: data.get("right"), createdAt: new Date().toISOString() }));
      this.render();
    }
  }

  #syncNav() {
    const menuOpen = document.body.classList.contains("mobile-menu-open");
    document.querySelectorAll("[data-mobile-workflow]").forEach((button) => {
      button.classList.toggle("is-active", !menuOpen && button.dataset.mobileWorkflow === this.route);
    });
    const menuToggle = document.querySelector("#mobile-menu-toggle");
    menuToggle?.classList.toggle("is-active", menuOpen);
    menuToggle?.setAttribute("aria-expanded", String(menuOpen));
    document.body.classList.toggle("mobile-map-route", this.media.matches && this.route === "map");
  }

  #closeMenu() {
    const drawer = document.querySelector("#mobile-menu-drawer");
    if (drawer) drawer.hidden = true;
    document.body.classList.remove("mobile-menu-open");
    const menuToggle = document.querySelector("#mobile-menu-toggle");
    menuToggle?.classList.remove("is-active");
    menuToggle?.setAttribute("aria-expanded", "false");
    // Desktop: the Modes dropdown that started the navigation closes too.
    document.querySelectorAll(".menu.is-open").forEach((menu) => menu.classList.remove("is-open"));
    document.querySelectorAll(".menu__trigger").forEach((trigger) => trigger.setAttribute("aria-expanded", "false"));
    document.querySelectorAll(".menu-bar.is-consolidated-open").forEach((menu) => menu.classList.remove("is-consolidated-open"));
    document.querySelectorAll(".menu-bar__all-trigger").forEach((trigger) => trigger.setAttribute("aria-expanded", "false"));
  }

  /** Use my location: the device's GPS fix, shown on the map, then the same capture as the map center. */
  async #captureTaskGps(button) {
    const form = button.closest("form");
    const label = button.textContent;
    button.disabled = true;
    button.textContent = "Finding your location…";
    try {
      const coords = await this.mapController.locateUser({ move: false });
      await this.#captureTaskLocation(form, { longitude: coords.longitude, latitude: coords.latitude, accuracy: coords.accuracy });
      this.mapController.setTaskPin?.([{ kind: "task", label: form?.elements.location.value || "Task location", latitude: Number(coords.latitude), longitude: Number(coords.longitude) }]);
    } catch (error) {
      this.notify?.(error?.code === 1 ? "Location permission was denied. Allow location for this site, or use the map center instead." : `Could not find your location: ${error?.message || "location unavailable"}.`);
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  }

  async #captureTaskLocation(form, fix = null) {
    const center = fix ? [fix.longitude, fix.latitude] : this.mapController.getViewState?.()?.center;
    if (!form || !center) return;
    const location = { longitude: center[0], latitude: center[1] };
    const capturedAt = new Date().toISOString();
    const round = (value) => (Number.isFinite(Number(value)) && value !== "" ? Number(Number(value).toFixed(6)) : "");
    form.elements.longitude.value = round(location.longitude ?? "");
    form.elements.latitude.value = round(location.latitude ?? "");
    form.elements.capturedAt.value = capturedAt;
    let result = null;
    try { result = await this.mapController.reverseGeocode(location); } catch { /* coordinates remain useful offline */ }
    if (result?.address) form.elements.location.value = result.address;
    // Keep the full address details so saving does not need a second lookup.
    const details = addressDetails(result, { latitude: Number(form.elements.latitude.value), longitude: Number(form.elements.longitude.value) });
    if (this.taskDraft && details) this.taskDraft.address = details;
    const addressNote = form.querySelector("[data-task-address]");
    if (addressNote) addressNote.textContent = details?.label ? `Address: ${details.label}` : "";
    const status = form.querySelector("[data-task-location-status]");
    if (status) status.textContent = `${fix ? "Your location" : "Captured"} ${dateLabel(capturedAt)} · ${Number(form.elements.latitude.value).toFixed(5)}, ${Number(form.elements.longitude.value).toFixed(5)}${Number.isFinite(fix?.accuracy) ? ` · ±${Math.round(fix.accuracy)} m` : ""}`;
  }

  #task(id) {
    return id ? this.store.snapshot().fieldTasks.find((item) => item.id === id) : undefined;
  }

  #showTaskView(view, draft = null) {
    this.taskView = view;
    this.taskDraft = view?.mode === "edit" ? draft : null;
    // An open task keeps its places pinned on the map, even after you go back to the map.
    const shown = view && view.mode !== "edit" ? this.#task(view.id) : null;
    if (shown) this.mapController.setTaskPin?.(fieldTaskPoints(shown));
    this.render();
    this.root?.querySelector(".mobile-workflow__body")?.scrollTo?.(0, 0);
  }

  #readTaskForm(form) {
    const data = new FormData(form);
    const stepsDone = new Set(data.getAll("stepDone").map(Number));
    const number = (name) => (data.get(name) === "" || data.get(name) == null ? undefined : Number(data.get(name)));
    return {
      ...(this.taskDraft || {}),
      title: String(data.get("title") || ""),
      location: String(data.get("location") || ""),
      notes: String(data.get("notes") || ""),
      longitude: number("longitude"),
      latitude: number("latitude"),
      capturedAt: String(data.get("capturedAt") || ""),
      steps: data.getAll("stepText").map((text, index) => ({ text: String(text).trim(), done: stepsDone.has(index) })).filter((step, index, all) => step.text || index === all.length - 1),
      features: [...(this.taskDraft?.features || [])],
      checklist: undefined,
    };
  }

  #editDraft(form, change) {
    const draft = this.#readTaskForm(form);
    change(draft);
    this.taskDraft = draft;
    this.render();
  }

  #startPicking(form, mode = "feature") {
    this.taskDraft = this.#readTaskForm(form);
    if (mode === "feature" && (this.taskDraft.features || []).length >= FIELD_TASK_LIMITS.maxFeatures) return;
    this.picking = mode;
    document.body.classList.add("field-task-picking");
    if (this.media.matches) this.#hideRoot();
    this.#showMapBanner(mode === "location" ? "Pick the task location" : "Pick a feature to attach", "Cancel", () => this.#stopPicking());
  }

  #stopPicking() {
    this.picking = false;
    document.body.classList.remove("field-task-picking");
    this.#removeMapBanner();
    if (this.route === "tasks" && this.root) {
      this.root.hidden = false;
      document.body.classList.add("mobile-workflow-open");
      this.render();
    }
  }

  #setPickedLocation({ point, address }) {
    const location = point && this.mapController.geographicCoordinates(point);
    if (!location) {
      this.notify?.("Pick a point on the ground.");
      return;
    }
    Object.assign(this.taskDraft, {
      latitude: Number(location.latitude.toFixed(6)),
      longitude: Number(location.longitude.toFixed(6)),
      capturedAt: new Date().toISOString(),
    });
    if (!this.taskDraft.location && address?.address) this.taskDraft.location = String(address.address).slice(0, 120);
    this.taskDraft.address = addressDetails(address, { latitude: this.taskDraft.latitude, longitude: this.taskDraft.longitude });
    this.#stopPicking();
  }

  #attachPickedFeature({ results = [] }) {
    const hit = results.find((result) => result.kind === "feature" && result.source && featureLayerUrl(result.source));
    if (!hit) {
      this.notify?.("No feature service feature there. Click directly on a feature.");
      return;
    }
    // The (sub)layer that drew the feature: { url, layerId, title, objectIdField, displayField }.
    const layer = hit.source;
    const attributes = hit.attributes || {};
    const objectId = attributes[layer.objectIdField] ?? null;
    const point = this.mapController.geographicCoordinates(hit.geometry);
    if (!point) {
      this.notify?.("That feature has no location to share.");
      return;
    }
    const layerUrl = featureLayerUrl(layer);
    const features = this.taskDraft.features || [];
    if (features.some((feature) => feature.layerUrl === layerUrl && objectId != null && feature.objectId === objectId)) {
      this.notify?.("That feature is already attached.");
    } else {
      const named = attributes[layer.displayField];
      features.push({
        layerUrl,
        layerTitle: hit.layerTitle || layer.title || "",
        objectId,
        longitude: Number(point.longitude.toFixed(6)),
        latitude: Number(point.latitude.toFixed(6)),
        label: String(named ?? `${hit.layerTitle || layer.title || "Feature"}${objectId != null ? ` ${objectId}` : ""}`).slice(0, 80),
        done: false,
      });
      this.taskDraft.features = features;
      if (!this.taskDraft.location && named) this.taskDraft.location = String(named).slice(0, 120);
    }
    this.#stopPicking();
  }

  /**
   * Frames a task opened from a link: all of its places, or the place or feature
   * the link focuses on (`at=lat,lon`, `feature=N`), as PDF report links do.
   */
  async #frameSharedTask(id, { at = null, feature: featureIndex = null } = {}) {
    const task = this.#task(id);
    if (!task) return;
    try {
      const feature = Number.isInteger(featureIndex) ? task.features?.[featureIndex] : null;
      if (feature) {
        const graphic = await this.#queryTaskFeature(feature);
        await this.mapController.whenReady();
        if (graphic) await this.mapController.goToFeature(graphic);
        else await this.mapController.goToTaskPlaces?.([feature], { animate: false });
        return;
      }
      await this.mapController.goToTaskPlaces?.(at ? [at] : fieldTaskPoints(task), { animate: false });
    } catch {
      // Framing is a convenience; the task itself is already open.
    }
  }

  /**
   * The attached feature's own geometry, if its layer is on the map. It is asked for
   * in WGS84: some services use custom coordinate systems the camera cannot go to.
   */
  async #queryTaskFeature(feature) {
    const layer = this.mapController.getLayers().find((item) => featureLayerUrl(item) === feature.layerUrl && item.queryable);
    if (!layer || feature.objectId == null) return null;
    const { features = [] } = await this.mapController.queryFeatures(layer.uid, { objectIds: [feature.objectId], returnGeometry: true, outFields: [], outSpatialReference: { wkid: 4326 } }, { layerDefaults: false });
    return features[0]?.geometry ? features[0] : null;
  }

  async #zoomToTaskFeature(button) {
    const index = Number(button.dataset.zoomFeature);
    const task = this.taskView?.mode === "edit" ? this.taskDraft : this.#task(this.taskView?.id);
    const feature = task?.features?.[index];
    if (!feature) return;
    if (this.taskView?.mode === "edit") this.taskDraft = this.#readTaskForm(button.closest("form"));
    await this.#flyToTaskPoint(feature, async () => {
      const graphic = await this.#queryTaskFeature(feature);
      if (!graphic) return false;
      await this.mapController.goToFeature(graphic);
      return true;
    }, task);
  }

  async #zoomToCheckIn() {
    const task = this.#task(this.taskView?.id);
    const checkIn = task?.checkIn;
    if (!checkIn || !Number.isFinite(checkIn.latitude)) return;
    await this.#flyToTaskPoint({ label: "Check-in", longitude: checkIn.longitude, latitude: checkIn.latitude }, null, task);
  }

  async #zoomToTaskLocation(button) {
    const editing = this.taskView?.mode === "edit";
    if (editing) this.taskDraft = this.#readTaskForm(button.closest("form"));
    const task = editing ? this.taskDraft : this.#task(this.taskView?.id);
    if (!task || !Number.isFinite(task.latitude) || !Number.isFinite(task.longitude)) return;
    await this.#flyToTaskPoint({ label: task.location || task.title || "Task location", longitude: task.longitude, latitude: task.latitude }, null, task);
  }

  /** Pins a task place and flies there; on phones the screen steps aside and your own position is shown too. */
  async #flyToTaskPoint(point, goToFeature = null, task = null) {
    this.mapController.setTaskPin?.(task ? fieldTaskPoints(task) : point);
    if (this.media.matches) {
      this.#hideRoot();
      this.#showMapBanner(point.label, "Back to task", () => {
        this.#removeMapBanner();
        if (this.root) this.root.hidden = false;
        document.body.classList.add("mobile-workflow-open");
        this.render();
      });
      this.mapController.locateUser?.({ move: false }).catch(() => {
        this.notify?.("Your location is unavailable, so only the task is marked.");
      });
    }
    try {
      if (goToFeature && await goToFeature()) return;
      await this.mapController.goToSearchResult({ location: [point.longitude, point.latitude] });
    } catch (error) {
      if (error?.name !== "AbortError") this.notify?.(error.message);
    }
  }

  #showMapBanner(message, actionLabel, action) {
    this.#removeMapBanner();
    const banner = document.createElement("div");
    banner.className = "field-task-banner";
    banner.setAttribute("role", "status");
    const label = document.createElement("span");
    label.textContent = message;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = actionLabel;
    button.addEventListener("click", action);
    banner.append(label, button);
    document.body.append(banner);
    document.body.classList.add("field-task-on-map");
  }

  #removeMapBanner() {
    document.querySelectorAll(".field-task-banner").forEach((banner) => banner.remove());
    document.body.classList.remove("field-task-on-map");
  }

  async #shareTask(id) {
    const task = this.#task(id);
    if (!task) return;
    try {
      const url = createFieldTaskUrl({ baseUrl: location.href, task: this.#withStyles(task), kind: "assign" });
      if (!task.status || task.status === "draft") this.store.saveTask({ id, status: "sent" });
      return await this.shareWorkflow?.("tasks", { url, title: task.title || "Field task", eyebrow: "Field task assignment", card: { lines: ["Scan to open this field task and its places to visit,", "or long-click the QR code to open it in a browser."], footer: "Complete field task assignment encoded in this QR" }, message: "Scan or send this link. It opens the steps and features to complete, and lets them send a report back." });
    } catch (error) {
      this.notify?.(error.message);
    }
  }

  async #sendBack(id) {
    const task = this.#task(id);
    if (!task) return;
    try {
      const url = createFieldTaskUrl({ baseUrl: location.href, task: { ...this.#withStyles(task), id: task.assignmentId || task.id }, kind: "return" });
      return await this.shareWorkflow?.("tasks", { url, title: `Report: ${task.title || "Field task"}`, eyebrow: "Completed field task", card: { lines: ["Scan to record this completed field task report,", "or long-click the QR code to open it in a browser."], footer: "Completed field task report encoded in this QR" }, message: "Send this link or QR code back to whoever assigned the task. Opening it records your report. The PDF and CSV are copies to keep or attach.", downloads: [
        { label: "Download PDF", share: true, create: () => this.#taskPdfFile(task) },
        { label: "Download CSV", create: async () => this.#taskCsvFile(task) },
      ] });
    } catch (error) {
      this.notify?.(error.message);
    }
  }

  async #taskPdfFile(task) {
    if (!task) throw new Error("That field task is no longer on this device.");
    // The snapshot needs the map to render (it cannot while the page is hidden), so it gets a time limit;
    // the report is still useful without it.
    const mapImage = await Promise.race([
      Promise.resolve(this.mapController.captureTaskMap?.(fieldTaskPoints(task))).catch(() => null),
      new Promise((resolve) => setTimeout(() => resolve(null), 15000)),
    ]);
    const blob = await fieldTaskPdf(task, { mapImage, reportUrl: this.#taskLink(task), skin: document.documentElement.dataset.skin });
    return new File([blob], `${fieldTaskFileStem(task)}.pdf`, { type: "application/pdf" });
  }

  /** The link that reopens this task as it stands: its report once completed, otherwise the assignment. */
  #taskLink(task) {
    const kind = task.role === "assignee" || task.status === "returned" ? "return" : "assign";
    const id = String(task.assignmentId || task.id || "").replace(/~(assigned|report)$/, "");
    try {
      return createFieldTaskUrl({ baseUrl: location.href, task: { ...this.#withStyles(task), id }, kind });
    } catch {
      return null;
    }
  }

  /** The task with the current styles of the layers its features come from, so they look the same when opened. */
  #withStyles(task) {
    const urls = new Set((task.features || []).map((feature) => feature.layerUrl).filter(Boolean));
    if (!urls.size) return task;
    const layerStyles = { ...(task.layerStyles || {}) };
    for (const layer of this.mapController.getLayers?.() || []) {
      const url = featureLayerUrl(layer);
      const renderer = layer.renderer;
      if (url && urls.has(url) && renderer) layerStyles[url] = renderer;
    }
    return Object.keys(layerStyles).length ? { ...task, layerStyles } : task;
  }

  /** The task's location and features as tour chapters. */
  #taskToTour(task) {
    if (!task) return;
    const places = [];
    if (Number.isFinite(task.latitude) && Number.isFinite(task.longitude)) places.push({ title: task.location || task.title || "Task location", body: task.notes || "", latitude: task.latitude, longitude: task.longitude, address: task.address?.label || "" });
    (task.features || []).forEach((feature) => places.push({ title: feature.label, body: feature.objectId != null ? `ID ${feature.objectId}` : "", latitude: feature.latitude, longitude: feature.longitude }));
    if (task.checkIn && Number.isFinite(task.checkIn.latitude)) places.push({ title: "Check-in", body: task.checkIn.address?.label || "", latitude: task.checkIn.latitude, longitude: task.checkIn.longitude });
    if (!places.length) return this.notify?.("This task has no places to tour.");
    this.createTour?.(places, { title: task.title });
  }

  /** The task's features as a briefing on their layer. */
  #taskToBriefing(task) {
    const feature = task?.features?.find((item) => item.layerUrl);
    if (!feature) return this.notify?.("Attach a feature from a feature layer to brief on it.");
    const ids = task.features.filter((item) => item.layerUrl === feature.layerUrl && item.objectId != null).map((item) => String(item.objectId));
    const labels = Object.fromEntries(task.features.filter((item) => item.objectId != null).map((item) => [String(item.objectId), item.label]));
    this.createBriefing?.({ layerUrl: feature.layerUrl, ids, title: task.title, steps: taskSteps(task).map((step) => step.text), labels });
  }

  /**
   * Opens the task editor with a prefilled draft, for example the action items
   * of a briefing slide: { title, notes, steps: [text], latitude, longitude, location }.
   */
  newTaskFrom(draft = {}) {
    this.navigate("tasks");
    const steps = (draft.steps || []).filter(Boolean).slice(0, FIELD_TASK_LIMITS.maxSteps).map((text) => ({ text: String(text).slice(0, 120), done: false }));
    this.#showTaskView({ mode: "edit", id: null }, {
      title: String(draft.title || "").slice(0, 120),
      notes: String(draft.notes || "").slice(0, FIELD_TASK_LIMITS.maxNotes),
      location: draft.location || "",
      latitude: Number.isFinite(draft.latitude) ? Number(draft.latitude.toFixed(6)) : undefined,
      longitude: Number.isFinite(draft.longitude) ? Number(draft.longitude.toFixed(6)) : undefined,
      steps: steps.length ? steps : [{ text: "", done: false }],
      features: (draft.features || []).slice(0, FIELD_TASK_LIMITS.maxFeatures),
    });
    this.notify?.("New field task drafted. Check it, then Save & share.");
  }

  #taskCsvFile(task) {
    if (!task) throw new Error("That field task is no longer on this device.");
    return new File([fieldTaskCsv(task)], `${fieldTaskFileStem(task)}.csv`, { type: "text/csv" });
  }

  async #downloadTaskFile(button, create) {
    const label = button.textContent;
    button.disabled = true;
    button.textContent = "Preparing…";
    try {
      const file = await create();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(file);
      link.download = file.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (error) {
      this.notify?.(error.message);
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  }

  /** Reverse-geocodes a place (with a time limit, so a slow or offline lookup never blocks saving). */
  async #addressAt(latitude, longitude) {
    const lookup = this.mapController.reverseGeocode?.({ longitude, latitude });
    const result = await Promise.race([Promise.resolve(lookup).catch(() => null), new Promise((resolve) => setTimeout(() => resolve(null), 8000))]);
    return addressDetails(result, { latitude, longitude });
  }

  /** What the completion form holds right now, including newly chosen photos. */
  async #completionPatch(form, task) {
    const data = new FormData(form);
    const stepsDone = new Set(data.getAll("stepDone").map(Number));
    const featuresDone = new Set(data.getAll("featureDone").map(Number));
    const uploaded = await Promise.all([...form.querySelector('[name="photos"]')?.files || []].slice(0, MAX_TASK_PHOTOS).map((file) => photoDataUrl(file)));
    return {
      id: task.id,
      photos: [...(task.photos || []), ...uploaded].slice(-MAX_TASK_PHOTOS),
      steps: taskSteps(task).map((step, index) => ({ ...step, done: stepsDone.has(index) })),
      features: (task.features || []).map((feature, index) => ({ ...feature, done: featuresDone.has(index) })),
      report: String(data.get("report") || ""),
      completedBy: String(data.get("completedBy") || ""),
    };
  }

  /** Records where the field worker is, when, and the address there. Saves the form so nothing typed is lost. */
  async #checkIn(button) {
    const form = button.closest("form");
    const task = this.#task(form?.dataset.taskId);
    if (!task) return;
    const label = button.textContent;
    button.disabled = true;
    button.textContent = "Finding your location…";
    try {
      const coords = await this.mapController.locateUser({ move: false });
      const latitude = Number(Number(coords.latitude).toFixed(6));
      const longitude = Number(Number(coords.longitude).toFixed(6));
      button.textContent = "Looking up the address…";
      const address = await this.#addressAt(latitude, longitude);
      this.store.saveTask({
        ...(await this.#completionPatch(form, task)),
        status: task.status === "completed" ? "completed" : "in-progress",
        checkIn: { latitude, longitude, accuracy: Number.isFinite(coords.accuracy) ? Math.round(coords.accuracy) : null, at: new Date().toISOString(), address },
      });
      this.render();
      this.mapController.setTaskPin?.(fieldTaskPoints(this.#task(task.id)));
      this.notify?.(address?.label ? `Checked in at ${address.label}.` : "Checked in.");
    } catch (error) {
      button.disabled = false;
      button.textContent = label;
      this.notify?.(error?.code === 1 ? "Location permission was denied, so the check-in was not recorded." : `Could not check in: ${error?.message || "location unavailable"}.`);
    }
  }

  #deleteTask(id) {
    if (!globalThis.confirm?.("Delete this field task from this device?")) return;
    this.store.update((state) => { state.fieldTasks = state.fieldTasks.filter((task) => task.id !== id); });
    this.#showTaskView(null);
  }

  /** Records a task opened from a shared link and shows it. */
  async openSharedTask({ kind, task: shared }, focus = {}) {
    let tasks = this.store.snapshot().fieldTasks;
    const sharedId = shared.id || newId("task");
    if (kind === "return") {
      // A report usually comes back to a fresh page; reopen the saved project that holds the original.
      if (!tasks.some((task) => task.id === sharedId && task.role !== "assignee")) {
        const home = this.projectManager.list().find((project) => project.mobile?.fieldTasks?.some((task) => task.id === sharedId && task.role !== "assignee"));
        if (home && home.id !== this.projectManager.current.id) {
          await this.projectManager.loadSaved(home.id);
          tasks = this.store.snapshot().fieldTasks;
        }
      }
      const original = tasks.find((task) => task.id === sharedId && task.role !== "assignee");
      // On the device that completed it (testing a round trip), keep the field copy separate.
      const id = original?.id || (tasks.some((task) => task.id === sharedId) ? `${sharedId}~report` : sharedId);
      this.store.saveTask({ ...(original || {}), ...shared, address: original?.address || shared.address, id, role: "author", status: "returned" });
      this.navigate("tasks");
      this.#showTaskView({ mode: "report", id });
      void this.#frameSharedTask(id, focus);
      this.notify?.(original ? "Field report received." : "Field report received for a task not on this device.");
      return;
    }
    // Keep progress if the same assignment is opened again; a clash with a task this
    // device authored (testing your own link) gets its own local copy.
    const previous = tasks.find((task) => task.role === "assignee" && (task.assignmentId || task.id) === sharedId);
    const id = previous?.id || (tasks.some((task) => task.id === sharedId) ? `${sharedId}~assigned` : sharedId);
    const doneSteps = new Set(taskSteps(previous || {}).filter((step) => previous && step.done).map((step) => step.text));
    const doneFeatures = new Set((previous?.features || []).filter((feature) => feature.done).map((feature) => `${feature.layerUrl}|${feature.objectId}|${feature.label}`));
    this.store.saveTask({
      ...shared,
      id,
      assignmentId: sharedId,
      role: "assignee",
      status: previous?.status || "assigned",
      report: previous?.report || "",
      completedBy: previous?.completedBy || "",
      steps: shared.steps.map((step) => ({ ...step, done: doneSteps.has(step.text) })),
      features: shared.features.map((feature) => ({ ...feature, done: doneFeatures.has(`${feature.layerUrl}|${feature.objectId}|${feature.label}`) })),
    });
    this.navigate("tasks");
    this.#showTaskView({ mode: "complete", id });
    void this.#frameSharedTask(id, focus);
  }
}
