/**
 * @module   generate-deal
 * @layer    L4-Feature
 * @purpose  Use-case: given a HubSpot dealId + docType, fetch, map, generate, and return a named PDF.
 * @exports  generateDealDocument
 * @depends  L2 (fetchDeal), L3 (mapToCanonical, generateDocument), L1 (types)
 * @platform HubSpot + Internal
 */
import { fetchDealBundle } from "./fetchDeal";
import { mapToCanonical } from "./mapToCanonical";
import { generatePdf } from "./generateDocument";
import type { DocType } from "./types";

export interface GeneratedDoc {
  filename: string;
  pdf: Buffer;
  reference: string;
}

export async function generateDealDocument(dealId: string, docType: DocType): Promise<GeneratedDoc> {
  const bundle = await fetchDealBundle(dealId);
  const deal = mapToCanonical(bundle);                 // validates; throws ZodError on bad data
  const pdf = generatePdf(deal, docType);
  const titleByType: Record<DocType, string> = { "letter-of-offer": "Letter of Offer" };
  const filename = `${titleByType[docType]} - ${deal.deal.reference} - ${deal.borrower.entity_name}.pdf`;
  return { filename, pdf, reference: deal.deal.reference };
}
