// Connections: the company connects its OWN accounts. GPS providers (credentials encrypted in Vault, read-only),
// the built-in Driver app and Open API, and what's coming next (Request = tells us what to build first).
// Every card ends in one status chip; "Coming next" cards are muted, so nothing looks available that isn't.
import { html, useState, Icon, Btn, Chip, Empty, Drawer, Field, ErrorBox, Skel, Top, LoadError, useLoad, useForm } from '../ui.js';
import { useApp, go } from '../ctx.js';
import { rpc } from '../api.js';
import { loadIntegrations, loadKeys, loadRequests } from '../data.js';
import { C, PROVIDERS, BUILTIN, providerOf, can, hasModule, ago, fmtDate, appLink, copy, inkOn } from '../util.js';
import { nameCheck, textCheck } from '../check.js';
import { ProviderConnect, ProviderLogo, statusOf } from '../parts/connect.js';

const OTHER = { key: 'other', name: 'Something else', cat: 'other', soon: true, color: '#8E8E93', mono: '+', blurb: 'Tell us what you use — fuel cards, dispatch, payroll, ticketing.' };

export function Logo({ p }) {
  return p.icon ? html`<span class="plogo" style=${`--c:${p.color};color:${inkOn(p.color)}`} aria-hidden="true"><${Icon} n=${p.icon} /></span>` : html`<${ProviderLogo} p=${p} />`;
}

function ApiPanel({ org }) {
  const app = useApp();
  const keys = useLoad(() => loadKeys(org.id), [org.id]);
  const [name, setName] = useState('');
  const [made, setMade] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const chk = useForm({ name }, { name: (v) => nameCheck(v, { what: 'Key name', max: 60, empty: 'Name the key after the system that will use it, like "Dispatch board".' }) }, { name: 'key-n' });
  const endpoint = `${C.SUPABASE_URL}/functions/v1/api/v1/positions`;
  const create = async (e) => {
    e.preventDefault();
    if (busy || !chk.ok()) return;
    setErr(null); setBusy(true);
    try { const r = await rpc('api_key_create', { p_org: org.id, p_name: name.trim() }); setMade(r); setName(''); keys.reload(); }
    catch (x) { setErr(x); }
    setBusy(false);
  };
  const revoke = async (k) => {
    const ok = await app.confirm({ title: `Revoke "${k.name}"?`, text: 'Anything still using this key stops working right away.', ok: 'Revoke', danger: true,
      action: () => rpc('api_key_revoke', { p_key: k.id }) });
    if (ok) { app.toast(`"${k.name}" revoked`); keys.reload(); }
  };
  const sample = `curl -X POST "${endpoint}" \\\n  -H "Authorization: Bearer ${made?.key || 'mk_live_…'}" \\\n  -H "Content-Type: application/json" \\\n`
    + `  -d '{"positions":[{"vehicle":"T-1","lat":30.2672,"lon":-97.7431,"at":"${new Date().toISOString().slice(0, 19)}Z","speed_mph":34}]}'`;
  const active = (keys.data || []).filter((k) => !k.revoked_at);
  return html`<div class="col gap-20">
    ${made ? html`<div class="col gap-12"><div class="okmsg" role="status"><${Icon} n="check" /><div><b>Copy your key now.</b> It's shown only once — we keep only a fingerprint of it.</div></div>
      <div class="keybig">${made.key}</div>
      <div class="row"><${Btn} kind="primary" icon="copy" onClick=${async () => { const ok = await copy(made.key); app.toast(ok ? 'Key copied' : 'Select it and copy it by hand', ok ? 'ok' : 'bad'); }}>Copy key<//>
        <${Btn} kind="ghost" onClick=${() => setMade(null)}>I saved it<//></div></div>`
    : html`<form class="form" onSubmit=${create} novalidate>
        <${Field} label="Name of the new key" id="key-n" help="Name it after the system that will use it." error=${chk.errs.name}>
          <div class="linkline"><input id="key-n" class="inp" value=${name} placeholder="Dispatch board" autocomplete="off"
            onInput=${(e) => { setName(e.target.value); chk.edit('name', e.target.value); }} onBlur=${chk.blur('name')} />
            <${Btn} kind="primary" type="submit" icon="key" busy=${busy}>New key<//></div><//></form>`}
    <${ErrorBox} error=${err} />
    <div class="section"><h4>Keys</h4>
      ${keys.failed ? html`<${LoadError} what="your keys" error=${keys.error} retry=${keys.retry} />`
        : !keys.data ? html`<${Skel} h=${60} />` : active.length ? html`<div class="card"><div class="list">${active.map((k) => html`<div class="li" key=${k.id}>
          <div class="li-ic"><${Icon} n="key" /></div><div class="grow"><div class="li-t">${k.name}</div>
          <div class="li-s"><span class="mono">${k.prefix}…</span> · made ${fmtDate(k.created_at, org.timezone)} · ${k.last_used_at ? `used ${ago(k.last_used_at)} · ${k.use_count} calls` : 'never used'}</div></div>
          <${Btn} size="sm" kind="danger" onClick=${() => revoke(k)} aria-label=${`Revoke ${k.name}`}>Revoke<//></div>`)}</div></div>` : html`<p class="dim sm">No keys yet.</p>`}</div>
    <div class="section"><h4>Send positions</h4>
      <p class="dim sm">POST up to 1,000 positions per call. <b>vehicle</b> is your own id for it — use the unit number and it links itself to that vehicle.
        Times are ISO 8601 or Unix seconds. Optional: speed_mph, heading, ignition, address, vin, plate, name.</p>
      <div class="code">${sample}</div>
      <p class="dim xs">Check a key with GET ${C.SUPABASE_URL}/functions/v1/api/v1/ping (same header).</p></div>
  </div>`;
}

function DriverPanel() {
  const app = useApp();
  const link = appLink('/driver');
  return html`<div class="col gap-16">
    <ol class="steps">
      <li>Invite your drivers in Team, with the Driver role.</li>
      <li>On their phone they open the link, sign in, pick the truck they're driving today and tap Start.</li>
      <li>The truck shows on your live map while the screen stays on. Trucks change hands? They just pick another one tomorrow.</li>
    </ol>
    <div class="linkline"><input class="inp" readonly value=${link} aria-label="Driver mode link" onFocus=${(e) => e.target.select()} />
      <${Btn} icon="copy" onClick=${async () => { const ok = await copy(link); app.toast(ok ? 'Link copied' : 'Select it and copy it by hand', ok ? 'ok' : 'bad'); }}>Copy<//></div>
    <p class="dim xs">On iPhone, tapping Share → Add to Home Screen makes it open like an app.</p>
    <div class="row"><${Btn} icon="nav" onClick=${() => go('driver')}>Open Driver mode here<//></div>
  </div>`;
}

function RequestPanel({ org, p, done, onDone }) {
  const app = useApp();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const other = p.key === 'other';
  // the same rules and words as the database (p004): 500 characters, no < >, and "Something else" needs a name
  const chk = useForm({ note }, { note: (v) => (other && !/[\p{L}\p{N}]/u.test(String(v || '')) ? 'Tell us which system you use.' : textCheck(v, { what: 'Note', max: 500 })) }, { note: 'rq' });
  const send = async (e) => {
    e.preventDefault();
    if (busy || !chk.ok()) return;
    setErr(null); setBusy(true);
    try { await rpc('integration_request', { p_org: org.id, p_provider: p.key, p_note: note.trim() }); app.toast(other ? 'Request sent — thank you' : `${p.name} requested — thank you`); onDone(); }
    catch (x) { setErr(x); setBusy(false); }
  };
  return html`<form class="form" onSubmit=${send} novalidate>
    <p class="dim">${other ? 'Tell us which system you use and what should flow between it and your command center.'
      : `${p.name} is next on our list. Tell us you need it — requests decide what gets built first.`}</p>
    ${done ? html`<div class="okmsg"><${Icon} n="check" /><div>You already asked for ${p.name}. Add another note if it helps.</div></div>` : null}
    <${Field} label=${other ? 'Which system?' : 'Anything we should know? (optional)'} id="rq" error=${chk.errs.note}><textarea id="rq" class="txt" value=${note}
      onInput=${(e) => { setNote(e.target.value); chk.edit('note', e.target.value); }} onBlur=${chk.blur('note')}
      placeholder=${other ? 'For example: our dispatch software, our fuel cards…' : ''}></textarea><//>
    <${ErrorBox} error=${err} />
    <div class="form-foot"><span class="grow"></span><${Btn} kind="primary" type="submit" busy=${busy}>Request ${other ? 'it' : p.name}<//></div>
  </form>`;
}

export function Integrations() {
  const app = useApp();
  const { org, route, toast, confirm } = app;
  const manage = can(org.role, 'integrations');
  const integ = useLoad(() => loadIntegrations(org.id), [org.id], { every: 30000 });
  const reqs = useLoad(() => (manage ? loadRequests(org.id) : Promise.resolve([])), [org.id, manage]);
  const open = route.params[0] || null;
  const rowOf = (k) => (integ.data || []).find((i) => i.provider === k);
  const asked = (k) => (reqs.data || []).some((r) => r.provider === k);
  const gps = PROVIDERS.filter((p) => p.cat === 'gps');
  const soon = [...PROVIDERS.filter((p) => p.soon), OTHER];
  const builtin = [hasModule(org, 'driver') && BUILTIN.driver, hasModule(org, 'api') && manage && BUILTIN.api].filter(Boolean);
  const cur = open && (providerOf(open) || BUILTIN[open] || (open === 'other' && OTHER));
  const close = () => go('integrations');

  const card = (p, status, cls = '') => html`<button type="button" class=${'icard ' + cls} key=${p.key} onClick=${() => go('integrations/' + p.key)}>
    <div class="ic-top"><${Logo} p=${p} /><div class="grow"><div class="ic-n">${p.name}</div><div class="ic-c">${p.cat === 'gps' ? 'GPS trackers' : p.soon ? 'Coming next' : 'Built in'}</div></div>
      ${p.beta ? html`<${Chip}>Beta<//>` : null}</div>
    <div class="ic-d">${p.blurb}</div>
    <div class="ic-f">${status}</div></button>`;

  return html`<${Top} title="Connections" sub="Connect your GPS and the other systems your company already uses — with your own accounts and logins." />
    <div class="page">
      ${hasModule(org, 'map') ? html`<div class="section"><h4>GPS trackers</h4>
        ${integ.failed ? html`<${LoadError} cls="card" what="your connections" error=${integ.error} retry=${integ.retry} />`
          : !integ.data ? html`<${Skel} h=${150} />` : html`<div class="igrid">${gps.map((p) => {
          const st = statusOf(rowOf(p.key));
          return card(p, html`<${Chip} tone=${st.tone}>${rowOf(p.key)?.status === 'connected' ? html`<span class="dot green live"></span>` : null}${st.label}<//>
            <span class="grow"></span>${manage ? html`<${Icon} n="chevR" size="16" />` : null}`);
        })}</div>`}</div>` : null}
      ${builtin.length ? html`<div class="section"><h4>Built in</h4><div class="igrid">${builtin.map((p) => card(p, html`<${Chip} tone="green" icon="check">Included in your license<//>
        <span class="grow"></span><${Icon} n="chevR" size="16" />`))}</div></div>` : null}
      ${manage ? html`<div class="section"><h4>Coming next</h4><div class="igrid">${soon.map((p) => card(p, reqs.data === undefined ? html`<span class="dim xs"> </span>`
          : asked(p.key) ? html`<${Chip} tone="accent" icon="check">Requested<//>` : html`<span class="mini">Request it</span>`, 'soon'))}</div></div>` : null}
    </div>
    ${cur ? html`<${Drawer} title=${cur.name} sub=${cur.blurb} onClose=${close} wide head=${html`<${Logo} p=${cur} />`}>
      ${cur.cat === 'gps' && manage ? (integ.data ? html`<${ProviderConnect} key=${cur.key + (rowOf(cur.key)?.id || '')} org=${org} provider=${cur} integ=${rowOf(cur.key)} toast=${toast} confirm=${confirm} onChanged=${() => integ.reload()} />`
          : integ.failed ? html`<${LoadError} what="this connection" error=${integ.error} retry=${integ.retry} />` : html`<${Skel} h=${200} />`)
        : cur.cat === 'gps' ? html`<div class="card pad">${statusOf(rowOf(cur.key)).label}. Only an owner or admin can change connections.</div>`
        : cur.key === 'api' ? html`<${ApiPanel} org=${org} />`
        : cur.key === 'driver' ? html`<${DriverPanel} />`
        : manage ? html`<${RequestPanel} org=${org} p=${cur} done=${asked(cur.key)} onDone=${() => { reqs.reload(); close(); }} />` : null}
    <//>` : null}`;
}

export { Empty };
