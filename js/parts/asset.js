// Vehicle forms: the full form (Fleet drawer) and the quick row (welcome step 2). Typing a VIN and pressing
// Look up fills year, make and model from NHTSA's free public decoder; the check digit is verified on the spot,
// and nothing is saved until every field makes sense (check.js) — no silent cuts, no silent rewrites.
import { html, useState, useEffect, Icon, Btn, Field, ErrorBox, Seg } from '../ui.js';
import { rpc } from '../api.js';
import { BODIES, ASSET_KINDS, ASSET_STATUS, vinClean, vinOk, decodeVin } from '../util.js';
import { nameCheck, textCheck, plateCheck, stateCheck, yearCheck, numberCheck, problems, focusFirst } from '../check.js';

// a VIN that can't be one: wrong length, or letters VINs never use (a wrong check digit only warns — older vehicles differ)
export function vinProblem(vin) {
  const v = vinClean(vin);
  if (!v) return null;
  if (/[IOQ]/.test(v)) return 'VINs never use the letters I, O or Q — check for a 1 or a 0.';
  if (v.length !== 17) return `A VIN has 17 characters — this one has ${v.length}. Leave it empty if you don't have it.`;
  return null;
}

function VinHint({ vin, info }) {
  const v = vinClean(vin);
  if (info) return html`<div class=${'vinhint ' + info.tone}>${info.text}</div>`;
  if (/[IOQ]/.test(v)) return html`<div class="vinhint amber">VINs never use the letters I, O or Q — check for a 1 or a 0.</div>`;
  if (v.length === 17) {
    return vinOk(v) ? html`<div class="vinhint green">VIN checks out.</div>`
      : html`<div class="vinhint amber">The check digit doesn't match — look for a typo (trailers and older vehicles can differ).</div>`;
  }
  if (v.length > 0 && v.length < 17) return html`<div class="vinhint dim">${17 - v.length} more character${17 - v.length === 1 ? '' : 's'} for a full VIN.</div>`;
  if (v.length > 17) return html`<div class="vinhint amber">That's ${v.length} characters — a VIN has 17.</div>`;
  return null;
}

export function VinField({ value, onInput, onDecoded, id = 'vin' }) {
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState(null);
  useEffect(() => { if (!value) setInfo(null); }, [value]);        // the form was cleared: forget the last answer
  const v = vinClean(value);
  const full = v.length === 17 && !/[IOQ]/.test(v);
  const look = async () => {
    setBusy(true); setInfo(null);
    try {
      const d = await decodeVin(value);
      const what = d && [d.year, d.make, d.model].filter(Boolean).join(' ');
      if (!d) setInfo({ tone: 'amber', text: 'No match in NHTSA\'s VIN database — fill in year, make and model by hand.' });
      else if (!vinOk(v)) setInfo({ tone: 'amber', text: `NHTSA's closest guess is ${what}, but this VIN's check digit doesn't match. Look for a typo first.` });
      else { onDecoded(d); setInfo({ tone: 'green', text: `Found: ${what}${d.note ? ' · ' + d.note : ''}` }); }
    } catch { setInfo({ tone: 'dim', text: 'The VIN lookup didn\'t answer — fill it in by hand.' }); }
    setBusy(false);
  };
  return html`<div class="col"><div class="vinrow">
      <input id=${id} class="inp mono" value=${value} maxlength="24" placeholder="17 characters" autocomplete="off" spellcheck="false"
        onInput=${(e) => { setInfo(null); onInput(vinClean(e.target.value)); }} />
      <${Btn} busy=${busy} disabled=${!full} title=${full ? 'Look up year, make and model' : 'Type all 17 characters first'} onClick=${look}>Look up<//></div>
    <${VinHint} vin=${value} info=${info} /></div>`;
}

const EMPTY = { unit_no: '', kind: 'truck', body: '', vin: '', year: '', make: '', model: '', color: '', plate: '', plate_state: 'TX',
  capacity: '', capacity_unit: 'yd', status: 'active', odometer: '', notes: '' };
const FORM_IDS = { unit_no: 'un', vin: 'vin', year: 'yr', make: 'mk', model: 'md', plate: 'pl', plate_state: 'ps', color: 'co', capacity: 'cp', odometer: 'od', notes: 'nt' };

export function AssetForm({ org, asset, onSaved, onCancel, footerLeft }) {
  const [f, setF] = useState(() => {
    const base = { ...EMPTY };
    for (const k of Object.keys(base)) if (asset && asset[k] !== null && asset[k] !== undefined) base[k] = String(asset[k]);
    return base;
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [fe, setFe] = useState({});
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); if (fe[k]) setFe({ ...fe, [k]: null }); };
  const decoded = (d) => setF((x) => ({ ...x, year: x.year || d.year, make: x.make || d.make, model: x.model || d.model, kind: asset ? x.kind : d.kind || x.kind }));
  const save = async (e) => {
    e.preventDefault();
    if (busy) return;
    const errs = problems([
      ['unit_no', nameCheck(f.unit_no, { what: 'Unit number', max: 40, empty: 'Type a unit number or name, like T-1 or Big Red.' })],
      ['vin', vinProblem(f.vin)], ['year', yearCheck(f.year)], ['make', textCheck(f.make, { what: 'Make', max: 40 })], ['model', textCheck(f.model, { what: 'Model', max: 60 })],
      ['plate', plateCheck(f.plate)], ['plate_state', stateCheck(f.plate_state)], ['color', textCheck(f.color, { what: 'Color', max: 30 })],
      ['capacity', numberCheck(f.capacity, 'Capacity')], ['odometer', numberCheck(f.odometer, 'Odometer')], ['notes', textCheck(f.notes, { what: 'Notes', max: 2000 })],
    ]);
    setFe(errs);
    if (Object.keys(errs).length) { focusFirst(errs, FORM_IDS); return; }
    setErr(null); setBusy(true);
    try {
      const p = { ...f, unit_no: f.unit_no.trim(), plate_state: f.plate_state.trim().toUpperCase(), capacity: f.capacity.replace(/,/g, ''),
        odometer: f.odometer.replace(/,/g, ''), capacity_unit: f.capacity ? f.capacity_unit : '' };
      if (asset) p.id = asset.id;
      const saved = await rpc('asset_save', { p_org: org.id, p });
      onSaved(saved, !asset);
    } catch (x) { setErr(x); setBusy(false); }
  };
  return html`<form class="form" onSubmit=${save} id="assetform" novalidate>
    <div class="grid2">
      <${Field} label="Unit number or name" id="un" help="What your crew calls it — T-1, Truck 12, Big Red." error=${fe.unit_no}><input id="un" class="inp" value=${f.unit_no}
        onInput=${set('unit_no')} autofocus=${!asset} /><//>
      <${Field} label="Status" id="stt"><select id="stt" class="sel" value=${f.status} onChange=${set('status')}>
        ${Object.entries(ASSET_STATUS).map(([k, [v]]) => html`<option value=${k}>${v}</option>`)}</select><//>
    </div>
    <${Field} label="Type"><${Seg} value=${f.kind} onChange=${(v) => setF({ ...f, kind: v })} options=${Object.entries(ASSET_KINDS).map(([v, label]) => ({ v, label }))} /><//>
    <${Field} label="VIN" id="vin" error=${fe.vin}><${VinField} value=${f.vin} onInput=${(v) => { setF((x) => ({ ...x, vin: v })); if (fe.vin) setFe({ ...fe, vin: null }); }} onDecoded=${decoded} /><//>
    <div class="grid3">
      <${Field} label="Year" id="yr" error=${fe.year}><input id="yr" class="inp" value=${f.year} onInput=${set('year')} inputmode="numeric" maxlength="4" /><//>
      <${Field} label="Make" id="mk" error=${fe.make}><input id="mk" class="inp" value=${f.make} onInput=${set('make')} /><//>
      <${Field} label="Model" id="md" error=${fe.model}><input id="md" class="inp" value=${f.model} onInput=${set('model')} /><//>
    </div>
    <div class="grid3">
      <${Field} label="Plate" id="pl" error=${fe.plate}><input id="pl" class="inp mono" value=${f.plate} onInput=${set('plate')} autocomplete="off" /><//>
      <${Field} label="Plate state" id="ps" error=${fe.plate_state}><input id="ps" class="inp" value=${f.plate_state} onInput=${set('plate_state')} maxlength="2" /><//>
      <${Field} label="Color" id="co" error=${fe.color}><input id="co" class="inp" value=${f.color} onInput=${set('color')} /><//>
    </div>
    ${['truck', 'trailer', 'equipment'].includes(f.kind) ? html`<div class="grid3">
      <${Field} label="Body" id="bd"><select id="bd" class="sel" value=${f.body} onChange=${set('body')}><option value="">—</option>
        ${BODIES.map((b) => html`<option value=${b}>${b}</option>`)}</select><//>
      <${Field} label="Capacity" id="cp" error=${fe.capacity}><input id="cp" class="inp" value=${f.capacity} onInput=${set('capacity')} inputmode="decimal" /><//>
      <${Field} label="In" id="cu"><select id="cu" class="sel" value=${f.capacity_unit} onChange=${set('capacity_unit')}>
        <option value="yd">cubic yards</option><option value="ton">tons</option><option value="gal">gallons</option><option value="lb">pounds</option></select><//>
    </div>` : null}
    <div class="grid2">
      <${Field} label="Odometer" id="od" help="Optional — miles today." error=${fe.odometer}><input id="od" class="inp" value=${f.odometer} onInput=${set('odometer')} inputmode="numeric" /><//>
    </div>
    <${Field} label="Notes" id="nt" error=${fe.notes}><textarea id="nt" class="txt" value=${f.notes} onInput=${set('notes')} placeholder="Anything the team should know"></textarea><//>
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
  const [fe, setFe] = useState({});
  const add = async (e) => {
    e.preventDefault();
    if (busy) return;
    const errs = problems([['unit', nameCheck(unit, { what: 'Unit', max: 40, empty: 'Type a unit number, like 101 or T-1.' })], ['vin', vinProblem(vin)], ['plate', plateCheck(plate)]]);
    setFe(errs);
    if (Object.keys(errs).length) { focusFirst(errs, { unit: 'qa-unit', vin: 'qa-vin', plate: 'qa-pl' }); return; }
    setErr(null); setBusy(true);
    try {
      let d = found;
      if (!d && vinOk(vin)) { try { d = await decodeVin(vin); } catch { d = null; } }
      const saved = await rpc('asset_save', { p_org: org.id, p: { unit_no: unit.trim(), vin, plate: plate.trim(), kind: d?.kind || 'truck', year: d?.year || '', make: d?.make || '', model: d?.model || '' } });
      onAdded(saved);
      setUnit(''); setVin(''); setPlate(''); setFound(null);
      document.getElementById('qa-unit')?.focus();
    } catch (x) { setErr(x); }
    setBusy(false);
  };
  return html`<form class="col" onSubmit=${add} novalidate>
    <div class="quick">
      <${Field} label="Unit" id="qa-unit" error=${fe.unit}><input id="qa-unit" class="inp" value=${unit} onInput=${(e) => { setUnit(e.target.value); setErr(null); setFe((x) => ({ ...x, unit: null })); }} placeholder="T-1" /><//>
      <${Field} label="VIN (optional)" id="qa-vin" error=${fe.vin}><${VinField} id="qa-vin" value=${vin} onInput=${(v) => { setVin(v); setFound(null); setErr(null); setFe((x) => ({ ...x, vin: null })); }} onDecoded=${setFound} /><//>
      <${Field} label="Plate (optional)" id="qa-pl" error=${fe.plate}><input id="qa-pl" class="inp mono" value=${plate} onInput=${(e) => { setPlate(e.target.value); setErr(null); setFe((x) => ({ ...x, plate: null })); }} /><//>
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
