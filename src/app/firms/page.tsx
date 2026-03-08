"use client";

import React, { useEffect, useState } from "react";

type Firm = {
  id: number;
  name: string;
  discipline: string | null;
  contactFirstName: string | null;
  contactLastName: string | null;
  contactEmail: string | null;
  contactName: string | null;
  title: string | null;
  practiceArea: string | null;
  firmType: string | null;
  industryFocus: string | null;
  location: string | null;
  alumniConnection: string | null;
  personalizedNote: string | null;
  notes: string | null;
  lastAcademicYearInvited: number | null;
  lastAcademicYearSpoke: number | null;
  lastSemesterSpoke: string | null;
};

const PAGE_SIZES = [10, 25, 50, 100] as const;

const emptyForm = {
  name: "",
  discipline: "",
  contactFirstName: "",
  contactLastName: "",
  contactEmail: "",
  contactName: "",
  title: "",
  practiceArea: "",
  firmType: "",
  industryFocus: "",
  location: "",
  alumniConnection: "",
  personalizedNote: "",
  notes: "",
};

export default function FirmsPage() {
  const [firms, setFirms] = useState<Firm[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Firm | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deletingAll, setDeletingAll] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDiscipline, setFilterDiscipline] = useState("");
  const [filterLastYearSpoke, setFilterLastYearSpoke] = useState("");
  const [filterLastSemesterSpoke, setFilterLastSemesterSpoke] = useState("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const filteredFirms = React.useMemo(() => {
    let list = firms;
    const q = (searchQuery ?? "").trim().toLowerCase();
    if (q) {
      list = list.filter(
        (f) =>
          (f.name ?? "").toLowerCase().includes(q) ||
          (f.discipline ?? "").toLowerCase().includes(q) ||
          (f.contactFirstName ?? "").toLowerCase().includes(q) ||
          (f.contactLastName ?? "").toLowerCase().includes(q) ||
          (f.contactEmail ?? "").toLowerCase().includes(q) ||
          (f.contactName ?? "").toLowerCase().includes(q) ||
          (f.title ?? "").toLowerCase().includes(q) ||
          (f.practiceArea ?? "").toLowerCase().includes(q) ||
          (f.firmType ?? "").toLowerCase().includes(q) ||
          (f.industryFocus ?? "").toLowerCase().includes(q) ||
          (f.location ?? "").toLowerCase().includes(q) ||
          (f.alumniConnection ?? "").toLowerCase().includes(q) ||
          (f.personalizedNote ?? "").toLowerCase().includes(q) ||
          (f.notes ?? "").toLowerCase().includes(q)
      );
    }
    if (filterDiscipline) {
      list = list.filter((f) => (f.discipline ?? "").trim().toLowerCase() === filterDiscipline.toLowerCase());
    }
    if (filterLastYearSpoke) {
      const y = parseInt(filterLastYearSpoke, 10);
      list = list.filter((f) => f.lastAcademicYearSpoke === y);
    }
    if (filterLastSemesterSpoke) {
      list = list.filter((f) => (f.lastSemesterSpoke ?? "").trim().toLowerCase() === filterLastSemesterSpoke.toLowerCase());
    }
    return list;
  }, [firms, searchQuery, filterDiscipline, filterLastYearSpoke, filterLastSemesterSpoke]);

  const distinctDisciplines = React.useMemo(() => {
    const set = new Set<string>();
    firms.forEach((f) => {
      const d = (f.discipline ?? "").trim();
      if (d) set.add(d);
    });
    return Array.from(set).sort();
  }, [firms]);
  const distinctLastYearSpoke = React.useMemo(() => {
    const set = new Set<number>();
    firms.forEach((f) => {
      if (f.lastAcademicYearSpoke != null) set.add(f.lastAcademicYearSpoke);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [firms]);
  const distinctLastSemesterSpoke = React.useMemo(() => {
    const set = new Set<string>();
    firms.forEach((f) => {
      const s = (f.lastSemesterSpoke ?? "").trim();
      if (s) set.add(s);
    });
    return Array.from(set).sort();
  }, [firms]);

  const totalFirms = filteredFirms.length;
  const totalPages = Math.max(1, Math.ceil(totalFirms / pageSize));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const paginatedFirms = filteredFirms.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  useEffect(() => {
    setPage((p) => (p > totalPages && totalPages > 0 ? totalPages : p));
  }, [totalPages]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, filterDiscipline, filterLastYearSpoke, filterLastSemesterSpoke]);

  const fetchFirms = async () => {
    let list: Firm[] = [];
    try {
      const res = await fetch("/api/firms");
      const raw = await res.text();
      const body = typeof raw === "string" ? raw.trim() : "";
      if (body.length > 0 && !body.startsWith("<")) {
        try {
          const parsed = JSON.parse(body) as unknown;
          if (Array.isArray(parsed)) list = parsed;
        } catch {
          list = [];
        }
      }
    } catch {
      list = [];
    }
    setFirms(list);
    setLoading(false);
  };

  useEffect(() => {
    fetchFirms();
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      discipline: form.discipline.trim() || undefined,
      contactFirstName: form.contactFirstName.trim() || undefined,
      contactLastName: form.contactLastName.trim() || undefined,
      contactEmail: form.contactEmail.trim() || undefined,
      contactName: form.contactName.trim() || undefined,
      title: form.title.trim() || undefined,
      practiceArea: form.practiceArea.trim() || undefined,
      firmType: form.firmType.trim() || undefined,
      industryFocus: form.industryFocus.trim() || undefined,
      location: form.location.trim() || undefined,
      alumniConnection: form.alumniConnection.trim() || undefined,
      personalizedNote: form.personalizedNote.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };
    if (editing) {
      await fetch(`/api/firms?id=${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/firms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setShowForm(false);
    setEditing(null);
    setForm(emptyForm);
    fetchFirms();
  };

  const startEdit = (f: Firm) => {
    setEditing(f);
    setForm({
      name: f.name ?? "",
      discipline: f.discipline ?? "",
      contactFirstName: f.contactFirstName ?? "",
      contactLastName: f.contactLastName ?? "",
      contactEmail: f.contactEmail ?? "",
      contactName: f.contactName ?? "",
      title: f.title ?? "",
      practiceArea: f.practiceArea ?? "",
      firmType: f.firmType ?? "",
      industryFocus: f.industryFocus ?? "",
      location: f.location ?? "",
      alumniConnection: f.alumniConnection ?? "",
      personalizedNote: f.personalizedNote ?? "",
      notes: f.notes ?? "",
    });
    setShowForm(true);
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this firm?")) return;
    await fetch(`/api/firms?id=${id}`, { method: "DELETE" });
    fetchFirms();
  };

  const deleteAll = async () => {
    if (!confirm("Permanently delete ALL firms and their invite/speaker history? This cannot be undone.")) return;
    setDeletingAll(true);
    try {
      const res = await fetch("/api/firms/delete-all", { method: "POST" });
      const text = await res.text();
      let errMsg = "Failed to delete.";
      if (text && !text.trimStart().startsWith("<")) {
        try {
          const data = JSON.parse(text) as { error?: string };
          if (data?.error) errMsg = data.error;
        } catch {
          // use default
        }
      }
      if (res.ok) {
        await fetchFirms();
      } else {
        alert(errMsg);
      }
    } catch (e) {
      alert("Request failed. Check the console.");
      console.error(e);
    } finally {
      setDeletingAll(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/firms/import", { method: "POST", body: formData });
      const text = await res.text();
      let data: { error?: string; headersFound?: string[]; inserted?: number; updated?: number; skipped?: number } = {};
      if (text.trim() && !text.trimStart().startsWith("<")) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { error: "Invalid response from server" };
        }
      }
      if (!res.ok) {
        const msg = data.error || "Import failed.";
        const extra = data.headersFound?.length ? " Headers in file: " + data.headersFound.join(", ") : "";
        alert(msg + extra);
        return;
      }
      alert(`Import complete. Inserted: ${data.inserted ?? 0}, Skipped (empty name): ${data.skipped ?? 0}`);
      fetchFirms();
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Firms</h1>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleImportFile}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="btn-ghost disabled:opacity-50"
          >
            {importing ? "Importing…" : "Import from Excel"}
          </button>
          <button
            type="button"
            onClick={deleteAll}
            disabled={deletingAll || firms.length === 0}
            className="text-red-400 hover:bg-red-400/10 px-4 py-2 rounded-lg font-medium disabled:opacity-50"
          >
            {deletingAll ? "Deleting…" : "Delete all"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setForm(emptyForm);
              setShowForm(true);
            }}
            className="btn-primary"
          >
            Add firm
          </button>
        </div>
      </div>
      <p className="text-sm text-zinc-500">
        Import: Excel must have a header row. Required column: <strong>Firm</strong>, <strong>Company</strong>, <strong>Name</strong>, or <strong>Organization</strong>. Optional: Discipline, Contact first name, Contact last name, Email, Title, Practice area, Firm type, Industry focus, Location, Alumni connection, Personalized note / Notes.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search firms, contacts, email, discipline…"
          className="input max-w-xs"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <span className="text-zinc-500">Discipline</span>
          <select
            className="input py-1.5 min-w-[120px]"
            value={filterDiscipline}
            onChange={(e) => setFilterDiscipline(e.target.value)}
          >
            <option value="">All</option>
            {distinctDisciplines.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-zinc-500">Last year spoke</span>
          <select
            className="input py-1.5 min-w-[100px]"
            value={filterLastYearSpoke}
            onChange={(e) => setFilterLastYearSpoke(e.target.value)}
          >
            <option value="">All</option>
            {distinctLastYearSpoke.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-zinc-500">Last semester spoke</span>
          <select
            className="input py-1.5 min-w-[120px]"
            value={filterLastSemesterSpoke}
            onChange={(e) => setFilterLastSemesterSpoke(e.target.value)}
          >
            <option value="">All</option>
            {distinctLastSemesterSpoke.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        {(searchQuery || filterDiscipline || filterLastYearSpoke || filterLastSemesterSpoke) && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setFilterDiscipline("");
              setFilterLastYearSpoke("");
              setFilterLastSemesterSpoke("");
            }}
            className="btn-ghost text-sm"
          >
            Clear filters
          </button>
        )}
      </div>

      {totalFirms > 0 && (
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
            Showing {(pageSafe - 1) * pageSize + 1}–{Math.min(pageSafe * pageSize, totalFirms)} of {totalFirms}
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

      {showForm && (
        <div className="card max-w-4xl">
          <h2 className="font-semibold">{editing ? "Edit firm" : "New firm"}</h2>
          <form onSubmit={save} className="mt-4 space-y-6">
            <div>
              <h3 className="text-sm font-medium text-zinc-400 mb-2">Organization</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="block text-sm text-zinc-500 mb-1">Organization / Name *</span>
                  <input className="input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
                </label>
                <label>
                  <span className="block text-sm text-zinc-500 mb-1">Discipline</span>
                  <input className="input" value={form.discipline} onChange={(e) => setForm((p) => ({ ...p, discipline: e.target.value }))} />
                </label>
                <label>
                  <span className="block text-sm text-zinc-500 mb-1">Firm type</span>
                  <input className="input" value={form.firmType} onChange={(e) => setForm((p) => ({ ...p, firmType: e.target.value }))} />
                </label>
                <label>
                  <span className="block text-sm text-zinc-500 mb-1">Practice area</span>
                  <input className="input" value={form.practiceArea} onChange={(e) => setForm((p) => ({ ...p, practiceArea: e.target.value }))} />
                </label>
                <label>
                  <span className="block text-sm text-zinc-500 mb-1">Industry focus</span>
                  <input className="input" value={form.industryFocus} onChange={(e) => setForm((p) => ({ ...p, industryFocus: e.target.value }))} />
                </label>
                <label className="sm:col-span-2">
                  <span className="block text-sm text-zinc-500 mb-1">Location</span>
                  <input className="input" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} />
                </label>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-zinc-400 mb-2">Contact</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="block text-sm text-zinc-500 mb-1">Contact first name</span>
                  <input className="input" value={form.contactFirstName} onChange={(e) => setForm((p) => ({ ...p, contactFirstName: e.target.value }))} />
                </label>
                <label>
                  <span className="block text-sm text-zinc-500 mb-1">Contact last name</span>
                  <input className="input" value={form.contactLastName} onChange={(e) => setForm((p) => ({ ...p, contactLastName: e.target.value }))} />
                </label>
                <label>
                  <span className="block text-sm text-zinc-500 mb-1">Email</span>
                  <input type="email" className="input" value={form.contactEmail} onChange={(e) => setForm((p) => ({ ...p, contactEmail: e.target.value }))} />
                </label>
                <label>
                  <span className="block text-sm text-zinc-500 mb-1">Title</span>
                  <input className="input" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
                </label>
                <label className="sm:col-span-2">
                  <span className="block text-sm text-zinc-500 mb-1">Contact name (legacy)</span>
                  <input className="input" value={form.contactName} onChange={(e) => setForm((p) => ({ ...p, contactName: e.target.value }))} placeholder="Or use first + last above" />
                </label>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-zinc-400 mb-2">Outreach & notes</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="block text-sm text-zinc-500 mb-1">Alumni connection</span>
                  <input className="input" value={form.alumniConnection} onChange={(e) => setForm((p) => ({ ...p, alumniConnection: e.target.value }))} />
                </label>
                <label className="sm:col-span-2">
                  <span className="block text-sm text-zinc-500 mb-1">Personalized note</span>
                  <textarea className="input min-h-[60px]" value={form.personalizedNote} onChange={(e) => setForm((p) => ({ ...p, personalizedNote: e.target.value }))} />
                </label>
                <label className="sm:col-span-2">
                  <span className="block text-sm text-zinc-500 mb-1">Notes</span>
                  <textarea className="input min-h-[80px]" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
                </label>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary">{editing ? "Save" : "Create"}</button>
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="btn-ghost">Cancel</button>
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
                <th>Organization Discipline</th>
                <th>Firm Name</th>
                <th>Contact First Name</th>
                <th>Contact Last Name</th>
                <th>Email</th>
                <th>Title</th>
                <th>Practice Area</th>
                <th>Firm Type</th>
                <th>Industry Focus</th>
                <th>Location</th>
                <th>Alumni Connection</th>
                <th>Personalization Notes</th>
                <th>Last year invited</th>
                <th>Last year spoke</th>
                <th>Last semester spoke</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paginatedFirms.map((f) => (
                <tr key={f.id}>
                  <td>{f.discipline ?? "—"}</td>
                  <td className="font-medium text-white">{f.name}</td>
                  <td>{f.contactFirstName ?? "—"}</td>
                  <td>{f.contactLastName ?? "—"}</td>
                  <td>{f.contactEmail ?? "—"}</td>
                  <td>{f.title ?? "—"}</td>
                  <td>{f.practiceArea ?? "—"}</td>
                  <td>{f.firmType ?? "—"}</td>
                  <td>{f.industryFocus ?? "—"}</td>
                  <td>{f.location ?? "—"}</td>
                  <td>{f.alumniConnection ?? "—"}</td>
                  <td className="max-w-[200px] truncate" title={f.personalizedNote ?? undefined}>{f.personalizedNote ?? "—"}</td>
                  <td>{f.lastAcademicYearInvited ?? "—"}</td>
                  <td>{f.lastAcademicYearSpoke ?? "—"}</td>
                  <td>{f.lastSemesterSpoke ?? "—"}</td>
                  <td>
                    <button type="button" onClick={() => startEdit(f)} className="text-[var(--accent)] hover:underline mr-3">Edit</button>
                    <button type="button" onClick={() => remove(f.id)} className="text-red-400 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
              {paginatedFirms.length === 0 && !loading && (
                <tr>
                  <td colSpan={16} className="text-zinc-500">
                    {firms.length === 0
                      ? "No firms yet. Add one above."
                      : "No firms match your search or filters."}
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
