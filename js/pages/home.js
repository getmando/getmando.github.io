// Home: hello, the setup checklist until it's done, four numbers that open what they count, the map at a
// glance, every vehicle's state right now, and the latest activity.
import { html, useState, useEffect, useRef, Icon, Btn, Chip, Empty, Ring, Avatar, Skel, Top, useLoad, useTick } from '../ui.js';
import { useApp, go } from '../ctx.js';
import { loadAssets, loadDevices, loadMembers, loadIntegrations, loadAudit, byAsset } from '../data.js';
import { greeting, firstName, fmtDate, ago, vstate, can, hasModule, plural } from '../util.js';
import { makeMap, pinIcon, fit } from '../maps.js';
import { vehicleIcon, vehicleLine } from '../parts/asset.js';
import { ActivityRow } from './activity.js';

const SETUP = [['company', 'Company profile'], ['fleet', 'Trucks'], ['team', 'People'], ['gps', 'GPS']];

export function MiniMap({ rows, theme, onPick }) {
  const el = useRef(null);
  const m = useRef(null);
  const fitted = useRef(false);
  useEffect(() => {
    if (!window.L || !el.current) return undefined;
    m.current = makeMap(el.current, { theme, zoomControl: false });
    return () => { m.current?.destroy(); m.current = null; };
  }, [theme]);
  useEffect(() => {
    if (!m.current) return;
    const { pins, map } = m.current;
    pins.clearLayers();
    const pts = [];
    for (const r of rows) {
      const d = r.state.dev;
      if (!d || d.last_lat == null) continue;
      pts.push([d.last_lat, d.last_lon]);
      window.L.marker([d.last_lat, d.last_lon], { icon: pinIcon(r.label, r.state.key, { heading: d.last_heading }) })
        .on('click', () => onPick && onPick(r)).addTo(pins);
    }
    if (pts.length && !fitted.current) { fit(map, pts, 13); fitted.current = true; }
  }, [rows]);
  return html`<div class="minimap" ref=${el}></div>`;
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
  const moving = rows.filter((r) => r.state.key === 'moving').length;
  const people = (members.data || []).filter((x) => x.status === 'active').length;
  const connected = (integ.data || []).filter((i) => i.status === 'connected').length;
  const broken = (integ.data || []).filter((i) => i.status === 'error').length;
  const seatsLeft = Math.max(0, (org.license?.seats || 0) - (org.seats_used || 0));

  return html`<${Top} title=${`${greeting(org.timezone)}, ${firstName(me?.user?.name) || 'there'}`}
      sub=${`${fmtDate(Date.now(), org.timezone, { weekday: 'long', month: 'long', day: 'numeric' })} · ${org.name}`}>
      ${can(org.role, 'fleet') && hasModule(org, 'fleet') ? html`<${Btn} icon="plus" onClick=${() => go('fleet/new')}>Add vehicle<//>` : null}
      ${can(org.role, 'team') ? html`<${Btn} icon="users" onClick=${() => go('team/invite')}>Invite<//>` : null}<//>
    <div class="page">
      ${showSetup ? html`<div class="card setup">
        <${Ring} value=${setupDone} max=${4} />
        <div><h3>Finish setting up ${org.name}</h3>
          <div class="setup-steps">${SETUP.map(([k, l]) => html`<span key=${k} class=${ob[k] === 'done' ? 'done' : ''}>
            <${Icon} n=${ob[k] === 'done' ? 'check' : 'clock'} />${l}${ob[k] === 'skipped' ? ' (skipped)' : ''}</span>`)}</div></div>
        <${Btn} kind="primary" onClick=${() => go('welcome')}>${setupDone ? 'Continue setup' : 'Start setup'}<//></div>` : null}

      ${broken ? html`<div class="err"><${Icon} n="alert" /><div><b>${plural(broken, 'GPS connection')} need${broken === 1 ? 's' : ''} attention.</b>
        <a href="#/integrations" style="margin-left:6px">Open Integrations</a></div></div>` : null}

      <div class="tiles">
        ${hasModule(org, 'fleet') ? html`<a class="tile" href="#/fleet"><div class="t-l"><${Icon} n="truck" />Vehicles</div>
          <div class="t-v">${assets.data ? a.length : '–'}</div><div class="t-s">${a.filter((x) => x.status === 'active').length} active${a.some((x) => x.status === 'shop') ? ` · ${a.filter((x) => x.status === 'shop').length} in the shop` : ''}</div>
          <${Icon} n="chevR" cls="t-go" /></a>` : null}
        ${hasModule(org, 'map') ? html`<a class="tile" href="#/map"><div class="t-l"><${Icon} n="signal" />Reporting now</div>
          <div class="t-v">${devices.data ? live.length : '–'}<small>/ ${withGps.length}</small></div><div class="t-s">${moving ? `${moving} moving` : withGps.length ? 'none moving' : 'no GPS yet'}</div>
          <${Icon} n="chevR" cls="t-go" /></a>` : null}
        <a class="tile" href="#/team"><div class="t-l"><${Icon} n="users" />Team</div>
          <div class="t-v">${members.data ? people : '–'}</div><div class="t-s">${seatsLeft} seat${seatsLeft === 1 ? '' : 's'} left of ${org.license?.seats}</div>
          <${Icon} n="chevR" cls="t-go" /></a>
        <a class="tile" href="#/integrations"><div class="t-l"><${Icon} n="plug" />Connections</div>
          <div class="t-v">${integ.data ? connected : '–'}</div><div class="t-s">${broken ? html`<span class="red">${broken} failing</span>` : connected ? 'all working' : 'connect your GPS'}</div>
          <${Icon} n="chevR" cls="t-go" /></a>
      </div>

      <div class="home-grid">
        <div class="col" style="gap:18px">
          ${hasModule(org, 'map') ? html`<div class="card"><div class="card-h"><h3 class="grow">Live map</h3>
              ${live.length ? html`<${Chip} tone="green"><span class="dot green live"></span>${live.length} live<//>` : null}
              <${Btn} size="sm" kind="ghost" onClick=${() => go('map')}>Open<${Icon} n="chevR" /><//></div>
            <div style="margin-top:12px">${withGps.length ? html`<${MiniMap} rows=${rows} theme=${theme} onPick=${(r) => go('map/' + r.id)} />`
              : html`<${Empty} cls="sm" icon="map" title="Your trucks will show up here"
                  text="Connect the GPS you already use, or let drivers share their phone's location.">
                  <${Btn} kind="primary" icon="plug" onClick=${() => go('integrations')}>Connect GPS<//><//>`}</div></div>` : null}

          ${hasModule(org, 'fleet') ? html`<div class="card"><div class="card-h"><h3 class="grow">Vehicles now</h3>
              <${Btn} size="sm" kind="ghost" onClick=${() => go('fleet')}>All vehicles<${Icon} n="chevR" /><//></div>
            ${assets.loading && !assets.data ? html`<div class="card-b"><${Skel} h=${120} /></div>`
              : rows.length ? html`<div class="list" style="margin-top:8px">${rows.slice(0, 8).map((r) => html`<a class="li click" key=${r.id} href=${'#/fleet/' + r.id} style="color:inherit;text-decoration:none">
                  <div class="li-ic"><${Icon} n=${vehicleIcon(r.asset.kind)} /></div>
                  <div class="grow"><div class="li-t">${r.asset.unit_no} <span class="dim" style="font-weight:400">${vehicleLine(r.asset)}</span></div>
                    <div class="li-s tr">${r.state.sub || (r.state.key === 'none' ? 'No GPS tied to it yet' : '')}</div></div>
                  <${Chip} tone=${r.state.tone}>${r.state.label}<//></a>`)}</div>`
              : html`<${Empty} cls="sm" icon="truck" title="No vehicles yet" text="Add your trucks — a VIN fills in the rest.">
                  ${can(org.role, 'fleet') ? html`<${Btn} kind="primary" icon="plus" onClick=${() => go('fleet/new')}>Add vehicle<//>` : null}<//>`}</div>` : null}
        </div>

        <div class="card feed"><div class="card-h"><h3 class="grow">Activity</h3><${Btn} size="sm" kind="ghost" onClick=${() => go('activity')}>All<${Icon} n="chevR" /><//></div>
          ${audit.data ? (audit.data.length ? html`<div class="list" style="margin-top:6px">${audit.data.map((x) => html`<${ActivityRow} key=${x.id} x=${x} tz=${org.timezone} />`)}</div>`
            : html`<${Empty} cls="sm" icon="activity" text="What your team does shows up here." />`) : html`<div class="card-b"><${Skel} h=${200} /></div>`}
          <div class="card-f"><${Avatar} name=${me?.user?.name} cls="sm" /><span class="dim xs grow">Signed in as ${me?.user?.email}</span></div>
        </div>
      </div>
    </div>`;
}
