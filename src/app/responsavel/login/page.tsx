import { redirect } from "next/navigation";

import { getAuthenticatedResponsavel } from "@/lib/auth/guards";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";

export default async function ResponsavelLoginPage() {
  const responsavel = await getAuthenticatedResponsavel();
  if (responsavel) redirect("/responsavel/dashboard");

  return (
    <AuthCard
      title="Entrar como responsável"
      subtitle="Acesse para acompanhar a localização do transporte escolar."
      footer={{ href: "/responsavel/cadastro", label: "Ainda não tem conta?", linkLabel: "Cadastre-se" }}
    >
      <LoginForm role="responsavel" />
    </AuthCard>
  );
}
