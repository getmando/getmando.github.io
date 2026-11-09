// The app's only door to Supabase — plain fetch, no SDK:
//   Auth     password sign-in, token refresh (shared across tabs), sign-out, password change
//   REST     table reads (RLS decides what comes back) and RPC calls (every change)
//   Storage  logo uploads; public URLs
//   Edge     the accounts / gps-sync / api functions
// Errors come back as ApiError with a plain-English message (the database's hint when it gave one); anything more
// technical the server said is kept in `raw`, for the "Details" line — never as the message.
// Every request gives up after 20 s (`timeout`), so nothing spins forever on a dead connection.
const C = window.APP_CONFIG || {};
const KEY = 'mando.session';
export const configured = !!(C.SUPABASE_URL && C.PUBLISHABLE_KEY);

export class ApiError extends Error {
  constructor(message, { code = 'error', hint = null, status = 0, raw = null } = {}) {
    super(message);
    this.code = code;
    this.hint = hint;
    this.status = status;
    this.raw = raw;
  }
}

const SAYS = {
  not_signed_in: 'Your session ended. Sign in again.',
  session_ended: 'Your session ended. Sign in again.',
  not_allowed: 'You don\'t have permission to do that.',
  not_found: 'That no longer exists.',
  invalid_input: 'Check what you entered.',
  duplicate: 'That already exists.',
  seats_full: 'All seats are in use.',
  module_off: 'This feature is not part of your license.',
  offline: 'No connection. Check the internet and try again.',
  timeout: 'This is taking too long — check the connection and try again.',
  slow_server: 'The server took too long to answer. Try again in a moment.',
};
const WAIT = 20000;

// fetch with a time limit: a dead connection becomes "offline", a stuck one "timeout"
async function send(url, init, timeout = WAIT) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeout);
  try { return await fetch(url, { ...init, signal: ac.signal }); }
  catch { throw new ApiError(ac.signal.aborted ? SAYS.timeout : SAYS.offline, { code: ac.signal.aborted ? 'timeout' : 'offline' }); }
  finally { clearTimeout(t); }
}

let session = read();
// the session ran out while someone was working: the page stays as it is and the app asks for the password again
// over it (main.js), so nothing typed is lost
let expired = false;
export const isExpired = () => expired;
const subs = new Set();
function read() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    return s && s.access_token ? s : null;
  } catch { return null; }
}
function write(s) {
  session = s;
  expired = false;
  try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY); } catch { /* private mode */ }
  subs.forEach((f) => f(s));
}
function ended() {
  if (!expired) { expired = true; subs.forEach((f) => f(session)); }
  return new ApiError(SAYS.session_ended, { code: 'session_ended', status: 401 });
}
window.addEventListener('storage', (e) => {          // another tab signed in, refreshed or signed out
  if (e.key === KEY) { session = read(); expired = false; subs.forEach((f) => f(session)); }
});
export const onSession = (f) => { subs.add(f); return () => subs.delete(f); };
export const getSession = () => session;

function claims(tok) {
  try { return JSON.parse(atob(String(tok).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch { return {}; }
}
async function readJson(r) {
  const t = await r.text();
  try { return t ? JSON.parse(t) : null; } catch { return t; }
}
function post(path, body, headers = {}, timeout = WAIT) {
  return send(C.SUPABASE_URL + path, {
    method: 'POST',
    headers: { apikey: C.PUBLISHABLE_KEY, 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  }, timeout);
}

export async function signIn(email, password) {
  const r = await post('/auth/v1/token?grant_type=password', { email: String(email).trim(), password });
  const j = await readJson(r);
  if (!r.ok) {
    const bad = j?.error_code === 'invalid_credentials' || r.status === 400;
    throw new ApiError(bad ? 'Wrong email or password.' : r.status >= 500 ? 'Could not sign in right now. Try again in a moment.' : 'Could not sign in. Try again.',
                       { code: j?.error_code || 'signin', status: r.status, raw: bad ? null : (j?.msg || j?.error_description || null) });
  }
  write(j);
  return j;
}

let refreshing = null;
async function refresh() {
  const rt = session?.refresh_token;
  if (!rt) throw ended();
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const r = await post('/auth/v1/token?grant_type=refresh_token', { refresh_token: rt });
        const j = await readJson(r);
        if (!r.ok) {
          const again = read();                          // another tab may have refreshed first
          if (again && again.refresh_token !== rt) { session = again; return again; }
          if (r.status >= 500) throw new ApiError(SAYS.slow_server, { code: 'server', status: r.status });
          throw ended();                                 // the refresh token itself was refused: sign in again
        }
        write(j);
        return j;
      } finally { refreshing = null; }
    })();
  }
  return refreshing;
}

async function token() {
  if (!session) return null;
  if (expired) throw ended();
  const exp = session.expires_at || claims(session.access_token).exp || 0;
  if (exp * 1000 - Date.now() < 60_000) await refresh();
  return session?.access_token || null;
}

// the message is always a sentence for the person on screen: the database's hint, a known code, or a plain line by
// status. The server's own text (e.g. "canceling statement due to statement timeout") goes to `raw`.
function toError(j, status) {
  const said = typeof j === 'string' ? j : (j?.message ?? j?.error ?? '');
  const code = /^[a-z_]+$/.test(said) ? said : (j?.code || 'error');
  const slow = /statement timeout|canceling statement/i.test(String(said)) || status === 504 || status === 408;
  const msg = j?.hint || SAYS[code] || (slow ? SAYS.slow_server
    : status >= 500 ? 'Something went wrong on our side. Try again.' : 'That didn\'t work. Try again.');
  const raw = [said && !/^[a-z_]+$/.test(said) ? said : null, j?.details || null].filter(Boolean).join(' · ') || null;
  return new ApiError(msg, { code: slow && code === 'error' ? 'slow_server' : code, hint: j?.hint || null, status, raw });
}

async function request(method, path, body, { anon = false, timeout = WAIT } = {}) {
  const tok = anon ? null : await token();
  const go = (t) => send(C.SUPABASE_URL + path, {
    method,
    headers: {
      apikey: C.PUBLISHABLE_KEY,
      Authorization: `Bearer ${t || C.PUBLISHABLE_KEY}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }, timeout);
  let r = await go(tok);
  if (r.status === 401 && tok) {                       // token rejected: refresh once and retry
    await refresh();
    r = await go(session?.access_token);
  }
  const j = await readJson(r);
  if (!r.ok) throw toError(j, r.status);
  return j;
}

export const rpc = (fn, args = {}, opts) => request('POST', `/rest/v1/rpc/${fn}`, args, opts);
export const select = (table, query = 'select=*') => request('GET', `/rest/v1/${table}?${query}`);

// Edge Functions answer {ok…} or {error, message} — their messages are written for people, so they're shown as they are
export async function edge(name, body, { auth = false, timeout = WAIT } = {}) {
  const tok = auth ? await token() : null;
  const r = await post(`/functions/v1/${name}`, body, tok ? { Authorization: `Bearer ${tok}` } : {}, timeout);
  const j = await readJson(r);
  if (!r.ok) {
    const own = j && typeof j === 'object' && typeof j.message === 'string' && j.error;
    throw new ApiError(own ? j.message : r.status >= 500 ? 'Something went wrong on our side. Try again.' : 'That didn\'t work. Try again.',
      { code: (j && j.error) || (r.status >= 500 ? 'server' : 'error'), status: r.status, raw: own ? null : (typeof j === 'string' ? j : j?.message || null) });
  }
  return j;
}

export async function upload(bucket, path, file) {
  const tok = await token();
  const r = await send(`${C.SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: { apikey: C.PUBLISHABLE_KEY, Authorization: `Bearer ${tok}`, 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'true' },
    body: file,
  }, 60000);
  const j = await readJson(r);
  if (!r.ok) {
    const m = String(j?.message || '');
    throw new ApiError(/size/i.test(m) ? 'That file is too big (2 MB at most).' : /mime|type/i.test(m) ? 'Use a PNG, JPG or WebP image.'
      : 'Could not upload the file.', { code: 'upload', status: r.status });
  }
  return j;
}
export const publicUrl = (bucket, path) => (path ? `${C.SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}` : null);

export async function changePassword(password) {
  const tok = await token();
  const r = await send(`${C.SUPABASE_URL}/auth/v1/user`, {
    method: 'PUT',
    headers: { apikey: C.PUBLISHABLE_KEY, Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const j = await readJson(r);
  if (!r.ok) {
    const same = j?.error_code === 'same_password' || /different from the old/i.test(String(j?.msg || ''));
    throw new ApiError(same ? 'The new password has to be different from the old one.' : 'Could not change the password. Try again.',
      { code: j?.error_code || 'password', status: r.status, raw: same ? null : (j?.msg || null) });
  }
  return j;
}

export async function signOut() {
  const tok = session?.access_token;
  write(null);
  if (tok) {
    try {
      await send(`${C.SUPABASE_URL}/auth/v1/logout`, { method: 'POST', headers: { apikey: C.PUBLISHABLE_KEY, Authorization: `Bearer ${tok}` } }, 8000);
    } catch { /* signed out here either way */ }
  }
}
