// The first-run setup an owner sees right after activating: company → trucks → people → GPS → done.
// Every step can be skipped; Home keeps a checklist until all four are done. Each step has its own address
// (#/welcome/fleet…), so the browser's Back and Forward move between steps instead of leaving the setup.
// One main button per step: the step's own action (Add, Create invitation, Connect and test) until it has something,
// then Continue.
import { html, useState, useEffect, useRef, Icon, Mark, OrgBadge, Btn, Chip, useLoad, Skel, LoadError } from '../ui.js';
import { useApp, go } from '../ctx.js';
import { rpc } from '../api.js';
import { loadOrg, loadAssets, loadIntegrations, loadInvites } from '../data.js';
import { BRAND, PROVIDERS, BUILTIN, ROLES, firstName, hasModule, appLink, providerOf, fmtDate, phoneFmt, plural } from '../util.js';
import { CompanyForm } from '../parts/company.js';
import { QuickAdd, vehicleLine, vehicleIcon } from '../parts/asset.js';
import { InviteForm } from '../parts/invite.js';
import { ProviderConnect, ProviderLogo } from '../parts/connect.js';
import { Logo } from './integrations.js';

const STEPS = [
  { k: 'company', label: 'Company' },
  { k: 'fleet', label: 'Trucks', mod: 'fleet' },
  { k: 'team', label: 'People' },
  { k: 'gps', label: 'GPS', mod: 'map' },
];

export function Welcome() {
  const app = useApp();
  const { org, me, toast, confirm, route } = app;
  const steps = STEPS.filter((s) => !s.mod || hasModule(org, s.mod));
  const ob = org.onboarding || {};
  const firstOpen = () => steps.find((s) => !ob[s.k])?.k || 'done';
  const asked = route.params[0];
  const step = asked && (asked === 'done' || steps.some((s) => s.k === asked)) ? asked : null;
  useEffect(() => { if (!step) go('welcome/' + firstOpen(), { replace: true }); }, [step]);
  const cur = step || firstOpen();
  const full = useLoad(() => loadOrg(org.id), [org.id]);
  const moved = useRef(0);
  const mark = async (k, state) => { try { await rpc('onboarding_mark', { p_org: org.id, p_step: k, p_state: state }); } catch { /* not worth stopping the setup */ } app.loadMe(); };
  const goStep = (k) => { moved.current = Date.now(); go('welcome/' + k); window.scrollTo(0, 0); };
  const next = (k, state = 'done') => {
    if (Date.now() - moved.current < 900) return;      // the 2nd click of a double-click lands on the next step's button
    mark(k, state);
    const i = steps.findIndex((s) => s.k === k);
    goStep(steps[i + 1]?.k || 'done');
  };
  const finish = async () => { await mark('done', 'done'); go('home'); };

  return html`<div class="wel">
    <div class="wel-top"><${OrgBadge} org=${org} /><div class="grow"><b>${org.name}</b><div class="dim xs">${cur === 'done' ? 'Your command center is ready' : 'Setting up your command center'}</div></div>
      ${cur === 'done' ? null : html`<${Btn} kind="ghost" size="sm" onClick=${() => go('home')}>Finish later<//>`}</div>
    <div class="wel-body">
      ${cur !== 'done' ? html`<div class="wel-hello">
        <h1>Welcome to ${BRAND}, ${firstName(me?.user?.name) || 'there'}.</h1>
        <p>Let's set up ${org.name}. It takes about five minutes. You can skip any step and finish it later from Home.</p></div>
        <div class="stepper">${steps.map((s, i) => {
          const done = ob[s.k] === 'done';                    // a finished step keeps its tick, also while you're on it
          const cls = cur === s.k ? 'on' : done ? 'done' : ob[s.k] === 'skipped' ? 'skipped' : '';
          return html`<button type="button" key=${s.k} class=${'st ' + cls} aria-current=${cur === s.k ? 'step' : null} onClick=${() => goStep(s.k)}>
            <span class="st-n">${done ? html`<${Icon} n="check" />` : i + 1}</span>${s.label}</button>`;
        })}</div>` : null}

      ${cur === 'company' ? html`<div class="card"><div class="card-h"><h3>Your company</h3></div><div class="card-b">
        ${full.data ? html`<${CompanyForm} key=${full.data.id} org=${full.data} toast=${toast} saveLabel="Save and continue"
            onSaved=${(saved, o) => { app.loadMe(); if (!o.logoOnly) { full.reload(); next('company'); } }} />`
          : full.failed ? html`<${LoadError} what="your company" error=${full.error} retry=${full.retry} />` : html`<${Skel} h=${240} />`}</div></div>` : null}

      ${cur === 'fleet' ? html`<${FleetStep} org=${org} onNext=${(s) => next('fleet', s)} />` : null}

      ${cur === 'team' ? html`<${TeamStep} org=${org} me=${me} toast=${toast} loadMe=${app.loadMe} onNext=${(s) => next('team', s)} />` : null}

      ${cur === 'gps' ? html`<${GpsStep} org=${org} toast=${toast} confirm=${confirm} onNext=${(s) => next('gps', s)} />` : null}

      ${cur === 'done' ? html`<${Done} org=${org} onOpen=${finish} />` : null}
    </div></div>`;
}

function FleetStep({ org, onNext }) {
  const assets = useLoad(() => loadAssets(org.id), [org.id]);
  const list = assets.data || [];
  return html`<div class="card"><div class="card-h"><h3 class="grow">Add your trucks</h3>${list.length ? html`<${Chip} tone="green">${list.length} added<//>` : null}</div>
    <div class="card-b col gap-16">
      <p class="dim">Type a unit number. Add the VIN and we'll fill in year, make and model — and GPS will find the truck by it later.</p>
      <${QuickAdd} org=${org} primary=${!list.length} onAdded=${() => assets.reload()} />
      ${assets.failed ? html`<${LoadError} what="your trucks" error=${assets.error} retry=${assets.retry} />` : null}
      ${list.length ? html`<div class="card"><div class="list">${list.map((a) => html`<div class="li" key=${a.id}><div class="li-ic"><${Icon} n=${vehicleIcon(a.kind)} /></div>
        <div class="grow"><div class="li-t">${a.unit_no}</div><div class="li-s">${[vehicleLine(a), a.plate, a.vin && `VIN …${a.vin.slice(-6)}`].filter(Boolean).join(' · ') || 'No details yet'}</div></div>
        <${Icon} n="check" cls="green" /></div>`)}</div></div>` : null}
      <p class="dim xs">Trailers, pickups and equipment can be added later in Fleet, with every detail.</p>
    </div>
    <div class="card-f"><${Btn} kind="ghost" onClick=${() => onNext('skipped')}>Skip for now<//><span class="grow"></span>
      <${Btn} kind=${list.length ? 'primary' : ''} onClick=${() => onNext(list.length ? 'done' : 'skipped')}>Continue<//></div></div>`;
}

// people: who's invited already (it survives Back and Reload), then the form; Continue counts only if someone was invited
function TeamStep({ org, me, toast, loadMe, onNext }) {
  const inv = useLoad(() => loadInvites(org.id), [org.id]);
  const list = (inv.data || []).filter((i) => new Date(i.expires_at) > new Date());
  return html`<div class="card"><div class="card-h"><h3 class="grow">Invite your people</h3>${list.length ? html`<${Chip} tone="green">${list.length} invited<//>` : null}</div>
    <div class="card-b col gap-16"><p class="dim">Dispatchers, drivers, office — each gets a link to make their own login. You choose what they can do.</p>
      ${list.length ? html`<div class="card invited"><div class="list">${list.map((i) => html`<div class="li" key=${i.id}><div class="li-ic"><${Icon} n="send" /></div>
          <div class="grow"><div class="li-t">${i.full_name} · ${ROLES[i.role]?.name}</div>
            <div class="li-s">Invited · the link works until ${fmtDate(i.expires_at, org.timezone)}${i.phone ? ' · ' + phoneFmt(i.phone) : ''}${i.email ? ' · ' + i.email : ''}</div></div>
          <${Icon} n="check" cls="green" /></div>`)}</div>
        <div class="card-f dim xs">Lost a link? In Team, cancel that invitation and invite them again.</div></div>` : null}
      <${InviteForm} org=${org} me=${me} toast=${toast} primary=${!list.length} onCreated=${() => { loadMe(); inv.reload(); }} /></div>
    <div class="card-f"><${Btn} kind="ghost" onClick=${() => onNext('skipped')}>Skip for now<//><span class="grow"></span>
      <${Btn} kind=${list.length ? 'primary' : ''} onClick=${() => onNext(list.length ? 'done' : 'skipped')}>Continue<//></div></div>`;
}

function GpsStep({ org, toast, confirm, onNext }) {
  const [pick, setPick] = useState(null);
  const panel = useRef(null);
  const integ = useLoad(() => loadIntegrations(org.id), [org.id]);
  const gps = PROVIDERS.filter((p) => p.cat === 'gps');
  const rowOf = (k) => (integ.data || []).find((i) => i.provider === k);
  const options = [
    ...gps.map((p) => ({ key: p.key, name: p.name, desc: p.blurb, logo: html`<${ProviderLogo} p=${p} />`, beta: p.beta })),
    ...(hasModule(org, 'driver') ? [{ key: 'phones', name: 'Drivers\' phones', desc: 'No trackers? Drivers open the app, pick their truck and tap Start.', logo: html`<${Logo} p=${BUILTIN.driver} />` }] : []),
    ...(hasModule(org, 'api') ? [{ key: 'api', name: 'Open API', desc: 'Your own software sends truck positions, with your company\'s key.', logo: html`<${Logo} p=${BUILTIN.api} />` }] : []),
  ];
  // the form opens under all the choices: bring it to the screen, right away
  const choose = (k) => { setPick(k); setTimeout(() => panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); };
  const connected = (integ.data || []).filter((i) => i.status === 'connected').length;
  return html`<div class="card"><div class="card-h"><h3 class="grow">Connect your trucks' GPS</h3>${connected ? html`<${Chip} tone="green" icon="signal">${connected} connected<//>` : null}</div>
    <div class="card-b col gap-16">
      <p class="dim">Pick the GPS company you already use and connect your own account.
        Your login is saved encrypted, and only your company sees the trucks. <a href="#/about/gps">How we keep it</a></p>
      <div class="pcards">${options.map((o) => html`<button type="button" key=${o.key} class=${'pcard' + (pick === o.key ? ' picked' : '')} aria-pressed=${pick === o.key} onClick=${() => choose(o.key)}>
        <div class="pc-top">${o.logo}<div class="grow"><div class="pc-n">${o.name}</div></div>${o.beta ? html`<${Chip}>Beta<//>` : null}</div>
        <div class="pc-d">${o.desc}</div>
        <div class="pc-s">${rowOf(o.key)?.status === 'connected' ? html`<${Chip} tone="green" icon="check">Connected<//>` : null}</div></button>`)}</div>
      <div ref=${panel} style="scroll-margin-top:16px">
      ${pick && providerOf(pick) ? html`<div class="card pad"><div class="row mb-12"><${ProviderLogo} p=${providerOf(pick)} /><h3>${providerOf(pick).name}</h3></div>
        <${ProviderConnect} key=${pick} org=${org} provider=${providerOf(pick)} integ=${rowOf(pick)} toast=${toast} confirm=${confirm} onChanged=${() => integ.reload()} /></div>` : null}
      ${pick === 'phones' ? html`<div class="card pad col"><b>Drivers' phones as GPS</b>
        <span class="dim sm">Invite your drivers (previous step). On their phone they sign in, open Driver mode, pick the truck they're in today and tap Start. Their truck shows on your map while the screen stays on.</span>
        <span class="dim sm">Driver mode link: <span class="mono">${appLink('/driver')}</span></span></div>` : null}
      ${pick === 'api' ? html`<div class="card pad col"><b>Open API</b><span class="dim sm">Create a key in Connections → Open API, then your software can send positions. The page there shows the exact request.</span></div>` : null}
      </div>
    </div>
    <div class="card-f"><${Btn} kind="ghost" onClick=${() => onNext('skipped')}>Skip for now<//><span class="grow"></span>
      <${Btn} kind=${connected || !pick || !providerOf(pick) ? 'primary' : ''} onClick=${() => onNext(connected ? 'done' : 'skipped')}>Finish<//></div></div>`;
}

function Done({ org, onOpen }) {
  const assets = useLoad(() => loadAssets(org.id), [org.id]);
  const integ = useLoad(() => loadIntegrations(org.id), [org.id]);
  const ready = !!(assets.data && integ.data);
  const n = assets.data?.length || 0;
  const g = (integ.data || []).filter((i) => i.status === 'connected').length;
  const [opening, setOpening] = useState(false);       // marking the setup done takes a moment: show it's working
  const open = async () => { if (opening) return; setOpening(true); try { await onOpen(); } catch { setOpening(false); } };
  return html`<div class="card"><div class="done-hero">
    <div class="done-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 10 17.5 19 7" /></svg></div>
    <h1>${org.name} is ready.</h1>
    <p class="dim done-p">Everything in your command center belongs to ${org.name},
      and no other company can see it. <a href="#/about/privacy">How your data is kept</a></p>
    ${ready ? html`<div class="row wrap center">
      <${Chip} icon="truck">${plural(n, 'vehicle')}<//><${Chip} icon="users">${org.seats_used} of ${org.license?.seats} seats in use<//>
      <${Chip} tone=${g ? 'green' : ''} icon="signal">${g ? `${g} GPS connected` : 'GPS not connected yet'}<//></div>`
      : html`<div class="dim sm" role="status">Checking what you set up…</div>`}
    <div class="sp"></div>
    <${Btn} kind="primary" size="lg" busy=${opening} onClick=${open}>Open my command center<//>
    <div class="row gap-4 dim xs"><${Mark} cls="" />${BRAND}</div>
  </div></div>`;
}
