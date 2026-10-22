// Table reads used by several pages. RLS returns only the signed-in user's company rows; the org filter keeps
// each page to the company on screen when a person belongs to more than one.
import { select } from './api.js';

const q = encodeURIComponent;
export const loadOrg = (org) => select('orgs', `select=*&id=eq.${org}`).then((r) => r[0] || null);
export const loadAssets = (org) => select('assets', `select=*&org_id=eq.${org}&order=unit_no.asc`);
export const loadDevices = (org) => select('devices', `select=*&org_id=eq.${org}&order=name.asc`);
export const loadMembers = (org) => select('org_members', `select=*&org_id=eq.${org}&order=full_name.asc`);
export const loadInvites = (org) => select('org_invites', `select=*&org_id=eq.${org}&accepted_at=is.null&revoked_at=is.null&order=created_at.desc`);
export const loadIntegrations = (org) => select('integrations', `select=*&org_id=eq.${org}&order=created_at.asc`);
export const loadKeys = (org) => select('api_keys', `select=*&org_id=eq.${org}&order=created_at.desc`);
export const loadRequests = (org) => select('integration_requests', `select=*&org_id=eq.${org}&order=created_at.desc`);
export const loadAudit = (org, limit = 100) => select('audit_log', `select=*&org_id=eq.${org}&order=at.desc&limit=${limit}`);
export const loadTrail = (asset, since) =>
  select('positions', `select=at,lat,lon,speed_mph,heading&asset_id=eq.${asset}&at=gte.${q(since)}&order=at.asc&limit=3000`);

// devices grouped by the vehicle they are tied to ('' = not tied)
export function byAsset(devices) {
  const m = new Map();
  for (const d of devices || []) {
    const k = d.asset_id || '';
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(d);
  }
  return m;
}
