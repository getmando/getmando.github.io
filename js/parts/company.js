// The company profile form (welcome step 1 and Settings → Company): logo, color, name, kind, contact, address,
// time zone, USDOT / MC. Saves through org_update; the logo goes to the company's own folder in Storage.
// Every field is checked first (check.js): a wrong phone, ZIP or state gets a plain message, nothing is cut silently.
import { html, useState, Icon, OrgBadge, Btn, Field, ErrorBox } from '../ui.js';
import { rpc, upload } from '../api.js';
import { KINDS, TZS } from '../util.js';
import { nameCheck, textCheck, emailCheck, phoneCheck, cityCheck, stateCheck, zipCheck, usdotCheck, mcCheck, problems, focusFirst } from '../check.js';

const COLORS = ['#2F6BFF', '#0A84FF', '#30B0C7', '#1F8A70', '#34C759', '#C2410C', '#FF6A1A', '#E3A21A', '#D70015', '#AF52DE', '#5E5CE6', '#1D1D1F'];
const KEYS = ['name', 'legal_name', 'kind', 'phone', 'email', 'website', 'address_line1', 'city', 'state', 'postal_code', 'timezone', 'usdot', 'mc_number', 'brand_color'];
const IDS = { name: 'cn', legal_name: 'ln', phone: 'ph', email: 'ce', address_line1: 'a1', city: 'ct', state: 'st', postal_code: 'zp', usdot: 'dot', mc_number: 'mc' };

export function CompanyForm({ org, onSaved, toast, saveLabel = 'Save changes', extra }) {
  const [f, setF] = useState(() => Object.fromEntries(KEYS.map((k) => [k, org?.[k] ?? ''])));
  const [logo, setLogo] = useState(org?.logo_path || null);
  const [busy, setBusy] = useState(false);
  const [up, setUp] = useState(false);
  const [over, setOver] = useState(false);
  const [err, setErr] = useState(null);
  const [fe, setFe] = useState({});
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); if (fe[k]) setFe({ ...fe, [k]: null }); };
  const carrier = ['hauler', 'subcontractor', 'contractor', 'ready_mix'].includes(f.kind);

  const pick = async (file) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { setErr('Use a PNG, JPG or WebP image.'); return; }
    if (file.size > 2 * 1024 * 1024) { setErr('That image is over 2 MB. Use a smaller one.'); return; }
    setErr(null); setUp(true);
    try {
      const path = `${org.id}/logo-${Date.now()}.${file.type.split('/')[1].replace('jpeg', 'jpg')}`;
      await upload('org-public', path, file);
      const saved = await rpc('org_update', { p_org: org.id, p: { logo_path: path } });
      setLogo(saved.logo_path);
      toast && toast('Logo updated');
      onSaved && onSaved(saved, { logoOnly: true });
    } catch (x) { setErr(x); }
    setUp(false);
  };
  const removeLogo = async () => {
    setUp(true);
    try { const saved = await rpc('org_update', { p_org: org.id, p: { logo_path: null } }); setLogo(null); onSaved && onSaved(saved, { logoOnly: true }); }
    catch (x) { setErr(x); }
    setUp(false);
  };
  const save = async (e) => {
    e.preventDefault();
    if (busy) return;
    const errs = problems([
      ['name', nameCheck(f.name, { what: 'Company name', max: 80 })], ['legal_name', nameCheck(f.legal_name, { what: 'Legal name', max: 120, required: false })],
      ['phone', phoneCheck(f.phone)], ['email', emailCheck(f.email)], ['address_line1', textCheck(f.address_line1, { what: 'Address', max: 120 })],
      ['city', cityCheck(f.city)], ['state', stateCheck(f.state)], ['postal_code', zipCheck(f.postal_code)],
      ...(carrier ? [['usdot', usdotCheck(f.usdot)], ['mc_number', mcCheck(f.mc_number)]] : []),
    ]);
    setFe(errs);
    if (Object.keys(errs).length) { focusFirst(errs, IDS); return; }
    setErr(null); setBusy(true);
    try {
      const p = Object.fromEntries(KEYS.map((k) => [k, typeof f[k] === 'string' ? f[k].trim() : f[k]]));
      p.state = (p.state || '').toUpperCase();
      p.mc_number = (p.mc_number || '').replace(/^MC[\s-]?/i, '');
      if (!p.brand_color) delete p.brand_color;
      const saved = await rpc('org_update', { p_org: org.id, p });
      onSaved && onSaved(saved, {});
    } catch (x) { setErr(x); }
    setBusy(false);
  };

  const preview = { ...org, name: f.name || org?.name, logo_path: logo, brand_color: f.brand_color || org?.brand_color };
  return html`<form class="form" onSubmit=${save} novalidate>
    <div class=${'logo-drop' + (over ? ' over' : '')} onDragOver=${(e) => { e.preventDefault(); setOver(true); }} onDragLeave=${() => setOver(false)}
      onDrop=${(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files[0]); }}>
      <${OrgBadge} org=${preview} cls="xl" />
      <div class="col grow"><b>Company logo</b><span class="dim sm">A picture file (PNG, JPG or WebP), up to 2 MB. Drag it onto this box, or choose a file. It shows in the menu on the left and on invitations.</span>
        <div class="row wrap"><label class="btn sm"><${Icon} n="upload" />${up ? 'Uploading…' : logo ? 'Replace' : 'Choose a file'}
          <input type="file" accept="image/png,image/jpeg,image/webp" class="hide" onChange=${(e) => pick(e.target.files[0])} /></label>
          ${logo ? html`<${Btn} size="sm" kind="ghost" onClick=${removeLogo}>Remove<//>` : null}</div></div>
    </div>
    <${Field} label="Badge color" help=${logo ? 'Used where the logo doesn\'t fit.' : 'Your badge shows your initials in this color until you add a logo.'}>
      <div class="swatches">${COLORS.map((c) => html`<button type="button" key=${c} class=${'swatch' + ((f.brand_color || '').toUpperCase() === c ? ' on' : '')}
        style=${`--c:${c}`} aria-label=${'Color ' + c} onClick=${() => setF({ ...f, brand_color: c })}></button>`)}</div><//>
    <div class="grid2">
      <${Field} label="Company name" id="cn" error=${fe.name}><input id="cn" class="inp" value=${f.name} onInput=${set('name')} /><//>
      <${Field} label="Legal name" id="ln" help="For invoices, if different." error=${fe.legal_name}><input id="ln" class="inp" value=${f.legal_name} onInput=${set('legal_name')} placeholder="Company LLC" /><//>
      <${Field} label="What you do" id="kd"><select id="kd" class="sel" value=${f.kind} onChange=${set('kind')}>
        ${Object.entries(KINDS).map(([k, v]) => html`<option value=${k}>${v}</option>`)}</select><//>
      <${Field} label="Time zone" id="tz" help="Times in your command center follow it."><select id="tz" class="sel" value=${f.timezone} onChange=${set('timezone')}>
        ${TZS.map(([k, v]) => html`<option value=${k}>${v}</option>`)}</select><//>
      <${Field} label="Phone" id="ph" error=${fe.phone}><input id="ph" class="inp" type="tel" value=${f.phone} onInput=${set('phone')} placeholder="(512) 555-0100" /><//>
      <${Field} label="Email" id="ce" error=${fe.email}><input id="ce" class="inp" type="email" value=${f.email} onInput=${set('email')} placeholder="dispatch@company.com" /><//>
      <${Field} label="Address" id="a1" cls="span2" error=${fe.address_line1}><input id="a1" class="inp" value=${f.address_line1} onInput=${set('address_line1')} placeholder="Street" /><//>
    </div>
    <div class="grid3">
      <${Field} label="City" id="ct" error=${fe.city}><input id="ct" class="inp" value=${f.city} onInput=${set('city')} /><//>
      <${Field} label="State" id="st" error=${fe.state}><input id="st" class="inp" value=${f.state} onInput=${set('state')} placeholder="like TX" autocapitalize="characters" /><//>
      <${Field} label="ZIP" id="zp" error=${fe.postal_code}><input id="zp" class="inp" value=${f.postal_code} onInput=${set('postal_code')} inputmode="numeric" /><//>
    </div>
    ${carrier ? html`<div class="grid2">
      <${Field} label="USDOT number" id="dot" help="From the FMCSA. Optional." error=${fe.usdot}><input id="dot" class="inp mono" value=${f.usdot} onInput=${set('usdot')} inputmode="numeric" placeholder="Optional" /><//>
      <${Field} label="MC number" id="mc" help="Motor carrier number, from the FMCSA. Optional." error=${fe.mc_number}><input id="mc" class="inp mono" value=${f.mc_number} onInput=${set('mc_number')} inputmode="numeric" placeholder="Optional" /><//>
    </div>` : null}
    <${ErrorBox} error=${err} />
    <div class="row wrap">${extra}<span class="grow"></span><${Btn} kind="primary" type="submit" busy=${busy}>${saveLabel}<//></div>
  </form>`;
}
