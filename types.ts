/**
 * @module   canonical-deal
 * @layer    L1-Foundation
 * @purpose  Canonical deal model + runtime schema; the single contract every template fills from.
 * @exports  CanonicalDeal, GuarantorType, MortgagePosition, RepaymentType, FacilityType, ProductName, canonicalDealSchema
 * @depends  none (zod only)
 * @platform Internal
 */
import { z } from "zod";

export const PRODUCTS = ["Prime", "Prime Elite", "Prime Max", "Core", "Enterprise", "Velocity", "Balance"] as const;
export const FACILITY_TYPES = ["First Mortgage", "Second Mortgage", "Blended"] as const;
export const REPAYMENT_TYPES = ["Interest Only", "Principal & Interest", "Interest Capitalised"] as const;
export const GUARANTOR_TYPES = ["Individual", "Corporate"] as const;
export const MORTGAGE_POSITIONS = ["First", "Second"] as const;

export type ProductName = (typeof PRODUCTS)[number];
export type FacilityType = (typeof FACILITY_TYPES)[number];
export type RepaymentType = (typeof REPAYMENT_TYPES)[number];
export type GuarantorType = (typeof GUARANTOR_TYPES)[number];
export type MortgagePosition = (typeof MORTGAGE_POSITIONS)[number];

const money = z.number().nonnegative();
const pct = z.number().min(0).max(100);

export const canonicalDealSchema = z.object({
  deal: z.object({
    reference: z.string().min(1),
    loo_date: z.string(),               // ISO yyyy-mm-dd
    validity_days: z.number().int().positive(),
    product: z.enum(PRODUCTS),
    panel_solicitor: z.string().optional().default(""),
  }),
  borrower: z.object({
    entity_name: z.string().min(1),
    acn: z.string().optional().default(""),
    abn: z.string().optional().default(""),
  }),
  broker: z.object({
    name: z.string().optional().default(""),
    company_name: z.string().optional().default(""),
    company_abn: z.string().optional().default(""),
    email: z.string().optional().default(""),
  }),
  guarantors: z.array(z.object({
    name: z.string().min(1),
    type: z.enum(GUARANTOR_TYPES),
    capacity: z.string(),
    ila: z.enum(["Yes", "No"]),
  })).max(8),
  facility: z.object({
    loan_amount: money,
    interest_rate: pct,
    lvr: pct,
    term_months: z.number().int().positive(),
    facility_type: z.enum(FACILITY_TYPES),
    prepaid_interest_months: z.number().int().nonnegative(),
    minimum_interest_months: z.number().int().nonnegative(),
    repayment_type: z.enum(REPAYMENT_TYPES),
    loan_purpose: z.string(),
    exit_strategy: z.string(),
    total_security_value: money,
  }),
  securities: z.array(z.object({
    address: z.string().min(1),
    mortgage: z.enum(MORTGAGE_POSITIONS),
    lvr: pct,
    estimated_value: money,
  })).min(1).max(8),
  funding: z.object({
    interest_rate: pct, interest_amount: money,
    mbr_rate: pct, mbr_amount: money,
    estab_rate: pct, estab_amount: money,
    brokerage_rate: pct, brokerage_amount: money,
    legal_fees: money,
    total_costs: money, funds_available: money, total_repayment: money,
  }),
  drawdown: z.object({
    facility_amount: money,
    less_prepaid_interest: money, less_prepaid_mbr: money,
    less_establishment: money, less_brokerage: money, less_legal: money,
    net_surplus: money,
  }),
  invoice: z.object({
    number: z.string(), issue_date: z.string(),
    dd_fee: money, dd_gst: money, dd_total: money,
    val_fee: money, val_gst: money, val_total: money,
    legal_fee: money, legal_gst: money, legal_total: money,
    total_excl_gst: money, total_incl_gst: money, already_paid: money, total_due: money,
  }),
  bdm: z.object({
    name: z.string(), mobile: z.string(), email: z.string(),
  }),
});

export type CanonicalDeal = z.infer<typeof canonicalDealSchema>;

export const DOC_TYPES = ["letter-of-offer"] as const;        // formal-approval, invoice, im → add templates later
export type DocType = (typeof DOC_TYPES)[number];
