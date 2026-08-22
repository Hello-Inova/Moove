import Link from "next/link";

import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ConviteNominalWizard } from "@/components/responsavel/ConviteNominalWizard";

/**
 * Página pública (sem login) que abre direto do link do convite nominal
 * (e-mail/WhatsApp) — ver plano de implantação do fluxo "Tio cadastra o
 * Pai". Todo o passo a passo (cadastro → verificação → endereço →
 * assinatura) acontece dentro do ConviteNominalWizard, sem navegação de
 * página a página.
 */
export default async function ConviteNominalPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;

  return (
    <main className="relative flex min-h-screen flex-1 flex-col items-center justify-center overflow-y-auto bg-gradient-to-b from-brand-orange-soft/40 to-white px-4 py-12 dark:from-neutral-900 dark:to-neutral-950">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-900 sm:p-8">
        <Link href="/" className="inline-block">
          <Logo height={24} />
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-brand-navy dark:text-white">Contrato de transporte</h1>
        <div className="mt-6">
          <ConviteNominalWizard codigo={codigo} />
        </div>
      </div>
    </main>
  );
}
