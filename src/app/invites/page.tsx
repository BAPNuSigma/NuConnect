"use client";

import { useEffect, useState } from "react";

const PAGE_SIZES = [10, 25, 50, 100] as const;

type Semester = { id: number; label: string; year: number; term: string; speakerCapacity?: number | null; filledSlots?: number; remainingSlots?: number | null; isFull?: boolean };
type FirmEligibility = {
  id: number;
  name: string;
  contactEmail: string | null;
  eligible: boolean;
  lastSpokeSemester: string | null;
  alreadyInvited: boolean;
};
type InviteRecord = {
  id: number;
  firmId: number;
  semesterId: number;
  sentAt: string | null;
  inByStatus: string | null;
  followUpDate: string | null;
  replied: boolean | null;
  firm: { id: number; name: string; contactEmail: string | null };
  semester: { id: number; label: string } | null;
};

export default function InvitesPage() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [firms, setFirms] = useState<FirmEligibility[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(null);
  const [openSemesterId, setOpenSemesterId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<number | null>(null);
  const [sendingBatch, setSendingBatch] = useState(false);
  const [inviteRecords, setInviteRecords] = useState<InviteRecord[]>([]);
  const [overriding, setOverriding] = useState<number | null>(null);
  const [semesterClosed, setSemesterClosed] = useState(false);
  const [remainingSlots, setRemainingSlots] = useState<number | null>(null);
  const [pageSize, setPageSize] = useState(25);
  const [pageEligible, setPageEligible] = useState(1);
  const [pageInvited, setPageInvited] = useState(1);
  const [pageIneligible, setPageIneligible] = useState(1);

  const safeJson = async (res: Response): Promise<unknown> => {
    const raw = await res.text();
    const body = typeof raw === "string" ? raw.trim() : "";
    if (body.length === 0) return null;
    if (body.startsWith("<")) return null; // HTML error page, not JSON
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  };

  const fetchSemesters = async () => {
    const [semRes, settingsRes] = await Promise.all([
      fetch("/api/semesters"),
      fetch("/api/settings"),
    ]);
    const semData = await safeJson(semRes);
    const settingsData = (await safeJson(settingsRes)) as { openSemesterId?: number | null } | null;
    const list = Array.isArray(semData) ? semData : [];
    setSemesters(list);
    const openId = settingsData?.openSemesterId ?? null;
    setOpenSemesterId(openId ?? null);
    if (list.length && selectedSemesterId === null) {
      setSelectedSemesterId(openId && list.some((s: { id: number }) => s.id === openId) ? openId : list[0].id);
    }
  };

  const fetchFirms = async () => {
    if (!selectedSemesterId) return;
    const [eligibilityRes, invitesRes] = await Promise.all([
      fetch(`/api/eligibility?semesterId=${selectedSemesterId}`),
      fetch(`/api/invites?semesterId=${selectedSemesterId}`),
    ]);
    const eligibilityData = (await safeJson(eligibilityRes)) as { firms?: FirmEligibility[]; semesterClosed?: boolean; remainingSlots?: number | null } | null;
    const invitesData = await safeJson(invitesRes);
    setFirms(Array.isArray(eligibilityData?.firms) ? eligibilityData.firms : []);
    setSemesterClosed(eligibilityData?.semesterClosed ?? false);
    setRemainingSlots(eligibilityData?.remainingSlots ?? null);
    setInviteRecords(Array.isArray(invitesData) ? invitesData : []);
  };

  useEffect(() => {
    fetchSemesters();
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchFirms().finally(() => setLoading(false));
  }, [selectedSemesterId]);

  const sendInvite = async (firmId: number) => {
    if (!selectedSemesterId) return;
    setSending(firmId);
    try {
      const res = await fetch("/api/send-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firmId, semesterId: selectedSemesterId }),
      });
      const data = (await safeJson(res)) as { error?: string; sent?: boolean; message?: string; testMode?: boolean; sentTo?: string } | null;
      if (!res.ok) {
        alert(data?.error ?? "Failed to send");
        return;
      }
      fetchFirms();
      if (data?.sent === false && data?.message) {
        alert(data.message);
      } else if (data?.sent === true && data?.sentTo) {
        alert(`Invite sent to ${data.sentTo}. Check that inbox (and spam) for the email.`);
      } else if (data?.sent === true && data?.testMode) {
        alert("Test mode: email sent to your test address. Check that inbox (and spam folder).");
      }
    } finally {
      setSending(null);
    }
  };

  const markAsInvitedNoEmail = async (firmId: number) => {
    if (!selectedSemesterId) return;
    setOverriding(firmId);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firmId, semesterId: selectedSemesterId }),
      });
      const data = (await safeJson(res)) as { error?: string } | null;
      if (!res.ok) alert(data?.error ?? "Failed");
      else fetchFirms();
    } finally {
      setOverriding(null);
    }
  };

  const removeInvite = async (inviteId: number) => {
    if (!confirm("Remove this invite? The firm will be back in the pending pool for batch send.")) return;
    try {
      const res = await fetch(`/api/invites?id=${inviteId}`, { method: "DELETE" });
      if (!res.ok) alert("Failed to remove");
      else fetchFirms();
    } catch {
      alert("Failed to remove");
    }
  };

  const updateInvite = async (inviteId: number, data: { inByStatus?: string; followUpDate?: string; replied?: boolean }) => {
    const res = await fetch(`/api/invites?id=${inviteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) fetchFirms();
  };

  const sendAllPending = async () => {
    if (!selectedSemesterId) return;
    setSendingBatch(true);
    try {
      const res = await fetch("/api/send-invites-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ semesterId: selectedSemesterId }),
      });
      const data = (await safeJson(res)) as { error?: string; sent?: number; semesterLabel?: string; skippedNoEmail?: number; errors?: { firmName: string }[] } | null;
      if (!res.ok) {
        alert(data?.error ?? "Batch send failed");
        return;
      }
      let msg = `Sent ${data?.sent ?? 0} invite(s) for ${data?.semesterLabel ?? ""}.`;
      if (data?.skippedNoEmail) msg += ` ${data.skippedNoEmail} firm(s) had no email (recorded only).`;
      if (data?.errors?.length) msg += ` ${data.errors.length} failed: ${data.errors.map((e) => e.firmName).join(", ")}`;
      alert(msg);
      fetchFirms();
    } finally {
      setSendingBatch(false);
    }
  };

  const eligibleToShow = firms.filter((f) => f.eligible && !f.alreadyInvited);
  const invited = firms.filter((f) => f.alreadyInvited);
  const ineligible = firms.filter((f) => !f.eligible);

  const paginate = <T,>(list: T[], page: number) => {
    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const pageSafe = Math.min(Math.max(1, page), totalPages);
    const start = (pageSafe - 1) * pageSize;
    return { list: list.slice(start, start + pageSize), pageSafe, totalPages, total };
  };

  const eligiblePag = paginate(eligibleToShow, pageEligible);
  const invitedPag = paginate(inviteRecords, pageInvited);
  const ineligiblePag = paginate(ineligible, pageIneligible);

  useEffect(() => {
    setPageEligible(1);
    setPageInvited(1);
    setPageIneligible(1);
  }, [pageSize]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Invites</h1>
      <p className="text-zinc-400">
        Pick a semester and send invite emails. Only firms eligible under the 1-year rule are
        available to invite. A firm cannot be invited back within one year — e.g. if a firm spoke in{" "}
        <strong>Spring 2026</strong>, they become eligible again in <strong>Spring 2027</strong>.
      </p>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          <span className="text-sm text-zinc-500">Semester</span>
          <select
            className="input w-auto min-w-[140px]"
            value={selectedSemesterId ?? ""}
            onChange={(e) => setSelectedSemesterId(Number(e.target.value) || null)}
          >
            <option value="">Select…</option>
            {semesters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
                {openSemesterId === s.id ? " (open)" : ""}
                {s.isFull ? " (full)" : s.remainingSlots != null ? ` (${s.remainingSlots} left)` : ""}
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm text-zinc-500">
          Set the open semester in <a href="/settings" className="text-[var(--accent)] hover:underline">Settings</a>.
        </p>
        {selectedSemesterId && remainingSlots !== null && !semesterClosed && (
          <span className="text-sm text-zinc-500">
            {remainingSlots} spot{remainingSlots !== 1 ? "s" : ""} remaining
          </span>
        )}
        {selectedSemesterId && (
          <button
            type="button"
            disabled={sendingBatch || eligibleToShow.length === 0 || semesterClosed}
            onClick={sendAllPending}
            className="btn-primary disabled:opacity-50"
          >
            {sendingBatch ? "Sending…" : "Send all pending now"}
          </button>
        )}
      </div>

      {semesterClosed && selectedSemesterId && (
        <div className="card border-amber-500/50 bg-amber-500/10">
          <p className="font-medium text-amber-200">This semester is full. Recruitment is closed. Set a higher speaker capacity in Settings to reopen.</p>
        </div>
      )}

      {selectedSemesterId && !loading && (
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-zinc-500">Show</span>
            <select
              className="input py-1.5 w-20"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span className="text-zinc-500">per page</span>
          </label>
        </div>
      )}

      {loading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : !selectedSemesterId ? (
        <p className="text-zinc-500">Add a semester in Settings, then select it above.</p>
      ) : (
        <>
          <div className="card">
            <h2 className="font-semibold text-[var(--accent)]">Eligible to invite</h2>
            <p className="mt-1 text-sm text-zinc-500">
              No invite sent yet for this semester; 1-year rule satisfied.
            </p>
            {eligiblePag.total > 0 && (
              <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-zinc-400">
                <span>Showing {(eligiblePag.pageSafe - 1) * pageSize + 1}–{Math.min(eligiblePag.pageSafe * pageSize, eligiblePag.total)} of {eligiblePag.total}</span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setPageEligible((p) => Math.max(1, p - 1))} disabled={eligiblePag.pageSafe <= 1} className="btn-ghost py-1 px-2 text-sm disabled:opacity-50">Previous</button>
                  <span className="px-2 text-zinc-500">Page {eligiblePag.pageSafe} of {eligiblePag.totalPages}</span>
                  <button type="button" onClick={() => setPageEligible((p) => Math.min(eligiblePag.totalPages, p + 1))} disabled={eligiblePag.pageSafe >= eligiblePag.totalPages} className="btn-ghost py-1 px-2 text-sm disabled:opacity-50">Next</button>
                </div>
              </div>
            )}
            <div className="table-wrap mt-4">
              <table>
                <thead>
                  <tr>
                    <th>Firm</th>
                    <th>Contact email</th>
                    <th>Last spoke</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {eligiblePag.list.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-zinc-500">
                        No eligible firms (or all already invited).
                      </td>
                    </tr>
                  ) : (
                    eligiblePag.list.map((f) => (
                      <tr key={f.id}>
                        <td className="font-medium text-white">{f.name}</td>
                        <td>{f.contactEmail ?? "—"}</td>
                        <td>{f.lastSpokeSemester ?? "Never"}</td>
                        <td className="space-x-2">
                          <button
                            type="button"
                            disabled={sending === f.id || semesterClosed}
                            onClick={() => sendInvite(f.id)}
                            className="btn-primary text-sm py-1 px-3 disabled:opacity-50"
                          >
                            {sending === f.id ? "Sending…" : "Send invite"}
                          </button>
                          <button
                            type="button"
                            disabled={overriding === f.id}
                            onClick={() => markAsInvitedNoEmail(f.id)}
                            className="btn-ghost text-sm py-1 px-3 disabled:opacity-50"
                            title="Mark as invited without sending email (override)"
                          >
                            {overriding === f.id ? "…" : "Mark invited (no email)"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h2 className="font-semibold">Already invited this semester</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Email sent date, in-by status, follow-up date, and replied. Override: remove invite to put firm back in pending pool.
            </p>
            {invitedPag.total > 0 && (
              <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-zinc-400">
                <span>Showing {(invitedPag.pageSafe - 1) * pageSize + 1}–{Math.min(invitedPag.pageSafe * pageSize, invitedPag.total)} of {invitedPag.total}</span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setPageInvited((p) => Math.max(1, p - 1))} disabled={invitedPag.pageSafe <= 1} className="btn-ghost py-1 px-2 text-sm disabled:opacity-50">Previous</button>
                  <span className="px-2 text-zinc-500">Page {invitedPag.pageSafe} of {invitedPag.totalPages}</span>
                  <button type="button" onClick={() => setPageInvited((p) => Math.min(invitedPag.totalPages, p + 1))} disabled={invitedPag.pageSafe >= invitedPag.totalPages} className="btn-ghost py-1 px-2 text-sm disabled:opacity-50">Next</button>
                </div>
              </div>
            )}
            <div className="table-wrap mt-4">
              <table>
                <thead>
                  <tr>
                    <th>Firm</th>
                    <th>Contact email</th>
                    <th>Email sent date</th>
                    <th>In-by status</th>
                    <th>Follow-up date</th>
                    <th>Replied</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {invitedPag.list.map((inv: InviteRecord) => (
                    <tr key={inv.id}>
                      <td className="font-medium text-white">{inv.firm?.name ?? "—"}</td>
                      <td>{inv.firm?.contactEmail ?? "—"}</td>
                      <td className="text-zinc-400 text-sm">
                        {inv.sentAt ? new Date(inv.sentAt).toLocaleDateString() : "—"}
                      </td>
                      <td>
                        <select
                          className="input py-1 text-sm w-32"
                          value={inv.inByStatus ?? ""}
                          onChange={(e) => updateInvite(inv.id, { inByStatus: e.target.value || undefined })}
                        >
                          <option value="">—</option>
                          <option value="invited">Invited</option>
                          <option value="replied">Replied</option>
                          <option value="scheduled">Scheduled</option>
                          <option value="declined">Declined</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="date"
                          className="input py-1 text-sm w-36"
                          value={inv.followUpDate ? inv.followUpDate.slice(0, 10) : ""}
                          onChange={(e) => updateInvite(inv.id, { followUpDate: e.target.value || undefined })}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={!!inv.replied}
                          onChange={(e) => updateInvite(inv.id, { replied: e.target.checked })}
                          className="rounded border-zinc-600"
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => removeInvite(inv.id)}
                          className="text-amber-400 hover:underline text-sm"
                          title="Remove invite so this firm can get the next batch email"
                        >
                          Remove invite
                        </button>
                      </td>
                    </tr>
                  ))}
                  {invitedPag.list.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-zinc-500">
                        None yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h2 className="font-semibold text-zinc-500">Not eligible (within 1 year)</h2>
            <p className="mt-1 text-sm text-zinc-500">
              These firms spoke recently; they become eligible again for the same semester next year.
              Override: mark as invited (no email) so they are not sent by the batch job.
            </p>
            {ineligiblePag.total > 0 && (
              <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-zinc-400">
                <span>Showing {(ineligiblePag.pageSafe - 1) * pageSize + 1}–{Math.min(ineligiblePag.pageSafe * pageSize, ineligiblePag.total)} of {ineligiblePag.total}</span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setPageIneligible((p) => Math.max(1, p - 1))} disabled={ineligiblePag.pageSafe <= 1} className="btn-ghost py-1 px-2 text-sm disabled:opacity-50">Previous</button>
                  <span className="px-2 text-zinc-500">Page {ineligiblePag.pageSafe} of {ineligiblePag.totalPages}</span>
                  <button type="button" onClick={() => setPageIneligible((p) => Math.min(ineligiblePag.totalPages, p + 1))} disabled={ineligiblePag.pageSafe >= ineligiblePag.totalPages} className="btn-ghost py-1 px-2 text-sm disabled:opacity-50">Next</button>
                </div>
              </div>
            )}
            <div className="table-wrap mt-4">
              <table>
                <thead>
                  <tr>
                    <th>Firm</th>
                    <th>Last spoke</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {ineligiblePag.list.map((f) => (
                    <tr key={f.id}>
                      <td className="font-medium text-white">{f.name}</td>
                      <td>{f.lastSpokeSemester ?? "—"}</td>
                      <td>
                        <button
                          type="button"
                          disabled={overriding === f.id}
                          onClick={() => markAsInvitedNoEmail(f.id)}
                          className="btn-ghost text-sm py-1 px-3 disabled:opacity-50"
                          title="Mark as invited without sending email (override 1-year rule)"
                        >
                          {overriding === f.id ? "…" : "Mark invited (override)"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {ineligiblePag.list.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-zinc-500">None.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
