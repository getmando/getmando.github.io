// Fleet: every truck, trailer, pickup and machine — what it is, its plate and VIN, its GPS and status.
// #/fleet/new opens the add form; #/fleet/<id> opens that vehicle (details, GPS units linked to it, last position).
import { html, useState, useEffect, useRef, Icon, Btn, Chip, Empty, Seg, Drawer, Skel, Top, LoadError, Stale, useLoad, useTick } from '../ui.js';
import { useApp, go } from '../ctx.js';
import { rpc } from '../api.js';
import { loadAssets, loadDevices, byAsset } from '../data.js';
import { vstate, ago, can, ASSET_STATUS, ASSET_KINDS, sourceName, fmtDate, plural, isPhone } from '../util.js';
import { AssetForm, vehicleIcon, vehicleLine } from '../parts/asset.js';
import { MiniMap } from './home.js';

function GpsCell({ state }) {
  return html`<div class="gps"><span class=${'dot ' + state.tone + (state.key === 'moving' && state.tone === 'green' ? ' live' : '')}></span>
    <div><div>${state.label}</div>${state.dev ? html`<div class="dim xs">${ago(state.dev.last_at)}</div>` : null}</div></div>`;
}

function VehicleDrawer({ org, asset, devices, onClose, onChanged }) {
  const app = useApp();
  const [editing, setEditing] = useState(!asset);
  const [tying, setTying] = useState(null);           // the GPS unit being linked or unlinked
  const was = useRef(editing);
  useEffect(() => {                                   // Edit pressed: the keyboard goes to the first field (not on phones)
    if (editing && !was.current && !isPhone()) setTimeout(() => document.getElementById('un')?.focus(), 30);
    was.current = editing;
  }, [editing]);
  const mine = devices.filter((d) => d.asset_id === asset?.id);
  const loose = devices.filter((d) => !d.asset_id);
  const outside = devices.some((d) => d.source !== 'phone' && d.source !== 'api');   // a GPS company is connected
  const state = vstate(mine);
  const manage = can(org.role, 'fleet');
  const tie = async (devId, assetId) => {
    setTying(devId);
    try {
      await rpc('device_link', { p_device: devId, p_asset: assetId });
      onChanged();
      app.toast(assetId ? `GPS linked to ${asset.unit_no}` : `GPS unlinked from ${asset.unit_no}`);
    } catch (x) { app.toast(x.message, 'bad'); }
    setTying(null);
  };
  const remove = async () => {
    const ok = await app.confirm({ title: `Delete ${asset.unit_no}?`, text: 'Its GPS units stay (not linked to anything) and its past positions are kept. This can\'t be undone.',
      ok: 'Delete', danger: true, action: () => rpc('asset_remove', { p_asset: asset.id }) });
    if (ok) { app.toast(`${asset.unit_no} deleted`); onChanged(); onClose(); }
  };
  if (!asset || editing) {
    return html`<${Drawer} title=${asset ? `Edit ${asset.unit_no}` : 'Add a vehicle'} sub=${asset ? vehicleLine(asset) : 'A VIN fills in year, make and model.'} icon="truck" onClose=${onClose} wide>
      <${AssetForm} org=${org} asset=${asset} onCancel=${asset ? () => setEditing(false) : onClose}
        footerLeft=${asset ? html`<${Btn} kind="danger" icon="trash" onClick=${remove}>Delete<//>` : null}
        onSaved=${(saved, isNew) => { onChanged(); app.toast(isNew ? `${saved.unit_no} added` : `${saved.unit_no} saved`); if (isNew) go('fleet/' + saved.id); else setEditing(false); }} /><//>`;
  }
  const [label, tone] = ASSET_STATUS[asset.status] || [asset.status, ''];
  return html`<${Drawer} title=${asset.unit_no} sub=${[ASSET_KINDS[asset.kind], vehicleLine(asset)].filter(Boolean).join(' · ')} onClose=${onClose} wide
      head=${html`<div class="li-ic"><${Icon} n=${vehicleIcon(asset.kind)} /></div>`}
      footer=${manage ? html`<span class="grow"></span><${Btn} kind="primary" icon="edit" onClick=${() => setEditing(true)}>Edit<//>` : null}>
    <div class="row wrap"><${Chip} tone=${tone}>${label}<//><${Chip} tone=${state.tone}>${state.label}<//></div>
    ${state.dev?.last_lat != null ? html`<div class="card clip"><${MiniMap} rows=${[{ id: asset.id, label: asset.unit_no, asset, state }]} theme=${app.theme} onPick=${() => go('map/' + asset.id)} />
      <div class="card-f"><span class="dim sm grow">${state.dev.last_address || 'Last position'} · ${ago(state.dev.last_at)}</span>
        <${Btn} size="sm" onClick=${() => go('map/' + asset.id)}>Live map<//></div></div>` : null}
    <div class="section"><h4>Details</h4><dl class="kv">
      <dt>VIN</dt><dd class="mono">${asset.vin || '—'}</dd>
      <dt>Plate</dt><dd class="mono">${asset.plate ? `${asset.plate}${asset.plate_state ? ' · ' + asset.plate_state : ''}` : '—'}</dd>
      ${asset.body ? html`<dt>Body</dt><dd>${asset.body}</dd>` : null}
      ${asset.capacity ? html`<dt>Capacity</dt><dd>${asset.capacity} ${({ yd: 'cubic yards', ton: 'tons', gal: 'gallons', lb: 'pounds' })[asset.capacity_unit] || ''}</dd>` : null}
      ${asset.color ? html`<dt>Color</dt><dd>${asset.color}</dd>` : null}
      ${asset.odometer ? html`<dt>Odometer</dt><dd>${Number(asset.odometer).toLocaleString('en-US')} mi${asset.odometer_at ? ` · ${fmtDate(asset.odometer_at, org.timezone)}` : ''}</dd>` : null}
      ${asset.notes ? html`<dt>Notes</dt><dd>${asset.notes}</dd>` : null}
      <dt>Added</dt><dd>${fmtDate(asset.created_at, org.timezone)}</dd></dl></div>
    <div class="section"><h4>GPS</h4>
      ${mine.length ? html`<div class="card"><div class="list">${mine.map((d) => html`<div class="li" key=${d.id}><div class="li-ic"><${Icon} n=${d.source === 'phone' ? 'phone' : 'signal'} /></div>
          <div class="grow"><div class="li-t">${d.name || d.external_id}</div><div class="li-s">${sourceName(d.source)} · ${d.last_at ? 'last seen ' + ago(d.last_at) : 'no position yet'}${d.link_source ? ` · linked ${d.link_source === 'manual' ? 'by hand' : d.link_source === 'driver' ? 'by the driver' : d.link_source === 'vin' ? 'by VIN' : 'by ' + d.link_source}` : ''}</div></div>
          ${manage && d.source !== 'phone' ? html`<${Btn} size="sm" kind="ghost" busy=${tying === d.id} disabled=${!!tying} onClick=${() => tie(d.id, null)}>Unlink<//>` : null}</div>`)}</div></div>`
        : html`<p class="dim sm">No GPS is linked to ${asset.unit_no}. ${manage && loose.length
            ? 'A connected GPS links itself by VIN, plate or name — or pick one of its units below.'
            : outside ? `Your GPS hasn't matched any of its units to ${asset.unit_no}. It links by VIN, plate or name — check that one of them is the same in your GPS.`
            : html`When you connect your GPS (${manage ? html`<a href="#/integrations">Connections</a>` : 'Connections'}), it finds this truck by VIN, plate or name.`}</p>`}
      ${manage && loose.length ? html`<div class="row"><label class="sr" for="link-gps">Link a GPS unit to ${asset.unit_no}</label>
          <select id="link-gps" class="sel narrow" disabled=${!!tying} onChange=${(e) => e.target.value && tie(e.target.value, asset.id)}>
          <option value="">Link a GPS unit to ${asset.unit_no}…</option>${loose.map((d) => html`<option value=${d.id}>${d.name || d.external_id} · ${sourceName(d.source)}</option>`)}</select>
          ${tying && !mine.some((d) => d.id === tying) ? html`<span class="spin dark" role="status" aria-label="Linking"></span>` : null}</div>` : null}
    </div>
  <//>`;
}

// a link to a vehicle that isn't in the fleet anymore (deleted, or from another company)
function GoneDrawer({ onClose }) {
  return html`<${Drawer} title="Vehicle not found" icon="truck" onClose=${onClose}>
    <${Empty} icon="truck" title="This vehicle isn't in your fleet anymore" text="It may have been deleted. Your other vehicles are in the list.">
      <${Btn} onClick=${onClose}>Back to the fleet<//><//><//>`;
}

export function Fleet() {
  const app = useApp();
  const { org, route } = app;
  useTick(30000);
  const assets = useLoad(() => loadAssets(org.id), [org.id]);
  const devices = useLoad(() => loadDevices(org.id), [org.id], { every: 30000 });
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const open = route.params[0] || null;
  const list = assets.data || [];
  const by = byAsset(devices.data);
  const needle = q.trim().toLowerCase();
  const shown = list.filter((a) => status === 'all' || a.status === status)
    .filter((a) => !needle || [a.unit_no, vehicleLine(a), a.plate, a.vin, a.body, a.notes].filter(Boolean).join(' ').toLowerCase().includes(needle));
  const cnt = (s) => list.filter((a) => s === 'all' || a.status === s).length;
  const current = open && open !== 'new' ? list.find((a) => a.id === open) : null;
  const gone = open && open !== 'new' && assets.data && !current;
  const refresh = () => { assets.reload(); devices.reload(); };
  const withGps = list.filter((a) => (by.get(a.id) || []).length).length;
  const add = can(org.role, 'fleet');
  const empty = assets.data && !list.length;

  return html`<${Top} title="Fleet" sub=${assets.data ? `${plural(list.length, 'vehicle')} · ${withGps} with GPS` : assets.failed ? 'Not loaded' : 'Loading…'}>
      ${add && !empty ? html`<${Btn} kind="primary" icon="plus" onClick=${() => go('fleet/new')}>Add vehicle<//>` : null}<//>
    <div class="page">
      ${list.length ? html`<div class="toolbar">
        <div class="search"><${Icon} n="search" /><input aria-label="Search the fleet" placeholder="Unit, make, plate, VIN…" value=${q} onInput=${(e) => setQ(e.target.value)} /></div>
        <${Seg} label="Show" value=${status} onChange=${setStatus} options=${[{ v: 'all', label: 'All', n: cnt('all') }, ...Object.entries(ASSET_STATUS).filter(([k]) => cnt(k) || k === 'active')
          .map(([k, [l]]) => ({ v: k, label: l, n: cnt(k) }))]} />
        ${devices.error && devices.data ? html`<${Stale} at=${devices.at} retry=${devices.retry} />` : null}</div>` : null}
      <div class="card tablecard">
        ${assets.failed ? html`<${LoadError} what="your vehicles" error=${assets.error} retry=${assets.retry} />`
          : !assets.data ? html`<div class="card-b"><${Skel} h=${220} /></div>`
          : !list.length ? html`<${Empty} icon="truck" title="Add your first vehicle"
              text="Unit number and VIN are enough — year, make and model fill in from the VIN, and GPS finds the truck by it.">
              ${add ? html`<${Btn} kind="primary" icon="plus" onClick=${() => go('fleet/new')}>Add vehicle<//>` : null}<//>`
          : html`<table class="tbl"><thead><tr><th>Vehicle</th><th>Type</th><th>Plate</th><th>VIN</th><th>GPS</th><th>Status</th></tr></thead>
              <tbody>${shown.map((a) => { const [l, t] = ASSET_STATUS[a.status] || [a.status, '']; const st = vstate(by.get(a.id));
                return html`<tr class="click" key=${a.id} onClick=${(e) => { if (!e.target.closest('a')) go('fleet/' + a.id); }}>
                  <td><div class="unit"><span class="u-ic"><${Icon} n=${vehicleIcon(a.kind)} /></span><div><a class="u-n rowlink" href=${'#/fleet/' + a.id}>${a.unit_no}</a><div class="u-s">${vehicleLine(a) || '—'}</div></div></div></td>
                  <td>${a.body || ASSET_KINDS[a.kind]}</td><td class="mono">${a.plate || '—'}</td>
                  <td class="mono dim">${a.vin ? '…' + a.vin.slice(-6) : '—'}</td><td><${GpsCell} state=${st} /></td><td><${Chip} tone=${t}>${l}<//></td></tr>`; })}</tbody></table>
            <div class="cards">${shown.map((a) => { const [l, t] = ASSET_STATUS[a.status] || [a.status, '']; const st = vstate(by.get(a.id));
              return html`<a class="li click" key=${a.id} href=${'#/fleet/' + a.id}><span class="u-ic li-ic"><${Icon} n=${vehicleIcon(a.kind)} /></span>
                <div class="grow"><div class="li-t">${a.unit_no} <span class="dim reg">${vehicleLine(a)}</span></div>
                  <div class="li-s">${[a.plate, st.label].filter(Boolean).join(' · ')}</div></div><${Chip} tone=${t}>${l}<//></a>`; })}</div>
            ${!shown.length ? html`<${Empty} cls="sm" icon="search" title="Nothing matches" text=${needle ? `No vehicle has “${q.trim()}” in it.` : 'No vehicle has this status.'}>
                <${Btn} size="sm" onClick=${() => { setQ(''); setStatus('all'); }}>Show all vehicles<//><//>` : null}`}
      </div>
    </div>
    ${open === 'new' && add ? html`<${VehicleDrawer} key="new" org=${org} asset=${null} devices=${devices.data || []} onClose=${() => go('fleet')} onChanged=${refresh} />` : null}
    ${current ? html`<${VehicleDrawer} key=${current.id + current.updated_at} org=${org} asset=${current} devices=${devices.data || []} onClose=${() => go('fleet')} onChanged=${refresh} />` : null}
    ${gone ? html`<${GoneDrawer} onClose=${() => go('fleet')} />` : null}`;
}
