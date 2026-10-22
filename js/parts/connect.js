// Connecting a GPS provider: where to find the credentials, the fields, then "Connect and test" — saves (the
// secret goes to Vault), asks gps-sync to read the provider right now, and shows what came back: each vehicle,
// whether it tied itself to one of yours, and one click to add the rest to the fleet.
import { html, useState, useEffect, Icon, Btn, Field, ErrorBox, Chip } from '../ui.js';
import { rpc, edge } from '../api.js';
import { loadAssets, loadDevices } from '../data.js';
import { ago, sourceName } from '../util.js';

export function ProviderLogo({ p, cls = '' }) {
  return html`<span class=${'plogo ' + cls} style=${`--c:${p.color}`}>${p.mono}</span>`;
}

export function statusOf(integ) {
  if (!integ) return { tone: '', label: 'Not connected' };
  if (integ.status === 'connected') return { tone: 'green', label: `Connected · ${integ.last_count ?? 0} vehicle${integ.last_count === 1 ? '' : 's'}`, sub: integ.last_ok_at ? `synced ${ago(integ.last_ok_at)}` : '' };
  if (integ.status === 'error') return { tone: 'red', label: 'Needs attention', sub: integ.last_error || '' };
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
  const untied = vehicles.filter((v) => !assetOf(devOf(v)));
  const tie = async (dev, assetId) => {
    try { await rpc('device_link', { p_device: dev.id, p_asset: assetId || null }); await reload(); onFleetChange && onFleetChange(); }
    catch (x) { toast(x.message, 'bad'); }
  };
  const addAll = async () => {
    setBusy(true);
    let n = 0;
    for (const v of untied) {
      try { await rpc('asset_save', { p_org: org.id, p: { unit_no: v.name || v.external_id, vin: v.vin || '', plate: v.plate || '', kind: 'truck' } }); n++; }
      catch (x) { toast(`${v.name || v.external_id}: ${x.message}`, 'bad'); }
    }
    await reload();
    onFleetChange && onFleetChange();
    setBusy(false);
    if (n) toast(`${n} vehicle${n === 1 ? '' : 's'} added to your fleet`);
  };
  return html`<div class="card"><div class="card-h"><h3 class="grow">Found ${vehicles.length} vehicle${vehicles.length === 1 ? '' : 's'}</h3>
      ${untied.length ? html`<${Btn} size="sm" icon="plus" busy=${busy} onClick=${addAll}>Add ${untied.length} to my fleet<//>` : html`<${Chip} tone="green" icon="check">All tied to your vehicles<//>`}</div>
    <div class="list" style="margin-top:8px">${vehicles.map((v) => {
      const d = devOf(v); const a = assetOf(d);
      return html`<div class="li" key=${v.external_id}><div class="li-ic"><${Icon} n="truck" /></div>
        <div class="grow"><div class="li-t">${v.name || v.external_id}</div>
          <div class="li-s">${[v.vin && `VIN …${v.vin.slice(-6)}`, v.plate, v.at ? `seen ${ago(v.at)}` : 'no position yet', v.address].filter(Boolean).join(' · ')}</div></div>
        ${a ? html`<${Chip} tone="green" icon="link">${a.unit_no}${d.link_source && d.link_source !== 'manual' ? ` · by ${d.link_source}` : ''}<//>`
          : d ? html`<select class="sel" style="width:170px;height:32px" onChange=${(e) => tie(d, e.target.value)}><option value="">Tie to vehicle…</option>
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
  const st = statusOf(row);

  const run = async (id) => {
    const r = await edge('gps-sync', { op: 'test', integration_id: id }, { auth: true });
    setTest(r);
    onChanged && onChanged();
    return r;
  };
  const save = async (e) => {
    e.preventDefault();
    setErr(null); setTest(null); setBusy(true);
    try {
      const config = {}; const secret = {};
      for (const f of provider.fields) {
        const v = (vals[f.key] || '').trim();
        if (f.secret) { if (v) secret[f.key] = vals[f.key]; }
        else if (v) config[f.key] = v;
      }
      const missing = provider.fields.filter((f) => !f.optional && !f.options && (f.secret ? !row && !secret[f.key] : !config[f.key]));
      if (missing.length) throw new Error(`Enter ${missing.map((f) => f.label).join(', ')}.`);
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
    if (!(await confirm({ title: `Disconnect ${provider.name}?`, text: 'The credentials are deleted. Vehicles and their history stay; they just stop updating from this provider.', ok: 'Disconnect', danger: true }))) return;
    try { await rpc('integration_remove', { p_integration: row.id }); toast(`${provider.name} disconnected`); setRow(null); setTest(null); onChanged && onChanged(true); }
    catch (x) { toast(x.message, 'bad'); }
  };

  return html`<div class="col" style="gap:18px">
    ${row ? html`<div class="card pad"><div class="row wrap"><span class=${'dot ' + st.tone + (row.status === 'connected' ? ' live' : '')}></span>
        <div class="grow"><b>${st.label}</b>${st.sub ? html`<div class="dim sm" style="overflow-wrap:anywhere">${st.sub}</div>` : null}</div>
        <${Btn} size="sm" icon="refresh" busy=${busy} onClick=${testNow}>Test now<//>
        ${row.status === 'paused' ? html`<${Btn} size="sm" icon="play" onClick=${() => pause(false)}>Resume<//>` : html`<${Btn} size="sm" icon="pause" onClick=${() => pause(true)}>Pause<//>`}
      </div></div>` : null}
    <div class="section"><h4>Where to find it</h4><ol class="steps">${provider.steps.map((s) => html`<li>${s}</li>`)}</ol></div>
    <form class="form" onSubmit=${save}>
      ${provider.fields.map((f) => html`<${Field} key=${f.key} label=${f.label + (f.optional ? ' (optional)' : '')} id=${'pf-' + f.key}>
        ${f.options ? html`<select id=${'pf-' + f.key} class="sel" value=${vals[f.key]} onChange=${(e) => setVals({ ...vals, [f.key]: e.target.value })}>
            ${f.options.map(([v, l]) => html`<option value=${v}>${l}</option>`)}</select>`
          : html`<input id=${'pf-' + f.key} class=${'inp' + (f.secret ? ' mono' : '')} type=${f.secret ? 'password' : 'text'} autocomplete="off" spellcheck="false"
            value=${vals[f.key]} onInput=${(e) => setVals({ ...vals, [f.key]: e.target.value })}
            placeholder=${f.secret && row?.secret_hint ? `Saved (${row.secret_hint}) — type to replace` : (f.placeholder || '')} />`}<//>`)}
      <div class="dim xs row"><${Icon} n="lock" size="14" />Secrets are encrypted in the vault and never shown again. We only ever read from ${provider.name}.</div>
      <${ErrorBox} error=${err} />
      ${test && !test.ok ? html`<${ErrorBox} error=${test.error} />` : null}
      <div class="row wrap">${row ? html`<${Btn} kind="danger" icon="trash" onClick=${remove}>Disconnect<//>` : null}<span class="grow"></span>
        <${Btn} kind="primary" type="submit" busy=${busy}>${row ? 'Save and test' : 'Connect and test'}<//></div>
    </form>
    ${test?.ok ? html`<${Found} org=${org} provider=${provider} vehicles=${test.vehicles || []} toast=${toast} onFleetChange=${onChanged} />` : null}
  </div>`;
}

export function sourceLabel(s) { return sourceName(s); }
