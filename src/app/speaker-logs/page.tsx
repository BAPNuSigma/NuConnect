"use client";

import React, { useEffect, useState, useRef } from "react";

const OUTCOMES = ["confirm", "spoke", "cancel", "rescheduled"] as const;
const OUTCOME_LABELS: Record<string, string> = { confirm: "Confirmed", spoke: "Spoke", cancel: "Canceled", rescheduled: "Rescheduled" };
const PAGE_SIZES = [10, 25, 50, 100] as const;
type Firm = { id: number; name: string; discipline?: string | null; contactFirstName?: string | null; contactLastName?: string | null; contactName?: string | null };
type Semester = { id: number; label: string; year: number };
type Log = {
  id: number;
  firmId: number;
  semesterId: number;
  logDate: string;
  outcome: string | null;
  thankYouSent: boolean | null;
  thankYouSentAt: string | null;
  notes: string | null;
  firm: Firm;
  semester: Semester;
};

function speakerName(firm: Firm | null | undefined): string {
  if (!firm) return "—";
  if (firm.contactFirstName || firm.contactLastName) return [firm.contactFirstName, firm.contactLastName].filter(Boolean).join(" ").trim() || "—";
  return firm.contactName ?? "—";
}

export default function SpeakerLogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    firmId: 0,
    semesterId: 0,
    logDate: new Date().toISOString().slice(0, 10),
    outcome: "confirm" as const,
    thankYouSent: false,
    notes: "",
  });
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSemesterId, setFilterSemesterId] = useState<string>("");
  const [filterOutcome, setFilterOutcome] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);

  const filteredLogs = React.useMemo(() => {
    let list = logs;
    const q = (searchQuery ?? "").trim().toLowerCase();
    if (q) {
      list = list.filter(
        (log) =>
          (log.firm?.name ?? "").toLowerCase().includes(q) ||
          (log.firm?.discipline ?? "").toLowerCase().includes(q) ||
          (log.notes ?? "").toLowerCase().includes(q) ||
          (log.semester?.label ?? "").toLowerCase().includes(q) ||
          [log.firm?.contactFirstName, log.firm?.contactLastName, log.firm?.contactName]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(q)
      );
    }
    if (filterSemesterId) {
      const id = parseInt(filterSemesterId, 10);
      list = list.filter((log) => log.semesterId === id);
    }
    if (filterOutcome) {
      list = list.filter((log) => (log.outcome ?? "") === filterOutcome);
    }
    return list;
  }, [logs, searchQuery, filterSemesterId, filterOutcome]);

  const totalLogs = filteredLogs.length;
  const totalPages = Math.max(1, Math.ceil(totalLogs / pageSize));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const paginatedLogs = filteredLogs.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  useEffect(() => {
    setPage((p) => (p > totalPages && totalPages > 0 ? totalPages : p));
  }, [totalPages]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, filterSemesterId, filterOutcome]);

  const deleteAllLogs = async () => {
    if (!confirm("Permanently delete ALL speaker logs? This cannot be undone.")) return;
    setDeletingAll(true);
    setImportMessage(null);
    try {
      const res = await fetch("/api/speaker-logs/delete-all", { method: "POST" });
      const text = await res.text();
      let data: { error?: string } = {};
      if (text.trim() && !text.trimStart().startsWith("<")) {
        try {
          data = JSON.parse(text);
        } catch {
          data = {};
        }
      }
      if (!res.ok) {
        setImportMessage("Error: " + (data?.error ?? res.status));
        return;
      }
      setImportMessage("All speaker logs deleted.");
      setLogs([]);
    } catch (err) {
      setImportMessage("Delete failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setDeletingAll(false);
    }
  };

  const safeJson = async (res: Response) => {
    const text = await res.text();
    if (!text.trim()) return [];
    if (text.trimStart().startsWith("<")) return []; // HTML error page, not JSON
    try {
      return JSON.parse(text);
    } catch {
      return [];
    }
  };

  const fetchLogs = async () => {
    const res = await fetch(`/api/speaker-logs?_=${Date.now()}`, { cache: "no-store" });
    const text = await res.text();
    if (!res.ok) {
      setLogs([]);
      return;
    }
    let data: unknown;
    try {
      data = text.trim() && !text.trimStart().startsWith("<") ? JSON.parse(text) : [];
    } catch {
      data = [];
    }
    setLogs(Array.isArray(data) ? data : []);
  };
  const fetchFirms = async () => {
    const res = await fetch("/api/firms");
    const data = await safeJson(res);
    setFirms(Array.isArray(data) ? data : []);
  };

  /** One entry per firm name for the "New speaker log" dropdown (firms may have multiple rows for multiple contacts). */
  const firmsByUniqueName = React.useMemo(() => {
    const byName = new Map<string, Firm>();
    for (const f of firms) {
      const key = (f.name ?? "").trim() || String(f.id);
      if (!byName.has(key)) byName.set(key, f);
    }
    return Array.from(byName.values()).sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  }, [firms]);
  const fetchSemesters = async () => {
    const res = await fetch("/api/semesters");
    const data = await safeJson(res);
    setSemesters(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    Promise.all([fetchLogs(), fetchFirms(), fetchSemesters()]).finally(() =>
      setLoading(false)
    );
  }, []);

  const submitLog = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/speaker-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firmId: form.firmId,
        semesterId: form.semesterId,
        logDate: form.logDate,
        outcome: form.outcome,
        thankYouSent: form.thankYouSent,
        thankYouSentAt: form.thankYouSent ? new Date().toISOString() : undefined,
        notes: form.notes || undefined,
      }),
    });
    setShowForm(false);
    setForm({
      firmId: firmsByUniqueName[0]?.id ?? 0,
      semesterId: semesters[0]?.id ?? 0,
      logDate: new Date().toISOString().slice(0, 10),
      outcome: "confirm",
      thankYouSent: false,
      notes: "",
    });
    fetchLogs();
  };

  const markThankYou = async (id: number) => {
    await fetch(`/api/speaker-logs?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thankYouSent: true, thankYouSentAt: new Date().toISOString() }),
    });
    fetchLogs();
  };

  const remove = async (id: number) => {
    if (!confirm("Remove this log?")) return;
    await fetch(`/api/speaker-logs?id=${id}`, { method: "DELETE" });
    fetchLogs();
  };

  const updateOutcome = async (id: number, outcome: string) => {
    await fetch(`/api/speaker-logs?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome }),
    });
    fetchLogs();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMessage("Importing " + file.name + "…");
    e.target.value = "";
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/speaker-logs/import", { method: "POST", body: formData });
      const text = await res.text();
      let data: { error?: string; headersFound?: string[]; inserted?: number; skipped?: number; noFirm?: number; noSemester?: number } = {};
      if (text.trim() && !text.trimStart().startsWith("<")) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { error: "Invalid response from server" };
        }
      }
      if (!res.ok) {
        const errMsg = data.error || `Import failed (${res.status}).`;
        const extra = data.headersFound?.length ? " Headers in file: " + data.headersFound.join(", ") : "";
        setImportMessage("Error: " + errMsg + extra);
        return;
      }
      const msg = [
        `Imported: ${data.inserted ?? 0}`,
        data.skipped ? `Skipped: ${data.skipped}` : null,
        data.noFirm ? `Unknown firm: ${data.noFirm}` : null,
        data.noSemester ? `Unknown semester: ${data.noSemester}` : null,
      ].filter(Boolean).join(" · ");
      setImportMessage(msg);
      setLoading(true);
      await fetchLogs();
      setLoading(false);
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      setImportMessage("Import failed: " + msg);
    } finally {
      setImporting(false);
    }
  };

  const exportToExcel = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/speaker-logs/export");
      if (!res.ok) {
        const t = await res.text();
        let msg = "Export failed.";
        try {
          const j = JSON.parse(t);
          if (j?.error) msg = j.error;
        } catch {
          if (t) msg = t;
        }
        alert(msg);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("Content-Disposition")?.match(/filename="?([^"]+)"?/)?.[1] ?? "speaker-log.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Export failed.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Speaker logs</h1>
        <div className="flex items-center gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            disabled={importing}
            onChange={handleImportFile}
          />
          <button
            type="button"
            disabled={importing}
            onClick={() => {
              setImportMessage(null);
              importInputRef.current?.click();
            }}
            className="btn-ghost disabled:opacity-50"
          >
            {importing ? "Importing…" : "Import from Excel"}
          </button>
          <button
            type="button"
            onClick={exportToExcel}
            disabled={logs.length === 0 || exporting}
            className="btn-ghost disabled:opacity-50"
          >
            {exporting ? "Exporting…" : "Export to Excel"}
          </button>
          <button
            type="button"
            onClick={deleteAllLogs}
            disabled={deletingAll || logs.length === 0}
            className="text-red-400 hover:bg-red-400/10 px-4 py-2 rounded-lg font-medium disabled:opacity-50"
          >
            {deletingAll ? "Deleting…" : "Delete all"}
          </button>
          <button
            type="button"
            onClick={() => {
              setForm({
                firmId: firmsByUniqueName[0]?.id ?? 0,
                semesterId: semesters[0]?.id ?? 0,
                logDate: new Date().toISOString().slice(0, 10),
                outcome: "confirm",
                thankYouSent: false,
                notes: "",
              });
              setShowForm(true);
            }}
            className="btn-primary"
          >
            Add log
          </button>
        </div>
      </div>
      <p className="text-zinc-400">
        Track who came when, outcome (confirm when form filled; e-board toggles to spoke), and thank-you.
      </p>
      <p className="text-sm text-zinc-500">
        Import: Excel must have a header row. Required: <strong>Firm name</strong> (or Organization), <strong>Event date</strong> (or Date), <strong>Semester</strong> (e.g. Spring 2026) or <strong>Academic year</strong>. Optional: <strong>Outcome</strong> (Confirmed, Spoke, Canceled, Rescheduled), Notes. Missing firms are created automatically.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search firm, speaker, notes, semester…"
          className="input max-w-xs"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <span className="text-zinc-500">Semester</span>
          <select
            className="input py-1.5 min-w-[140px]"
            value={filterSemesterId}
            onChange={(e) => setFilterSemesterId(e.target.value)}
          >
            <option value="">All</option>
            {semesters.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-zinc-500">Outcome</span>
          <select
            className="input py-1.5 min-w-[120px]"
            value={filterOutcome}
            onChange={(e) => setFilterOutcome(e.target.value)}
          >
            <option value="">All</option>
            {OUTCOMES.map((o) => (
              <option key={o} value={o}>{OUTCOME_LABELS[o] ?? o}</option>
            ))}
          </select>
        </label>
        {(searchQuery || filterSemesterId || filterOutcome) && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setFilterSemesterId("");
              setFilterOutcome("");
            }}
            className="btn-ghost text-sm"
          >
            Clear filters
          </button>
        )}
      </div>

      {totalLogs > 0 && (
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-zinc-500">Show</span>
            <select
              className="input py-1.5 w-20"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span className="text-zinc-500">per page</span>
          </label>
          <span className="text-zinc-400">
            Showing {(pageSafe - 1) * pageSize + 1}–{Math.min(pageSafe * pageSize, totalLogs)} of {totalLogs}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pageSafe <= 1}
              className="btn-ghost py-1 px-2 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-2 text-zinc-500">
              Page {pageSafe} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={pageSafe >= totalPages}
              className="btn-ghost py-1 px-2 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {importMessage && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${importMessage.startsWith("Error") || importMessage.startsWith("Import failed") ? "border-red-500/50 bg-red-500/10 text-red-200" : "border-[var(--accent)]/30 bg-[var(--accent)]/10 text-zinc-200"}`}
          role="alert"
        >
          {importMessage}
          <button
            type="button"
            onClick={() => setImportMessage(null)}
            className="ml-3 text-zinc-400 hover:text-white underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {showForm && (
        <div className="card">
          <h2 className="font-semibold">New speaker log</h2>
          <form onSubmit={submitLog} className="mt-4 grid gap-3 sm:grid-cols-2 max-w-xl">
            <label>
              <span className="block text-sm text-zinc-500 mb-1">Firm</span>
              <select
                className="input"
                value={form.firmId}
                onChange={(e) => setForm((p) => ({ ...p, firmId: Number(e.target.value) }))}
                required
              >
                <option value={0}>Select…</option>
                {firmsByUniqueName.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="block text-sm text-zinc-500 mb-1">Semester</span>
              <select
                className="input"
                value={form.semesterId}
                onChange={(e) => setForm((p) => ({ ...p, semesterId: Number(e.target.value) }))}
                required
              >
                <option value={0}>Select…</option>
                {semesters.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="block text-sm text-zinc-500 mb-1">Date</span>
              <input
                type="date"
                className="input"
                value={form.logDate}
                onChange={(e) => setForm((p) => ({ ...p, logDate: e.target.value }))}
                required
              />
            </label>
            <label>
              <span className="block text-sm text-zinc-500 mb-1">Outcome</span>
              <select
                className="input"
                value={form.outcome}
                onChange={(e) => setForm((p) => ({ ...p, outcome: e.target.value as "confirm" }))}
              >
                {OUTCOMES.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                checked={form.thankYouSent}
                onChange={(e) => setForm((p) => ({ ...p, thankYouSent: e.target.checked }))}
                className="rounded border-zinc-600"
              />
              <span className="text-sm">Thank-you sent</span>
            </label>
            <label className="sm:col-span-2">
              <span className="block text-sm text-zinc-500 mb-1">Notes</span>
              <textarea
                className="input min-h-[80px]"
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </label>
            <div className="sm:col-span-2 flex gap-2">
              <button type="submit" className="btn-primary">Save</button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn-ghost"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="table-wrap">
        {loading ? (
          <p className="p-4 text-zinc-500">Loading…</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Firm Name</th>
                <th>Organization (ACCT/FIN/MIS/ALT)</th>
                <th>Session Title/Topic</th>
                <th>Event Date</th>
                <th>Academic Year</th>
                <th>Semester (Fall/Spring)</th>
                <th>Speaker Name</th>
                <th>Outcome (Confirmed/Spoke/Canceled/Rescheduled)</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paginatedLogs.map((log) => (
                <tr key={log.id}>
                  <td className="font-medium text-white">{log.firm?.name ?? "—"}</td>
                  <td>{log.firm?.discipline ?? "—"}</td>
                  <td>—</td>
                  <td>{log.logDate}</td>
                  <td>{log.semester?.year ?? "—"}</td>
                  <td>{log.semester?.label ?? "—"}</td>
                  <td>{speakerName(log.firm)}</td>
                  <td>
                    <select
                      className="input py-1 text-sm w-28"
                      value={log.outcome ?? "confirm"}
                      onChange={(e) => updateOutcome(log.id, e.target.value)}
                    >
                      {OUTCOMES.map((o) => (
                        <option key={o} value={o}>{OUTCOME_LABELS[o] ?? o}</option>
                      ))}
                    </select>
                  </td>
                  <td className="max-w-[200px] truncate">{log.notes ?? "—"}</td>
                  <td>
                    {log.thankYouSent ? (
                      <span className="text-[var(--success)] text-sm" title="Thank-you sent">✓</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => markThankYou(log.id)}
                        className="text-[var(--accent)] hover:underline text-sm"
                      >
                        Thank-you
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => remove(log.id)}
                      className="text-red-400 hover:underline text-sm ml-2"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {paginatedLogs.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-zinc-500">
                    {logs.length === 0
                      ? "No speaker logs yet. Add one above."
                      : "No speaker logs match your search or filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
