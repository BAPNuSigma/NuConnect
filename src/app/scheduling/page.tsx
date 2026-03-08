"use client";

import { useEffect, useState } from "react";

type Submission = {
  id: number;
  firmId: number | null;
  firmName: string | null;
  semesterId: number | null;
  submittedAt: string;
  rawPayload: string | null;
  firm: { id: number; name: string } | null;
  semester: { id: number; label: string } | null;
};

export default function SchedulingPage() {
  const [list, setList] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState("/api/webhooks/google-forms");

  useEffect(() => {
    fetch("/api/scheduling")
      .then(async (res) => {
        const text = await res.text();
        if (!text.trim() || text.trimStart().startsWith("<")) return [];
        try {
          return JSON.parse(text);
        } catch {
          return [];
        }
      })
      .then((data) => {
        setList(Array.isArray(data) ? data : []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setWebhookUrl(`${window.location.origin}/api/webhooks/google-forms`);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Scheduling form</h1>
      <p className="text-zinc-400">
        Submissions from your Google Form appear here. Link the form to the webhook below.
      </p>

      <div className="card max-w-2xl">
        <h2 className="font-semibold text-[var(--accent)]">Connect your Google Form</h2>
        <ol className="mt-3 list-decimal list-inside space-y-2 text-sm text-zinc-400">
          <li>Open your form in Google Forms.</li>
          <li>Go to the three-dots menu → Get pre-filled link, or use Google Apps Script.</li>
          <li>
            In Apps Script, add a trigger on form submit that sends a POST request to:
          </li>
        </ol>
        <code className="mt-2 block break-all rounded bg-zinc-900 px-3 py-2 text-xs text-[var(--accent)]">
          {webhookUrl}
        </code>
        <p className="mt-2 text-sm text-zinc-500">
          Body: JSON with <code className="text-zinc-400">firmName</code>,{" "}
          <code className="text-zinc-400">semester</code> (or <code className="text-zinc-400">semesterLabel</code>).
          Optional: set <code className="text-zinc-400">GOOGLE_FORMS_WEBHOOK_SECRET</code> and send{" "}
          <code className="text-zinc-400">Authorization: Bearer &lt;secret&gt;</code>.
        </p>
      </div>

      <div className="card">
        <h2 className="font-semibold">Recent submissions</h2>
        <div className="table-wrap mt-4">
          {loading ? (
            <p className="p-4 text-zinc-500">Loading…</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Firm</th>
                  <th>Semester</th>
                  <th>Submitted at</th>
                  <th>Raw</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr key={row.id}>
                    <td className="font-medium text-white">
                      {row.firm?.name ?? row.firmName ?? "—"}
                    </td>
                    <td>{row.semester?.label ?? "—"}</td>
                    <td>{row.submittedAt}</td>
                    <td className="max-w-[200px] truncate text-xs">
                      {row.rawPayload ? "✓" : "—"}
                    </td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-zinc-500">
                      No submissions yet. Connect the webhook above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
