// Signed-out pages: sign in · activate a license (owner account + company) · join by invitation ·
// set a new password from a reset link. Accounts are only ever made here, through the accounts function.
import { html, useState, useEffect, Icon, Mark, OrgBadge, Btn, Chip, Field, Password, ErrorBox } from '../ui.js';
import { useApp, go } from '../ctx.js';
import { rpc, edge, signIn, signOut, getSession } from '../api.js';
import { BRAND, C, KINDS, MODULES, ROLES, fmtDate, firstName } from '../util.js';

function Hero() {
  return html`<section class="hero">
    <div class="row"><${Mark} /><span class="wordmark">${BRAND}</span></div>
    <svg class="hero-net" viewBox="0 0 520 420" aria-hidden="true">
      <path d="M40 330 C 140 250, 190 300, 260 210 S 400 120, 480 70" /><path d="M60 120 C 160 140, 230 90, 300 150 S 420 260, 500 300" />
      <path d="M120 400 C 180 320, 300 360, 360 260 S 430 170, 470 180" />
      <circle cx="40" cy="330" r="5" /><circle cx="260" cy="210" r="6" class="hn-b" /><circle cx="480" cy="70" r="5" />
      <circle cx="60" cy="120" r="5" /><circle cx="300" cy="150" r="4" /><circle cx="500" cy="300" r="6" class="hn-b" /><circle cx="360" cy="260" r="5" />
    </svg>
    <div>
      <h1>${C.TAGLINE ? html`The command center for the companies that <em>build</em>.` : BRAND}</h1>
      <p class="lead">Fleet, people, GPS and the systems you already use — in one place that belongs to your company.</p>
    </div>
    <div class="hero-pts">
      ${[['truck', 'Your fleet, live', 'Every truck on one map — from any GPS provider, or from your drivers\' phones.'],
         ['users', 'Your team, your rules', 'Invite people with the right role. Turn access off in one tap.'],
         ['plug', 'Connect what you use', 'Samsara, Motive, Geotab, Verizon Connect, Actsoft — or the Open API.'],
         ['shield', 'Yours alone', 'Each company\'s command center is walled off from every other company\'s.']]
        .map(([i, b, s]) => html`<div class="hero-pt"><div class="hp-ic"><${Icon} n=${i} /></div><div><b>${b}</b><span>${s}</span></div></div>`)}
    </div>
    <div class="hero-foot">© ${new Date().getFullYear()} ${BRAND}</div>
  </section>`;
}

function AuthFrame({ children }) {
  return html`<div class="auth"><${Hero} /><div class="authside"><div class="authcard">
    <div class="authmini"><${Mark} /><span class="wordmark">${BRAND}</span></div>${children}</div></div></div>`;
}

// after an account exists: sign in, load the companies, open the right one
async function enter(app, email, password, orgId, next) {
  await signIn(email, password);
  const me = await app.loadMe();
  if (orgId) app.setOrg(orgId);
  else if (me?.orgs?.[0]) app.setOrg(me.orgs[0].id);
  go(next);
}

export function SignIn() {
  const app = useApp();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const next = app.route.name === 'signin' ? app.route.query.get('next') : (app.route.name ? location.hash.slice(2) : '');
  const submit = async (e) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try { await enter(app, email, pw, null, next || 'home'); }
    catch (x) { setErr(x); setBusy(false); }
  };
  return html`<${AuthFrame}>
    <div><h2>Sign in</h2></div>
    <p class="lede">Welcome back to your command center.</p>
    <form class="form" onSubmit=${submit}>
      <${Field} label="Email" id="em"><input id="em" class="inp" type="email" autocomplete="username" value=${email} onInput=${(e) => setEmail(e.target.value)} required /><//>
      <${Field} label="Password" id="pw"><${Password} id="pw" value=${pw} onInput=${setPw} auto="current-password" /><//>
      <${ErrorBox} error=${err} />
      <${Btn} kind="primary" size="lg" cls="block" type="submit" busy=${busy}>Sign in<//>
    </form>
    <div class="card pad col">
      <div class="row"><${Icon} n="license" /><b>Have a license key?</b></div>
      <span class="dim sm">Activate it to create your company's command center.</span>
      <div><${Btn} size="sm" onClick=${() => go('activate')}>Activate a license<//></div>
    </div>
    <p class="authalt">Got an invitation? Open the link you were sent.<br />Forgot your password? Ask your company's owner or admin for a reset link.</p>
  <//>`;
}

export function LicenseCard({ lic, code }) {
  return html`<div class="lic">
    <div class="l-top"><${OrgBadge} org=${{ name: lic.company_name }} cls="lg" />
      <div class="grow"><div class="l-name">${lic.company_name}</div>
        <div class="l-sub">${KINDS[lic.company_kind] || ''}${lic.contact_name ? ` · issued to ${lic.contact_name}` : ''}</div></div></div>
    <div class="l-chips">
      <${Chip} tone="violet" icon="spark">${(lic.plan || 'pilot').replace(/^./, (c) => c.toUpperCase())}<//>
      <${Chip} icon="users">${lic.seats} seats<//>
      <${Chip} icon="clock">${lic.term_months ? `${lic.term_months} months` : 'No end date'}<//>
      ${(lic.modules || []).map((m) => html`<${Chip} tone="blue" key=${m}>${MODULES[m]?.name || m}<//>`)}
    </div>
    ${code ? html`<div class="l-key"><span>License key</span><b>${code}</b></div>` : null}
  </div>`;
}

const LICENSE_STATE = {
  used: ['This license is already activated', 'Sign in with the account that activated it.'],
  expired: ['This activation link expired', 'Ask your provider for a new one.'],
  revoked: ['This license was cancelled', 'Contact your provider.'],
  invalid: ['We couldn\'t find that license key', 'Check it and try again — dashes and capitals don\'t matter.'],
};

export function Activate() {
  const app = useApp();
  const [code, setCode] = useState(app.route.params[0] || '');
  const [lic, setLic] = useState(null);
  const [checking, setChecking] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [mode, setMode] = useState('new');          // new | existing (email already has an account)
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const signedIn = !!getSession();

  const check = async (c) => {
    if (!c.trim()) return;
    setChecking(true); setErr(null);
    try {
      const p = await rpc('license_preview', { p_code: c }, { anon: true });
      setLic(p);
      if (p.status === 'ready') { setName((n) => n || p.contact_name || ''); setEmail((m) => m || p.contact_email || ''); }
    } catch (x) { setErr(x); }
    setChecking(false);
  };
  useEffect(() => { if (code) check(code); }, []);

  const activateNew = async (e) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      await edge('accounts', { op: 'activate', code, full_name: name, email, password: pw });
      await enter(app, email, pw, null, 'welcome');
    } catch (x) {
      if (x.code === 'email_exists') { setMode('existing'); setPw(''); setErr(null); }
      else setErr(x);
      setBusy(false);
    }
  };
  const activateHere = async (e) => {
    if (e) e.preventDefault();
    setErr(null); setBusy(true);
    try {
      if (!getSession()) await signIn(email, pw);
      const r = await rpc('license_activate_self', { p_code: code, p_full_name: name || null });
      await app.loadMe();
      app.setOrg(r.org_id);
      go('welcome');
    } catch (x) { setErr(x); setBusy(false); }
  };

  const ready = lic?.status === 'ready';
  return html`<${AuthFrame}>
    <div><h2>${ready ? `Welcome${name ? ', ' + firstName(name) : ''}` : 'Activate your license'}</h2></div>
    <p class="lede">${ready ? `Your license for ${lic.company_name} is ready. Create your owner account to open its command center.`
      : 'Enter the license key your provider sent you.'}</p>

    ${!ready ? html`<form class="form" onSubmit=${(e) => { e.preventDefault(); check(code); }}>
      <${Field} label="License key" id="lk"><input id="lk" class="inp big mono" value=${code} placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" autocomplete="off"
        spellcheck="false" onInput=${(e) => setCode(e.target.value.toUpperCase())} /><//>
      ${lic && LICENSE_STATE[lic.status] ? html`<div class="err"><${Icon} n="alert" /><div><b>${LICENSE_STATE[lic.status][0]}${lic.company_name ? ` · ${lic.company_name}` : ''}</b><br />
        ${LICENSE_STATE[lic.status][1]}</div></div>` : null}
      <${ErrorBox} error=${err} />
      <${Btn} kind="primary" size="lg" cls="block" type="submit" busy=${checking}>Continue<//>
      ${lic?.status === 'used' ? html`<${Btn} cls="block" onClick=${() => go('signin')}>Sign in<//>` : null}
    </form>` : null}

    ${ready ? html`<${LicenseCard} lic=${lic} code=${code} />` : null}

    ${ready && signedIn ? html`<div class="card pad col"><b>You're signed in</b>
        <span class="dim sm">Add ${lic.company_name} to your account (${getSession()?.user?.email})?</span>
        <${ErrorBox} error=${err} />
        <div class="row wrap"><${Btn} kind="primary" busy=${busy} onClick=${() => activateHere()}>Activate for this account<//>
          <${Btn} onClick=${async () => { await signOut(); }}>Use a different account<//></div></div>` : null}

    ${ready && !signedIn && mode === 'new' ? html`<form class="form" onSubmit=${activateNew}>
      <${Field} label="Your name" id="nm"><input id="nm" class="inp" autocomplete="name" value=${name} onInput=${(e) => setName(e.target.value)} required /><//>
      <${Field} label="Email" id="em" help="You'll sign in with this."><input id="em" class="inp" type="email" autocomplete="email" value=${email}
        onInput=${(e) => setEmail(e.target.value)} required /><//>
      <${Field} label="Create a password" id="pw"><${Password} id="pw" value=${pw} onInput=${setPw} meter /><//>
      <${ErrorBox} error=${err} />
      <${Btn} kind="primary" size="lg" cls="block" type="submit" busy=${busy} disabled=${pw.length < 10 || !name.trim() || !email.trim()}>
        Create my account<//>
      <p class="authalt">You'll be the owner of ${lic.company_name}. You can add your team next.</p>
    </form>` : null}

    ${ready && !signedIn && mode === 'existing' ? html`<form class="form" onSubmit=${activateHere}>
      <div class="okmsg"><${Icon} n="info" /><div>There's already an account for <b>${email}</b>. Sign in with its password to add ${lic.company_name} to it.</div></div>
      <${Field} label="Password for ${email}" id="pw2"><${Password} id="pw2" value=${pw} onInput=${setPw} auto="current-password" /><//>
      <${ErrorBox} error=${err} />
      <${Btn} kind="primary" size="lg" cls="block" type="submit" busy=${busy}>Sign in and activate<//>
      <${Btn} cls="block" onClick=${() => { setMode('new'); setEmail(''); setErr(null); }}>Use a different email<//>
    </form>` : null}
  <//>`;
}

const INVITE_STATE = {
  used: ['This invitation was already used', 'Sign in with the account you made.'],
  expired: ['This invitation expired', 'Ask whoever invited you for a new link.'],
  revoked: ['This invitation was cancelled', 'Ask whoever invited you for a new link.'],
  invalid: ['We couldn\'t find this invitation', 'Ask whoever invited you for a new link.'],
  company_inactive: ['This company isn\'t active right now', 'Ask whoever invited you.'],
};

export function Join() {
  const app = useApp();
  const token = app.route.params[0] || '';
  const [inv, setInv] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [mode, setMode] = useState('new');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const signedIn = !!getSession();
  useEffect(() => {
    rpc('invite_preview', { p_token: token }, { anon: true })
      .then((p) => { setInv(p); setName(p.full_name || ''); setEmail(p.email || ''); })
      .catch((x) => { setErr(x); setInv({ status: 'invalid' }); });
  }, [token]);
  const next = inv?.role === 'driver' ? 'driver' : 'home';

  const joinNew = async (e) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      await edge('accounts', { op: 'join', token, full_name: name, email, password: pw });
      await enter(app, email, pw, null, next);
    } catch (x) {
      if (x.code === 'email_exists') { setMode('existing'); setPw(''); }
      else setErr(x);
      setBusy(false);
    }
  };
  const joinHere = async (e) => {
    if (e) e.preventDefault();
    setErr(null); setBusy(true);
    try {
      if (!getSession()) await signIn(email, pw);
      const r = await rpc('invite_accept_self', { p_token: token });
      await app.loadMe();
      app.setOrg(r.org_id);
      go(next);
    } catch (x) { setErr(x); setBusy(false); }
  };

  if (!inv) return html`<${AuthFrame}><div class="boot" style="min-height:200px"><span class="boot-mark"></span></div><//>`;
  if (inv.status !== 'ready') {
    const [t, s] = INVITE_STATE[inv.status] || INVITE_STATE.invalid;
    return html`<${AuthFrame}><h2>${t}</h2><p class="lede">${s}</p>${inv.org_name ? html`<p class="dim">${inv.org_name}</p>` : null}
      <${Btn} cls="block" onClick=${() => go('signin')}>Go to sign in<//><//>`;
  }
  const org = { name: inv.org_name, logo_path: inv.logo_path, brand_color: inv.brand_color };
  return html`<${AuthFrame}>
    <div class="row"><${OrgBadge} org=${org} cls="lg" /><div class="grow"><h2>Join ${inv.org_name}</h2>
      <div class="dim">${inv.invited_by ? `${inv.invited_by} invited you` : 'You were invited'} as ${ROLES[inv.role]?.name === 'Admin' ? 'an' : 'a'} ${ROLES[inv.role]?.name}.</div></div></div>
    <div class="card pad sm dim">${ROLES[inv.role]?.desc} The link works once${inv.expires_at ? ` and expires ${fmtDate(inv.expires_at)}` : ''}.</div>

    ${signedIn ? html`<div class="card pad col"><b>You're signed in as ${getSession()?.user?.email}</b>
        <${ErrorBox} error=${err} />
        <div class="row wrap"><${Btn} kind="primary" busy=${busy} onClick=${() => joinHere()}>Join ${inv.org_name}<//>
          <${Btn} onClick=${() => signOut()}>Use a different account<//></div></div>`
    : mode === 'new' ? html`<form class="form" onSubmit=${joinNew}>
      <${Field} label="Your name" id="nm"><input id="nm" class="inp" autocomplete="name" value=${name} onInput=${(e) => setName(e.target.value)} required /><//>
      <${Field} label="Email" id="em" help="You'll sign in with this."><input id="em" class="inp" type="email" autocomplete="email" value=${email} onInput=${(e) => setEmail(e.target.value)} required /><//>
      <${Field} label="Create a password" id="pw"><${Password} id="pw" value=${pw} onInput=${setPw} meter /><//>
      <${ErrorBox} error=${err} />
      <${Btn} kind="primary" size="lg" cls="block" type="submit" busy=${busy} disabled=${pw.length < 10 || !name.trim() || !email.trim()}>Create my account<//>
    </form>`
    : html`<form class="form" onSubmit=${joinHere}>
      <div class="okmsg"><${Icon} n="info" /><div>There's already an account for <b>${email}</b>. Sign in with its password to join ${inv.org_name}.</div></div>
      <${Field} label="Password" id="pw2"><${Password} id="pw2" value=${pw} onInput=${setPw} auto="current-password" /><//>
      <${ErrorBox} error=${err} />
      <${Btn} kind="primary" size="lg" cls="block" type="submit" busy=${busy}>Sign in and join<//>
    </form>`}
  <//>`;
}

export function Reset() {
  const app = useApp();
  const token = app.route.params[0] || '';
  const [info, setInfo] = useState(null);
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  useEffect(() => { rpc('reset_preview', { p_token: token }, { anon: true }).then(setInfo).catch(() => setInfo({ status: 'invalid' })); }, [token]);
  const submit = async (e) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const r = await edge('accounts', { op: 'reset', token, password: pw });
      await signOut();
      await enter(app, r.email, pw, null, 'home');
    } catch (x) { setErr(x); setBusy(false); }
  };
  if (!info) return html`<${AuthFrame}><div class="boot" style="min-height:200px"><span class="boot-mark"></span></div><//>`;
  if (info.status !== 'ready') {
    return html`<${AuthFrame}><h2>${info.status === 'used' ? 'This link was already used' : info.status === 'expired' ? 'This link expired' : 'This link isn\'t valid'}</h2>
      <p class="lede">Ask your company's owner or admin for a new reset link.</p><${Btn} cls="block" onClick=${() => go('signin')}>Go to sign in<//><//>`;
  }
  return html`<${AuthFrame}>
    <h2>Set a new password</h2>
    <p class="lede">For ${info.email || 'your account'}. The link works once.</p>
    <form class="form" onSubmit=${submit}>
      <${Field} label="New password" id="pw"><${Password} id="pw" value=${pw} onInput=${setPw} meter /><//>
      <${ErrorBox} error=${err} />
      <${Btn} kind="primary" size="lg" cls="block" type="submit" busy=${busy} disabled=${pw.length < 10}>Save and sign in<//>
    </form>
  <//>`;
}
