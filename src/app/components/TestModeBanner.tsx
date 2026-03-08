"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function TestModeBanner() {
  const [testMode, setTestMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data: { testMode?: boolean }) => {
        if (!cancelled && data?.testMode) setTestMode(true);
      })
      .catch(() => {});
    setMounted(true);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!mounted || !testMode) return null;

  return (
    <div
      className="sticky top-0 z-50 w-full border-b border-amber-500/50 bg-amber-500/15 px-4 py-2 text-center text-sm font-medium text-amber-200"
      role="status"
    >
      Test mode is on — invite emails are not sent to real contacts.{" "}
      <Link href="/settings" className="underline hover:text-amber-100">
        Change in Settings
      </Link>
    </div>
  );
}
