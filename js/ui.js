// Shared building blocks: htm binding, icons, buttons, fields, drawer, modal, sheet, empty and error states, chips,
// badges, rings, QR, data loading, form checks. Every component is defined once, at the top level.
import { h, render, Fragment, createContext } from 'preact';
import { useState, useEffect, useRef, useContext, useMemo, useCallback } from 'preact/hooks';
import htm from 'htm';
import { initials, hashColor, inkOn, copy, qrSvg, loadScript, fmtTime, isPhone } from './util.js';
import { publicUrl } from './api.js';
import { focusFirst } from './check.js';

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

// letters on a color the company or a provider picked: black or white, whichever reads (DESIGN.md, the initials rule)
export function OrgBadge({ org, cls = '' }) {
  const url = org?.logo_path ? publicUrl('org-public', org.logo_path) : null;
  return html`<span class=${'orgbadge ' + cls} style=${org?.brand_color ? `--org:${org.brand_color};color:${inkOn(org.brand_color)}` : ''}>
    ${url ? html`<img src=${url} alt="" />` : initials(org?.name)}</span>`;
}

export function Avatar({ name, cls = '' }) {
  const c = hashColor(name);
  return html`<span class=${'av ' + cls} style=${`--c:${c};color:${inkOn(c)}`}>${initials(name)}</span>`;
}

// `busy` shows a spinner and blocks a second press until the work is done (disabled comes after the spread, so a
// `disabled` passed in can't switch it back on)
export function Btn({ kind = '', size = '', icon, busy, children, cls = '', ...p }) {
  return html`<button type="button" ...${p} class=${`btn ${kind} ${size} ${cls}`} disabled=${!!(busy || p.disabled)} aria-busy=${busy ? 'true' : null}>
    ${busy ? html`<span class="spin"></span>` : icon ? html`<${Icon} n=${icon} />` : null}${children}</button>`;
}

export function Chip({ tone = '', icon, children, cls = '' }) {
  return html`<span class=${`chip ${tone} ${cls}`}>${icon ? html`<${Icon} n=${icon} />` : null}${children}</span>`;
}

// a labelled field; `error` (a plain sentence: what's wrong and what to type) replaces the help line and outlines it.
// The input (the element with `id`) is told about it: aria-invalid, and aria-describedby pointing at the error or the help.
export function Field({ label, help, error, children, cls = '', id }) {
  useEffect(() => {
    const el = id && document.getElementById(id);
    if (!el) return;
    if (error) { el.setAttribute('aria-invalid', 'true'); el.setAttribute('aria-describedby', id + '-err'); }
    else {
      el.removeAttribute('aria-invalid');
      if (help) el.setAttribute('aria-describedby', id + '-help'); else el.removeAttribute('aria-describedby');
    }
  }, [error, !!help, id]);
  return html`<div class=${'field ' + cls + (error ? ' bad' : '')}>${label ? html`<label for=${id}>${label}</label>` : null}${children}${error
    ? html`<div class="ferr" id=${id ? id + '-err' : undefined} role="alert">${error}</div>`
    : help ? html`<div class="help" id=${id ? id + '-help' : undefined}>${help}</div>` : null}</div>`;
}

// checks shown on the spot: a field is checked when you leave it (once something is typed in it), checked again as you
// type while it shows a problem (so the message goes away the moment it's right), and every field on save — the first
// wrong one gets the focus. `rules` = { key: (value, all) => message | null }; `ids` = { key: element id }, in screen order.
export function useForm(values, rules, ids) {
  const [errs, setErrs] = useState({});
  const msg = (k, v) => (rules[k] ? rules[k](v === undefined ? values[k] : v, values) || null : null);
  return {
    errs,
    blur: (k) => () => { if (String(values[k] ?? '').trim()) setErrs((e) => ({ ...e, [k]: msg(k) })); },
    edit: (k, v) => { if (errs[k]) setErrs((e) => ({ ...e, [k]: msg(k, v) })); },
    ok: () => {
      const e = {};
      for (const k of Object.keys(ids)) { const m = msg(k); if (m) e[k] = m; }
      setErrs(e);
      focusFirst(e, ids);
      return !Object.keys(e).length;
    },
    set: (k, m) => setErrs((e) => ({ ...e, [k]: m || null })),
  };
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

// a plain sentence; when the server said something more technical, it waits behind "Details" (for support, not for reading)
export function ErrorBox({ error, id }) {
  if (!error) return null;
  const raw = typeof error === 'string' ? null : error.raw;
  return html`<div class="err" role="alert" id=${id}><${Icon} n="alert" /><div class="grow">${typeof error === 'string' ? error : error.message}
    ${raw && raw !== error.message ? html`<details class="more"><summary>Details</summary><p>${raw}</p></details>` : null}</div></div>`;
}

// a read that failed: say so (never a false "nothing here yet") and offer to try again
export function LoadError({ what = 'this', error, retry, cls = '' }) {
  return html`<div class=${'loaderr ' + cls} role="alert"><div class="e-ic"><${Icon} n="alert" /></div>
    <div class="grow"><b>Couldn't load ${what}</b><span>${error?.message || 'Check the connection and try again.'}</span></div>
    ${retry ? html`<${Btn} size="sm" icon="refresh" onClick=${retry}>Try again<//>` : null}</div>`;
}

// a refresh that failed while the last good data stays on screen
export function Stale({ at, retry }) {
  return html`<span class="stale" role="status">Not updated since ${fmtTime(at)}${retry
    ? html`<span aria-hidden="true"> · </span><button type="button" onClick=${retry}>Retry</button>` : null}</span>`;
}

// waiting, in words (a spinner alone says nothing on a slow phone)
export function Busy({ text = 'Loading…', cls = '' }) {
  return html`<div class=${'boot ' + cls} role="status"><div class="boot-in"><span class="boot-mark"></span><span class="boot-msg">${text}</span></div></div>`;
}

export function Empty({ icon = 'spark', title, text, children, cls = '' }) {
  return html`<div class=${'empty ' + cls}><div class="e-ic"><${Icon} n=${icon} /></div>${title ? html`<h3>${title}</h3>` : null}
    ${text ? html`<p>${text}</p>` : null}${children ? html`<div class="row wrap">${children}</div>` : null}</div>`;
}

// a short choice or a filter: buttons that say which one is pressed (`n` = a count, shown once the data is in)
export function Seg({ value, options, onChange, cls = '', label }) {
  return html`<div class=${'seg ' + cls} role="group" aria-label=${label || null}>${options.map((o) => html`<button type="button" aria-pressed=${o.v === value ? 'true' : 'false'}
    class=${o.v === value ? 'on' : ''} onClick=${() => onChange(o.v)}>${o.label}${o.n !== undefined && o.n !== null ? html`<span class="n">${o.n}</span>` : null}</button>`)}</div>`;
}

export function Ring({ value, max, size = 64 }) {
  const r = (size - 8) / 2, c = 2 * Math.PI * r, f = max ? Math.min(1, value / max) : 0;
  return html`<div class="ring" style=${`width:${size}px;height:${size}px`}><svg width=${size} height=${size}>
    <circle cx=${size / 2} cy=${size / 2} r=${r} fill="none" stroke="var(--track)" stroke-width="7" />
    <circle cx=${size / 2} cy=${size / 2} r=${r} fill="none" stroke=${f >= 1 ? 'var(--green-fill)' : 'var(--accent-ink)'} stroke-width="7" stroke-linecap="round"
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

// ---------- dialogs: drawer (side panel), modal (confirm), sheet (phone menu) ----------
// One rule for all three: focus moves in, Tab stays in, Escape closes only the top one, focus goes back to the button
// that opened it, and closing plays a short animation (none when the phone or computer asks for less motion).
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';
const dialogs = [];                                   // open dialogs, top one last
const motionOk = () => document.documentElement.classList.contains('motion');
let uid = 0;
const nextId = () => 'dlg' + (++uid);

function trapTab(e, box) {
  const els = [...box.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length);
  if (!els.length) { e.preventDefault(); box.focus(); return; }
  const first = els[0], last = els[els.length - 1], at = document.activeElement;
  if (!box.contains(at)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
  else if (e.shiftKey && (at === first || at === box)) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus(); }
}

function useDialog(ref, onEscape, focusSel) {
  const esc = useRef(onEscape);
  esc.current = onEscape;
  useEffect(() => {
    const me = {};
    dialogs.push(me);
    const opener = document.activeElement;
    const box = ref.current;
    const t = setTimeout(() => {                      // after the first paint, so the slide-in isn't interrupted
      if (!box || box.contains(document.activeElement)) return;
      const el = (focusSel && box.querySelector(focusSel)) || box;
      el.focus({ preventScroll: true });
    }, 40);
    const key = (e) => {
      if (dialogs[dialogs.length - 1] !== me || !box) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); esc.current(); }
      else if (e.key === 'Tab') trapTab(e, box);
    };
    document.addEventListener('keydown', key);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', key);
      const i = dialogs.indexOf(me);
      if (i >= 0) dialogs.splice(i, 1);
      const now = document.activeElement;
      if (opener && opener.isConnected && opener !== document.body && (!now || now === document.body || !now.isConnected || box?.contains(now))) {
        try { opener.focus({ preventScroll: true }); } catch { /* gone */ }
      }
    };
  }, []);
}

// close with a short animation; a second close while it plays is ignored
function useClosing(onClose) {
  const [closing, setClosing] = useState(false);
  const done = useRef(false);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const close = (...a) => {
    if (done.current) return;
    done.current = true;
    const fin = () => {
      onClose(...a);
      setTimeout(() => { if (alive.current) { done.current = false; setClosing(false); } }, 60);   // still here: it stays open
    };
    if (!motionOk()) { fin(); return; }
    setClosing(true);
    setTimeout(fin, 150);
  };
  return [closing, close];
}

// right-hand panel; Escape, the × and the backdrop close it. Form panels put their buttons in `footer` (always visible).
export function Drawer({ title, sub, icon, onClose, wide, footer, children, head }) {
  const ref = useRef();
  const [closing, close] = useClosing(onClose);
  const [tid] = useState(nextId);
  useDialog(ref, () => close(), isPhone() ? null : '.dr-b input:not([readonly]):not([type="checkbox"]):not([type="radio"]):not([type="file"]),.dr-b select,.dr-b textarea');
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  return html`<div class=${'scrim' + (closing ? ' closing' : '')} onMouseDown=${(e) => { if (e.target === e.currentTarget) close(); }}>
    <aside class=${'drawer' + (wide ? ' wide' : '') + (closing ? ' closing' : '')} role="dialog" aria-modal="true" aria-labelledby=${tid} tabindex="-1" ref=${ref}>
      <div class="dr-h">${head || (icon ? html`<div class="li-ic"><${Icon} n=${icon} /></div>` : null)}
        <div class="grow"><h2 id=${tid}>${title}</h2>${sub ? html`<div class="sub">${sub}</div>` : null}</div>
        <${Btn} kind="ghost" cls="icon" icon="x" aria-label="Close" onClick=${() => close()} /></div>
      <div class="dr-b">${children}</div>
      ${footer ? html`<div class="dr-f">${footer}</div>` : null}
    </aside></div>`;
}

// a question before something that can't be undone. With `action`, OK runs it and stays busy until it's done; if it
// fails, the reason shows here and nothing closes.
// (a dangerous one starts on Cancel, so a stray Enter never deletes anything; `focus` picks another starting point)
export function Modal({ title, text, ok = 'OK', cancel = 'Cancel', danger, onDone, action, focus, children }) {
  const ref = useRef();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [closing, close] = useClosing(onDone);
  const [tid] = useState(nextId);
  const no = () => { if (!busy) close(false); };
  useDialog(ref, no, focus || (danger ? '[data-cancel]' : '[data-ok]'));
  const yes = async (e) => {
    if (e) e.preventDefault();
    if (busy) return;
    if (!action) { close(true); return; }
    setBusy(true); setErr(null);
    try { await action(); close(true); } catch (x) { setErr(x); setBusy(false); }
  };
  return html`<div class=${'modal-scrim' + (closing ? ' closing' : '')} onMouseDown=${(e) => { if (e.target === e.currentTarget) no(); }}>
    <form class=${'modal' + (closing ? ' closing' : '')} role="alertdialog" aria-modal="true" aria-labelledby=${tid} aria-describedby=${text ? tid + 't' : null}
      tabindex="-1" ref=${ref} onSubmit=${yes} novalidate>
      <h3 id=${tid}>${title}</h3>${text ? html`<p id=${tid + 't'}>${text}</p>` : null}${children}
      <${ErrorBox} error=${err} />
      <div class="row">${cancel ? html`<${Btn} data-cancel="1" disabled=${busy} onClick=${no}>${cancel}<//>` : null}
        <${Btn} type="submit" data-ok="1" kind=${danger ? 'danger solid' : 'primary'} busy=${busy}>${ok}<//></div></form></div>`;
}

// a menu that slides up from the bottom of a phone screen. Back, Escape or a tap outside closes it. `children` may be a
// function that gets close(then): the menu closes first, then `then` runs (so Back never lands on the old page).
export function Sheet({ title, onClose, children }) {
  const ref = useRef();
  const then = useRef(null);
  const pushed = useRef(false);
  const [closing, finish] = useClosing(() => { onClose(); const f = then.current; then.current = null; if (f) f(); });
  const close = (fn) => {
    then.current = fn || null;
    if (pushed.current && history.state && history.state.mzSheet) { pushed.current = false; history.back(); }
    else finish();
  };
  useEffect(() => {
    try { history.pushState({ ...(history.state || {}), mzSheet: 1 }, ''); pushed.current = true; } catch { /* no history */ }
    const pop = () => { pushed.current = false; finish(); };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  useDialog(ref, () => close(), null);
  return html`<div class=${'sheet-scrim' + (closing ? ' closing' : '')} onMouseDown=${(e) => { if (e.target === e.currentTarget) close(); }}>
    <div class=${'sheet' + (closing ? ' closing' : '')} role="dialog" aria-modal="true" aria-label=${title} tabindex="-1" ref=${ref}>
      ${typeof children === 'function' ? children(close) : children}</div></div>`;
}

// loads data and keeps it fresh; `every` (ms) polls while the tab is visible. `at` = when it last loaded; `error` stays
// until a load works again, so a page can show "Couldn't load…" (no data yet) or "Not updated since…" (old data).
export function useLoad(fn, deps = [], { every = 0 } = {}) {
  const [state, setState] = useState({ data: undefined, error: null, loading: true, at: 0 });
  const alive = useRef(true);
  const seq = useRef(0);
  const run = useCallback(async (quiet) => {
    const n = ++seq.current;
    if (!quiet) setState((s) => ({ ...s, loading: true }));
    try {
      const data = await fn();
      if (alive.current && n === seq.current) setState({ data, error: null, loading: false, at: Date.now() });
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
  return { ...state, failed: !!state.error && state.data === undefined, reload: () => run(true), retry: () => run(false),
    set: (data) => setState((s) => ({ ...s, data })) };
}

// ticks every `ms` so "2 min ago" stays true
export function useTick(ms = 30000) {
  const [, set] = useState(0);
  useEffect(() => { const t = setInterval(() => set((x) => x + 1), ms); return () => clearInterval(t); }, [ms]);
}
