// The guided-tour pin shared by every map engine.

/** The pin artwork as an SVG data URL; the active chapter gets a brighter accent. */
export function tourMarkerDataUrl(active = false) {
  const accent = active ? "#ffb52e" : "#e49a1c";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 84">
    <g stroke="#fff" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" paint-order="stroke fill">
      <path fill="#0f6757" d="M9 49 32 38l23 11-23 13z"/>
      <path fill="#16806b" d="m13 57 19-9 19 9-19 12z"/>
      <path fill="#23967d" d="m18 65 14-7 14 7-14 15z"/>
      <circle cx="32" cy="25" r="20" fill="#0b584b"/>
    </g>
    <g fill="none" stroke="#78d2bc" stroke-width="1.7" opacity=".95">
      <circle cx="32" cy="25" r="15.5"/><path d="M16.5 25h31M32 9.5v31M21 14c7 7 7 15 0 22M43 14c-7 7-7 15 0 22"/>
    </g>
    <path d="M32 15a8 8 0 0 0-8 8c0 6 8 14 8 14s8-8 8-14a8 8 0 0 0-8-8Z" fill="${accent}" stroke="#fff" stroke-width="1.7"/>
    <circle cx="32" cy="23" r="3" fill="#fff"/>
    <path d="m16 49 16 8 16-8M20 58l12 6 12-6M25 67l7 4 7-4" fill="none" stroke="#a9eadb" stroke-width="1.4"/>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

/** Where a chapter's pin goes: its view centre, else its viewpoint target or camera position. */
export function tourChapterPoint(chapter = {}) {
  const state = chapter.viewState || {};
  const center = state.center;
  if (Array.isArray(center) && Number.isFinite(Number(center[0])) && Number.isFinite(Number(center[1]))) {
    const longitude = Number(center[0]);
    const latitude = Number(center[1]);
    if (Math.abs(longitude) <= 180 && Math.abs(latitude) <= 90) return { longitude, latitude };
  }

  const target = chapter.viewpoint?.targetGeometry || chapter.viewpoint?.target || state.camera?.position;
  if (!target) return null;
  let longitude = Number(target.longitude ?? target.x);
  let latitude = Number(target.latitude ?? target.y);
  const wkid = target.spatialReference?.latestWkid ?? target.spatialReference?.wkid;
  if ([3857, 102100, 102113].includes(wkid)) {
    const radius = 6378137;
    longitude = (longitude / radius) * (180 / Math.PI);
    latitude = (2 * Math.atan(Math.exp(latitude / radius)) - (Math.PI / 2)) * (180 / Math.PI);
  }
  return Number.isFinite(longitude) && Number.isFinite(latitude) && Math.abs(longitude) <= 180 && Math.abs(latitude) <= 90
    ? { longitude, latitude }
    : null;
}
