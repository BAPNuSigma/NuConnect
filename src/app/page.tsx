import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-zinc-400 max-w-xl">
        Manage speaker invites for beta, alpha, psi, and new sigma chapter. Use the one-year
        eligibility rule and track speaker logs and scheduling form responses.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/firms" className="card block hover:border-[var(--accent)]/50 transition">
          <h2 className="font-semibold text-[var(--accent)]">Firms</h2>
          <p className="mt-1 text-sm text-zinc-500">Add and edit firms and contacts</p>
        </Link>
        <Link href="/invites" className="card block hover:border-[var(--accent)]/50 transition">
          <h2 className="font-semibold text-[var(--accent)]">Invites</h2>
          <p className="mt-1 text-sm text-zinc-500">Send invites by semester (1-year rule applied)</p>
        </Link>
        <Link href="/speaker-logs" className="card block hover:border-[var(--accent)]/50 transition">
          <h2 className="font-semibold text-[var(--accent)]">Speaker logs</h2>
          <p className="mt-1 text-sm text-zinc-500">Who came when, thank-you tracking</p>
        </Link>
        <Link href="/scheduling" className="card block hover:border-[var(--accent)]/50 transition">
          <h2 className="font-semibold text-[var(--accent)]">Scheduling form</h2>
          <p className="mt-1 text-sm text-zinc-500">Submissions from your Google Form</p>
        </Link>
      </div>
      <div className="card max-w-xl">
        <h2 className="font-semibold">Eligibility rule</h2>
        <p className="mt-2 text-sm text-zinc-400">
          A firm cannot be invited back within one year. If they spoke in <strong>Spring 2026</strong>,
          they become eligible again for <strong>Spring 2027</strong>.
        </p>
      </div>
    </div>
  );
}
