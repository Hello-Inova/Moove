"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton({ role }: { role: "motorista" | "responsavel" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await fetch(`/api/auth/${role}/logout`, { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="text-sm font-medium text-neutral-600 underline hover:text-neutral-900 disabled:opacity-50"
    >
      Sair
    </button>
  );
}
