// Activity: who did what in the company, newest first, by day. Every change in the database writes one line.
import { html, useState, Icon, Empty, Seg, Skel, Top, useLoad } from '../ui.js';
import { useApp } from '../ctx.js';
import { loadAudit } from '../data.js';
import { fmtTime, dayLabel, dayKey, ago } from '../util.js';

const KIND = [
  [/^license\./, 'license', 'violet'], [/^member\./, 'users', 'blue'], [/^integration\.error/, 'alert', 'red'],
  [/^(integration|device)\./, 'plug', 'green'], [/^api_key\./, 'key', ''], [/^asset\./, 'truck', ''], [/^org\./, 'building', 'amber'],
];
const GROUPS = {
  all: () => true,
  fleet: (a) => /^(asset|device)\./.test(a),
  people: (a) => /^member\./.test(a),
  gps: (a) => /^(integration|api_key)\./.test(a),
  company: (a) => /^(org|license)\./.test(a),
};

export function ActivityRow({ x, tz, full }) {
  const [, icon, tone] = KIND.find(([re]) => re.test(x.action)) || [null, 'activity', ''];
  return html`<div class="li"><span class=${'act-ic ' + tone}><${Icon} n=${icon} /></span>
    <div class="grow"><div class="f-t">${x.summary}</div>
      <div class="f-s">${full ? fmtTime(x.at, tz) : ago(x.at)}${x.actor_name && !x.summary.startsWith(x.actor_name) ? ` · ${x.actor_name}` : ''}</div></div></div>`;
}

export function Activity() {
  const { org } = useApp();
  const [g, setG] = useState('all');
  const log = useLoad(() => loadAudit(org.id, 300), [org.id], { every: 30000 });
  const list = (log.data || []).filter((x) => GROUPS[g](x.action));
  const days = [];
  for (const x of list) {
    const k = dayKey(x.at, org.timezone);
    if (!days.length || days[days.length - 1].k !== k) days.push({ k, label: dayLabel(x.at, org.timezone), items: [] });
    days[days.length - 1].items.push(x);
  }
  const n = (k) => (log.data || []).filter((x) => GROUPS[k](x.action)).length;
  return html`<${Top} title="Activity" sub=${`Everything that happens in ${org.name}, newest first`} />
    <div class="page">
      <div class="toolbar"><${Seg} value=${g} onChange=${setG} options=${[
        { v: 'all', label: 'All', n: n('all') }, { v: 'fleet', label: 'Fleet', n: n('fleet') }, { v: 'people', label: 'People', n: n('people') },
        { v: 'gps', label: 'GPS & connections', n: n('gps') }, { v: 'company', label: 'Company & license', n: n('company') }]} /></div>
      <div class="card feed">
        ${!log.data ? html`<div class="card-b"><${Skel} h=${260} /></div>`
          : days.length ? days.map((d) => html`<div key=${d.k}><div class="day">${d.label}</div>
              <div class="list">${d.items.map((x) => html`<${ActivityRow} key=${x.id} x=${x} tz=${org.timezone} full />`)}</div></div>`)
          : html`<${Empty} icon="activity" title="Nothing here yet" text="Changes to the fleet, the team and your connections show up here." />`}
      </div>
    </div>`;
}
