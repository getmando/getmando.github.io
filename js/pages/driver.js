// Driver mode: the phone as the truck's GPS. The driver picks the truck they're in today (trucks change hands),
// taps Start, and the phone sends its position every 15 seconds while the screen stays on (Wake Lock).
// Nothing is sent unless this screen says Sharing.
import { html, useState, useEffect, useRef, Icon, Btn, Empty, ErrorBox, Top, useLoad } from '../ui.js';
import { useApp } from '../ctx.js';
import { rpc } from '../api.js';
import { loadAssets } from '../data.js';
import { fmtTime } from '../util.js';
import { vehicleIcon, vehicleLine } from '../parts/asset.js';

const EVERY = 15000;

export function Driver() {
  const app = useApp();
  const { org } = app;
  const assets = useLoad(() => loadAssets(org.id), [org.id]);
  const KEY = 'mando.drive.' + org.id;
  const [truck, setTruck] = useState(() => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } });
  const [on, setOn] = useState(false);
  const [fix, setFix] = useState(null);
  const [sent, setSent] = useState(null);
  const [err, setErr] = useState(null);
  const watch = useRef(null);
  const lock = useRef(null);
  const last = useRef(0);
  const latest = useRef(null);
  const truckRef = useRef(truck);
  truckRef.current = truck;

  const send = async (p) => {
    last.current = Date.now();
    try {
      await rpc('driver_ping', { p_org: org.id, p: { lat: p.coords.latitude, lon: p.coords.longitude, speed_mps: p.coords.speed, heading: p.coords.heading,
        accuracy_m: p.coords.accuracy, asset_id: truckRef.current && truckRef.current !== 'none' ? truckRef.current : null } });
      setSent(Date.now()); setErr(null);
    } catch (x) { setErr(x.code === 'offline' ? 'No signal right now — it keeps trying.' : x.message); }
  };
  const wake = async () => {
    try { if ('wakeLock' in navigator && document.visibilityState === 'visible') lock.current = await navigator.wakeLock.request('screen'); } catch { /* not supported */ }
  };
  const start = () => {
    if (!('geolocation' in navigator)) { setErr('This browser can\'t share location.'); return; }
    setErr(null);
    watch.current = navigator.geolocation.watchPosition((p) => {
      latest.current = p;
      setFix({ lat: p.coords.latitude, lon: p.coords.longitude, mph: p.coords.speed != null ? Math.round(p.coords.speed * 2.23694) : null, acc: Math.round(p.coords.accuracy) });
      if (Date.now() - last.current > EVERY) send(p);
    }, (e) => {
      setErr(e.code === 1 ? 'denied' : e.code === 3 ? 'Still looking for GPS — go outside or wait a moment.' : 'Location isn\'t available right now.');
      if (e.code === 1) stop();
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 });
    wake();
    setOn(true);
  };
  const stop = () => {
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    try { lock.current?.release(); } catch { /* already released */ }
    lock.current = null;
    setOn(false);
  };
  useEffect(() => {
    const t = setInterval(() => { if (watch.current !== null && latest.current && Date.now() - last.current > EVERY * 2) send(latest.current); }, 5000);
    const vis = () => { if (document.visibilityState === 'visible' && watch.current !== null) wake(); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); stop(); };
  }, []);
  const pick = (id) => { setTruck(id); try { localStorage.setItem(KEY, id); } catch { /* private mode */ } };

  const trucks = (assets.data || []).filter((a) => a.kind !== 'trailer' && (a.status === 'active' || a.status === 'shop'));
  const chosen = trucks.find((a) => a.id === truck);
  return html`<${Top} title="Driver mode" sub="Share this phone's location while you drive." />
    <div class="drive"><div class="drive-in">
      <div class=${'bigstate ' + (on ? 'on' : 'off')}>
        <div class="bs-dot"><${Icon} n=${on ? 'signal' : 'nav'} /></div>
        <h2>${on ? `Sharing${chosen ? ' · ' + chosen.unit_no : ''}` : 'Not sharing'}</h2>
        <div class="dim">${on ? (sent ? `Last sent ${fmtTime(sent, org.timezone)}${fix?.mph != null ? ` · ${fix.mph} mph` : ''}${fix?.acc ? ` · ±${fix.acc} m` : ''}` : 'Finding your position…')
          : truck ? 'Tap Start when you get in the truck.' : 'First pick the truck you\'re driving today.'}</div>
        ${on ? html`<${Btn} size="lg" kind="danger" icon="pause" onClick=${stop}>Stop sharing<//>`
          : html`<${Btn} size="lg" kind="primary" icon="play" disabled=${!truck} onClick=${start}>Start sharing<//>`}
      </div>
      ${err === 'denied' ? html`<div class="err"><${Icon} n="alert" /><div><b>Location is blocked for this site.</b><br />
          iPhone: Settings → Privacy & Security → Location Services → Safari Websites → While Using the App.<br />
          Android: tap the lock next to the address → Permissions → Location → Allow. Then tap Start again.</div></div>`
        : html`<${ErrorBox} error=${err} />`}
      <div class="col"><b>Which truck are you driving today?</b>
        ${!assets.data ? null : trucks.length ? html`<div class="trucks">
          ${trucks.map((a) => html`<button type="button" key=${a.id} class=${'truckbtn' + (truck === a.id ? ' on' : '')} disabled=${on} onClick=${() => pick(a.id)}>
            <span class="u-ic"><${Icon} n=${vehicleIcon(a.kind)} /></span><div class="grow"><b>${a.unit_no}</b><div class="dim sm">${vehicleLine(a) || a.plate || ''}</div></div>
            ${truck === a.id ? html`<${Icon} n="check" />` : null}</button>`)}
          <button type="button" class=${'truckbtn' + (truck === 'none' ? ' on' : '')} disabled=${on} onClick=${() => pick('none')}>
            <span class="u-ic"><${Icon} n="user" /></span><div class="grow"><b>Not in a truck</b><div class="dim sm">Share just my position</div></div>
            ${truck === 'none' ? html`<${Icon} n="check" />` : null}</button></div>`
          : html`<div class="card"><${Empty} cls="sm" icon="truck" text="No vehicles yet — ask your dispatcher to add the trucks." /></div>`}
      </div>
      <p class="dim sm">Keep this screen open while you drive — it stays on while sharing. ${org.name} sees your position only while this says Sharing.</p>
    </div></div>`;
}
