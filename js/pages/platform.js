// License desk (platform admins only): issue a license → a key, an activation link, a QR and a ready message
// for the company's owner; then watch every company's usage (counts only — never their data), change seats,
// modules and dates, suspend, resume or revoke, and make a password reset link for the owner or any member
// (including someone in two companies, whom a company's own admin can't reset).
import { html, useState, Icon, OrgBadge, Btn, Chip, Empty, Drawer, Field, ErrorBox, Seg, Skel, Top, Qr, CopyLine, LoadError, useLoad, useTick, useForm } from '../ui.js';
import { useApp, go } from '../ctx.js';
import { rpc } from '../api.js';
import { BRAND, KINDS, MODULES, COMING, ROLES, ago, fmtDate, appLink, copy, mailLink, smsLink, firstName, plural, phoneFmt, poss } from '../util.js';
import { nameCheck, textCheck, emailCheck, phoneCheck } from '../check.js';
import { LicenseCard } from './auth.js';
import { ShareBox } from '../parts/invite.js';

export function licState(l) {
  if (l.status === 'revoked') return ['Revoked', 'red'];
  if (l.status === 'suspended') return ['Suspended', 'amber'];
  if (l.status === 'issued') return new Date(l.activate_by) < new Date() ? ['Link expired', 'amber'] : ['Waiting for activation', ''];
  if (l.expires_at && new Date(l.expires_at) < new Date()) return ['Expired', 'red'];
  return ['Active', 'green'];
}

// a key is shown only once: until "I sent it", it stays on this license's own address (Back or Reload bring it back)
const KEPT = (id) => 'mando.desk.key.' + id;
const keepKey = (id, v) => { try { sessionStorage.setItem(KEPT(id), JSON.stringify(v)); } catch { /* private mode */ } };
const keptKey = (id) => { try { return JSON.parse(sessionStorage.getItem(KEPT(id)) || 'null'); } catch { return null; } };
const dropKey = (id) => { try { sessionStorage.removeItem(KEPT(id)); } catch { /* private mode */ } };

function KeyResult({ lic, code, activateBy, toast, onDone }) {
  const link = appLink(`/activate/${code}`);
  const message = `Hi${lic.contact_name ? ' ' + firstName(lic.contact_name) : ''} — your ${BRAND} license for ${lic.company_name} is ready.\n\n`
    + `Open this link to create your account and set up ${poss(lic.company_name)} command center:\n${link}\n\n`
    + `Your license key: ${code}\nThe link works until ${fmtDate(activateBy)}.\n\n`
    + `What it costs, the terms and how your data is kept: ${appLink('/about')}\nQuestions? Just reply to this message.`;
  const copyMsg = async () => { const ok = await copy(message); toast(ok ? 'Invitation copied — paste it in an email or text' : 'Select it and copy it by hand', ok ? 'ok' : 'bad'); };
  return html`<div class="issued">
    <div class="okmsg" role="status"><${Icon} n="check" /><div><b>License issued.</b> The key is shown only until you press "I sent it" — send it first. If it gets lost before activation, make a new key from the license.</div></div>
    <${LicenseCard} lic=${lic} code=${code} notes=${false} />
    <div class="issued-top"><${Qr} text=${link} />
      <div class="col grow gap-12">
        <div class="keybig">${code}</div>
        <${CopyLine} value=${link} toast=${toast} label="Copy link" />
        <div class="row wrap"><${Btn} kind="primary" icon="copy" onClick=${copyMsg}>Copy invitation<//>
          <a class="btn" href=${mailLink(lic.contact_email, `Your ${BRAND} license for ${lic.company_name}`, message)}><${Icon} n="mail" />${lic.contact_email ? `Email it to ${lic.contact_email}` : 'Email it'}</a>
          <a class="btn" href=${smsLink(message, lic.contact_phone)}><${Icon} n="msg" />${lic.contact_phone ? `Text it to ${phoneFmt(lic.contact_phone)}` : 'Text it'}</a></div>
        <span class="dim xs">The link opens the activation page with the key filled in. Activate by ${fmtDate(activateBy)}.</span>
      </div></div>
    <div class="code pre">${message}</div>
    ${onDone ? html`<div class="form-foot"><span class="grow"></span><${Btn} onClick=${onDone}>I sent it<//></div>` : null}
  </div>`;
}

function Mods({ value, onChange }) {
  const flip = (k) => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]);
  return html`<div class="mods">
    ${Object.entries(MODULES).map(([k, m]) => html`<label key=${k} class=${'modc' + (value.includes(k) ? ' on' : '')}>
      <input type="checkbox" checked=${value.includes(k)} onChange=${() => flip(k)} /><div><b>${m.name}</b><span>${m.desc}</span></div></label>`)}
    ${Object.entries(COMING).map(([k, m]) => html`<div key=${k} class="modc off" aria-disabled="true"><input type="checkbox" disabled aria-label=${`${m.name} (coming)`} /><div><b>${m.name} <span class="chip ml-4">Coming</span></b><span>${m.desc}</span></div></div>`)}
  </div>`;
}

const seatsCheck = (v) => { const n = Number(String(v).trim()); return /^\d+$/.test(String(v).trim()) && n >= 1 && n <= 500 ? null : 'Seats: a whole number from 1 to 500.'; };
const PLANS = [{ v: 'pilot', label: 'Pilot' }, { v: 'standard', label: 'Standard' }, { v: 'enterprise', label: 'Enterprise' }];

function Issue({ onClose, onIssued }) {
  const app = useApp();
  const [f, setF] = useState({ company_name: '', company_kind: 'subcontractor', contact_name: '', contact_email: '', contact_phone: '', plan: 'pilot',
    seats: '10', term_months: '12', activate_days: '30', notes: '', modules: ['fleet', 'map', 'driver', 'api'] });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const chk = useForm(f, {
    company_name: (v) => nameCheck(v, { what: 'Company name', max: 80, empty: 'Type the company\'s name.' }),
    contact_name: (v) => nameCheck(v, { what: 'Owner\'s name', max: 80, required: false }), contact_email: (v) => emailCheck(v), contact_phone: phoneCheck,
    seats: seatsCheck, notes: (v) => textCheck(v, { what: 'Notes', max: 2000 }),
  }, { company_name: 'li-c', contact_name: 'li-n', contact_email: 'li-e', contact_phone: 'li-p', seats: 'li-s', notes: 'li-x' });
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); chk.edit(k, e.target.value); };
  const b = (k) => chk.blur(k);
  const issue = async (e) => {
    e.preventDefault();
    if (busy || !chk.ok()) return;
    setErr(null); setBusy(true);
    try {
      const p = { ...f, company_name: f.company_name.trim(), contact_name: f.contact_name.trim(), contact_email: f.contact_email.trim(), contact_phone: f.contact_phone.trim(),
        notes: f.notes.trim(), term_months: f.term_months === 'none' ? null : f.term_months };
      const r = await rpc('platform_license_issue', { p });
      keepKey(r.id, { code: r.code, activate_by: r.activate_by, lic: { ...p, seats: Number(f.seats), term_months: f.term_months === 'none' ? null : Number(f.term_months) } });
      onIssued();
      go('platform/' + r.id, { replace: true });               // the key now lives on the license's own address
    } catch (x) { setErr(x); setBusy(false); }
  };
  return html`<${Drawer} title="Issue a license" sub="One license per company. The owner activates it and builds their own command center." icon="license" onClose=${onClose} wide>
    <form class="form" onSubmit=${issue} id="issueform" novalidate>
      <div class="grid2">
        <${Field} label="Company" id="li-c" cls="span2" error=${chk.errs.company_name}><input id="li-c" class="inp" value=${f.company_name} onInput=${set('company_name')} onBlur=${b('company_name')}
          autocomplete="off" placeholder="Their company's name" /><//>
        <${Field} label="What they do" id="li-k"><select id="li-k" class="sel" value=${f.company_kind} onChange=${set('company_kind')}>
          ${Object.entries(KINDS).map(([k, v]) => html`<option value=${k}>${v}</option>`)}</select><//>
        <${Field} label="Plan"><${Seg} label="Plan" value=${f.plan} onChange=${(v) => setF({ ...f, plan: v })} options=${PLANS} /><//>
        <${Field} label="Owner's name" id="li-n" error=${chk.errs.contact_name}><input id="li-n" class="inp" value=${f.contact_name} onInput=${set('contact_name')} onBlur=${b('contact_name')} autocomplete="off" placeholder="Who activates it" /><//>
        <${Field} label="Owner's email" id="li-e" help="Filled in for them on the activation page." error=${chk.errs.contact_email}><input id="li-e" class="inp" type="email" value=${f.contact_email} onInput=${set('contact_email')} onBlur=${b('contact_email')} autocomplete="off" /><//>
        <${Field} label="Owner's mobile" id="li-p" help="Text it fills in this number." error=${chk.errs.contact_phone}><input id="li-p" class="inp" type="tel" value=${f.contact_phone} onInput=${set('contact_phone')} onBlur=${b('contact_phone')} autocomplete="off" /><//>
        <${Field} label="Seats" id="li-s" help="People who can sign in (invitations count)." error=${chk.errs.seats}><input id="li-s" class="inp" type="number" min="1" max="500" value=${f.seats} onInput=${set('seats')} onBlur=${b('seats')} /><//>
        <${Field} label="Term" id="li-t" help="Counts from the day they activate."><select id="li-t" class="sel" value=${f.term_months} onChange=${set('term_months')}>
          ${[['3', '3 months'], ['6', '6 months'], ['12', '12 months'], ['24', '24 months'], ['36', '36 months'], ['none', 'No end date']].map(([v, l]) => html`<option value=${v}>${l}</option>`)}</select><//>
        <${Field} label="Activation link works for" id="li-a"><select id="li-a" class="sel" value=${f.activate_days} onChange=${set('activate_days')}>
          ${[['7', '7 days'], ['14', '14 days'], ['30', '30 days'], ['60', '60 days'], ['90', '90 days']].map(([v, l]) => html`<option value=${v}>${l}</option>`)}</select><//>
      </div>
      <fieldset class="field"><legend>Modules</legend><${Mods} value=${f.modules} onChange=${(m) => setF({ ...f, modules: m })} /></fieldset>
      <${Field} label="Notes (only you see these)" id="li-x" error=${chk.errs.notes}><textarea id="li-x" class="txt" value=${f.notes} onInput=${set('notes')} onBlur=${b('notes')} placeholder="Deal terms, who referred them…"></textarea><//>
      <${ErrorBox} error=${err} />
      <p class="dim sm">They get a key, an activation link and a QR. Nothing about any other company is in it.</p>
      <div class="form-foot"><span class="grow"></span><${Btn} onClick=${onClose}>Cancel<//><${Btn} kind="primary" type="submit" icon="license" busy=${busy}>Issue license<//></div>
    </form>
  <//>`;
}

// a reset link made at the desk: for the owner, or for any member (someone in two companies included)
function ResetShare({ reset, company, onClose, toast }) {
  const link = appLink(`/reset/${reset.token}`);
  return html`<${Drawer} title=${`Password reset for ${reset.full_name}`} sub=${company} onClose=${onClose} icon="key">
    <${ShareBox} link=${link} subject=${`Set a new password · ${BRAND}`} email=${reset.email} phone=${reset.phone} toast=${toast} note="Works once, within 24 hours · shown only now"
      message=${`Here's your link to set a new password for ${BRAND}:\n${link}\n\nIt works once, within 24 hours.`} /><//>`;
}

function People({ l, onReset }) {
  const app = useApp();
  // p004 adds the member list; before it runs, the desk can still make the owner's link
  const people = useLoad(() => rpc('platform_license_members', { p_license: l.id }), [l.id]);
  const [busy, setBusy] = useState(null);
  const make = async (fn, who) => {
    setBusy(who);
    try { onReset(await fn()); } catch (x) { app.toast(x.message, 'bad'); }
    setBusy(null);
  };
  const owner = () => make(() => rpc('platform_owner_reset_link', { p_license: l.id }), 'owner');
  if (people.failed || (people.data && !Array.isArray(people.data))) {
    return html`<div class="row wrap"><${Btn} icon="key" busy=${busy === 'owner'} onClick=${owner}>Owner password reset link<//></div>`;
  }
  if (!people.data) return html`<${Skel} h=${60} />`;
  return html`<div class="card"><div class="list">${people.data.map((m) => html`<div class="li" key=${m.user_id}>
      <div class="grow"><div class="li-t">${m.full_name}</div>
        <div class="li-s">${ROLES[m.role]?.name || m.role}${m.status === 'active' ? '' : ' · access off'}${m.email ? ' · ' + m.email : ''}${m.other_companies ? ` · also in ${plural(m.other_companies, 'other company', 'other companies')}` : ''}</div></div>
      <${Btn} size="sm" kind="ghost" icon="key" busy=${busy === m.user_id} disabled=${!!busy} aria-label=${`Make a password reset link for ${m.full_name}`}
        onClick=${() => make(() => rpc('platform_member_reset_link', { p_license: l.id, p_user: m.user_id }), m.user_id)}>Reset link<//></div>`)}</div></div>`;
}

// the end date as a calendar day on this computer (not the UTC day: 23:59 in Texas is already tomorrow in UTC)
const localDay = (ts) => { if (!ts) return ''; const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

function Manage({ l, onClose, onChanged }) {
  const app = useApp();
  const [st, tone] = licState(l);
  const exp0 = localDay(l.expires_at);
  const [seats, setSeats] = useState(String(l.seats));
  const [mods, setMods] = useState(l.modules || []);
  const [plan, setPlan] = useState(l.plan);
  const [exp, setExp] = useState(exp0);
  const [notes, setNotes] = useState(l.notes || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [rekey, setRekey] = useState(() => keptKey(l.id));
  const [reset, setReset] = useState(null);
  const chk = useForm({ seats, notes }, { seats: seatsCheck, notes: (v) => textCheck(v, { what: 'Notes', max: 2000 }) }, { seats: 'm-s', notes: 'm-n' });
  const save = async (e) => {
    if (e) e.preventDefault();
    if (busy || !chk.ok()) return;
    setErr(null); setBusy(true);
    try {
      // the end date goes only when it was changed here (an unchanged date is never sent back), as the plain day:
      // the database (p004) makes it 23:59:59 that day in the company's own time zone
      const p = { seats: seats.trim(), modules: mods, plan, notes: notes.trim() };
      if (l.org_id && exp !== exp0) p.expires_at = exp || '';
      await rpc('platform_license_update', { p_license: l.id, p });
      app.toast(`${poss(l.company_name)} license is saved`); onChanged();
    } catch (x) { setErr(x); }
    setBusy(false);
  };
  const status = async (s, title, text, done) => {
    const ok = await app.confirm({ title, text, ok: title.split(' ')[0], danger: s !== 'active',
      action: () => rpc('platform_license_set_status', { p_license: l.id, p_status: s }) });
    if (ok) { app.toast(done); onChanged(); }
  };
  const newKey = async () => {
    let r = null;
    const ok = await app.confirm({ title: 'Make a new key?', text: 'The old key and link stop working.', ok: 'New key',
      action: async () => { r = await rpc('platform_license_rekey', { p_license: l.id }); } });
    if (ok && r) {
      const kept = { code: r.code, activate_by: r.activate_by, lic: l };
      keepKey(l.id, kept); setRekey(kept); onChanged();
    }
  };
  if (rekey) {
    const sent = () => { dropKey(l.id); setRekey(null); };
    return html`<${Drawer} title=${`Key for ${rekey.lic?.company_name || l.company_name}`} sub="Send it to the owner." onClose=${onClose} wide icon="key">
      <${KeyResult} lic=${{ ...l, ...(rekey.lic || {}) }} code=${rekey.code} activateBy=${rekey.activate_by} toast=${app.toast} onDone=${sent} /><//>`;
  }
  if (reset) return html`<${ResetShare} reset=${reset} company=${l.org_name || l.company_name} toast=${app.toast} onClose=${() => setReset(null)} />`;
  return html`<${Drawer} title=${l.company_name} sub=${`${KINDS[l.company_kind] || ''} · key …${l.code_hint}`} onClose=${onClose} wide
      head=${html`<${OrgBadge} org=${{ name: l.org_name || l.company_name }} />`}>
    <div class="row wrap"><${Chip} tone=${tone}>${st}<//><${Chip}>${(l.plan || '').replace(/^./, (c) => c.toUpperCase())} plan<//>
      ${l.last_seen ? html`<${Chip} icon="clock">active ${ago(l.last_seen)}<//>` : null}</div>
    ${l.org_id ? html`<div class="tiles three">
      <div class="tile static"><div class="t-l">People</div><div class="t-v">${l.members}<small>/ ${l.seats}</small></div><div class="t-s">${plural(l.invites_open, 'invitation')} open</div></div>
      <div class="tile static"><div class="t-l">Vehicles</div><div class="t-v">${l.assets}</div><div class="t-s">${l.devices} GPS · ${l.reporting} live</div></div>
      <div class="tile static"><div class="t-l">Connections</div><div class="t-v">${l.integrations}</div><div class="t-s">GPS providers working</div></div></div>` : null}
    <div class="section"><h4>License</h4><dl class="kv">
      <dt>Owner</dt><dd>${l.owner ? `${l.owner.name} · ${l.owner.email || ''}` : `${l.contact_name || '—'}${l.contact_email ? ' · ' + l.contact_email : ''} (not activated)`}</dd>
      <dt>Issued</dt><dd>${fmtDate(l.issued_at)}</dd>
      ${l.org_id ? html`<dt>Activated</dt><dd>${fmtDate(l.activated_at)}</dd>` : html`<dt>Activate by</dt><dd>${fmtDate(l.activate_by)}</dd>`}
      <dt>Ends</dt><dd>${l.expires_at ? fmtDate(l.expires_at) : l.org_id ? 'No end date' : l.term_months ? `${l.term_months} months after activation` : 'No end date'}</dd>
      ${l.contact_phone ? html`<dt>Mobile</dt><dd>${phoneFmt(l.contact_phone)}</dd>` : null}</dl></div>
    ${l.status !== 'revoked' ? html`<form class="section" onSubmit=${save} novalidate><h4>Change</h4>
      <div class="grid2">
        <${Field} label="Seats" id="m-s" error=${chk.errs.seats}><input id="m-s" class="inp" type="number" min="1" max="500" value=${seats}
          onInput=${(e) => { setSeats(e.target.value); chk.edit('seats', e.target.value); }} onBlur=${chk.blur('seats')} /><//>
        <${Field} label="Plan"><${Seg} label="Plan" value=${plan} onChange=${setPlan} options=${PLANS} /><//>
        ${l.org_id ? html`<${Field} label="Ends on" id="m-e" help="Empty = no end date."><input id="m-e" class="inp" type="date" value=${exp} onInput=${(e) => setExp(e.target.value)} /><//>` : null}
      </div>
      <fieldset class="field"><legend>Modules</legend><${Mods} value=${mods} onChange=${setMods} /></fieldset>
      <${Field} label="Notes" id="m-n" error=${chk.errs.notes}><textarea id="m-n" class="txt" value=${notes} onInput=${(e) => { setNotes(e.target.value); chk.edit('notes', e.target.value); }} onBlur=${chk.blur('notes')}></textarea><//>
      <${ErrorBox} error=${err} />
      <div class="form-foot"><span class="grow"></span><${Btn} kind="primary" type="submit" busy=${busy}>Save changes<//></div></form>
    ${l.org_id && l.status === 'active' ? html`<div class="section"><h4>People and passwords</h4>
      <p class="dim sm">A reset link for anyone at ${l.org_name || l.company_name} — also for people in more than one company, whom the company's own admins can't reset.</p>
      <${People} l=${l} onReset=${setReset} /></div>` : null}
    <div class="section"><h4>Actions</h4><div class="row wrap">
      ${l.status === 'issued' ? html`<${Btn} icon="key" onClick=${newKey}>New key and link<//>` : null}
      ${l.status === 'active' ? html`<${Btn} kind="danger" icon="pause" onClick=${() => status('suspended', `Suspend ${l.company_name}?`, 'Nobody at the company can sign in to it until you resume it. Nothing is deleted.', `${l.company_name} is suspended`)}>Suspend<//>` : null}
      ${l.status === 'suspended' ? html`<${Btn} icon="play" onClick=${() => status('active', `Resume ${l.company_name}?`, 'Everyone gets their access back right away.', `${l.company_name} is active again`)}>Resume<//>` : null}
      <${Btn} kind="danger" icon="x" onClick=${() => status('revoked', `Revoke ${poss(l.company_name)} license?`, l.org_id ? 'The company loses access for good. Its data stays in the database. To bring them back you issue a new license.' : 'The key stops working for good.', `${poss(l.company_name)} license is revoked`)}>Revoke<//>
    </div></div>` : html`<p class="dim">This license was revoked.</p>`}
  <//>`;
}

function GoneLicense({ onClose }) {
  return html`<${Drawer} title="License not found" icon="license" onClose=${onClose}>
    <${Empty} icon="license" title="This license isn't on the desk" text="The link may be old, or the license list hasn't loaded. Every license is in the list.">
      <${Btn} onClick=${onClose}>Back to the desk<//><//><//>`;
}

const ALL = Object.keys(MODULES);
const modsText = (m) => (ALL.every((k) => (m || []).includes(k)) ? `All ${ALL.length}` : (m || []).map((x) => MODULES[x]?.name || x).join(', ') || 'None');

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
  const kept = open && open !== 'new' && !cur ? keptKey(open) : null;      // just issued: the list may not have it yet
  const gone = open && open !== 'new' && lic.data && !cur && !kept;
  const o = over.data;
  const refresh = () => { lic.reload(); over.reload(); };
  const c = (fn) => (lic.data ? list.filter(fn).length : null);
  const T = (icon, label, v, sub) => html`<div class="tile static"><div class="t-l"><${Icon} n=${icon} />${label}</div><div class="t-v">${v ?? '–'}</div><div class="t-s">${o ? sub : ' '}</div></div>`;

  return html`<${Top} title="License desk" sub=${`Every company on ${BRAND}. You see licenses and counts — never a company's data.`}>
      ${lic.data && !list.length ? null : html`<${Btn} kind="primary" icon="plus" onClick=${() => go('platform/new')}>Issue a license<//>`}<//>
    <div class="page">
      ${over.failed ? html`<${LoadError} cls="card" what="the desk's numbers" error=${over.error} retry=${over.retry} />` : null}
      <div class="ptiles">
        ${T('building', 'Companies', o?.companies, 'activated')}${T('check', 'Active', o?.active, 'licenses')}${T('send', 'Waiting', o?.waiting, 'to be activated')}
        ${T('users', 'People', o?.users, 'signed up')}${T('truck', 'Vehicles', o?.assets, `${o?.devices ?? 0} GPS units`)}${T('signal', 'Live now', o?.reporting, `${o?.positions_24h ?? 0} positions · 24 h`)}
      </div>
      <div class="toolbar"><${Seg} label="Show" value=${f} onChange=${setF} options=${[{ v: 'all', label: 'All', n: c(() => true) }, { v: 'active', label: 'Active', n: c((l) => licState(l)[0] === 'Active') },
        { v: 'waiting', label: 'Waiting', n: c((l) => l.status === 'issued') }, { v: 'other', label: 'Suspended & ended', n: c((l) => licState(l)[0] !== 'Active' && l.status !== 'issued') }]} /></div>
      <div class="card tablecard">
        ${lic.failed ? html`<div class="card-b"><${LoadError} what="the licenses" error=${lic.error} retry=${lic.retry} /></div>`
          : !lic.data ? html`<div class="card-b"><${Skel} h=${160} /></div>`
          : !list.length ? html`<${Empty} icon="license" title="Issue your first license" text="Each company gets its own license and its own command center — a blank slate it fills in itself.">
              <${Btn} kind="primary" icon="plus" onClick=${() => go('platform/new')}>Issue a license<//><//>`
          : html`<table class="tbl"><thead><tr><th>Company</th><th>Status</th><th>Seats</th><th>Fleet</th><th>Modules</th><th>Last active</th><th>Issued</th></tr></thead>
            <tbody>${shown.map((l) => { const [s, t] = licState(l); return html`<tr class="click" key=${l.id} onClick=${(e) => { if (!e.target.closest('a')) go('platform/' + l.id); }}>
              <td><div class="row"><${OrgBadge} org=${{ name: l.org_name || l.company_name }} /><div><a class="b rowlink" href=${'#/platform/' + l.id}>${l.org_name || l.company_name}</a>
                <div class="dim xs">${KINDS[l.company_kind] || ''}${l.owner ? ' · ' + l.owner.name : l.contact_name ? ' · ' + l.contact_name : ''}</div></div></div></td>
              <td><${Chip} tone=${t}>${s}<//></td><td>${l.org_id ? `${l.members + l.invites_open} / ${l.seats}` : l.seats}</td>
              <td>${l.org_id ? html`${plural(l.assets, 'vehicle')}<div class="dim xs">${l.reporting} live</div>` : '—'}</td>
              <td class="dim xs">${modsText(l.modules)}</td>
              <td class="dim">${l.last_seen ? ago(l.last_seen) : '—'}</td><td class="dim">${fmtDate(l.issued_at)}</td></tr>`; })}</tbody></table>
            <div class="cards">${shown.map((l) => { const [s, t] = licState(l); return html`<a class="li click" key=${l.id} href=${'#/platform/' + l.id}>
              <${OrgBadge} org=${{ name: l.org_name || l.company_name }} /><div class="grow"><div class="li-t">${l.org_name || l.company_name}</div>
              <div class="li-s">${l.org_id ? `${l.members} of ${l.seats} seats · ${plural(l.assets, 'vehicle')}` : `issued ${fmtDate(l.issued_at)}`}</div></div><${Chip} tone=${t}>${s}<//></a>`; })}</div>
            ${!shown.length ? html`<${Empty} cls="sm" icon="license" title="No license in this group" text="Pick another group to see the rest.">
                <${Btn} size="sm" onClick=${() => setF('all')}>Show all licenses<//><//>` : null}`}
      </div>
      <div class="home-grid">
        <div class="card"><div class="card-h"><h3 class="grow">Integration requests</h3>${o?.requests?.length ? html`<${Chip}>${o.requests.length}<//>` : null}</div>
          ${!o ? html`<div class="card-b"><${Skel} h=${80} /></div>`
            : o.requests?.length ? html`<div class="list mt-8">${o.requests.map((r, i) => html`<div class="li" key=${i}><div class="li-ic"><${Icon} n="plug" /></div>
            <div class="grow"><div class="li-t">${r.name || r.provider} · ${r.company}</div><div class="li-s">${ago(r.at)}${r.note ? ' · ' + r.note : ''}</div></div></div>`)}</div>`
            : html`<${Empty} cls="sm" icon="plug" title="No requests yet" text="What companies ask to connect shows up here — it tells you what to build next." />`}</div>
        <div class="card feed"><div class="card-h"><h3>Desk log</h3></div>
          ${!o ? html`<div class="card-b"><${Skel} h=${120} /></div>`
            : o.log?.length ? html`<div class="list mt-8">${o.log.slice(0, 12).map((x, i) => html`<div class="li" key=${i}><span class="act-ic"><${Icon} n="license" /></span>
            <div class="grow"><div class="f-t">${x.summary}</div><div class="f-s">${ago(x.at)}</div></div></div>`)}</div>`
            : html`<${Empty} cls="sm" icon="activity" title="Nothing yet" text="Licenses you issue and change show up here." />`}</div>
      </div>
    </div>
    ${open === 'new' ? html`<${Issue} onClose=${() => go('platform')} onIssued=${refresh} />` : null}
    ${cur ? html`<${Manage} key=${cur.id + cur.status + cur.seats} l=${cur} onClose=${() => go('platform')} onChanged=${refresh} />` : null}
    ${kept ? html`<${Drawer} title=${`License for ${kept.lic?.company_name || ''}`} sub="Send it to the owner." icon="license" onClose=${() => go('platform')} wide>
      <${KeyResult} lic=${kept.lic || {}} code=${kept.code} activateBy=${kept.activate_by} toast=${app.toast} onDone=${() => { dropKey(open); go('platform'); }} /><//>` : null}
    ${gone ? html`<${GoneLicense} onClose=${() => go('platform')} />` : null}`;
}
