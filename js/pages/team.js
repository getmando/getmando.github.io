// Team: who can sign in to the company, their role, when they were last on, and the open invitations.
// #/team/invite opens the invitation form. Owners and admins manage people; everyone else just sees the list.
import { html, useState, Icon, Btn, Chip, Empty, Drawer, Avatar, Skel, Top, useLoad } from '../ui.js';
import { useApp, go } from '../ctx.js';
import { rpc } from '../api.js';
import { loadMembers, loadInvites } from '../data.js';
import { BRAND, ROLES, ago, can, fmtDate, phoneFmt, appLink, askWho } from '../util.js';
import { InviteForm, ShareBox, article } from '../parts/invite.js';

function ResetLink({ org, person, data, onClose, toast }) {
  const link = appLink(`/reset/${data.token}`);
  const message = `Here's your link to set a new password for ${org.name} on ${BRAND}:\n${link}\n\nIt works once, within 24 hours.`;
  return html`<${Drawer} title=${`Password reset for ${person.full_name}`} sub="Send them this link. It works once, within 24 hours." icon="key" onClose=${onClose}>
    <${ShareBox} link=${link} message=${message} subject=${`Set a new password · ${org.name}`} email=${person.email} toast=${toast}
      note=${`For ${person.email || person.full_name} · shown only now`} /><//>`;
}

function Person({ org, m, me, onChanged }) {
  const app = useApp();
  const [busy, setBusy] = useState(false);
  const manage = can(org.role, 'team') && m.user_id !== me.user.id && (m.role !== 'owner' || org.role === 'owner');
  const roles = Object.keys(ROLES).filter((r) => r !== 'owner' || org.role === 'owner');
  const act = async (fn, okMsg) => {
    setBusy(true);
    try { const r = await fn(); if (okMsg) app.toast(okMsg); onChanged(r); }
    catch (x) { app.toast(x.message, 'bad'); }
    setBusy(false);
  };
  const setRole = (role) => act(() => rpc('member_update', { p_org: org.id, p_user: m.user_id, p: { role } }), `${m.full_name} is now ${article(role)} ${ROLES[role].name}`);
  const toggle = async () => {
    const off = m.status === 'active';
    if (off && !(await app.confirm({ title: `Turn off ${m.full_name}'s access?`, text: 'They can\'t sign in to this company until you turn it back on. Nothing they did is lost.', ok: 'Turn off', danger: true }))) return;
    act(() => rpc('member_update', { p_org: org.id, p_user: m.user_id, p: { status: off ? 'disabled' : 'active' } }), off ? 'Access turned off' : 'Access turned back on');
  };
  const remove = async () => {
    if (!(await app.confirm({ title: `Remove ${m.full_name}?`, text: `They leave ${org.name} and free a seat. Their account stays in case they belong to another company.`, ok: 'Remove', danger: true }))) return;
    act(() => rpc('member_remove', { p_org: org.id, p_user: m.user_id }), `${m.full_name} removed`);
  };
  const reset = () => act(async () => ({ reset: await rpc('member_reset_link', { p_org: org.id, p_user: m.user_id }), person: m }));
  return html`<tr>
    <td><div class="row"><${Avatar} name=${m.full_name} /><div><div class="b">${m.full_name}${m.user_id === me.user.id ? html` <span class="dim" style="font-weight:400">(you)</span>` : null}</div>
      <div class="dim xs">${[m.email, m.phone && phoneFmt(m.phone)].filter(Boolean).join(' · ') || '—'}</div></div></div></td>
    <td>${manage ? html`<select class="sel" style="width:150px;height:32px" value=${m.role} disabled=${busy} onChange=${(e) => setRole(e.target.value)}>
        ${roles.map((r) => html`<option value=${r}>${ROLES[r].name}</option>`)}</select>` : html`<span>${ROLES[m.role]?.name}</span>`}</td>
    <td class="dim">${m.last_seen_at ? ago(m.last_seen_at) : 'not yet'}</td>
    <td>${m.status === 'active' ? html`<${Chip} tone="green">Active<//>` : html`<${Chip} tone="red">Off<//>`}</td>
    <td class="r nowrap">${manage ? html`<${Btn} size="sm" kind="ghost" icon="key" disabled=${busy} onClick=${reset} title="Make a password reset link">Reset<//>
      <${Btn} size="sm" kind="ghost" disabled=${busy} onClick=${toggle}>${m.status === 'active' ? 'Turn off' : 'Turn on'}<//>
      <${Btn} size="sm" kind="ghost" cls="icon" icon="trash" disabled=${busy} aria-label="Remove" onClick=${remove} />` : null}</td>
  </tr>`;
}

export function Team() {
  const app = useApp();
  const { org, me, route, toast } = app;
  const members = useLoad(() => loadMembers(org.id), [org.id]);
  const manage = can(org.role, 'team');
  const invites = useLoad(() => (manage ? loadInvites(org.id) : Promise.resolve([])), [org.id, manage]);
  const [reset, setReset] = useState(null);
  const inviting = route.params[0] === 'invite' && manage;
  const list = members.data || [];
  const open = (invites.data || []).filter((i) => new Date(i.expires_at) > new Date());
  const seats = org.license?.seats || 0;
  const used = org.seats_used || 0;
  const changed = (r) => { if (r?.reset) setReset(r); members.reload(); invites.reload(); app.loadMe(); };
  const cancel = async (i) => {
    if (!(await app.confirm({ title: `Cancel ${i.full_name}'s invitation?`, text: 'The link stops working and the seat frees up.', ok: 'Cancel invitation', danger: true, cancel: 'Keep' }))) return;
    try { await rpc('invite_revoke', { p_invite: i.id }); toast('Invitation cancelled'); changed(); } catch (x) { toast(x.message, 'bad'); }
  };

  return html`<${Top} title="Team" sub=${`${list.filter((m) => m.status === 'active').length} people · ${Math.max(0, seats - used)} of ${seats} seats free`}>
      ${manage ? html`<${Btn} kind="primary" icon="plus" onClick=${() => go('team/invite')}>Invite people<//>` : null}<//>
    <div class="page">
      <div class="card pad"><div class="seats"><div class="col" style="gap:2px"><b>${used} of ${seats} seats in use</b>
          <span class="dim xs">Each person, and each invitation not used yet, uses one seat. ${seats - used <= 0 ? `Need more? Write to ${askWho()}.` : ''}</span></div>
        <div class="meter"><i style=${`width:${Math.min(100, (used / Math.max(1, seats)) * 100)}%`}></i></div></div></div>

      <div class="card tablecard"><div class="card-h"><h3>People</h3></div>
        ${!members.data ? html`<div class="card-b"><${Skel} h=${140} /></div>` : html`<table class="tbl" style="margin-top:6px">
          <thead><tr><th>Name</th><th>Role</th><th>Last active</th><th>Access</th><th></th></tr></thead>
          <tbody>${list.map((m) => html`<${Person} key=${m.user_id} org=${org} m=${m} me=${me} onChanged=${changed} />`)}</tbody></table>
          <div class="cards">${list.map((m) => html`<div class="li" key=${m.user_id}><${Avatar} name=${m.full_name} />
            <div class="grow"><div class="li-t">${m.full_name}${m.user_id === me.user.id ? ' (you)' : ''}</div><div class="li-s">${ROLES[m.role]?.name} · ${m.last_seen_at ? 'active ' + ago(m.last_seen_at) : 'not on yet'}</div></div>
            ${m.status === 'active' ? null : html`<${Chip} tone="red">Off<//>`}</div>`)}</div>`}
      </div>

      ${manage ? html`<div class="card"><div class="card-h"><h3 class="grow">Open invitations</h3>${open.length ? html`<${Chip}>${open.length}<//>` : null}</div>
        ${open.length ? html`<div class="list" style="margin-top:6px">${open.map((i) => html`<div class="li" key=${i.id}><div class="li-ic"><${Icon} n="send" /></div>
            <div class="grow"><div class="li-t">${i.full_name} · ${ROLES[i.role]?.name}</div>
              <div class="li-s">Created ${ago(i.created_at)} · expires ${fmtDate(i.expires_at, org.timezone)}${i.phone ? ' · ' + phoneFmt(i.phone) : ''}${i.email ? ' · ' + i.email : ''}</div></div>
            <${Btn} size="sm" kind="ghost" onClick=${() => cancel(i)}>Cancel<//></div>`)}</div>
          <div class="card-f dim xs">Links are shown once. If one got lost, cancel it and invite them again.</div>`
          : html`<${Empty} cls="sm" icon="send" text="No open invitations." />`}</div>` : null}

      <div class="card"><div class="card-h"><h3>Roles</h3></div><div class="card-b"><div class="roles">
        ${Object.entries(ROLES).map(([k, r]) => html`<div class="rolec" key=${k} style="cursor:default"><div><div class="rc-n">${r.name}</div><div class="rc-d">${r.desc}</div></div></div>`)}</div></div></div>
    </div>
    ${inviting ? html`<${Drawer} title="Invite people" sub=${`They join ${org.name} with the role you pick.`} icon="users" onClose=${() => { go('team'); changed(); }} wide>
      <${InviteForm} org=${org} me=${me} toast=${toast} onCreated=${() => { invites.reload(); app.loadMe(); }} /><//>` : null}
    ${reset ? html`<${ResetLink} org=${org} person=${reset.person} data=${reset.reset} toast=${toast} onClose=${() => setReset(null)} />` : null}`;
}
