/**
 * @module   setup-properties
 * @layer    L2-Data (one-off provisioning script)
 * @purpose  Create the Security custom object + all GLC properties on Deal/Company/Contact from properties.json.
 * @platform HubSpot
 *
 * Run once per portal:  HUBSPOT_PRIVATE_APP_TOKEN=pat-xxxx node hubspot/setup-properties.mjs
 * Idempotent-ish: skips 409 (already exists). Custom objects require an Enterprise subscription.
 */
import fs from "node:fs";

const TOKEN = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
if (!TOKEN) throw new Error("Set HUBSPOT_PRIVATE_APP_TOKEN");
const defs = JSON.parse(fs.readFileSync(new URL("./properties.json", import.meta.url)));

const api = async (path, body, method = "POST") => {
  const res = await fetch(`https://api.hubapi.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 409) return { skipped: true };
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
};

const toProp = (p) => ({
  name: p.name, label: p.label, type: p.type, fieldType: p.fieldType,
  groupName: p.groupName,
  ...(p.options ? { options: p.options.map((o, i) => ({ label: o, value: o, displayOrder: i })) } : {}),
});

// Properties on standard objects (batch per object). No custom objects — works on Professional.
for (const [obj, props] of [["deals", defs.deal], ["companies", defs.company], ["contacts", defs.contact]]) {
  const r = await api(`/crm/v3/properties/${obj}/batch/create`, { inputs: props.map(toProp) });
  console.log(`${obj}:`, r.skipped ? "some/all existed" : `created ${r.results?.length ?? props.length}`);
}
console.log("Done.");
