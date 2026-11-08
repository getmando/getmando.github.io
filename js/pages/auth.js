// Signed-out pages: sign in · activate a license (owner account + company) · join by invitation ·
// set a new password from a reset link. Accounts are only ever made here, through the accounts function.
// Every form says what's wrong in plain words before anything is sent (check.js); every page links to what a
// first-time visitor looks for — the price, the terms, what happens to their data, who to ask (#/about).
import { html, useState, useEffect, Icon, Mark, OrgBadge, Btn, Chip, Field, Password, ErrorBox } from '../ui.js';
import { useApp, go } from '../ctx.js';
import { rpc, edge, signIn, signOut, getSession } from '../api.js';
import { BRAND, C, KINDS, MODULES, ROLES, fmtDate, firstName, askWho } from '../util.js';
import { nameCheck, emailCheck, passwordCheck, problems, focusFirst } from '../check.js';

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
      ${[['truck', 'Your fleet, live', 'Every truck on one map — from the GPS you already use, or from your drivers\' phones.'],
         ['users', 'Your team, your rules', 'Invite people with the right role. Turn anyone\'s access off with one click.'],
         ['plug', 'Connect what you use', 'Samsara, Motive, Geotab, Verizon Connect, Actsoft — or your own software.'],
         ['shield', 'Yours alone', 'No other company on ' + BRAND + ' can see your data — the database blocks it, company by company.']]
        .map(([i, b, s]) => html`<div class="hero-pt"><div class="hp-ic"><${Icon} n=${i} /></div><div><b>${b}</b><span>${s}</span></div></div>`)}
    </div>
    <div class="hero-foot">© ${new Date().getFullYear()} ${BRAND} · <a href="#/about" style="color:inherit;text-decoration:underline">About ${BRAND} and your data</a></div>
  </section>`;
}

// the links every first-time visitor looks for, on every signed-out page (phones too: the left panel is hidden there)
function AuthFoot() {
  return html`<nav class="authfoot" aria-label="About ${BRAND}">
    <a href="#/about/pricing">What it costs</a><a href="#/about/terms">Terms</a><a href="#/about/privacy">Your data</a><a href="#/about/contact">Contact</a></nav>`;
}

function AuthFrame({ children }) {
  return html`<div class="auth"><${Hero} /><div class="authside"><div class="authcard">
    <div class="authmini"><${Mark} /><span class="wordmark">${BRAND}</span></div>
    <p class="authblurb">The command center for construction and hauling companies: your trucks, your people and your GPS in one place.</p>
    ${children}<${AuthFoot} /></div></div></div>`;
}

// before an account is made: one line with the links to read first
// (one line on purpose: a line break next to a link would eat the space before it)
const ReadFirst = () => (C.TERMS_URL
  ? html`<p class="doclinks">By creating your account you accept the <a href=${C.TERMS_URL} target="_blank" rel="noopener">license terms</a>. Also worth a look: <a href="#/about/pricing">what it costs</a> and <a href="#/about/privacy">how your data is kept</a>.</p>`
  : html`<p class="doclinks">Before you start, you can read <a href="#/about/pricing">what it costs</a>, <a href="#/about/terms">the terms</a> and <a href="#/about/privacy">how your data is kept</a> — one short page.</p>`);

// after an account exists: sign in, load the companies, open the right one (Back won't return to the form)
async function enter(app, email, password, orgId, next) {
  await signIn(email, password);
  const me = await app.loadMe();
  if (orgId) app.setOrg(orgId);
  else if (me?.orgs?.[0]) app.setOrg(me.orgs[0].id);
  go(next, { replace: true });
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
    if (busy) return;
    setErr(null); setBusy(true);
    try { await enter(app, email, pw, null, next || 'home'); }
    catch (x) { setErr(x); setBusy(false); }
  };
  const session = getSession();
  if (session && !busy) {                // already signed in (Back, an old link): say so instead of an empty form
    return html`<${AuthFrame}>
      <div><h2>You're signed in</h2></div>
      <p class="lede">As ${session.user?.email}.</p>
      <${Btn} kind="primary" size="lg" cls="block" onClick=${() => go('home', { replace: true })}>Open my command center<//>
      <${Btn} cls="block" onClick=${() => signOut()}>Sign out<//>
    <//>`;
  }
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
      <span class="dim sm">It's in the invitation email you got. Use it to create your company's command center.</span>
      <div><${Btn} size="sm" onClick=${() => go('activate')}>Activate a license<//></div>
    </div>
    <p class="authalt">Got an invitation? Open the link you were sent.<br />Forgot your password? Your company's owner or admin can make you a reset link.
      If you are the owner, write to ${C.SUPPORT_EMAIL ? html`<a href=${'mailto:' + C.SUPPORT_EMAIL}>${C.SUPPORT_EMAIL}</a>` : askWho()}.</p>
  <//>`;
}

// the license as the owner sees it before activating (and as the License desk shows it); `notes` says what the words mean
export function LicenseCard({ lic, code, notes = true }) {
  const plan = (lic.plan || 'pilot').replace(/^./, (c) => c.toUpperCase());
  return html`<div class="lic">
    <div class="l-top"><${OrgBadge} org=${{ name: lic.company_name }} cls="lg" />
      <div class="grow"><div class="l-name">${lic.company_name}</div>
        <div class="l-sub">${KINDS[lic.company_kind] || ''}${lic.contact_name ? ` · for ${lic.contact_name}` : ''}</div></div></div>
    <div class="l-chips">
      <${Chip} tone="violet" icon="spark">${plan} plan<//>
      <${Chip} icon="users">Up to ${lic.seats} people<//>
      <${Chip} icon="clock">${lic.term_months ? `${lic.term_months} months from activation` : 'No end date'}<//>
      ${(lic.modules || []).map((m) => html`<${Chip} tone="blue" key=${m}>${MODULES[m]?.name || m}<//>`)}
    </div>
    ${notes ? html`<div class="l-notes">
      ${(lic.plan || 'pilot') === 'pilot' ? html`<span><b>Pilot plan:</b> an early license, for companies starting with ${BRAND} while it is new.</span>` : null}
      <span><b>People:</b> each person you invite, and each invitation not used yet, takes one of the ${lic.seats} places ("seats").</span>
      ${(lic.modules || []).includes('api') ? html`<span><b>Open API:</b> lets your other software send truck positions — only if you need it.</span>` : null}
      <a href="#/about/pricing">What these words mean</a></div>` : null}
    ${code ? html`<div class="l-key"><span>License key</span><b>${code}</b></div>` : null}
  </div>`;
}

const LICENSE_STATE = {
  expired: ['This activation link expired', () => `Ask ${askWho()} for a new one.`],
  revoked: ['This license was cancelled', () => `Write to ${askWho()}.`],
  invalid: ['We couldn\'t find that license key', () => 'Check it and try again — dashes and capitals don\'t matter.'],
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
  const [fe, setFe] = useState({});                 // a problem per field
  const signedIn = !!getSession();

  const check = async (c) => {
    if (!c.trim()) { setErr('Type the license key from your invitation email.'); return; }
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
    if (busy) return;
    const errs = problems([['nm', nameCheck(name, { what: 'Your name', empty: 'Type your name.' })], ['em', emailCheck(email, { required: true })], ['pw', passwordCheck(pw)]]);
    setFe(errs);
    if (Object.keys(errs).length) { focusFirst(errs, { nm: 'nm', em: 'em', pw: 'pw' }); return; }
    setErr(null); setBusy(true);
    try {
      await edge('accounts', { op: 'activate', code, full_name: name.trim(), email: email.trim(), password: pw });
      await enter(app, email, pw, null, 'welcome');
    } catch (x) {
      if (x.code === 'email_exists') { setMode('existing'); setPw(''); setErr(null); }
      else setErr(x);
      setBusy(false);
    }
  };
  const activateHere = async (e) => {
    if (e) e.preventDefault();
    if (busy) return;
    setErr(null); setBusy(true);
    try {
      if (!getSession()) await signIn(email, pw);
      const r = await rpc('license_activate_self', { p_code: code, p_full_name: name || null });
      await app.loadMe();
      app.setOrg(r.org_id);
      go('welcome', { replace: true });
    } catch (x) { setErr(x); setBusy(false); }
  };

  const ready = lic?.status === 'ready';
  const used = lic?.status === 'used';
  return html`<${AuthFrame}>
    <div><h2>${ready ? `Welcome${name ? ', ' + firstName(name) : ''}` : used ? 'Already set up' : 'Activate your license'}</h2></div>
    <p class="lede">${ready ? `Your license for ${lic.company_name} is ready. Create your owner account to open its command center.`
      : used ? `${lic.company_name ? lic.company_name + '\'s' : 'This'} license was activated already — the command center exists.`
      : 'Type the license key from your invitation email.'}</p>

    ${used ? html`<div class="card pad col">
        <span class="dim sm">${signedIn ? `You're signed in as ${getSession()?.user?.email}.` : 'Sign in with the email and password you used when you activated it.'}</span>
        <${Btn} kind="primary" size="lg" cls="block" onClick=${() => go(signedIn ? 'home' : 'signin', { replace: true })}>${signedIn ? 'Open my command center' : 'Sign in'}<//>
        <span class="faint xs">Not you? Ask ${askWho()} for a new license key.</span></div>` : null}

    ${!ready && !used ? html`<form class="form" onSubmit=${(e) => { e.preventDefault(); check(code); }}>
      <${Field} label="License key" id="lk"><input id="lk" class="inp big mono" value=${code} placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" autocomplete="off"
        spellcheck="false" onInput=${(e) => setCode(e.target.value.toUpperCase())} /><//>
      ${lic && LICENSE_STATE[lic.status] ? html`<div class="err"><${Icon} n="alert" /><div><b>${LICENSE_STATE[lic.status][0]}${lic.company_name ? ` · ${lic.company_name}` : ''}</b><br />
        ${LICENSE_STATE[lic.status][1]()}</div></div>` : null}
      <${ErrorBox} error=${err} />
      <${Btn} kind="primary" size="lg" cls="block" type="submit" busy=${checking}>Continue<//>
    </form>` : null}

    ${ready ? html`<${LicenseCard} lic=${lic} code=${code} />` : null}

    ${ready && signedIn ? html`<div class="card pad col"><b>You're signed in</b>
        <span class="dim sm">Add ${lic.company_name} to your account (${getSession()?.user?.email})?</span>
        <${ErrorBox} error=${err} />
        <div class="row wrap"><${Btn} kind="primary" busy=${busy} onClick=${() => activateHere()}>Activate for this account<//>
          <${Btn} onClick=${async () => { await signOut(); }}>Use a different account<//></div></div>` : null}

    ${ready && !signedIn && mode === 'new' ? html`<form class="form" onSubmit=${activateNew} novalidate>
      <${Field} label="Your name" id="nm" error=${fe.nm}><input id="nm" class="inp" autocomplete="name" value=${name}
        onInput=${(e) => { setName(e.target.value); setFe((x) => ({ ...x, nm: null })); }} /><//>
      <${Field} label="Email" id="em" help="You'll sign in with this." error=${fe.em}><input id="em" class="inp" type="email" autocomplete="email" value=${email}
        onInput=${(e) => { setEmail(e.target.value); setFe((x) => ({ ...x, em: null })); }} /><//>
      <${Field} label="Create a password (at least 10 characters)" id="pw" error=${fe.pw}><${Password} id="pw" value=${pw} err=${!!fe.pw}
        onInput=${(v) => { setPw(v); setFe((x) => ({ ...x, pw: null })); }} meter /><//>
      <${ErrorBox} error=${err} />
      <${ReadFirst} />
      <${Btn} kind="primary" size="lg" cls="block" type="submit" busy=${busy}>Create my account<//>
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
  const [fe, setFe] = useState({});
  const signedIn = !!getSession();
  useEffect(() => {
    rpc('invite_preview', { p_token: token }, { anon: true })
      .then((p) => { setInv(p); setName(p.full_name || ''); setEmail(p.email || ''); })
      .catch((x) => { setErr(x); setInv({ status: 'invalid' }); });
  }, [token]);
  const next = inv?.role === 'driver' ? 'driver' : 'home';

  const joinNew = async (e) => {
    e.preventDefault();
    if (busy) return;
    const errs = problems([['nm', nameCheck(name, { what: 'Your name', empty: 'Type your name.' })], ['em', emailCheck(email, { required: true })], ['pw', passwordCheck(pw)]]);
    setFe(errs);
    if (Object.keys(errs).length) { focusFirst(errs, { nm: 'nm', em: 'em', pw: 'pw' }); return; }
    setErr(null); setBusy(true);
    try {
      await edge('accounts', { op: 'join', token, full_name: name.trim(), email: email.trim(), password: pw });
      await enter(app, email, pw, null, next);
    } catch (x) {
      if (x.code === 'email_exists') { setMode('existing'); setPw(''); }
      else setErr(x);
      setBusy(false);
    }
  };
  const joinHere = async (e) => {
    if (e) e.preventDefault();
    if (busy) return;
    setErr(null); setBusy(true);
    try {
      if (!getSession()) await signIn(email, pw);
      const r = await rpc('invite_accept_self', { p_token: token });
      await app.loadMe();
      app.setOrg(r.org_id);
      go(next, { replace: true });
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
    ${inv.role === 'driver' ? html`<div class="card pad col sm"><b>About your phone's location</b>
      <span class="dim">As a driver you can turn on Driver mode. Only then — and only while it says <b>Sharing</b> — your phone sends its location
        to ${inv.org_name} every 15 seconds. Tap Stop sharing at any time. Positions are kept 180 days. <a href="#/about/drivers">More about this</a></span></div>` : null}

    ${signedIn ? html`<div class="card pad col"><b>You're signed in as ${getSession()?.user?.email}</b>
        <${ErrorBox} error=${err} />
        <div class="row wrap"><${Btn} kind="primary" busy=${busy} onClick=${() => joinHere()}>Join ${inv.org_name}<//>
          <${Btn} onClick=${() => signOut()}>Use a different account<//></div></div>`
    : mode === 'new' ? html`<form class="form" onSubmit=${joinNew} novalidate>
      <${Field} label="Your name" id="nm" error=${fe.nm}><input id="nm" class="inp" autocomplete="name" value=${name}
        onInput=${(e) => { setName(e.target.value); setFe((x) => ({ ...x, nm: null })); }} /><//>
      <${Field} label="Email" id="em" help="You'll sign in with this." error=${fe.em}><input id="em" class="inp" type="email" autocomplete="email" value=${email}
        onInput=${(e) => { setEmail(e.target.value); setFe((x) => ({ ...x, em: null })); }} /><//>
      <${Field} label="Create a password (at least 10 characters)" id="pw" error=${fe.pw}><${Password} id="pw" value=${pw} err=${!!fe.pw}
        onInput=${(v) => { setPw(v); setFe((x) => ({ ...x, pw: null })); }} meter /><//>
      <${ErrorBox} error=${err} />
      <${ReadFirst} />
      <${Btn} kind="primary" size="lg" cls="block" type="submit" busy=${busy}>Create my account<//>
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
  const [fe, setFe] = useState(null);
  useEffect(() => { rpc('reset_preview', { p_token: token }, { anon: true }).then(setInfo).catch(() => setInfo({ status: 'invalid' })); }, [token]);
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const p = passwordCheck(pw);
    setFe(p);
    if (p) { focusFirst({ pw: p }, { pw: 'pw' }); return; }
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
    <form class="form" onSubmit=${submit} novalidate>
      <${Field} label="New password (at least 10 characters)" id="pw" error=${fe}><${Password} id="pw" value=${pw} err=${!!fe}
        onInput=${(v) => { setPw(v); setFe(null); }} meter /><//>
      <${ErrorBox} error=${err} />
      <${Btn} kind="primary" size="lg" cls="block" type="submit" busy=${busy}>Save and sign in<//>
    </form>
  <//>`;
}
