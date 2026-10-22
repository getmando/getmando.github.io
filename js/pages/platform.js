// License desk (platform admins only): issue a license → a key, an activation link, a QR and a ready message
// for the company's owner; then watch every company's usage (counts only — never their data), change seats,
// modules and dates, suspend, resume or revoke, and make a password reset link for an owner.
import { html, useState, Icon, OrgBadge, Btn, Chip, Empty, Drawer, Field, ErrorBox, Seg, Skel, Top, Qr, CopyLine, useLoad, useTick } from '../ui.js';
import { useApp, go } from '../ctx.js';
import { rpc } from '../api.js';
import { BRAND, KINDS, MODULES, COMING, ago, fmtDate, appLink, copy, mailLink, smsLink, firstName, plural } from '../util.js';
import { LicenseCard } from './auth.js';
import { ShareBox } from '../parts/invite.js';

export function licState(l) {
  if (l.status === 'revoked') return ['Revoked', 'red'];
  if (l.status === 'suspended') return ['Suspended', 'amber'];
  if (l.status === 'issued') return new Date(l.activate_by) < new Date() ? ['Link expired', 'amber'] : ['Waiting for activation', 'blue'];
  if (l.expires_at && new Date(l.expires_at) < new Date()) return ['Expired', 'red'];
  return ['Active', 'green'];
}

function KeyResult({ lic, code, activateBy, toast }) {
  const link = appLink(`/activate/${code}`);
  const message = `Hi${lic.contact_name ? ' ' + firstName(lic.contact_name) : ''} — your ${BRAND} license for ${lic.company_name} is ready.\n\n`
    + `Open this link to create your account and set up ${lic.company_name}'s command center:\n${link}\n\n`
    + `Your license key: ${code}\nActivate by ${fmtDate(activateBy)}.`;
  const copyMsg = async () => { const ok = await copy(message); toast(ok ? 'Invitation copied — paste it in an email or text' : 'Select it and copy it by hand', ok ? 'ok' : 'bad'); };
  return html`<div class="issued">
    <div class="okmsg"><${Icon} n="check" /><div><b>License issued.</b> The key is shown only now — send it before you close this. If it gets lost before activation, make a new key from the license.</div></div>
    <${LicenseCard} lic=${lic} code=${code} />
    <div class="issued-top"><${Qr} text=${link} />
      <div class="col grow" style="gap:10px">
        <div class="keybig">${code}</div>
        <${CopyLine} value=${link} toast=${toast} label="Copy link" />
        <div class="row wrap"><${Btn} kind="primary" icon="copy" onClick=${copyMsg}>Copy invitation<//>
          <a class="btn" href=${mailLink(lic.contact_email, `Your ${BRAND} license for ${lic.company_name}`, message)}><${Icon} n="mail" />Email it</a>
          <a class="btn" href=${smsLink(message)}><${Icon} n="msg" />Text it</a></div>
        <span class="dim xs">The link opens the activation page with the key filled in. Activate by ${fmtDate(activateBy)}.</span>
      </div></div>
    <div class="code" style="white-space:pre-wrap">${message}</div>
  </div>`;
}

function Mods({ value, onChange }) {
  const flip = (k) => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]);
  return html`<div class="mods">
    ${Object.entries(MODULES).map(([k, m]) => html`<label key=${k} class=${'modc' + (value.includes(k) ? ' on' : '')}>
      <input type="checkbox" checked=${value.includes(k)} onChange=${() => flip(k)} /><div><b>${m.name}</b><span>${m.desc}</span></div></label>`)}
    ${Object.entries(COMING).map(([k, m]) => html`<div key=${k} class="modc off"><input type="checkbox" disabled /><div><b>${m.name} <span class="chip" style="margin-left:4px">Coming</span></b><span>${m.desc}</span></div></div>`)}
  </div>`;
}

function Issue({ onClose, onIssued }) {
  const app = useApp();
  const [f, setF] = useState({ company_name: '', company_kind: 'subcontractor', contact_name: '', contact_email: '', contact_phone: '', plan: 'pilot',
    seats: '10', term_months: '12', activate_days: '30', notes: '', modules: ['fleet', 'map', 'driver', 'api'] });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [done, setDone] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const issue = async (e) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const r = await rpc('platform_license_issue', { p: { ...f, term_months: f.term_months === 'none' ? null : f.term_months } });
      setDone({ ...r, lic: { ...f, seats: Number(f.seats), term_months: f.term_months === 'none' ? null : Number(f.term_months) } });
      onIssued();
    } catch (x) { setErr(x); }
    setBusy(false);
  };
  return html`<${Drawer} title=${done ? `License for ${done.lic.company_name}` : 'Issue a license'} sub=${done ? 'Send it to the owner.' : 'One license per company. The owner activates it and builds their own command center.'}
      icon="license" onClose=${onClose} wide>
    ${done ? html`<${KeyResult} lic=${done.lic} code=${done.code} activateBy=${done.activate_by} toast=${app.toast} />`
    : html`<form class="form" onSubmit=${issue} id="issueform">
      <div class="grid2">
        <${Field} label="Company" id="li-c" cls="span2"><input id="li-c" class="inp" value=${f.company_name} onInput=${set('company_name')} required maxlength="80" placeholder="Ash-Nem Trucking" /><//>
        <${Field} label="What they do" id="li-k"><select id="li-k" class="sel" value=${f.company_kind} onChange=${set('company_kind')}>
          ${Object.entries(KINDS).map(([k, v]) => html`<option value=${k}>${v}</option>`)}</select><//>
        <${Field} label="Plan"><${Seg} value=${f.plan} onChange=${(v) => setF({ ...f, plan: v })} options=${[{ v: 'pilot', label: 'Pilot' }, { v: 'standard', label: 'Standard' }, { v: 'enterprise', label: 'Enterprise' }]} /><//>
        <${Field} label="Owner's name" id="li-n"><input id="li-n" class="inp" value=${f.contact_name} onInput=${set('contact_name')} placeholder="Who activates it" /><//>
        <${Field} label="Owner's email" id="li-e" help="Filled in for them on the activation page."><input id="li-e" class="inp" type="email" value=${f.contact_email} onInput=${set('contact_email')} /><//>
        <${Field} label="Owner's mobile" id="li-p"><input id="li-p" class="inp" type="tel" value=${f.contact_phone} onInput=${set('contact_phone')} /><//>
        <${Field} label="Seats" id="li-s" help="People who can sign in (invitations count)."><input id="li-s" class="inp" type="number" min="1" max="500" value=${f.seats} onInput=${set('seats')} /><//>
        <${Field} label="Term" id="li-t" help="Counts from the day they activate."><select id="li-t" class="sel" value=${f.term_months} onChange=${set('term_months')}>
          ${[['3', '3 months'], ['6', '6 months'], ['12', '12 months'], ['24', '24 months'], ['36', '36 months'], ['none', 'No end date']].map(([v, l]) => html`<option value=${v}>${l}</option>`)}</select><//>
        <${Field} label="Activation link works for" id="li-a"><select id="li-a" class="sel" value=${f.activate_days} onChange=${set('activate_days')}>
          ${[['7', '7 days'], ['14', '14 days'], ['30', '30 days'], ['60', '60 days'], ['90', '90 days']].map(([v, l]) => html`<option value=${v}>${l}</option>`)}</select><//>
      </div>
      <${Field} label="Modules"><${Mods} value=${f.modules} onChange=${(m) => setF({ ...f, modules: m })} /><//>
      <${Field} label="Notes (only you see these)" id="li-x"><textarea id="li-x" class="txt" value=${f.notes} onInput=${set('notes')} placeholder="Deal terms, who referred them…"></textarea><//>
      <${ErrorBox} error=${err} />
      <div class="row"><span class="dim sm grow">They get a key, an activation link and a QR. Nothing about any other company is in it.</span>
        <${Btn} kind="primary" type="submit" icon="license" busy=${busy}>Issue license<//></div>
    </form>`}
  <//>`;
}

function Manage({ l, onClose, onChanged }) {
  const app = useApp();
  const [st, tone] = licState(l);
  const [seats, setSeats] = useState(String(l.seats));
  const [mods, setMods] = useState(l.modules || []);
  const [plan, setPlan] = useState(l.plan);
  const [exp, setExp] = useState(l.expires_at ? l.expires_at.slice(0, 10) : '');
  const [notes, setNotes] = useState(l.notes || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [rekey, setRekey] = useState(null);
  const [reset, setReset] = useState(null);
  const save = async () => {
    setErr(null); setBusy(true);
    try {
      await rpc('platform_license_update', { p_license: l.id, p: { seats, modules: mods, plan, notes, ...(l.org_id ? { expires_at: exp ? new Date(exp + 'T23:59:59').toISOString() : '' } : {}) } });
      app.toast('License updated'); onChanged();
    } catch (x) { setErr(x); }
    setBusy(false);
  };
  const status = async (s, title, text) => {
    if (!(await app.confirm({ title, text, ok: title.split(' ')[0], danger: s !== 'active' }))) return;
    try { await rpc('platform_license_set_status', { p_license: l.id, p_status: s }); app.toast('Done'); onChanged(); }
    catch (x) { app.toast(x.message, 'bad'); }
  };
  const newKey = async () => {
    if (!(await app.confirm({ title: 'Make a new key?', text: 'The old key and link stop working.', ok: 'New key' }))) return;
    try { setRekey(await rpc('platform_license_rekey', { p_license: l.id })); onChanged(); } catch (x) { app.toast(x.message, 'bad'); }
  };
  const ownerReset = async () => {
    try { setReset(await rpc('platform_owner_reset_link', { p_license: l.id })); } catch (x) { app.toast(x.message, 'bad'); }
  };
  if (rekey) return html`<${Drawer} title=${`New key for ${l.company_name}`} onClose=${onClose} wide icon="key">
    <${KeyResult} lic=${l} code=${rekey.code} activateBy=${rekey.activate_by} toast=${app.toast} /><//>`;
  if (reset) {
    const link = appLink(`/reset/${reset.token}`);
    return html`<${Drawer} title=${`Password reset for ${reset.full_name}`} sub=${`Owner of ${l.company_name}`} onClose=${onClose} icon="key">
      <${ShareBox} link=${link} subject=${`Set a new password · ${BRAND}`} email=${reset.email} toast=${app.toast} note="Works once, within 24 hours · shown only now"
        message=${`Here's your link to set a new password for ${BRAND}:\n${link}\n\nIt works once, within 24 hours.`} /><//>`;
  }
  return html`<${Drawer} title=${l.company_name} sub=${`${KINDS[l.company_kind] || ''} · key …${l.code_hint}`} onClose=${onClose} wide
      head=${html`<${OrgBadge} org=${{ name: l.org_name || l.company_name }} />`}>
    <div class="row wrap"><${Chip} tone=${tone}>${st}<//><${Chip} tone="violet">${l.plan}<//>
      ${l.last_seen ? html`<${Chip} icon="clock">active ${ago(l.last_seen)}<//>` : null}</div>
    ${l.org_id ? html`<div class="tiles" style="grid-template-columns:repeat(3,minmax(0,1fr))">
      <div class="tile" style="cursor:default"><div class="t-l">People</div><div class="t-v">${l.members}<small>/ ${l.seats}</small></div><div class="t-s">${l.invites_open} invitation${l.invites_open === 1 ? '' : 's'} open</div></div>
      <div class="tile" style="cursor:default"><div class="t-l">Vehicles</div><div class="t-v">${l.assets}</div><div class="t-s">${l.devices} GPS · ${l.reporting} live</div></div>
      <div class="tile" style="cursor:default"><div class="t-l">Connections</div><div class="t-v">${l.integrations}</div><div class="t-s">GPS providers working</div></div></div>` : null}
    <div class="section"><h4>License</h4><dl class="kv">
      <dt>Owner</dt><dd>${l.owner ? `${l.owner.name} · ${l.owner.email || ''}` : `${l.contact_name || '—'}${l.contact_email ? ' · ' + l.contact_email : ''} (not activated)`}</dd>
      <dt>Issued</dt><dd>${fmtDate(l.issued_at)}</dd>
      ${l.org_id ? html`<dt>Activated</dt><dd>${fmtDate(l.activated_at)}</dd>` : html`<dt>Activate by</dt><dd>${fmtDate(l.activate_by)}</dd>`}
      <dt>Ends</dt><dd>${l.expires_at ? fmtDate(l.expires_at) : l.org_id ? 'No end date' : l.term_months ? `${l.term_months} months after activation` : 'No end date'}</dd>
      ${l.contact_phone ? html`<dt>Mobile</dt><dd>${l.contact_phone}</dd>` : null}</dl></div>
    ${l.status !== 'revoked' ? html`<div class="section"><h4>Change</h4>
      <div class="grid2">
        <${Field} label="Seats" id="m-s"><input id="m-s" class="inp" type="number" min="1" max="500" value=${seats} onInput=${(e) => setSeats(e.target.value)} /><//>
        <${Field} label="Plan"><${Seg} value=${plan} onChange=${setPlan} options=${[{ v: 'pilot', label: 'Pilot' }, { v: 'standard', label: 'Standard' }, { v: 'enterprise', label: 'Enterprise' }]} /><//>
        ${l.org_id ? html`<${Field} label="Ends on" id="m-e" help="Empty = no end date."><input id="m-e" class="inp" type="date" value=${exp} onInput=${(e) => setExp(e.target.value)} /><//>` : null}
      </div>
      <${Field} label="Modules"><${Mods} value=${mods} onChange=${setMods} /><//>
      <${Field} label="Notes" id="m-n"><textarea id="m-n" class="txt" value=${notes} onInput=${(e) => setNotes(e.target.value)}></textarea><//>
      <${ErrorBox} error=${err} />
      <div class="row"><span class="grow"></span><${Btn} kind="primary" busy=${busy} onClick=${save}>Save changes<//></div></div>
    <div class="section"><h4>Actions</h4><div class="row wrap">
      ${l.status === 'issued' ? html`<${Btn} icon="key" onClick=${newKey}>New key and link<//>` : null}
      ${l.status === 'active' ? html`<${Btn} icon="key" onClick=${ownerReset}>Owner password reset link<//>
        <${Btn} kind="danger" icon="pause" onClick=${() => status('suspended', `Suspend ${l.company_name}?`, 'Nobody at the company can sign in to it until you resume it. Nothing is deleted.')}>Suspend<//>` : null}
      ${l.status === 'suspended' ? html`<${Btn} icon="play" onClick=${() => status('active', `Resume ${l.company_name}?`, 'Everyone gets their access back right away.')}>Resume<//>` : null}
      <${Btn} kind="danger" icon="x" onClick=${() => status('revoked', `Revoke ${l.company_name}'s license?`, l.org_id ? 'The company loses access for good. Its data stays in the database. To bring them back you issue a new license.' : 'The key stops working for good.')}>Revoke<//>
    </div></div>` : html`<p class="dim">This license was revoked.</p>`}
  <//>`;
}

export function Platform() {
  const app = useApp();
  const { route } = app;
  useTick(60000);
  const over = useLoad(() => rpc('platform_overview'), [], { every: 60000 });
  const lic = useLoad(() => rpc('platform_license_list'), [], { every: 60000 });
  const [f, setF] = useState('all');
  const open = route.params[0] || null;
  const list = lic.data || [];
  const shown = list.filter((l) => f === 'all' || (f === 'active' ? licState(l)[0] === 'Active' : f === 'waiting' ? l.status === 'issued' : !['Active'].includes(licState(l)[0]) && l.status !== 'issued'));
  const cur = open && open !== 'new' ? list.find((l) => l.id === open) : null;
  const o = over.data;
  const refresh = () => { lic.reload(); over.reload(); };
  const T = (icon, label, v, sub) => html`<div class="tile" style="cursor:default"><div class="t-l"><${Icon} n=${icon} />${label}</div><div class="t-v">${v ?? '–'}</div><div class="t-s">${sub}</div></div>`;

  return html`<${Top} title="License desk" sub=${`Every company on ${BRAND}. You see licenses and counts — never a company's data.`}>
      <${Btn} kind="primary" icon="plus" onClick=${() => go('platform/new')}>Issue a license<//><//>
    <div class="page">
      <div class="ptiles">
        ${T('building', 'Companies', o?.companies, 'activated')}${T('check', 'Active', o?.active, 'licenses')}${T('send', 'Waiting', o?.waiting, 'to be activated')}
        ${T('users', 'People', o?.users, 'signed up')}${T('truck', 'Vehicles', o?.assets, `${o?.devices ?? 0} GPS units`)}${T('signal', 'Live now', o?.reporting, `${o?.positions_24h ?? 0} positions · 24 h`)}
      </div>
      <div class="toolbar"><${Seg} value=${f} onChange=${setF} options=${[{ v: 'all', label: 'All', n: list.length }, { v: 'active', label: 'Active', n: list.filter((l) => licState(l)[0] === 'Active').length },
        { v: 'waiting', label: 'Waiting', n: list.filter((l) => l.status === 'issued').length }, { v: 'other', label: 'Suspended & ended', n: list.filter((l) => licState(l)[0] !== 'Active' && l.status !== 'issued').length }]} /></div>
      <div class="card tablecard">
        ${!lic.data ? html`<div class="card-b"><${Skel} h=${160} /></div>`
          : !list.length ? html`<${Empty} icon="license" title="Issue your first license" text="Each company gets its own license and its own command center — a blank slate it fills in itself.">
              <${Btn} kind="primary" icon="plus" onClick=${() => go('platform/new')}>Issue a license<//><//>`
          : html`<table class="tbl"><thead><tr><th>Company</th><th>Status</th><th>Seats</th><th>Fleet</th><th>Modules</th><th>Last active</th><th>Issued</th></tr></thead>
            <tbody>${shown.map((l) => { const [s, t] = licState(l); return html`<tr class="click" key=${l.id} onClick=${() => go('platform/' + l.id)}>
              <td><div class="row"><${OrgBadge} org=${{ name: l.org_name || l.company_name }} /><div><div class="b">${l.org_name || l.company_name}</div>
                <div class="dim xs">${KINDS[l.company_kind] || ''}${l.owner ? ' · ' + l.owner.name : l.contact_name ? ' · ' + l.contact_name : ''}</div></div></div></td>
              <td><${Chip} tone=${t}>${s}<//></td><td>${l.org_id ? `${l.members + l.invites_open} / ${l.seats}` : l.seats}</td>
              <td>${l.org_id ? html`${plural(l.assets, 'vehicle')}<div class="dim xs">${l.reporting} live</div>` : '—'}</td>
              <td class="dim xs">${(l.modules || []).map((m) => MODULES[m]?.name || m).join(', ')}</td>
              <td class="dim">${l.last_seen ? ago(l.last_seen) : '—'}</td><td class="dim">${fmtDate(l.issued_at)}</td></tr>`; })}</tbody></table>
            <div class="cards">${shown.map((l) => { const [s, t] = licState(l); return html`<div class="li click" key=${l.id} onClick=${() => go('platform/' + l.id)}>
              <${OrgBadge} org=${{ name: l.org_name || l.company_name }} /><div class="grow"><div class="li-t">${l.org_name || l.company_name}</div>
              <div class="li-s">${l.org_id ? `${l.members} of ${l.seats} seats · ${plural(l.assets, 'vehicle')}` : `issued ${fmtDate(l.issued_at)}`}</div></div><${Chip} tone=${t}>${s}<//></div>`; })}</div>`}
      </div>
      <div class="home-grid">
        <div class="card"><div class="card-h"><h3 class="grow">Integration requests</h3>${o?.requests?.length ? html`<${Chip}>${o.requests.length}<//>` : null}</div>
          ${o?.requests?.length ? html`<div class="list" style="margin-top:6px">${o.requests.map((r, i) => html`<div class="li" key=${i}><div class="li-ic"><${Icon} n="plug" /></div>
            <div class="grow"><div class="li-t">${r.name || r.provider} · ${r.company}</div><div class="li-s">${ago(r.at)}${r.note ? ' · ' + r.note : ''}</div></div></div>`)}</div>`
            : html`<${Empty} cls="sm" icon="plug" text="What companies ask to connect shows up here — it tells you what to build next." />`}</div>
        <div class="card feed"><div class="card-h"><h3>Desk log</h3></div>
          ${o?.log?.length ? html`<div class="list" style="margin-top:6px">${o.log.slice(0, 12).map((x, i) => html`<div class="li" key=${i}><span class="act-ic violet"><${Icon} n="license" /></span>
            <div class="grow"><div class="f-t">${x.summary}</div><div class="f-s">${ago(x.at)}</div></div></div>`)}</div>`
            : html`<${Empty} cls="sm" icon="activity" text="Licenses you issue and change show up here." />`}</div>
      </div>
    </div>
    ${open === 'new' ? html`<${Issue} onClose=${() => go('platform')} onIssued=${refresh} />` : null}
    ${cur ? html`<${Manage} key=${cur.id + cur.status + cur.seats} l=${cur} onClose=${() => go('platform')} onChanged=${refresh} />` : null}`;
}
