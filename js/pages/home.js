// Home: hello, the setup checklist until it's done, four numbers that open what they count, the map at a
// glance, every vehicle's state right now, and the latest activity. One main button at a time: the setup button while
// setup isn't done, otherwise Add vehicle.
import { html, useState, useEffect, useRef, Icon, Btn, Chip, Empty, Ring, Skel, Top, LoadError, Stale, useLoad, useTick } from '../ui.js';
import { useApp, go } from '../ctx.js';
import { loadAssets, loadDevices, loadMembers, loadIntegrations, loadAudit, byAsset } from '../data.js';
import { greeting, firstName, fmtDate, vstate, can, hasModule, plural, ensureLeaflet, isPhone } from '../util.js';
import { makeMap, addPin, fit } from '../maps.js';
import { vehicleIcon, vehicleLine } from '../parts/asset.js';
import { ActivityRow } from './activity.js';

const SETUP = [['company', 'Company profile'], ['fleet', 'Trucks'], ['team', 'People'], ['gps', 'GPS']];

// a small map. On a phone it's a picture (a swipe scrolls the page); tapping it opens the Live map.
export function MiniMap({ rows, theme, onPick }) {
  const el = useRef(null);
  const m = useRef(null);
  const fitted = useRef(false);
  const still = isPhone();
  const [L, setL] = useState(window.L || null);                    // the map library loads only when a map is shown
  useEffect(() => { if (!L) ensureLeaflet().then(setL).catch(() => {}); }, []);
  useEffect(() => {
    if (!L || !el.current) return undefined;
    m.current = makeMap(el.current, { theme, zoomControl: false, still });
    if (still) m.current.map.on('click', () => go('map'));
    fitted.current = false;
    return () => { m.current?.destroy(); m.current = null; };
  }, [theme, L]);
  useEffect(() => {
    if (!m.current) return;
    const { pins, map } = m.current;
    pins.clearLayers();
    const pts = [];
    for (const r of rows) {
      const d = r.state.dev;
      if (!d || d.last_lat == null) continue;
      pts.push([d.last_lat, d.last_lon]);
      addPin(pins, [d.last_lat, d.last_lon], { label: r.label, state: r.state.key, heading: d.last_heading, old: r.state.key === 'moving' && r.state.tone === 'amber',
        name: `${r.label}: ${r.state.label}`, onPick: onPick ? () => onPick(r) : null });
    }
    if (pts.length && !fitted.current) { fit(map, pts, 13); fitted.current = true; }
  }, [rows, theme, L]);
  return html`<div class=${'minimap' + (still ? ' still' : '')} ref=${el}></div>`;
}

export function Home() {
  const app = useApp();
  const { org, me, theme } = app;
  useTick(30000);
  const assets = useLoad(() => loadAssets(org.id), [org.id]);
  const devices = useLoad(() => loadDevices(org.id), [org.id], { every: 20000 });
  const members = useLoad(() => loadMembers(org.id), [org.id]);
  const integ = useLoad(() => loadIntegrations(org.id), [org.id], { every: 60000 });
  const audit = useLoad(() => loadAudit(org.id, 8), [org.id], { every: 30000 });

  const ob = org.onboarding || {};
  const setupDone = SETUP.filter(([k]) => ob[k] === 'done').length;
  const showSetup = can(org.role, 'settings') && !ob.done;
  const a = assets.data || [];
  const by = byAsset(devices.data);
  const rows = a.filter((x) => x.status !== 'sold').map((x) => ({ id: x.id, label: x.unit_no, asset: x, state: vstate(by.get(x.id)) }));
  const withGps = rows.filter((r) => r.state.key !== 'none');
  const live = rows.filter((r) => ['moving', 'idle', 'stopped'].includes(r.state.key));
  const moving = rows.filter((r) => r.state.key === 'moving' && r.state.tone === 'green').length;
  const people = (members.data || []).filter((x) => x.status === 'active').length;
  const connected = (integ.data || []).filter((i) => i.status === 'connected').length;
  const broken = (integ.data || []).filter((i) => i.status === 'error').length;
  const seatsLeft = Math.max(0, (org.license?.seats || 0) - (org.seats_used || 0));
  const invited = Math.max(0, (org.seats_used || 0) - people);       // open invitations hold seats too
  const canAdd = can(org.role, 'fleet') && hasModule(org, 'fleet');
  const noVehicles = !!assets.data && !a.length;
  const failed = [assets.failed && 'your vehicles', devices.failed && 'the GPS positions', members.failed && 'your team', integ.failed && 'your connections']
    .filter(Boolean);
  const retryAll = () => { [assets, devices, members, integ, audit].forEach((x) => x.error && x.retry()); };
  const n = (load, v) => (load.data !== undefined ? v : '–');

  return html`<${Top} title=${`${greeting(org.timezone)}, ${firstName(me?.user?.name) || 'there'}`}
      sub=${`${fmtDate(Date.now(), org.timezone, { weekday: 'long', month: 'long', day: 'numeric' })} · ${org.name}`}>
      ${canAdd && !noVehicles ? html`<${Btn} kind=${showSetup ? '' : 'primary'} icon="plus" onClick=${() => go('fleet/new')}>Add vehicle<//>` : null}
      ${can(org.role, 'team') ? html`<${Btn} icon="users" onClick=${() => go('team/invite')}>Invite<//>` : null}<//>
    <div class="page">
      ${failed.length ? html`<${LoadError} cls="card" what=${failed.join(', ').replace(/, ([^,]*)$/, ' and $1')} error=${(assets.error || devices.error || members.error || integ.error)} retry=${retryAll} />` : null}

      ${showSetup ? html`<div class="card setup">
        <${Ring} value=${setupDone} max=${4} />
        <div><h3>Finish setting up ${org.name}</h3>
          <div class="setup-steps">${SETUP.map(([k, l]) => html`<span key=${k} class=${ob[k] === 'done' ? 'done' : ''}>
            <${Icon} n=${ob[k] === 'done' ? 'check' : 'clock'} />${l}${ob[k] === 'skipped' ? ' (skipped)' : ''}</span>`)}</div></div>
        <${Btn} kind="primary" onClick=${() => go('welcome')}>${setupDone ? 'Continue setup' : 'Start setup'}<//></div>` : null}

      ${broken ? html`<div class="err"><${Icon} n="alert" /><div><b>${plural(broken, 'GPS connection')} need${broken === 1 ? 's' : ''} attention.</b>
        <a class="ml-8" href="#/integrations">Open Connections</a></div></div>` : null}

      <div class="tiles">
        ${hasModule(org, 'fleet') ? html`<a class="tile" href="#/fleet"><div class="t-l"><${Icon} n="truck" />Vehicles</div>
          <div class="t-v">${n(assets, a.length)}</div><div class="t-s">${assets.data ? `${a.filter((x) => x.status === 'active').length} active${a.some((x) => x.status === 'shop') ? ` · ${a.filter((x) => x.status === 'shop').length} in the shop` : ''}` : ' '}</div>
          <${Icon} n="chevR" cls="t-go" /></a>` : null}
        ${hasModule(org, 'map') ? html`<a class="tile" href="#/map"><div class="t-l"><${Icon} n="signal" />Reporting now</div>
          <div class="t-v">${n(devices, live.length)}${devices.data && assets.data ? html`<small>/ ${withGps.length}</small>` : null}</div>
          <div class="t-s">${devices.data && assets.data ? (moving ? `${moving} moving` : withGps.length ? 'none moving' : 'no GPS yet') : ' '}</div>
          <${Icon} n="chevR" cls="t-go" /></a>` : null}
        <a class="tile" href="#/team"><div class="t-l"><${Icon} n="users" />Team</div>
          <div class="t-v">${n(members, people)}</div><div class="t-s">${members.data && invited ? `${invited} invited · ` : ''}${seatsLeft} of ${org.license?.seats} seats free</div>
          <${Icon} n="chevR" cls="t-go" /></a>
        <a class="tile" href="#/integrations"><div class="t-l"><${Icon} n="plug" />Connections</div>
          <div class="t-v">${n(integ, connected)}</div><div class="t-s">${!integ.data ? ' ' : broken ? html`<span class="red">${broken} failing</span>` : connected ? 'all working' : 'connect your GPS'}</div>
          <${Icon} n="chevR" cls="t-go" /></a>
      </div>

      <div class="home-grid">
        <div class="col gap-20">
          ${hasModule(org, 'map') ? html`<div class="card"><div class="card-h"><h3 class="grow">Live map</h3>
              ${devices.error && devices.data ? html`<${Stale} at=${devices.at} retry=${devices.retry} />`
                : live.length ? html`<${Chip} tone="green"><span class="dot green live"></span>${live.length} live<//>` : null}
              <${Btn} size="sm" kind="ghost" onClick=${() => go('map')}>Open<${Icon} n="chevR" /><//></div>
            <div class="mt-12">${devices.data === undefined || assets.data === undefined
                ? (devices.failed || assets.failed ? html`<${LoadError} what="the map" error=${devices.error || assets.error} retry=${retryAll} />` : html`<${Skel} h=${200} />`)
              : withGps.length ? html`<${MiniMap} rows=${rows} theme=${theme} onPick=${(r) => go('map/' + r.id)} />`
              : html`<${Empty} cls="sm" icon="map" title="Your trucks will show up here"
                  text="Connect the GPS you already use, or let drivers share their phone's location.">
                  ${can(org.role, 'integrations') ? html`<${Btn} icon="plug" onClick=${() => go('integrations')}>Connect GPS<//>` : null}<//>`}</div></div>` : null}

          ${hasModule(org, 'fleet') ? html`<div class="card"><div class="card-h"><h3 class="grow">Vehicles now</h3>
              <${Btn} size="sm" kind="ghost" onClick=${() => go('fleet')}>All vehicles<${Icon} n="chevR" /><//></div>
            ${assets.failed ? html`<div class="card-b"><${LoadError} what="your vehicles" error=${assets.error} retry=${assets.retry} /></div>`
              : !assets.data ? html`<div class="card-b"><${Skel} h=${120} /></div>`
              : rows.length ? html`<div class="list mt-8">${rows.slice(0, 8).map((r) => html`<a class="li click" key=${r.id} href=${'#/fleet/' + r.id}>
                  <div class="li-ic"><${Icon} n=${vehicleIcon(r.asset.kind)} /></div>
                  <div class="grow"><div class="li-t">${r.asset.unit_no} <span class="dim reg">${vehicleLine(r.asset)}</span></div>
                    <div class="li-s tr">${r.state.sub || (r.state.key === 'none' ? 'No GPS linked yet' : '')}</div></div>
                  <${Chip} tone=${r.state.tone}>${r.state.label}<//></a>`)}</div>`
              : html`<${Empty} cls="sm" icon="truck" title="No vehicles yet" text="Add your trucks — a VIN fills in the rest.">
                  ${canAdd ? html`<${Btn} kind=${showSetup ? '' : 'primary'} icon="plus" onClick=${() => go('fleet/new')}>Add vehicle<//>` : null}<//>`}</div>` : null}
        </div>

        <div class="card feed"><div class="card-h"><h3 class="grow">Activity</h3><${Btn} size="sm" kind="ghost" onClick=${() => go('activity')}>All<${Icon} n="chevR" /><//></div>
          ${audit.failed ? html`<div class="card-b"><${LoadError} what="the activity" error=${audit.error} retry=${audit.retry} /></div>`
            : audit.data ? (audit.data.length ? html`<div class="list mt-8">${audit.data.map((x) => html`<${ActivityRow} key=${x.id} x=${x} tz=${org.timezone} />`)}</div>`
            : html`<${Empty} cls="sm" icon="activity" title="Nothing yet" text="What your team does shows up here." />`) : html`<div class="card-b"><${Skel} h=${200} /></div>`}
        </div>
      </div>
    </div>`;
}
