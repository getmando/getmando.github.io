// Vehicle forms: the full form (Fleet drawer) and the quick row (welcome step 2). Typing a VIN and pressing
// Look up fills year, make and model from NHTSA's free public decoder; the check digit is verified on the spot.
import { html, useState, Icon, Btn, Field, ErrorBox, Seg } from '../ui.js';
import { rpc } from '../api.js';
import { BODIES, ASSET_KINDS, ASSET_STATUS, vinClean, vinOk, decodeVin } from '../util.js';

function VinHint({ vin, info }) {
  const v = vinClean(vin);
  if (info) return html`<div class=${'vinhint ' + info.tone}>${info.text}</div>`;
  if (v.length === 17) {
    return vinOk(v) ? html`<div class="vinhint green">VIN checks out.</div>`
      : html`<div class="vinhint amber">The check digit doesn't match — look for a typo (trailers and older vehicles can differ).</div>`;
  }
  if (v.length > 0 && v.length < 17) return html`<div class="vinhint dim">${17 - v.length} more character${17 - v.length === 1 ? '' : 's'} for a full VIN.</div>`;
  return null;
}

export function VinField({ value, onInput, onDecoded, id = 'vin' }) {
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState(null);
  const look = async () => {
    setBusy(true); setInfo(null);
    try {
      const d = await decodeVin(value);
      if (!d) setInfo({ tone: 'amber', text: 'No match in NHTSA\'s VIN database — fill in year, make and model by hand.' });
      else { onDecoded(d); setInfo({ tone: 'green', text: `Found: ${[d.year, d.make, d.model].filter(Boolean).join(' ')}${d.note ? ' · ' + d.note : ''}` }); }
    } catch { setInfo({ tone: 'dim', text: 'The VIN lookup didn\'t answer — fill it in by hand.' }); }
    setBusy(false);
  };
  return html`<div class="col"><div class="vinrow">
      <input id=${id} class="inp mono" value=${value} maxlength="20" placeholder="17 characters" autocomplete="off" spellcheck="false"
        onInput=${(e) => { setInfo(null); onInput(vinClean(e.target.value)); }} />
      <${Btn} busy=${busy} disabled=${vinClean(value).length < 11} onClick=${look}>Look up<//></div>
    <${VinHint} vin=${value} info=${info} /></div>`;
}

const EMPTY = { unit_no: '', kind: 'truck', body: '', vin: '', year: '', make: '', model: '', color: '', plate: '', plate_state: 'TX',
  capacity: '', capacity_unit: 'yd', status: 'active', odometer: '', notes: '' };

export function AssetForm({ org, asset, onSaved, onCancel, footerLeft }) {
  const [f, setF] = useState(() => {
    const base = { ...EMPTY };
    for (const k of Object.keys(base)) if (asset && asset[k] !== null && asset[k] !== undefined) base[k] = String(asset[k]);
    return base;
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const decoded = (d) => setF((x) => ({ ...x, year: x.year || d.year, make: x.make || d.make, model: x.model || d.model, kind: asset ? x.kind : d.kind || x.kind }));
  const save = async (e) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const p = { ...f, capacity_unit: f.capacity ? f.capacity_unit : '' };
      if (asset) p.id = asset.id;
      const saved = await rpc('asset_save', { p_org: org.id, p });
      onSaved(saved, !asset);
    } catch (x) { setErr(x); setBusy(false); }
  };
  return html`<form class="form" onSubmit=${save} id="assetform">
    <div class="grid2">
      <${Field} label="Unit number or name" id="un" help="What your crew calls it — T-1, Truck 12, Big Red."><input id="un" class="inp" value=${f.unit_no}
        onInput=${set('unit_no')} required maxlength="40" autofocus=${!asset} /><//>
      <${Field} label="Status" id="stt"><select id="stt" class="sel" value=${f.status} onChange=${set('status')}>
        ${Object.entries(ASSET_STATUS).map(([k, [v]]) => html`<option value=${k}>${v}</option>`)}</select><//>
    </div>
    <${Field} label="Type"><${Seg} value=${f.kind} onChange=${(v) => setF({ ...f, kind: v })} options=${Object.entries(ASSET_KINDS).map(([v, label]) => ({ v, label }))} /><//>
    <${Field} label="VIN" id="vin"><${VinField} value=${f.vin} onInput=${(v) => setF((x) => ({ ...x, vin: v }))} onDecoded=${decoded} /><//>
    <div class="grid3">
      <${Field} label="Year" id="yr"><input id="yr" class="inp" value=${f.year} onInput=${set('year')} inputmode="numeric" maxlength="4" /><//>
      <${Field} label="Make" id="mk"><input id="mk" class="inp" value=${f.make} onInput=${set('make')} /><//>
      <${Field} label="Model" id="md"><input id="md" class="inp" value=${f.model} onInput=${set('model')} /><//>
    </div>
    <div class="grid3">
      <${Field} label="Plate" id="pl"><input id="pl" class="inp mono" value=${f.plate} onInput=${set('plate')} autocomplete="off" /><//>
      <${Field} label="Plate state" id="ps"><input id="ps" class="inp" value=${f.plate_state} onInput=${set('plate_state')} maxlength="2" /><//>
      <${Field} label="Color" id="co"><input id="co" class="inp" value=${f.color} onInput=${set('color')} /><//>
    </div>
    ${['truck', 'trailer', 'equipment'].includes(f.kind) ? html`<div class="grid3">
      <${Field} label="Body" id="bd"><select id="bd" class="sel" value=${f.body} onChange=${set('body')}><option value="">—</option>
        ${BODIES.map((b) => html`<option value=${b}>${b}</option>`)}</select><//>
      <${Field} label="Capacity" id="cp"><input id="cp" class="inp" value=${f.capacity} onInput=${set('capacity')} inputmode="decimal" /><//>
      <${Field} label="In" id="cu"><select id="cu" class="sel" value=${f.capacity_unit} onChange=${set('capacity_unit')}>
        <option value="yd">cubic yards</option><option value="ton">tons</option><option value="gal">gallons</option><option value="lb">pounds</option></select><//>
    </div>` : null}
    <div class="grid2">
      <${Field} label="Odometer" id="od" help="Optional — miles today."><input id="od" class="inp" value=${f.odometer} onInput=${set('odometer')} inputmode="numeric" /><//>
    </div>
    <${Field} label="Notes" id="nt"><textarea id="nt" class="txt" value=${f.notes} onInput=${set('notes')} placeholder="Anything the team should know"></textarea><//>
    <${ErrorBox} error=${err} />
    <div class="row wrap">${footerLeft}<span class="grow"></span>
      ${onCancel ? html`<${Btn} onClick=${onCancel}>Cancel<//>` : null}
      <${Btn} kind="primary" type="submit" busy=${busy}>${asset ? 'Save changes' : 'Add vehicle'}<//></div>
  </form>`;
}

// one line per truck, for the welcome screen
export function QuickAdd({ org, onAdded }) {
  const [unit, setUnit] = useState('');
  const [vin, setVin] = useState('');
  const [plate, setPlate] = useState('');
  const [found, setFound] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const add = async (e) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      let d = found;
      if (!d && vinClean(vin).length === 17) { try { d = await decodeVin(vin); } catch { d = null; } }
      const saved = await rpc('asset_save', { p_org: org.id, p: { unit_no: unit, vin, plate, kind: d?.kind || 'truck', year: d?.year || '', make: d?.make || '', model: d?.model || '' } });
      onAdded(saved);
      setUnit(''); setVin(''); setPlate(''); setFound(null);
      document.getElementById('qa-unit')?.focus();
    } catch (x) { setErr(x); }
    setBusy(false);
  };
  return html`<form class="col" onSubmit=${add}>
    <div class="quick">
      <${Field} label="Unit" id="qa-unit"><input id="qa-unit" class="inp" value=${unit} onInput=${(e) => setUnit(e.target.value)} placeholder="T-1" required maxlength="40" /><//>
      <${Field} label="VIN (optional)" id="qa-vin"><${VinField} id="qa-vin" value=${vin} onInput=${(v) => { setVin(v); setFound(null); }} onDecoded=${setFound} /><//>
      <${Field} label="Plate (optional)" id="qa-pl"><input id="qa-pl" class="inp mono" value=${plate} onInput=${(e) => setPlate(e.target.value)} /><//>
      <div class="field"><label class="sr">Add</label><${Btn} kind="primary" icon="plus" type="submit" busy=${busy}>Add<//></div>
    </div>
    <${ErrorBox} error=${err} />
  </form>`;
}

export function vehicleIcon(kind) {
  return kind === 'trailer' ? 'trailer' : kind === 'equipment' ? 'wrench' : 'truck';
}
export function vehicleLine(a) {
  return [a.year, a.make, a.model].filter(Boolean).join(' ') || (a.body || '') || '';
}
export { Icon };
