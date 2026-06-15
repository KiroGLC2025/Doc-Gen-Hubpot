/**
 * @module   fetch-deal
 * @layer    L2-Data
 * @purpose  Read a deal and all associated records (borrower, brokerage, guarantors, securities, owner) from HubSpot.
 * @exports  fetchDealBundle, DealBundle
 * @depends  L2 (hubspotClient)
 * @platform HubSpot
 */
import { hubspotClient, HubSpotObject, HubSpotOwner } from "./hubspotClient";
import { DEAL_PROPS, COMPANY_PROPS, CONTACT_PROPS } from "./propertyNames";

export interface DealBundle {
  deal: HubSpotObject;
  companies: HubSpotObject[];   // classify via glc_company_role: "borrower" | "brokerage"
  contacts: HubSpotObject[];    // classify via glc_party_role: "guarantor" | "broker" | "bdm"
  owner: HubSpotOwner | null;
  // securities are parsed from deal.properties.glc_securities_json in mapToCanonical
}

export async function fetchDealBundle(dealId: string): Promise<DealBundle> {
  const deal = await hubspotClient.getDealWithAssociations(dealId, DEAL_PROPS);

  const companyIds = deal.associations?.companies?.results.map((r) => r.id) ?? [];
  const contactIds = deal.associations?.contacts?.results.map((r) => r.id) ?? [];

  const [companies, contacts] = await Promise.all([
    Promise.all(companyIds.map((id) => hubspotClient.getCompany(id, COMPANY_PROPS))),
    Promise.all(contactIds.map((id) => hubspotClient.getContact(id, CONTACT_PROPS))),
  ]);

  const ownerId = deal.properties.hubspot_owner_id;
  const owner = ownerId ? await hubspotClient.getOwner(ownerId) : null;

  return { deal, companies, contacts, owner };
}
