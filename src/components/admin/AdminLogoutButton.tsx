"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminLogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function doLogout() {
    setLoading(true);
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <button
      onClick={doLogout}
      disabled={loading}
      className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:text-neutral-300"
    >
      Sair
    </button>
  );
}
