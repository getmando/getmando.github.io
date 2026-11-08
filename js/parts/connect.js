// Connecting a GPS provider: where to find the credentials, the fields, then "Connect and test" — saves (the
// secret goes to Vault, trimmed), asks gps-sync to read the provider right now, and shows what came back — right
// under the status, so it's on screen: each vehicle, whether it linked itself to one of yours, one click to add the rest.
// A provider's refusal is shown once, as its advice in plain words, with the technical answer behind "Details".
import { html, useState, useEffect, useRef, Icon, Btn, Field, Chip } from '../ui.js';
import { rpc, edge } from '../api.js';
import { loadAssets, loadDevices } from '../data.js';
import { ago, sourceName, vinClean } from '../util.js';

// a GPS company's data, made to fit the fleet's rules (p003 refuses what doesn't): a VIN only if it is one, a plate only
// if it looks like one, the name without < > and at most 40 characters — the vehicle is added either way
const fit = (v) => {
  const vin = vinClean(v.vin);
  const plate = String(v.plate || '').trim();
  return { unit_no: (String(v.name || v.external_id || '').replace(/[<>]/g, '').trim() || String(v.external_id)).slice(0, 40),
    vin: vin.length === 17 && !/[IOQ]/.test(vin) ? vin : '', plate: /^[A-Za-z0-9][A-Za-z0-9 -]{0,9}$/.test(plate) ? plate : '', kind: 'truck' };
};

export function ProviderLogo({ p, cls = '' }) {
  return html`<span class=${'plogo ' + cls} style=${`--c:${p.color}`}>${p.mono}</span>`;
}

// "Samsara HTTP 401 (GET /fleet/vehicles): <advice> — Samsara said: {…}" → the advice, and the rest for Details
export function friendly(text) {
  const s = String(text || '');
  const m = /^(.+?) HTTP (\d{3}) \(([^)]*)\): ([\s\S]*?)(?: — \1 said: ([\s\S]*))?$/.exec(s);
  if (m) return { main: m[4].trim(), detail: `${m[1]} answered ${m[2]} to ${m[3]}${m[5] ? `: ${m[5]}` : ''}` };
  const n = /^(.+?) \(([^)]*)\): ([\s\S]*?)(?: — \1 said: ([\s\S]*))?$/.exec(s);
  if (n) return { main: n[3].trim(), detail: `${n[1]} (${n[2]})${n[4] ? `: ${n[4]}` : ''}` };
  return { main: s, detail: '' };
}

function Problem({ text }) {
  const f = friendly(text);
  return html`<div class="err" role="alert"><${Icon} n="alert" /><div class="col" style="gap:4px"><span>${f.main}</span>
    ${f.detail ? html`<details class="more"><summary>Details</summary><p>${f.detail}</p></details>` : null}</div></div>`;
}

export function statusOf(integ) {
  if (!integ) return { tone: '', label: 'Not connected' };
  if (integ.status === 'connected') return { tone: 'green', label: `Connected · ${integ.last_count ?? 0} vehicle${integ.last_count === 1 ? '' : 's'} found`, sub: integ.last_ok_at ? `checked ${ago(integ.last_ok_at)}` : '' };
  if (integ.status === 'error') return { tone: 'red', label: 'Not working', sub: friendly(integ.last_error).main };
  if (integ.status === 'paused') return { tone: 'amber', label: 'Paused' };
  return { tone: 'blue', label: 'Connecting…' };
}

function Found({ org, provider, vehicles, onFleetChange, toast }) {
  const [assets, setAssets] = useState(null);
  const [devices, setDevices] = useState(null);
  const [busy, setBusy] = useState(false);
  const reload = async () => { const [a, d] = await Promise.all([loadAssets(org.id), loadDevices(org.id)]); setAssets(a); setDevices(d); };
  useEffect(() => { reload(); }, [vehicles]);
  if (!assets || !devices) return null;
  const devOf = (v) => devices.find((d) => d.source === provider.key && d.external_id === v.external_id);
  const assetOf = (d) => d?.asset_id && assets.find((a) => a.id === d.asset_id);
  const loose = vehicles.filter((v) => !assetOf(devOf(v)));
  const tie = async (dev, assetId) => {
    try { await rpc('device_link', { p_device: dev.id, p_asset: assetId || null }); await reload(); onFleetChange && onFleetChange(); }
    catch (x) { toast(x.message, 'bad'); }
  };
  const addAll = async () => {
    setBusy(true);
    let n = 0;
    for (const v of loose) {
      try { await rpc('asset_save', { p_org: org.id, p: fit(v) }); n++; }
      catch (x) { toast(`${v.name || v.external_id}: ${x.message}`, 'bad'); }
    }
    await reload();
    onFleetChange && onFleetChange();
    setBusy(false);
    if (n) toast(`${n} vehicle${n === 1 ? '' : 's'} added to your fleet`);
  };
  const linked = vehicles.map((v) => assetOf(devOf(v))).filter(Boolean).map((a) => a.unit_no);
  return html`<div class="card"><div class="card-h"><h3 class="grow">${provider.name} found ${vehicles.length} vehicle${vehicles.length === 1 ? '' : 's'}</h3>
      ${loose.length ? html`<${Btn} size="sm" icon="plus" busy=${busy} onClick=${addAll}>Add ${loose.length} to my fleet<//>` : html`<${Chip} tone="green" icon="check">All linked to your vehicles<//>`}</div>
    <p class="dim sm" style="padding:6px 16px 0">${linked.length ? `Linked to your ${linked.length === 1 ? 'vehicle' : 'vehicles'} ${linked.join(', ')}.` : 'None matched your vehicles yet — link them below, or add them.'}
      ${loose.length && linked.length ? ` ${loose.length} not linked yet.` : ''}</p>
    <div class="list found-list" style="margin-top:8px">${vehicles.map((v) => {
      const d = devOf(v); const a = assetOf(d);
      return html`<div class="li" key=${v.external_id}><div class="li-ic"><${Icon} n="truck" /></div>
        <div class="grow"><div class="li-t">${v.name || v.external_id}</div>
          <div class="li-s">${[v.vin && `VIN …${v.vin.slice(-6)}`, v.plate, v.at ? `seen ${ago(v.at)}` : 'no position yet', v.address].filter(Boolean).join(' · ')}</div></div>
        ${a ? html`<${Chip} tone="green" icon="link">${a.unit_no}${d.link_source && d.link_source !== 'manual' ? ` · by ${d.link_source === 'vin' ? 'VIN' : d.link_source}` : ''}<//>`
          : d ? html`<select class="sel found-sel" aria-label=${'Link ' + (v.name || v.external_id) + ' to a vehicle'} onChange=${(e) => tie(d, e.target.value)}><option value="">Link to a vehicle…</option>
              ${assets.map((x) => html`<option value=${x.id}>${x.unit_no}</option>`)}</select>` : null}
      </div>`;
    })}</div></div>`;
}

export function ProviderConnect({ org, provider, integ, onChanged, toast, confirm }) {
  const cfg = integ?.config || {};
  const [vals, setVals] = useState(() => Object.fromEntries(provider.fields.map((f) => [f.key, f.secret ? '' : (cfg[f.key] ?? (f.options ? f.options[0][0] : ''))])));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [test, setTest] = useState(null);
  const [row, setRow] = useState(integ);
  const top = useRef(null);
  const st = statusOf(row);

  const run = async (id) => {
    const r = await edge('gps-sync', { op: 'test', integration_id: id }, { auth: true });
    setTest(r);
    onChanged && onChanged();
    setTimeout(() => top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);   // the answer is up here
    return r;
  };
  const save = async (e) => {
    e.preventDefault();
    if (busy) return;
    setErr(null); setTest(null); setBusy(true);
    try {
      const config = {}; const secret = {};
      for (const f of provider.fields) {
        const v = (vals[f.key] || '').trim();                          // a pasted space would make a good token fail
        if (f.secret) { if (v) secret[f.key] = v; }
        else if (v) config[f.key] = v;
      }
      const missing = provider.fields.filter((f) => !f.optional && !f.options && (f.secret ? !row && !secret[f.key] : !config[f.key]));
      if (missing.length) throw new Error(`Type the ${missing.map((f) => f.label).join(' and ')}.`);
      const saved = await rpc('integration_save', { p_org: org.id, p: { id: row?.id, provider: provider.key, config, secret: Object.keys(secret).length ? secret : null } });
      setRow(saved);
      setVals((x) => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, provider.fields.find((f) => f.key === k)?.secret ? '' : v])));
      const r = await run(saved.id);
      setRow({ ...saved, status: r.ok ? 'connected' : 'error', last_error: r.error, last_count: r.result?.devices ?? saved.last_count, last_ok_at: r.ok ? new Date().toISOString() : saved.last_ok_at });
      if (r.ok) toast(`${provider.name} connected`);
    } catch (x) { setErr(x); }
    setBusy(false);
  };
  const testNow = async () => {
    setErr(null); setBusy(true);
    try {
      const r = await run(row.id);
      setRow({ ...row, status: r.ok ? 'connected' : 'error', last_error: r.error, last_count: r.result?.devices ?? row.last_count, last_ok_at: r.ok ? new Date().toISOString() : row.last_ok_at });
    } catch (x) { setErr(x); }
    setBusy(false);
  };
  const pause = async (p) => {
    try { await rpc('integration_set_paused', { p_integration: row.id, p_paused: p }); setRow({ ...row, status: p ? 'paused' : 'pending' }); onChanged && onChanged(); }
    catch (x) { toast(x.message, 'bad'); }
  };
  const remove = async () => {
    if (!(await confirm({ title: `Disconnect ${provider.name}?`, text: 'Your login is deleted right away. Your vehicles and the positions already saved stay; they just stop updating from this GPS.', ok: 'Disconnect', danger: true }))) return;
    try { await rpc('integration_remove', { p_integration: row.id }); toast(`${provider.name} disconnected`); setRow(null); setTest(null); onChanged && onChanged(true); }
    catch (x) { toast(x.message, 'bad'); }
  };

  const failed = row?.status === 'error';
  return html`<div class="col" style="gap:18px">
    <div ref=${top} style="scroll-margin-top:16px" class="col">
    ${row ? html`<div class="card pad"><div class="row wrap"><span class=${'dot ' + st.tone + (row.status === 'connected' ? ' live' : '')}></span>
        <div class="st-text"><b>${st.label}</b>${st.sub && !(failed && test) ? html`<div class="dim sm">${st.sub}</div>` : null}
          ${failed && test ? html`<div class="dim sm">See what ${provider.name} said below, fix it and press Save and test.</div>` : null}</div>
        <${Btn} size="sm" icon="refresh" busy=${busy} onClick=${testNow}>Test now<//>
        ${failed ? null : row.status === 'paused' ? html`<${Btn} size="sm" icon="play" onClick=${() => pause(false)}>Resume<//>` : html`<${Btn} size="sm" icon="pause" onClick=${() => pause(true)}>Pause<//>`}
      </div></div>` : null}
    ${test?.ok ? html`<${Found} org=${org} provider=${provider} vehicles=${test.vehicles || []} toast=${toast} onFleetChange=${onChanged} />` : null}
    </div>
    <div class="section"><h4>Where to find it</h4><ol class="steps">${provider.steps.map((s) => html`<li>${s}</li>`)}</ol></div>
    <form class="form" onSubmit=${save}>
      ${provider.fields.map((f) => html`<${Field} key=${f.key} label=${f.label + (f.optional ? ' (optional)' : '')} id=${'pf-' + f.key}
          help=${f.secret && row?.secret_hint ? 'Saved. Type a new one only to replace it.' : ''}>
        ${f.options ? html`<select id=${'pf-' + f.key} class="sel" value=${vals[f.key]} onChange=${(e) => setVals({ ...vals, [f.key]: e.target.value })}>
            ${f.options.map(([v, l]) => html`<option value=${v}>${l}</option>`)}</select>`
          : html`<input id=${'pf-' + f.key} class=${'inp' + (f.secret ? ' mono' : '')} type=${f.secret ? 'password' : 'text'} autocomplete="off" spellcheck="false"
            value=${vals[f.key]} onInput=${(e) => setVals({ ...vals, [f.key]: e.target.value })}
            placeholder=${f.secret && row?.secret_hint ? `Saved ••••${String(row.secret_hint).trim().slice(-4)}` : (f.placeholder || '')} />`}<//>`)}
      <div class="dim xs row"><${Icon} n="lock" size="14" /><span>Saved encrypted and never shown again — not even to you. ${provider.name} is only read, never changed. <a href="#/about/gps">How we keep it</a></span></div>
      ${err ? html`<${Problem} text=${err.message || err} />` : null}
      ${test && !test.ok ? html`<${Problem} text=${test.error} />` : null}
      <div class="row wrap">${row ? html`<${Btn} kind="danger" icon="trash" onClick=${remove}>Disconnect<//>` : null}<span class="grow"></span>
        <${Btn} kind="primary" type="submit" busy=${busy}>${row ? 'Save and test' : 'Connect and test'}<//></div>
    </form>
  </div>`;
}

export function sourceLabel(s) { return sourceName(s); }
