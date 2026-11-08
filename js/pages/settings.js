// Settings: the company profile and branding (owners/admins), a copy of the company's data (CSV, owners/admins),
// your own account, and the license (what happens when it ends, who to write to).
import { html, useState, Icon, Btn, Chip, Field, Password, ErrorBox, Skel, Top, useLoad } from '../ui.js';
import { useApp, go } from '../ctx.js';
import { rpc, select, changePassword, signOut } from '../api.js';
import { loadOrg, loadMembers } from '../data.js';
import { BRAND, C, KINDS, MODULES, COMING, ROLES, can, fmtDate, askWho } from '../util.js';
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
  const get = async (key, load, name = key) => {
    setErr(null); setBusy(key);
    try {
      const rows = await load();
      save(`${org.name.replace(/[^\w -]+/g, '').trim() || 'company'} - ${name} - ${new Date().toISOString().slice(0, 10)}.csv`, rows.length ? toCsv(rows) : 'no rows');
    } catch (x) { setErr(x); }
    setBusy('');
  };
  return html`<div class="card"><div class="card-h"><h3>Download your data</h3></div><div class="card-b col" style="gap:12px">
    <p class="dim sm">A copy of everything ${org.name} keeps in ${BRAND},
      as spreadsheet files (CSV) that open in Excel or Google Sheets. <a href="#/about/keeping">Keeping and deleting</a></p>
    <div class="row wrap">${FILES.map(([key, label, load]) => html`<${Btn} key=${key} size="sm" icon="download" busy=${busy === key} onClick=${() => get(key, load)}>${label}<//>`)}</div>
    <div class="row wrap"><select class="sel" style="max-width:280px" aria-label="Which GPS positions" value=${span} onChange=${(e) => setSpan(e.target.value)}>
        <option value="7d">GPS positions · last 7 days</option>
        ${MONTHS().map((m) => { const v = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`; return html`<option key=${v} value=${v}>GPS positions · ${fmtDate(m, null, { month: 'long', year: 'numeric' })}</option>`; })}
      </select><${Btn} size="sm" icon="download" busy=${busy === 'positions'} onClick=${() => get('positions', positions, span === '7d' ? 'gps-positions-last-7-days' : `gps-positions-${span}`)}>Download<//></div>
    <span class="faint xs">GPS positions are kept 180 days, so the oldest month may be partly gone.</span>
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
  const save = async (e) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try { await rpc('member_update', { p_org: org.id, p_user: me.user.id, p: v }); app.toast('Saved'); app.loadMe(); members.reload(); setF(null); }
    catch (x) { setErr(x); }
    setBusy(false);
  };
  const savePw = async (e) => {
    e.preventDefault();
    setPwErr(null);
    if (pw.length < 10) { setPwErr('Use at least 10 characters.'); return; }
    if (pw !== pw2) { setPwErr('The two passwords don\'t match.'); return; }
    setPwBusy(true);
    try { await changePassword(pw); setPw(''); setPw2(''); app.toast('Password changed'); }
    catch (x) { setPwErr(x); }
    setPwBusy(false);
  };
  if (!members.data) return html`<${Skel} h=${200} />`;
  return html`<div class="col" style="gap:18px">
    <div class="card"><div class="card-h"><h3>You</h3></div><div class="card-b"><form class="form" onSubmit=${save}>
      <div class="grid2">
        <${Field} label="Name" id="me-n"><input id="me-n" class="inp" value=${v.full_name} onInput=${(e) => setF({ ...v, full_name: e.target.value })} required /><//>
        <${Field} label="Email" id="me-e" help="You sign in with this."><input id="me-e" class="inp" value=${me.user.email} disabled /><//>
        <${Field} label="Mobile" id="me-p"><input id="me-p" class="inp" type="tel" value=${v.phone} onInput=${(e) => setF({ ...v, phone: e.target.value })} /><//>
        <${Field} label="Title" id="me-t"><input id="me-t" class="inp" value=${v.title} onInput=${(e) => setF({ ...v, title: e.target.value })} placeholder="Dispatcher, Owner…" /><//>
      </div>
      <div class="dim sm">Your role at ${org.name}: <b>${ROLES[org.role]?.name}</b> — ${ROLES[org.role]?.desc}</div>
      <${ErrorBox} error=${err} />
      <div class="row"><span class="grow"></span><${Btn} kind="primary" type="submit" busy=${busy} disabled=${!f}>Save<//></div>
    </form></div></div>
    <div class="card"><div class="card-h"><h3>Password</h3></div><div class="card-b"><form class="form" onSubmit=${savePw}>
      <div class="grid2">
        <${Field} label="New password" id="pw1"><${Password} id="pw1" value=${pw} onInput=${setPw} meter /><//>
        <${Field} label="Again" id="pw2"><${Password} id="pw2" value=${pw2} onInput=${setPw2} /><//>
      </div>
      <${ErrorBox} error=${pwErr} />
      <div class="row"><span class="grow"></span><${Btn} kind="primary" type="submit" busy=${pwBusy} disabled=${!pw}>Change password<//></div>
    </form></div></div>
    <div class="card pad row"><div class="grow"><b>Sign out</b><div class="dim sm">On this device.</div></div><${Btn} icon="logout" onClick=${() => signOut()}>Sign out<//></div>
  </div>`;
}

function License({ org }) {
  const l = org.license || {};
  const seats = l.seats || 0;
  const used = org.seats_used || 0;
  return html`<div class="col" style="gap:18px">
    <div class="lic"><div class="l-top"><span class="mark lg"><svg viewBox="0 0 64 64"><path d="M15 45V21.5l17 15 17-15V45" fill="none" stroke="#fff" stroke-width="6.2"
        stroke-linecap="round" stroke-linejoin="round"/><circle cx="32" cy="36.5" r="3.6" fill="#fff"/></svg></span>
      <div class="grow"><div class="l-name">${BRAND} · ${(l.plan || '').replace(/^./, (c) => c.toUpperCase())} plan</div>
        <div class="l-sub">Licensed to ${org.name} · ${KINDS[org.kind] || ''}</div></div>
      <${Chip} tone=${l.status === 'active' ? 'green' : 'amber'}>${l.status === 'active' ? 'Active' : l.status}<//></div>
      <div class="l-chips">${Object.entries(MODULES).map(([k, m]) => html`<${Chip} key=${k} tone=${(l.modules || []).includes(k) ? 'blue' : 'out'}
        icon=${(l.modules || []).includes(k) ? 'check' : 'lock'}>${m.name}<//>`)}</div>
      <div class="l-key"><span>License key</span><b>…${l.hint || '????'}</b></div></div>
    <div class="card"><div class="card-b"><dl class="kv">
      <dt>Seats</dt><dd><div class="row"><span>${used} of ${seats} in use</span><div class="meter" style="max-width:220px"><i style=${`width:${Math.min(100, (used / Math.max(1, seats)) * 100)}%`}></i></div></div></dd>
      <dt>Activated</dt><dd>${l.activated_at ? fmtDate(l.activated_at, org.timezone) : '—'}</dd>
      <dt>Valid until</dt><dd>${l.expires_at ? fmtDate(l.expires_at, org.timezone) : 'No end date'}</dd>
      ${l.expires_at ? html`<dt>After that</dt><dd>The command center locks until the license is renewed. Nothing is deleted.</dd>` : null}
      <dt>Seats</dt><dd>Each person, and each invitation not used yet, uses one.</dd>
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
      <div class="tabs" role="tablist">${tabs.map(([k, l]) => html`<button type="button" key=${k} class=${tab === k ? 'on' : ''} onClick=${() => go('settings/' + k)}>${l}</button>`)}</div>
      ${tab === 'company' && admin ? html`<div class="card"><div class="card-b">${full.data
        ? html`<${CompanyForm} key=${full.data.updated_at} org=${full.data} toast=${toast} onSaved=${(saved, o) => { app.loadMe(); if (!o.logoOnly) { toast('Company saved'); full.reload(); } }} />`
        : html`<${Skel} h=${300} />`}</div></div>` : null}
      ${tab === 'company' && admin ? html`<${DataCopy} org=${org} />` : null}
      ${tab === 'account' ? html`<${Account} org=${org} me=${me} />` : null}
      ${tab === 'license' ? html`<${License} org=${org} />` : null}
    </div>`;
}
