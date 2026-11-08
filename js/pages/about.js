// About Mando and your data — one public page, signed in or not: what it costs, the terms, what is kept and who sees
// it, drivers' phones, GPS logins, keeping and deleting, who runs it. Every sentence states what the product does
// (platform/db, platform/functions, this app). What only the operator can say comes from config.js: OPERATOR,
// SUPPORT_EMAIL, PRICING, TERMS_URL — until they're filled in, the page says who to ask instead of guessing.
// #/about, #/pricing, #/terms, #/privacy and #/about/<section> open it at that section.
import { html, useEffect, Mark, Btn } from '../ui.js';
import { useApp, go } from '../ctx.js';
import { getSession } from '../api.js';
import { BRAND, C, askWho } from '../util.js';

const SECTIONS = [['pricing', 'What it costs'], ['terms', 'Terms'], ['privacy', 'Your data'], ['drivers', 'Drivers\' phones'],
  ['gps', 'GPS logins'], ['keeping', 'Keeping and deleting'], ['contact', `Who runs ${BRAND}`]];
const ALIAS = { pricing: 'pricing', terms: 'terms', privacy: 'privacy', data: 'privacy', contact: 'contact' };

export function About() {
  const app = useApp();
  const signedIn = !!getSession();
  const at = app.route.name === 'about' ? (app.route.params[0] || '') : ALIAS[app.route.name] || '';
  useEffect(() => {
    const el = at && document.getElementById('ab-' + at);
    if (el) el.scrollIntoView({ block: 'start' }); else window.scrollTo(0, 0);
  }, [at]);
  const back = () => (history.length > 1 ? history.back() : go(signedIn ? 'home' : ''));
  const ask = askWho();
  const mail = C.SUPPORT_EMAIL ? html`<a href=${'mailto:' + C.SUPPORT_EMAIL}>${C.SUPPORT_EMAIL}</a>` : ask;

  return html`<div class="doc">
    <header class="doc-top"><a class="row doc-brand" href="#/"><${Mark} /><span class="wordmark">${BRAND}</span></a><span class="grow"></span>
      <${Btn} size="sm" onClick=${back}>Back<//></header>
    <main class="doc-body">
      <h1>About ${BRAND} and your data</h1>
      <p class="lede">Plain answers on one page. Updated November 8, 2026.</p>
      <nav class="doc-nav" aria-label="On this page">${SECTIONS.map(([k, l]) => html`<a key=${k} href=${'#/about/' + k}>${l}</a>`)}</nav>

      <section id="ab-what"><p>${BRAND} is a command center for construction and hauling companies: your trucks, your people and your GPS in one place.
        Each company gets its own command center with a license.</p></section>

      <section id="ab-pricing"><h2>What it costs</h2>
        <p>${C.PRICING || html`${BRAND} is sold as a license for one company. The price and how long the license lasts are agreed before the license is sent to you. To ask about price, write to ${mail}.`}</p>
        <h3>The words on your license</h3>
        <dl class="doc-dl">
          <dt>Plan</dt><dd>The kind of license: Pilot (an early license, for companies starting with ${BRAND} while it is new), Standard or Enterprise.</dd>
          <dt>Seats</dt><dd>How many people can use your command center. Each person, and each invitation that hasn't been used yet, takes one seat. Cancel an invitation and its seat is free again.</dd>
          <dt>Length</dt><dd>How long the license lasts, counted from the day you activate it.</dd>
          <dt>Fleet</dt><dd>Your trucks, trailers and equipment.</dd>
          <dt>Live map & GPS</dt><dd>See your trucks on a map, from the GPS company you already use.</dd>
          <dt>Driver app</dt><dd>Your drivers' phones work as GPS — no tracker needed.</dd>
          <dt>Open API</dt><dd>A way for your other software to send truck positions to ${BRAND}. You only need it if someone who writes software for your company asks for it.</dd>
        </dl></section>

      <section id="ab-terms"><h2>Terms</h2>
        ${C.TERMS_URL ? html`<p><a href=${C.TERMS_URL} target="_blank" rel="noopener">Read the license terms</a>.</p>`
          : html`<p>The terms of your license come with it. If you want a copy before you start, ask ${mail}.</p>`}
        <p>These are true for every license:</p>
        <ul><li>Your company's data belongs to your company.</li>
          <li>If a license stops (it ends or is paused), the command center locks, but nothing is deleted. Everything comes back when the license is active again.</li></ul></section>

      <section id="ab-privacy"><h2>Your data</h2>
        <h3>What ${BRAND} keeps</h3>
        <p>Your company's details; the people you invite (name, email, phone, role); your vehicles; where your vehicles have been (GPS positions);
          your GPS connections; and an activity list of who changed what and when.</p>
        <h3>Where</h3>
        <p>In a database run by Supabase, in the United States (Virginia). It is encrypted while it travels and where it is stored.</p>
        <h3>Who can see it</h3>
        <ul><li>Only the people your company invites, and only what their role allows.</li>
          <li>No other company on ${BRAND} can see anything of yours. The database itself blocks it, company by company.</li>
          <li>The people who issue licenses see your license and counts — how many people, vehicles and GPS units — and any "Request it" notes you send them. Not your vehicles, people, positions or logins.</li>
          <li>Like any online service, the few people who run ${BRAND}'s servers can reach the database to keep it running.</li></ul>
        <h3>What else the app talks to</h3>
        <ul><li>There are no ads and no tracking scripts in ${BRAND}.</li>
          <li>Map pictures come from Esri, the Inter font from Google Fonts, and VIN look-ups from NHTSA's free public decoder (only the VIN is sent).</li>
          <li>Your sign-in is kept on this device until you sign out.</li></ul></section>

      <section id="ab-drivers"><h2>Drivers' phones</h2>
        <ul><li>A phone shares its location only while the driver has Driver mode open and it says <b>Sharing</b>.</li>
          <li>The driver picks the truck and taps Start. The phone sends its position every 15 seconds. The driver can tap Stop sharing at any time.</li>
          <li>Everyone in the company who can see the live map sees it.</li>
          <li>Positions are kept 180 days, then deleted.</li>
          <li>Drivers read this before they join.</li></ul></section>

      <section id="ab-gps"><h2>GPS logins</h2>
        <ul><li>When you connect Samsara, Motive, Geotab, Verizon Connect or Actsoft, your token or password is saved encrypted in the database's vault.</li>
          <li>It is never shown again in the app — not even to you.</li>
          <li>Only ${BRAND}'s sync service uses it, about once a minute, to read where your vehicles are. ${BRAND} only reads; it never changes anything in your GPS account.</li>
          <li>Disconnect deletes it right away. Your vehicles and the positions already saved stay (positions are deleted after 180 days).</li></ul></section>

      <section id="ab-keeping"><h2>Keeping and deleting</h2>
        <ul><li>GPS positions: kept 180 days, then deleted automatically every night.</li>
          <li>Everything else: kept while your license is active.</li>
          <li>Owners and admins can download a copy at any time: Settings → Company → Download your data.</li>
          <li>If your license is ending, download your copy before the end date. While a command center is locked, ask ${mail} for a copy.</li>
          <li>To have your company's data deleted, the owner writes to ${mail}.</li></ul></section>

      <section id="ab-contact"><h2>Who runs ${BRAND}</h2>
        <p>${C.OPERATOR ? `${BRAND} is run by ${C.OPERATOR}.` : `${BRAND} is new. For now it is run by the people who issue its licenses — the invitation email you got came from them.`}</p>
        <p>Questions, a problem, or a lost owner password: ${mail}.</p></section>

      <div class="doc-foot"><${Btn} onClick=${back}>Back<//>${signedIn ? null : html`<${Btn} kind="primary" onClick=${() => go('signin')}>Sign in<//>`}</div>
    </main>
  </div>`;
}
