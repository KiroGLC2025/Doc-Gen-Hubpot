# GLC Deal Document Generator

Generate Greenlink Capital deal documents (starting with the Letter of Offer) from HubSpot data.
The deal is defined **once** in HubSpot; the service pulls it, maps it to a canonical model, fills
the designed Word template, and returns a branded PDF that gets filed back on the deal.

```
 HubSpot Deal record
   │  (Generate button — React UI extension card)
   ▼
 HubSpot app function  ──fetch──►  Generator service (this repo, hosted)
   ▲                                  │ 1. fetchDealBundle  (read deal + company + contacts + securities)
   │  upload PDF to Files,            │ 2. mapToCanonical   (HubSpot → canonical model = the field map)
   │  add note to deal timeline       │ 3. generatePdf      (canonical → docxtemplater → .docx → .pdf)
   └──────────────  PDF  ◄────────────┘
```

The **canonical model** (`src/types.ts` / `canonical/example.deal.json`) is the seam: HubSpot feeds it,
templates consume it. Swap HubSpot later, or add EasyLodge, and you re-point one adapter — not the templates.

## Layers (per js-module-architect)

| Layer | Files | Role |
|-------|-------|------|
| L1 Foundation | `types.ts`, `propertyNames.ts` | Canonical types + zod schema; HubSpot property names |
| L2 Data | `hubspotClient.ts`, `fetchDeal.ts` | All HubSpot I/O (auth, rate limit, retry) |
| L3 Service | `mapToCanonical.ts`, `generateDocument.ts` | Pure transforms: HS→canonical, canonical→PDF |
| L4 Feature | `generateDeal.ts`, `server.ts` | Use-case + HTTP endpoint |
| L5 UI | `hubspot-app/extensions/deal-docs-card.jsx` | Card with Generate buttons |

## What's in the box

- `field-map.xlsx` — every LOO field → HubSpot object + property + type (58 fields).
- `templates/letter-of-offer.template.docx` — your Word file, tokenised (`{tokens}` + guarantor/security row-loops). **Designers keep editing this file**; the engine just fills it.
- `templates/source_Letter_of_Offer.docx` — the original, untouched.
- `tokenise_template.py` — re-run if you change the source layout, to regenerate the tokenised template.
- `canonical/example.deal.json` — a worked example deal.
- `render.mjs` — standalone proof: canonical JSON → filled PDF (no HubSpot needed).
- `src/` — the generator service.
- `hubspot/` — property definitions + one-time setup script.
- `hubspot-app/` — the serverless app function + React card.

## Run the proof locally (no HubSpot)

```bash
npm install
node render.mjs canonical/example.deal.json "Letter of Offer.docx"
# then convert with LibreOffice: soffice --headless --convert-to pdf "Letter of Offer.docx"
```

## Stand it up on HubSpot

1. **Create the fields.** `HUBSPOT_PRIVATE_APP_TOKEN=pat-xxx node hubspot/setup-properties.mjs`
   Creates all `glc_*` properties on Deal/Company/Contact (including `glc_securities_json`). No custom objects — runs on Professional.
2. **Model a deal.** Borrower = associated Company (`glc_company_role = borrower`); guarantors = associated
   Contacts (`glc_party_role = guarantor`); broker = Contact + brokerage Company. **Securities are entered in the
   deal card's table** (stored in the `glc_securities_json` property) — no custom object needed.
3. **Host the service on Render.** The repo ships a `Dockerfile` (Node + LibreOffice) and a `render.yaml`
   blueprint. In Render: **New → Blueprint → pick this repo** — it creates a Docker web service in the
   Singapore region on the Starter plan (always-on; don't use Free, its idle spin-down makes LibreOffice
   cold starts slow). In the service's **Environment** tab set `HUBSPOT_PRIVATE_APP_TOKEN` and
   `GLC_SERVICE_KEY` (any secret string you invent). You'll get a URL like
   `https://glc-deal-generator.onrender.com`; confirm `/health` returns `{ "ok": true }`.
   For pixel-identical output, drop licensed `Georgia*.ttf` / `Calibri*.ttf` into `fonts/` first (see
   `fonts/README.txt`); without them Calibri falls back to Carlito automatically.
4. **Deploy the app** (`hubspot-app/`) with the HubSpot CLI (`hs project upload`). Set secrets
   `GLC_SERVICE_URL` (the Render URL), `GLC_SERVICE_KEY` (same string), `HUBSPOT_PRIVATE_APP_TOKEN`. The card appears on the deal record.

## Decisions you need to make

- **Securities — solved for Professional tier.** A deal has 1–8 properties, each with its own value/LVR — a
  one-to-many that custom objects would model, but those need Enterprise. Instead, securities live in a single
  `glc_securities_json` property on the Deal, edited through a clean table in the deal card and parsed by
  `mapToCanonical`. Trade-off: securities aren't independently reportable/filterable the way a custom object
  would be. If you move to Enterprise later, swap to a Security custom object by changing only `fetchDeal` and
  `mapToCanonical` — the template, card, and canonical model stay the same.
- **E-signature.** Not in this build. Clause 22 already allows electronic execution; add DocuSign/Annature as a
  step after generation when ready (you have the DocuSign connector available).
- **Signature blocks (v2).** The acceptance/execution blocks currently default the entity to the borrower.
  Looping a block per signing entity (borrower + each corporate guarantor) is a planned enhancement — the data
  (`guarantors[]`) is already there.

## Adding more documents

Each new doc = one tokenised `.docx` in `templates/` + an entry in `TEMPLATES` (`generateDocument.ts`) and
`DOC_TYPES` (`types.ts`). The canonical model and HubSpot mapping are shared, so Formal Approval, IM, and the
standalone Invoice mostly reuse what's here.
