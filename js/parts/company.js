// The company profile form (welcome step 1 and Settings → Company): logo, color, name, kind, contact, address,
// time zone, USDOT / MC — in four groups: Brand · Company · Contact & address · Carrier numbers. Saves through
// org_update; the logo goes to the company's own folder in Storage (and saves at once, without touching the fields).
// Every field is checked as you leave it and again on save (check.js): a wrong phone, ZIP or state gets a plain
// message under it, nothing is cut silently.
import { html, useState, Icon, OrgBadge, Btn, Field, ErrorBox, useForm } from '../ui.js';
import { rpc, upload } from '../api.js';
import { KINDS, TZS } from '../util.js';
import { nameCheck, textCheck, emailCheck, phoneCheck, cityCheck, stateCheck, zipCheck, usdotCheck, mcCheck } from '../check.js';

const COLORS = [['#2F6BFF', 'Blue'], ['#0A84FF', 'Bright blue'], ['#30B0C7', 'Teal'], ['#1F8A70', 'Green teal'], ['#34C759', 'Green'], ['#C2410C', 'Rust'],
  ['#FF6A1A', 'Orange'], ['#E3A21A', 'Gold'], ['#D70015', 'Red'], ['#AF52DE', 'Purple'], ['#5E5CE6', 'Indigo'], ['#1D1D1F', 'Black']];
const KEYS = ['name', 'legal_name', 'kind', 'phone', 'email', 'website', 'address_line1', 'city', 'state', 'postal_code', 'timezone', 'usdot', 'mc_number', 'brand_color'];
const IDS = { name: 'cn', legal_name: 'ln', phone: 'ph', email: 'ce', address_line1: 'a1', city: 'ct', state: 'st', postal_code: 'zp', usdot: 'dot', mc_number: 'mc' };
const CARRIERS = ['hauler', 'subcontractor', 'contractor', 'ready_mix'];
const RULES = {
  name: (v) => nameCheck(v, { what: 'Company name', max: 80 }), legal_name: (v) => nameCheck(v, { what: 'Legal name', max: 120, required: false }),
  phone: phoneCheck, email: (v) => emailCheck(v), address_line1: (v) => textCheck(v, { what: 'Address', max: 120 }),
  city: cityCheck, state: stateCheck, postal_code: zipCheck,
  usdot: (v, all) => (CARRIERS.includes(all.kind) ? usdotCheck(v) : null), mc_number: (v, all) => (CARRIERS.includes(all.kind) ? mcCheck(v) : null),
};

export function CompanyForm({ org, onSaved, toast, saveLabel = 'Save changes', extra }) {
  const [f, setF] = useState(() => Object.fromEntries(KEYS.map((k) => [k, org?.[k] ?? ''])));
  const [logo, setLogo] = useState(org?.logo_path || null);
  const [busy, setBusy] = useState(false);
  const [up, setUp] = useState('');                  // '' · upload · remove
  const [over, setOver] = useState(false);
  const [err, setErr] = useState(null);
  const [lerr, setLerr] = useState(null);            // the logo's own problem, shown in the logo box
  const chk = useForm(f, RULES, IDS);
  const fe = chk.errs;
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); chk.edit(k, e.target.value); };
  const b = (k) => chk.blur(k);
  const carrier = CARRIERS.includes(f.kind);

  const pick = async (file) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { setLerr('Use a PNG, JPG or WebP image.'); return; }
    if (file.size > 2 * 1024 * 1024) { setLerr('That image is over 2 MB. Use a smaller one.'); return; }
    setLerr(null); setUp('upload');
    try {
      const path = `${org.id}/logo-${Date.now()}.${file.type.split('/')[1].replace('jpeg', 'jpg')}`;
      await upload('org-public', path, file);
      const saved = await rpc('org_update', { p_org: org.id, p: { logo_path: path } });
      setLogo(saved.logo_path);
      toast && toast('Logo updated');
      onSaved && onSaved(saved, { logoOnly: true });
    } catch (x) { setLerr(x.message || String(x)); }
    setUp('');
  };
  const removeLogo = async () => {
    setLerr(null); setUp('remove');
    try {
      const saved = await rpc('org_update', { p_org: org.id, p: { logo_path: null } });
      setLogo(null);
      toast && toast('Logo removed — your badge shows your initials again');
      onSaved && onSaved(saved, { logoOnly: true });
    } catch (x) { setLerr(x.message || String(x)); }
    setUp('');
  };
  const save = async (e) => {
    e.preventDefault();
    if (busy || !chk.ok()) return;
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
    <div class="section"><h4>Brand</h4>
    <div class=${'logo-drop' + (over ? ' over' : '')} onDragOver=${(e) => { e.preventDefault(); setOver(true); }} onDragLeave=${() => setOver(false)}
      onDrop=${(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files[0]); }}>
      <${OrgBadge} org=${preview} cls="xl" />
      <div class="col grow"><b>Company logo</b><span class="dim sm" id="logo-help">A picture file (PNG, JPG or WebP), up to 2 MB. Drag it onto this box, or choose a file. It shows in the menu on the left and on invitations.</span>
        <div class="row wrap"><label class="btn sm">${up === 'upload' ? html`<span class="spin dark"></span>` : html`<${Icon} n="upload" />`}${up === 'upload' ? 'Uploading…' : logo ? 'Replace' : 'Choose a file'}
          <input type="file" accept="image/png,image/jpeg,image/webp" class="vh" aria-describedby="logo-help" disabled=${!!up}
            onChange=${(e) => { pick(e.target.files[0]); e.target.value = ''; }} /></label>
          ${logo ? html`<${Btn} size="sm" kind="ghost" busy=${up === 'remove'} disabled=${!!up} onClick=${removeLogo}>${up === 'remove' ? 'Removing…' : 'Remove'}<//>` : null}</div>
        ${lerr ? html`<div class="ferr" role="alert">${lerr}</div>` : null}</div>
    </div>
    <${Field} label="Badge color" help=${logo ? 'Used where the logo doesn\'t fit.' : 'Your badge shows your initials in this color until you add a logo.'}>
      <div class="swatches" role="group" aria-label="Badge color">${COLORS.map(([c, name]) => html`<button type="button" key=${c} class=${'swatch' + ((f.brand_color || '').toUpperCase() === c ? ' on' : '')}
        style=${`--c:${c}`} aria-label=${name} aria-pressed=${(f.brand_color || '').toUpperCase() === c ? 'true' : 'false'} onClick=${() => setF({ ...f, brand_color: c })}></button>`)}</div><//>
    </div>

    <div class="section"><h4>Company</h4><div class="grid2">
      <${Field} label="Company name" id="cn" error=${fe.name}><input id="cn" class="inp" value=${f.name} onInput=${set('name')} onBlur=${b('name')} autocomplete="organization" /><//>
      <${Field} label="Legal name" id="ln" help="For invoices, if different." error=${fe.legal_name}><input id="ln" class="inp" value=${f.legal_name} onInput=${set('legal_name')} onBlur=${b('legal_name')} placeholder="Company LLC" /><//>
      <${Field} label="What you do" id="kd"><select id="kd" class="sel" value=${f.kind} onChange=${set('kind')}>
        ${Object.entries(KINDS).map(([k, v]) => html`<option value=${k}>${v}</option>`)}</select><//>
      <${Field} label="Time zone" id="tz" help="Times in your command center follow it."><select id="tz" class="sel" value=${f.timezone} onChange=${set('timezone')}>
        ${TZS.map(([k, v]) => html`<option value=${k}>${v}</option>`)}</select><//>
    </div></div>

    <div class="section"><h4>Contact & address</h4><div class="grid2">
      <${Field} label="Phone" id="ph" error=${fe.phone}><input id="ph" class="inp" type="tel" value=${f.phone} onInput=${set('phone')} onBlur=${b('phone')} placeholder="(512) 555-0100" /><//>
      <${Field} label="Email" id="ce" error=${fe.email}><input id="ce" class="inp" type="email" value=${f.email} onInput=${set('email')} onBlur=${b('email')} placeholder="dispatch@company.com" /><//>
      <${Field} label="Street address" id="a1" cls="span2" error=${fe.address_line1}><input id="a1" class="inp" value=${f.address_line1} onInput=${set('address_line1')} onBlur=${b('address_line1')} autocomplete="street-address" /><//>
    </div>
    <div class="grid3">
      <${Field} label="City" id="ct" error=${fe.city}><input id="ct" class="inp" value=${f.city} onInput=${set('city')} onBlur=${b('city')} /><//>
      <${Field} label="State" id="st" error=${fe.state}><input id="st" class="inp" value=${f.state} onInput=${set('state')} onBlur=${b('state')} placeholder="like TX" autocapitalize="characters" /><//>
      <${Field} label="ZIP" id="zp" error=${fe.postal_code}><input id="zp" class="inp" value=${f.postal_code} onInput=${set('postal_code')} onBlur=${b('postal_code')} inputmode="numeric" /><//>
    </div></div>

    ${carrier ? html`<div class="section"><h4>Carrier numbers</h4><div class="grid2">
      <${Field} label="USDOT number (optional)" id="dot" help="From the FMCSA." error=${fe.usdot}><input id="dot" class="inp mono" value=${f.usdot} onInput=${set('usdot')} onBlur=${b('usdot')} inputmode="numeric" /><//>
      <${Field} label="MC number (optional)" id="mc" help="Motor carrier number, from the FMCSA." error=${fe.mc_number}><input id="mc" class="inp mono" value=${f.mc_number} onInput=${set('mc_number')} onBlur=${b('mc_number')} inputmode="numeric" /><//>
    </div></div>` : null}
    <${ErrorBox} error=${err} />
    <div class="form-foot">${extra}<span class="grow"></span><${Btn} kind="primary" type="submit" busy=${busy}>${saveLabel}<//></div>
  </form>`;
}
