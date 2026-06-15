/**
 * @module   map-to-canonical
 * @layer    L3-Service
 * @purpose  Pure transform: HubSpot DealBundle -> validated CanonicalDeal. This IS the field map, in code.
 * @exports  mapToCanonical
 * @depends  L1 (types), L2 type (DealBundle) — type-only import, no I/O here
 * @platform Internal
 */
import Decimal from "decimal.js";
import type { DealBundle } from "./fetchDeal";
import { canonicalDealSchema, type CanonicalDeal, type ProductName, type FacilityType, type RepaymentType, type GuarantorType, type MortgagePosition } from "./types";

const n = (v: string | null | undefined): number => (v == null || v === "" ? 0 : Number(v));
const s = (v: string | null | undefined): string => v ?? "";
const GST = new Decimal("0.10");

export function mapToCanonical(b: DealBundle): CanonicalDeal {
  const d = b.deal.properties;

  const borrower = b.companies.find((c) => c.properties.glc_company_role === "borrower") ?? b.companies[0];
  const brokerage = b.companies.find((c) => c.properties.glc_company_role === "brokerage");
  const brokerContact = b.contacts.find((c) => c.properties.glc_party_role === "broker");
  const guarantorContacts = b.contacts.filter((c) => c.properties.glc_party_role === "guarantor");

  // Securities come from one structured deal property (no custom object on Professional).
  // Shape: [{ address, mortgage, lvr, estimated_value }]
  let rawSecurities: Array<Record<string, unknown>> = [];
  try {
    const parsed = JSON.parse(s(d.glc_securities_json) || "[]");
    if (Array.isArray(parsed)) rawSecurities = parsed;
  } catch {
    rawSecurities = [];
  }
  const securities = rawSecurities.slice(0, 8).map((sec) => ({
    address: s(sec.address as string),
    mortgage: ((sec.mortgage as string) || "First") as MortgagePosition,
    lvr: n(sec.lvr as string),
    estimated_value: n((sec.estimated_value ?? sec.value) as string),
  }));

  // Derived (computed) — never trust a hand-typed total.
  const totalSecurity = securities.reduce((t, x) => t.plus(x.estimated_value), new Decimal(0));
  const ddFee = new Decimal(n(d.glc_dd_fee));
  const valFee = new Decimal(n(d.glc_valuation_fee));
  const legalFee = new Decimal(n(d.glc_legal_fee));
  const line = (fee: Decimal) => ({ fee: fee.toNumber(), gst: fee.times(GST).toNumber(), total: fee.times(1 + +GST).toNumber() });
  const dd = line(ddFee), val = line(valFee), legal = line(legalFee);
  const exclGst = ddFee.plus(valFee).plus(legalFee);
  const inclGst = exclGst.times(1 + +GST);
  const paid = new Decimal(n(d.glc_invoice_paid));

  const candidate: CanonicalDeal = {
    deal: {
      reference: s(d.glc_deal_reference),
      loo_date: s(d.glc_loo_date) || new Date().toISOString().slice(0, 10),
      validity_days: n(d.glc_loo_validity_days) || 14,
      product: (s(d.glc_product) || "Core") as ProductName,
      panel_solicitor: s(d.glc_panel_solicitor),
    },
    borrower: {
      entity_name: s(borrower?.properties.name),
      acn: s(borrower?.properties.glc_acn),
      abn: s(borrower?.properties.glc_abn),
    },
    broker: {
      name: brokerContact
        ? `${s(brokerContact.properties.firstname)} ${s(brokerContact.properties.lastname)}`.trim()
        : "",
      company_name: s(brokerage?.properties.name),
      company_abn: s(brokerage?.properties.glc_abn),
      email: s(brokerContact?.properties.email),
    },
    guarantors: guarantorContacts.slice(0, 8).map((g) => ({
      name: `${s(g.properties.firstname)} ${s(g.properties.lastname)}`.trim(),
      type: (s(g.properties.glc_guarantor_type) || "Individual") as GuarantorType,
      capacity: s(g.properties.glc_guarantor_capacity),
      ila: (s(g.properties.glc_ila_required) === "No" ? "No" : "Yes"),
    })),
    facility: {
      loan_amount: n(d.amount),
      interest_rate: n(d.glc_interest_rate),
      lvr: n(d.glc_lvr),
      term_months: n(d.glc_loan_term_months),
      facility_type: (s(d.glc_facility_type) || "First Mortgage") as FacilityType,
      prepaid_interest_months: n(d.glc_prepaid_interest_months),
      minimum_interest_months: n(d.glc_minimum_interest_months),
      repayment_type: (s(d.glc_repayment_type) || "Interest Only") as RepaymentType,
      loan_purpose: s(d.glc_loan_purpose),
      exit_strategy: s(d.glc_exit_strategy),
      total_security_value: totalSecurity.toNumber(),
    },
    securities,
    funding: {
      interest_rate: n(d.glc_interest_rate), interest_amount: n(d.glc_prepaid_interest_amount),
      mbr_rate: n(d.glc_mbr_rate), mbr_amount: n(d.glc_mbr_amount),
      estab_rate: n(d.glc_establishment_pct), estab_amount: n(d.glc_establishment_amount),
      brokerage_rate: n(d.glc_brokerage_pct), brokerage_amount: n(d.glc_brokerage_amount),
      legal_fees: n(d.glc_legal_fee),
      total_costs: n(d.glc_total_costs),
      funds_available: n(d.glc_net_funds_advanced),
      total_repayment: n(d.glc_total_repayment),
    },
    drawdown: {
      facility_amount: n(d.amount),
      less_prepaid_interest: n(d.glc_prepaid_interest_amount),
      less_prepaid_mbr: n(d.glc_mbr_amount),
      less_establishment: n(d.glc_establishment_amount),
      less_brokerage: n(d.glc_brokerage_amount),
      less_legal: n(d.glc_legal_fee),
      net_surplus: n(d.glc_net_surplus),
    },
    invoice: {
      number: s(d.glc_invoice_number), issue_date: s(d.glc_invoice_date) || new Date().toISOString().slice(0, 10),
      dd_fee: dd.fee, dd_gst: dd.gst, dd_total: dd.total,
      val_fee: val.fee, val_gst: val.gst, val_total: val.total,
      legal_fee: legal.fee, legal_gst: legal.gst, legal_total: legal.total,
      total_excl_gst: exclGst.toNumber(), total_incl_gst: inclGst.toNumber(),
      already_paid: paid.toNumber(), total_due: inclGst.minus(paid).toNumber(),
    },
    bdm: {
      name: b.owner ? `${b.owner.firstName} ${b.owner.lastName}`.trim() : s(d.glc_bdm_name),
      mobile: s(d.glc_bdm_mobile),
      email: b.owner ? b.owner.email : s(d.glc_bdm_email),
    },
  };

  return canonicalDealSchema.parse(candidate); // validate at the boundary
}
