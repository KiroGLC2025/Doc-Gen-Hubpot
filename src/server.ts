/**
 * @module   server
 * @layer    L4-Feature
 * @purpose  Minimal HTTP endpoint the HubSpot app function calls: POST /generate { dealId, docType } -> PDF.
 * @exports  app (express)
 * @depends  L4 (generateDeal), L1 (types)
 * @platform Internal (host on Lambda / Cloud Run / Render / Vercel)
 */
import express from "express";
import { z } from "zod";
import { generateDealDocument } from "./generateDeal";
import { DOC_TYPES } from "./types";

export const app = express();
app.use(express.json());

const bodySchema = z.object({
  dealId: z.string().min(1),
  docType: z.enum(DOC_TYPES),
});

// Shared-secret guard. The HubSpot app function sends this header; rotate via env.
app.use((req, res, next) => {
  if (req.path === "/health") return next();
  if (req.header("x-glc-key") !== process.env.GLC_SERVICE_KEY) return res.status(401).json({ error: "unauthorised" });
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/generate", async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "bad request", detail: parsed.error.flatten() });
  try {
    const { filename, pdf } = await generateDealDocument(parsed.data.dealId, parsed.data.docType);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(pdf);
  } catch (err) {
    const message = err instanceof Error ? err.message : "generation failed";
    res.status(500).json({ error: "generation failed", detail: message });
  }
});

const port = Number(process.env.PORT ?? 8080);
if (process.env.NODE_ENV !== "test") app.listen(port, () => console.log(`GLC generator on :${port}`));
