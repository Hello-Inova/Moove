import { redirect } from "next/navigation";

import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";

export default async function MotoristaLoginPage() {
  const motorista = await getAuthenticatedMotorista();
  if (motorista) redirect("/motorista/painel");

  return (
    <AuthCard
      title="Entrar como motorista"
      subtitle="Acesse para compartilhar sua localização e gerenciar convites."
      footer={{ href: "/motorista/cadastro", label: "Ainda não tem conta?", linkLabel: "Cadastre-se" }}
    >
      <LoginForm role="motorista" />
    </AuthCard>
  );
}
