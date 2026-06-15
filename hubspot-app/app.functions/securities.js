/**
 * @module   app.function: securities
 * @layer    L4-Feature (HubSpot-hosted)
 * @purpose  Read/save the deal's securities schedule (one JSON property) — replaces the Enterprise custom object.
 * @platform HubSpot (serverless app function)
 *
 * parameters: { action: "get" | "save", dealId, securities? }
 * Secrets: HUBSPOT_PRIVATE_APP_TOKEN
 */
const TOKEN = () => process.env.HUBSPOT_PRIVATE_APP_TOKEN;
const headers = () => ({ Authorization: `Bearer ${TOKEN()}`, "Content-Type": "application/json" });

exports.main = async (context = {}) => {
  const { action = "get", dealId, securities } = context.parameters || {};
  if (!dealId) return { ok: false, error: "missing dealId" };

  if (action === "save") {
    const clean = (Array.isArray(securities) ? securities : []).slice(0, 8).map((s) => ({
      address: String(s.address || ""),
      mortgage: s.mortgage === "Second" ? "Second" : "First",
      lvr: Number(s.lvr) || 0,
      estimated_value: Number(s.estimated_value ?? s.value) || 0,
    }));
    const res = await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${dealId}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ properties: { glc_securities_json: JSON.stringify(clean) } }),
    });
    if (!res.ok) return { ok: false, error: `save ${res.status}` };
    return { ok: true, securities: clean };
  }

  // get
  const res = await fetch(
    `https://api.hubapi.com/crm/v3/objects/deals/${dealId}?properties=glc_securities_json`,
    { headers: headers() },
  );
  if (!res.ok) return { ok: false, error: `get ${res.status}` };
  const deal = await res.json();
  let parsed = [];
  try { parsed = JSON.parse(deal.properties.glc_securities_json || "[]"); } catch { parsed = []; }
  return { ok: true, securities: Array.isArray(parsed) ? parsed : [] };
};
