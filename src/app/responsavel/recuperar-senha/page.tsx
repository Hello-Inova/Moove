import { redirect } from "next/navigation";

import { getAuthenticatedResponsavel } from "@/lib/auth/guards";
import { AuthCard } from "@/components/auth/AuthCard";
import { RecuperarSenhaForm } from "@/components/auth/RecuperarSenhaForm";

export default async function ResponsavelRecuperarSenhaPage() {
  const responsavel = await getAuthenticatedResponsavel();
  if (responsavel) redirect("/responsavel/dashboard");

  return (
    <AuthCard
      title="Recuperar senha"
      subtitle="Vamos te enviar um código por e-mail para você criar uma nova senha."
      footer={{ href: "/responsavel/login", label: "Lembrou a senha?", linkLabel: "Voltar para o login" }}
    >
      <RecuperarSenhaForm role="responsavel" />
    </AuthCard>
  );
}
