// Settings: the company profile and branding (owners/admins), a copy of the company's data (CSV, owners/admins),
// your own account, and the license (what happens when it ends, who to write to).
import { html, useState, Icon, Mark, Btn, Chip, Field, Password, ErrorBox, Skel, Top, LoadError, useLoad, useForm } from '../ui.js';
import { useApp, go } from '../ctx.js';
import { rpc, select, changePassword, signOut } from '../api.js';
import { loadOrg, loadMembers } from '../data.js';
import { BRAND, C, KINDS, MODULES, COMING, ROLES, can, fmtDate, askWho } from '../util.js';
import { nameCheck, textCheck, phoneCheck, passwordCheck } from '../check.js';
import { CompanyForm } from '../parts/company.js';

// ---------- a copy of the company's data: one CSV file per table, read through the same rules as every screen ----------
const cell = (v) => {
  let s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;   // never run as a formula (plain negative numbers stay numbers)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
function toCsv(rows) {
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((c) => c !== 'org_id');
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n');
}
async function readAll(table, query) {                                // 1,000 rows at a time until the end
  const out = [];
  for (let from = 0; ; from += 1000) {
    const page = await select(table, `${query}&limit=1000&offset=${from}`);
    out.push(...page);
    if (page.length < 1000 || out.length >= 200000) return out;
  }
}
function save(name, text) {
  const url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
// GPS positions are kept 180 days: the last 7 days, or any of the last 7 calendar months, one file each (a month of
// a big fleet is a big file — one at a time keeps it something a browser can build)
const MONTHS = () => [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); d.setMonth(d.getMonth() - i); return d; });
function DataCopy({ org }) {
  const app = useApp();
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState(null);
  const [span, setSpan] = useState('7d');
  const FILES = [
    ['vehicles', 'Vehicles', () => readAll('assets', `select=*&org_id=eq.${org.id}&order=unit_no.asc`)],
    ['people', 'People', () => readAll('org_members', `select=*&org_id=eq.${org.id}&order=full_name.asc`)],
    ['gps-units', 'GPS units', () => readAll('devices', `select=*&org_id=eq.${org.id}&order=name.asc`)],
    ['activity', 'Activity log', () => readAll('audit_log', `select=*&org_id=eq.${org.id}&order=at.desc`)],
  ];
  const positions = () => {
    let from, to;
    if (span === '7d') { from = new Date(Date.now() - 7 * 86400000); to = new Date(Date.now() + 60000); }
    else { from = new Date(span + '-01T00:00:00'); to = new Date(from); to.setMonth(to.getMonth() + 1); }
    return readAll('positions', `select=*&org_id=eq.${org.id}&at=gte.${encodeURIComponent(from.toISOString())}&at=lt.${encodeURIComponent(to.toISOString())}&order=at.asc`);
  };
  const get = async (key, load, label, name = key) => {
    if (busy) return;
    setErr(null); setBusy(key);
    try {
      const rows = await load();
      save(`${org.name.replace(/[^\w -]+/g, '').trim() || 'company'} - ${name} - ${new Date().toISOString().slice(0, 10)}.csv`, rows.length ? toCsv(rows) : 'no rows');
      app.toast(`${label}: ${rows.length.toLocaleString('en-US')} row${rows.length === 1 ? '' : 's'} saved to your downloads`);
    } catch (x) { setErr(x); }
    setBusy('');
  };
  return html`<div class="card"><div class="card-h"><h3>Download your data</h3></div><div class="card-b col gap-12">
    <p class="dim sm">A copy of everything ${org.name} keeps in ${BRAND},
      as spreadsheet files (CSV) that open in Excel or Google Sheets. <a href="#/about/keeping">Keeping and deleting</a></p>
    <div class="row wrap">${FILES.map(([key, label, load]) => html`<${Btn} key=${key} size="sm" icon="download" busy=${busy === key} disabled=${!!busy && busy !== key} onClick=${() => get(key, load, label)}>${label}<//>`)}</div>
    <div class="row wrap"><select class="sel narrow" aria-label="Which GPS positions" value=${span} onChange=${(e) => setSpan(e.target.value)}>
        <option value="7d">GPS positions · last 7 days</option>
        ${MONTHS().map((m) => { const v = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`; return html`<option key=${v} value=${v}>GPS positions · ${fmtDate(m, null, { month: 'long', year: 'numeric' })}</option>`; })}
      </select><${Btn} size="sm" icon="download" busy=${busy === 'positions'} disabled=${!!busy && busy !== 'positions'}
        onClick=${() => get('positions', positions, 'GPS positions', span === '7d' ? 'gps-positions-last-7-days' : `gps-positions-${span}`)}>Download<//></div>
    <span class="dim xs">GPS positions are kept 180 days, so the oldest month may be partly gone.</span>
    <${ErrorBox} error=${err} /></div></div>`;
}

function Account({ org, me }) {
  const app = useApp();
  const members = useLoad(() => loadMembers(org.id), [org.id]);
  const mine = (members.data || []).find((m) => m.user_id === me.user.id);
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwErr, setPwErr] = useState(null);
  const v = f || { full_name: mine?.full_name || '', phone: mine?.phone || '', title: mine?.title || '' };
  const chk = useForm(v, { full_name: (x) => nameCheck(x, { what: 'Your name', empty: 'Type your name.' }), phone: phoneCheck, title: (x) => textCheck(x, { what: 'Title', max: 60 }) },
    { full_name: 'me-n', phone: 'me-p', title: 'me-t' });
  const pchk = useForm({ pw, pw2 }, { pw: passwordCheck, pw2: (x, all) => (x !== all.pw ? 'The two passwords don\'t match. Type the new one again.' : null) }, { pw: 'pw1', pw2: 'pw2' });
  const put = (k) => (e) => { setF({ ...v, [k]: e.target.value }); chk.edit(k, e.target.value); };
  const saveMe = async (e) => {
    e.preventDefault();
    if (busy || !chk.ok()) return;
    setErr(null); setBusy(true);
    try {
      await rpc('member_update', { p_org: org.id, p_user: me.user.id, p: { full_name: v.full_name.trim(), phone: v.phone.trim(), title: v.title.trim() } });
      app.toast('Your details are saved'); app.loadMe(); members.reload(); setF(null);
    } catch (x) { setErr(x); }
    setBusy(false);
  };
  const savePw = async (e) => {
    e.preventDefault();
    if (pwBusy || !pchk.ok()) return;
    setPwErr(null); setPwBusy(true);
    try { await changePassword(pw); setPw(''); setPw2(''); app.toast('Password changed. Use the new one next time you sign in.'); }
    catch (x) { setPwErr(x); }
    setPwBusy(false);
  };
  if (members.failed) return html`<${LoadError} cls="card" what="your account" error=${members.error} retry=${members.retry} />`;
  if (!members.data) return html`<${Skel} h=${200} />`;
  return html`<div class="col gap-20">
    <div class="card"><div class="card-h"><h3>You</h3></div><div class="card-b"><form class="form" onSubmit=${saveMe} novalidate>
      <div class="grid2">
        <${Field} label="Name" id="me-n" error=${chk.errs.full_name}><input id="me-n" class="inp" value=${v.full_name} onInput=${put('full_name')} onBlur=${chk.blur('full_name')} autocomplete="name" /><//>
        <${Field} label="Email" id="me-e" help="You sign in with this."><input id="me-e" class="inp" value=${me.user.email} disabled /><//>
        <${Field} label="Mobile" id="me-p" error=${chk.errs.phone}><input id="me-p" class="inp" type="tel" value=${v.phone} onInput=${put('phone')} onBlur=${chk.blur('phone')} autocomplete="tel" /><//>
        <${Field} label="Title" id="me-t" error=${chk.errs.title}><input id="me-t" class="inp" value=${v.title} onInput=${put('title')} onBlur=${chk.blur('title')} placeholder="Dispatcher, Owner…" /><//>
      </div>
      <div class="dim sm">Your role at ${org.name}: <b>${ROLES[org.role]?.name}</b> — ${ROLES[org.role]?.desc}</div>
      <${ErrorBox} error=${err} />
      <div class="form-foot"><span class="grow"></span>${!f ? html`<span class="dim xs">Change something to save it.</span>` : null}
        <${Btn} kind="primary" type="submit" busy=${busy} disabled=${!f}>Save<//></div>
    </form></div></div>
    <div class="card"><div class="card-h"><h3>Password</h3></div><div class="card-b"><form class="form" onSubmit=${savePw} novalidate>
      <div class="grid2">
        <${Field} label="New password (at least 10 characters)" id="pw1" error=${pchk.errs.pw}><${Password} id="pw1" value=${pw} err=${!!pchk.errs.pw}
          onInput=${(x) => { setPw(x); pchk.edit('pw', x); }} meter /><//>
        <${Field} label="The new password again" id="pw2" error=${pchk.errs.pw2}><${Password} id="pw2" value=${pw2} onInput=${(x) => { setPw2(x); pchk.edit('pw2', x); }} /><//>
      </div>
      <${ErrorBox} error=${pwErr} />
      <div class="form-foot"><span class="grow"></span><${Btn} type="submit" busy=${pwBusy}>Change password<//></div>
    </form></div></div>
    <div class="card pad row"><div class="grow"><b>Sign out</b><div class="dim sm">On this device.</div></div><${Btn} icon="logout" onClick=${() => signOut()}>Sign out<//></div>
  </div>`;
}

function License({ org }) {
  const l = org.license || {};
  const seats = l.seats || 0;
  const used = org.seats_used || 0;
  return html`<div class="col gap-20">
    <div class="lic"><div class="l-top"><${Mark} cls="lg" />
      <div class="grow"><div class="l-name">${BRAND} · ${(l.plan || '').replace(/^./, (c) => c.toUpperCase())} plan</div>
        <div class="l-sub">Licensed to ${org.name} · ${KINDS[org.kind] || ''}</div></div>
      <${Chip} tone=${l.status === 'active' ? 'green' : 'amber'}>${l.status === 'active' ? 'Active' : l.status}<//></div>
      <div class="l-chips">${Object.entries(MODULES).map(([k, m]) => html`<${Chip} key=${k} tone=${(l.modules || []).includes(k) ? 'accent' : 'out'}
        icon=${(l.modules || []).includes(k) ? 'check' : 'lock'}>${m.name}${(l.modules || []).includes(k) ? '' : html`<span class="sr"> (not in your license)</span>`}<//>`)}</div>
      <div class="l-key"><span>License key</span><b>…${l.hint || '????'}</b></div></div>
    <div class="card"><div class="card-b"><dl class="kv">
      <dt>Seats</dt><dd><div class="row wrap"><span>${used} of ${seats} in use</span><div class="meter narrow" role="img" aria-label=${`${used} of ${seats} seats in use`}><i style=${`width:${Math.min(100, (used / Math.max(1, seats)) * 100)}%`}></i></div></div>
        <div class="dim xs mt-4">Each person, and each invitation not used yet, uses one.</div></dd>
      <dt>Activated</dt><dd>${l.activated_at ? fmtDate(l.activated_at, org.timezone) : '—'}</dd>
      <dt>Valid until</dt><dd>${l.expires_at ? fmtDate(l.expires_at, org.timezone) : 'No end date'}</dd>
      ${l.expires_at ? html`<dt>After that</dt><dd>The command center locks until the license is renewed. Nothing is deleted.</dd>` : null}
      <dt>Included</dt><dd>Team, Connections, Activity and Settings come with every license.</dd>
      <dt>Coming next</dt><dd>${Object.values(COMING).map((x) => x.name).join(' · ')}</dd>
      <dt>More</dt><dd><a href="#/about">What it costs, the terms and your data</a></dd>
    </dl></div>
    <div class="card-f"><span class="dim sm grow">Need more seats or another module? Write to ${askWho()}.</span>
      ${C.SUPPORT_EMAIL ? html`<a class="btn sm" href=${`mailto:${C.SUPPORT_EMAIL}?subject=${encodeURIComponent(`License · ${org.name}`)}`}><${Icon} n="mail" />Contact us</a>` : null}</div></div>
  </div>`;
}

export function Settings() {
  const app = useApp();
  const { org, me, route, toast } = app;
  const admin = can(org.role, 'settings');
  const tab = ['company', 'account', 'license'].includes(route.params[0]) ? route.params[0] : admin ? 'company' : 'account';
  const full = useLoad(() => (admin ? loadOrg(org.id) : Promise.resolve(null)), [org.id, admin]);
  const tabs = [admin && ['company', 'Company'], ['account', 'My account'], ['license', 'License']].filter(Boolean);
  return html`<${Top} title="Settings" sub=${org.name} />
    <div class="page">
      <nav class="tabs" aria-label="Settings sections">${tabs.map(([k, l]) => html`<button type="button" key=${k} class=${tab === k ? 'on' : ''}
        aria-current=${tab === k ? 'page' : null} onClick=${() => go('settings/' + k)}>${l}</button>`)}</nav>
      ${tab === 'company' && admin ? html`<div class="card"><div class="card-b">${full.failed
        ? html`<${LoadError} what="your company" error=${full.error} retry=${full.retry} />`
        : full.data ? html`<${CompanyForm} key=${full.data.id} org=${full.data} toast=${toast} onSaved=${(saved, o) => { app.loadMe(); if (!o.logoOnly) { toast('Company saved'); full.reload(); } }} />`
        : html`<${Skel} h=${300} />`}</div></div>` : null}
      ${tab === 'company' && admin ? html`<${DataCopy} org=${org} />` : null}
      ${tab === 'account' ? html`<${Account} org=${org} me=${me} />` : null}
      ${tab === 'license' ? html`<${License} org=${org} />` : null}
    </div>`;
}
