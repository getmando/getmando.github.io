// Shared helpers: names, time, roles, modules, providers, vehicle state, VIN, QR, clipboard, links.
export const C = window.APP_CONFIG || {};
export const BRAND = C.BRAND || 'Mando';

export function initials(name) {
  const w = String(name || '').replace(/[^A-Za-z0-9 &-]/g, ' ').split(/[\s-]+/).filter(Boolean);
  if (!w.length) return '?';
  return (w.length === 1 ? w[0].slice(0, 2) : w[0][0] + w[1][0]).toUpperCase();
}
export function hashColor(s) {
  const palette = ['#0A84FF', '#30B0C7', '#34C759', '#FF9F0A', '#FF6A1A', '#AF52DE', '#5E5CE6', '#FF2D55', '#A2845E', '#64D2FF'];
  let h = 0;
  for (const ch of String(s || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}
export const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || '';
export const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

// ---------- time ----------
export function ago(ts) {
  if (!ts) return 'never';
  const s = Math.round((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.round(s / 86400)} d ago`;
  return fmtDate(ts);
}
export function fmtDate(ts, tz, opts = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!ts) return '—';
  try { return new Intl.DateTimeFormat('en-US', { ...opts, timeZone: tz || undefined }).format(new Date(ts)); }
  catch { return new Date(ts).toLocaleDateString('en-US', opts); }
}
export const fmtTime = (ts, tz) => fmtDate(ts, tz, { hour: 'numeric', minute: '2-digit' });
export const fmtDateTime = (ts, tz) => fmtDate(ts, tz, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
export function dayKey(ts, tz) { return fmtDate(ts, tz, { year: 'numeric', month: '2-digit', day: '2-digit' }); }
export function dayLabel(ts, tz) {
  const k = dayKey(ts, tz);
  if (k === dayKey(Date.now(), tz)) return 'Today';
  if (k === dayKey(Date.now() - 86400000, tz)) return 'Yesterday';
  return fmtDate(ts, tz, { weekday: 'long', month: 'short', day: 'numeric' });
}
export function greeting(tz) {
  let h = new Date().getHours();
  try { h = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz || undefined }).format(new Date())) % 24; } catch { /* local */ }
  return h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
// midnight today in the company's time zone, as an ISO instant
export function startOfDay(tz) {
  const now = new Date();
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz || undefined, hour12: false, year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(now).map((p) => [p.type, p.value]));
  const secs = (Number(parts.hour) % 24) * 3600 + Number(parts.minute) * 60 + Number(parts.second);
  return new Date(Math.floor(now.getTime() / 1000 - secs) * 1000).toISOString();
}

export function phoneFmt(p) {
  const d = String(p || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : String(p || '');
}

// ---------- the business ----------
export const KINDS = {
  contractor: 'General contractor', subcontractor: 'Subcontractor', hauler: 'Hauling / trucking', supplier: 'Material supplier',
  ready_mix: 'Ready-mix concrete', vendor: 'Vendor / store', other: 'Other',
};
export const ROLES = {
  owner:      { name: 'Owner',      desc: 'Everything, including the license and who owns the company.' },
  admin:      { name: 'Admin',      desc: 'Team, settings, integrations and the fleet.' },
  dispatcher: { name: 'Dispatcher', desc: 'Runs the fleet and the live map. No team or settings.' },
  driver:     { name: 'Driver',     desc: 'Shares the phone\'s location while driving; sees the fleet.' },
  viewer:     { name: 'Viewer',     desc: 'Sees everything, changes nothing. Good for accounting.' },
};
const PERMS = {
  view: ['owner', 'admin', 'dispatcher', 'driver', 'viewer'], fleet: ['owner', 'admin', 'dispatcher'],
  team: ['owner', 'admin'], settings: ['owner', 'admin'], integrations: ['owner', 'admin'], drive: ['owner', 'admin', 'dispatcher', 'driver'],
};
export const can = (role, perm) => (PERMS[perm] || []).includes(role);
export const MODULES = {
  fleet:  { name: 'Fleet', desc: 'Trucks, trailers and equipment' },
  map:    { name: 'Live map & GPS', desc: 'Connect GPS providers, see every vehicle live' },
  driver: { name: 'Driver app', desc: 'Drivers\' phones as GPS — no hardware' },
  api:    { name: 'Open API', desc: 'Send positions from any system' },
};
export const COMING = {
  orders:  { name: 'Orders', desc: 'Vendors see purchase orders here instead of email' },
  tickets: { name: 'Tickets & ETAs', desc: 'Ready-mix delivery tickets and truck ETAs' },
  loads:   { name: 'Loads', desc: 'Haul tickets, loads and tons' },
};
export const hasModule = (org, m) => !!org?.license?.modules?.includes(m);
export const TZS = [
  ['America/Chicago', 'Central (Austin, Dallas, Houston)'], ['America/New_York', 'Eastern'], ['America/Denver', 'Mountain'],
  ['America/Phoenix', 'Arizona'], ['America/Los_Angeles', 'Pacific'], ['America/Anchorage', 'Alaska'], ['Pacific/Honolulu', 'Hawaii'],
];
export const BODIES = ['End dump', 'Belly dump', 'Side dump', 'Tandem dump', 'Tri-axle dump', 'Super dump', 'Transfer', 'Lowboy',
  'Flatbed', 'Water truck', 'Mixer', 'Pickup', 'Service truck', 'Other'];
export const ASSET_KINDS = { truck: 'Truck', trailer: 'Trailer', pickup: 'Pickup', equipment: 'Equipment', other: 'Other' };
export const ASSET_STATUS = { active: ['Active', 'green'], shop: ['In the shop', 'amber'], out: ['Out of service', 'red'], sold: ['Sold', ''] };

// GPS & other providers. `fields`: what the company types (secret ones go to Vault); `steps`: where to find them.
export const PROVIDERS = [
  { key: 'samsara', name: 'Samsara', cat: 'gps', color: '#0B2A4A', mono: 'S', blurb: 'Vehicle gateways and ELDs. Live location, speed, engine state and street address.',
    fields: [
      { key: 'api_token', label: 'API token', secret: true, placeholder: 'samsara_api_…' },
      { key: 'region', label: 'Where you sign in to Samsara', options: [['us', 'cloud.samsara.com (United States)'], ['eu', 'cloud.eu.samsara.com (Europe)'], ['ca', 'cloud.ca.samsara.com (Canada)']] },
    ],
    steps: ['In Samsara, click the gear icon (Settings) at the bottom of the left menu, scroll to API Tokens and click "Add an API Token".',
      'Name it after this app and leave Tag Access on the whole organization.',
      'Under Granular Scopes give it read access only: "Read Vehicles" and "Read Vehicle Statistics".',
      'Copy the token right away — Samsara shows it only once — and paste it here.'] },
  { key: 'motive', name: 'Motive', cat: 'gps', color: '#111827', mono: 'M', blurb: 'Formerly KeepTruckin. ELDs and vehicle gateways with live locations.',
    fields: [
      { key: 'api_key', label: 'API key', secret: true },
      { key: 'region', label: 'Motive platform', options: [['us', 'United States'], ['eu', 'Europe']] },
    ],
    steps: ['Sign in to the Motive Dashboard as a fleet admin.', 'Click the admin icon at the bottom of the left menu, scroll to Developers and click "Create an API Key" (some accounts show "Request API Key").',
      'Name it, save, and copy the key here.'] },
  { key: 'geotab', name: 'Geotab', cat: 'gps', color: '#1F4E8C', mono: 'G', blurb: 'MyGeotab GO devices. Positions, speed, ignition and street address.',
    fields: [
      { key: 'database', label: 'Database name', placeholder: 'acme_paving' },
      { key: 'username', label: 'User name', placeholder: 'api-user@yourcompany.com' },
      { key: 'password', label: 'Password', secret: true },
      { key: 'server', label: 'Server', optional: true, placeholder: 'my.geotab.com' },
    ],
    steps: ['In MyGeotab go to People → Users & Drivers → Add. Set Authentication type to "Service Account" and the security clearance to "View only", so it can read but never change anything.',
      'Your database name is in the address bar right after the server: my.geotab.com/acme_paving/ → acme_paving.',
      'Enter that user and its password. Leave Server empty unless you sign in to MyGeotab at a different address.'] },
  { key: 'verizon', name: 'Verizon Connect', cat: 'gps', color: '#CD040B', mono: 'V', beta: true, blurb: 'Reveal fleet tracking through Verizon\'s REST API.',
    fields: [
      { key: 'username', label: 'REST integration user name' },
      { key: 'password', label: 'REST integration password', secret: true },
      { key: 'app_id', label: 'App ID', placeholder: 'fleetmatics-p-us-…' },
      { key: 'region', label: 'Region', options: [['', 'From the App ID'], ['us', 'United States'], ['eu', 'Europe']] },
    ],
    steps: ['Ask Verizon Connect Customer Care for "REST API integration credentials" for your Reveal account — they are not your normal Reveal login.',
      'Get your App ID from the Verizon Connect Developer Portal (fim.us.fleetmatics.com): profile icon → My Apps → your app → Details.',
      'In Reveal, make sure every vehicle has a Vehicle Number — Verizon finds vehicles by that number.'] },
  { key: 'actsoft', name: 'Actsoft', cat: 'gps', color: '#0E7C66', mono: 'A', blurb: 'Actsoft Workforce Manager GPS trackers. Every point since the last sync.',
    fields: [{ key: 'api_key', label: 'API subscription key', secret: true }],
    steps: ['Ask Actsoft support for developer API access for your account.', 'Copy your API subscription key (Ocp-Apim-Subscription-Key) and paste it here.'] },
  { key: 'fleetio', name: 'Fleetio', cat: 'fleet', color: '#1F8A70', mono: 'F', blurb: 'Fleet maintenance records: import vehicles, plates, VINs and odometers.', soon: true },
  { key: 'quickbooks', name: 'QuickBooks Online', cat: 'accounting', color: '#2CA01C', mono: 'QB', blurb: 'Send loads and tickets to invoicing.', soon: true },
  { key: 'command_alkon', name: 'Command Alkon', cat: 'ready_mix', color: '#00539B', mono: 'CA', blurb: 'Ready-mix dispatch: delivery tickets and truck ETAs.', soon: true },
];export const providerOf = (key) => PROVIDERS.find((p) => p.key === key);

// what a vehicle is doing now, from the freshest of its GPS devices
export function vstate(devs) {
  const list = (devs || []).filter((d) => d.last_at).sort((a, b) => new Date(b.last_at) - new Date(a.last_at));
  if (!devs || !devs.length) return { key: 'none', label: 'No GPS', tone: '' };
  const d = list[0];
  if (!d) return { key: 'wait', label: 'Waiting for GPS', tone: '' };
  const min = (Date.now() - new Date(d.last_at).getTime()) / 60000;
  if (min > 60) return { key: 'lost', label: 'No signal', tone: 'red', dev: d, sub: `Last seen ${ago(d.last_at)}` };
  const mph = Number(d.last_speed_mph || 0);
  if (mph > 3) return { key: 'moving', label: `Moving · ${Math.round(mph)} mph`, tone: 'green', dev: d, sub: d.last_address || `Updated ${ago(d.last_at)}` };
  if (d.last_ignition) return { key: 'idle', label: 'Idling', tone: 'amber', dev: d, sub: d.last_address || `Updated ${ago(d.last_at)}` };
  return { key: 'stopped', label: 'Stopped', tone: 'blue', dev: d, sub: d.last_address || `Updated ${ago(d.last_at)}` };
}
export const SOURCE = { phone: 'Driver\'s phone', api: 'Open API' };
export const sourceName = (s) => SOURCE[s] || providerOf(s)?.name || s;

// ---------- VIN ----------
const TR = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9, S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9 };
const W = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
export const vinClean = (v) => String(v || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
export function vinOk(v) {
  v = vinClean(v);
  if (v.length !== 17 || /[IOQ]/.test(v)) return false;
  let sum = 0;
  for (let i = 0; i < 17; i++) sum += (/\d/.test(v[i]) ? Number(v[i]) : TR[v[i]]) * W[i];
  const c = sum % 11;
  return v[8] === (c === 10 ? 'X' : String(c));
}
const title = (s) => String(s || '').toLowerCase().replace(/\b[a-z]/g, (m) => m.toUpperCase());
// NHTSA's free public VIN decoder (vpic.nhtsa.dot.gov) — the VIN is the only thing sent
export async function decodeVin(v) {
  v = vinClean(v);
  const r = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(v)}?format=json`);
  if (!r.ok) throw new Error('lookup failed');
  const x = (await r.json())?.Results?.[0] || {};
  if (!x.Make) return null;
  const truck = /TRUCK|INCOMPLETE|BUS/i.test(x.VehicleType || '') && !/PICKUP/i.test(x.BodyClass || '');
  return { year: x.ModelYear || '', make: title(x.Make), model: x.Model || '', kind: /TRAILER/i.test(x.VehicleType || '') ? 'trailer'
    : /PICKUP/i.test(x.BodyClass || '') ? 'pickup' : truck ? 'truck' : 'truck', note: [x.BodyClass, x.GVWR].filter(Boolean).join(' · ') };
}

// ---------- links, clipboard, QR ----------
export const appLink = (route) => `${location.origin}${location.pathname}#${route}`;
export async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const t = document.createElement('textarea');
    t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    t.remove();
    return ok;
  }
}
export function qrSvg(text) {
  if (!window.qrcode) return '';
  const q = window.qrcode(0, 'M');
  q.addData(text);
  q.make();
  return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
}
export const smsLink = (body) => `sms:?&body=${encodeURIComponent(body)}`;
export const mailLink = (to, subject, body) => `mailto:${encodeURIComponent(to || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
