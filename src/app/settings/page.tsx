"use client";

import { useEffect, useState } from "react";

type Semester = {
  id: number;
  label: string;
  year: number;
  term: string;
  startDate: string | null;
  endDate: string | null;
  speakerCapacity: number | null;
  filledSlots?: number;
  remainingSlots?: number | null;
  isFull?: boolean;
};

export default function SettingsPage() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [openSemesterId, setOpenSemesterId] = useState<number | null>(null);
  const [inviteEmailYourName, setInviteEmailYourName] = useState("");
  const [inviteEmailEBoardPosition, setInviteEmailEBoardPosition] = useState("");
  const [inviteEmailSchedulingLink, setInviteEmailSchedulingLink] = useState("");
  const [inviteEmailSignatureEnabled, setInviteEmailSignatureEnabled] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [testModeEmail, setTestModeEmail] = useState("");
  const [savingTestMode, setSavingTestMode] = useState(false);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [newTerm, setNewTerm] = useState<"spring" | "fall">(
    new Date().getMonth() < 6 ? "spring" : "fall"
  );
  const [editingDates, setEditingDates] = useState<Record<number, { startDate: string; endDate: string }>>({});
  const [editingCapacity, setEditingCapacity] = useState<Record<number, string>>({});
  const [savingCapacity, setSavingCapacity] = useState<number | null>(null);

  const safeJson = async (res: Response) => {
    const text = await res.text();
    if (!text.trim()) return null;
    if (text.trimStart().startsWith("<")) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      const data = (await safeJson(res)) as {
        openSemesterId?: number | null;
        inviteEmailYourName?: string;
        inviteEmailEBoardPosition?: string;
        inviteEmailSchedulingLink?: string;
        inviteEmailSignatureEnabled?: boolean;
        testMode?: boolean;
        testModeEmail?: string;
      } | null;
      setOpenSemesterId(data?.openSemesterId ?? null);
      setInviteEmailYourName(typeof data?.inviteEmailYourName === "string" ? data.inviteEmailYourName : "");
      setInviteEmailEBoardPosition(typeof data?.inviteEmailEBoardPosition === "string" ? data.inviteEmailEBoardPosition : "");
      setInviteEmailSchedulingLink(typeof data?.inviteEmailSchedulingLink === "string" ? data.inviteEmailSchedulingLink : "");
      setInviteEmailSignatureEnabled(!!data?.inviteEmailSignatureEnabled);
      setTestMode(!!data?.testMode);
      setTestModeEmail(typeof data?.testModeEmail === "string" ? data.testModeEmail : "");
    } catch {
      // keep defaults
    }
  };

  const fetchSemesters = async () => {
    try {
      const res = await fetch("/api/semesters");
      const data = await safeJson(res);
      setSemesters(Array.isArray(data) ? data : []);
    } catch {
      setSemesters([]);
    }
  };

  useEffect(() => {
    Promise.all([fetchSettings(), fetchSemesters()]).finally(() => setLoading(false));
  }, []);

  const saveOpenSemester = async (id: number | null) => {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openSemesterId: id }),
      });
      setOpenSemesterId(id);
    } finally {
      setSaving(false);
    }
  };

  const saveInviteTemplate = async () => {
    setSavingTemplate(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteEmailYourName,
          inviteEmailEBoardPosition,
          inviteEmailSchedulingLink,
          inviteEmailSignatureEnabled,
        }),
      });
      if (!res.ok) alert("Failed to save template");
    } finally {
      setSavingTemplate(false);
    }
  };

  const saveTestMode = async () => {
    setSavingTestMode(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testMode, testModeEmail: testModeEmail.trim() || undefined }),
      });
      if (!res.ok) alert("Failed to save test mode");
    } finally {
      setSavingTestMode(false);
    }
  };

  const sendTestEmail = async () => {
    const email = testModeEmail.trim();
    if (!email) {
      alert("Enter a test email address above and save first.");
      return;
    }
    setSendingTestEmail(true);
    try {
      const res = await fetch("/api/send-test-email", { method: "POST" });
      const data = (await res.json()) as { error?: string; sentTo?: string; message?: string };
      if (!res.ok) alert(data?.error ?? "Failed to send test email");
      else alert(data?.message ?? `Sent to ${data?.sentTo}. Check that inbox and spam folder.`);
    } finally {
      setSendingTestEmail(false);
    }
  };

  const addSemester = async () => {
    const res = await fetch("/api/semesters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: newYear, term: newTerm }),
    });
    if (res.ok) await fetchSemesters();
    else {
      const data = (await safeJson(res)) as { error?: unknown } | null;
      alert(data?.error ? JSON.stringify(data.error) : "Failed to add semester");
    }
  };

  const updateSemesterDates = async (id: number, startDate: string, endDate: string) => {
    const res = await fetch(`/api/semesters?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: startDate || null, endDate: endDate || null }),
    });
    if (res.ok) {
      await fetchSemesters();
      setEditingDates((p) => {
        const next = { ...p };
        delete next[id];
        return next;
      });
    }
  };

  const saveCapacity = async (id: number) => {
    const raw = editingCapacity[id];
    const val = raw === "" || raw === undefined ? null : parseInt(String(raw), 10);
    if (val !== null && (Number.isNaN(val) || val < 0)) return;
    setSavingCapacity(id);
    try {
      const res = await fetch(`/api/semesters?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speakerCapacity: val }),
      });
      if (res.ok) {
        await fetchSemesters();
        setEditingCapacity((p) => { const n = { ...p }; delete n[id]; return n; });
      }
    } finally {
      setSavingCapacity(null);
    }
  };

  const removeSemester = async (id: number) => {
    if (!confirm("Delete this semester? Invites and logs for it will remain but the semester will be removed from the list.")) return;
    const res = await fetch(`/api/semesters?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      await fetchSemesters();
      if (openSemesterId === id) await saveOpenSemester(null);
    } else alert("Failed to delete.");
  };

  const startEditDates = (s: Semester) => {
    setEditingDates((p) => ({
      ...p,
      [s.id]: {
        startDate: s.startDate?.slice(0, 10) ?? "",
        endDate: s.endDate?.slice(0, 10) ?? "",
      },
    }));
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-zinc-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="text-zinc-400 max-w-xl">
        Set the semester that is open for invites (used on the Invites page) and manage semester start/end dates.
      </p>

      <div className="card max-w-xl">
        <h2 className="font-semibold text-[var(--accent)]">Open semester for invites</h2>
        <p className="mt-1 text-sm text-zinc-500">
          The Invites page will use this semester by default. Change it here when you start a new semester.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <select
            className="input w-auto min-w-[160px]"
            value={openSemesterId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              const id = v ? parseInt(v, 10) : null;
              saveOpenSemester(Number.isNaN(id) ? null : id);
            }}
            disabled={saving}
          >
            <option value="">None selected</option>
            {semesters.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          {saving && <span className="text-sm text-zinc-500">Saving…</span>}
        </div>
      </div>

      <div className="card max-w-xl">
        <h2 className="font-semibold text-[var(--accent)]">Test mode</h2>
        <p className="mt-1 text-sm text-zinc-500">
          When test mode is on, invite emails are still sent from your BAP email (same as live). They are sent to your test address instead of the firm’s contact, so you can verify delivery and the form without emailing real firms.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={testMode}
              onChange={(e) => setTestMode(e.target.checked)}
              className="rounded border-zinc-600"
            />
            <span className="text-sm font-medium">Test mode on</span>
          </label>
          <label className="block">
            <span className="block text-sm text-zinc-500 mb-1">Test email address</span>
            <input
              type="email"
              className="input w-72"
              placeholder="e.g. your-personal@university.edu or test@bap.org"
              value={testModeEmail}
              onChange={(e) => setTestModeEmail(e.target.value)}
            />
            <span className="block text-xs text-zinc-500 mt-1">Put your email here. When test mode is on, every invite is sent to this address instead of the firm’s contact.</span>
          </label>
          <button
            type="button"
            onClick={saveTestMode}
            disabled={savingTestMode}
            className="btn-primary disabled:opacity-50"
          >
            {savingTestMode ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={sendTestEmail}
            disabled={sendingTestEmail || !testModeEmail.trim()}
            className="btn-ghost disabled:opacity-50"
            title="Send a single test email to the address above to verify delivery"
          >
            {sendingTestEmail ? "Sending…" : "Send test email now"}
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Use “Send test email now” to verify that emails reach your test inbox. If it doesn’t arrive, check Resend’s dashboard (resend.com) and your spam folder.
        </p>
      </div>

      <div className="card max-w-xl">
        <h2 className="font-semibold text-[var(--accent)]">Send email from (BAP address)</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Invites are sent from your chapter/BAP email. That address is set in your <strong>.env</strong> file (project root), not here. Use <strong>GMAIL_USER</strong> for Gmail (e.g. <code className="text-zinc-400">yourchapter@gmail.com</code>), or <strong>RESEND_FROM_EMAIL</strong> if you use Resend. See <code className="text-zinc-400">.env.example</code> for the full list.
        </p>
      </div>

      <div className="card max-w-3xl">
        <h2 className="font-semibold text-[var(--accent)]">Invite email</h2>
        <p className="mt-1 text-sm text-zinc-500">
          The subject and body are fixed (BAP Nu Sigma template). Subject uses the semester you’re recruiting for. Set your name, position, and scheduling link below.
        </p>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="block text-sm text-zinc-500 mb-1">Your name</span>
            <input
              type="text"
              className="input"
              placeholder="e.g. Jane Smith"
              value={inviteEmailYourName}
              onChange={(e) => setInviteEmailYourName(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="block text-sm text-zinc-500 mb-1">E-Board position</span>
            <input
              type="text"
              className="input"
              placeholder="e.g. Vice President of Professional Relations"
              value={inviteEmailEBoardPosition}
              onChange={(e) => setInviteEmailEBoardPosition(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="block text-sm text-zinc-500 mb-1">Scheduling link URL</span>
            <input
              type="url"
              className="input"
              placeholder="https://..."
              value={inviteEmailSchedulingLink}
              onChange={(e) => setInviteEmailSchedulingLink(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={inviteEmailSignatureEnabled}
              onChange={(e) => setInviteEmailSignatureEnabled(e.target.checked)}
              className="rounded border-zinc-600 bg-zinc-800 text-[var(--accent)] focus:ring-[var(--accent)]"
            />
            <span className="text-sm">Include BAP chapter signature at bottom of invite emails</span>
          </label>
          <p className="text-xs text-zinc-500">
            When on, emails end with your name, position, and links to the chapter website (bapfdu.wixsite.com) and socials (linktr.ee/BAPFDU). Change “Your name” and “E-Board position” above to switch who is signing.
          </p>
          <button
            type="button"
            onClick={saveInviteTemplate}
            disabled={savingTemplate}
            className="btn-primary disabled:opacity-50"
          >
            {savingTemplate ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold">Semesters</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Add semesters, set speaker capacity (max slots), and optional start/end dates. When remaining spots hit zero, recruitment for that semester closes on the Invites page.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <select
            className="input w-auto"
            value={newTerm}
            onChange={(e) => setNewTerm(e.target.value as "spring" | "fall")}
          >
            <option value="spring">Spring</option>
            <option value="fall">Fall</option>
          </select>
          <select
            className="input w-auto"
            value={newYear}
            onChange={(e) => setNewYear(parseInt(e.target.value, 10))}
          >
            {Array.from({ length: 15 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button type="button" onClick={addSemester} className="btn-primary">
            Add semester
          </button>
        </div>
        <div className="table-wrap mt-4">
          <table>
            <thead>
              <tr>
                <th>Semester</th>
                <th>Speaker capacity</th>
                <th>Filled / Remaining</th>
                <th>Start date</th>
                <th>End date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {semesters.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium text-white">{s.label}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        className="input py-1 text-sm w-20"
                        placeholder="—"
                        value={editingCapacity[s.id] !== undefined ? editingCapacity[s.id] : (s.speakerCapacity ?? "")}
                        onChange={(e) =>
                          setEditingCapacity((p) => ({ ...p, [s.id]: e.target.value }))
                        }
                      />
                      {editingCapacity[s.id] !== undefined && (
                        <button
                          type="button"
                          className="text-[var(--accent)] hover:underline text-sm disabled:opacity-50"
                          disabled={savingCapacity === s.id}
                          onClick={() => saveCapacity(s.id)}
                        >
                          {savingCapacity === s.id ? "…" : "Save"}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="text-zinc-400 text-sm">
                    {s.speakerCapacity != null
                      ? `${s.filledSlots ?? 0} / ${s.speakerCapacity} — ${s.remainingSlots ?? 0} left`
                      : "—"}
                  </td>
                  <td>
                    {editingDates[s.id] ? (
                      <input
                        type="date"
                        className="input py-1 text-sm w-36"
                        value={editingDates[s.id].startDate}
                        onChange={(e) =>
                          setEditingDates((p) => ({ ...p, [s.id]: { ...p[s.id], startDate: e.target.value } }))
                        }
                      />
                    ) : (
                      <span className="text-zinc-400">{s.startDate ? s.startDate.slice(0, 10) : "—"}</span>
                    )}
                  </td>
                  <td>
                    {editingDates[s.id] ? (
                      <input
                        type="date"
                        className="input py-1 text-sm w-36"
                        value={editingDates[s.id].endDate}
                        onChange={(e) =>
                          setEditingDates((p) => ({ ...p, [s.id]: { ...p[s.id], endDate: e.target.value } }))
                        }
                      />
                    ) : (
                      <span className="text-zinc-400">{s.endDate ? s.endDate.slice(0, 10) : "—"}</span>
                    )}
                  </td>
                  <td className="space-x-2">
                    {editingDates[s.id] ? (
                      <>
                        <button
                          type="button"
                          className="text-[var(--accent)] hover:underline text-sm"
                          onClick={() =>
                            updateSemesterDates(s.id, editingDates[s.id].startDate, editingDates[s.id].endDate)
                          }
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn-ghost text-sm"
                          onClick={() => setEditingDates((p) => { const n = { ...p }; delete n[s.id]; return n; })}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="text-[var(--accent)] hover:underline text-sm"
                        onClick={() => startEditDates(s)}
                      >
                        Edit dates
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeSemester(s.id)}
                      className="text-red-400 hover:underline text-sm"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
