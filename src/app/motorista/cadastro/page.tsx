import { redirect } from "next/navigation";

import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { AuthCard } from "@/components/auth/AuthCard";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default async function MotoristaCadastroPage() {
  const motorista = await getAuthenticatedMotorista();
  if (motorista) redirect("/motorista/painel");

  return (
    <AuthCard
      title="Cadastro de motorista"
      subtitle="Depois de criar sua conta você cadastra seu veículo e gera convites para os responsáveis."
      footer={{ href: "/motorista/login", label: "Já tem conta?", linkLabel: "Entrar" }}
    >
      <RegisterForm role="motorista" />
    </AuthCard>
  );
}
