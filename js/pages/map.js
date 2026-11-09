// Live map: every vehicle with GPS, from any source, refreshed every 15 seconds. Pick one to see what it's doing
// and today's trail. GPS units not linked to a vehicle show too, so nothing reporting is ever hidden. When a refresh
// fails, the last positions stay and the header says how old they are.
import { html, useState, useEffect, useRef, Icon, Btn, Chip, Empty, Seg, Top, LoadError, Stale, useLoad, useTick } from '../ui.js';
import { useApp, go } from '../ctx.js';
import { loadAssets, loadDevices, loadTrail, byAsset } from '../data.js';
import { vstate, ago, fmtTime, startOfDay, sourceName, can, hasModule, ensureLeaflet, plural } from '../util.js';
import { makeMap, pinIcon, addPin, fit } from '../maps.js';
import { vehicleIcon, vehicleLine } from '../parts/asset.js';

function MapView({ rows, sel, onSel, sat, theme, trail }) {
  const el = useRef(null);
  const m = useRef(null);
  const marks = useRef(new Map());
  const fitted = useRef(false);
  const [L, setL] = useState(window.L || null);                    // the map library loads only when a map is shown
  useEffect(() => { if (!L) ensureLeaflet().then(setL).catch(() => {}); }, []);
  useEffect(() => {
    if (!L || !el.current) return undefined;
    m.current = makeMap(el.current, { theme });
    marks.current = new Map();
    fitted.current = false;
    const ro = new ResizeObserver(() => m.current?.map.invalidateSize());
    ro.observe(el.current);
    return () => { ro.disconnect(); m.current?.destroy(); m.current = null; };
  }, [theme, L]);
  useEffect(() => { m.current?.satellite(sat); }, [sat, theme, L]);
  useEffect(() => {
    if (!m.current) return;
    const seen = new Set();
    const pts = [];
    for (const r of rows) {
      const d = r.state.dev;
      if (!d || d.last_lat == null) continue;
      seen.add(r.id);
      pts.push([d.last_lat, d.last_lon]);
      const old = r.state.key === 'moving' && r.state.tone === 'amber';
      const name = `${r.label}: ${r.state.label}`;
      let mk = marks.current.get(r.id);
      if (!mk) {
        mk = addPin(m.current.pins, [d.last_lat, d.last_lon], { label: r.label, state: r.state.key, heading: d.last_heading, old, selected: sel === r.id,
          name, onPick: () => onSel(r.id) });
        marks.current.set(r.id, mk);
      } else {
        mk.setLatLng([d.last_lat, d.last_lon]);
        mk.setIcon(pinIcon(r.label, r.state.key, { heading: d.last_heading, selected: sel === r.id, old }));
        mk.getElement()?.setAttribute('aria-label', name);
      }
      mk.setZIndexOffset(sel === r.id ? 1000 : 0);
    }
    for (const [id, mk] of marks.current) if (!seen.has(id)) { m.current.pins.removeLayer(mk); marks.current.delete(id); }
    if (!fitted.current && pts.length) { fit(m.current.map, pts); fitted.current = true; }
  }, [rows, sel, theme, L]);
  useEffect(() => {
    const d = rows.find((x) => x.id === sel)?.state.dev;
    if (m.current && d && d.last_lat != null) m.current.map.setView([d.last_lat, d.last_lon], Math.max(m.current.map.getZoom(), 14), { animate: true });
  }, [sel]);
  useEffect(() => {
    if (!m.current) return;
    m.current.trail.clearLayers();
    const p = (trail?.points || []).map((x) => [x.lat, x.lon]);
    if (p.length > 1) {
      L.polyline(p, { className: 'trail-line', weight: 4, opacity: 0.9 }).addTo(m.current.trail);
      L.circleMarker(p[0], { radius: 5, className: 'trail-start', weight: 2 }).addTo(m.current.trail);
    }
  }, [trail, theme, L]);
  return html`<div class="mapbox" ref=${el} aria-label="Map of your vehicles"></div>`;
}

const FILTERS = { all: () => true, moving: (r) => r.state.key === 'moving', stopped: (r) => ['stopped', 'idle'].includes(r.state.key), lost: (r) => ['lost', 'wait'].includes(r.state.key) };
const FILTER_EMPTY = { moving: 'Nothing is moving right now.', stopped: 'Nothing is stopped or idling right now.', lost: 'Every GPS is reporting.' };

export function LiveMap() {
  const app = useApp();
  const { org, theme, route } = app;
  useTick(15000);
  const assets = useLoad(() => loadAssets(org.id), [org.id]);
  const devices = useLoad(() => loadDevices(org.id), [org.id], { every: 15000 });
  const [sel, setSel] = useState(route.params[0] || null);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [sat, setSat] = useState(false);
  const [trail, setTrail] = useState(null);
  const [trailBusy, setTrailBusy] = useState(false);

  const by = byAsset(devices.data);
  const all = [
    ...(assets.data || []).filter((a) => a.status !== 'sold' && (by.get(a.id) || []).length)
      .map((a) => ({ id: a.id, label: a.unit_no, asset: a, devs: by.get(a.id), state: vstate(by.get(a.id)) })),
    ...(by.get('') || []).map((d) => ({ id: 'dev:' + d.id, label: d.name || d.external_id, device: d, devs: [d], state: vstate([d]) })),
  ];
  const noGps = (assets.data || []).filter((a) => a.status !== 'sold' && !(by.get(a.id) || []).length);
  const needle = q.trim().toLowerCase();
  const rows = all.filter(FILTERS[filter]).filter((r) => !needle || [r.label, r.asset && vehicleLine(r.asset), r.asset?.plate, r.state.dev?.last_address]
    .filter(Boolean).join(' ').toLowerCase().includes(needle));
  const cur = all.find((r) => r.id === sel);
  const live = all.filter((r) => ['moving', 'idle', 'stopped'].includes(r.state.key)).length;
  const count = (k) => (devices.data && assets.data ? all.filter(FILTERS[k]).length : null);
  const ready = devices.data !== undefined && assets.data !== undefined;
  const failed = devices.failed || assets.failed;

  useEffect(() => { setTrail(null); }, [sel]);
  useEffect(() => {                                   // the picked vehicle's card, with its buttons, comes into view
    if (sel) setTimeout(() => document.querySelector('.live-sel')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 80);
  }, [sel]);
  const newest = all.map((r) => r.state.dev?.last_at).filter(Boolean).sort().pop();
  const showTrail = async () => {
    if (trail) { setTrail(null); return; }
    setTrailBusy(true);
    try {
      const pts = cur.asset ? await loadTrail(cur.asset.id, startOfDay(org.timezone)) : [];
      setTrail({ id: sel, points: pts });
    } catch (x) { app.toast(x.message, 'bad'); }
    setTrailBusy(false);
  };
  const d = cur?.state.dev;
  const sub = ready ? html`${live} of ${all.length} reporting${newest ? ` · newest position ${ago(newest)}` : ''}${devices.error
      ? html` · <${Stale} at=${devices.at} retry=${devices.retry} />` : null}`
    : failed ? 'Not loaded' : 'Loading…';

  return html`<${Top} title="Live map" sub=${sub}>
      <${Seg} label="Map style" value=${sat ? 'sat' : 'map'} onChange=${(v) => setSat(v === 'sat')} options=${[{ v: 'map', label: 'Map' }, { v: 'sat', label: 'Satellite' }]} /><//>
    <div class="livemap">
      <aside class="live-list" aria-label="Vehicles">
        <div class="ll-h">
          <div class="search"><${Icon} n="search" /><input aria-label="Search vehicles or places" placeholder="Search vehicles or places" value=${q} onInput=${(e) => setQ(e.target.value)} /></div>
          <${Seg} label="Show" value=${filter} onChange=${setFilter} options=${[{ v: 'all', label: 'All', n: count('all') }, { v: 'moving', label: 'Moving', n: count('moving') },
            { v: 'stopped', label: 'Stopped', n: count('stopped') }, { v: 'lost', label: 'No signal', n: count('lost') }]} />
        </div>
        ${cur ? html`<div class="card picked live-sel">
          <div class="card-h"><div class="li-ic"><${Icon} n=${cur.asset ? vehicleIcon(cur.asset.kind) : 'signal'} /></div>
            <div class="grow"><h3>${cur.label}</h3><div class="dim xs">${cur.asset ? vehicleLine(cur.asset) || 'Vehicle' : 'GPS unit — not linked to a vehicle'}</div></div>
            <${Btn} kind="ghost" size="sm" cls="icon" icon="x" aria-label=${`Close ${cur.label}`} onClick=${() => setSel(null)} /></div>
          <div class="card-b col">
            <div><${Chip} tone=${cur.state.tone}>${cur.state.label}<//></div>
            ${d ? html`<dl class="kv">
              <dt>Where</dt><dd>${d.last_address || (d.last_lat != null ? `${d.last_lat.toFixed(5)}, ${d.last_lon.toFixed(5)}` : '—')}</dd>
              <dt>Speed</dt><dd>${d.last_speed_mph != null ? `${Math.round(d.last_speed_mph)} mph` : '—'}</dd>
              <dt>Engine</dt><dd>${d.last_ignition === true ? 'On' : d.last_ignition === false ? 'Off' : '—'}</dd>
              <dt>Updated</dt><dd>${d.last_at ? `${fmtTime(d.last_at, org.timezone)} · ${ago(d.last_at)}` : '—'}</dd>
              <dt>From</dt><dd>${cur.devs.map((x) => sourceName(x.source)).join(' · ')}</dd></dl>` : null}
            <div class="row wrap">
              ${cur.asset ? html`<${Btn} size="sm" icon="activity" busy=${trailBusy} onClick=${showTrail}>${trail ? 'Hide trail' : 'Today\'s trail'}<//>` : null}
              ${cur.asset ? html`<${Btn} size="sm" onClick=${() => go('fleet/' + cur.asset.id)}>Vehicle details<//>`
                : can(org.role, 'fleet') ? html`<${Btn} size="sm" icon="link" onClick=${() => go('fleet')}>Link to a vehicle<//>` : null}
              ${d?.last_lat != null ? html`<a class="btn sm" target="_blank" rel="noopener" href=${`https://www.google.com/maps?q=${d.last_lat},${d.last_lon}`}><${Icon} n="external" />Google Maps</a>` : null}
            </div>
            ${trail ? html`<div class="dim xs" role="status">${trail.points.length ? `${trail.points.length} points since midnight` : 'No positions yet today.'}</div>` : null}
          </div></div>` : null}
        <div class="ll-b">
          ${failed ? html`<${LoadError} what="the vehicles" error=${devices.error || assets.error} retry=${() => { assets.retry(); devices.retry(); }} />` : null}
          ${rows.map((r) => html`<button type="button" key=${r.id} class=${'veh' + (sel === r.id ? ' on' : '')} aria-pressed=${sel === r.id ? 'true' : 'false'}
              onClick=${() => setSel(r.id === sel ? null : r.id)}>
            <span class=${'dot ' + r.state.tone + (r.state.key === 'moving' && r.state.tone === 'green' ? ' live' : '')}></span>
            <div class="grow"><div class="v-n">${r.label}${r.device ? html` <span class="chip out ml-4">not linked</span>` : null}</div>
              <div class="v-s tr">${r.state.label}${r.state.dev ? ` · ${ago(r.state.dev.last_at)}` : ''}</div>
              ${r.state.dev?.last_address ? html`<div class="v-s tr">${r.state.dev.last_address}</div>` : null}</div></button>`)}
          ${ready && !all.length ? html`<${Empty} cls="sm" icon="signal" title="Nothing is reporting yet" text="Vehicles show up here once their GPS sends a position." />` : null}
          ${ready && !rows.length && all.length ? html`<${Empty} cls="sm" icon="search" title="Nothing matches"
              text=${needle ? `No vehicle or place has “${q.trim()}” in it.` : FILTER_EMPTY[filter] || ''}>
              <${Btn} size="sm" onClick=${() => { setQ(''); setFilter('all'); }}>Show all<//><//>` : null}
          ${noGps.length && hasModule(org, 'fleet') ? html`<a class="li click" href="#/fleet"><div class="li-ic"><${Icon} n="info" /></div>
            <div class="grow"><div class="li-t">${noGps.length === 1 ? '1 vehicle has' : `${plural(noGps.length, 'vehicle')} have`} no GPS</div>
              <div class="li-s">${noGps.slice(0, 4).map((a) => a.unit_no).join(', ')}${noGps.length > 4 ? '…' : ''}</div></div><${Icon} n="chevR" /></a>` : null}
        </div>
      </aside>
      <div class="map-wrap">
        <div class="map-in"><${MapView} rows=${all} sel=${sel} onSel=${setSel} sat=${sat} theme=${theme} trail=${trail} /></div>
        ${ready && !all.some((r) => r.state.dev?.last_lat != null) ? html`<div class="map-empty"><div class="card">
          <${Empty} icon="map" title="Your trucks will show up here" text="Connect the GPS you already use, let drivers share their phone's location, or send positions from your own system.">
            ${can(org.role, 'integrations') ? html`<${Btn} kind="primary" icon="plug" onClick=${() => go('integrations')}>Connect GPS<//>` : null}
            ${hasModule(org, 'driver') ? html`<${Btn} icon="phone" onClick=${() => go('driver')}>Driver mode<//>` : null}<//></div></div>` : null}
      </div>
    </div>`;
}
