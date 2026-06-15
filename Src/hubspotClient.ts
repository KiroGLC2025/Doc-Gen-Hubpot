/**
 * @module   hubspot-client
 * @layer    L2-Data
 * @purpose  Authenticated HubSpot API client with rate limiting and 429 retry. All HubSpot I/O passes through here.
 * @exports  hubspotClient, HubSpotApiError
 * @depends  none
 * @platform HubSpot
 */
import { RateLimiter } from "limiter";

const BASE_URL = "https://api.hubapi.com";
// HubSpot standard limit is 10 req/sec; stay just under.
const rateLimiter = new RateLimiter({ tokensPerInterval: 9, interval: "second" });

export class HubSpotApiError extends Error {
  constructor(public status: number, message: string, public path: string) {
    super(message);
    this.name = "HubSpotApiError";
  }
}

async function hubspotFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  await rateLimiter.removeTokens(1);
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.HUBSPOT_PRIVATE_APP_TOKEN}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("Retry-After") ?? "5", 10);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return hubspotFetch<T>(path, options);
  }
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    throw new HubSpotApiError(res.status, err.message ?? res.statusText, path);
  }
  return res.json() as Promise<T>;
}

export const hubspotClient = {
  /** A deal with selected properties and the associations needed to build a LOO. */
  getDealWithAssociations: (dealId: string, properties: string[]) =>
    hubspotFetch<HubSpotObject>(
      `/crm/v3/objects/deals/${dealId}?properties=${properties.join(",")}` +
      `&associations=companies,contacts`,
    ),
  getCompany: (id: string, properties: string[]) =>
    hubspotFetch<HubSpotObject>(`/crm/v3/objects/companies/${id}?properties=${properties.join(",")}`),
  getContact: (id: string, properties: string[]) =>
    hubspotFetch<HubSpotObject>(`/crm/v3/objects/contacts/${id}?properties=${properties.join(",")}`),
  getOwner: (id: string) => hubspotFetch<HubSpotOwner>(`/crm/v3/owners/${id}`),
  /** Persist the securities table (from the deal-card editor) into one deal property. */
  patchDeal: (dealId: string, properties: Record<string, string>) =>
    hubspotFetch<HubSpotObject>(`/crm/v3/objects/deals/${dealId}`, {
      method: "PATCH",
      body: JSON.stringify({ properties }),
    }),
  /** Attach the generated PDF back onto the deal as a note with file. */
  uploadFileToDeal: (dealId: string, fileId: string) =>
    hubspotFetch(`/crm/v3/objects/notes`, {
      method: "POST",
      body: JSON.stringify({
        properties: { hs_note_body: "Letter of Offer generated", hs_timestamp: Date.now() },
        associations: [{ to: { id: dealId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 214 }] }],
        attachments: [{ id: fileId }],
      }),
    }),
};

export interface HubSpotObject {
  id: string;
  properties: Record<string, string | null>;
  associations?: Record<string, { results: Array<{ id: string; type: string }> }>;
}
export interface HubSpotOwner {
  id: string; firstName: string; lastName: string; email: string;
}
