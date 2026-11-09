// Leaflet helpers: one map style per theme (Esri canvas tiles) or satellite, and vehicle pins that show the unit
// number, what it's doing (moving / idling / stopped / no signal) — by shape as well as color — and which way it's heading.
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
const ATTR = 'Esri, HERE, Garmin, © OpenStreetMap contributors';

// `still`: a picture of the map (no dragging or zooming) — the small maps on a phone, so a swipe scrolls the page
export function makeMap(el, { theme = 'light', center = [30.2672, -97.7431], zoom = 11, zoomControl = true, still = false } = {}) {
  const L = window.L;
  const map = L.map(el, { zoomControl: false, attributionControl: true, worldCopyJump: true,
    ...(still ? { dragging: false, touchZoom: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false } : {}) }).setView(center, zoom);
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
const svg = (body) => `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${body}</svg>`;
// one shape per state, so the pins can be told apart without color: arrow = moving, bars = idling, square = stopped,
// "!" = no signal, dot = waiting for its first position
const GLYPH = {
  moving: svg('<path d="M12 3.5 19 20 12 16.2 5 20z"/>'),
  idle: svg('<rect x="6.5" y="6" width="4" height="12" rx="1.2"/><rect x="13.5" y="6" width="4" height="12" rx="1.2"/>'),
  stopped: svg('<rect x="6.5" y="6.5" width="11" height="11" rx="2"/>'),
  lost: svg('<rect x="10.4" y="4.5" width="3.2" height="10" rx="1.6"/><circle cx="12" cy="18.6" r="1.9"/>'),
  dot: svg('<circle cx="12" cy="12" r="5"/>'),
};

// `old`: last heard moving 5+ minutes ago (amber, outlined arrow — it may not be moving now)
export function pinIcon(label, state, { heading = null, selected = false, old = false } = {}) {
  const g = GLYPH[state] || GLYPH.dot;
  const glyph = state === 'moving' && heading !== null && heading !== undefined
    ? `<span class="p-rot" style="transform:rotate(${Math.round(heading)}deg)">${g}</span>` : g;
  return window.L.divIcon({
    className: 'pinwrap',
    html: `<div class="pin ${esc(state)}${old ? ' old' : ''}${selected ? ' picked' : ''}"><span class="p-d">${glyph}</span>${esc(label)}</div>`,
    iconSize: [0, 0],
  });
}

// a vehicle pin anyone can use: click or tap it, or Tab to it and press Enter; screen readers hear what it is
export function addPin(layer, latlng, { label, state, heading, selected, old, name, onPick, zIndexOffset = 0 }) {
  const L = window.L;
  const mk = L.marker(latlng, { icon: pinIcon(label, state, { heading, selected, old }), title: name || label, keyboard: !!onPick, riseOnHover: true, zIndexOffset });
  if (onPick) {
    mk.on('click', () => onPick());
    mk.on('add', () => {
      const el = mk.getElement();
      if (!el || el.dataset.mzKeys) return;
      el.dataset.mzKeys = '1';
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', name || label);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onPick(); } });
    });
  }
  return mk.addTo(layer);
}

export function fit(map, points, maxZoom = 15) {
  const L = window.L;
  if (!points.length) return;
  if (points.length === 1) { map.setView(points[0], Math.min(maxZoom, 14), { animate: false }); return; }
  map.fitBounds(L.latLngBounds(points), { padding: [60, 60], maxZoom, animate: false });
}
