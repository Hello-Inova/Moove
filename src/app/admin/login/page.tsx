import { AuthCard } from "@/components/auth/AuthCard";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";

export default function AdminLoginPage() {
  return (
    <AuthCard title="Painel administrativo" subtitle="Acesso restrito.">
      <AdminLoginForm />
    </AuthCard>
  );
}
