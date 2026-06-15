/**
 * @module   property-names
 * @layer    L1-Foundation
 * @purpose  Internal HubSpot property names per object — the field map expressed as code constants.
 * @exports  DEAL_PROPS, COMPANY_PROPS, CONTACT_PROPS
 * @depends  none
 * @platform HubSpot
 */
export const DEAL_PROPS = [
  "dealname", "amount", "hubspot_owner_id",
  "glc_deal_reference", "glc_loo_date", "glc_loo_validity_days", "glc_product", "glc_panel_solicitor",
  "glc_interest_rate", "glc_lvr", "glc_loan_term_months", "glc_facility_type",
  "glc_prepaid_interest_months", "glc_minimum_interest_months", "glc_repayment_type",
  "glc_loan_purpose", "glc_exit_strategy", "glc_total_security_value",
  "glc_prepaid_interest_amount", "glc_mbr_rate", "glc_mbr_amount",
  "glc_establishment_pct", "glc_establishment_amount", "glc_brokerage_pct", "glc_brokerage_amount",
  "glc_legal_fee", "glc_total_costs", "glc_net_funds_advanced", "glc_total_repayment", "glc_net_surplus",
  "glc_invoice_number", "glc_invoice_date", "glc_dd_fee", "glc_valuation_fee", "glc_invoice_paid",
  "glc_bdm_name", "glc_bdm_mobile", "glc_bdm_email",
  // Securities (1..8) live in one structured property — no custom object, works on Professional.
  "glc_securities_json",
];
export const COMPANY_PROPS = ["name", "glc_acn", "glc_abn", "glc_company_role"];
export const CONTACT_PROPS = [
  "firstname", "lastname", "email", "phone",
  "glc_party_role", "glc_guarantor_type", "glc_guarantor_capacity", "glc_ila_required",
];
