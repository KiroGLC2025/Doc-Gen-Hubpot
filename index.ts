/**
 * @module   index (barrel)
 * @layer    L4-Feature
 * @purpose  Public surface of the generator service.
 * @platform Internal
 */
export { generateDealDocument } from "./generateDeal";
export type { GeneratedDoc } from "./generateDeal";
export { mapToCanonical } from "./mapToCanonical";
export { buildRenderContext, renderDocx, docxToPdf, generatePdf } from "./generateDocument";
export { fetchDealBundle } from "./fetchDeal";
export type { DealBundle } from "./fetchDeal";
export { hubspotClient, HubSpotApiError } from "./hubspotClient";
export { canonicalDealSchema, DOC_TYPES } from "./types";
export type { CanonicalDeal, DocType } from "./types";
