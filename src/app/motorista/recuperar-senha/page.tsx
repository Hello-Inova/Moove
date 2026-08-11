import { redirect } from "next/navigation";

import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { AuthCard } from "@/components/auth/AuthCard";
import { RecuperarSenhaForm } from "@/components/auth/RecuperarSenhaForm";

export default async function MotoristaRecuperarSenhaPage() {
  const motorista = await getAuthenticatedMotorista();
  if (motorista) redirect("/motorista/dashboard");

  return (
    <AuthCard
      title="Recuperar senha"
      subtitle="Vamos te enviar um código por e-mail para você criar uma nova senha."
      footer={{ href: "/motorista/login", label: "Lembrou a senha?", linkLabel: "Voltar para o login" }}
    >
      <RecuperarSenhaForm role="motorista" />
    </AuthCard>
  );
}
