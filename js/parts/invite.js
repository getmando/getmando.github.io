// Inviting people: the form (name, role, how to reach them) and the share box that follows — the link, a ready
// message to text or email, and a QR code to scan in person. Nothing is e-mailed by the platform: the link is the key.
import { html, useState, Icon, Btn, Field, ErrorBox, Qr, CopyLine } from '../ui.js';
import { rpc } from '../api.js';
import { BRAND, ROLES, appLink, copy, smsLink, mailLink, fmtDate } from '../util.js';

export const article = (role) => (ROLES[role]?.name === 'Admin' ? 'an' : 'a');

export function ShareBox({ link, message, subject, email, toast, note }) {
  const copyMsg = async () => { const ok = await copy(message); toast && toast(ok ? 'Message copied — paste it in a text or email' : 'Select it and copy it by hand', ok ? 'ok' : 'bad'); };
  return html`<div class="sharebox">
    <div class="row" style="align-items:flex-start;gap:16px;flex-wrap:wrap">
      <${Qr} text=${link} />
      <div class="col grow" style="min-width:220px">
        <b>Send this link</b>
        <span class="dim sm">${note}</span>
        <${CopyLine} value=${link} toast=${toast} />
        <div class="row wrap">
          <${Btn} icon="copy" size="sm" onClick=${copyMsg}>Copy message<//>
          <a class="btn sm" href=${smsLink(message)}><${Icon} n="msg" />Text it</a>
          <a class="btn sm" href=${mailLink(email, subject, message)}><${Icon} n="mail" />Email it</a>
        </div>
        <span class="faint xs">Or have them scan the code with their phone's camera.</span>
      </div>
    </div>
  </div>`;
}

export function InviteForm({ org, me, toast, onCreated }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('driver');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [made, setMade] = useState(null);
  const create = async (e) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const r = await rpc('invite_create', { p_org: org.id, p: { full_name: name, role, phone, email } });
      setMade({ ...r, name, role, email, phone });
      onCreated && onCreated(r);
    } catch (x) { setErr(x); }
    setBusy(false);
  };
  if (made) {
    const link = appLink(`/join/${made.token}`);
    const expires = fmtDate(Date.now() + 14 * 86400000);
    const message = `${me?.user?.name || 'Your company'} invited you to ${org.name} on ${BRAND} as ${article(made.role)} ${ROLES[made.role].name}.\n\n`
      + `Open this link on your phone or computer to set up your account:\n${link}\n\nThe link works once and expires ${expires}.`;
    return html`<div class="col" style="gap:14px">
      <div class="okmsg"><${Icon} n="check" /><div><b>Invitation for ${made.name} is ready.</b> It's shown only now — send it before you close this.</div></div>
      <${ShareBox} link=${link} message=${message} subject=${`You're invited to ${org.name} on ${BRAND}`} email=${made.email} toast=${toast}
        note=${`Works once · expires ${expires} · ${made.name} joins as ${article(made.role)} ${ROLES[made.role].name}`} />
      <div class="row"><${Btn} icon="plus" onClick=${() => { setMade(null); setName(''); setPhone(''); setEmail(''); }}>Invite someone else<//></div>
    </div>`;
  }
  return html`<form class="form" onSubmit=${create}>
    <${Field} label="Name" id="iv-n"><input id="iv-n" class="inp" value=${name} onInput=${(e) => setName(e.target.value)} required maxlength="80" placeholder="Their full name" /><//>
    <${Field} label="Role">
      <div class="roles">${['admin', 'dispatcher', 'driver', 'viewer'].map((r) => html`<label key=${r} class=${'rolec' + (role === r ? ' on' : '')}>
        <input type="radio" name="role" checked=${role === r} onChange=${() => setRole(r)} />
        <div><div class="rc-n">${ROLES[r].name}</div><div class="rc-d">${ROLES[r].desc}</div></div></label>`)}</div><//>
    <div class="grid2">
      <${Field} label="Mobile (optional)" id="iv-p"><input id="iv-p" class="inp" type="tel" value=${phone} onInput=${(e) => setPhone(e.target.value)} placeholder="To text them the link" /><//>
      <${Field} label="Email (optional)" id="iv-e"><input id="iv-e" class="inp" type="email" value=${email} onInput=${(e) => setEmail(e.target.value)} placeholder="To email them the link" /><//>
    </div>
    <${ErrorBox} error=${err} />
    <div class="row"><span class="dim sm grow">You'll get a link to send. Each invitation holds a seat until it's used or cancelled.</span>
      <${Btn} kind="primary" type="submit" busy=${busy}>Create invitation<//></div>
  </form>`;
}
