// Shared building blocks: htm binding, icons, buttons, fields, drawer, modal, empty states, chips,
// badges, rings, QR, data loading. Every component is defined once, at the top level.
import { h, render, Fragment, createContext } from 'preact';
import { useState, useEffect, useRef, useContext, useMemo, useCallback } from 'preact/hooks';
import htm from 'htm';
import { initials, hashColor, copy, qrSvg, loadScript } from './util.js';
import { publicUrl } from './api.js';

export const html = htm.bind(h);
export { h, render, Fragment, createContext, useState, useEffect, useRef, useContext, useMemo, useCallback };

// ---------- icons (24 × 24, stroke) ----------
const I = {
  home: '<path d="M3.5 10.5 12 3.8l8.5 6.7V20a.8.8 0 0 1-.8.8H15v-6h-6v6H4.3a.8.8 0 0 1-.8-.8z"/>',
  map: '<path d="M9 4.5 3.8 6.6v12.9L9 17.4l6 2.1 5.2-2.1V4.5L15 6.6z"/><path d="M9 4.5v12.9M15 6.6v12.9"/>',
  truck: '<path d="M14 16.5V6.5a1 1 0 0 0-1-1H3.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h1.2M14 16.5H9.3"/><path d="M14 9h3.6l3.4 3.8v2.7a1 1 0 0 1-1 1h-.7"/><circle cx="7" cy="17" r="2.1"/><circle cx="17" cy="17" r="2.1"/>',
  trailer: '<path d="M2.5 6.5h15v9h-15zM17.5 13.5h4"/><circle cx="6.5" cy="17.5" r="2"/><circle cx="12" cy="17.5" r="2"/>',
  users: '<circle cx="9" cy="8.2" r="3.3"/><path d="M3 19.8c.7-3.4 3-5.3 6-5.3s5.3 1.9 6 5.3"/><circle cx="16.8" cy="9.3" r="2.6"/><path d="M16.4 14.6c2.6 0 4.2 1.6 4.8 4.4"/>',
  user: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20c.8-3.9 3.7-6 7.5-6s6.7 2.1 7.5 6"/>',
  plug: '<path d="M9 3.5v4M15 3.5v4"/><path d="M6.5 7.5h11v3.2a5.5 5.5 0 0 1-11 0z"/><path d="M12 16.2v4.3"/>',
  activity: '<path d="M3.5 12h3.8l2.4-6 4.6 12 2.4-6h3.8"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.5-2-3.4-2.3 1a7.5 7.5 0 0 0-2.6-1.5L14 2.6h-4l-.5 2.5A7.5 7.5 0 0 0 6.9 6.6l-2.3-1-2 3.4 2 1.5a7.6 7.6 0 0 0 0 3l-2 1.5 2 3.4 2.3-1a7.5 7.5 0 0 0 2.6 1.5l.5 2.5h4l.5-2.5a7.5 7.5 0 0 0 2.6-1.5l2.3 1 2-3.4z"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2 20 3M16 7l3 3M18 5l2 2"/>',
  logout: '<path d="M14 4.5h4.5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H14"/><path d="M10 16.5 5.5 12 10 7.5M5.5 12H15"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.3"/><path d="m20 20-4.6-4.6"/>',
  chevR: '<path d="m9 6 6 6-6 6"/>', chevL: '<path d="m15 6-6 6 6 6"/>', chevD: '<path d="m6 9 6 6 6-6"/>',
  check: '<path d="M5 12.5 10 17.5 19 7"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
  qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 14h2M14 18v2M18 18h2v2"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M11 18.5h2"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4 7 8 6 8-6"/>',
  msg: '<path d="M4.5 5.5h15a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-4.5 3.5v-3.5h-1a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
  signal: '<circle cx="12" cy="12" r="2.2"/><path d="M7.8 16.2a6 6 0 0 1 0-8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 19a10 10 0 0 1 0-14M19 5a10 10 0 0 1 0 14"/>',
  alert: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.2v.3"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.2"/>',
  shield: '<path d="M12 3.5 5 6v5.5c0 4.4 3 7.7 7 9 4-1.3 7-4.6 7-9V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M5.3 18.7l1.5-1.5M17.2 6.8l1.5-1.5"/>',
  moon: '<path d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1z"/>',
  upload: '<path d="M12 15.5V4.5M7.5 9 12 4.5 16.5 9"/><path d="M4.5 15v3.5a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V15"/>',
  download: '<path d="M12 4.5v11M7.5 11 12 15.5 16.5 11"/><path d="M4.5 15v3.5a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V15"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.9 12.2a1 1 0 0 0 1 .9h7.2a1 1 0 0 0 1-.9L17.5 7"/>',
  edit: '<path d="M4.5 19.5h4l10-10-4-4-10 10z"/><path d="m13 7 4 4"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>',
  pause: '<path d="M9 5.5v13M15 5.5v13"/>', play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  external: '<path d="M14 4.5h5.5V10M19.5 4.5 11 13"/><path d="M18 14v4.5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1H10"/>',
  building: '<path d="M5 20.5V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v15.5M15 9.5h3a1 1 0 0 1 1 1v10M3.5 20.5h17"/><path d="M8.5 8h3M8.5 11.5h3M8.5 15h3"/>',
  spark: '<path d="M12 3.5 13.8 10.2 20.5 12 13.8 13.8 12 20.5 10.2 13.8 3.5 12 10.2 10.2z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z"/>',
  layers: '<path d="M12 4.2l8.3 4.4L12 13 3.7 8.6z"/><path d="M3.7 12.6L12 17l8.3-4.4"/><path d="M3.7 16.4L12 20.8l8.3-4.4"/>',
  code: '<path d="m8.5 8-4 4 4 4M15.5 8l4 4-4 4"/>',
  box: '<path d="M12 3.2l7.8 4.3v9L12 20.8l-7.8-4.3v-9z"/><path d="M4.4 7.6L12 11.8l7.6-4.2M12 11.8v8.8"/>',
  dollar: '<path d="M12 3.5v17M16 7.5c-.7-1.4-2.2-2-4-2-2.3 0-4 1.2-4 3s1.7 2.6 4 3 4 1.2 4 3-1.7 3-4 3c-1.9 0-3.4-.7-4-2.1"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18M10.6 5.6A9.9 9.9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.5 6.9C3.9 8.6 2.5 12 2.5 12s3.5 6.5 9.5 6.5a9.6 9.6 0 0 0 4.4-1.1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  send: '<path d="M20.5 3.5 10 14M20.5 3.5 14 20.5l-4-6.5-6.5-4z"/>',
  swap: '<path d="M7 7.5h11.5l-3-3M17 16.5H5.5l3 3"/>',
  help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.4a2.5 2.5 0 0 1 4.8.8c0 1.7-2.4 2-2.4 3.8M12 16.8v.2"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.7-7.7z"/><path d="M14.7 6.3 17.2 3.8"/>',
  gauge: '<path d="M4.5 16a7.5 7.5 0 1 1 15 0"/><path d="m12 16 3.5-4.5"/>',
  nav: '<path d="M12 3.5 19 20 12 16.2 5 20z"/>',
  more: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
  license: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><circle cx="8.5" cy="11" r="2"/><path d="M5.8 15.5c.5-1.3 1.5-2 2.7-2s2.2.7 2.7 2M13.5 9.5h4M13.5 12.5h4"/>',
};
export function Icon({ n, cls, size = 18 }) {     // CSS sizes it where a container says so; 18 px otherwise
  return html`<svg class=${cls} width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: I[n] || '' }}></svg>`;
}

export function Mark({ cls = '' }) {
  return html`<span class=${'mark ' + cls}><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M15 45V21.5l17 15 17-15V45" fill="none" stroke="#fff"
    stroke-width="6.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="32" cy="36.5" r="3.6" fill="#fff"/></svg></span>`;
}

export function OrgBadge({ org, cls = '' }) {
  const url = org?.logo_path ? publicUrl('org-public', org.logo_path) : null;
  return html`<span class=${'orgbadge ' + cls} style=${org?.brand_color ? `--org:${org.brand_color}` : ''}>
    ${url ? html`<img src=${url} alt="" />` : initials(org?.name)}</span>`;
}

export function Avatar({ name, cls = '' }) {
  return html`<span class=${'av ' + cls} style=${`--c:${hashColor(name)}`}>${initials(name)}</span>`;
}

export function Btn({ kind = '', size = '', icon, busy, children, cls = '', ...p }) {
  return html`<button type="button" class=${`btn ${kind} ${size} ${cls}`} disabled=${busy || p.disabled} ...${p}>
    ${busy ? html`<span class="spin"></span>` : icon ? html`<${Icon} n=${icon} />` : null}${children}</button>`;
}

export function Chip({ tone = '', icon, children, cls = '' }) {
  return html`<span class=${`chip ${tone} ${cls}`}>${icon ? html`<${Icon} n=${icon} />` : null}${children}</span>`;
}

// a labelled field; `error` (a plain sentence: what's wrong and what to type) replaces the help line and outlines it
export function Field({ label, help, error, children, cls = '', id }) {
  return html`<div class=${'field ' + cls + (error ? ' bad' : '')}>${label ? html`<label for=${id}>${label}</label>` : null}${children}${error
    ? html`<div class="ferr" role="alert">${error}</div>` : help ? html`<div class="help">${help}</div>` : null}</div>`;
}

export function Password({ value, onInput, placeholder = '', auto = 'new-password', meter = false, id, err = false }) {
  const [show, setShow] = useState(false);
  const s = !value ? 0 : value.length < 10 ? 1 : (/[a-z]/.test(value) + /[A-Z]/.test(value) + /\d/.test(value) + /[^A-Za-z0-9]/.test(value) + (value.length >= 14)) >= 3 ? 4 : 3;
  return html`<div class="col">
    <div class="inwrap"><input id=${id} class="inp" type=${show ? 'text' : 'password'} value=${value} placeholder=${placeholder} autocomplete=${auto}
      onInput=${(e) => onInput(e.target.value)} />
      <button type="button" class="in-act" onClick=${() => setShow(!show)} aria-label=${show ? 'Hide password' : 'Show password'}>${show ? 'Hide' : 'Show'}</button></div>
    ${meter ? html`<div class=${'strength s' + s}><i></i><i></i><i></i><i></i></div>` : null}
    ${meter && !err ? html`<div class="help">${s === 0 ? 'At least 10 characters.' : s === 1 ? `${10 - value.length} more character${10 - value.length === 1 ? '' : 's'}.` : s === 3 ? 'Good. Mix in capitals, numbers or symbols to make it stronger.' : 'Strong password.'}</div>` : null}
  </div>`;
}

export function ErrorBox({ error }) {
  if (!error) return null;
  return html`<div class="err" role="alert"><${Icon} n="alert" /><div>${typeof error === 'string' ? error : error.message}</div></div>`;
}

export function Empty({ icon = 'spark', title, text, children, cls = '' }) {
  return html`<div class=${'empty ' + cls}><div class="e-ic"><${Icon} n=${icon} /></div>${title ? html`<h3>${title}</h3>` : null}
    ${text ? html`<p>${text}</p>` : null}${children ? html`<div class="row wrap">${children}</div>` : null}</div>`;
}

export function Seg({ value, options, onChange, cls = '' }) {
  return html`<div class=${'seg ' + cls} role="tablist">${options.map((o) => html`<button type="button" role="tab" aria-selected=${o.v === value}
    class=${o.v === value ? 'on' : ''} onClick=${() => onChange(o.v)}>${o.label}${o.n !== undefined ? html`<span class="n">${o.n}</span>` : null}</button>`)}</div>`;
}

export function Ring({ value, max, size = 64 }) {
  const r = (size - 8) / 2, c = 2 * Math.PI * r, f = max ? Math.min(1, value / max) : 0;
  return html`<div class="ring" style=${`width:${size}px;height:${size}px`}><svg width=${size} height=${size}>
    <circle cx=${size / 2} cy=${size / 2} r=${r} fill="none" stroke="var(--track)" stroke-width="7" />
    <circle cx=${size / 2} cy=${size / 2} r=${r} fill="none" stroke=${f >= 1 ? 'var(--green-f)' : 'var(--accent)'} stroke-width="7" stroke-linecap="round"
      stroke-dasharray=${`${c * f} ${c}`} /></svg><div class="rv">${value}/${max}</div></div>`;
}

// the QR library loads only when a code is shown (it isn't needed to open the app)
export function Qr({ text }) {
  const [ready, setReady] = useState(!!window.qrcode);
  useEffect(() => { if (!ready) loadScript('./vendor/qrcode.js').then(() => setReady(true)).catch(() => {}); }, []);
  return html`<div class="qr" dangerouslySetInnerHTML=${{ __html: ready ? qrSvg(text) : '' }}></div>`;
}

export function CopyLine({ value, toast, label = 'Copy' }) {
  const go = async () => {
    const ok = await copy(value);
    if (toast) toast(ok ? 'Copied' : 'Select it and copy it by hand', ok ? 'ok' : 'bad');
  };
  return html`<div class="linkline"><input class="inp" readonly value=${value} onFocus=${(e) => e.target.select()} />
    <${Btn} icon="copy" onClick=${go}>${label}<//></div>`;
}

export function Top({ title, sub, children }) {
  return html`<header class="topbar"><div class="grow"><h1>${title}</h1>${sub ? html`<div class="sub">${sub}</div>` : null}</div>
    ${children ? html`<div class="row wrap">${children}</div>` : null}</header>`;
}

export function Skel({ h = 16, w = '100%', cls = '' }) {
  return html`<div class=${'sk ' + cls} style=${`height:${h}px;width:${w}`}></div>`;
}

// right-hand sheet; Escape and the backdrop close it
export function Drawer({ title, sub, icon, onClose, wide, footer, children, head }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, []);
  return html`<div class="scrim" onMouseDown=${(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <aside class=${'drawer' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label=${title}>
      <div class="dr-h">${head || (icon ? html`<div class="li-ic"><${Icon} n=${icon} /></div>` : null)}
        <div class="grow"><h2>${title}</h2>${sub ? html`<div class="sub">${sub}</div>` : null}</div>
        <${Btn} kind="ghost" cls="icon" icon="x" aria-label="Close" onClick=${onClose} /></div>
      <div class="dr-b">${children}</div>
      ${footer ? html`<div class="dr-f">${footer}</div>` : null}
    </aside></div>`;
}

export function Modal({ title, text, ok = 'OK', cancel = 'Cancel', danger, onDone, children }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onDone(false); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  return html`<div class="modal-scrim" onMouseDown=${(e) => { if (e.target === e.currentTarget) onDone(false); }}>
    <div class="modal" role="alertdialog" aria-modal="true"><h3>${title}</h3>${text ? html`<p>${text}</p>` : null}${children}
      <div class="row">${cancel ? html`<${Btn} onClick=${() => onDone(false)}>${cancel}<//>` : null}
        <${Btn} kind=${danger ? 'danger solid' : 'primary'} onClick=${() => onDone(true)} autoFocus>${ok}<//></div></div></div>`;
}

// loads data and keeps it fresh; `every` (ms) polls while the tab is visible
export function useLoad(fn, deps = [], { every = 0 } = {}) {
  const [state, setState] = useState({ data: undefined, error: null, loading: true });
  const alive = useRef(true);
  const seq = useRef(0);
  const run = useCallback(async (quiet) => {
    const n = ++seq.current;
    if (!quiet) setState((s) => ({ ...s, loading: true }));
    try {
      const data = await fn();
      if (alive.current && n === seq.current) setState({ data, error: null, loading: false });
    } catch (error) {
      if (alive.current && n === seq.current) setState((s) => ({ ...s, error, loading: false }));
    }
  }, deps);
  useEffect(() => {
    alive.current = true;
    run(false);
    let t = null;
    if (every) t = setInterval(() => { if (document.visibilityState === 'visible') run(true); }, every);
    return () => { alive.current = false; if (t) clearInterval(t); };
  }, [run]);
  return { ...state, reload: () => run(true), set: (data) => setState((s) => ({ ...s, data })) };
}

// ticks every `ms` so "2 min ago" stays true
export function useTick(ms = 30000) {
  const [, set] = useState(0);
  useEffect(() => { const t = setInterval(() => set((x) => x + 1), ms); return () => clearInterval(t); }, [ms]);
}
