"use client";

import React, { useState } from "react";

type LeadStatus = "new" | "tracked";

type LeadRow = {
  name: string;
  url: string;
  displayLink: string;
  snippet: string;
  status: LeadStatus;
  selected: boolean;
  enriching: boolean;
  contactEmail: string;
  contactPhone: string;
  enrichError: string | null;
  added: boolean;
};

const emptyForm = { discipline: "", location: "", firmType: "" };

export default function LeadsPage() {
  const [form, setForm] = useState(emptyForm);
  const [results, setResults] = useState<LeadRow[]>([]);
  const [query, setQuery] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const selectedCount = results.filter((r) => r.selected && r.status === "new" && !r.added).length;

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch("/api/leads/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setSearchError(data.error ?? "Search failed.");
        setResults([]);
        setQuery(null);
        return;
      }
      setQuery(data.query ?? null);
      setResults(
        (data.results ?? []).map((r: Omit<LeadRow, "selected" | "enriching" | "contactEmail" | "contactPhone" | "enrichError" | "added">) => ({
          ...r,
          selected: r.status === "new",
          enriching: false,
          contactEmail: "",
          contactPhone: "",
          enrichError: null,
          added: false,
        }))
      );
    } catch {
      setSearchError("Search request failed. Check the console.");
    } finally {
      setSearching(false);
    }
  };

  const toggleSelected = (idx: number) => {
    setResults((prev) => prev.map((r, i) => (i === idx ? { ...r, selected: !r.selected } : r)));
  };

  const findContact = async (idx: number) => {
    setResults((prev) => prev.map((r, i) => (i === idx ? { ...r, enriching: true, enrichError: null } : r)));
    const row = results[idx];
    try {
      const res = await fetch("/api/leads/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: row.url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResults((prev) => prev.map((r, i) => (i === idx ? { ...r, enriching: false, enrichError: data.error ?? "Couldn't find contact info." } : r)));
        return;
      }
      const email = (data.emails ?? [])[0] ?? "";
      const phone = (data.phones ?? [])[0] ?? "";
      setResults((prev) =>
        prev.map((r, i) =>
          i === idx
            ? {
                ...r,
                enriching: false,
                contactEmail: email,
                contactPhone: phone,
                enrichError: email || phone ? null : "No contact info found on that page.",
              }
            : r
        )
      );
    } catch {
      setResults((prev) => prev.map((r, i) => (i === idx ? { ...r, enriching: false, enrichError: "Request failed." } : r)));
    }
  };

  const addSelected = async () => {
    const toAdd = results
      .map((r, idx) => ({ r, idx }))
      .filter(({ r }) => r.selected && r.status === "new" && !r.added);
    if (toAdd.length === 0) return;
    setImporting(true);
    let added = 0;
    try {
      for (const { r, idx } of toAdd) {
        const res = await fetch("/api/firms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: r.name,
            discipline: form.discipline || undefined,
            firmType: form.firmType || undefined,
            location: form.location || undefined,
            contactEmail: r.contactEmail || undefined,
            notes: `Sourced via Lead Search ("${query}") on ${new Date().toISOString().slice(0, 10)}. ${r.url}`,
          }),
        });
        if (res.ok) {
          added++;
          setResults((prev) => prev.map((row, i) => (i === idx ? { ...row, added: true, selected: false } : row)));
        }
      }
      alert(`Added ${added} of ${toAdd.length} to Firms.`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Find Leads</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Searches the open web for candidate firms and checks each one against your existing Firms list.
          </p>
        </div>
      </div>

      <form onSubmit={search} className="card flex flex-wrap items-end gap-3">
        <label className="min-w-[160px] flex-1">
          <span className="block text-sm text-zinc-500 mb-1">Discipline</span>
          <input
            className="input"
            placeholder="e.g. Corporate Law"
            value={form.discipline}
            onChange={(e) => setForm((p) => ({ ...p, discipline: e.target.value }))}
          />
        </label>
        <label className="min-w-[160px] flex-1">
          <span className="block text-sm text-zinc-500 mb-1">Location</span>
          <input
            className="input"
            placeholder="e.g. Philadelphia, PA"
            value={form.location}
            onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
          />
        </label>
        <label className="min-w-[140px] flex-1">
          <span className="block text-sm text-zinc-500 mb-1">Firm type</span>
          <input
            className="input"
            placeholder="e.g. Mid-size"
            value={form.firmType}
            onChange={(e) => setForm((p) => ({ ...p, firmType: e.target.value }))}
          />
        </label>
        <button type="submit" className="btn-primary" disabled={searching}>
          {searching ? "Searching…" : "Search"}
        </button>
      </form>

      {searchError && (
        <div className="card border-red-900/50 text-red-400 text-sm">{searchError}</div>
      )}

      {results.length > 0 && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>Status</th>
                  <th>Organization</th>
                  <th>Snippet</th>
                  <th>Contact</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, idx) => (
                  <tr key={idx}>
                    <td>
                      <input
                        type="checkbox"
                        checked={r.selected}
                        disabled={r.status === "tracked" || r.added}
                        onChange={() => toggleSelected(idx)}
                      />
                    </td>
                    <td>
                      {r.added ? (
                        <span className="text-xs font-medium text-[var(--accent)]">Added</span>
                      ) : r.status === "new" ? (
                        <span className="text-xs font-medium text-[var(--success)] bg-[var(--success)]/10 rounded-full px-2 py-0.5">New</span>
                      ) : (
                        <span className="text-xs font-medium text-[var(--warning)] bg-[var(--warning)]/10 rounded-full px-2 py-0.5">
                          Already in NuConnect
                        </span>
                      )}
                    </td>
                    <td>
                      <a href={r.url} target="_blank" rel="noreferrer" className="font-medium text-white hover:text-[var(--accent)]">
                        {r.name}
                      </a>
                      <div className="text-xs text-zinc-500">{r.displayLink}</div>
                    </td>
                    <td className="max-w-[280px] text-zinc-400 text-sm">{r.snippet}</td>
                    <td className="min-w-[180px]">
                      {r.contactEmail || r.contactPhone ? (
                        <div className="text-sm">
                          {r.contactEmail && <div>{r.contactEmail}</div>}
                          {r.contactPhone && <div className="text-zinc-500">{r.contactPhone}</div>}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => findContact(idx)}
                          disabled={r.enriching}
                          className="text-[var(--accent)] hover:underline text-sm disabled:opacity-50"
                        >
                          {r.enriching ? "Looking…" : "Find contact"}
                        </button>
                      )}
                      {r.enrichError && <div className="text-xs text-red-400 mt-1">{r.enrichError}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm">
              <span className="font-semibold">{selectedCount} selected</span>{" "}
              <span className="text-zinc-500">
                of {results.length} results — {results.filter((r) => r.status === "tracked").length} already tracked
              </span>
            </span>
            <button type="button" className="btn-primary disabled:opacity-50" onClick={addSelected} disabled={selectedCount === 0 || importing}>
              {importing ? "Adding…" : "Add selected to Firms"}
            </button>
          </div>
        </>
      )}

      {!searching && results.length === 0 && !searchError && (
        <p className="text-sm text-zinc-500">Enter a discipline, location, or firm type above and search to see candidates.</p>
      )}
    </div>
  );
}
