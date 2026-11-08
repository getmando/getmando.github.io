// Leaflet helpers: one map style per theme (Esri canvas tiles) or satellite, and vehicle pins that show the unit
// number, what it's doing (moving / idling / stopped / no signal) and which way it's heading.
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
const ATTR = 'Esri, HERE, Garmin, © OpenStreetMap contributors';

export function makeMap(el, { theme = 'light', center = [30.2672, -97.7431], zoom = 11, zoomControl = true } = {}) {
  const L = window.L;
  const map = L.map(el, { zoomControl: false, attributionControl: true, worldCopyJump: true }).setView(center, zoom);
  if (zoomControl) L.control.zoom({ position: 'bottomright' }).addTo(map);
  map.attributionControl.setPrefix('');
  const shade = theme === 'dark' ? 'Dark' : 'Light';
  const base = L.layerGroup([
    L.tileLayer(`${ESRI}Canvas/World_${shade}_Gray_Base/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 20, maxNativeZoom: 16, attribution: ATTR }),
    L.tileLayer(`${ESRI}Canvas/World_${shade}_Gray_Reference/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 20, maxNativeZoom: 16 }),
  ]);
  const sat = L.layerGroup([
    L.tileLayer(`${ESRI}World_Imagery/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 20, maxNativeZoom: 19, attribution: 'Esri, Maxar, Earthstar Geographics' }),
    L.tileLayer(`${ESRI}Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 20, maxNativeZoom: 19, opacity: 0.85 }),
    L.tileLayer(`${ESRI}Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 20, maxNativeZoom: 19 }),
  ]);
  base.addTo(map);
  const pins = L.layerGroup().addTo(map);
  const trail = L.layerGroup().addTo(map);
  return {
    map, pins, trail,
    satellite(on) {
      if (on) { map.removeLayer(base); sat.addTo(map); } else { map.removeLayer(sat); base.addTo(map); }
    },
    destroy() { map.remove(); },
  };
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ARROW = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.5 19 20 12 16.2 5 20z"/></svg>';
const DOT = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/></svg>';

export function pinIcon(label, state, { heading = null, selected = false } = {}) {
  const moving = state === 'moving';
  const glyph = moving && heading !== null && heading !== undefined
    ? `<span style="display:grid;transform:rotate(${Math.round(heading)}deg)">${ARROW}</span>` : DOT;
  return window.L.divIcon({
    className: 'pinwrap',
    html: `<div class="pin ${state}${selected ? ' picked' : ''}"><span class="p-d">${glyph}</span>${esc(label)}</div>`,
    iconSize: [0, 0],
  });
}

export function fit(map, points, maxZoom = 15) {
  const L = window.L;
  if (!points.length) return;
  if (points.length === 1) { map.setView(points[0], Math.min(maxZoom, 14), { animate: false }); return; }
  map.fitBounds(L.latLngBounds(points), { padding: [60, 60], maxZoom, animate: false });
}
