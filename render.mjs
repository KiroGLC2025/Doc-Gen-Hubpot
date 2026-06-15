import fs from "fs";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

const deal = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));

const m2 = n => Number(n).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const m0 = n => Number(n).toLocaleString("en-AU", { maximumFractionDigits: 0 });
const dt = s => new Date(s).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

// Fixed-layout form: 8 numbered rows. Emit flat positional fields; blanks stay empty.
const flatGuarantors = (arr) => {
  const o = {};
  for (let r = 1; r <= 8; r++) {
    const g = arr[r - 1] || {};
    o[`g${r}_name`] = g.name || ""; o[`g${r}_type`] = g.type || "";
    o[`g${r}_capacity`] = g.capacity || ""; o[`g${r}_ila`] = g.ila || "";
  }
  return o;
};
const flatSecurities = (arr) => {
  const o = {};
  for (let r = 1; r <= 8; r++) {
    const s = arr[r - 1];
    o[`s${r}_address`] = s ? s.address : ""; o[`s${r}_mortgage`] = s ? s.mortgage : "";
    o[`s${r}_lvr`] = s ? `${parseFloat(s.lvr)}%` : ""; o[`s${r}_value`] = s ? `$${m0(s.estimated_value)}` : "";
  }
  return o;
};

// Build the render context (this mirrors src/L3.buildRenderContext)
const ctx = {
  deal: { ...deal.deal, loo_date: dt(deal.deal.loo_date) },
  borrower: deal.borrower,
  broker: deal.broker,
  bdm: deal.bdm,
  facility: {
    ...deal.facility,
    loan_amount: m0(deal.facility.loan_amount),
    total_security_value: `$${m0(deal.facility.total_security_value)}`,
  },
  funding: Object.fromEntries(Object.entries(deal.funding).map(([k, v]) =>
    [k, k.endsWith("rate") ? v : m2(v)])),
  drawdown: Object.fromEntries(Object.entries(deal.drawdown).map(([k, v]) => [k, m2(v)])),
  invoice: { ...deal.invoice, issue_date: dt(deal.invoice.issue_date),
    ...Object.fromEntries(Object.entries(deal.invoice)
      .filter(([k]) => k !== "number" && k !== "issue_date").map(([k, v]) => [k, m2(v)])) },
  ...flatGuarantors(deal.guarantors),
  ...flatSecurities(deal.securities),
};

const zip = new PizZip(fs.readFileSync("templates/letter-of-offer.template.docx", "binary"));
const doc = new Docxtemplater(zip, {
  paragraphLoop: true,
  linebreaks: true,
  nullGetter: () => "",
  parser: (tag) => ({
    get(scope, context) {
      if (tag === ".") return scope;
      const resolve = (obj) => tag.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
      let v = resolve(scope);
      if (v === undefined && context && Array.isArray(context.scopeList)) {
        for (let i = context.scopeList.length - 1; i >= 0 && v === undefined; i--) v = resolve(context.scopeList[i]);
      }
      return v;
    },
  }),
});
doc.render(ctx);
fs.writeFileSync(process.argv[3], doc.getZip().generate({ type: "nodebuffer" }));
console.log("rendered ->", process.argv[3]);
