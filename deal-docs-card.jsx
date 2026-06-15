/**
 * @module   deal-docs-card
 * @layer    L5-UI (HubSpot UI Extension)
 * @purpose  Deal-record card: edit the securities schedule (stored in one deal property), then generate the LOO PDF.
 * @platform HubSpot (UI Extensions, React) — Professional tier; no custom objects used.
 *
 * No fetch/business logic here — all I/O goes through runServerlessFunction('securities' | 'generateDoc').
 */
import React, { useState, useEffect } from "react";
import {
  hubspot, Button, Select, Input, Table, TableHead, TableRow, TableHeader,
  TableBody, TableCell, Flex, Text, Link, Alert, LoadingSpinner, Divider,
} from "@hubspot/ui-extensions";

const DOC_OPTIONS = [{ label: "Letter of Offer", value: "letter-of-offer" }];
const MORTGAGE = [{ label: "First", value: "First" }, { label: "Second", value: "Second" }];
const blankRow = () => ({ address: "", mortgage: "First", lvr: "", estimated_value: "" });

hubspot.extend(({ context, runServerlessFunction }) => (
  <DealDocsCard context={context} runServerless={runServerlessFunction} />
));

function DealDocsCard({ context, runServerless }) {
  const dealId = String(context.crm.objectId);
  const [rows, setRows] = useState([blankRow()]);
  const [docType, setDocType] = useState("letter-of-offer");
  const [gen, setGen] = useState({ status: "idle" });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    runServerless({ name: "securities", parameters: { action: "get", dealId } })
      .then(({ response }) => {
        if (response?.ok && response.securities.length) setRows(response.securities.map(normalise));
      })
      .catch(() => {});
  }, [dealId]);

  const update = (i, key, val) => setRows((r) => r.map((row, j) => (j === i ? { ...row, [key]: val } : row)));
  const addRow = () => setRows((r) => (r.length < 8 ? [...r, blankRow()] : r));
  const removeRow = (i) => setRows((r) => r.filter((_, j) => j !== i));

  const save = async () => {
    setSaved(false);
    const { response } = await runServerless({ name: "securities", parameters: { action: "save", dealId, securities: rows } });
    setSaved(Boolean(response?.ok));
  };

  const generate = async () => {
    setGen({ status: "loading" });
    await save(); // persist edits before generating
    try {
      const { response } = await runServerless({ name: "generateDoc", parameters: { dealId, docType } });
      if (response?.ok) setGen({ status: "done", url: response.url, filename: response.filename });
      else setGen({ status: "error", message: response?.error || "Generation failed" });
    } catch (e) {
      setGen({ status: "error", message: e.message });
    }
  };

  const total = rows.reduce((t, r) => t + (Number(r.estimated_value) || 0), 0);

  return (
    <Flex direction="column" gap="medium">
      <Text format={{ fontWeight: "bold" }}>Security schedule</Text>
      <Table bordered>
        <TableHead>
          <TableRow>
            <TableHeader>Property & title</TableHeader>
            <TableHeader>Mortgage</TableHeader>
            <TableHeader>LVR %</TableHeader>
            <TableHeader>Est. value</TableHeader>
            <TableHeader> </TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              <TableCell><Input name={`addr${i}`} value={row.address} onChange={(v) => update(i, "address", v)} /></TableCell>
              <TableCell><Select name={`m${i}`} options={MORTGAGE} value={row.mortgage} onChange={(v) => update(i, "mortgage", v)} /></TableCell>
              <TableCell><Input name={`lvr${i}`} value={String(row.lvr)} onChange={(v) => update(i, "lvr", v)} /></TableCell>
              <TableCell><Input name={`val${i}`} value={String(row.estimated_value)} onChange={(v) => update(i, "estimated_value", v)} /></TableCell>
              <TableCell><Button variant="transparent" onClick={() => removeRow(i)}>Remove</Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Flex justify="between">
        <Button onClick={addRow} disabled={rows.length >= 8}>Add security</Button>
        <Text format={{ fontWeight: "bold" }}>Total security value: ${total.toLocaleString("en-AU")}</Text>
      </Flex>
      <Button onClick={save}>Save securities</Button>
      {saved && <Alert title="Saved" variant="success">Security schedule saved to the deal.</Alert>}

      <Divider />
      <Text format={{ fontWeight: "bold" }}>Generate deal document</Text>
      <Select label="Document" options={DOC_OPTIONS} value={docType} onChange={setDocType} />
      <Button variant="primary" onClick={generate} disabled={gen.status === "loading"}>Generate</Button>
      {gen.status === "loading" && <LoadingSpinner label="Building PDF…" />}
      {gen.status === "done" && (
        <Alert title="Document ready" variant="success">
          <Link href={gen.url}>{gen.filename}</Link> — also saved to the deal timeline.
        </Alert>
      )}
      {gen.status === "error" && <Alert title="Couldn't generate" variant="error">{gen.message}</Alert>}
    </Flex>
  );
}

const normalise = (s) => ({
  address: s.address || "",
  mortgage: s.mortgage === "Second" ? "Second" : "First",
  lvr: s.lvr ?? "",
  estimated_value: s.estimated_value ?? s.value ?? "",
});
