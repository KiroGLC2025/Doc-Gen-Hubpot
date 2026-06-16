/**
 * @module   generate-document
 * @layer    L3-Service
 * @purpose  Pure-ish render: CanonicalDeal -> formatted context -> filled .docx -> .pdf buffer. No HubSpot here.
 * @exports  buildRenderContext, renderDocx, docxToPdf, generatePdf
 * @depends  L1 (types)
 * @platform Internal
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import type { CanonicalDeal, DocType } from "./types";

const TEMPLATES: Record<DocType, string> = {
  "letter-of-offer": path.join(process.cwd(), "templates/letter-of-offer.template.docx"),
};

const m2 = (v: number) => v.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const m0 = (v: number) => v.toLocaleString("en-AU", { maximumFractionDigits: 0 });
const dt = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

/** Format raw canonical numbers into the display strings the template expects.
 *  Guarantor/security tables are FIXED 8-row forms — emit flat positional fields
 *  (g1_name … g8_ila, s1_address … s8_value); blanks stay empty so the layout never moves. */
export function buildRenderContext(deal: CanonicalDeal): Record<string, unknown> {
  const fundingFmt = Object.fromEntries(
    Object.entries(deal.funding).map(([k, v]) => [k, k.endsWith("rate") ? v : m2(v as number)]),
  );
  const invoiceFmt = Object.fromEntries(
    Object.entries(deal.invoice).map(([k, v]) =>
      k === "number" || k === "issue_date" ? [k, v] : [k, m2(v as number)]),
  );
  const guarantorFields: Record<string, string> = {};
  for (let r = 1; r <= 8; r++) {
    const g = deal.guarantors[r - 1];
    guarantorFields[`g${r}_name`] = g?.name ?? "";
    guarantorFields[`g${r}_type`] = g?.type ?? "";
    guarantorFields[`g${r}_capacity`] = g?.capacity ?? "";
    guarantorFields[`g${r}_ila`] = g?.ila ?? "";
  }
  const securityFields: Record<string, string> = {};
  for (let r = 1; r <= 8; r++) {
    const s = deal.securities[r - 1];
    securityFields[`s${r}_address`] = s?.address ?? "";
    securityFields[`s${r}_mortgage`] = s?.mortgage ?? "";
    securityFields[`s${r}_lvr`] = s ? `${parseFloat(String(s.lvr))}%` : "";
    securityFields[`s${r}_value`] = s ? `$${m0(s.estimated_value)}` : "";
  }
  return {
    deal: { ...deal.deal, loo_date: dt(deal.deal.loo_date) },
    borrower: deal.borrower,
    broker: deal.broker,
    bdm: deal.bdm,
    facility: { ...deal.facility, loan_amount: m0(deal.facility.loan_amount), total_security_value: `$${m0(deal.facility.total_security_value)}` },
    funding: fundingFmt,
    drawdown: Object.fromEntries(Object.entries(deal.drawdown).map(([k, v]) => [k, m2(v as number)])),
    invoice: { ...invoiceFmt, issue_date: dt(deal.invoice.issue_date) },
    ...guarantorFields,
    ...securityFields,
  };
}

/** Dotted-path parser with parent-scope fallback (docxtemplater does not resolve a.b by default). */
const dottedParser = (tag: string) => ({
  get(scope: Record<string, unknown>, context: { scopeList?: Record<string, unknown>[] }) {
    if (tag === ".") return scope;
    const resolve = (o: unknown) => tag.split(".").reduce<unknown>((acc, k) => (acc == null ? undefined : (acc as Record<string, unknown>)[k]), o);
    let v = resolve(scope);
    if (v === undefined && context?.scopeList) {
      for (let i = context.scopeList.length - 1; i >= 0 && v === undefined; i--) v = resolve(context.scopeList[i]);
    }
    return v;
  },
});

export function renderDocx(deal: CanonicalDeal, docType: DocType): Buffer {
  const zip = new PizZip(fs.readFileSync(TEMPLATES[docType], "binary"));
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, nullGetter: () => "", parser: dottedParser });
  doc.render(buildRenderContext(deal));
  return doc.getZip().generate({ type: "nodebuffer" });
}

/** Convert .docx -> .pdf using a headless LibreOffice (soffice) on the host/container. */
export function docxToPdf(docx: Buffer): Buffer {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "glc-"));
  const inPath = path.join(dir, "doc.docx");
  fs.writeFileSync(inPath, docx);
  // Isolate the LibreOffice profile per call so concurrent requests don't contend on a shared lock.
  execFileSync("soffice", [
    "--headless", `-env:UserInstallation=file://${dir}/loprofile`,
    "--convert-to", "pdf", "--outdir", dir, inPath,
  ], { stdio: "ignore" });
  return fs.readFileSync(path.join(dir, "doc.pdf"));
}

export function generatePdf(deal: CanonicalDeal, docType: DocType): Buffer {
  return docxToPdf(renderDocx(deal, docType));
}
