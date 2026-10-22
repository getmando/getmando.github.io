// The first-run setup an owner sees right after activating: company → trucks → people → GPS → done.
// Every step can be skipped; Home keeps a checklist until all four are done.
import { html, useState, Icon, Mark, OrgBadge, Btn, Chip, useLoad, Skel } from '../ui.js';
import { useApp, go } from '../ctx.js';
import { rpc } from '../api.js';
import { loadOrg, loadAssets, loadIntegrations } from '../data.js';
import { BRAND, PROVIDERS, firstName, hasModule, appLink, providerOf } from '../util.js';
import { CompanyForm } from '../parts/company.js';
import { QuickAdd, vehicleLine, vehicleIcon } from '../parts/asset.js';
import { InviteForm } from '../parts/invite.js';
import { ProviderConnect, ProviderLogo } from '../parts/connect.js';

const STEPS = [
  { k: 'company', label: 'Company' },
  { k: 'fleet', label: 'Trucks', mod: 'fleet' },
  { k: 'team', label: 'People' },
  { k: 'gps', label: 'GPS', mod: 'map' },
];

export function Welcome() {
  const app = useApp();
  const { org, me, toast, confirm } = app;
  const steps = STEPS.filter((s) => !s.mod || hasModule(org, s.mod));
  const ob = org.onboarding || {};
  const [step, setStep] = useState(() => steps.find((s) => !ob[s.k])?.k || 'done');
  const full = useLoad(() => loadOrg(org.id), [org.id]);
  const mark = async (k, state) => { try { await rpc('onboarding_mark', { p_org: org.id, p_step: k, p_state: state }); } catch { /* not worth stopping the setup */ } app.loadMe(); };
  const next = (k, state = 'done') => {
    mark(k, state);
    const i = steps.findIndex((s) => s.k === k);
    setStep(steps[i + 1]?.k || 'done');
    window.scrollTo(0, 0);
  };
  const finish = async () => { await mark('done', 'done'); go('home'); };

  return html`<div class="wel">
    <div class="wel-top"><${OrgBadge} org=${org} /><div class="grow"><b>${org.name}</b><div class="dim xs">Setting up your command center</div></div>
      <${Btn} kind="ghost" size="sm" onClick=${() => go('home')}>Finish later<//></div>
    <div class="wel-body">
      ${step !== 'done' ? html`<div class="wel-hello">
        <h1>Welcome to ${BRAND}, ${firstName(me?.user?.name) || 'there'}.</h1>
        <p>Let's set up ${org.name}. It takes about five minutes — skip anything and finish it later from Home.</p></div>
        <div class="stepper">${steps.map((s, i) => {
          const state = step === s.k ? 'on' : (ob[s.k] || 'open');
          return html`<button type="button" key=${s.k} class=${'st ' + (state === 'done' ? 'done' : state === 'skipped' ? 'skipped' : state === 'on' ? 'on' : '')} onClick=${() => setStep(s.k)}>
            <span class="st-n">${state === 'done' ? html`<${Icon} n="check" />` : i + 1}</span>${s.label}</button>`;
        })}</div>` : null}

      ${step === 'company' ? html`<div class="card"><div class="card-h"><h3>Your company</h3></div><div class="card-b">
        ${full.data ? html`<${CompanyForm} org=${full.data} toast=${toast} saveLabel="Save and continue"
            onSaved=${(saved, o) => { app.loadMe(); if (!o.logoOnly) next('company'); }} />` : html`<${Skel} h=${240} />`}</div></div>` : null}

      ${step === 'fleet' ? html`<${FleetStep} org=${org} onNext=${(s) => next('fleet', s)} />` : null}

      ${step === 'team' ? html`<div class="card"><div class="card-h"><h3 class="grow">Invite your people</h3></div>
        <div class="card-b col" style="gap:14px"><p class="dim">Dispatchers, drivers, office — each gets a link to make their own login. You choose what they can do.</p>
          <${InviteForm} org=${org} me=${me} toast=${toast} onCreated=${() => app.loadMe()} /></div>
        <div class="card-f"><${Btn} kind="ghost" onClick=${() => next('team', 'skipped')}>Skip for now<//><span class="grow"></span>
          <${Btn} kind="primary" onClick=${() => next('team')}>Continue<//></div></div>` : null}

      ${step === 'gps' ? html`<${GpsStep} org=${org} toast=${toast} confirm=${confirm} onNext=${(s) => next('gps', s)} />` : null}

      ${step === 'done' ? html`<${Done} org=${org} onOpen=${finish} />` : null}
    </div></div>`;
}

function FleetStep({ org, onNext }) {
  const assets = useLoad(() => loadAssets(org.id), [org.id]);
  const list = assets.data || [];
  return html`<div class="card"><div class="card-h"><h3 class="grow">Add your trucks</h3>${list.length ? html`<${Chip} tone="green">${list.length} added<//>` : null}</div>
    <div class="card-b col" style="gap:14px">
      <p class="dim">Type a unit number. Add the VIN and we'll fill in year, make and model — and GPS will find the truck by it later.</p>
      <${QuickAdd} org=${org} onAdded=${() => assets.reload()} />
      ${list.length ? html`<div class="card"><div class="list">${list.map((a) => html`<div class="li" key=${a.id}><div class="li-ic"><${Icon} n=${vehicleIcon(a.kind)} /></div>
        <div class="grow"><div class="li-t">${a.unit_no}</div><div class="li-s">${[vehicleLine(a), a.plate, a.vin && `VIN …${a.vin.slice(-6)}`].filter(Boolean).join(' · ') || 'No details yet'}</div></div>
        <${Icon} n="check" cls="green" /></div>`)}</div></div>` : null}
      <p class="faint xs">Trailers, pickups and equipment can be added later in Fleet, with every detail.</p>
    </div>
    <div class="card-f"><${Btn} kind="ghost" onClick=${() => onNext('skipped')}>Skip for now<//><span class="grow"></span>
      <${Btn} kind="primary" onClick=${() => onNext(list.length ? 'done' : 'skipped')}>Continue<//></div></div>`;
}

function GpsStep({ org, toast, confirm, onNext }) {
  const [pick, setPick] = useState(null);
  const integ = useLoad(() => loadIntegrations(org.id), [org.id]);
  const gps = PROVIDERS.filter((p) => p.cat === 'gps');
  const rowOf = (k) => (integ.data || []).find((i) => i.provider === k);
  const options = [
    ...gps.map((p) => ({ key: p.key, name: p.name, desc: p.blurb, logo: html`<${ProviderLogo} p=${p} />`, beta: p.beta })),
    ...(hasModule(org, 'driver') ? [{ key: 'phones', name: 'Drivers\' phones', desc: 'No trackers? Drivers open the app, pick their truck and tap Start.', logo: html`<span class="plogo" style="--c:#34C759"><${Icon} n="phone" /></span>` }] : []),
    ...(hasModule(org, 'api') ? [{ key: 'api', name: 'Open API', desc: 'Another system sends positions with your own API key.', logo: html`<span class="plogo" style="--c:#5E5CE6"><${Icon} n="code" /></span>` }] : []),
  ];
  const connected = (integ.data || []).filter((i) => i.status === 'connected').length;
  return html`<div class="card"><div class="card-h"><h3 class="grow">Connect your trucks' GPS</h3>${connected ? html`<${Chip} tone="green" icon="signal">${connected} connected<//>` : null}</div>
    <div class="card-b col" style="gap:14px">
      <p class="dim">Pick the GPS you already use. You connect your own account — your credentials stay encrypted and only your company sees the trucks.</p>
      <div class="pcards">${options.map((o) => html`<button type="button" key=${o.key} class=${'pcard' + (pick === o.key ? ' sel' : '')} onClick=${() => setPick(o.key)}>
        <div class="pc-top">${o.logo}<div class="grow"><div class="pc-n">${o.name}</div></div>${o.beta ? html`<${Chip}>Beta<//>` : null}</div>
        <div class="pc-d">${o.desc}</div>
        <div class="pc-s">${rowOf(o.key)?.status === 'connected' ? html`<${Chip} tone="green" icon="check">Connected<//>` : null}</div></button>`)}</div>
      ${pick && providerOf(pick) ? html`<div class="card pad"><div class="row" style="margin-bottom:12px"><${ProviderLogo} p=${providerOf(pick)} /><h3>${providerOf(pick).name}</h3></div>
        <${ProviderConnect} key=${pick} org=${org} provider=${providerOf(pick)} integ=${rowOf(pick)} toast=${toast} confirm=${confirm} onChanged=${() => integ.reload()} /></div>` : null}
      ${pick === 'phones' ? html`<div class="card pad col"><b>Drivers' phones as GPS</b>
        <span class="dim sm">Invite your drivers (previous step). On their phone they sign in, open Driver mode, pick the truck they're in today and tap Start. Their truck shows on your map while the screen stays on.</span>
        <span class="dim sm">Driver mode link: <span class="mono">${appLink('/driver')}</span></span></div>` : null}
      ${pick === 'api' ? html`<div class="card pad col"><b>Open API</b><span class="dim sm">Create a key in Integrations → Open API, then any system can send positions. The page there shows the exact request.</span></div>` : null}
    </div>
    <div class="card-f"><${Btn} kind="ghost" onClick=${() => onNext('skipped')}>Skip for now<//><span class="grow"></span>
      <${Btn} kind="primary" onClick=${() => onNext(connected ? 'done' : 'skipped')}>Finish<//></div></div>`;
}

function Done({ org, onOpen }) {
  const assets = useLoad(() => loadAssets(org.id), [org.id]);
  const integ = useLoad(() => loadIntegrations(org.id), [org.id]);
  const n = assets.data?.length || 0;
  const g = (integ.data || []).filter((i) => i.status === 'connected').length;
  return html`<div class="card"><div class="done-hero">
    <div class="done-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 10 17.5 19 7" /></svg></div>
    <h1>${org.name} is live.</h1>
    <p class="dim" style="max-width:460px">Your command center is ready. Everything in it belongs to ${org.name} — nobody outside your company can see it.</p>
    <div class="row wrap" style="justify-content:center">
      <${Chip} icon="truck">${n} vehicle${n === 1 ? '' : 's'}<//><${Chip} icon="users">${org.seats_used} of ${org.license?.seats} seats<//>
      <${Chip} tone=${g ? 'green' : ''} icon="signal">${g ? `${g} GPS connected` : 'GPS not connected yet'}<//></div>
    <div class="sp"></div>
    <${Btn} kind="primary" size="lg" onClick=${onOpen}>Open my command center<//>
    <div class="row" style="gap:6px;color:var(--faint);font-size:12px"><${Mark} cls="" />${BRAND}</div>
  </div></div>`;
}
