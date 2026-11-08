// Form checks with plain messages — what is wrong and what to type instead — run before anything is saved, so junk
// is never stored silently and nothing is cut without a word. Each check returns null when the value is fine.
// The database keeps its own limits; these are for the person typing.
const t = (v) => String(v ?? '').trim();
const HTMLISH = /[<>]/;

// a name: a person, a company, a vehicle's unit number
export function nameCheck(v, { what = 'Name', max = 80, required = true, empty } = {}) {
  const s = t(v);
  if (!s) return required ? (empty || `Type the ${what.toLowerCase()}.`) : null;
  if (!/[\p{L}\p{N}]/u.test(s)) return `${what} needs letters or numbers.`;
  if (HTMLISH.test(s)) return `${what} can't have < or > in it.`;
  if (s.length > max) return `${what} is too long: ${max} characters at most (this one has ${s.length}).`;
  return null;
}
export function textCheck(v, { what = 'This', max = 120 } = {}) {
  const s = t(v);
  if (!s) return null;
  if (HTMLISH.test(s)) return `${what} can't have < or > in it.`;
  if (s.length > max) return `${what} is too long: ${max} characters at most.`;
  return null;
}
export function emailCheck(v, { required = false } = {}) {
  const s = t(v);
  if (!s) return required ? 'Type an email address.' : null;
  return /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[A-Za-z]{2,}$/.test(s) ? null : 'Check the email address. It should look like name@company.com.';
}
export function phoneCheck(v) {
  const s = t(v);
  if (!s) return null;
  if (/[^\d\s().+-]/.test(s.replace(/\s*(ext\.?|x)\s*\d+$/i, ''))) return 'Use only numbers for the phone, like (512) 555-0100.';
  const d = s.replace(/\s*(ext\.?|x)\s*\d+$/i, '').replace(/\D/g, '');
  return d.length >= 10 && d.length <= 15 ? null : 'A phone number has 10 digits, like (512) 555-0100.';
}
export const cityCheck = (v) => { const s = t(v); return !s ? null : /\p{L}/u.test(s) && !HTMLISH.test(s) ? null : 'Type the city name, like Austin.'; };
export const stateCheck = (v) => { const s = t(v); return !s ? null : /^[A-Za-z]{2}$/.test(s) ? null : 'Use the 2-letter state code, like TX.'; };
export const zipCheck = (v) => { const s = t(v); return !s ? null : /^\d{5}(-\d{4})?$/.test(s) ? null : 'A ZIP code has 5 numbers, like 78744.'; };
export const usdotCheck = (v) => { const s = t(v); return !s ? null : /^\d{1,8}$/.test(s) ? null : 'A USDOT number has only numbers (up to 8).'; };
export const mcCheck = (v) => { const s = t(v); return !s ? null : /^(MC[\s-]?)?\d{1,8}$/i.test(s) ? null : 'An MC number has only numbers (up to 8), like 123456.'; };
export const plateCheck = (v) => { const s = t(v); return !s ? null : /^[A-Za-z0-9][A-Za-z0-9 -]{0,9}$/.test(s) ? null : 'A plate has only letters and numbers, like TXA1234.'; };
export const yearCheck = (v) => { const s = t(v); const y = Number(s); return !s ? null : /^\d{4}$/.test(s) && y >= 1950 && y <= new Date().getFullYear() + 2 ? null : 'Type the year with 4 numbers, like 2021.'; };
export const numberCheck = (v, what = 'This') => { const s = t(v).replace(/,/g, ''); return !s ? null : /^\d+(\.\d+)?$/.test(s) && Number(s) < 1e7 ? null : `${what} should be a number, like 12.`; };
export const passwordCheck = (v) => {
  const n = String(v || '').length;
  return n >= 10 ? null : n ? `Your password needs at least 10 characters. It has ${n} — add ${10 - n} more.` : 'Create a password with at least 10 characters.';
};

// run several checks: { field: message } with only the problems; focus the first bad field (ids in the same order)
export function problems(list) {
  const out = {};
  for (const [k, msg] of list) if (msg) out[k] = msg;
  return out;
}
export function focusFirst(errs, ids) {
  const k = Object.keys(ids).find((x) => errs[x]);
  if (!k) return;
  setTimeout(() => { const el = document.getElementById(ids[k]); if (el) { el.focus(); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }, 0);
}
