/**
 * @module   app.function: generate-doc
 * @layer    L4-Feature (HubSpot-hosted)
 * @purpose  Server-side bridge: UI card -> this function -> external generator service -> upload PDF to Files -> return URL.
 * @platform HubSpot (Developer Platform 2026.03 serverless app function)
 *
 * Secrets (set with `hs secrets`): GLC_SERVICE_URL, GLC_SERVICE_KEY, HUBSPOT_PRIVATE_APP_TOKEN
 * Wire-up: referenced by deal-docs-card.jsx via hubspot.serverless('generateDoc', { parameters }).
 */
exports.main = async (context = {}) => {
  const { dealId, docType = "letter-of-offer" } = context.parameters || {};
  if (!dealId) return { ok: false, error: "missing dealId" };

  // 1) Ask the external service to render the PDF (keeps heavy deps off HubSpot).
  const res = await fetch(`${process.env.GLC_SERVICE_URL}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-glc-key": process.env.GLC_SERVICE_KEY },
    body: JSON.stringify({ dealId, docType }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { ok: false, error: `generator ${res.status}`, detail };
  }
  const filename = (res.headers.get("Content-Disposition") || "").match(/filename="(.+)"/)?.[1] || "Letter of Offer.pdf";
  const pdf = Buffer.from(await res.arrayBuffer());

  // 2) Upload to HubSpot Files (private, scoped to the deal's folder).
  const form = new FormData();
  form.append("file", new Blob([pdf], { type: "application/pdf" }), filename);
  form.append("folderPath", "/deal-documents");
  form.append("options", JSON.stringify({ access: "PRIVATE", overwrite: true }));
  const up = await fetch("https://api.hubapi.com/files/v3/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.HUBSPOT_PRIVATE_APP_TOKEN}` },
    body: form,
  });
  if (!up.ok) return { ok: false, error: `file upload ${up.status}` };
  const file = await up.json();

  // 3) Note + attachment on the deal so it shows on the timeline.
  await fetch("https://api.hubapi.com/crm/v3/objects/notes", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.HUBSPOT_PRIVATE_APP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      properties: { hs_note_body: `${filename} generated`, hs_timestamp: Date.now() },
      associations: [{ to: { id: dealId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 214 }] }],
      attachments: [{ id: file.id }],
    }),
  });

  return { ok: true, filename, url: file.url, fileId: file.id };
};
