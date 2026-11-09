// Inviting people: the form (name, role, how to reach them) and the share box that follows — the link, the message
// exactly as they'll get it, Text it (to the number you typed) or Email it, and a QR code to scan in person.
// Nothing is e-mailed by the platform: the link is the key.
import { html, useState, Icon, Btn, Field, ErrorBox, Qr, CopyLine, useForm } from '../ui.js';
import { rpc } from '../api.js';
import { loadInvites } from '../data.js';
import { BRAND, ROLES, appLink, copy, smsLink, mailLink, fmtDate, phoneFmt, isPhone } from '../util.js';
import { nameCheck, phoneCheck, emailCheck } from '../check.js';

export const article = (role) => (ROLES[role]?.name === 'Admin' ? 'an' : 'a');

// the main button is the way most likely to reach them: a text on a phone when there's a number, else email, else copy
export function ShareBox({ link, message, subject, email, phone, toast, note }) {
  const [opened, setOpened] = useState(null);       // after Text it / Email it: say what should have happened
  const copyMsg = async () => { const ok = await copy(message); toast && toast(ok ? 'Message copied — paste it in a text, WhatsApp or an email' : 'Select the message below and copy it by hand', ok ? 'ok' : 'bad'); };
  const main = phone && isPhone() ? 'text' : email ? 'email' : phone ? 'text' : 'copy';
  const cls = (k) => 'btn sm' + (main === k ? ' primary' : '');
  return html`<div class="sharebox">
    <div class="row share-row">
      <${Qr} text=${link} />
      <div class="col grow share-main">
        <b>Send this link</b>
        <span class="dim sm">${note}</span>
        <${CopyLine} value=${link} toast=${toast} />
        <div class="row wrap">
          <a class=${cls('text')} href=${smsLink(message, phone)} onClick=${() => setOpened('text')}><${Icon} n="msg" />${phone ? `Text it to ${phoneFmt(phone)}` : 'Text it'}</a>
          <a class=${cls('email')} href=${mailLink(email, subject, message)} onClick=${() => setOpened('email')}><${Icon} n="mail" />${email ? `Email it to ${email}` : 'Email it'}</a>
          <${Btn} kind=${main === 'copy' ? 'primary' : ''} icon="copy" size="sm" onClick=${copyMsg}>Copy the message<//>
        </div>
        ${opened ? html`<div class="okmsg" role="status"><${Icon} n="info" /><div>${(opened === 'text'
          ? `Your Messages app should open with the text ready${phone ? '' : ' — pick who to send it to'}.` : 'Your email app should open with the message ready.')
          + ' Press send there. Nothing opened? Use Copy the message.'}</div></div>` : null}
        <span class="dim xs">Or have them scan the code with their phone's camera.</span>
      </div>
    </div>
    <div class="col gap-4"><span class="dim xs">The message they'll get:</span><div class="msgbox">${message}</div></div>
  </div>`;
}

// `primary`: Create invitation is the screen's main button (on the setup step it hands that over to Continue once
// someone is invited)
export function InviteForm({ org, me, toast, onCreated, primary = true }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('driver');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [made, setMade] = useState(null);
  const [dup, setDup] = useState(null);            // the same person already has a link that works: say so first
  const chk = useForm({ name, phone, email },
    { name: (v) => nameCheck(v, { what: 'Name', max: 80, empty: 'Type their name.' }), phone: phoneCheck, email: (v) => emailCheck(v) },
    { name: 'iv-n', phone: 'iv-p', email: 'iv-e' });
  const fe = chk.errs;
  const create = async (e, force = false) => {
    if (e && e.preventDefault) e.preventDefault();
    if (busy || !chk.ok()) return;
    setErr(null); setBusy(true);
    try {
      if (!force) {
        const digits = (s) => String(s || '').replace(/\D/g, '').slice(-10);
        const open = (await loadInvites(org.id)).filter((i) => new Date(i.expires_at) > new Date());
        const same = open.find((i) => (phone.trim() && digits(i.phone) === digits(phone)) || (email.trim() && (i.email || '').toLowerCase() === email.trim().toLowerCase())
          || (i.full_name || '').trim().toLowerCase() === name.trim().toLowerCase());
        if (same) { setDup(same); setBusy(false); return; }
      }
      setDup(null);
      const r = await rpc('invite_create', { p_org: org.id, p: { full_name: name.trim(), role, phone: phone.trim(), email: email.trim() } });
      setMade({ ...r, name: name.trim(), role, email: email.trim(), phone: phone.trim() });
      onCreated && onCreated(r);
    } catch (x) { setErr(x); }
    setBusy(false);
  };
  if (made) {
    const link = appLink(`/join/${made.token}`);
    const expires = fmtDate(Date.now() + 14 * 86400000);
    const message = `${me?.user?.name || 'Your company'} invited you to ${org.name} on ${BRAND} as ${article(made.role)} ${ROLES[made.role].name}.\n\n`
      + `Open this link on your phone or computer to set up your account:\n${link}\n\nThe link works once and expires ${expires}.`
      + (made.role === 'driver' ? `\n\nAs a driver, your phone shares its location only while Driver mode is on and says Sharing: every 15 seconds, `
        + `seen by the people at ${org.name} who use the live map, and kept 180 days. You can stop it at any time.` : '');
    return html`<div class="col gap-16">
      <div class="okmsg" role="status"><${Icon} n="check" /><div><b>Invitation for ${made.name} is ready.</b> Send the link now — for safety it's shown only once.
        If it gets lost, make a new one from Team.</div></div>
      <${ShareBox} link=${link} message=${message} subject=${`You're invited to ${org.name} on ${BRAND}`} email=${made.email} phone=${made.phone} toast=${toast}
        note=${`Works once · expires ${expires} · ${made.name} joins as ${article(made.role)} ${ROLES[made.role].name}`} />
      <div class="row"><${Btn} icon="plus" onClick=${() => { setMade(null); setName(''); setPhone(''); setEmail(''); chk.set('name', null); }}>Invite someone else<//></div>
    </div>`;
  }
  return html`<form class="form" onSubmit=${create} novalidate>
    <${Field} label="Name" id="iv-n" error=${fe.name}><input id="iv-n" class="inp" value=${name} autocomplete="off"
      onInput=${(e) => { setName(e.target.value); setDup(null); chk.edit('name', e.target.value); }} onBlur=${chk.blur('name')} placeholder="Their full name" /><//>
    <fieldset class="field"><legend>Role</legend>
      <div class="roles">${['admin', 'dispatcher', 'driver', 'viewer'].map((r) => html`<label key=${r} class=${'rolec' + (role === r ? ' on' : '')}>
        <input type="radio" name="role" value=${r} checked=${role === r} onChange=${() => setRole(r)} />
        <div><div class="rc-n">${ROLES[r].name}</div><div class="rc-d">${ROLES[r].desc}</div></div></label>`)}</div></fieldset>
    <div class="grid2">
      <${Field} label="Mobile (optional)" id="iv-p" help="Then you can send them the link by text message." error=${fe.phone}><input id="iv-p" class="inp" type="tel" value=${phone}
        autocomplete="off" onInput=${(e) => { setPhone(e.target.value); setDup(null); chk.edit('phone', e.target.value); }} onBlur=${chk.blur('phone')} placeholder="(512) 555-0100" /><//>
      <${Field} label="Email (optional)" id="iv-e" help="Then you can send them the link by email." error=${fe.email}><input id="iv-e" class="inp" type="email" value=${email}
        autocomplete="off" onInput=${(e) => { setEmail(e.target.value); setDup(null); chk.edit('email', e.target.value); }} onBlur=${chk.blur('email')} placeholder="name@company.com" /><//>
    </div>
    ${dup ? html`<div class="warnmsg" role="alert"><${Icon} n="info" /><div><b>${dup.full_name} already has an invitation that still works</b> (made ${fmtDate(dup.created_at)}).
        Another one uses another seat. To send a fresh link instead, cancel the old one in Team.
        <div class="row wrap mt-8"><${Btn} size="sm" busy=${busy} onClick=${() => create(null, true)}>Make another one anyway<//>
          <${Btn} size="sm" kind="ghost" disabled=${busy} onClick=${() => setDup(null)}>Keep the old one<//></div></div></div>` : null}
    <${ErrorBox} error=${err} />
    <p class="dim sm">Next you'll see the link and the message to send. Each invitation uses one of your seats until it's used or cancelled.</p>
    <div class="form-foot"><span class="grow"></span><${Btn} kind=${primary ? 'primary' : ''} type="submit" busy=${busy}>Create invitation<//></div>
  </form>`;
}
