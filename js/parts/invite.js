// Inviting people: the form (name, role, how to reach them) and the share box that follows — the link, the message
// exactly as they'll get it, Text it (to the number you typed) or Email it, and a QR code to scan in person.
// Nothing is e-mailed by the platform: the link is the key.
import { html, useState, Icon, Btn, Field, ErrorBox, Qr, CopyLine } from '../ui.js';
import { rpc } from '../api.js';
import { loadInvites } from '../data.js';
import { BRAND, ROLES, appLink, copy, smsLink, mailLink, fmtDate, phoneFmt } from '../util.js';
import { nameCheck, phoneCheck, emailCheck, problems, focusFirst } from '../check.js';

export const article = (role) => (ROLES[role]?.name === 'Admin' ? 'an' : 'a');

export function ShareBox({ link, message, subject, email, phone, toast, note }) {
  const [opened, setOpened] = useState(null);       // after Text it / Email it: say what should have happened
  const copyMsg = async () => { const ok = await copy(message); toast && toast(ok ? 'Message copied — paste it in a text, WhatsApp or an email' : 'Select the message below and copy it by hand', ok ? 'ok' : 'bad'); };
  return html`<div class="sharebox">
    <div class="row" style="align-items:flex-start;gap:16px;flex-wrap:wrap">
      <${Qr} text=${link} />
      <div class="col grow" style="min-width:220px">
        <b>Send this link</b>
        <span class="dim sm">${note}</span>
        <${CopyLine} value=${link} toast=${toast} />
        <div class="row wrap">
          <${Btn} icon="copy" size="sm" onClick=${copyMsg}>Copy the message<//>
          <a class="btn sm" href=${smsLink(message, phone)} onClick=${() => setOpened('text')}><${Icon} n="msg" />${phone ? `Text it to ${phoneFmt(phone)}` : 'Text it'}</a>
          <a class="btn sm" href=${mailLink(email, subject, message)} onClick=${() => setOpened('email')}><${Icon} n="mail" />${email ? `Email it to ${email}` : 'Email it'}</a>
        </div>
        ${opened ? html`<div class="okmsg"><${Icon} n="info" /><div>${(opened === 'text'
          ? `Your Messages app should open with the text ready${phone ? '' : ' — pick who to send it to'}.` : 'Your email app should open with the message ready.')
          + ' Press send there. Nothing opened? Use Copy the message.'}</div></div>` : null}
        <span class="faint xs">Or have them scan the code with their phone's camera.</span>
      </div>
    </div>
    <div class="col" style="gap:6px"><span class="dim xs">The message they'll get:</span><div class="msgbox">${message}</div></div>
  </div>`;
}

export function InviteForm({ org, me, toast, onCreated }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('driver');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [fe, setFe] = useState({});
  const [made, setMade] = useState(null);
  const [dup, setDup] = useState(null);            // the same person already has a link that works: say so first
  const create = async (e, force = false) => {
    if (e && e.preventDefault) e.preventDefault();
    if (busy) return;
    const errs = problems([['name', nameCheck(name, { what: 'Name', max: 80, empty: 'Type their name.' })], ['phone', phoneCheck(phone)], ['email', emailCheck(email)]]);
    setFe(errs);
    if (Object.keys(errs).length) { focusFirst(errs, { name: 'iv-n', phone: 'iv-p', email: 'iv-e' }); return; }
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
    return html`<div class="col" style="gap:14px">
      <div class="okmsg"><${Icon} n="check" /><div><b>Invitation for ${made.name} is ready.</b> Send the link now — for safety it's shown only once.
        If it gets lost, make a new one from Team.</div></div>
      <${ShareBox} link=${link} message=${message} subject=${`You're invited to ${org.name} on ${BRAND}`} email=${made.email} phone=${made.phone} toast=${toast}
        note=${`Works once · expires ${expires} · ${made.name} joins as ${article(made.role)} ${ROLES[made.role].name}`} />
      <div class="row"><${Btn} icon="plus" onClick=${() => { setMade(null); setName(''); setPhone(''); setEmail(''); setFe({}); }}>Invite someone else<//></div>
    </div>`;
  }
  return html`<form class="form" onSubmit=${create} novalidate>
    <${Field} label="Name" id="iv-n" error=${fe.name}><input id="iv-n" class="inp" value=${name} onInput=${(e) => { setName(e.target.value); setDup(null); setFe((x) => ({ ...x, name: null })); }} placeholder="Their full name" /><//>
    <${Field} label="Role">
      <div class="roles">${['admin', 'dispatcher', 'driver', 'viewer'].map((r) => html`<label key=${r} class=${'rolec' + (role === r ? ' on' : '')}>
        <input type="radio" name="role" checked=${role === r} onChange=${() => setRole(r)} />
        <div><div class="rc-n">${ROLES[r].name}</div><div class="rc-d">${ROLES[r].desc}</div></div></label>`)}</div><//>
    <div class="grid2">
      <${Field} label="Mobile (optional)" id="iv-p" help="Then you can send them the link by text message." error=${fe.phone}><input id="iv-p" class="inp" type="tel" value=${phone}
        onInput=${(e) => { setPhone(e.target.value); setDup(null); setFe((x) => ({ ...x, phone: null })); }} placeholder="(512) 555-0100" /><//>
      <${Field} label="Email (optional)" id="iv-e" help="Then you can send them the link by email." error=${fe.email}><input id="iv-e" class="inp" type="email" value=${email}
        onInput=${(e) => { setEmail(e.target.value); setDup(null); setFe((x) => ({ ...x, email: null })); }} placeholder="name@company.com" /><//>
    </div>
    ${dup ? html`<div class="warnmsg" role="alert"><${Icon} n="info" /><div><b>${dup.full_name} already has an invitation that still works</b> (made ${fmtDate(dup.created_at)}).
        Another one uses another seat. To send a fresh link instead, cancel the old one in Team.
        <div class="row wrap" style="margin-top:8px"><${Btn} size="sm" onClick=${() => create(null, true)}>Make another one anyway<//>
          <${Btn} size="sm" kind="ghost" onClick=${() => setDup(null)}>Keep the old one<//></div></div></div>` : null}
    <${ErrorBox} error=${err} />
    <div class="row"><span class="dim sm grow">Next you'll see the link and the message to send. Each invitation uses one of your seats until it's used or cancelled.</span>
      <${Btn} kind="primary" type="submit" busy=${busy}>Create invitation<//></div>
  </form>`;
}
