import { redirect } from "next/navigation";

import { getAuthenticatedResponsavel } from "@/lib/auth/guards";
import { AuthCard } from "@/components/auth/AuthCard";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default async function ResponsavelCadastroPage() {
  const responsavel = await getAuthenticatedResponsavel();
  if (responsavel) redirect("/responsavel/dashboard");

  return (
    <AuthCard
      title="Cadastro de responsável"
      subtitle="Depois de criar sua conta, use o código de convite recebido do motorista para se vincular."
      footer={{ href: "/responsavel/login", label: "Já tem conta?", linkLabel: "Entrar" }}
    >
      <RegisterForm role="responsavel" />
    </AuthCard>
  );
}
