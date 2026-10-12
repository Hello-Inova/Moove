import { redirect } from "next/navigation";
import Link from "next/link";

import { AuthCard } from "@/components/auth/AuthCard";
import { UnifiedLoginForm } from "@/components/auth/UnifiedLoginForm";
import { getAuthenticatedMotorista, getAuthenticatedResponsavel } from "@/lib/auth/guards";

export default async function LoginPage() {
  const [motorista, responsavel] = await Promise.all([getAuthenticatedMotorista(), getAuthenticatedResponsavel()]);
  if (motorista) redirect("/motorista/painel");
  if (responsavel) redirect("/responsavel/dashboard");
  return (
    <AuthCard
      title="Entrar na Moove"
      subtitle="Informe seus dados; vamos direcionar você ao seu painel."
    >
      <UnifiedLoginForm />
      <p className="mt-6 text-center text-sm text-neutral-600 dark:text-neutral-400">
        Ainda não tem conta?{" "}
        <Link href="/motorista/cadastro" className="underline underline-offset-2">
          Motorista
        </Link>
        {" ou "}
        <Link href="/responsavel/cadastro" className="underline underline-offset-2">
          responsável
        </Link>.
      </p>
    </AuthCard>
  );
}
