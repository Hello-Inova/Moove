import type { ReactNode } from "react";

import { MotoristaShell } from "@/components/motorista/MotoristaShell";

/**
 * Layout compartilhado por todas as páginas autenticadas do motorista
 * (dashboard, escolas, veículos, convites, vínculos, cobranças, planos).
 *
 * Isso é o que faz o `MotoristaShell` — e o `LocationSharingProvider` (GPS)
 * dentro dele — sobreviver à navegação entre essas páginas: como elas moram
 * num route group `(app)` com este layout em comum, o Next.js mantém o
 * layout montado e só troca o conteúdo da página por baixo. Antes, cada
 * página renderizava seu próprio `<MotoristaShell>`, então navegar pra
 * "Vínculos" ou "Convites" desmontava tudo e derrubava o `watchPosition` do
 * GPS no meio da rota — era necessário confirmar antes de sair.
 */
export default function MotoristaAppLayout({ children }: { children: ReactNode }) {
  return <MotoristaShell>{children}</MotoristaShell>;
}
