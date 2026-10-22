// App root: who is signed in, which company, the route (#/…), the shell (sidebar / phone tab bar),
// toasts and confirm dialogs. Pages live in ./pages and read all of this through useApp().
import { html, render, useState, useEffect, Icon, Mark, OrgBadge, Avatar, Btn, Modal, Drawer, Empty } from './ui.js';
import { Ctx, useApp, parseRoute, go } from './ctx.js';
import { configured, getSession, onSession, rpc, signOut } from './api.js';
import { BRAND, C, can, hasModule, ROLES, KINDS } from './util.js';
import { SignIn, Activate, Join, Reset } from './pages/auth.js';
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
  { r: 'integrations', label: 'Integrations', icon: 'plug' },
  { r: 'activity', label: 'Activity', icon: 'activity' },
  { r: 'settings', label: 'Settings', icon: 'settings' },
  { r: 'driver', label: 'Driver mode', icon: 'nav', mod: 'driver', perm: 'drive' },
];
const PAGES = { home: Home, map: LiveMap, fleet: Fleet, driver: Driver, team: Team, integrations: Integrations, activity: Activity, settings: Settings };
const PUBLIC = { signin: SignIn, activate: Activate, join: Join, reset: Reset };

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

function App() {
  const [route, setRoute] = useState(parseRoute());
  const [sess, setSess] = useState(getSession());
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
  useEffect(() => onSession((s) => setSess(s)), []);

  const loadMe = async () => {
    try { const m = await rpc('me'); setMe(m); setMeErr(null); return m; }
    catch (e) { setMeErr(e); return null; }
  };
  useEffect(() => { if (sess) loadMe(); else { setMe(null); setMeErr(null); } }, [sess?.user?.id]);
  useEffect(() => {                       // keep the license state and seat counts fresh
    if (!sess) return undefined;
    const t = setInterval(() => { if (document.visibilityState === 'visible') loadMe(); }, 120000);
    return () => clearInterval(t);
  }, [sess?.user?.id]);

  const toast = (msg, kind = 'ok') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t.slice(-2), { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3400);
  };
  const confirm = (opts) => new Promise((res) => setModal({ ...opts, onDone: (v) => { setModal(null); res(v); } }));
  const setOrg = (id) => { setOrgId(id); try { localStorage.setItem('mando.org', id); } catch { /* private mode */ } };
  const flipTheme = () => { const t = theme === 'dark' ? 'light' : 'dark'; setTheme(t); setThemeAttr(t); };

  const orgs = me?.orgs || [];
  const org = orgs.find((o) => o.id === orgId) || orgs.find((o) => o.access) || orgs[0] || null;
  const ctx = { route, me, org, orgs, sess, loadMe, setOrg, toast, confirm, theme, flipTheme, go };

  let page;
  const Pub = PUBLIC[route.name];
  if (!configured) page = html`<${NotConfigured} />`;
  else if (Pub) page = html`<${Pub} />`;
  else if (!sess) page = html`<${SignIn} />`;
  else if (!me) page = meErr ? html`<${MeFailed} error=${meErr} retry=${loadMe} />` : html`<div class="boot"><span class="boot-mark"></span></div>`;
  else if (route.name === 'welcome' && org?.access && can(org.role, 'settings')) page = html`<${Welcome} />`;
  else if (route.name === 'platform' && me.platform_admin) page = html`<${Shell} active="platform"><${Platform} /><//>`;
  else if (!org) page = me.platform_admin ? html`<${Shell} active="platform"><${Platform} /><//>` : html`<${NoCompany} />`;
  else if (!org.access) page = html`<${Shell} active=""><${Locked} /><//>`;
  else {
    const nav = navFor(org);
    const want = PAGES[route.name] && nav.some((n) => n.r === route.name) ? route.name : nav[0]?.r || 'home';
    if (want !== route.name && route.name !== '') setTimeout(() => go(want), 0);
    const P = PAGES[want];
    page = html`<${Shell} active=${want}><${P} key=${org.id + want} /><//>`;
  }

  return html`<${Ctx.Provider} value=${ctx}>${page}
    ${modal ? html`<${Modal} ...${modal} />` : null}
    <div class="toasts" aria-live="polite">${toasts.map((t) => html`<div key=${t.id} class=${'toast ' + t.kind}>
      <${Icon} n=${t.kind === 'bad' ? 'alert' : 'check'} />${t.msg}</div>`)}</div>
  <//>`;
}

// ---------- the signed-in frame ----------
function Shell({ active, children }) {
  const { me, org, orgs, flipTheme, theme } = useApp();
  const [more, setMore] = useState(false);
  const [switching, setSwitching] = useState(false);
  const nav = navFor(org?.access ? org : null);
  const brand = org?.brand_color ? `--org:${org.brand_color}` : '';
  const tabs = nav.slice(0, 4);
  return html`<div class="shell" style=${brand}>
    <aside class="rail">
      ${org ? html`<button type="button" class=${'rail-org' + (orgs.length > 1 ? ' switch' : '')} onClick=${() => orgs.length > 1 && setSwitching(true)}>
        <${OrgBadge} org=${org} /><div class="grow"><div class="o-n tr">${org.name}</div><div class="o-s">${ROLES[org.role]?.name || org.role}${orgs.length > 1 ? ' · switch' : ''}</div></div>
        ${orgs.length > 1 ? html`<${Icon} n="swap" size="16" />` : null}</button>`
        : html`<div class="rail-org"><${Mark} /><div class="grow"><div class="o-n">${BRAND}</div><div class="o-s">Platform</div></div></div>`}
      ${nav.map((n) => html`<a key=${n.r} class=${'nav' + (active === n.r ? ' on' : '')} href=${'#/' + n.r}><${Icon} n=${n.icon} />${n.label}</a>`)}
      ${me?.platform_admin ? html`<div class="rail-sep"></div><div class="rail-lbl">Platform</div>
        <a class=${'nav' + (active === 'platform' ? ' on' : '')} href="#/platform"><${Icon} n="license" />License desk</a>` : null}
      <div class="rail-foot">
        <div class="me"><${Avatar} name=${me?.user?.name || me?.user?.email} /><div class="grow"><div class="m-n tr">${me?.user?.name || 'You'}</div>
          <div class="m-e tr">${me?.user?.email}</div></div>
          <${Btn} kind="ghost" size="sm" cls="icon" icon=${theme === 'dark' ? 'sun' : 'moon'} aria-label="Light or dark" onClick=${flipTheme} /></div>
        <button type="button" class="nav" onClick=${() => signOut()}><${Icon} n="logout" />Sign out</button>
        ${org ? html`<div class="powered"><${Mark} />Powered by ${BRAND}</div>` : null}
      </div>
    </aside>
    <div class="main">
      <div class="mob-top">${org ? html`<${OrgBadge} org=${org} />` : html`<${Mark} />`}
        <div class="grow" onClick=${() => orgs.length > 1 && setSwitching(true)}><div class="o-n tr">${org?.name || BRAND}</div>
          <div class="o-s">${org ? (ROLES[org.role]?.name || '') : 'Platform'}</div></div>
        <${Btn} kind="ghost" cls="icon" icon=${theme === 'dark' ? 'sun' : 'moon'} aria-label="Light or dark" onClick=${flipTheme} />
      </div>
      ${children}
    </div>
    ${nav.length ? html`<nav class="tabbar">${tabs.map((n) => html`<button type="button" key=${n.r} class=${active === n.r ? 'on' : ''}
        onClick=${() => go(n.r)}><${Icon} n=${n.icon} />${n.label.replace('Driver mode', 'Drive').replace('Live map', 'Map')}</button>`)}
      <button type="button" class=${nav.slice(4).some((n) => n.r === active) || active === 'platform' ? 'on' : ''} onClick=${() => setMore(true)}><${Icon} n="more" />More</button></nav>` : null}
    ${more ? html`<${Drawer} title="More" onClose=${() => setMore(false)}>
      <div class="col">${nav.map((n) => html`<a key=${n.r} class=${'nav' + (active === n.r ? ' on' : '')} href=${'#/' + n.r} onClick=${() => setMore(false)}>
        <${Icon} n=${n.icon} />${n.label}</a>`)}
        ${me?.platform_admin ? html`<a class=${'nav' + (active === 'platform' ? ' on' : '')} href="#/platform" onClick=${() => setMore(false)}><${Icon} n="license" />License desk</a>` : null}
        ${orgs.length > 1 ? html`<button type="button" class="nav" onClick=${() => { setMore(false); setSwitching(true); }}><${Icon} n="swap" />Switch company</button>` : null}
        <button type="button" class="nav" onClick=${() => signOut()}><${Icon} n="logout" />Sign out</button></div>
      <//>` : null}
    ${switching ? html`<${OrgSwitch} onClose=${() => setSwitching(false)} />` : null}
  </div>`;
}

function OrgSwitch({ onClose }) {
  const { orgs, org, setOrg } = useApp();
  return html`<${Drawer} title="Switch company" sub="You belong to more than one company. Each one is separate." onClose=${onClose}>
    <div class="card"><div class="list">${orgs.map((o) => html`<div key=${o.id} class="li click" onClick=${() => { setOrg(o.id); onClose(); go('home'); }}>
      <${OrgBadge} org=${o} /><div class="grow"><div class="li-t">${o.name}</div><div class="li-s">${ROLES[o.role]?.name} · ${KINDS[o.kind] || ''}${o.access ? '' : ' · license not active'}</div></div>
      ${o.id === org?.id ? html`<${Icon} n="check" />` : null}</div>`)}</div></div>
  <//>`;
}

function Locked() {
  const { org, orgs } = useApp();
  const why = { suspended: 'is suspended', revoked: 'was cancelled', expired: 'expired', disabled: 'is turned off for you', no_license: 'is missing' }[org.lock] || 'is not active';
  return html`<div class="page"><div class="card"><${Empty} icon="lock" title=${org.lock === 'disabled' ? 'Your access is turned off' : `${org.name}'s license ${why}`}
    text=${org.lock === 'disabled' ? `An owner or admin of ${org.name} turned off your access. Ask them to turn it back on.`
      : `Nothing was deleted — everything comes back when the license is active again. ${C.SUPPORT_EMAIL ? 'Contact ' + C.SUPPORT_EMAIL + '.' : 'Contact your provider.'}`}>
    ${orgs.length > 1 ? html`<${Btn} icon="swap" onClick=${() => document.querySelector('.rail-org')?.click()}>Switch company<//>` : null}
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
  return html`<div class="boot"><div class="card pad col" style="max-width:420px"><b>Couldn't load your account</b>
    <span class="dim sm">${error.message}</span><div class="row"><${Btn} kind="primary" onClick=${retry}>Try again<//><${Btn} onClick=${() => signOut()}>Sign out<//></div></div></div>`;
}

function NotConfigured() {
  return html`<div class="boot"><div class="card pad col" style="max-width:460px"><div class="row"><${Mark} /><b>${BRAND} isn't connected yet</b></div>
    <span class="dim sm">config.js needs the platform's Supabase URL and publishable key.</span></div></div>`;
}

render(html`<${App} />`, document.getElementById('app'));
