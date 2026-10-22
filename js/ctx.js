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
export const go = (r) => {
  const to = '#/' + String(r).replace(/^#?\/?/, '');
  if (location.hash !== to) location.hash = to;
};
