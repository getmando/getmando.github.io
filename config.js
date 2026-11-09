/* Public settings of the app. Safe to publish: the publishable key only identifies the app to
   Supabase; every row is protected by the database (RLS), and sign-ups are off.
   The four answers a first-time visitor looks for (About Mando and your data, #/about) — fill them in when they're
   decided; until then the app says "ask the person who sent you your license" instead of guessing:
     SUPPORT_EMAIL  where questions, a lost owner password and data requests go
     OPERATOR       who runs Mando (a person's or a company's legal name)
     PRICING        one or two plain sentences on what a license costs
     TERMS_URL      a link to the license terms
   TAGLINE is the one line that says what Mando does: the sign-in page (computer and phone), the About page and the link
   preview read it here; index.html's description / og:description and manifest.webmanifest's description repeat it word
   for word, and `node platform/harness/icons.mjs` puts it on og.png — change all four together. */
window.APP_CONFIG = {
  BRAND: "Mando",
  TAGLINE: "Your trucks, your people and your GPS in one place — for construction and hauling companies.",
  SUPABASE_URL: "https://jnkachvxwnjpfryxkjna.supabase.co",
  PUBLISHABLE_KEY: "sb_publishable_P5xEMcVC-2cQp7tNSo4G8A_u3DxA-dL",
  SUPPORT_EMAIL: "",
  OPERATOR: "",
  PRICING: "",
  TERMS_URL: "",
  VERSION: "1.2.0",
};
