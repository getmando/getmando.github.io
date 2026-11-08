// Integrations: the company connects its OWN accounts. GPS providers (credentials encrypted in Vault, read-only),
// the built-in Driver app and Open API, and what's coming next (Request = tells us what to build first).
import { html, useState, Icon, Btn, Chip, Empty, Drawer, Field, ErrorBox, Skel, Top, useLoad } from '../ui.js';
import { useApp, go } from '../ctx.js';
import { rpc } from '../api.js';
import { loadIntegrations, loadKeys, loadRequests } from '../data.js';
import { C, PROVIDERS, providerOf, can, hasModule, ago, fmtDate, appLink, copy } from '../util.js';
import { ProviderConnect, ProviderLogo, statusOf } from '../parts/connect.js';

const BUILTIN = {
  driver: { key: 'driver', name: 'Driver app', mono: '', color: '#34C759', icon: 'phone', blurb: 'Drivers\' phones as GPS trackers. No hardware — they pick the truck they\'re in and tap Start.' },
  api: { key: 'api', name: 'Open API', mono: '', color: '#5E5CE6', icon: 'code', blurb: 'For software people: your other systems (a dispatch board, another GPS, your own app) send truck positions with your company\'s key.' },
};

function Logo({ p }) {
  return p.icon ? html`<span class="plogo" style=${`--c:${p.color}`}><${Icon} n=${p.icon} /></span>` : html`<${ProviderLogo} p=${p} />`;
}

function ApiPanel({ org }) {
  const app = useApp();
  const keys = useLoad(() => loadKeys(org.id), [org.id]);
  const [name, setName] = useState('');
  const [made, setMade] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const endpoint = `${C.SUPABASE_URL}/functions/v1/api/v1/positions`;
  const create = async (e) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try { const r = await rpc('api_key_create', { p_org: org.id, p_name: name }); setMade(r); setName(''); keys.reload(); }
    catch (x) { setErr(x); }
    setBusy(false);
  };
  const revoke = async (k) => {
    if (!(await app.confirm({ title: `Revoke "${k.name}"?`, text: 'Anything still using this key stops working right away.', ok: 'Revoke', danger: true }))) return;
    try { await rpc('api_key_revoke', { p_key: k.id }); app.toast('Key revoked'); keys.reload(); } catch (x) { app.toast(x.message, 'bad'); }
  };
  const sample = `curl -X POST "${endpoint}" \\\n  -H "Authorization: Bearer ${made?.key || 'mk_live_…'}" \\\n  -H "Content-Type: application/json" \\\n`
    + `  -d '{"positions":[{"vehicle":"T-1","lat":30.2672,"lon":-97.7431,"at":"${new Date().toISOString().slice(0, 19)}Z","speed_mph":34}]}'`;
  const active = (keys.data || []).filter((k) => !k.revoked_at);
  return html`<div class="col" style="gap:18px">
    ${made ? html`<div class="col" style="gap:10px"><div class="okmsg"><${Icon} n="check" /><div><b>Copy your key now.</b> It's shown only once — we keep only a fingerprint of it.</div></div>
      <div class="keybig">${made.key}</div>
      <div class="row"><${Btn} icon="copy" onClick=${async () => app.toast((await copy(made.key)) ? 'Key copied' : 'Select it and copy it by hand')}>Copy key<//>
        <${Btn} kind="ghost" onClick=${() => setMade(null)}>Done<//></div></div>`
    : html`<form class="row" onSubmit=${create}><input class="inp grow" placeholder="Name it after the system that will use it" value=${name}
        onInput=${(e) => setName(e.target.value)} maxlength="60" required /><${Btn} kind="primary" type="submit" icon="key" busy=${busy}>New key<//></form>`}
    <${ErrorBox} error=${err} />
    <div class="section"><h4>Keys</h4>
      ${!keys.data ? html`<${Skel} h=${60} />` : active.length ? html`<div class="card"><div class="list">${active.map((k) => html`<div class="li" key=${k.id}>
          <div class="li-ic"><${Icon} n="key" /></div><div class="grow"><div class="li-t">${k.name}</div>
          <div class="li-s"><span class="mono">${k.prefix}…</span> · made ${fmtDate(k.created_at, org.timezone)} · ${k.last_used_at ? `used ${ago(k.last_used_at)} · ${k.use_count} calls` : 'never used'}</div></div>
          <${Btn} size="sm" kind="danger" onClick=${() => revoke(k)}>Revoke<//></div>`)}</div></div>` : html`<p class="dim sm">No keys yet.</p>`}</div>
    <div class="section"><h4>Send positions</h4>
      <p class="dim sm">POST up to 1,000 positions per call. <b>vehicle</b> is your own id for it — use the unit number and it ties itself to that vehicle.
        Times are ISO 8601 or Unix seconds. Optional: speed_mph, heading, ignition, address, vin, plate, name.</p>
      <div class="code">${sample}</div>
      <p class="dim xs">Check a key with GET ${C.SUPABASE_URL}/functions/v1/api/v1/ping (same header).</p></div>
  </div>`;
}

function DriverPanel({ org }) {
  const app = useApp();
  const link = appLink('/driver');
  return html`<div class="col" style="gap:16px">
    <ol class="steps">
      <li>Invite your drivers in Team, with the Driver role.</li>
      <li>On their phone they open the link, sign in, pick the truck they're driving today and tap Start.</li>
      <li>The truck shows on your live map while the screen stays on. Trucks change hands? They just pick another one tomorrow.</li>
    </ol>
    <div class="linkline"><input class="inp" readonly value=${link} /><${Btn} icon="copy" onClick=${async () => app.toast((await copy(link)) ? 'Link copied' : 'Select it and copy it by hand')}>Copy<//></div>
    <p class="dim xs">On iPhone, tapping Share → Add to Home Screen makes it open like an app.</p>
    <div class="row"><${Btn} icon="nav" onClick=${() => go('driver')}>Open Driver mode here<//></div>
  </div>`;
}

function RequestPanel({ org, p, done, onDone }) {
  const app = useApp();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const send = async (e) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try { await rpc('integration_request', { p_org: org.id, p_provider: p.key, p_note: note }); app.toast('Request sent — thank you'); onDone(); }
    catch (x) { setErr(x); }
    setBusy(false);
  };
  return html`<form class="form" onSubmit=${send}>
    <p class="dim">${p.key === 'other' ? 'Tell us which system you use and what should flow between it and your command center.'
      : `${p.name} is next on our list. Tell us you need it — requests decide what gets built first.`}</p>
    ${done ? html`<div class="okmsg"><${Icon} n="check" /><div>You already asked for ${p.name}. Add another note if it helps.</div></div>` : null}
    <${Field} label=${p.key === 'other' ? 'Which system?' : 'Anything we should know? (optional)'} id="rq"><textarea id="rq" class="txt" value=${note} onInput=${(e) => setNote(e.target.value)}
      required=${p.key === 'other'} placeholder=${p.key === 'other' ? 'For example: our dispatch software, our fuel cards…' : ''}></textarea><//>
    <${ErrorBox} error=${err} />
    <div class="row"><span class="grow"></span><${Btn} kind="primary" type="submit" busy=${busy}>Request ${p.key === 'other' ? 'it' : p.name}<//></div>
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
  const soon = [...PROVIDERS.filter((p) => p.soon), { key: 'other', name: 'Something else', cat: 'other', soon: true, color: '#8E8E93', mono: '+', blurb: 'Tell us what you use — fuel cards, dispatch, payroll, ticketing.' }];
  const builtin = [hasModule(org, 'driver') && BUILTIN.driver, hasModule(org, 'api') && manage && BUILTIN.api].filter(Boolean);
  const cur = open && (providerOf(open) || BUILTIN[open] || (open === 'other' && soon[soon.length - 1]));
  const close = () => go('integrations');

  const card = (p, status) => html`<button type="button" class="icard" key=${p.key} onClick=${() => go('integrations/' + p.key)}>
    <div class="ic-top"><${Logo} p=${p} /><div class="grow"><div class="ic-n">${p.name}</div><div class="ic-c">${p.cat === 'gps' ? 'GPS trackers' : p.soon ? 'Coming next' : 'Built in'}</div></div>
      ${p.beta ? html`<${Chip}>Beta<//>` : null}</div>
    <div class="ic-d">${p.blurb}</div>
    <div class="ic-f">${status}</div></button>`;

  return html`<${Top} title="Connections" sub="Connect your GPS and the other systems your company already uses — with your own accounts and logins." />
    <div class="page">
      ${hasModule(org, 'map') ? html`<div class="section"><h4>GPS trackers</h4>
        ${!integ.data ? html`<${Skel} h=${150} />` : html`<div class="igrid">${gps.map((p) => {
          const st = statusOf(rowOf(p.key));
          return card(p, html`<span class=${'dot ' + st.tone + (rowOf(p.key)?.status === 'connected' ? ' live' : '')}></span><span class="grow">${st.label}${st.sub && rowOf(p.key)?.status === 'connected' ? ' · ' + st.sub : ''}</span>
            ${manage ? html`<${Icon} n="chevR" size="16" />` : null}`);
        })}</div>`}</div>` : null}
      ${builtin.length ? html`<div class="section"><h4>Built in</h4><div class="igrid">${builtin.map((p) => card(p, html`<${Chip} tone="green" icon="check">Included in your license<//>`))}</div></div>` : null}
      ${manage ? html`<div class="section"><h4>Coming next</h4><div class="igrid">${soon.map((p) => card(p, asked(p.key) ? html`<${Chip} tone="blue" icon="check">Requested<//>` : html`<span>Request it</span>`))}</div></div>` : null}
    </div>
    ${cur ? html`<${Drawer} title=${cur.name} sub=${cur.blurb} onClose=${close} wide head=${html`<${Logo} p=${cur} />`}>
      ${cur.cat === 'gps' && manage ? (integ.data ? html`<${ProviderConnect} key=${cur.key + (rowOf(cur.key)?.id || '')} org=${org} provider=${cur} integ=${rowOf(cur.key)} toast=${toast} confirm=${confirm} onChanged=${() => integ.reload()} />` : html`<${Skel} h=${200} />`)
        : cur.cat === 'gps' ? html`<div class="card pad">${statusOf(rowOf(cur.key)).label}. Only an owner or admin can change connections.</div>`
        : cur.key === 'api' ? html`<${ApiPanel} org=${org} />`
        : cur.key === 'driver' ? html`<${DriverPanel} org=${org} />`
        : manage ? html`<${RequestPanel} org=${org} p=${cur} done=${asked(cur.key)} onDone=${() => { reqs.reload(); close(); }} />` : null}
    <//>` : null}`;
}

export { Empty };
