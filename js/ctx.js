// The app-wide context (who, which company, toast, confirm) and the #/… router helpers.
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';

export const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function parseRoute() {
  const raw = decodeURI(location.hash.replace(/^#\/?/, ''));
  const [path, q] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  return { name: parts[0] || '', params: parts.slice(1), query: new URLSearchParams(q || '') };
}
// { replace: true } swaps the current entry instead of adding one (Back then skips a page that's done, like the
// activation form once the account exists)
export const go = (r, { replace = false } = {}) => {
  const to = '#/' + String(r).replace(/^#?\/?/, '');
  if (location.hash === to) return;
  if (replace) location.replace(to); else location.hash = to;
};
