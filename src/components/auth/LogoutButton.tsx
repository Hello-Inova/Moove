"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useLocationSharingContext } from "@/contexts/LocationSharingContext";

export function LogoutButton({ role }: { role: "motorista" | "responsavel" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { confirmAndRun } = useLocationSharingContext();

  async function doLogout() {
    setLoading(true);
    await fetch(`/api/auth/${role}/logout`, { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={() => confirmAndRun(doLogout)}
      disabled={loading}
      className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
    >
      Sair
    </button>
  );
}
