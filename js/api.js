// The app's only door to Supabase — plain fetch, no SDK:
//   Auth     password sign-in, token refresh (shared across tabs), sign-out, password change
//   REST     table reads (RLS decides what comes back) and RPC calls (every change)
//   Storage  logo uploads; public URLs
//   Edge     the accounts / gps-sync / api functions
// Errors come back as ApiError with a plain-English message (the database's hint when it gave one).
const C = window.APP_CONFIG || {};
const KEY = 'mando.session';
export const configured = !!(C.SUPABASE_URL && C.PUBLISHABLE_KEY);

export class ApiError extends Error {
  constructor(message, { code = 'error', hint = null, status = 0 } = {}) {
    super(message);
    this.code = code;
    this.hint = hint;
    this.status = status;
  }
}

const SAYS = {
  not_signed_in: 'Your session ended. Sign in again.',
  not_allowed: 'You don\'t have permission to do that.',
  not_found: 'That no longer exists.',
  invalid_input: 'Check what you entered.',
  duplicate: 'That already exists.',
  seats_full: 'All seats are in use.',
  module_off: 'This feature is not part of your license.',
  offline: 'No connection. Check the internet and try again.',
};

let session = read();
const subs = new Set();
function read() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    return s && s.access_token ? s : null;
  } catch { return null; }
}
function write(s) {
  session = s;
  try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY); } catch { /* private mode */ }
  subs.forEach((f) => f(s));
}
window.addEventListener('storage', (e) => {          // another tab signed in, refreshed or signed out
  if (e.key === KEY) { session = read(); subs.forEach((f) => f(session)); }
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
async function post(path, body, headers = {}) {
  try {
    return await fetch(C.SUPABASE_URL + path, {
      method: 'POST',
      headers: { apikey: C.PUBLISHABLE_KEY, 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(SAYS.offline, { code: 'offline' });
  }
}

export async function signIn(email, password) {
  const r = await post('/auth/v1/token?grant_type=password', { email: String(email).trim(), password });
  const j = await readJson(r);
  if (!r.ok) {
    const bad = j?.error_code === 'invalid_credentials' || r.status === 400;
    throw new ApiError(bad ? 'Wrong email or password.' : (j?.msg || j?.error_description || 'Could not sign in. Try again.'),
                       { code: j?.error_code || 'signin', status: r.status });
  }
  write(j);
  return j;
}

let refreshing = null;
async function refresh() {
  const rt = session?.refresh_token;
  if (!rt) throw new ApiError(SAYS.not_signed_in, { code: 'session_ended', status: 401 });
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const r = await post('/auth/v1/token?grant_type=refresh_token', { refresh_token: rt });
        const j = await readJson(r);
        if (!r.ok) {
          const again = read();                          // another tab may have refreshed first
          if (again && again.refresh_token !== rt) { session = again; return again; }
          write(null);
          throw new ApiError(SAYS.not_signed_in, { code: 'session_ended', status: 401 });
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
  const exp = session.expires_at || claims(session.access_token).exp || 0;
  if (exp * 1000 - Date.now() < 60_000) await refresh();
  return session?.access_token || null;
}

function toError(j, status) {
  const raw = j?.message ?? j?.error ?? '';
  const code = /^[a-z_]+$/.test(raw) ? raw : (j?.code || 'error');
  const msg = j?.hint || SAYS[code] || (typeof j?.message === 'string' && !/^[a-z_]+$/.test(j.message) ? j.message : null)
    || (status >= 500 ? 'Something went wrong on our side. Try again.' : 'That didn\'t work. Try again.');
  return new ApiError(msg, { code, hint: j?.hint || null, status });
}

async function request(method, path, body, { anon = false } = {}) {
  const tok = anon ? null : await token();
  const go = (t) => fetch(C.SUPABASE_URL + path, {
    method,
    headers: {
      apikey: C.PUBLISHABLE_KEY,
      Authorization: `Bearer ${t || C.PUBLISHABLE_KEY}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let r;
  try { r = await go(tok); } catch { throw new ApiError(SAYS.offline, { code: 'offline' }); }
  if (r.status === 401 && tok) {                       // token rejected: refresh once and retry
    await refresh();
    try { r = await go(session?.access_token); } catch { throw new ApiError(SAYS.offline, { code: 'offline' }); }
  }
  const j = await readJson(r);
  if (!r.ok) throw toError(j, r.status);
  return j;
}

export const rpc = (fn, args = {}, opts) => request('POST', `/rest/v1/rpc/${fn}`, args, opts);
export const select = (table, query = 'select=*') => request('GET', `/rest/v1/${table}?${query}`);

// Edge Functions answer {ok…} or {error, message}
export async function edge(name, body, { auth = false } = {}) {
  const tok = auth ? await token() : null;
  const r = await post(`/functions/v1/${name}`, body, tok ? { Authorization: `Bearer ${tok}` } : {});
  const j = await readJson(r);
  if (!r.ok) throw new ApiError(j?.message || 'Something went wrong. Try again.', { code: j?.error || 'error', status: r.status });
  return j;
}

export async function upload(bucket, path, file) {
  const tok = await token();
  let r;
  try {
    r = await fetch(`${C.SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
      method: 'POST',
      headers: { apikey: C.PUBLISHABLE_KEY, Authorization: `Bearer ${tok}`, 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'true' },
      body: file,
    });
  } catch { throw new ApiError(SAYS.offline, { code: 'offline' }); }
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
  let r;
  try {
    r = await fetch(`${C.SUPABASE_URL}/auth/v1/user`, {
      method: 'PUT',
      headers: { apikey: C.PUBLISHABLE_KEY, Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
  } catch { throw new ApiError(SAYS.offline, { code: 'offline' }); }
  const j = await readJson(r);
  if (!r.ok) throw new ApiError(j?.msg || 'Could not change the password.', { code: j?.error_code || 'password', status: r.status });
  return j;
}

export async function signOut() {
  const tok = session?.access_token;
  write(null);
  if (tok) {
    try {
      await fetch(`${C.SUPABASE_URL}/auth/v1/logout`, { method: 'POST', headers: { apikey: C.PUBLISHABLE_KEY, Authorization: `Bearer ${tok}` } });
    } catch { /* signed out here either way */ }
  }
}
