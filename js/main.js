// App root: who is signed in, which company, the route (#/…), the shell (sidebar / phone tab bar),
// toasts and confirm dialogs. Pages live in ./pages and read all of this through useApp().
import { html, render, useState, useEffect, Icon, Mark, OrgBadge, Avatar, Btn, Modal, Drawer, Sheet, Empty, Busy, Field, Password } from './ui.js';
import { Ctx, useApp, parseRoute, go } from './ctx.js';
import { configured, getSession, onSession, isExpired, rpc, signIn, signOut } from './api.js';
import { BRAND, C, can, hasModule, ROLES, KINDS, askWho, poss } from './util.js';
import { SignIn, Activate, Join, Reset } from './pages/auth.js';
import { About } from './pages/about.js';
import { Welcome } from './pages/welcome.js';
import { Home } from './pages/home.js';
import { LiveMap } from './pages/map.js';
import { Fleet } from './pages/fleet.js';
import { Team } from './pages/team.js';
import { Integrations } from './pages/integrations.js';
import { Activity } from './pages/activity.js';
import { Settings } from './pages/settings.js';
import { Driver } from './pages/driver.js';
import { Platform } from './pages/platform.js';


const NAV = [
  { r: 'home', label: 'Home', icon: 'home' },
  { r: 'map', label: 'Live map', icon: 'map', mod: 'map' },
  { r: 'fleet', label: 'Fleet', icon: 'truck', mod: 'fleet' },
  { r: 'team', label: 'Team', icon: 'users' },
  { r: 'integrations', label: 'Connections', icon: 'plug' },
  { r: 'activity', label: 'Activity', icon: 'activity' },
  { r: 'settings', label: 'Settings', icon: 'settings' },
  { r: 'driver', label: 'Driver mode', icon: 'nav', mod: 'driver', perm: 'drive' },
];
const DESK = { r: 'platform', label: 'License desk', icon: 'license' };
const PAGES = { home: Home, map: LiveMap, fleet: Fleet, driver: Driver, team: Team, integrations: Integrations, activity: Activity, settings: Settings };
const PUBLIC = { signin: SignIn, activate: Activate, join: Join, reset: Reset, about: About, pricing: About, terms: About, privacy: About };
// the browser tab's name for each page: "Fleet · Lone Star Aggregates · Mando"
const TITLES = {
  signin: 'Sign in', activate: 'Activate your license', join: 'Join your team', reset: 'Set a new password',
  about: 'About', pricing: 'What it costs', terms: 'Terms', privacy: 'Your data', welcome: 'Set up your company',
  platform: 'License desk', ...Object.fromEntries(NAV.map((n) => [n.r, n.label])),
};

function navFor(org) {
  if (!org) return [];
  const list = NAV.filter((n) => (!n.mod || hasModule(org, n.mod)) && (!n.perm || can(org.role, n.perm)));
  return org.role === 'driver' ? [...list.filter((n) => n.r === 'driver'), ...list.filter((n) => n.r !== 'driver')] : list;
}

function setThemeAttr(t) {
  document.documentElement.setAttribute('data-theme', t);
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.content = t === 'light' ? '#F5F5F7' : '#000000';
  try { localStorage.setItem('mando.theme', t); } catch { /* private mode */ }
}

const motionOk = () => document.documentElement.classList.contains('motion');
let redirected = '';                                  // the last address we explained a redirect for (one message each)

function App() {
  const [route, setRoute] = useState(parseRoute());
  const [sess, setSess] = useState(getSession());
  const [expired, setExpired] = useState(isExpired());
  const [me, setMe] = useState(null);
  const [meErr, setMeErr] = useState(null);
  const [orgId, setOrgId] = useState(() => { try { return localStorage.getItem('mando.org'); } catch { return null; } });
  const [toasts, setToasts] = useState([]);
  const [modal, setModal] = useState(null);
  const [theme, setTheme] = useState(document.documentElement.getAttribute('data-theme') || 'light');

  useEffect(() => {
    const f = () => { setRoute(parseRoute()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  useEffect(() => onSession((s) => { setSess(s); setExpired(isExpired()); }), []);

  const loadMe = async () => {
    try { const m = await rpc('me'); setMe(m); setMeErr(null); return m; }
    catch (e) { setMeErr(e); return null; }
  };
  useEffect(() => { if (sess) loadMe(); else { setMe(null); setMeErr(null); } }, [sess?.user?.id]);
  useEffect(() => {                       // keep the license state and seat counts fresh
    if (!sess) return undefined;
    const t = setInterval(() => { if (document.visibilityState === 'visible' && !isExpired()) loadMe(); }, 120000);
    return () => clearInterval(t);
  }, [sess?.user?.id]);
  // the session ran out: with nothing on screen yet, just show the sign-in page; mid-work, ask over the page (SignBackIn)
  useEffect(() => { if (expired && !me) signOut(); }, [expired, !!me]);
  useEffect(() => { if (!expired && sess && me) loadMe(); }, [expired]);

  const dropToast = (id) => {
    setToasts((t) => t.map((x) => (x.id === id ? { ...x, closing: true } : x)));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), motionOk() ? 160 : 0);
  };
  // good news fades by itself; a problem stays until it's closed (it may need reading twice)
  const toast = (msg, kind = 'ok') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t.slice(-2), { id, msg, kind }]);
    if (kind !== 'bad') setTimeout(() => dropToast(id), 3400);
  };
  const confirm = (opts) => new Promise((res) => setModal({ ...opts, onDone: (v) => { setModal(null); res(v); } }));
  const setOrg = (id) => { setOrgId(id); try { localStorage.setItem('mando.org', id); } catch { /* private mode */ } };
  const flipTheme = () => { const t = theme === 'dark' ? 'light' : 'dark'; setTheme(t); setThemeAttr(t); };

  const orgs = me?.orgs || [];
  const org = orgs.find((o) => o.id === orgId) || orgs.find((o) => o.access) || orgs[0] || null;
  const ctx = { route, me, org, orgs, sess, loadMe, setOrg, toast, confirm, theme, flipTheme, go };

  let page;
  let shown = route.name;
  const Pub = PUBLIC[route.name];
  if (!configured) page = html`<${NotConfigured} />`;
  else if (Pub) page = html`<${Pub} />`;
  else if (!sess) { page = html`<${SignIn} />`; shown = 'signin'; }
  else if (!me) page = meErr && !expired ? html`<${MeFailed} error=${meErr} retry=${loadMe} />` : html`<${Busy} text="Opening your command center…" />`;
  else if (route.name === 'welcome' && org?.access && can(org.role, 'settings')) page = html`<${Welcome} />`;
  else if (route.name === 'platform' && me.platform_admin) page = html`<${Shell} active="platform"><${Platform} /><//>`;
  else if (!org) { page = me.platform_admin ? html`<${Shell} active="platform"><${Platform} /><//>` : html`<${NoCompany} />`; shown = me.platform_admin ? 'platform' : ''; }
  else if (!org.access) { page = html`<${Shell} active=""><${Locked} /><//>`; shown = ''; }
  else {
    const nav = navFor(org);
    const want = PAGES[route.name] && nav.some((n) => n.r === route.name) ? route.name : nav[0]?.r || 'home';
    if (want !== route.name && route.name !== '') {
      // an address that isn't a page here (an old link, a typo, a page this role doesn't have): say so, then go on
      const to = TITLES[want] || 'Home';
      const why = PAGES[route.name] ? `${TITLES[route.name]} isn't part of your access at ${org.name}` : 'That address isn\'t a page here';
      if (redirected !== location.hash) { redirected = location.hash; setTimeout(() => toast(`${why} — here's ${to}.`, 'info'), 0); }
      setTimeout(() => go(want, { replace: true }), 0);
    }
    const P = PAGES[want];
    shown = want;
    page = html`<${Shell} active=${want}><${P} key=${org.id + want} /><//>`;
  }
  const inside = sess && me && !Pub;
  const title = [TITLES[shown], inside && org && shown !== 'platform' ? org.name : null, BRAND].filter(Boolean).join(' · ');
  useEffect(() => { document.title = title; }, [title]);

  return html`<${Ctx.Provider} value=${ctx}>${page}
    ${modal ? html`<${Modal} ...${modal} />` : null}
    ${expired && me ? html`<${SignBackIn} email=${sess?.user?.email || me?.user?.email || ''} />` : null}
    <div class="toasts" aria-live="polite">${toasts.map((t) => html`<div key=${t.id} class=${'toast ' + t.kind + (t.closing ? ' closing' : '')}
      role=${t.kind === 'bad' ? 'alert' : null}><${Icon} n=${t.kind === 'bad' ? 'alert' : t.kind === 'info' ? 'info' : 'check'} /><span class="grow">${t.msg}</span>
      ${t.kind === 'bad' ? html`<button type="button" class="x" aria-label="Close this message" onClick=${() => dropToast(t.id)}><${Icon} n="x" size="14" /></button>` : null}</div>`)}</div>
  <//>`;
}

// the session ran out while someone was working: sign in again over the page, so nothing on it is lost
function SignBackIn({ email }) {
  const [pw, setPw] = useState('');
  return html`<${Modal} title="Sign in again to carry on" ok="Sign in" cancel="Sign out" focus="#sbi-pw"
    text=${`For safety, ${BRAND} signs you out after a while. Type the password for ${email} — the page stays as it is, so nothing you typed is lost.`}
    action=${() => (pw ? signIn(email, pw) : Promise.reject(new Error('Type your password.')))}
    onDone=${(v) => { if (!v) signOut(); }}>
    <${Field} label="Password" id="sbi-pw"><${Password} id="sbi-pw" value=${pw} onInput=${setPw} auto="current-password" /><//>
  <//>`;
}

// ---------- the signed-in frame ----------
function Shell({ active, children }) {
  const { me, org, orgs, flipTheme, theme } = useApp();
  const [more, setMore] = useState(false);
  const [switching, setSwitching] = useState(false);
  const nav = navFor(org?.access ? org : null);
  const brand = org?.brand_color ? `--org:${org.brand_color}` : '';
  const multi = orgs.length > 1;
  // the phone's tab bar: the first four pages, or the License desk for a platform admin with no company open
  const tabs = nav.length ? nav.slice(0, 4) : me?.platform_admin ? [DESK] : [];
  const extra = nav.slice(4);
  const skip = (e) => { e.preventDefault(); const m = document.getElementById('content'); if (m) m.focus(); };
  const orgText = org ? html`<div class="grow"><div class="o-n tr">${org.name}</div><div class="o-s">${ROLES[org.role]?.name || org.role}${multi ? ' · switch' : ''}</div></div>` : null;
  return html`<div class="shell" style=${brand}>
    <a class="skip" href="#content" onClick=${skip}>Skip to content</a>
    <aside class="rail" aria-label="Menu">
      ${!org ? html`<div class="rail-org"><${Mark} /><div class="grow"><div class="o-n">${BRAND}</div><div class="o-s">Platform</div></div></div>`
        : multi ? html`<button type="button" class="rail-org multi" onClick=${() => setSwitching(true)} aria-label=${`${org.name}. Switch company`}>
            <${OrgBadge} org=${org} />${orgText}<${Icon} n="swap" size="16" /></button>`
        : html`<div class="rail-org"><${OrgBadge} org=${org} />${orgText}</div>`}
      <nav class="rail-nav" aria-label="Pages">
        ${nav.map((n) => html`<a key=${n.r} class=${'nav' + (active === n.r ? ' on' : '')} href=${'#/' + n.r} aria-current=${active === n.r ? 'page' : null}><${Icon} n=${n.icon} />${n.label}</a>`)}
        ${me?.platform_admin ? html`<div class="rail-sep"></div><div class="rail-lbl">Platform</div>
          <a class=${'nav' + (active === 'platform' ? ' on' : '')} href="#/platform" aria-current=${active === 'platform' ? 'page' : null}><${Icon} n="license" />License desk</a>` : null}
      </nav>
      <div class="rail-foot">
        <div class="me"><${Avatar} name=${me?.user?.name || me?.user?.email} /><div class="grow"><div class="m-n tr">${me?.user?.name || 'You'}</div>
          <div class="m-e tr">${me?.user?.email}</div></div>
          <${Btn} kind="ghost" size="sm" cls="icon" icon=${theme === 'dark' ? 'sun' : 'moon'} aria-label=${theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick=${flipTheme} /></div>
        <button type="button" class="nav" onClick=${() => signOut()}><${Icon} n="logout" />Sign out</button>
        ${org ? html`<a class="powered" href="#/about" title=${`About ${BRAND} and your data`}><${Mark} />Powered by ${BRAND}</a>` : null}
      </div>
    </aside>
    <main class="main" id="content" tabindex="-1">
      <div class="mob-top">${org ? html`<${OrgBadge} org=${org} />` : html`<${Mark} />`}
        ${multi ? html`<button type="button" class="grow mob-org" onClick=${() => setSwitching(true)} aria-label=${`${org.name}. Switch company`}>
            <div class="o-n tr">${org.name}</div><div class="o-s">${ROLES[org.role]?.name || ''} · switch</div></button>`
          : html`<div class="grow"><div class="o-n tr">${org?.name || BRAND}</div><div class="o-s">${org ? (ROLES[org.role]?.name || '') : 'Platform'}</div></div>`}
        <${Btn} kind="ghost" cls="icon" icon=${theme === 'dark' ? 'sun' : 'moon'} aria-label=${theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick=${flipTheme} />
      </div>
      ${children}
    </main>
    ${tabs.length ? html`<nav class="tabbar" aria-label="Pages">${tabs.map((n) => html`<button type="button" key=${n.r} class=${active === n.r ? 'on' : ''}
        aria-current=${active === n.r ? 'page' : null} onClick=${() => go(n.r)}><${Icon} n=${n.icon} />${n.label.replace('Driver mode', 'Drive').replace('Live map', 'Map').replace('License desk', 'Desk')}</button>`)}
      <button type="button" class=${!tabs.some((n) => n.r === active) && active ? 'on' : ''} aria-haspopup="dialog" onClick=${() => setMore(true)}><${Icon} n="more" />More</button></nav>` : null}
    ${more ? html`<${Sheet} title="More" onClose=${() => setMore(false)}>${(close) => html`<div class="sheet-list">
        ${extra.map((n) => html`<a key=${n.r} class=${'nav' + (active === n.r ? ' on' : '')} href=${'#/' + n.r}
          onClick=${(e) => { e.preventDefault(); close(() => go(n.r)); }}><${Icon} n=${n.icon} />${n.label}</a>`)}
        ${me?.platform_admin && nav.length ? html`<a class=${'nav' + (active === 'platform' ? ' on' : '')} href="#/platform"
          onClick=${(e) => { e.preventDefault(); close(() => go('platform')); }}><${Icon} n="license" />License desk</a>` : null}
        ${multi ? html`<button type="button" class="nav" onClick=${() => close(() => setSwitching(true))}><${Icon} n="swap" />Switch company</button>` : null}
        <a class="nav" href="#/about" onClick=${(e) => { e.preventDefault(); close(() => go('about')); }}><${Icon} n="shield" />About ${BRAND} and your data</a>
        <button type="button" class="nav" onClick=${() => close(() => signOut())}><${Icon} n="logout" />Sign out</button></div>`}<//>` : null}
    ${switching ? html`<${OrgSwitch} onClose=${() => setSwitching(false)} />` : null}
  </div>`;
}

function OrgSwitch({ onClose }) {
  const { orgs, org, setOrg } = useApp();
  const pick = (o) => { setOrg(o.id); onClose(); go('home'); };
  return html`<${Drawer} title="Switch company" sub="You belong to more than one company. Each one is separate." onClose=${onClose}>
    <div class="card"><div class="list">${orgs.map((o) => html`<button type="button" key=${o.id} class="li click" aria-current=${o.id === org?.id ? 'true' : null} onClick=${() => pick(o)}>
      <${OrgBadge} org=${o} /><div class="grow"><div class="li-t">${o.name}</div><div class="li-s">${ROLES[o.role]?.name} · ${KINDS[o.kind] || ''}${o.access ? ''
        : o.lock === 'disabled' ? ' · your access is turned off' : ' · license not active'}</div></div>
      ${o.id === org?.id ? html`<${Icon} n="check" />` : null}</button>`)}</div></div>
  <//>`;
}

function Locked() {
  const { org, orgs } = useApp();
  const why = { suspended: 'is suspended', revoked: 'was cancelled', expired: 'expired', disabled: 'is turned off for you', no_license: 'is missing' }[org.lock] || 'is not active';
  return html`<div class="page"><div class="card"><${Empty} icon="lock" title=${org.lock === 'disabled' ? 'Your access is turned off' : `${poss(org.name)} license ${why}`}
    text=${org.lock === 'disabled' ? `An owner or admin of ${org.name} turned off your access. Ask them to turn it back on.`
      : `Nothing was deleted — everything comes back when the license is active again. To renew it, write to ${askWho()}.`}>
    ${orgs.length > 1 ? html`<${Btn} kind="primary" icon="swap" onClick=${() => document.querySelector('.rail-org.multi')?.click()}>Switch company<//>` : null}
    <${Btn} icon="logout" onClick=${() => signOut()}>Sign out<//><//></div></div>`;
}

function NoCompany() {
  const { me } = useApp();
  return html`<div class="auth"><div class="authside" style="grid-column:1/-1"><div class="authcard">
    <div class="row"><${Mark} cls="lg" /></div>
    <h2>No company yet</h2>
    <p class="lede">You're signed in as ${me?.user?.email}, but you don't belong to a company on ${BRAND} yet.</p>
    <div class="card pad col"><b>Have a license key?</b><span class="dim sm">Activate it to set up your company's command center.</span>
      <div class="sp"></div><${Btn} kind="primary" onClick=${() => go('activate')}>Activate a license<//></div>
    <div class="card pad col"><b>Joining a team?</b><span class="dim sm">Open the invitation link your company sent you.</span></div>
    <${Btn} icon="logout" onClick=${() => signOut()}>Sign out<//>
  </div></div></div>`;
}

function MeFailed({ error, retry }) {
  const [busy, setBusy] = useState(false);
  const again = async () => { setBusy(true); await retry(); setBusy(false); };
  return html`<div class="boot"><div class="card pad col" style="max-width:420px" role="alert"><b>Couldn't load your account</b>
    <span class="dim sm">${error.message}</span><div class="row"><${Btn} kind="primary" icon="refresh" busy=${busy} onClick=${again}>Try again<//><${Btn} onClick=${() => signOut()}>Sign out<//></div></div></div>`;
}

function NotConfigured() {
  return html`<div class="boot"><div class="card pad col" style="max-width:460px"><div class="row"><${Mark} /><b>${BRAND} isn't connected yet</b></div>
    <span class="dim sm">config.js needs the platform's Supabase URL and publishable key.</span></div></div>`;
}

// iPhone Safari shows the pressed look (:active) only on pages that listen for touches
document.addEventListener('touchstart', () => {}, { passive: true });

render(html`<${App} />`, document.getElementById('app'));
