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

const hiddenResponseKeys = new Set(["firmName", "company", "firm", "semester", "semesterLabel"]);

function getResponses(rawPayload: string | null): Array<[string, string]> {
  if (!rawPayload) return [];
  try {
    const payload = JSON.parse(rawPayload) as Record<string, unknown>;
    return Object.entries(payload)
      .filter(([key]) => !hiddenResponseKeys.has(key))
      .map(([key, value]) => [key, Array.isArray(value) ? value.join(", ") : value == null ? "—" : String(value)]);
  } catch {
    return [["Response", rawPayload]];
  }
}

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
                  <th>Form responses</th>
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
                    <td className="min-w-[280px] text-sm">
                      {getResponses(row.rawPayload).length > 0 ? (
                        <dl className="space-y-1">
                          {getResponses(row.rawPayload).map(([question, answer]) => (
                            <div key={question}>
                              <dt className="inline font-medium text-zinc-300">{question}: </dt>
                              <dd className="inline whitespace-pre-wrap text-zinc-400">{answer}</dd>
                            </div>
                          ))}
                        </dl>
                      ) : "—"}
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
